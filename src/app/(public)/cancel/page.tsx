import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppointmentByToken } from "@/actions/appointments";
import CancelForm from "./CancelForm";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function CancelPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    notFound();
  }

  let appointment = null;
  let error: string | null = null;
  try {
    const result = await getAppointmentByToken(token, "cancel");
    appointment = result.appointment;
    error = result.error;
  } catch (e) {
    console.error("[CancelPage] failed to load appointment:", e);
    error = "Service temporarily unavailable. Please try again.";
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="container py-12 md:py-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">
              Cancel Appointment
            </h1>
            <p className="text-lg text-slate-600">
              Review your appointment details below and confirm cancellation.
            </p>
          </div>

          {error ? (
            <div className="card p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-6">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Unable to Cancel
              </h2>
              <p className="text-slate-600 mb-6">{error}</p>
              <Link href="/" className="btn btn-primary">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Back to Home
              </Link>
            </div>
          ) : appointment ? (
            <CancelForm
              token={token}
              appointment={{
                id: appointment.id,
                patientName: appointment.patientName,
                serviceName: appointment.service.name,
                providerName: appointment.provider.name,
                startsAt: appointment.startsAt,
                endsAt: appointment.endsAt,
                status: appointment.status,
              }}
            />
          ) : (
            <div className="card p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-6">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Invalid Link
              </h2>
              <p className="text-slate-600 mb-6">
                This cancellation link is invalid or has already been used.
              </p>
              <Link href="/" className="btn btn-primary">Back to Home</Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}