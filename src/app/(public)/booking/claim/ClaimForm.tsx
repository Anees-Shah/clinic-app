"use client";

import { useState, FormEvent } from "react";
import { fmtLondonDay } from "@/lib/london";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

function ClaimSuccess({ service, provider, date }: {
  service: { code: string; id: string };
  provider: { id: string };
  date: string;
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-2 text-green-700 mb-2">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="font-semibold">Slot Claimed Successfully!</span>
        </div>
        <p className="text-sm text-slate-600">Your slot has been reserved. You can now complete your booking.</p>
        <Link href={`/booking?service=${service.code}&provider=${provider.id}&date=${date}&slot=10:00`} className="btn btn-primary w-full">
          Continue to Booking
        </Link>
      </div>
    </div>
  );
}

function ClaimPending({
  handleClaim,
  isLoading,
  error,
}: {
  handleClaim: () => Promise<void>;
  isLoading: boolean;
  error: string;
}) {
  return (
    <button
      onClick={handleClaim}
      disabled={isLoading}
      className="btn btn-primary w-full py-4 text-lg"
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Claiming...
        </span>
      ) : (
        "Claim This Slot & Continue to Booking"
      )}
    </button>
  );
}

export function ClaimForm({
  service,
  provider,
  date,
  claimToken,
}: {
  service: {
    id: string;
    code: string;
    name: string;
    durationMin: number;
    price: number;
  };
  provider: {
    id: string;
    name: string;
    title: string;
  };
  date: string;
  claimToken: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"claim" | "success">("claim");

  const handleClaim = async () => {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/booking/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to claim slot. It may have expired or been taken.");
        setIsLoading(false);
        return;
      }

      setStep("success");
      setIsLoading(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  const slotTime = searchParams.get("slot") || "";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container py-12 md:py-20">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
              Claim Your Slot
            </h1>
            <p className="text-lg text-slate-600">
              A slot has opened up for your requested treatment
            </p>
          </div>

          <div className="card bg-white border-slate-200 p-6 shadow-lg mb-6">
            <div className="bg-accent-50 border border-accent-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-accent-800 mb-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <span className="font-semibold">Limited Time Offer</span>
              </div>
              <p className="text-sm text-accent-700">
                This slot is reserved for you for <strong>30 minutes</strong>. 
                Complete the booking to secure your spot.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm mb-6">
              <dt className="text-slate-500">Treatment</dt>
              <dd className="font-medium text-slate-900">{service.name}</dd>
              <dt className="text-slate-500">Practitioner</dt>
              <dd className="font-medium text-slate-900">{provider.name}</dd>
              <dt className="text-slate-500">Date</dt>
              <dd className="font-medium text-slate-900">{fmtLondonDay(date)}</dd>
              <dt className="text-slate-500">Time</dt>
              <dd className="font-medium text-slate-900">{slotTime || "Select below"}</dd>
              <dt className="text-slate-500">Duration</dt>
              <dd className="font-medium text-slate-900">{service.durationMin} min</dd>
              <dt className="text-slate-500">Price</dt>
              <dd className="font-semibold text-slate-900">£{service.price.toFixed(2)}</dd>
            </dl>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2 text-red-700">
                <svg className="h-5 w-5 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div>
                  <p className="font-medium">Time Limited</p>
                  <p className="text-sm">This link expires in <strong>30 minutes</strong> and can only be used once.</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
                {error}
              </div>
            )}

            {step === "claim" ? (
              <button
                onClick={handleClaim}
                disabled={isLoading}
                className="btn btn-primary w-full py-4 text-lg"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Claiming...
                  </span>
                ) : (
                  "Claim This Slot & Continue to Booking"
                )}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span className="font-semibold">Slot Claimed Successfully!</span>
                  </div>
                  <p className="text-sm text-slate-600">Your slot has been reserved. You can now complete your booking.</p>
                  <Link href={`/booking?service=${service.code}&provider=${provider.id}&date=${date}&slot=10:00`} className="btn btn-primary w-full">
                    Continue to Booking
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-slate-500 hover:text-accent-600 underline underline-offset-2">
            ← Back to clinic website
          </Link>
        </div>
      </div>
    </div>
  );
}