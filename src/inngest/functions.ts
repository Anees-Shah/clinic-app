import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { getOverrides, computeSlots, getActiveProviders } from "@/lib/availability";
import { isBusinessDay } from "@/lib/cancellation";
import { londonDay, fmtLondon } from "@/lib/london";
import { syncToGoogleCalendar, isCalendarConfigured } from "@/lib/calendar-sync";
import { randomBytes } from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

interface AppointmentData {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  startsAt: string;
  endsAt: string;
  service: {
    name: string;
    durationMin: number;
  };
  provider: {
    name: string;
  };
  cancelToken: string | null;
  rescheduleToken: string | null;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_xxxxxxxxxxxx") {
    console.log("[DEV] Would send email to", to, ":", subject);
    return { id: "dev-mode" };
  }

  try {
    const result = await resend.emails.send({
      from: "London Aesthetic Clinic <bookings@londonaesthetic.co.uk>",
      to,
      subject,
      html,
    });
    return result;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

function buildAppointmentHtml(appointment: AppointmentData, extraContent: string): string {
  const baseUrl = getBaseUrl();
  const cancelUrl = appointment.cancelToken ? `${baseUrl}/cancel?token=${appointment.cancelToken}` : "#";
  const rescheduleUrl = appointment.rescheduleToken ? `${baseUrl}/reschedule?token=${appointment.rescheduleToken}` : "#";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700;">London Aesthetic Clinic</h1>
      </div>
      <div style="background: #fff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 30px;">
        ${extraContent}
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1e293b;">Appointment Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #64748b; width: 120px;">Treatment</td><td style="padding: 8px 0; font-weight: 500;">${appointment.service.name}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Practitioner</td><td style="padding: 8px 0; font-weight: 500;">${appointment.provider.name}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Date & Time</td><td style="padding: 8px 0; font-weight: 500;">${formatDateTime(new Date(appointment.startsAt))}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Duration</td><td style="padding: 8px 0; font-weight: 500;">${appointment.service.durationMin} minutes</td></tr>
          </table>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px;">
          <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px;">Need to make changes?</p>
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <a href="${cancelUrl}" style="background: #fef2f2; color: #dc2626; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; border: 1px solid #fecaca;">Cancel Appointment</a>
            <a href="${rescheduleUrl}" style="background: #f0f9ff; color: #0369a1; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; border: 1px solid #bae6fd;">Reschedule Appointment</a>
          </div>
          <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">These links are unique to your booking and can only be used once.</p>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px; text-align: center;">
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">London Aesthetic Clinic, London, UK</p>
          <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px;">Questions? Reply to this email or call +44 20 7123 4567</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export const sendConfirmation = inngest.createFunction(
  { id: "send-confirmation", retries: 3 },
  { event: "appointment.created" },
  async ({ event, step }) => {
    const { appointmentId } = event.data as { appointmentId: string };

    const appointment = await step.run("fetch-appointment", async () => {
      return prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { service: true, provider: true },
      });
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    await step.run("send-confirmation-email", async () => {
      const html = buildAppointmentHtml(appointment as AppointmentData, `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #1e293b;">Your Appointment is Confirmed! ✨</h2>
        <p style="margin: 0 0 24px 0; color: #475569;">Hi ${appointment.patientName},</p>
        <p style="margin: 0 0 16px 0; color: #475569;">Your appointment has been successfully booked. We look forward to seeing you!</p>
      `);

      await sendEmail(appointment.patientEmail, `Appointment Confirmed - ${appointment.service.name}`, html);
    });

    await step.run("log-reminder", async () => {
      await prisma.reminderLog.create({
        data: {
          appointmentId,
          type: "confirmation",
          sentAt: new Date(),
        },
      });
    });

    return { success: true };
  }
);

export const sendCancellation = inngest.createFunction(
  { id: "send-cancellation", retries: 3 },
  { event: "appointment.cancelled" },
  async ({ event, step }) => {
    const { appointmentId } = event.data as { appointmentId: string };

    const appointment = await step.run("fetch-appointment", async () => {
      return prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { service: true, provider: true },
      });
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    await step.run("send-cancellation-email", async () => {
      const html = buildAppointmentHtml(appointment as AppointmentData, `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #dc2626;">Appointment Cancelled</h2>
        <p style="margin: 0 0 24px 0; color: #475569;">Hi ${appointment.patientName},</p>
        <p style="margin: 0 0 16px 0; color: #475569;">Your appointment has been cancelled. The slot is now available for other patients.</p>
        <p style="margin: 0 0 16px 0; color: #475569;">If you didn't request this cancellation, please contact us immediately.</p>
      `);

      await sendEmail(appointment.patientEmail, `Appointment Cancelled - ${appointment.service.name}`, html);
    });

    await step.run("log-reminder", async () => {
      await prisma.reminderLog.create({
        data: {
          appointmentId,
          type: "cancellation",
          sentAt: new Date(),
        },
      });
    });

    return { success: true };
  }
);

export const sendReschedule = inngest.createFunction(
  { id: "send-reschedule", retries: 3 },
  { event: "appointment.rescheduled" },
  async ({ event, step }) => {
    const { appointmentId } = event.data as { appointmentId: string };

    const appointment = await step.run("fetch-appointment", async () => {
      return prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { service: true, provider: true },
      });
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    await step.run("send-reschedule-email", async () => {
      const html = buildAppointmentHtml(appointment as AppointmentData, `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0369a1;">Appointment Rescheduled</h2>
        <p style="margin: 0 0 24px 0; color: #475569;">Hi ${appointment.patientName},</p>
        <p style="margin: 0 0 16px 0; color: #475569;">Your appointment has been rescheduled to the new time shown above.</p>
        <p style="margin: 0 0 16px 0; color: #475569;">Your original booking has been cancelled and this new slot is now confirmed.</p>
      `);

      await sendEmail(appointment.patientEmail, `Appointment Rescheduled - ${appointment.service.name}`, html);
    });

    await step.run("log-reminder", async () => {
      await prisma.reminderLog.create({
        data: {
          appointmentId,
          type: "reschedule",
          sentAt: new Date(),
        },
      });
    });

    return { success: true };
  }
);

export const sendReminder24h = inngest.createFunction(
  { id: "send-reminder-24h", retries: 3 },
  { event: "appointment.reminder_24h" },
  async ({ event, step }) => {
    const { appointmentId } = event.data as { appointmentId: string };

    const appointment = await step.run("fetch-appointment", async () => {
      return prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { service: true, provider: true },
      });
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const alreadySent = await step.run("check-log", async () => {
      return prisma.reminderLog.findUnique({
        where: {
          appointmentId_type: { appointmentId, type: "reminder_24h" },
        },
      });
    });

    if (alreadySent) {
      return { success: true, skipped: true };
    }

    await step.run("send-reminder-email", async () => {
      const html = buildAppointmentHtml(appointment as AppointmentData, `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #1e293b;">Reminder: Your Appointment is Tomorrow</h2>
        <p style="margin: 0 0 24px 0; color: #475569;">Hi ${appointment.patientName},</p>
        <p style="margin: 0 0 16px 0; color: #475569;">This is a friendly reminder that your appointment is tomorrow.</p>
        <p style="margin: 0 0 16px 0; color: #475569;"><strong>Please arrive 10 minutes early</strong> and bring photo ID.</p>
      `);

      await sendEmail(appointment.patientEmail, `Reminder: Appointment Tomorrow - ${appointment.service.name}`, html);
    });

    await step.run("log-reminder", async () => {
      await prisma.reminderLog.create({
        data: {
          appointmentId,
          type: "reminder_24h",
          sentAt: new Date(),
        },
      });
    });

    return { success: true };
  }
);

export const sendReminder1h = inngest.createFunction(
  { id: "send-reminder-1h", retries: 3 },
  { event: "appointment.reminder_1h" },
  async ({ event, step }) => {
    const { appointmentId } = event.data as { appointmentId: string };

    const appointment = await step.run("fetch-appointment", async () => {
      return prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { service: true, provider: true },
      });
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const alreadySent = await step.run("check-log", async () => {
      return prisma.reminderLog.findUnique({
        where: {
          appointmentId_type: { appointmentId, type: "reminder_1h" },
        },
      });
    });

    if (alreadySent) {
      return { success: true, skipped: true };
    }

    await step.run("send-reminder-email", async () => {
      const html = buildAppointmentHtml(appointment as AppointmentData, `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #1e293b;">Reminder: Your Appointment is in 1 Hour</h2>
        <p style="margin: 0 0 24px 0; color: #475569;">Hi ${appointment.patientName},</p>
        <p style="margin: 0 0 16px 0; color: #475569;">Your appointment starts in <strong>1 hour</strong>.</p>
        <p style="margin: 0 0 16px 0; color: #475569;"><strong>Please arrive 10 minutes early</strong> and bring photo ID.</p>
      `);

      await sendEmail(appointment.patientEmail, `Reminder: Appointment in 1 Hour - ${appointment.service.name}`, html);
    });

    await step.run("log-reminder", async () => {
      await prisma.reminderLog.create({
        data: {
          appointmentId,
          type: "reminder_1h",
          sentAt: new Date(),
        },
      });
    });

    return { success: true };
  }
);

export const scheduleReminders = inngest.createFunction(
  { id: "schedule-reminders", retries: 3 },
  { event: "appointment.schedule_reminders" },
  async ({ event, step }) => {
    const { appointmentId } = event.data as { appointmentId: string };

    const appointment = await step.run("fetch-appointment", async () => {
      return prisma.appointment.findUnique({
        where: { id: appointmentId },
      });
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const startsAt = new Date(appointment.startsAt);
    const reminder24h = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
    const reminder1h = new Date(startsAt.getTime() - 60 * 60 * 1000);

    await step.run("schedule-24h", async () => {
      await inngest.send({
        name: "appointment.reminder_24h",
        data: { appointmentId },
        ts: reminder24h.getTime(),
      });
    });

    await step.run("schedule-1h", async () => {
      await inngest.send({
        name: "appointment.reminder_1h",
        data: { appointmentId },
        ts: reminder1h.getTime(),
      });
    });

    return { success: true };
  }
);

/**
 * Outbound-only Google Calendar push on confirmed bookings.
 * The database stays authoritative: this function never throws without
 * creds (placeholder GOOGLE_CALENDAR_* values skip gracefully) and a
 * failed push never affects the booking itself.
 */
export const syncCalendarEvent = inngest.createFunction(
  { id: "sync-calendar-event", retries: 3 },
  { event: "appointment.created" },
  async ({ event, step }) => {
    const { appointmentId } = event.data as { appointmentId: string };

    const appointment = await step.run("fetch-appointment", async () => {
      return prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { service: true, provider: true },
      });
    });

    if (!appointment || appointment.status !== "confirmed") {
      return { success: true, skipped: true, reason: "not-a-confirmed-booking" };
    }

    const eventId = await step.run("push-to-google-calendar", async () => {
      if (!isCalendarConfigured()) {
        console.warn("[calendar] Google Calendar not configured (placeholder creds) — skipping sync for", appointmentId);
        return null;
      }
      try {
        return await syncToGoogleCalendar({
          appointmentId: appointment.id,
          patientName: appointment.patientName,
          serviceName: appointment.service.name,
          providerName: appointment.provider.name,
          // Inngest serializes step results through JSON, so Date fields
          // come back as strings — rehydrate before handing to the API.
          startAt: new Date(appointment.startsAt),
          endAt: new Date(appointment.endsAt),
          notes: appointment.notes ?? undefined,
        });
      } catch (e) {
        console.warn("[calendar] Google Calendar push failed (DB stays authoritative):", e);
        return null;
      }
    });

    return { success: true, skipped: !eventId };
  }
);

export const cleanupExpiredTokens = inngest.createFunction(
  { id: "cleanup-expired-tokens", retries: 0 },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    const now = new Date();

    await step.run("cleanup-cancel-tokens", async () => {
      return prisma.appointment.updateMany({
        where: {
          cancelToken: { not: null },
          OR: [
            { status: { in: ["cancelled", "completed", "no_show"] } },
            // Past appointments — link no longer usable
            { startsAt: { lt: now } },
          ],
        },
        data: { cancelToken: null },
      });
    });

    await step.run("cleanup-reschedule-tokens", async () => {
      return prisma.appointment.updateMany({
        where: {
          rescheduleToken: { not: null },
          OR: [
            { status: { in: ["cancelled", "completed", "no_show"] } },
            // Past appointments — link no longer usable
            { startsAt: { lt: now } },
          ],
        },
        data: { rescheduleToken: null },
      });
    });

    await step.run("cleanup-waitlist-claims", async () => {
      return prisma.waitlistEntry.updateMany({
        where: {
          claimToken: { not: null },
          expiresAt: { lt: now },
          claimedAt: null,
        },
        data: { claimToken: null, expiresAt: null },
      });
    });

    return { success: true };
  }
);

