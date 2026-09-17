import { prisma } from "@/lib/prisma";
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
});

const calendar = google.calendar({ version: "v3", auth: oauth2Client });

export interface CalendarEventData {
  appointmentId: string;
  patientName: string;
  serviceName: string;
  providerName: string;
  startAt: Date;
  endAt: Date;
  notes?: string;
}

/**
 * Placeholder detection: dev/staging env files carry GOOGLE_CALENDAR_*=xxx
 * placeholders (truthy strings). A plain truthiness check would NOT skip
 * them and would attempt real OAuth calls — so treat known placeholder
 * patterns as unconfigured. Sync must NEVER throw without creds.
 */
function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  return (
    v.length === 0 ||
    v.includes("xxx") ||
    v.includes("placeholder") ||
    v.includes("example") ||
    v.includes("changeme") ||
    v.includes("your-") ||
    v === "null" ||
    v === "none" ||
    v === "test"
  );
}

/** True only when all three Google credentials look real. */
export function isCalendarConfigured(): boolean {
  return (
    !isPlaceholder(process.env.GOOGLE_CALENDAR_CLIENT_ID) &&
    !isPlaceholder(process.env.GOOGLE_CALENDAR_CLIENT_SECRET) &&
    !isPlaceholder(process.env.GOOGLE_CALENDAR_REFRESH_TOKEN)
  );
}

/**
 * Push appointment to Google Calendar
 * External calendar is PROJECTION ONLY - DB is authoritative
 */
export async function syncToGoogleCalendar(data: CalendarEventData): Promise<string | null> {
  if (!isCalendarConfigured()) {
    console.warn("[calendar] Google Calendar not configured (placeholder creds) — skipping sync for", data.appointmentId);
    return null;
  }

  try {
    const event = {
      summary: `${data.serviceName} - ${data.patientName}`,
      description: [
        `Provider: ${data.providerName}`,
        `Service: ${data.serviceName}`,
        `Patient: ${data.patientName}`,
        data.notes ? `Notes: ${data.notes}` : "",
        `Appointment ID: ${data.appointmentId}`,
        "---",
        "This event is synced from the London Aesthetic Clinic booking system.",
        "The database is the authoritative source of truth.",
      ].filter(Boolean).join("\n"),
      start: {
        dateTime: data.startAt.toISOString(),
        timeZone: "Europe/London",
      },
      end: {
        dateTime: data.endAt.toISOString(),
        timeZone: "Europe/London",
      },
      extendedProperties: {
        private: {
          appointmentId: data.appointmentId,
        },
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });

    return response.data.id || null;
  } catch (error) {
    console.warn("[calendar] Google Calendar push failed (DB stays authoritative):", error);
    return null;
  }
}

/**
 * Update Google Calendar event
 */
export async function updateGoogleCalendarEvent(
  eventId: string,
  data: Partial<CalendarEventData>
): Promise<boolean> {
  if (!isCalendarConfigured() || !eventId) return false;

  try {
    const event = {
      summary: data.serviceName && data.patientName 
        ? `${data.serviceName} - ${data.patientName}` 
        : undefined,
      description: data.notes,
      start: data.startAt ? {
        dateTime: data.startAt.toISOString(),
        timeZone: "Europe/London",
      } : undefined,
      end: data.endAt ? {
        dateTime: data.endAt.toISOString(),
        timeZone: "Europe/London",
      } : undefined,
    };

    await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: event,
    });

    return true;
  } catch (error) {
    console.warn("[calendar] Google Calendar update failed (DB stays authoritative):", error);
    return false;
  }
}

/**
 * Delete Google Calendar event
 */
export async function deleteGoogleCalendarEvent(eventId: string): Promise<boolean> {
  if (!isCalendarConfigured() || !eventId) return false;

  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    });
    return true;
  } catch (error) {
    console.warn("[calendar] Google Calendar delete failed (DB stays authoritative):", error);
    return false;
  }
}