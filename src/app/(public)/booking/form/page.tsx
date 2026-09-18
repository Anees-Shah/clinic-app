"use client";

import { useState, FormEvent, Suspense } from "react";
import { fmtLondonDay, addWallMinutes } from "@/lib/london";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

interface SlotData {
  service: string;
  provider: string;
  date: string;
  slot: string;
}

// Static lookup tables (module scope — no state/effect needed to read them).
const SERVICE_INFO: Record<string, { name: string; price: string }> = {
  botox: { name: "Anti-Wrinkle Injections (Botox)", price: "£250.00" },
  filler: { name: "Dermal Fillers", price: "£350.00" },
  consultation: { name: "Aesthetic Consultation", price: "£50.00" },
  profhilo: { name: "Profhilo (Skin Remodelling)", price: "£300.00" },
};

const PROVIDER_NAMES: Record<string, string> = {
  "provider-dr-smith": "Dr. Sarah Smith",
  "provider-dr-jones": "Dr. James Jones",
};

function BookingFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    smsOptIn: false,
  });

  const slotData: SlotData = {
    service: searchParams.get("service") || "",
    provider: searchParams.get("provider") || "",
    date: searchParams.get("date") || "",
    slot: searchParams.get("slot") || "",
  };

  // Derived during render from the static tables above (pure lookup — the
  // previous state+effect version caused cascading renders).
  const _svc = SERVICE_INFO[slotData.service];
  const serviceName = _svc?.name ?? "";
  const price = _svc?.price ?? "";
  const providerName = PROVIDER_NAMES[slotData.provider] ?? "";

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError("Full name is required");
      return false;
    }
    if (!formData.email.trim()) {
      setError("Email address is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Please enter a valid email address");
      return false;
    }
    if (!formData.phone.trim()) {
      setError("Phone number is required");
      return false;
    }
    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      setError("Please enter a valid UK phone number");
      return false;
    }
    setError(null);
    return true;
  };

  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0) return "";
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    if (digits.length <= 10) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);

    const idempotencyKey = crypto.randomUUID();

    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          serviceCode: slotData.service,
          providerId: slotData.provider,
          date: slotData.date,
          slotTime: slotData.slot,
          patientName: formData.name,
          patientEmail: formData.email,
          patientPhone: formData.phone.replace(/\D/g, ""),
          notes: formData.notes,
          smsOptIn: formData.smsOptIn,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setError("This slot was just booked by someone else. Please choose another time.");
          setTimeout(() => {
            router.push(`/booking/slot?service=${slotData.service}&provider=${slotData.provider}&date=${slotData.date}`);
          }, 3000);
        } else {
          setError(data.error || "Booking failed. Please try again.");
        }
        setSubmitting(false);
        return;
      }

      router.push(`/booking/confirm/${data.appointmentId}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "phone") {
      setFormData((prev) => ({ ...prev, [name]: formatPhone(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.checked }));
  };

  if (!slotData.service || !slotData.provider || !slotData.date || !slotData.slot) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Loading booking details...</p>
        </div>
      </main>
    );
  }

  // slotData.slot is a London wall time ("HH:mm") chosen on the previous
  // screen — display it verbatim. Never new Date()/parseISO it: those follow
  // the machine timezone and shift the shown time abroad.
  const slotEndWall = addWallMinutes(slotData.slot, 30);

  return (
    <main className="min-h-screen bg-white">
      <div className="container py-8 md:py-16">
        <header className="max-w-xl mx-auto text-center mb-8">
          <nav className="mb-6" aria-label="Booking progress">
            <ol className="flex items-center justify-center gap-4" role="list">
              <li className="flex items-center gap-2">
                <Link href={`/booking?service=${slotData.service}`} className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-500 text-sm font-semibold flex items-center justify-center hover:border-slate-400 hover:text-slate-700 transition-colors" aria-label="Back to service selection">
                  1
                </Link>
                <span className="hidden sm:block text-sm text-slate-500">Service</span>
              </li>
              <li className="flex items-center gap-2">
                <Link href={`/booking/provider?service=${slotData.service}`} className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-500 text-sm font-semibold flex items-center justify-center hover:border-slate-400 hover:text-slate-700 transition-colors" aria-label="Back to provider selection">
                  2
                </Link>
                <span className="hidden sm:block text-sm text-slate-500">Provider</span>
              </li>
              <li className="flex items-center gap-2">
                <Link href={`/booking/calendar?service=${slotData.service}&provider=${slotData.provider}&date=${slotData.date}`} className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-500 text-sm font-semibold flex items-center justify-center hover:border-slate-400 hover:text-slate-700 transition-colors" aria-label="Back to calendar">
                  3
                </Link>
                <span className="hidden sm:block text-sm text-slate-500">Calendar</span>
              </li>
              <li className="flex items-center gap-2">
                <Link href={`/booking/slot?service=${slotData.service}&provider=${slotData.provider}&date=${slotData.date}`} className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-500 text-sm font-semibold flex items-center justify-center hover:border-slate-400 hover:text-slate-700 transition-colors" aria-label="Back to time selection">
                  4
                </Link>
                <span className="hidden sm:block text-sm text-slate-500">Confirm</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-accent-600 text-white text-sm font-semibold flex items-center justify-center" aria-current="step">5</span>
                <span className="hidden sm:block font-medium text-slate-900">Details</span>
              </li>
            </ol>
          </nav>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mb-2">
            Your Details
          </h1>
          <p className="text-lg text-slate-600">
            Complete the form to confirm your appointment
          </p>
        </header>

        <div className="max-w-xl mx-auto">
          <div className="card p-6 mb-6">
            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <h2 className="font-semibold text-slate-900 mb-2">Appointment Summary</h2>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-500">Treatment</dt>
                <dd className="font-medium text-slate-900">{serviceName || slotData.service}</dd>
                <dt className="text-slate-500">Practitioner</dt>
                <dd className="font-medium text-slate-900">{providerName || slotData.provider}</dd>
                <dt className="text-slate-500">Date</dt>
                <dd className="font-medium text-slate-900">{fmtLondonDay(slotData.date)}</dd>
                <dt className="text-slate-500">Time</dt>
                <dd className="font-medium text-slate-900">{slotData.slot} - {slotEndWall}</dd>
                <dt className="text-slate-500">Price</dt>
                <dd className="font-semibold text-slate-900">{price}</dd>
              </dl>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                    Full Name <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none transition-shadow"
                    placeholder="John Smith"
                    required
                    autoComplete="name"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none transition-shadow"
                    placeholder="john@example.com"
                    required
                    autoComplete="email"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                    Phone Number <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none transition-shadow"
                    placeholder="07700 900 123"
                    required
                    autoComplete="tel"
                    disabled={submitting}
                    inputMode="tel"
                  />
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none transition-shadow resize-y"
                    placeholder="Any medical conditions, allergies, or specific concerns..."
                    disabled={submitting}
                  />
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="smsOptIn"
                    name="smsOptIn"
                    checked={formData.smsOptIn}
                    onChange={handleCheckboxChange}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-2 focus:ring-accent-500/20 focus:ring-offset-2"
                    disabled={submitting}
                  />
                  <label htmlFor="smsOptIn" className="text-sm text-slate-600 leading-relaxed">
                    Send SMS reminders (24 hours and 1 hour before appointment). Standard network rates may apply.
                  </label>
                </div>
              </div>

              <div className="mt-8">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Confirming...
                    </span>
                  ) : (
                    "Confirm & Pay £0.00"
                  )}
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-slate-500">
                No payment required today. You&apos;ll pay at the clinic. By confirming, you agree to our
                <a href="#" className="underline hover:text-slate-700">cancellation policy</a>
                (free cancellation up to 48 business hours before).
              </p>
            </form>
          </div>

          <div className="text-center">
            <Link href={`/booking/slot?service=${slotData.service}&provider=${slotData.provider}&date=${slotData.date}`} className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2">
              ← Back to time selection
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function BookingFormPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Loading booking details...</p>
        </div>
      </main>
    }>
      <BookingFormContent />
    </Suspense>
  );
}