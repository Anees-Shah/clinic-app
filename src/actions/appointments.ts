"use server";

import { prisma } from "@/lib/prisma";
import { isSlotAvailable } from "@/lib/availability";
import { isWithinFreeCancelWindow, getCancellationFeeStatus } from "@/lib/cancellation";
import { addMinutes } from "date-fns";
import { inngest } from "@/inngest/client";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

export interface CancelResult {
  success: boolean;
  error?: string;
  appointment?: {
    id: string;
    patientName: string;
    serviceName: string;
    providerName: string;
    startsAt: Date;
  };
}

export interface RescheduleResult {
  success: boolean;
  error?: string;
  conflict?: boolean;
  appointment?: {
    id: string;
    patientName: string;
    serviceName: string;
    providerName: string;
    startsAt: Date;
    endsAt: Date;
    cancelToken?: string | null;
    rescheduleToken?: string | null;
  };
}

/**
 * Cancel an appointment using a cancel token
 * - Validates token (exists, not expired, single-use)
 * - Updates status to cancelled
 * - Frees the slot
 * - Queues waitlist promotion job
 * - Invalidates token (single-use)
 * - Triggers cancellation notification
 */
export async function cancelAppointment(token: string): Promise<CancelResult> {
  let appointment;
  try {
    // Find appointment by cancel token
    appointment = await prisma.appointment.findUnique({
      where: { cancelToken: token },
      include: {
        service: true,
        provider: true,
      },
    });
  } catch (e) {
    console.error("[cancelAppointment] DB lookup failed:", e);
    return { success: false, error: "Service temporarily unavailable. Please try again." };
  }

  if (!appointment) {
    return { success: false, error: "Invalid or expired cancellation link" };
  }

  // Check if already cancelled
  if (appointment.status === "cancelled") {
    return { success: false, error: "This appointment has already been cancelled" };
  }

  // Tokens stay valid until the appointment starts (not 24h after booking).
  // Previously createdAt+24h killed links for appointments days away.
  if (new Date() > new Date(appointment.startsAt)) {
    return { success: false, error: "This appointment has already started and can no longer be cancelled" };
  }

  // Check cancellation fee status (for notification)
  const feeStatus = await getCancellationFeeStatus(appointment.startsAt);

  // Atomic transaction: update appointment + invalidate token
  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "cancelled",
        cancelToken: null, // Single-use: invalidate token
        lateCancelFee: feeStatus.lateCancelFee,
        noShowFee: feeStatus.noShowFee,
      },
    });
  });

  // Trigger cancellation notification + waitlist promotion (async).
  // Never let a missing/unreachable Inngest fail the user-facing cancel.
  try {
    await inngest.send({
      name: "appointment.cancelled",
      data: { appointmentId: appointment.id },
    });
  } catch (e) {
    console.warn("[cancelAppointment] appointment.cancelled event not delivered (dev fallback):", e);
  }

  // Queue waitlist promotion check
  try {
    await inngest.send({
      name: "appointment.waitlist_promote",
      data: {
        providerId: appointment.providerId,
        serviceId: appointment.serviceId,
        cancelledAt: appointment.startsAt,
      },
    });
  } catch (e) {
    console.warn("[cancelAppointment] waitlist_promote event not delivered (dev fallback):", e);
  }

  revalidatePath("/dashboard");

  return {
    success: true,
    appointment: {
      id: appointment.id,
      patientName: appointment.patientName,
      serviceName: appointment.service.name,
      providerName: appointment.provider.name,
      startsAt: appointment.startsAt,
    },
  };
}

/**
 * Reschedule an appointment using a reschedule token
 * - Validates token (exists, not expired, single-use)
 * - Shows current booking + new calendar/slot selection
 * - Inline HEAD check validates slot still free
 * - Atomic cancel old + create new in one SERIALIZABLE transaction
 * - On conflict: original booking preserved, toast "New slot unavailable, your original booking stands"
 */
