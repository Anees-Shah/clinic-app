import { prisma } from "@/lib/prisma";
import { addMinutes, isBefore, isAfter, isSameDay } from "date-fns";
import { londonDay, londonWeekday, londonToUtc } from "@/lib/london";

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

export interface DaySchedule {
  date: Date;
  slots: TimeSlot[];
}

/**
 * Get the weekly schedule for a provider
 * Returns cached data, revalidated every 60 seconds
 */
export async function getWeeklySchedule(providerId: string) {
  const schedules = await prisma.availabilitySchedule.findMany({
    where: { providerId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return schedules.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
  }));
}

/**
 * Get availability overrides for a provider within a date range.
 * Day-normalized: matches the London calendar day(s), immune to whatever
 * time component the caller passes (midnight UTC vs local midnight etc.).
 * Previously an exact-instant range could miss a stored @db.Date row, so a
 * full-day block was silently ignored on the booking page.
 */
export async function getOverrides(providerId: string, startDate: Date, endDate: Date) {
  const fromDay = londonDay(startDate);
  const toDay = londonDay(endDate);
  const overrides = await prisma.availabilityOverride.findMany({
    where: {
      providerId,
      date: {
        gte: new Date(`${fromDay}T00:00:00.000Z`),
        lte: new Date(`${toDay}T00:00:00.000Z`),
      },
    },
    orderBy: { date: "asc" },
  });

  return overrides.map((o) => ({
    date: o.date,
    startTime: o.startTime,
    endTime: o.endTime,
    isBlocked: o.isBlocked,
    revision: o.revision,
  }));
}

/**
 * Get existing appointments for a provider within a date range
 */
