"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const navigation = [
  { name: "Calendar", href: "/dashboard" },
  { name: "Staff", href: "/dashboard/providers" },
  { name: "Availability", href: "/dashboard/availability" },
  { name: "Services", href: "/dashboard/services" },
  { name: "Holidays", href: "/dashboard/holidays" },
  { name: "Waitlist", href: "/dashboard/waitlist" },
  { name: "Settings", href: "/dashboard/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Single admin account per spec (no multi-staff): show the logged-in
  // admin email, falling back to "Admin".
  const { data: session } = useSession();

  // Login page must not show dashboard chrome (header/sign-out).
  // It lives in the same route group, so render it bare.
  const isLoginPage = pathname === "/login";

  const handleSignOut = async () => {
    // next-auth client sign-out clears the JWT cookie (with CSRF handling)
    // then hard-navigate to /login so middleware sees the logged-out state.
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  };

  // Calm motion only: when the OS asks for reduced motion, skip Lenis
  // smoothing entirely and snap content in with no animation (spec D10).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => 1 - Math.pow(1 - t, 4),
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    ScrollTrigger.getAll().forEach((t) => t.kill());

    // prefers-reduced-motion → duration 0: content appears instantly.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set("main > *", { opacity: 1, y: 0 });
      return;
    }

    // Use gsap.set to ensure initial state, then animate
    gsap.set("main > *", { opacity: 0, y: 20 });
    gsap.to("main > *", {
      opacity: 1,
      y: 0,
      duration: 1.4,
      ease: "expo.out",
      stagger: 0.08,
    });
  }, [pathname]);

  // Bare layout for /login — no header, no sign-out button
  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <main id="main-content" className="flex-1" role="main">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-xl text-slate-50" aria-label="Dashboard Home">
            <svg className="h-8 w-8 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span>Admin Dashboard</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Dashboard navigation">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  pathname === item.href
                    ? "bg-slate-800 text-slate-50"
                    : "text-slate-400 hover:text-slate-50 hover:bg-slate-800"
                )}
                aria-current={pathname === item.href ? "page" : undefined}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <span
              className="hidden sm:block text-sm text-slate-400 max-w-[220px] truncate"
              title="Single admin account — multi-staff logins are out of scope"
            >
              {session?.user?.email ?? "Admin"}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="btn btn-primary btn-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1" role="main">
        {children}
      </main>
    </div>
  );
}