export const promoteWaitlist = inngest.createFunction(
  { id: "promote-waitlist", retries: 3 },
  { event: "appointment.waitlist_promote" },
  async ({ event, step }) => {
    const { providerId, serviceId, cancelledAt } = event.data as {
      providerId: string;
      serviceId: string;
      cancelledAt: string;
    };

    // Waitlist dates are London calendar days — match exactly, independent of
    // server timezone (local-midnight here would miss the stored UTC-midnight).
    const dateOnly = new Date(`${londonDay(new Date(cancelledAt))}T00:00:00.000Z`);

    // Find the next waitlist entry for this provider/service/date
    const entry = await step.run("find-waitlist-entry", async () => {
      return prisma.waitlistEntry.findFirst({
        where: {
          providerId,
          serviceId,
          requestedDate: dateOnly,
          notifiedAt: null,
          claimedAt: null,
        },
        orderBy: { position: "asc" },
        include: { provider: true, service: true },
      });
    });

    if (!entry) {
      return { success: true, promoted: false, reason: "No waitlist entries" };
    }

    // Generate claim token (30 min TTL)
    const claimToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Update waitlist entry
    await step.run("update-waitlist-entry", async () => {
      return prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          claimToken,
          expiresAt,
          notifiedAt: new Date(),
        },
      });
    });

    // Send promotion email
    await step.run("send-promotion-email", async () => {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const claimLink = `${baseUrl}/booking?service=${entry.service.code}&provider=${entry.providerId}&date=${londonDay(entry.requestedDate)}&claim=${claimToken}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700;">London Aesthetic Clinic</h1>
          </div>
          <div style="background: #fff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 30px;">
            <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #059669;">A Slot Has Opened Up! ✨</h2>
            <p style="margin: 0 0 24px 0; color: #475569;">Hi ${entry.patientName},</p>
            <p style="margin: 0 0 16px 0; color: #475569;">Great news! A slot has become available for your requested <strong>${entry.service.name}</strong> with <strong>${entry.provider.name}</strong> on <strong>${fmtLondon(entry.requestedDate, "EEEE, MMMM d, yyyy")}</strong>.</p>
            <p style="margin: 0 0 16px 0; color: #475569;">You have <strong>30 minutes</strong> to claim this slot before it's offered to the next person.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${claimLink}" style="background: #059669; color: #fff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Claim Your Slot</a>
            </div>
            <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">This link expires in 30 minutes and can only be used once.</p>
            
            <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">London Aesthetic Clinic, London, UK</p>
              <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px;">Questions? Reply to this email or call +44 20 7123 4567</p>
            </div>
          </div>
        </body>
        </html>
      `;

      if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_xxxxxxxxxxxx") {
        console.log("[DEV] Would send waitlist promotion email to", entry.patientEmail, ":", claimLink);
        return { id: "dev-mode" };
      }

      return resend.emails.send({
        from: "London Aesthetic Clinic <bookings@londonaesthetic.co.uk>",
        to: entry.patientEmail,
        subject: `Slot Available: ${entry.service.name} with ${entry.provider.name}`,
        html,
      });
    });

    return { success: true, promoted: true, entryId: entry.id };
  }
);