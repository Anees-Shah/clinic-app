import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSlotAvailable, computeSlots } from "@/lib/availability";
import { londonToUtc } from "@/lib/london";
import { generateToken } from "@/lib/tokens";
import { addMinutes } from "date-fns";
import { inngest } from "@/inngest/client";

interface BookingRequest {
  serviceCode: string;
  providerId: string;
  date: string;
  slotTime: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  notes?: string;
  smsOptIn: boolean;
}

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get("Idempotency-Key");

  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "Idempotency-Key header is required" },
      { status: 400 }
    );
  }

  const existing = await prisma.appointment.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return NextResponse.json(
      { appointmentId: existing.id, duplicate: true },
      { status: 200 }
    );
  }

  let body: BookingRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { serviceCode, providerId, date, slotTime, patientName, patientEmail, patientPhone, notes, smsOptIn } = body;

  if (!serviceCode || !providerId || !date || !slotTime || !patientName || !patientEmail || !patientPhone) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const service = await prisma.service.findUnique({
    where: { code: serviceCode },
    select: { id: true, durationMin: true, bufferBeforeMin: true, bufferAfterMin: true },
  });

  if (!service) {
    return NextResponse.json(
      { error: "Service not found" },
      { status: 404 }
    );
  }

  // date/slotTime are London wall time (yyyy-MM-dd / HH:mm) — convert to the
  // true UTC instant. Never parseISO() them: that reads the wall time as UTC
  // and shifts every booking by the London offset.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(slotTime)) {
    return NextResponse.json(
      { error: "Invalid date or time" },
      { status: 400 }
    );
  }
  const startAt = londonToUtc(date, slotTime);
  const endAt = addMinutes(startAt, service.durationMin + service.bufferBeforeMin + service.bufferAfterMin);

  const available = await isSlotAvailable(providerId, service.id, startAt);

  if (!available) {
    return NextResponse.json(
      { error: "This slot is no longer available" },
      { status: 409 }
    );
  }

  // Enforce working hours + date overrides (blocks/closures). isSlotAvailable
  // only checks appointment conflicts, so without this a blocked day could
  // still be booked via a direct POST.
  const daySlots = await computeSlots(providerId, service.id, startAt);
  const withinWorkingHours = daySlots.some(
    (s) => s.available && s.start.getTime() === startAt.getTime()
  );

  if (!withinWorkingHours) {
    return NextResponse.json(
      { error: "This slot is outside working hours or on a blocked date" },
      { status: 409 }
    );
  }

  const cancelToken = generateToken();
  const rescheduleToken = generateToken();

  let appointment;
  try {
    appointment = await prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          providerId,
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
          providerId,
          serviceId: service.id,
          patientName,
          patientEmail,
          patientPhone,
          startsAt: startAt,
          endsAt: endAt,
          status: "confirmed",
          notes,
          cancelToken,
          rescheduleToken,
          idempotencyKey,
        },
        include: {
          service: true,
          provider: true,
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

  // Trigger confirmation email + reminder scheduling.
  // Wrapped so a missing/unreachable Inngest (dev) never fails the booking.
  try {
    await inngest.send({
      name: "appointment.created",
      data: { appointmentId: appointment!.id },
    });
  } catch (e) {
    console.warn("[booking] appointment.created event not delivered (dev fallback):", e);
  }
  try {
    await inngest.send({
      name: "appointment.schedule_reminders",
      data: { appointmentId: appointment!.id },
    });
  } catch (e) {
    console.error("Failed to schedule reminders:", e);
  }

  return NextResponse.json(
    { appointmentId: appointment!.id },
    { status: 201 }
  );
}