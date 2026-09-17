import Link from "next/link";
import { cn } from "@/lib/utils";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      <header className="sticky top-0 z-[200] w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold text-xl text-slate-900" aria-label="London Aesthetic Clinic - Home">
              <svg className="h-8 w-8 text-accent-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>London Aesthetic Clinic</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
              <Link href="#services" className="text-sm font-medium text-slate-600 hover:text-accent-600 transition-colors">
                Treatments
              </Link>
              <Link href="#booking" className="btn btn-primary text-sm">
                Book Appointment
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1" role="main">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-slate-50" role="contentinfo">
        <div className="container py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="font-semibold text-lg text-slate-900 mb-4">London Aesthetic Clinic</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Expert aesthetic treatments delivered by qualified medical professionals. 
                Your safety and natural-looking results are our priority.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Contact</h4>
              <address className="not-italic text-slate-600 text-sm leading-relaxed">
                <p>123 Harley Street</p>
                <p>London W1G 6AD</p>
                <p className="mt-2">
                  <a href="tel:+442071234567" className="hover:text-accent-600 transition-colors">+44 20 7123 4567</a>
                </p>
                <p>
                  <a href="mailto:bookings@londonaesthetic.co.uk" className="text-slate-700 hover:text-accent-600 transition-colors underline underline-offset-2">bookings@londonaesthetic.co.uk</a>
                </p>
              </address>
            </div>
            
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Quick Links</h4>
              <nav aria-label="Footer navigation">
                <ul className="space-y-2 text-sm">
                  <li><Link href="#services" className="text-slate-600 hover:text-accent-600 transition-colors">Our Treatments</Link></li>
                  <li><Link href="#booking" className="text-slate-600 hover:text-accent-600 transition-colors">Book Appointment</Link></li>
                  <li><a href="#" className="text-slate-600 hover:text-accent-600 transition-colors">Cancellation Policy</a></li>
                  <li><a href="#" className="text-slate-600 hover:text-accent-600 transition-colors">Privacy Policy</a></li>
                </ul>
              </nav>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-slate-200 text-center text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} London Aesthetic Clinic. All rights reserved.</p>
            <p className="mt-1">Registered in England & Wales | CQC Registered</p>
          </div>
        </div>
      </footer>
    </>
  );
}