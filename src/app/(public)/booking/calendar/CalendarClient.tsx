"use client";

import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isBefore } from "date-fns";
import Link from "next/link";
import { useState, useEffect } from "react";

interface CalendarData {
  serviceCode: string;
  providerId: string;
  serviceName: string;
  providerName: string;
  currentDate: Date;
  days: Date[];
  today: Date;
}

interface CalendarClientProps {
  initialData: CalendarData;
}

export function BookingCalendarClient({ initialData }: CalendarClientProps) {
  const [currentDate, setCurrentDate] = useState(initialData.currentDate);
  const [days, setDays] = useState(initialData.days);
  const [today] = useState(initialData.today);
  const { serviceCode, providerId, serviceName, providerName } = initialData;

  useEffect(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const newDays: Date[] = [];
    let day = calendarStart;
    while (isBefore(day, calendarEnd) || isSameDay(day, calendarEnd)) {
      newDays.push(day);
      day = addDays(day, 1);
    }
    setDays(newDays);
  }, [currentDate]);

  const goToMonth = (monthOffset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + monthOffset);
    setCurrentDate(newDate);
    window.location.href = `/booking/calendar?service=${serviceCode}&provider=${providerId}&date=${format(newDate, "yyyy-MM-dd")}`;
  };

  const goToSlot = (date: Date) => {
    window.location.href = `/booking/slot?service=${serviceCode}&provider=${providerId}&date=${format(date, "yyyy-MM-dd")}`;
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="container py-8 md:py-16">
        <header className="max-w-3xl mx-auto text-center mb-8">
          <nav className="mb-6" aria-label="Booking progress">
            <ol className="flex items-center justify-center gap-4" role="list">
              <li className="flex items-center gap-2">
                <Link href={`/booking?service=${serviceCode}`} className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-500 text-sm font-semibold flex items-center justify-center hover:border-slate-400 hover:text-slate-700 transition-colors" aria-label="Back to service selection">
                  1
                </Link>
                <span className="hidden sm:block text-sm text-slate-500">Service</span>
              </li>
              <li className="flex items-center gap-2">
                <Link href={`/booking/provider?service=${serviceCode}`} className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-500 text-sm font-semibold flex items-center justify-center hover:border-slate-400 hover:text-slate-700 transition-colors" aria-label="Back to provider selection">
                  2
                </Link>
                <span className="hidden sm:block text-sm text-slate-500">Provider</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-accent-600 text-white text-sm font-semibold flex items-center justify-center" aria-current="step">3</span>
                <span className="hidden sm:block font-medium text-slate-900">Calendar</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <span className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-400 text-sm font-semibold flex items-center justify-center">4</span>
                <span className="hidden sm:block text-sm text-slate-500">Confirm</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <span className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-400 text-sm font-semibold flex items-center justify-center">5</span>
                <span className="hidden sm:block text-sm text-slate-500">Details</span>
              </li>
            </ol>
          </nav>

          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Select a Date
            </h1>
            <div className="text-sm text-slate-600">
              {serviceName} · {providerName}
            </div>
          </div>
        </header>

        <div className="max-w-3xl mx-auto">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => goToMonth(-1)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Previous month"
              >
                <svg className="h-6 w-6 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <h2 className="text-lg font-semibold text-slate-900 capitalize">{format(currentDate, "MMMM yyyy")}</h2>
              <button
                onClick={() => goToMonth(1)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Next month"
              >
                <svg className="h-6 w-6 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            <table className="w-full" role="grid" aria-label="Calendar">
              <thead>
                <tr className="text-sm font-medium text-slate-500">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <th key={d} className="py-2 text-center">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {days.map((d, i) => {
                    const isCurrentMonth = isSameMonth(d, currentDate);
                    const isPast = isBefore(d, today);
                    const isToday = isSameDay(d, today);
                    const hasSlots = !isPast && isCurrentMonth;

                    return (
                      <td key={`${d.toISOString()}-${i}`} className="relative p-1">
                        <button
                          onClick={() => {
                            if (!isPast && isCurrentMonth) {
                              goToSlot(d);
                            }
                          }}
                          disabled={isPast || !isCurrentMonth}
                          className={`w-full h-12 rounded-lg transition-colors text-sm font-medium ${
                            isPast || !isCurrentMonth
                              ? "text-slate-300 cursor-not-allowed"
                              : isToday
                              ? "bg-accent-600 text-white hover:bg-accent-700"
                              : hasSlots
                              ? "text-slate-900 hover:bg-slate-100"
                              : "text-slate-300 cursor-not-allowed"
                          } ${hasSlots ? "font-semibold" : ""}`}
                          aria-label={`${format(d, "EEEE, MMMM d, yyyy")}${hasSlots ? ", available" : isPast ? ", past date" : ", not available this month"}`}
                          aria-disabled={isPast || !isCurrentMonth}
                        >
                          {format(d, "d")}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>

            <div className="mt-6 flex items-center justify-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-slate-500">
                <span className="w-3 h-3 rounded bg-accent-600"></span>
                Today
              </span>
              <span className="flex items-center gap-1 text-slate-500">
                <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300"></span>
                Available
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-3 h-3 rounded bg-slate-100"></span>
                Unavailable
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href={`/booking/provider?service=${serviceCode}`} className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2">
            ← Back to practitioners
          </Link>
        </div>
      </div>
    </main>
  );
}