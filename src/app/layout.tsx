import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "London Aesthetic Clinic | Book Your Appointment",
  description: "Expert aesthetic treatments in London. Anti-wrinkle injections, dermal fillers, Profhilo, and consultations. Book online in minutes.",
  keywords: ["aesthetic clinic", "botox", "dermal fillers", "profhilo", "london", "book appointment"],
  authors: [{ name: "London Aesthetic Clinic" }],
  openGraph: {
    title: "London Aesthetic Clinic | Book Your Appointment",
    description: "Expert aesthetic treatments in London. Book online in minutes.",
    type: "website",
    locale: "en_GB",
    siteName: "London Aesthetic Clinic",
  },
  twitter: {
    card: "summary_large_image",
    title: "London Aesthetic Clinic",
    description: "Expert aesthetic treatments in London. Book online in minutes.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${inter.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-white text-slate-900">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}