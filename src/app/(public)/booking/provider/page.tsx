import { getServiceByCode } from "@/lib/services";
import { getProviderById, getProvidersForService } from "@/lib/providers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Props {
  searchParams: Promise<{ service?: string }>;
}

export default async function BookingProviderPage({ searchParams }: Props) {
  const { service: serviceCode } = await searchParams;

  if (!serviceCode) {
    notFound();
  }

  const service = await getServiceByCode(serviceCode);

  if (!service) {
    notFound();
  }

  const providers = await getProvidersForService(service.id);

  if (providers.length === 0) {
    notFound();
  }

  if (providers.length === 1) {
    return (
      <meta httpEquiv="refresh" content={`0;url=/booking/calendar?service=${serviceCode}&provider=${providers[0].id}`} />
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="container py-12 md:py-20">
        <header className="max-w-3xl mx-auto text-center mb-12">
          <nav className="mb-8" aria-label="Booking progress">
            <ol className="flex items-center justify-center gap-4" role="list">
              <li className="flex items-center gap-2">
                <Link href={`/booking?service=${serviceCode}`} className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-500 text-sm font-semibold flex items-center justify-center hover:border-slate-400 hover:text-slate-700 transition-colors" aria-label="Back to service selection">
                  1
                </Link>
                <span className="hidden sm:block text-sm text-slate-500">Service</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-accent-600 text-white text-sm font-semibold flex items-center justify-center" aria-current="step">2</span>
                <span className="hidden sm:block font-medium text-slate-900">Provider</span>
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

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-2">
            Choose Your Practitioner
          </h1>
          <p className="text-lg text-slate-600">
            {service.name} — select the practitioner you'd prefer
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto" role="list">
          {providers.map((provider) => (
            <article key={provider.id} className="card p-6 flex flex-col h-full transition-shadow hover:shadow-lg border-2 border-transparent hover:border-accent-200" role="listitem">
              <div className="flex items-start gap-4 mb-4">
                <div className="relative w-16 h-16 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {provider.photoUrl ? (
                    <Image src={provider.photoUrl} alt={`${provider.name} portrait`} fill sizes="64px" className="object-cover" loading="lazy" />
                  ) : (
                    <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-slate-900">{provider.name}</h2>
                  <p className="text-sm text-slate-600">{provider.title}</p>
                </div>
              </div>

              {provider.qualifications && provider.qualifications.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1">
                  {provider.qualifications.map((q) => (
                    <span key={q} className="px-2 py-1 text-xs bg-slate-50 text-slate-600 rounded-full">
                      {q}
                    </span>
                  ))}
                </div>
              )}

              {provider.bio && (
                <p className="text-sm text-slate-600 mb-4 line-clamp-3">{provider.bio}</p>
              )}

              <Link
                href={`/booking/calendar?service=${serviceCode}&provider=${provider.id}`}
                className="btn btn-primary w-full mt-auto"
                aria-label={`Select ${provider.name} for ${service.name}`}
              >
                Select {provider.name}
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href={`/booking?service=${serviceCode}`} className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2">
            ← Back to treatments
          </Link>
        </div>
      </div>
    </main>
  );
}