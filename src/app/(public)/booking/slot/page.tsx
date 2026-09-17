import { getServiceByCode } from "@/lib/services";
import { getProviderById } from "@/lib/providers";
import { computeSlots } from "@/lib/availability";
import { fmtLondon, fmtLondonDay } from "@/lib/london";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Props {
  searchParams: Promise<{ service?: string; provider?: string; date?: string }>;
}

export default async function BookingSlotPage({ searchParams }: Props) {
  const { service: serviceCode, provider: providerId, date: dateParam } = await searchParams;

  if (!serviceCode || !providerId || !dateParam) {
    notFound();
  }

  const service = await getServiceByCode(serviceCode);
  const provider = await getProviderById(providerId);

  if (!service || !provider) {
    notFound();
  }

  // dateParam is a London calendar day ("yyyy-MM-dd") from the calendar link.
  // Never parseISO()/new Date() it directly: those build a server-local
  // midnight, and east of the UK (e.g. PKT, UTC+5) that instant is still
  // "yesterday" in London — Sep-30 clicks rendered Sep-29's header + slots,
  // and Oct-1 resolved to Sep-30 (hitting Sep-30's block). Noon UTC is always
  // the same civil date in London (00:00 winter / 01:00 summer), so anchor on
  // that and display the day string verbatim.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    notFound();
  }
  const selectedDate = new Date(`${dateParam}T12:00:00.000Z`);
  const slots = await computeSlots(providerId, service.id, selectedDate);
  const availableSlots = slots.filter((s) => s.available);

  return (
    <main className="min-h-screen bg-white">
      <div className="container py-8 md:py-16">
        <header className="max-w-2xl mx-auto text-center mb-8">
          <nav className="mb-6" aria-label="Booking progress">
            <ol className="flex items-center justify-center gap-4" role="list">
              <li className="flex items-center gap-2">
                <Link href={`/booking?service=${serviceCode}`} className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-500 text-sm font-semibold flex items-center justify-center hover:border-slate-400 hover:text-slate-700 transition-colors" aria-label="Back to service selection">
                  1
                </Link>
                <span className="hidden sm:block text-sm text-slate-500">Service</span>
              </li>
              <li className="flex items-center gap-2">
                <Link href={`/booking/provider?service=${serviceCode}`} className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-500 text-sm font-semibold flex items-center justify-center hover:border-slate-400 hover:text-slate-700 transition-colors" aria-label="Back to provider selection">
                  2
                </Link>
                <span className="hidden sm:block text-sm text-slate-500">Provider</span>
              </li>
              <li className="flex items-center gap-2">
                <Link href={`/booking/calendar?service=${serviceCode}&provider=${providerId}&date=${dateParam}`} className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-500 text-sm font-semibold flex items-center justify-center hover:border-slate-400 hover:text-slate-700 transition-colors" aria-label="Back to calendar">
                  3
                </Link>
                <span className="hidden sm:block text-sm text-slate-500">Calendar</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-accent-600 text-white text-sm font-semibold flex items-center justify-center" aria-current="step">4</span>
                <span className="hidden sm:block font-medium text-slate-900">Confirm</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <span className="w-8 h-8 rounded-full border-2 border-slate-300 text-slate-400 text-sm font-semibold flex items-center justify-center">5</span>
                <span className="hidden sm:block text-sm text-slate-500">Details</span>
              </li>
            </ol>
          </nav>

          <div className="text-left mb-4">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Choose a Time
            </h1>
            <p className="text-lg text-slate-600 mt-1">
              {service.name} · {provider.name} · {fmtLondonDay(dateParam)}
            </p>
          </div>
        </header>

        <div className="max-w-2xl mx-auto">
          <div className="card p-6">
            {availableSlots.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <h2 className="mt-4 text-lg font-medium text-slate-900">No available slots</h2>
                <p className="mt-2 text-slate-600">All slots for this date are booked. Please choose another date.</p>
                <div className="mt-6">
                  <Link href={`/booking/calendar?service=${serviceCode}&provider=${providerId}&date=${dateParam}`} className="btn btn-outline">
                    ← Choose Another Date
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Available time slots">
                  {availableSlots.map((slot) => (
                    <Link
                      key={`${slot.start.toISOString()}`}
                      href={`/booking/form?service=${serviceCode}&provider=${providerId}&date=${dateParam}&slot=${fmtLondon(slot.start, "HH:mm")}`}
                      className="card p-4 flex items-center justify-between hover:shadow-md hover:border-accent-200 border-2 border-transparent transition-all" role="listitem"
                    >
                      <div className="text-left">
                        <p className="text-xl font-semibold text-slate-900">{fmtLondon(slot.start, "HH:mm")}</p>
                        <p className="text-sm text-slate-500">-{fmtLondon(slot.end, "HH:mm")} · {service.durationMin} min</p>
                      </div>
                      <svg className="h-6 w-6 text-accent-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </Link>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100">
                  <Link href={`/booking/calendar?service=${serviceCode}&provider=${providerId}&date=${dateParam}`} className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2 flex items-center gap-1">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Change date
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href={`/booking/calendar?service=${serviceCode}&provider=${providerId}&date=${dateParam}`} className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2">
            ← Back to calendar
          </Link>
        </div>
      </div>
    </main>
  );
}