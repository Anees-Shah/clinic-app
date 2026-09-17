"use client";

import { useState, FormEvent } from "react";
import { cancelAppointment } from "@/actions/appointments";
import { fmtLondon } from "@/lib/london";
import Link from "next/link";

interface AppointmentData {
  id: string;
  patientName: string;
  serviceName: string;
  providerName: string;
  startsAt: Date | string;
  endsAt: Date | string;
  status: string;
}

interface Props {
  token: string;
  appointment: AppointmentData;
}

export default function CancelForm({ token, appointment }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const startsAt = new Date(appointment.startsAt);
  const endsAt = new Date(appointment.endsAt);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await cancelAppointment(token);
      
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || "Cancellation failed. Please try again.");
      }
    } catch (e) {
      console.error("[Cancel] cancelAppointment failed:", e);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="card p-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-6">
          <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Appointment Cancelled</h2>
        <p className="text-slate-600 mb-6">
          Your appointment for <strong>{appointment.serviceName}</strong> with <strong>{appointment.providerName}</strong> 
          on <strong>{fmtLondon(startsAt, "EEEE, MMMM d, yyyy")}</strong> 
          at <strong>{fmtLondon(startsAt, "HH:mm")}</strong> has been cancelled.
        </p>
        <p className="text-slate-500 text-sm mb-8">
          The slot has been freed and is now available for other patients. 
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
          <Link href={`/reschedule?token=${token}`} className="btn btn-outline w-full sm:w-auto">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 3a6 6 0 0 1 6 6v1" />
              <path d="M3 21a6 6 0 0 1-6-6H1" />
              <path d="M3 7V5a6 6 0 0 1 6-6h1" />
              <path d="M21 17a6 6 0 0 1-6 6h-1" />
            </svg>
            Reschedule Instead
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
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
            <dd className="font-medium text-slate-900 text-right">{appointment.serviceName}</dd>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
            <dt className="text-slate-500">Practitioner</dt>
            <dd className="font-medium text-slate-900 text-right">{appointment.providerName}</dd>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
            <dt className="text-slate-500">Date</dt>
            <dd className="font-medium text-slate-900 text-right">{fmtLondon(startsAt, "EEEE, MMMM d, yyyy")}</dd>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
            <dt className="text-slate-500">Time</dt>
            <dd className="font-medium text-slate-900 text-right">{fmtLondon(startsAt, "HH:mm")} – {fmtLondon(endsAt, "HH:mm")}</dd>
          </div>
        </dl>
      </div>

      <div className="card p-6 mb-6 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <h3 className="font-medium text-amber-900 mb-1">Important</h3>
            <p className="text-amber-800 text-sm">
              This cancellation link can only be used <strong>once</strong>. 
              After confirming, you will not be able to use this link again.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="card p-4 mb-6 bg-red-50 border-red-200" role="alert">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!showConfirm ? (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="btn btn-destructive w-full"
            disabled={isSubmitting}
          >
            Cancel Appointment
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-700 text-center">
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="btn btn-outline flex-1"
              >
                Keep Appointment
              </button>
              <button
                type="submit"
                className="btn btn-destructive flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Cancelling...
                  </>
                ) : (
                  "Yes, Cancel Appointment"
                )}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-slate-500">
          <Link href="/" className="underline hover:text-accent-600">Back to Home</Link> without changes
        </p>
      </form>
    </>
  );
}