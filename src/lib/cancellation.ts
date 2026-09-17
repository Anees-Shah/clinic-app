import { differenceInMinutes, isBefore, isAfter } from "date-fns";
import { prisma } from "@/lib/prisma";
import { londonDay, londonWeekday, londonToUtc, fmtLondon } from "@/lib/london";

const BUSINESS_START = "09:00";
const BUSINESS_END = "18:00";
const BUSINESS_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri (London weekday)

/**
 * Check if a date is a business day (Mon-Fri London) and not a holiday
 */
export async function isBusinessDay(date: Date): Promise<boolean> {
  const dayStr = londonDay(date);
  if (!BUSINESS_DAYS.includes(londonWeekday(dayStr))) return false;

  // Holidays are stored as calendar dates — exact London-day match
  const holiday = await prisma.holiday.findUnique({
    where: { date: new Date(`${dayStr}T00:00:00.000Z`) },
  });

  return !holiday;
}

/**
 * Get the next business day after a given date
 */
export async function getNextBusinessDay(date: Date): Promise<Date> {
  let next = new Date(date);
  next.setDate(next.getDate() + 1);
  
  while (!(await isBusinessDay(next))) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

/**
 * Calculate business hours between two dates.
 * Only counts Mon-Fri 09:00-18:00 LONDON wall time, excluding holidays.
 * Iterates London calendar days so server/browser timezone cannot skew it.
 */
export async function calculateBusinessHours(
  from: Date,
  to: Date
): Promise<number> {
  if (isAfter(from, to)) return 0;

  // Fetch holidays once for the whole span (matched by London day below)
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: new Date(`${londonDay(from)}T00:00:00.000Z`), lte: new Date(`${londonDay(to)}T00:00:00.000Z`) } },
    select: { date: true },
  });
  const holidayDays = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

  let totalMinutes = 0;
  let dayCursor = new Date(from);
  // Guard: never iterate more than ~400 days (DoS safety on bad input)
  for (let i = 0; i < 400; i++) {
    const dayStr = londonDay(dayCursor);
    if (dayStr > londonDay(to)) break;
    if (BUSINESS_DAYS.includes(londonWeekday(dayStr)) && !holidayDays.has(dayStr)) {
      const dayStart = londonToUtc(dayStr, BUSINESS_START);
      const dayEnd = londonToUtc(dayStr, BUSINESS_END);

      const effectiveStart = isAfter(from, dayStart) ? from : dayStart;
      const effectiveEnd = isBefore(to, dayEnd) ? to : dayEnd;

      if (isBefore(effectiveStart, effectiveEnd)) {
        totalMinutes += differenceInMinutes(effectiveEnd, effectiveStart);
      }
    }
    dayCursor = new Date(dayCursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return totalMinutes / 60; // Return hours
}

/**
 * Check if cancellation is within the free window
 * Uses business hours only (Mon-Fri 9-18, excluding holidays)
 */
export async function isWithinFreeCancelWindow(appointmentStart: Date): Promise<boolean> {
  const now = new Date();
  const freeCancelHours = parseInt(process.env.FREE_CANCEL_HOURS || "48", 10);
  
  const businessHoursUntilAppointment = await calculateBusinessHours(now, appointmentStart);
  
  return businessHoursUntilAppointment >= freeCancelHours;
}

/**
 * Get cancellation fee status for an appointment
 */
export async function getCancellationFeeStatus(appointmentStart: Date) {
  const withinFreeWindow = await isWithinFreeCancelWindow(appointmentStart);
  
  return {
    lateCancelFee: !withinFreeWindow,
    noShowFee: false, // Set separately when marking no-show
  };
}

/**
 * Format date for display in UK locale (London time, any machine timezone)
 */
export function formatUKDate(date: Date): string {
  return fmtLondon(date, "EEEE, d MMMM yyyy");
}

/**
 * Format time for display in UK locale (London time, any machine timezone)
 */
export function formatUKTime(date: Date): string {
  return fmtLondon(date, "HH:mm");
}

/**
 * Format date and time for display
 */
export function formatUKDateTime(date: Date): string {
  return `${formatUKDate(date)} at ${formatUKTime(date)}`;
}