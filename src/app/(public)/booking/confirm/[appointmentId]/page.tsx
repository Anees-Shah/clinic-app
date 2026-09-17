import { prisma } from "@/lib/prisma";
import { fmtLondon } from "@/lib/london";
import { notFound } from "next/navigation";
import Link from "next/link";

interface Props {
  params: Promise<{ appointmentId: string }>;
}

export default async function BookingConfirmPage({ params }: Props) {
  const { appointmentId } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      service: true,
      provider: true,
    },
  });

  if (!appointment) {
    notFound();
  }

  const startsAt = new Date(appointment.startsAt);
  const endsAt = new Date(appointment.endsAt);
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const cancelUrl = appointment.cancelToken ? `${baseUrl}/cancel?token=${appointment.cancelToken}` : null;
  const rescheduleUrl = appointment.rescheduleToken ? `${baseUrl}/reschedule?token=${appointment.rescheduleToken}` : null;

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//London Aesthetic Clinic//Booking//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@londonaesthetic.co.uk`,
    `DTSTAMP:${fmtLondon(new Date(), "yyyyMMdd'T'HHmmss")}`,
    `DTSTART:${fmtLondon(startsAt, "yyyyMMdd'T'HHmmss")}`,
    `DTEND:${fmtLondon(endsAt, "yyyyMMdd'T'HHmmss")}`,
    `SUMMARY:${appointment.service.name} with ${appointment.provider.name}`,
    `DESCRIPTION:Appointment at London Aesthetic Clinic.\\n${appointment.service.name} with ${appointment.provider.name}.\\nCancel: ${cancelUrl ?? "link expired"}\\nReschedule: ${rescheduleUrl ?? "link expired"}`,
    `LOCATION:London Aesthetic Clinic, London, UK`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const icsBlob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const icsUrl = URL.createObjectURL(icsBlob);

  return (
    <main className="min-h-screen bg-white">
      <div className="container py-12 md:py-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-6">
              <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">
              Appointment Confirmed!
            </h1>
            <p className="text-lg text-slate-600">
              Your booking has been confirmed. We&apos;ll send a confirmation email to <strong>{appointment.patientEmail}</strong>.
            </p>
          </div>

          <div className="card p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-accent-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Appointment Details
            </h2>
            <dl className="space-y-3">
              <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                <dt className="text-slate-500">Treatment</dt>
                <dd className="font-medium text-slate-900 text-right">{appointment.service.name}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                <dt className="text-slate-500">Practitioner</dt>
                <dd className="font-medium text-slate-900 text-right">{appointment.provider.name}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                <dt className="text-slate-500">Date</dt>
                <dd className="font-medium text-slate-900 text-right">{fmtLondon(startsAt, "EEEE, MMMM d, yyyy")}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                <dt className="text-slate-500">Time</dt>
                <dd className="font-medium text-slate-900 text-right">{fmtLondon(startsAt, "HH:mm")} – {fmtLondon(endsAt, "HH:mm")}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                <dt className="text-slate-500">Duration</dt>
                <dd className="font-medium text-slate-900 text-right">{appointment.service.durationMin} minutes</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                <dt className="text-slate-500">Price</dt>
                <dd className="font-semibold text-slate-900 text-right">£{Number(appointment.service.price).toFixed(2)}</dd>
              </div>
              {appointment.notes && (
                <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                  <dt className="text-slate-500">Notes</dt>
                  <dd className="font-medium text-slate-900 text-right">{appointment.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="card p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-accent-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Add to Calendar
            </h2>
            <a
              href={icsUrl}
              download="appointment.ics"
              className="btn btn-outline w-full sm:w-auto"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M12 16v-6l-4 4" />
              </svg>
              Download .ics file
            </a>
            <p className="mt-3 text-sm text-slate-500 text-center">
              Works with Google Calendar, Apple Calendar, Outlook, and more.
            </p>
          </div>

          <div className="card p-6 mb-6 border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-accent-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Important Links
            </h2>
            <div className="space-y-3">
              {cancelUrl ? (
                <a
                  href={cancelUrl}
                  className="btn btn-outline w-full justify-start gap-3 hover:border-red-300 hover:text-red-700 hover:bg-red-50 transition-colors"
                >
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span>Cancel Appointment</span>
                </a>
              ) : (
                <p className="text-sm text-slate-500">This booking has already been cancelled or moved — links expired.</p>
              )}
              {rescheduleUrl ? (
                <a
                  href={rescheduleUrl}
                  className="btn btn-outline w-full justify-start gap-3"
                >
                  <svg className="h-5 w-5 text-accent-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 3a6 6 0 0 1 6 6v1" />
                    <path d="M3 21a6 6 0 0 1-6-6H1" />
                    <path d="M3 7V5a6 6 0 0 1 6-6h1" />
                    <path d="M21 17a6 6 0 0 1-6 6h-1" />
                  </svg>
                  <span>Reschedule Appointment</span>
                </a>
              ) : null}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              These links are unique to your booking and can only be used once.
              Links stay valid until your appointment starts.
              <strong>Free cancellation up to 48 business hours before your appointment.</strong>
            </p>
          </div>

          <div className="card p-6 bg-slate-50">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-accent-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              What Happens Next
            </h2>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center text-xs font-semibold">1</span>
                <span>You&apos;ll receive a confirmation email with these details and your unique cancel/reschedule links.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center text-xs font-semibold">2</span>
                <span>Reminder emails will be sent 24 hours and 1 hour before your appointment.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center text-xs font-semibold">3</span>
                <span>Arrive 10 minutes before your appointment time. Bring photo ID.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center text-xs font-semibold">4</span>
                <span>Payment is taken at the clinic after your treatment.</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 text-center">
            <Link href="/" className="btn btn-primary">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}