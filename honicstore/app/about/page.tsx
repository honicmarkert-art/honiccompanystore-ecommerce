import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, MessageCircle, ShieldCheck, Smartphone, Store, Truck, Sparkles } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { getCategoryTree } from '@/lib/home-data'
import { whatsappLink } from '@/lib/contact'
import { getClientShippingPricing } from '@/lib/shipping-calculator'

/**
 * About Honic. Only facts the store can stand behind: live catalogue numbers, real payment
 * and delivery options. (The old page showed made-up stats: 10,000+ customers, 99.9% uptime,
 * a mobile app launch, "global reach".) Contact details live in the shared footer.
 */
export const metadata: Metadata = {
  title: 'About us | Honic Company Store',
  description: "Honic is Tanzania's online marketplace: the official Honic store and trusted sellers in one place, with mobile money payments and delivery across the country.",
  alternates: { canonical: '/about' },
}

export const revalidate = 3600

export default async function AboutPage() {
  const tree = await getCategoryTree().catch(() => [])
  const products = tree.reduce((n, c) => n + c.count, 0)
  const departments = tree.length
  const open = tree.filter((c) => c.count > 0).length
  const { freeThresholdTz } = getClientShippingPricing()

  const facts = [
    { value: products ? `${products}+` : '—', label: 'products listed' },
    { value: departments ? String(departments) : '—', label: 'departments' },
    { value: open ? String(open) : '—', label: 'departments open now' },
    { value: 'TZ', label: 'delivery across Tanzania' },
  ]

  const promises = [
    { icon: Store, title: 'Official store + trusted sellers', text: 'Honic sells most electronic components itself. Other verified sellers list their products too, so you find more in one place.' },
    { icon: Smartphone, title: 'Pay with mobile money', text: 'Check out with M-Pesa, Airtel Money, Mixx by Yas or HaloPesa. No card needed.' },
    { icon: Truck, title: 'Delivered to your door', text: `We deliver across Tanzania and you can track every order. Orders over TSh ${freeThresholdTz.toLocaleString('en-US')} ship free.` },
    { icon: ShieldCheck, title: 'Buyer protection', text: 'Wrong or faulty item? Tell us and we will make it right.' },
    { icon: Sparkles, title: 'Smart search', text: 'Search by name, by photo, or describe what you need in English or Swahili and let AI find it.' },
    { icon: MessageCircle, title: 'Real people to help', text: 'Ask us anything on WhatsApp, by email or through your account messages.' },
  ]

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />

      <main>
        {/* hero */}
        <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,#ffedd5_0%,#ffffff_60%)] dark:bg-none">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">About Honic</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
              Everything you need, from people you can trust.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
              Honic is Tanzania&apos;s online marketplace. Our official store sells electronic components, kits and tools,
              and trusted sellers are joining with more departments. You pay with mobile money and we deliver across the country.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600">
                Start shopping <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/become-supplier" className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold ring-1 ring-neutral-300 hover:ring-orange-500 dark:ring-neutral-700">
                Sell on Honic
              </Link>
            </div>

            <dl className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facts.map((f) => (
                <div key={f.label} className="rounded-2xl bg-white/80 p-4 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
                  <dt className="sr-only">{f.label}</dt>
                  <dd className="text-2xl font-black tracking-tight">{f.value}</dd>
                  <dd className="text-sm text-neutral-500">{f.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* story */}
        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Why we built Honic</h2>
            <div className="space-y-4 text-neutral-600 dark:text-neutral-300">
              <p>
                Finding the right part, tool or gadget in Tanzania often means visiting many shops, asking around, and still not
                being sure about the price or quality. We started Honic Company Limited to make that simple: one place to search,
                clear prices in shillings, and delivery to your door.
              </p>
              <p>
                We began with electronic components for students, makers and engineers, which is still what our own store does best.
                Now we are opening Honic to other sellers, so you can buy for home, school and work in the same place, with the same
                checkout and the same protection.
              </p>
            </div>
          </div>
        </section>

        {/* promises */}
        <section className="bg-stone-50 py-14 dark:bg-neutral-900/50">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">What you can expect</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {promises.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl bg-white p-5 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40"><Icon className="h-5 w-5" /></span>
                  <h3 className="mt-4 font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* sellers + help */}
        <section className="mx-auto grid max-w-5xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-2">
          <div className="rounded-3xl bg-neutral-950 p-7 text-white">
            <BadgeCheck className="h-7 w-7 text-orange-400" />
            <h2 className="mt-4 text-2xl font-black tracking-tight">Have products to sell?</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">Open your shop on Honic. We handle checkout and mobile money payments; you list your products and ship.</p>
            <Link href="/become-supplier" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold hover:bg-orange-600">
              Become a seller <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-3xl bg-orange-50 p-7 dark:bg-orange-950/30">
            <MessageCircle className="h-7 w-7 text-orange-600" />
            <h2 className="mt-4 text-2xl font-black tracking-tight">Questions? Talk to us.</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">We reply on WhatsApp during business hours. You can also write to us from the contact page.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={whatsappLink('Hello Honic, I have a question')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800">
                Chat on WhatsApp
              </a>
              <Link href="/contact" className="inline-flex items-center rounded-xl px-5 py-3 text-sm font-bold ring-1 ring-neutral-300 hover:ring-orange-500 dark:ring-neutral-700">
                Contact page
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
