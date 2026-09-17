"use client";

import { useMemo } from "react";
import { format, startOfDay, endOfDay, addHours, setHours, setMinutes, isSameDay, isBefore, isAfter } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { useDroppable } from "@dnd-kit/core";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { SortableAppointmentCard } from "./SortableAppointmentCard";
import type { Appointment } from "@/components/dashboard/types";

interface DayViewProps {
  date: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  selectedAppointmentIds: Set<string>;
  onSelectionChange: (appointmentId: string, selected: boolean) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am - 10pm

/** ISO instant for a day-view hour slot (droppable id consumed by onDragEnd). */
export function daySlotId(date: Date, hour: number): string {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function DayHourSlot({
  date,
  hour,
  appointments,
  selectedAppointmentIds,
  onAppointmentClick,
  onSelectionChange,
  bufferZones,
}: {
  date: Date;
  hour: number;
  appointments: Appointment[];
  selectedAppointmentIds: Set<string>;
  onAppointmentClick: (a: Appointment) => void;
  onSelectionChange: (id: string, selected: boolean) => void;
  bufferZones: Array<{ start: number; end: number; label: string }>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: daySlotId(date, hour) });

  // Side-by-side overlap columns: appointments sharing this hour split the
  // width instead of painting over each other (the 8 AM pile-up).
  const columns: number[] = [];
  const placement = [...appointments]
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .map((appt) => {
      const s = new Date(appt.startsAt).getTime();
      const e = new Date(appt.endsAt).getTime();
      let col = columns.findIndex((end) => end <= s);
      if (col === -1) {
        col = columns.length;
        columns.push(e);
      } else {
        columns[col] = e;
      }
      return { appt, col };
    });
  const totalCols = Math.max(1, columns.length);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-16 border-b border-slate-800/50 relative transition-colors",
        isOver && "bg-accent-500/10 outline outline-1 outline-accent-500/50"
      )}
      style={{ height: "64px" }}
      data-slot={daySlotId(date, hour)}
    >
      {/* Buffer zones first (behind cards): clipped to this hour cell,
          whisper-subtle so they read as prep/cleanup gutters, not bars. */}
      {bufferZones.map((zone, i) => {
        const s = Math.max(zone.start, hour);
        const e = Math.min(zone.end, hour + 1);
        if (e <= s) return null;
        return (
          <div
            key={i}
            className="absolute left-1 right-1 rounded bg-slate-500/10 border border-dashed border-slate-600/50 pointer-events-none"
            style={{
              top: `${(s - hour) * 64 + 1}px`,
              height: `${Math.max(4, (e - s) * 64 - 2)}px`,
            }}
            title={zone.label}
          />
        );
      })}
      {placement.map(({ appt, col }) => {
        const start = toZonedTime(appt.startsAt, "Europe/London");
        const end = toZonedTime(appt.endsAt, "Europe/London");
        const startMinutes = start.getMinutes();
        const durationMinutes = (end.getTime() - start.getTime()) / 60000;
        const top = (startMinutes / 60) * 64;
        const height = Math.max(32, (durationMinutes / 60) * 64);
        const gap = 4;
        const widthPct = (100 - gap * (totalCols - 1)) / totalCols;
        const side =
          totalCols > 1
            ? { left: `calc(${col * (widthPct + gap)}% + 2px)`, width: `${widthPct}%` }
            : undefined;

        return (
          <SortableAppointmentCard
            key={appt.id}
            appointment={appt}
            top={top}
            height={height}
            side={side}
            onClick={onAppointmentClick}
            selected={selectedAppointmentIds.has(appt.id)}
            onSelectionChange={(selected) => onSelectionChange(appt.id, selected)}
          />
        );
      })}
    </div>
  );
}