export async function getExistingAppointments(providerId: string, startDate: Date, endDate: Date, excludeAppointmentId?: string) {
  const appointments = await prisma.appointment.findMany({
    where: {
      providerId,
      status: { in: ["confirmed", "completed"] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      startsAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    select: { startsAt: true, endsAt: true },
  });

  return appointments;
}

/**
 * Compute available slots for a provider on a specific date for a specific service
 * This is the core slot generation logic used by the public booking calendar
 */
export async function computeSlots(
  providerId: string,
  serviceId: string,
  date: Date,
  excludeAppointmentId?: string
): Promise<TimeSlot[]> {
  // Get service details (duration + buffers)
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { durationMin: true, bufferBeforeMin: true, bufferAfterMin: true },
  });

  if (!service) return [];

  const totalDuration = service.durationMin + service.bufferBeforeMin + service.bufferAfterMin;
  const slotInterval = 30; // 30-minute intervals

  // LONDON-CANONICAL: the London calendar day of `date` rules. Callers must
  // pass a London-safe instant for the intended day (e.g. noon-UTC anchor
  // `${day}T12:00:00Z`, or a true booking instant from londonToUtc) — NEVER a
  // server-local midnight from parseISO("yyyy-MM-dd"): east of the UK (PKT)
  // that instant is still "yesterday" in London and the wrong day's slots and
  // overrides resolve. Weekly hours, overrides and slots are all London wall
  // time; UTC instants derive ONLY via londonToUtc, so server/browser
  // timezone cannot shift them.
  const dayStr = londonDay(date);
  const dayOfWeek = londonWeekday(dayStr);
  const weeklySchedule = await getWeeklySchedule(providerId);
  const daySchedules = weeklySchedule.filter((s) => s.dayOfWeek === dayOfWeek);

  if (daySchedules.length === 0) return []; // Provider not working this day

  // Get overrides for this date (ALL of them: a day can have several —
  // e.g. a blocked morning plus extra evening hours). Previously only
  // overrides[0] was honored, so additional rows were silently ignored.
  const overrides = await getOverrides(providerId, date, date);

  // If any full-day block exists, no slots
  const fullDayBlocked = overrides.some(
    (o) => o.isBlocked && !o.startTime && !o.endTime
  );
  if (fullDayBlocked) return [];

  // Build working blocks for this date (sorted + merged overlaps)
  let blocks = daySchedules.map((s) => ({
    start: londonToUtc(dayStr, s.startTime),
    end: londonToUtc(dayStr, s.endTime),
  }));

  // Apply overrides that add hours (blocked periods filter slots below)
  for (const o of overrides) {
    if (!o.isBlocked && o.startTime && o.endTime) {
      blocks.push({
        start: londonToUtc(dayStr, o.startTime),
        end: londonToUtc(dayStr, o.endTime),
      });
    }
  }
  blocks.sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: typeof blocks = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (last && !isAfter(b.start, last.end)) {
      if (isAfter(b.end, last.end)) last.end = b.end;
    } else {
      merged.push({ ...b });
    }
  }
  blocks = merged;

  // Existing appointments within the London day (UTC bounds of the day)
  const dayStartUtc = londonToUtc(dayStr, "00:00");
  const nextDayUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);
  const appointments = await getExistingAppointments(providerId, dayStartUtc, nextDayUtc, excludeAppointmentId);

  // Generate slots across every working block
  const slots: TimeSlot[] = [];

  const isInBlockedPeriod = (slotStart: Date) => {
    // Union of every blocked period override for the day
    for (const o of overrides) {
      if (o.isBlocked && o.startTime && o.endTime) {
        const blockStart = londonToUtc(dayStr, o.startTime);
        const blockEnd = londonToUtc(dayStr, o.endTime);
        if (
          (isAfter(slotStart, blockStart) || isSameDay(slotStart, blockStart)) &&
          isBefore(slotStart, blockEnd)
        ) {
          return true;
        }
      }
    }
    return false;
  };

  const hasConflict = (slotStart: Date, slotEnd: Date) => {
    for (const appt of appointments) {
      if (slotStart < appt.endsAt && slotEnd > appt.startsAt) return true;
    }
    return false;
  };

  for (const block of blocks) {
    let current = new Date(block.start);
    // Boundary-inclusive: a slot ending exactly at block end is valid
    // (previously strict isBefore dropped e.g. the 12:30–13:00 slot).
    while (!isAfter(addMinutes(current, totalDuration), block.end)) {
      const slotStart = new Date(current);
      const slotEnd = addMinutes(current, totalDuration);
      const blocked = isInBlockedPeriod(slotStart);
      const conflict = hasConflict(slotStart, slotEnd);

      // Patient-visible slot is just the service duration (without buffers)
      const visibleEnd = addMinutes(slotStart, service.durationMin);

      slots.push({
        start: slotStart,
        end: visibleEnd,
        available: !blocked && !conflict,
      });

      current = addMinutes(current, slotInterval);
    }
  }

  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return slots;
}

/**
 * Check if a specific slot is available (used for inline validation before submit).
 * `excludeAppointmentId` skips one appointment (used by reschedule so the
 * appointment being moved never conflicts with itself).
 */
export async function isSlotAvailable(
  providerId: string,
  serviceId: string,
  startAt: Date,
  excludeAppointmentId?: string
): Promise<boolean> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { durationMin: true, bufferBeforeMin: true, bufferAfterMin: true },
  });

  if (!service) return false;

  const totalDuration = service.durationMin + service.bufferBeforeMin + service.bufferAfterMin;
  const endAt = addMinutes(startAt, totalDuration);

  // Check for conflicting appointments
  const conflict = await prisma.appointment.findFirst({
    where: {
      providerId,
      status: { in: ["confirmed", "completed"] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      OR: [
        {
          startsAt: { lt: endAt },
          endsAt: { gt: startAt },
        },
      ],
    },
  });

  return !conflict;
}

/**
 * Get all services with their assigned providers
 */
export async function getServicesWithProviders() {
  const services = await prisma.service.findMany({
    where: { active: true },
    include: {
      providers: {
        include: { provider: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return services.map((s) => ({
    ...s,
    providers: s.providers
      .filter((sp) => sp.provider.active)
      .map((sp) => sp.provider),
  }));
}

/**
 * Get all active providers
 */
export async function getActiveProviders() {
  return prisma.provider.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}