export async function rescheduleAppointment(
  token: string,
  newStartAt: Date
): Promise<RescheduleResult> {
  let appointment;
  try {
    // Find appointment by reschedule token
    appointment = await prisma.appointment.findUnique({
      where: { rescheduleToken: token },
      include: {
        service: true,
        provider: true,
      },
    });
  } catch (e) {
    console.error("[rescheduleAppointment] DB lookup failed:", e);
    return { success: false, error: "Service temporarily unavailable. Please try again." };
  }

  if (!appointment) {
    return { success: false, error: "Invalid or expired reschedule link" };
  }

  // Check if already cancelled or completed
  if (appointment.status === "cancelled" || appointment.status === "completed" || appointment.status === "no_show") {
    return { success: false, error: "This appointment can no longer be rescheduled" };
  }

  // Tokens stay valid until the appointment starts (not 24h after booking).
  if (new Date() > new Date(appointment.startsAt)) {
    return { success: false, error: "This appointment has already started and can no longer be rescheduled" };
  }

  const service = appointment.service;
  // Server actions may deliver Dates as strings — normalize first.
  const newStart = new Date(newStartAt as unknown as string | Date);
  if (Number.isNaN(newStart.getTime())) {
    console.error("[rescheduleAppointment] invalid newStartAt:", newStartAt);
    return { success: false, error: "Invalid date selected. Please pick another slot." };
  }
  const totalDuration = service.durationMin + service.bufferBeforeMin + service.bufferAfterMin;
  const newEndAt = addMinutes(newStart, totalDuration);

  // Inline HEAD check: verify slot is available before attempting transaction.
  // Exclude the appointment being moved so it never conflicts with itself.
  let available = false;
  try {
    available = await isSlotAvailable(appointment.providerId, service.id, newStart, appointment.id);
  } catch (e) {
    console.error("[rescheduleAppointment] availability check failed:", e);
    return { success: false, error: "Service temporarily unavailable. Please try again." };
  }
  if (!available) {
    return { 
      success: false, 
      error: "New slot unavailable, your original booking stands",
      conflict: true,
    };
  }

  // Atomic transaction: cancel old + create new in SERIALIZABLE isolation
  // Late-cancel evaluation for the booking being given up (same rule as the
  // cancel flow — the freed slot may be too close to refill).
  const oldFeeStatus = await getCancellationFeeStatus(appointment.startsAt);
  try {
    const newAppointment = await prisma.$transaction(async (tx) => {
      // Re-check slot availability inside transaction (double-check).
      // Exclude the appointment being moved (it is still `confirmed` here
      // and would otherwise self-conflict on overlapping moves).
      const conflict = await tx.appointment.findFirst({
        where: {
          providerId: appointment.providerId,
          status: { in: ["confirmed", "completed"] },
          id: { not: appointment.id },
          OR: [
            {
              startsAt: { lt: newEndAt },
              endsAt: { gt: newStart },
            },
          ],
        },
      });

      if (conflict) {
        throw new Error("SLOT_TAKEN");
      }

      // Cancel old appointment (invalidate reschedule token too)
      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: "cancelled",
          rescheduleToken: null, // Single-use: invalidate token
          cancelToken: null, // Also invalidate cancel token
          lateCancelFee: oldFeeStatus.lateCancelFee,
          noShowFee: oldFeeStatus.noShowFee,
        },
      });

      // Create new appointment with new tokens
      const newCancelToken = randomBytes(32).toString("hex");
      const newRescheduleToken = randomBytes(32).toString("hex");

      const newAppt = await tx.appointment.create({
        data: {
          providerId: appointment.providerId,
          serviceId: appointment.serviceId,
          patientName: appointment.patientName,
          patientEmail: appointment.patientEmail,
          patientPhone: appointment.patientPhone,
          startsAt: newStart,
          endsAt: newEndAt,
          status: "confirmed",
          notes: appointment.notes,
          cancelToken: newCancelToken,
          rescheduleToken: newRescheduleToken,
        },
        include: {
          service: true,
          provider: true,
        },
      });

      return newAppt;
    }, {
      isolationLevel: "Serializable",
      maxWait: 5000,
      timeout: 10000,
    });

    // Trigger reschedule notification (async). Never fail the user flow
    // when Inngest is unreachable in dev.
    try {
      await inngest.send({
        name: "appointment.rescheduled",
        data: { appointmentId: newAppointment.id },
      });
    } catch (e) {
      console.warn("[rescheduleAppointment] appointment.rescheduled event not delivered (dev fallback):", e);
    }

    // The new booking needs its own 24h/1h reminders — the old booking's
    // reminders (if any fired) belong to the cancelled slot.
    try {
      await inngest.send({
        name: "appointment.schedule_reminders",
        data: { appointmentId: newAppointment.id },
      });
    } catch (e) {
      console.warn("[rescheduleAppointment] schedule_reminders event not delivered (dev fallback):", e);
    }

    revalidatePath("/dashboard");

    return {
      success: true,
      appointment: {
        id: newAppointment.id,
        patientName: newAppointment.patientName,
        serviceName: newAppointment.service.name,
        providerName: newAppointment.provider.name,
        startsAt: newAppointment.startsAt,
        endsAt: newAppointment.endsAt,
        cancelToken: newAppointment.cancelToken,
        rescheduleToken: newAppointment.rescheduleToken,
      },
    };
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_TAKEN") {
      return {
        success: false,
        error: "New slot unavailable, your original booking stands",
        conflict: true,
      };
    }
    console.error("[rescheduleAppointment] transaction failed:", e);
    return { success: false, error: "Rescheduling failed. Please try again." };
  }
}

