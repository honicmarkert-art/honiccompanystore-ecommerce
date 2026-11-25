'use client'

import Link from 'next/link'
import { Mail, MapPin, MessageCircle, ShieldCheck, Smartphone, Truck } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { usePublicCompanyContext } from '@/contexts/public-company-context'
import { STORE_ADDRESS, STORE_WHATSAPP, phoneLabel, whatsappLink } from '@/lib/contact'

/** One footer for the whole store. Only links to pages that exist. */
const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Shop',
    links: [
      ['/products', 'Marketplace'],
      ['/categories', 'All categories'],
      ['/products?mode=ai', 'AI project helper'],
      ['/products?sort=newest', 'New arrivals'],
      ['/services/stem-kits', 'STEM training kits'],
    ],
  },
  {
    title: 'Help',
    links: [
      ['/support/order-tracking', 'Track your order'],
      ['/support/shipping-info', 'Delivery & shipping'],
      ['/support/returns-refunds', 'Returns & refunds'],
      ['/support/technical-support', 'Technical support'],
      ['/support', 'Help centre'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['/about', 'About us'],
      ['/contact', 'Contact'],
      ['/become-supplier', 'Sell on Honic'],
      ['/account', 'My account'],
    ],
  },
]

const NETWORKS = [
  ['/payments/mpesa.svg', 'M-Pesa'],
  ['/payments/airtel.svg', 'Airtel Money'],
  ['/payments/yas.svg', 'Mixx by Yas'],
  ['/payments/halotel.png', 'HaloPesa'],
] as const


export function SiteFooter() {
  const { companyName, contactEmail } = usePublicCompanyContext()
  const name = (companyName || 'Honic Company Limited').trim()
  const email = contactEmail || 'contact@honiccompanystore.com'

  return (
    <footer className="mt-16 border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      {/* promises */}
      <div className="border-b border-neutral-100 dark:border-neutral-900">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 sm:px-6 lg:grid-cols-4">
          {[
            { icon: Truck, title: 'Delivery across Tanzania', text: 'Dar es Salaam in 1–2 days' },
            { icon: Smartphone, title: 'Pay with mobile money', text: 'M-Pesa, Airtel, Mixx, HaloPesa' },
            { icon: ShieldCheck, title: 'Official store + trusted sellers', text: 'Wrong or faulty item? We fix it' },
            { icon: MessageCircle, title: 'Help on WhatsApp', text: phoneLabel(STORE_WHATSAPP) },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-950/40">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-neutral-900 dark:text-white">{title}</p>
                <p className="truncate text-xs text-neutral-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* newsletter: double opt-in */}
      <div id="newsletter" className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto grid max-w-7xl items-center gap-4 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:gap-10">
          <div>
            <h2 className="text-lg font-black tracking-tight">Get offers before everyone else</h2>
            <p className="mt-1 text-sm text-neutral-500">Coupons, deals and new arrivals from Honic and trusted sellers.</p>
          </div>
          <NewsletterSignup />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.3fr_2fr]">
        <div className="max-w-sm">
          <BrandLogo size="lg" />
          <p className="mt-4 text-sm leading-relaxed text-neutral-500">
            Tanzania&apos;s online marketplace: the official Honic store and trusted sellers, with mobile money payments and delivery across the country.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-orange-500" />{STORE_ADDRESS}</li>
            <li><a href={`mailto:${email}`} className="-my-1.5 flex items-center gap-2 py-1.5 hover:text-orange-600"><Mail className="h-4 w-4 shrink-0 text-orange-500" />{email}</a></li>
            <li><a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="-my-1.5 flex items-center gap-2 py-1.5 hover:text-orange-600"><MessageCircle className="h-4 w-4 shrink-0 text-orange-500" />WhatsApp {phoneLabel(STORE_WHATSAPP)}</a></li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{col.title}</p>
              <ul className="mt-3 space-y-2.5">
                {col.links.map(([href, label]) => (
                  <li key={href}><Link href={href} className="-my-1.5 inline-block py-1.5 text-sm text-neutral-700 hover:text-orange-600 dark:text-neutral-300">{label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-neutral-100 dark:border-neutral-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-5 text-xs text-neutral-500 sm:px-6 md:flex-row">
          <p>© {new Date().getFullYear()} {name}. All rights reserved.</p>
          <div className="flex items-center gap-2" aria-label="Accepted payments">
            {NETWORKS.map(([src, label]) => (
              <span key={label} title={label} className="grid h-7 w-11 place-items-center rounded-md bg-white p-1 ring-1 ring-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={label} className="h-full w-full object-contain" loading="lazy" />
              </span>
            ))}
          </div>
          <nav className="flex gap-4" aria-label="Legal">
            <Link href="/privacy" className="-my-2 inline-block py-2 hover:text-orange-600">Privacy</Link>
            <Link href="/terms" className="-my-2 inline-block py-2 hover:text-orange-600">Terms</Link>
            <Link href="/cookies" className="-my-2 inline-block py-2 hover:text-orange-600">Cookies</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
