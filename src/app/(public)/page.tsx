import { getServices } from "@/lib/services";
import Link from "next/link";
import { formatPrice, formatDuration } from "@/lib/utils";

export const revalidate = 60;

export default async function LandingPage() {
  let services: Awaited<ReturnType<typeof getServices>> = [];
  let dbError = false;
  try {
    services = await getServices();
  } catch (error) {
    console.error("[LandingPage] Failed to load services:", error);
    dbError = true;
    services = [];
  }

  return (
    <>
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 lg:py-40 overflow-hidden" aria-labelledby="hero-heading">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-50 text-accent-700 text-sm font-medium mb-6">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Book appointments online 24/7 • No account needed • Instant confirmation
            </span>
            
            <h1 id="hero-heading" className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.1]">
              Expert Aesthetic Treatments in <span className="text-accent-600">London</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Anti-wrinkle injections, dermal fillers, Profhilo, and consultations. 
              Delivered by qualified medical professionals. Safe, natural results.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="#booking" className="btn btn-primary text-lg px-8 py-4 w-full sm:w-auto">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Book Your Appointment
              </Link>
              <Link href="#services" className="btn btn-outline text-lg px-8 py-4 w-full sm:w-auto">
                View Treatments
              </Link>
            </div>
            
            {/* Trust Signals */}
            <div className="mt-16 grid grid-cols-3 gap-8 text-center" role="list" aria-label="Trust signals">
              <div className="p-4" role="listitem">
                <div className="text-3xl md:text-4xl font-bold text-accent-600 mb-1">15+</div>
                <div className="text-sm text-slate-600">Years Experience</div>
              </div>
              <div className="p-4" role="listitem">
                <div className="text-3xl md:text-4xl font-bold text-accent-600 mb-1">5,000+</div>
                <div className="text-sm text-slate-600">Treatments Performed</div>
              </div>
              <div className="p-4" role="listitem">
                <div className="text-3xl md:text-4xl font-bold text-accent-600 mb-1">4.9/5</div>
                <div className="text-sm text-slate-600">Patient Rating</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 md:py-32 bg-white" aria-labelledby="services-heading">
        <div className="container">
          <header className="text-center max-w-2xl mx-auto mb-16">
            <h2 id="services-heading" className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">
              Our Treatments
            </h2>
            <p className="text-lg text-slate-600">
              All treatments performed by qualified medical professionals. 
              Consultation fee redeemable against treatment booked on the day.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4" role="list">
            {dbError && (
              <div className="md:col-span-2 lg:col-span-4 p-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md" role="alert">
                Our treatment list is temporarily unavailable. Please call us or try again shortly — online booking below remains open.
              </div>
            )}
            {services.length === 0 && !dbError && (
              <p className="md:col-span-2 lg:col-span-4 text-center text-slate-500">
                No treatments available right now. Please check back soon.
              </p>
            )}
            {services.map((service) => (
              <article key={service.id} className="card p-6 flex flex-col h-full transition-shadow hover:shadow-lg" role="listitem">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{service.name}</h3>
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

                {/* Provider info */}
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
                  href={`/booking?service=${service.code}`} 
                  className="btn btn-primary w-full mt-auto"
                  aria-label={`Book ${service.name}`}
                >
                  Select
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Booking Flow Entry */}
      <section id="booking" className="py-20 md:py-32 bg-slate-50" aria-labelledby="booking-heading">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 id="booking-heading" className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">
              Ready to Book?
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              Select a treatment above, or start booking directly. 
              Takes less than 2 minutes. No account required.
            </p>
            <Link href="/booking" className="btn btn-primary text-lg px-8 py-4">
              Start Booking
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-16 bg-white border-y border-slate-200" aria-labelledby="trust-heading">
        <div className="container">
          <div className="flex flex-wrap items-center justify-center gap-8 text-center md:gap-12">
            <div className="flex items-center gap-3 p-4">
              <svg className="h-8 w-8 text-accent-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <div className="text-left">
                <p className="font-semibold text-slate-900">Medical Professionals</p>
                <p className="text-sm text-slate-500">GMC registered doctors only</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4">
              <svg className="h-8 w-8 text-accent-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-left">
                <p className="font-semibold text-slate-900">Transparent Pricing</p>
                <p className="text-sm text-slate-500">No hidden fees or upsells</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4">
              <svg className="h-8 w-8 text-accent-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
              <div className="text-left">
                <p className="font-semibold text-slate-900">CQC Registered</p>
                <p className="text-sm text-slate-500">Fully regulated clinic</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4">
              <svg className="h-8 w-8 text-accent-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <div className="text-left">
                <p className="font-semibold text-slate-900">Free Cancellation</p>
                <p className="text-sm text-slate-500">48 business hours notice</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-slate-900 text-white" aria-labelledby="cta-heading">
        <div className="container text-center">
          <h2 id="cta-heading" className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Have Questions?
          </h2>
          <p className="text-lg text-slate-300 mb-8 max-w-xl mx-auto">
            Our team is here to help. Call us, email us, or book a consultation to discuss your goals.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="tel:+442071234567" className="btn btn-primary text-lg px-8 py-4 w-full sm:w-auto">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Call Us: +44 20 7123 4567
            </a>
            <a href="mailto:bookings@londonaesthetic.co.uk" className="btn btn-primary text-lg px-8 py-4 w-full sm:w-auto">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Email Us
            </a>
          </div>
        </div>
      </section>
    </>
  );
}