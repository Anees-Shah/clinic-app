"use client";

import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, addDays, eachDayOfInterval, isSameDay, isBefore, isAfter } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { SortableAppointmentCard } from "./SortableAppointmentCard";
import type { Appointment } from "@/components/dashboard/types";

interface WeekViewProps {
  date: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  selectedAppointmentIds: Set<string>;
  onSelectionChange: (appointmentId: string, selected: boolean) => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am - 10pm

/** ISO instant for a week-view day+hour cell (droppable id consumed by onDragEnd). */
export function weekSlotId(day: Date, hour: number): string {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function WeekSlotCell({
  day,
  hour,
  appointments,
  selectedAppointmentIds,
  onAppointmentClick,
  onSelectionChange,
}: {
  day: Date;
  hour: number;
  appointments: Appointment[];
  selectedAppointmentIds: Set<string>;
  onAppointmentClick: (a: Appointment) => void;
  onSelectionChange: (id: string, selected: boolean) => void;
}) {
  const dayKey = format(day, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: weekSlotId(day, hour) });
  const weekend = day.getDay() === 0 || day.getDay() === 6;

  return (
    <td
      ref={setNodeRef}
      key={dayKey}
      className={cn(
        "p-1 border-l border-slate-800/50 border-b border-slate-800/30 align-top min-h-[64px] relative transition-colors",
        weekend && "bg-slate-950/50",
        isOver && "bg-accent-500/10 outline outline-1 outline-accent-500/50"
      )}
      style={{ minHeight: "64px" }}
      data-slot={weekSlotId(day, hour)}
    >
      {/* Stacked in-flow rows (sorted by start time): each card takes its own
          vertical space, so a long appointment can never overflow and cover
          the next one — the overlap seen in the close-up screenshot. */}
      <div className="flex flex-col gap-1">
        {[...appointments]
          .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
          .map((appt) => (
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
    </td>
  );
}

export function WeekView({
  date,
  appointments,
  onAppointmentClick,
  selectedAppointmentIds,
  onSelectionChange,
}: WeekViewProps) {
  const zonedDate = toZonedTime(date, "Europe/London");
  const weekStart = startOfWeek(zonedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(zonedDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    days.forEach((d) => map.set(format(d, "yyyy-MM-dd"), []));

    appointments.forEach((appt) => {
      const start = toZonedTime(appt.startsAt, "Europe/London");
      const dayKey = format(start, "yyyy-MM-dd");
      if (map.has(dayKey)) {
        map.get(dayKey)!.push(appt);
      }
    });

    return map;
  }, [appointments, days]);

  return (
    // NOTE: no `card` class — `.card` background var (unlayered CSS) beats
    // Tailwind utilities and turned the grid white in light OS mode.
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed" role="grid">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60">
              <th className="w-16 p-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 sticky left-0 bg-slate-950 z-10">
                Time
              </th>
              {days.map((day) => {
                const today = isSameDay(day, new Date());
                const dow = day.getDay();
                const weekend = dow === 0 || dow === 6;
                return (
                <th
                  key={format(day, "yyyy-MM-dd")}
                  className={cn("min-w-[148px] p-2 text-center border-l border-slate-800/50 sticky top-0 z-10", weekend ? "bg-slate-950/70" : "bg-slate-950/40")}
                >
                  <div className={cn("text-[11px] font-semibold uppercase tracking-wide", today ? "text-accent-300" : "text-slate-400")}>
                    {DAYS[dow === 0 ? 6 : dow - 1]}
                  </div>
                  <div className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", today ? "bg-accent-500 text-slate-950" : "text-slate-100")}>
                    {format(day, "d")}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {format(day, "MMM")}
                  </div>
                </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour}>
                <td className="w-16 p-1 pr-2 text-right text-[11px] tabular-nums text-slate-500 sticky left-0 bg-slate-950 z-10 border-b border-slate-800/30">
                  {format(new Date(2000, 0, 1, hour), "h a")}
                </td>
                {days.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const dayAppointments = appointmentsByDay.get(dayKey) || [];
                  // Render each appointment ONCE, in its START hour cell only
                  // (per-appointment id selection). The old overlap filter
                  // (startHr <= hour <= endHr) rendered the same card in every
                  // hour it spanned, duplicating checkboxes.
                  const hourAppointments = dayAppointments.filter((appt) => {
                    const start = toZonedTime(appt.startsAt, "Europe/London");
                    return start.getHours() === hour;
                  });

                  return (
                    <WeekSlotCell
                      key={dayKey}
                      day={day}
                      hour={hour}
                      appointments={hourAppointments}
                      selectedAppointmentIds={selectedAppointmentIds}
                      onAppointmentClick={onAppointmentClick}
                      onSelectionChange={onSelectionChange}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}