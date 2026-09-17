"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import type { Appointment } from "@/components/dashboard/types";

interface MonthViewProps {
  date: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  onDateClick: (date: Date) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthView({
  date,
  appointments,
  onAppointmentClick,
  onDateClick,
}: MonthViewProps) {
  const zonedDate = toZonedTime(date, "Europe/London");
  const monthStart = startOfMonth(zonedDate);
  const monthEnd = endOfMonth(zonedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();

    appointments.forEach((appt) => {
      const start = toZonedTime(appt.startsAt, "Europe/London");
      const dayKey = format(start, "yyyy-MM-dd");
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(appt);
    });

    return map;
  }, [appointments]);

  const getRowClasses = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-emerald-500/15 text-emerald-100 border border-emerald-500/30";
      case "completed":
        return "bg-sky-500/15 text-sky-100 border border-sky-500/30";
      case "cancelled":
        return "bg-slate-500/15 text-slate-300 border border-slate-500/30";
      case "no_show":
        return "bg-red-500/15 text-red-100 border border-red-500/30";
      default:
        return "bg-slate-500/15 text-slate-200 border border-slate-500/30";
    }
  };

  const getDotClasses = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-emerald-400";
      case "completed": return "bg-sky-400";
      case "cancelled": return "bg-slate-400";
      case "no_show": return "bg-red-400";
      default: return "bg-slate-400";
    }
  };

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    // NOTE: no `card` class here — `.card` sets background via var(--background)
    // which (unlayered CSS) beats Tailwind utilities and turned cells white in
    // light OS mode. Explicit rounded/border/bg keeps the dark dashboard theme.
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/60">
        {DAYS.map((day) => (
          <div key={day} className="p-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="contents">
            {week.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const all = (appointmentsByDay.get(dayKey) || [])
                .slice()
                .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
              const isCurrentMonth = isSameMonth(day, zonedDate);
              const isToday = isSameDay(day, new Date());
              const MAX_VISIBLE = 3;
              const visible = all.slice(0, MAX_VISIBLE);
              const hiddenCount = all.length - visible.length;

              return (
                <div
                  key={dayKey}
                  onClick={() => onDateClick(day)}
                  className={`relative flex min-h-[132px] flex-col gap-1 border-r border-b border-slate-800/60 p-1.5 text-left transition-colors last:border-r-0 hover:bg-slate-800/40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-inset ${
                    !isCurrentMonth ? "bg-slate-950/40" : "bg-slate-900"
                  } ${isToday ? "ring-2 ring-accent-500 ring-inset" : ""}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onDateClick(day);
                  }}
                  aria-label={`${format(day, "EEEE, MMMM d, yyyy")}, ${all.length} appointment${all.length !== 1 ? "s" : ""}`}
                  title={`${format(day, "EEEE, MMMM d, yyyy")} — click for day view`}
                >
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday
                        ? "bg-accent-500 text-slate-950"
                        : isCurrentMonth
                          ? "text-slate-100"
                          : "text-slate-500"
                    }`}>
                    {format(day, "d")}
                  </div>

                  {all.length === 0 ? (
                    <span className="sr-only">No appointments</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {visible.map((appt) => {
                        const t = formatInTimeZone(appt.startsAt, "Europe/London", "HH:mm");
                        return (
                          <button
                            key={appt.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAppointmentClick(appt);
                            }}
                            className={`flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition-colors hover:brightness-125 ${getRowClasses(appt.status)}`}
                            title={`${t} — ${appt.patientName} — ${appt.service.name} (${appt.status})${appt.provider ? ` — ${appt.provider.name}` : ""}`}
                          >
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${getDotClasses(appt.status)}`} aria-hidden="true" />
                            <span className="hidden font-medium text-slate-300 xl:inline">{t}</span>
                            <span className="min-w-0 flex-1 truncate font-medium">{appt.patientName}</span>
                          </button>
                        );
                      })}
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDateClick(day);
                          }}
                          className="rounded-md bg-slate-800/80 px-1.5 py-1 text-left text-[11px] font-semibold text-accent-300 transition-colors hover:bg-slate-700 hover:text-accent-200"
                          title={`Show all ${all.length} appointments in day view`}
                        >
                          +{hiddenCount} more
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}