import { getServices } from "@/lib/services";
import Link from "next/link";
import { formatPrice, formatDuration } from "@/lib/utils";

export const revalidate = 60;

export default async function BookingServicePage() {
  const services = await getServices();

  return (
    <main className="min-h-screen bg-white">
      <div className="container py-12 md:py-20">
        <header className="max-w-3xl mx-auto text-center mb-12">
          <nav className="mb-8" aria-label="Booking progress">
            <ol className="flex items-center justify-center gap-4" role="list">
              <li className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-accent-600 text-white text-sm font-semibold flex items-center justify-center" aria-current="step">1</span>
                <span className="hidden sm:block font-medium text-slate-900">Service</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <span className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-400 text-sm font-semibold flex items-center justify-center">2</span>
                <span className="hidden sm:block text-sm text-slate-500">Provider</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <span className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-400 text-sm font-semibold flex items-center justify-center">3</span>
                <span className="hidden sm:block text-sm text-slate-500">Calendar</span>
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

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">
            Choose Your Treatment
          </h1>
          <p className="text-lg text-slate-600">
            Select the treatment you&apos;d like to book. All treatments are performed by qualified medical professionals.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto" role="list">
          {services.map((service) => (
            <article key={service.id} className="card p-6 flex flex-col h-full transition-shadow hover:shadow-lg" role="listitem">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">{service.name}</h2>
                <p className="text-sm text-slate-600 line-clamp-3">{service.description}</p>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500 mb-4" role="list" aria-label={`${service.name} details`}>
                <li className="flex items-center gap-1">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {formatDuration(service.durationMin)}
                </li>
                <li className="font-semibold text-slate-900">{formatPrice(service.price)}</li>
              </div>

              {service.providers.length > 0 && (
                <div className="mb-4 pt-4 border-t border-slate-100" role="list" aria-label="Available practitioners">
                  <p className="text-xs text-slate-500 mb-2">Available with:</p>
                  <div className="flex flex-wrap gap-2">
                    {service.providers.map((provider) => (
                      <span key={provider.id} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-50 text-slate-600 rounded-full">
                        {provider.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Link
                href={`/booking/provider?service=${service.code}`}
                className="btn btn-primary w-full mt-auto"
                aria-label={`Book ${service.name}`}
              >
                Select
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}