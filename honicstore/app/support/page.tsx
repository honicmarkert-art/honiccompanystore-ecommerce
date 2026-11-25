import Link from 'next/link'
import { ArrowRight, HelpCircle, Mail, MessageCircle, PackageSearch, RotateCcw, Truck, Wrench } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { getFaqs } from '@/lib/help-faqs'
import { STORE_WHATSAPP, phoneLabel, whatsappLink } from '@/lib/contact'

/** Help centre hub: the main topics, popular questions, and how to reach us. Title from ./layout.tsx */
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@honiccompanystore.com'

const TOPICS = [
  { href: '/support/order-tracking', icon: PackageSearch, title: 'Track an order', text: 'Where is my order? Check its status.' },
  { href: '/support/shipping-info', icon: Truck, title: 'Delivery & shipping', text: 'Prices, times and free delivery.' },
  { href: '/support/returns-refunds', icon: RotateCcw, title: 'Returns & refunds', text: 'Wrong or faulty item? We fix it.' },
  { href: '/support/help-center', icon: HelpCircle, title: 'Questions & answers', text: 'Payments, account and more.' },
  { href: '/support/technical-support', icon: Wrench, title: 'Website help', text: 'Quick fixes if something doesn’t work.' },
]

export default function SupportPage() {
  const popular = getFaqs().filter((f) => f.popular).slice(0, 6)
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Help centre</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">How can we help?</h1>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map(({ href, icon: Icon, title, text }) => (
            <Link key={href} href={href} className="group flex items-start gap-4 rounded-2xl p-5 ring-1 ring-neutral-200 transition hover:ring-orange-400 dark:ring-neutral-800">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-bold">{title}<ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" /></span>
                <span className="mt-0.5 block text-sm text-neutral-500">{text}</span>
              </span>
            </Link>
          ))}
          <a href={whatsappLink('Hello Honic, I need help')} target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 rounded-2xl bg-neutral-950 p-5 text-white transition hover:bg-neutral-800">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-500"><MessageCircle className="h-5 w-5" /></span>
            <span>
              <span className="block font-bold">Chat on WhatsApp</span>
              <span className="mt-0.5 block text-sm text-neutral-300">{phoneLabel(STORE_WHATSAPP)} · business hours</span>
            </span>
          </a>
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-black tracking-tight">Popular questions</h2>
          <div className="mt-4 divide-y divide-neutral-200 rounded-2xl ring-1 ring-neutral-200 dark:divide-neutral-800 dark:ring-neutral-800">
            {popular.map((f) => (
              <details key={f.id} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="flex items-center justify-between gap-4">{f.question}<span aria-hidden className="text-lg text-orange-600 transition group-open:rotate-45">+</span></span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{f.answer}</p>
                {f.link && <Link href={f.link.href} className="mt-1 inline-flex items-center gap-1 py-1.5 text-sm font-semibold text-orange-600 hover:underline">{f.link.label} <ArrowRight className="h-4 w-4" /></Link>}
              </details>
            ))}
          </div>
          <Link href="/support/help-center" className="mt-1 inline-flex items-center gap-1 py-2 text-sm font-semibold text-orange-600 hover:underline">All questions <ArrowRight className="h-4 w-4" /></Link>
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-2">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-3 rounded-2xl p-5 ring-1 ring-neutral-200 hover:ring-orange-400 dark:ring-neutral-800">
            <Mail className="h-5 w-5 text-orange-600" />
            <span><span className="block font-bold">Email us</span><span className="text-sm text-neutral-500">{SUPPORT_EMAIL}</span></span>
          </a>
          <Link href="/contact" className="flex items-center gap-3 rounded-2xl p-5 ring-1 ring-neutral-200 hover:ring-orange-400 dark:ring-neutral-800">
            <HelpCircle className="h-5 w-5 text-orange-600" />
            <span><span className="block font-bold">Contact form</span><span className="text-sm text-neutral-500">Write to us from the website</span></span>
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
