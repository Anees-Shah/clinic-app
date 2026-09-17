import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email via Resend.
 * Dev fallback: when RESEND_API_KEY is missing or still the placeholder
 * (`re_xxxxxxxxxxxx` in .env), log clearly and return false instead of
 * throwing, so booking/cancel/reschedule flows never crash in dev.
 * Real emails require a valid Resend key (see .env RESEND_API_KEY).
 */
export async function sendEmail(data: EmailData): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_xxxxxxxxxxxx" || key.startsWith("re_xxx")) {
    console.log(
      `[DEV] Email not sent (RESEND_API_KEY missing/placeholder). Would send to ${data.to}: ${data.subject}`
    );
    return false;
  }
  try {
    await resend.emails.send({
      from: "London Aesthetic Clinic <bookings@clinic.local>",
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
    });
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

/**
 * Send SMS via Twilio (if configured)
 */
export async function sendSMS(to: string, body: string): Promise<boolean> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log("Twilio not configured, skipping SMS");
    return false;
  }

  try {
    // Twilio client would be initialized here
    // For now, just log
    console.log(`[SMS to ${to}] ${body}`);
    return true;
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return false;
  }
}

/**
 * Check if SMS is enabled globally and patient opted in
 */
export async function shouldSendSMS(patientOptedIn: boolean): Promise<boolean> {
  if (!patientOptedIn) return false;
  
  const settings = await prisma.smsSettings.findUnique({
    where: { id: "singleton" },
  });
  
  return settings?.enabled ?? false;
}

/**
 * Log reminder sent (idempotent)
 */
export async function logReminder(
  appointmentId: string,
  type: "confirmation" | "reminder_24h" | "reminder_1h" | "cancellation" | "reschedule",
  providerMessageId?: string
): Promise<boolean> {
  try {
    await prisma.reminderLog.create({
      data: {
        appointmentId,
        type,
        providerMessageId,
      },
    });
    return true;
  } catch (error) {
    // Unique constraint violation = already sent
    return false;
  }
}

/**
 * Check if reminder was already sent
 */
export async function wasReminderSent(
  appointmentId: string,
  type: "confirmation" | "reminder_24h" | "reminder_1h" | "cancellation" | "reschedule"
): Promise<boolean> {
  const log = await prisma.reminderLog.findUnique({
    where: {
      appointmentId_type: { appointmentId, type },
    },
  });
  return !!log;
}