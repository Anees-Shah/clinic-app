import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSlotAvailable } from "@/lib/availability";
import { londonToUtc } from "@/lib/london";
import { generateToken } from "@/lib/tokens";
import { addMinutes } from "date-fns";
import { randomBytes } from "crypto";
import { inngest } from "@/inngest/client";

export async function POST(request: NextRequest) {
  let body: { claimToken: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { claimToken } = body;

  if (!claimToken) {
    return NextResponse.json(
      { error: "Claim token is required" },
      { status: 400 }
    );
  }

  // Find the waitlist entry with this claim token
  const waitlistEntry = await prisma.waitlistEntry.findUnique({
    where: { claimToken },
    include: {
      service: true,
      provider: true,
    },
  });

  if (!waitlistEntry) {
    return NextResponse.json(
      { error: "Invalid claim token" },
      { status: 404 }
    );
  }

  // Check if token has expired
  if (waitlistEntry.expiresAt && new Date() > waitlistEntry.expiresAt) {
    // Clean up expired token
    await prisma.waitlistEntry.update({
      where: { id: waitlistEntry.id },
      data: { claimToken: null, expiresAt: null },
    });
    return NextResponse.json(
      { error: "This claim link has expired" },
      { status: 410 }
    );
  }

  // Check if already claimed
  if (waitlistEntry.claimedAt) {
    return NextResponse.json(
      { error: "This slot has already been claimed" },
      { status: 409 }
    );
  }

  const service = await prisma.service.findUnique({
    where: { id: waitlistEntry.serviceId },
    select: { id: true, durationMin: true, bufferBeforeMin: true, bufferAfterMin: true },
  });

  if (!service) {
    return NextResponse.json(
      { error: "Service not found" },
      { status: 404 }
    );
  }

  // Requested date is a London calendar day; book 10:00 London wall time.
  const dateStr = waitlistEntry.requestedDate.toISOString().split("T")[0];
  const startAt = londonToUtc(dateStr, "10:00");
  const endAt = addMinutes(startAt, service.durationMin + service.bufferBeforeMin + service.bufferAfterMin);

  // Verify slot is available
  const available = await isSlotAvailable(waitlistEntry.providerId, service.id, startAt);

  if (!available) {
    return NextResponse.json(
      { error: "The slot is no longer available" },
      { status: 409 }
    );
  }

  // Create the appointment
  const cancelToken = randomBytes(32).toString("hex");
  const rescheduleToken = randomBytes(32).toString("hex");

  let appointment;
  try {
    appointment = await prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          providerId: waitlistEntry.providerId,
          status: { in: ["confirmed", "completed"] },
          OR: [
            {
              startsAt: { lt: endAt },
              endsAt: { gt: startAt },
            },
          ],
        },
      });

      if (conflict) {
        throw new Error("SLOT_TAKEN");
      }

      const appt = await tx.appointment.create({
        data: {
          providerId: waitlistEntry.providerId,
          serviceId: waitlistEntry.serviceId,
          patientName: waitlistEntry.patientName,
          patientEmail: waitlistEntry.patientEmail,
          patientPhone: waitlistEntry.patientPhone,
          startsAt: startAt,
          endsAt: endAt,
          status: "confirmed",
          cancelToken,
          rescheduleToken,
        },
        include: {
          service: true,
          provider: true,
        },
      });

      // Update waitlist entry as claimed
      await tx.waitlistEntry.update({
        where: { id: waitlistEntry.id },
        data: {
          claimedAt: new Date(),
          claimToken: null,
          expiresAt: null,
        },
      });

      return appt;
    }, {
      isolationLevel: "Serializable",
      maxWait: 5000,
      timeout: 10000,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_TAKEN") {
      return NextResponse.json(
        { error: "This slot was just booked by someone else" },
        { status: 409 }
      );
    }
    throw e;
  }

  // Same post-booking events as the normal booking route: confirmation email
  // (+ calendar push via appointment.created) and 24h/1h reminders.
  // Guarded so a missing/unreachable Inngest (dev) never fails the claim.
  try {
    await inngest.send({
      name: "appointment.created",
      data: { appointmentId: appointment!.id },
    });
  } catch (e) {
    console.warn("[claim] appointment.created event not delivered (dev fallback):", e);
  }
  try {
    await inngest.send({
      name: "appointment.schedule_reminders",
      data: { appointmentId: appointment!.id },
    });
  } catch (e) {
    console.warn("[claim] schedule_reminders event not delivered (dev fallback):", e);
  }

  return NextResponse.json({
    appointmentId: appointment!.id,
    slot: {
      date: dateStr,
      time: "10:00",
    },
  }, { status: 201 });
}