/**
 * Get appointment details for cancel/reschedule pages (token validation)
 */
export async function getAppointmentByToken(token: string, type: "cancel" | "reschedule") {
  if (!token || typeof token !== "string") {
    return { appointment: null, error: "Invalid or expired link" };
  }
  const where = type === "cancel" 
    ? { cancelToken: token }
    : { rescheduleToken: token };

  let appointment;
  try {
    appointment = await prisma.appointment.findUnique({
      where,
      include: {
        service: true,
        provider: true,
      },
    });
  } catch (e) {
    console.error("[getAppointmentByToken] DB lookup failed:", e);
    return { appointment: null, error: "Service temporarily unavailable. Please try again." };
  }

  if (!appointment) {
    console.warn(`[getAppointmentByToken] ${type} token not found (prefix=${String(token).slice(0, 8)}..., len=${String(token).length}) — already used/nulled or never existed`);
    return { appointment: null, error: "Invalid or expired link" };
  }

  console.log(`[getAppointmentByToken] ${type} token OK (prefix=${String(token).slice(0, 8)}...) -> appt ${appointment.id} status=${appointment.status} startsAt=${appointment.startsAt.toISOString()}`);

  // Tokens are single-use (nulled after use) and stay valid until the
  // appointment starts. Previously createdAt+24h expired links for
  // appointments booked days ahead — the #1 "Invalid or expired link" cause.
  if (new Date() > new Date(appointment.startsAt)) {
    return { appointment: null, error: "This appointment has already started — this link is no longer valid" };
  }

  // Check if appointment is in a state that allows this action
  if (type === "cancel" && appointment.status === "cancelled") {
    return { appointment: null, error: "This appointment has already been cancelled" };
  }

  if (type === "reschedule" && 
      (appointment.status === "cancelled" || appointment.status === "completed" || appointment.status === "no_show")) {
    return { appointment: null, error: "This appointment can no longer be rescheduled" };
  }

  return { appointment, error: null };
}

/**
 * Get available slots for reschedule page (same logic as booking).
 * Accepts a London calendar-day string ("yyyy-MM-dd", preferred — immune to
 * browser/server timezone shifts) or a Date (day taken in London time).
 */
export async function getAvailableSlotsForReschedule(
  providerId: string,
  serviceId: string,
  date: Date | string
) {
  try {
    const { computeSlots } = await import("@/lib/availability");
    // Plain day strings pass through untouched (computeSlots resolves the
    // London day itself). Date objects are used as-is; instants keep their
    // exact moment and computeSlots reads their London day.
    const d =
      typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(`${date}T00:00:00.000Z`)
        : new Date(date as unknown as string | Date);
    if (Number.isNaN(d.getTime())) {
      console.error("[getAvailableSlotsForReschedule] invalid date:", date);
      return [];
    }
    return computeSlots(providerId, serviceId, d);
  } catch (e) {
    console.error("[getAvailableSlotsForReschedule] failed:", e);
    return [];
  }
}