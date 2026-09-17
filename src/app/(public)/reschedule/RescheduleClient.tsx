"use client";

import { useState, FormEvent, useEffect } from "react";
import { rescheduleAppointment, getAvailableSlotsForReschedule } from "@/actions/appointments";
import { format, addDays, startOfDay, isBefore, isSameDay, parseISO } from "date-fns";
import { fmtLondon, londonWeekday } from "@/lib/london";
import { enGB } from "date-fns/locale";
import Link from "next/link";
import { TimeSlot } from "@/lib/availability";

interface AppointmentData {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  serviceName: string;
  serviceId: string;
  serviceDuration: number;
  serviceBufferBefore: number;
  serviceBufferAfter: number;
  providerName: string;
  providerId: string;
  startsAt: Date | string;
  endsAt: Date | string;
  status: string;
}

interface Props {
  token: string;
  appointment: AppointmentData;
}

export default function RescheduleClient({ token, appointment }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [successAppointment, setSuccessAppointment] = useState<{
    id: string;
    startsAt: Date;
    endsAt: Date;
    serviceName: string;
    providerName: string;
    cancelToken?: string | null;
    rescheduleToken?: string | null;
  } | null>(null);

  const currentStartsAt = new Date(appointment.startsAt);
  const currentEndsAt = new Date(appointment.endsAt);

  // Generate dates for next 60 days (for calendar).
  // Mon-first grid: the header is Mon..Sun, so prepend blanks to align the
  // first date under its real weekday. Business hours are Mon-Fri 9-18
  // (AvailabilitySchedule seed days 1-5, JS getDay 0=Sun); Sat/Sun are off.
  const generateCalendarDates = () => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 60; i++) {
      dates.push(addDays(today, i));
    }
    return dates;
  };

  const calendarDates = generateCalendarDates();
  // Mon-first offset + weekend shading use the LONDON weekday of the calendar
  // cell's day string — never the browser-local getDay(). A browser-midnight
  // Date in UTC+5 is still "yesterday" in London, which shifted the whole
  // grid a day (Sep-30 click loaded Sep-29 slots; Oct-1 hit the Sep-30 block).
  const londonDow = (date: Date) => londonWeekday(format(date, "yyyy-MM-dd"));
  const leadBlanks = calendarDates.length > 0 ? (londonDow(calendarDates[0]) + 6) % 7 : 0;
  const isWeekendOff = (date: Date) => {
    const dow = londonDow(date);
    return dow === 0 || dow === 6; // Sun/Sat off (Mon-Fri 9-18)
  };

  async function loadSlots(date: Date) {
    setLoadingSlots(true);
    setSelectedSlot(null);
    setError(null);
    setConflict(false);

    try {
      // Send the calendar CELL's day string ("2026-09-30"), not the Date
      // object: server actions serialize Dates as instants, and a
      // browser-midnight instant is the previous day in London east of the
      // UK. The server treats the string as a London calendar day.
      const dayStr = format(date, "yyyy-MM-dd");
      const availableSlots = await getAvailableSlotsForReschedule(
        appointment.providerId,
        appointment.serviceId,
        dayStr
      );
      // Server actions serialize Dates to strings — normalize back to Dates
      // so slot.start.getTime()/toISOString() never throws ("unexpected error").
      setSlots(
        (availableSlots || []).map((s) => ({
          start: new Date((s as unknown as { start: string | Date }).start),
          end: new Date((s as unknown as { end: string | Date }).end),
          available: (s as unknown as { available: boolean }).available,
        }))
      );
    } catch (e) {
      console.error("[Reschedule] loadSlots failed:", e);
      setError("Failed to load available slots. Please try again.");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  function handleDateClick(date: Date) {
    // Don't allow past dates or weekends (clinic closed Sat/Sun)
    if (isBefore(startOfDay(date), startOfDay(new Date()))) return;
    if (isWeekendOff(date)) return;
    setSelectedDate(date);
    loadSlots(date);
  }

  function handleSlotSelect(slot: TimeSlot) {
    if (!slot.available) return;
    setSelectedSlot(slot);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSlot || !selectedDate) return;

    setIsSubmitting(true);
    setError(null);
    setConflict(false);

    try {
      const result = await rescheduleAppointment(token, selectedSlot.start);
      
      if (result.success && result.appointment) {
        setSuccess(true);
        setSuccessAppointment({
          id: result.appointment.id,
          startsAt: result.appointment.startsAt,
          endsAt: result.appointment.endsAt,
          serviceName: result.appointment.serviceName,
          providerName: result.appointment.providerName,
          cancelToken: result.appointment.cancelToken ?? null,
          rescheduleToken: result.appointment.rescheduleToken ?? null,
        });
      } else {
        setError(result.error || "Rescheduling failed. Please try again.");
        setConflict(result.conflict || false);
      }
    } catch (e) {
      console.error("[Reschedule] rescheduleAppointment failed:", e);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success && successAppointment) {
    return (
      <div className="card p-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-6">
          <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Appointment Rescheduled!</h2>
        <p className="text-slate-600 mb-6">
          Your <strong>{successAppointment.serviceName}</strong> with <strong>{successAppointment.providerName}</strong> 
          has been moved to <strong>{fmtLondon(successAppointment.startsAt, "EEEE, MMMM d, yyyy")}</strong> 
          at <strong>{fmtLondon(successAppointment.startsAt, "HH:mm")}</strong>.
        </p>
        <p className="text-slate-500 text-sm mb-8">
          Your original booking has been cancelled and this new slot is now confirmed. 
          A confirmation email has been sent to your email address.
        </p>
        <div className="space-y-3">
          <Link href="/" className="btn btn-primary w-full sm:w-auto">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Home
          </Link>
          <a 
            href={successAppointment.cancelToken ? `/cancel?token=${successAppointment.cancelToken}` : "/"}
            className="btn btn-outline w-full sm:w-auto"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            Cancel This Appointment
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Current Appointment */}
      <div className="card p-6 mb-6 bg-blue-50 border-blue-200">
        <h2 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          Current Appointment
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between py-1 border-b border-blue-100 last:border-0">
            <dt className="text-blue-700">Treatment</dt>
            <dd className="font-medium text-blue-900 text-right">{appointment.serviceName}</dd>
          </div>
          <div className="flex justify-between py-1 border-b border-blue-100 last:border-0">
            <dt className="text-blue-700">Practitioner</dt>
            <dd className="font-medium text-blue-900 text-right">{appointment.providerName}</dd>
          </div>
          <div className="flex justify-between py-1 border-b border-blue-100 last:border-0">
            <dt className="text-blue-700">Date</dt>
            <dd className="font-medium text-blue-900 text-right">{fmtLondon(currentStartsAt, "EEEE, MMMM d, yyyy")}</dd>
          </div>
          <div className="flex justify-between py-1 border-b border-blue-100 last:border-0">
            <dt className="text-blue-700">Time</dt>
            <dd className="font-medium text-blue-900 text-right">{fmtLondon(currentStartsAt, "HH:mm")} – {fmtLondon(currentEndsAt, "HH:mm")}</dd>
          </div>
        </dl>
      </div>

      {/* New Appointment Selection */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <svg className="h-5 w-5 text-accent-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Select New Date & Time
        </h2>

        {/* Calendar - Simple month view */}
        <div className="mb-6">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="h-10" aria-hidden="true" />
            ))}
            {calendarDates.map((date) => {
              const isPast = isBefore(startOfDay(date), startOfDay(new Date()));
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              const isWeekend = isWeekendOff(date);
              const disabled = isPast || isWeekend;
              
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => handleDateClick(date)}
                  disabled={disabled}
                  className={`
                    h-10 rounded-lg text-sm font-medium transition-all
                    ${disabled ? "text-slate-300 cursor-not-allowed" : ""}
                    ${isSelected ? "bg-accent-600 text-white" : isWeekend ? "text-slate-400 bg-slate-50" : "text-slate-700 hover:bg-accent-50"}
                    ${isSelected ? "shadow-sm" : ""}
                  `}
                  aria-label={format(date, "EEEE, MMMM d, yyyy", { locale: enGB })}
                  title={isWeekend ? "Clinic closed on weekends (Mon–Fri 9:00–18:00)" : undefined}
                  aria-selected={isSelected ? "true" : "false"}
                  aria-disabled={disabled ? "true" : "false"}
                >
                  {format(date, "d")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots */}
        <div>
          {selectedDate ? (
            <>
              <p className="text-sm text-slate-600 mb-4">
                Available times for {format(selectedDate, "EEEE, MMMM d, yyyy", { locale: enGB })}
              </p>
              {loadingSlots ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-12 animate-pulse bg-slate-100 rounded-lg" />
                  ))}
                </div>
              ) : slots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                  {slots.map((slot) => (
                    <button
                      key={slot.start.toISOString()}
                      type="button"
                      onClick={() => handleSlotSelect(slot)}
                      disabled={!slot.available}
                      className={`
                        px-4 py-3 rounded-lg text-sm font-medium transition-all
                        text-left border-2
                        ${slot.available
                          ? selectedSlot?.start.getTime() === slot.start.getTime()
                            ? "border-accent-600 bg-accent-50 text-accent-700"
                            : "border-slate-200 text-slate-700 hover:border-accent-300 hover:bg-accent-50"
                          : "border-slate-200 text-slate-300 cursor-not-allowed"
                        }
                      `}
                      aria-pressed={selectedSlot?.start.getTime() === slot.start.getTime()}
                    >
                      <div className="font-medium">{fmtLondon(slot.start, "HH:mm")}</div>
                      <div className="text-xs text-slate-500">
                        – {fmtLondon(slot.end, "HH:mm")}
                      </div>
                      {!slot.available && (
                        <div className="text-xs text-red-500 mt-1">Booked</div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <svg className="h-12 w-12 mx-auto text-slate-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <p>No available slots for this date</p>
                  <p className="text-sm mt-1">Please select another date</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <svg className="h-12 w-12 mx-auto text-slate-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p>Select a date above to see available times</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200" role="alert">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {selectedSlot && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="p-4 bg-accent-50 border border-accent-200 rounded-lg">
                <p className="text-sm text-accent-900 font-medium">
                  Selected: {fmtLondon(selectedSlot.start, "HH:mm")} – {fmtLondon(selectedSlot.end, "HH:mm")}
                  on {format(selectedDate!, "EEEE, MMMM d, yyyy", { locale: enGB })}
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Confirming...
                  </>
                ) : (
                  "Confirm Reschedule"
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="btn btn-outline w-full"
                disabled={isSubmitting}
              >
                Change Selection
              </button>

              <p className="text-center text-sm text-slate-500">
                <Link href="/" className="underline hover:text-accent-600">Back to Home</Link> without changes
              </p>
            </form>
          )}
        </div>
      </div>

      <div className="card p-4 bg-slate-50">
        <p className="text-sm text-slate-600 text-center">
          <strong>Free rescheduling up to 48 business hours before your appointment.</strong>
          Late changes may incur a fee. This link is single-use and expires in 24 hours.
        </p>
      </div>
    </>
  );
}