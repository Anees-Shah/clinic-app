import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Single timezone rule for the whole system (spec: clinic operates in
 * Europe/London, all timestamps stored as UTC, display in London).
 *
 * CANONICAL MODEL (London wall-clock):
 * - Weekly schedules (HH:mm), overrides (HH:mm), slot links (HH:mm) and
 *   booking date strings (yyyy-MM-dd) are all EUROPE/LONDON wall time.
 * - They convert to UTC instants ONLY via `londonToUtc`.
 * - Everything stored/compared in UTC; everything shown via `fmtLondon`.
 *
 * This makes booking + admin show identical slots no matter where in the
 * world the server or browser runs. Never use date-fns `format`/`parseISO`
 * or raw getHours() on clinic times — they follow the machine timezone.
 */
export const CLINIC_TZ = "Europe/London";

/** London calendar day of any instant, e.g. "2026-09-30". */
export function londonDay(d: Date | string | number): string {
  return formatInTimeZone(new Date(d), CLINIC_TZ, "yyyy-MM-dd");
}

/** Weekday of a London calendar day (0=Sunday..6=Saturday). TZ-immune: noon
 *  UTC is always the same civil date in London. */
export function londonWeekday(dayStr: string): number {
  return new Date(`${dayStr}T12:00:00.000Z`).getUTCDay();
}

/** UTC instant for a London wall time, e.g. ("2026-09-30","09:00").
 *  DST-aware (BST vs GMT). Throws on unparseable input. */
export function londonToUtc(dayStr: string, hm: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayStr)) throw new Error(`Bad day: ${dayStr}`);
  if (!/^\d{2}:\d{2}$/.test(hm)) throw new Error(`Bad time: ${hm}`);
  const d = fromZonedTime(`${dayStr}T${hm}:00`, CLINIC_TZ);
  if (Number.isNaN(d.getTime())) throw new Error(`Bad datetime: ${dayStr} ${hm}`);
  return d;
}

/** Format any instant in London time (server- and browser-safe). */
export function fmtLondon(d: Date | string | number, fmt: string): string {
  return formatInTimeZone(new Date(d), CLINIC_TZ, fmt);
}

/** Friendly London day for a yyyy-MM-dd string (no instant involved). */
export function fmtLondonDay(dayStr: string, fmt = "EEEE, MMMM d, yyyy"): string {
  return fmtLondon(`${dayStr}T12:00:00.000Z`, fmt);
}

/** Add minutes to a "HH:mm" wall time, wrapping past midnight. */
export function addWallMinutes(hm: string, mins: number): string {
  const [h, m] = hm.split(":").map(Number);
  const total = ((h * 60 + m + mins) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
