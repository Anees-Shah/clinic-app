import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCancellationFeeStatus } from "@/lib/cancellation";
import { NextRequest, NextResponse } from "next/server";
import { addMinutes } from "date-fns";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { appointmentId, newStartAt } = await request.json();

    if (!appointmentId || !newStartAt) {
      return NextResponse.json({ error: "Missing required fields", message: "Missing required fields" }, { status: 400 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found", message: "Appointment not found" }, { status: 404 });
    }

    if (appointment.status !== "confirmed") {
      return NextResponse.json({ error: "Can only move confirmed appointments", message: "Can only move confirmed appointments" }, { status: 400 });
    }

    const newStart = new Date(newStartAt);
    if (Number.isNaN(newStart.getTime())) {
      return NextResponse.json({ error: "Invalid target slot", message: "Invalid target slot" }, { status: 400 });
    }
    const totalDuration = appointment.service.durationMin + appointment.service.bufferBeforeMin + appointment.service.bufferAfterMin;
    const newEnd = addMinutes(newStart, totalDuration);

    // Check for conflicts using the EXCLUDE constraint logic
    const conflict = await prisma.appointment.findFirst({
      where: {
        providerId: appointment.providerId,
        status: { in: ["confirmed", "completed"] },
        id: { not: appointmentId },
        OR: [
          {
            startsAt: { lt: newEnd },
            endsAt: { gt: newStart },
          },
        ],
      },
    });

    if (conflict) {
      return NextResponse.json({ error: "Time slot conflicts with another appointment", message: "Time slot conflicts with another appointment" }, { status: 409 });
    }

    // Late-cancel evaluation on the new slot (same London-canonical rule as
    // the patient cancel flow). Best-effort: if the fee calc fails, the move
    // still goes through with flags untouched.
    let lateCancelFee: boolean | undefined;
    try {
      const feeStatus = await getCancellationFeeStatus(newStart);
      lateCancelFee = feeStatus.lateCancelFee;
    } catch (e) {
      console.warn("[move] fee evaluation skipped (dev fallback):", e);
    }

    // Update appointment (response shape unchanged: { appointment })
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        startsAt: newStart,
        endsAt: newEnd,
        ...(lateCancelFee !== undefined ? { lateCancelFee } : {}),
      },
      include: {
        service: true,
        provider: true,
      },
    });

    // Trigger SSE broadcast via Inngest
    await fetch(`${process.env.NEXTAUTH_URL}/api/inngest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "appointment.moved",
        data: { appointmentId: updated.id },
      }),
    }).catch(() => {});

    return NextResponse.json({ appointment: updated });
  } catch (error) {
    console.error("Failed to move appointment:", error);
    return NextResponse.json({ error: "Failed to move appointment", message: "Failed to move appointment" }, { status: 500 });
  }
}
