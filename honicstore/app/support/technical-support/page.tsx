import type { Metadata } from 'next'
import Link from 'next/link'
import { Globe, Mail, MessageCircle, RefreshCw, Smartphone, Wifi, CreditCard, KeyRound } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { whatsappLink } from '@/lib/contact'

/**
 * Technical help: quick fixes + how to reach us. (The old page listed made-up "known issues",
 * e.g. "Payment processing error: open" and a mobile app that does not exist, plus buttons
 * that did nothing.)
 */
export const metadata: Metadata = {
  title: 'Technical help | Honic Company Store',
  description: 'Quick fixes for common website problems, and how to reach the Honic team.',
  alternates: { canonical: '/support/technical-support' },
}

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@honiccompanystore.com'

const FIXES = [
  { icon: Wifi, title: 'Page not loading?', text: 'Check your internet connection, then refresh the page. On mobile data, try switching to Wi-Fi or the other way round.' },
  { icon: RefreshCw, title: 'Something looks wrong?', text: 'Clear your browser cache and cookies, or open the site in a private window. Browser extensions (ad blockers) can also break pages.' },
  { icon: Globe, title: 'Still stuck?', text: 'Try another browser (Chrome, Safari, Firefox) and make sure it is up to date.' },
  { icon: KeyRound, title: 'Can’t sign in?', text: 'Use “Forgot password” on the sign-in page. If you signed up with Google, use “Continue with Google”. Check your spam folder for our emails.' },
  { icon: CreditCard, title: 'Payment didn’t go through?', text: 'Keep your phone unlocked and approve the mobile money prompt as soon as it appears. If money left your account but the order shows unpaid, message us with your order number. Do not pay twice.' },
  { icon: Smartphone, title: 'Using a phone?', text: 'The website works in your phone browser. Add it to your home screen from the browser menu for one-tap access.' },
]

export default function TechnicalSupportPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
          <Link href="/support" className="hover:text-orange-600">Help centre</Link> <span aria-hidden>/</span> Technical help
        </nav>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Technical help</h1>
        <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-300">Most problems are fixed in a minute with one of these. If not, message us and we will sort it out.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIXES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl p-5 ring-1 ring-neutral-200 dark:ring-neutral-800">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40"><Icon className="h-5 w-5" /></span>
              <h2 className="mt-4 font-bold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-neutral-500">{text}</p>
            </div>
          ))}
        </div>

        <section className="mt-10 rounded-3xl bg-orange-50 p-7 dark:bg-orange-950/30">
          <h2 className="text-2xl font-black tracking-tight">Still need help?</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Tell us what you were doing and what you saw. A screenshot helps. We reply during business hours.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={whatsappLink('Hello Honic, I have a problem with the website:')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800">
              <MessageCircle className="h-4 w-4" /> WhatsApp us
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Website problem')}`} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold ring-1 ring-neutral-300 hover:ring-orange-500 dark:ring-neutral-700">
              <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
