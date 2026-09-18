"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Suspense } from "react";
import { ClientOnly } from "@/components/ui/ClientOnly";

function LoginFormContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.ok && !result.error) {
        // Hard navigate so the fresh JWT cookie is sent on the next
        // request and middleware sees the logged-in state immediately.
        window.location.href = callbackUrl;
      } else if (result?.error) {
        setError("Invalid email or password");
      } else {
        // Transport failure (providers/csrf/network returned undefined or
        // !ok with no error code). Surface it instead of navigating and
        // mimicking a silent login loop.
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10 animate-fade-in-up">
          <Link href="/" className="flex items-center gap-2 font-semibold text-xl text-slate-900 justify-center" aria-label="Clinic Home">
            <svg className="h-10 w-10 text-accent-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span>Admin Dashboard</span>
          </Link>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">Sign in to your account</h1>
          <p className="mt-2 text-slate-600">Enter your credentials to access the dashboard</p>
        </div>

        <div className="card bg-white border-slate-200 p-8 shadow-lg animate-fade-in-up delay-100">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md animate-shake" role="alert">
                {error}
              </div>
            )}

            <div className="animate-fade-in-up delay-200">
              <label htmlFor="email" className="label text-slate-700">
                Email address
              </label>
              <div className="relative mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "input w-full px-4 py-3",
                    "bg-white border-2 border-slate-300 text-slate-900 placeholder-slate-400",
                    "focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    error && "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                  )}
                  placeholder="you@clinic.com"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="animate-fade-in-up delay-300">
              <label htmlFor="password" className="label text-slate-700">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "input w-full px-4 py-3",
                    "bg-white border-2 border-slate-300 text-slate-900 placeholder-slate-400",
                    "focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    error && "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                  )}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-3 text-lg animate-fade-in-up delay-400"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 animate-fade-in-up delay-500">
            <Link href="/" className="text-accent-600 hover:text-accent-700 underline">
              ← Back to clinic website
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  return (
    <ClientOnly fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card bg-white border-slate-200 p-8 shadow-lg animate-pulse">
            <div className="space-y-6">
              <div className="h-6 bg-slate-200 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
              <div className="h-4 bg-slate-200 rounded w-full"></div>
              <div className="h-4 bg-slate-200 rounded w-full"></div>
              <div className="h-4 bg-slate-200 rounded w-full"></div>
              <div className="h-10 bg-slate-200 rounded w-full"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <LoginFormContent />
    </ClientOnly>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-pulse text-slate-400">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}