export function DayView({
  date,
  appointments,
  onAppointmentClick,
  selectedAppointmentIds,
  onSelectionChange,
}: DayViewProps) {
  const zonedDate = toZonedTime(date, "Europe/London");
  const dayStart = startOfDay(zonedDate);
  const dayEnd = endOfDay(zonedDate);

  const { earlyAppts, lateAppts, appointmentsByHour } = useMemo(() => {
    const map = new Map<number, Appointment[]>();
    HOURS.forEach((h) => map.set(h, []));
    const early: Appointment[] = [];
    const late: Appointment[] = [];

    appointments.forEach((appt) => {
      const start = toZonedTime(appt.startsAt, "Europe/London");
      const end = toZonedTime(appt.endsAt, "Europe/London");

      if (isSameDay(start, zonedDate) || isSameDay(end, zonedDate)) {
        const startHour = start.getHours();
        // Out-of-grid appointments get their own trays instead of being
        // clamped into the 6 AM cell (the 00:30 + 02:00 pile-up). Grid covers
        // starts 06:00–22:59; anything else goes to a tray.
        if (startHour < 6) early.push(appt);
        else if (startHour > 22) late.push(appt);
        else map.get(startHour)!.push(appt);
      }
    });

    const byStart = (a: Appointment, b: Appointment) =>
      +new Date(a.startsAt) - +new Date(b.startsAt);
    early.sort(byStart);
    late.sort(byStart);
    return { earlyAppts: early, lateAppts: late, appointmentsByHour: map };
  }, [appointments, zonedDate]);

  const getBufferZones = (hour: number) => {
    const zones: Array<{ start: number; end: number; label: string }> = [];
    appointmentsByHour.get(hour)?.forEach((appt) => {
      const start = toZonedTime(appt.startsAt, "Europe/London");
      const end = toZonedTime(appt.endsAt, "Europe/London");
      const bufferBefore = appt.service.bufferBeforeMin;
      const bufferAfter = appt.service.bufferAfterMin;

      if (bufferBefore > 0) {
        const bufferStart = new Date(start.getTime() - bufferBefore * 60000);
        zones.push({
          start: bufferStart.getHours() + bufferStart.getMinutes() / 60,
          end: start.getHours() + start.getMinutes() / 60,
          label: `Buffer (${bufferBefore}min)`,
        });
      }
      if (bufferAfter > 0) {
        const bufferEnd = new Date(end.getTime() + bufferAfter * 60000);
        zones.push({
          start: end.getHours() + end.getMinutes() / 60,
          end: bufferEnd.getHours() + bufferEnd.getMinutes() / 60,
          label: `Buffer (${bufferAfter}min)`,
        });
      }
    });
    return zones;
  };

  const renderTray = (label: string, appts: Appointment[]) => {
    if (appts.length === 0) return null;
    return (
      <div className="border-b border-dashed border-slate-700/70 bg-slate-950/60 px-3 py-2">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {label} · {appts.length}
        </p>
        <div className="flex flex-col gap-1.5">
          {appts.map((appt) => (
            <SortableAppointmentCard
              key={appt.id}
              appointment={appt}
              layout="stacked"
              onClick={onAppointmentClick}
              selected={selectedAppointmentIds.has(appt.id)}
              onSelectionChange={(selected) => onSelectionChange(appt.id, selected)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    // NOTE: no `card` class — `.card` background var (unlayered CSS) beats
    // Tailwind utilities and washed the grid white in light OS mode.
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      {renderTray("Before 6 AM", earlyAppts)}
      <div className="grid grid-cols-[64px_1fr]">
        <div className="border-r border-slate-800 bg-slate-950/60">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="h-16 border-b border-slate-800/50 flex items-start justify-end pr-2 pt-1 text-[11px] tabular-nums text-slate-500"
              style={{ height: "64px" }}
            >
              {format(setHours(setMinutes(new Date(), 0), hour), "h a")}
            </div>
          ))}
        </div>

        <div className="relative">
          <div className="absolute inset-0">
            {HOURS.map((hour) => (
              <DayHourSlot
                key={hour}
                date={date}
                hour={hour}
                appointments={appointmentsByHour.get(hour) ?? []}
                selectedAppointmentIds={selectedAppointmentIds}
                onAppointmentClick={onAppointmentClick}
                onSelectionChange={onSelectionChange}
                bufferZones={getBufferZones(hour)}
              />
            ))}
          </div>

          <div className="absolute inset-0 pointer-events-none">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-16 border-b border-slate-800/50"
                style={{ height: "64px" }}
              />
            ))}
          </div>
        </div>
      </div>
      {renderTray("After 10 PM", lateAppts)}
    </div>
  );
}