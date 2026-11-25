import type { Metadata } from 'next'
import Link from 'next/link'
import { Gift, MapPin, MessageCircle, PackageCheck, Store, Truck } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { STORE_ADDRESS, whatsappLink } from '@/lib/contact'
import { freeDeliveryThreshold } from '@/lib/shipping-pricing'
import { DAR_DELIVERY_ATTEMPTS, RETURN_DAYS } from '@/lib/policies'
import { DAR_ES_SALAAM_ETA, DAR_ES_SALAAM_TIERS, DAR_ES_SALAAM_WARD_TIER, DELIVERY_ZONES, ISLAND_DISTRICT_SURCHARGE, OUTSIDE_TOWN_SURCHARGE, SIZE_SURCHARGE, type DarTier } from '@/lib/shipping-pricing-config'

/**
 * Delivery & shipping: generated from the same settings checkout charges with
 * (lib/shipping-pricing-config.ts + the free-delivery threshold), so the page can't drift from reality.
 * (The old page listed express/international services, insurance and "duty paid" that checkout never offered.)
 */
export const metadata: Metadata = {
  title: 'Delivery & shipping | Honic Company Store',
  description: 'Delivery fees, times and free delivery on Honic: across Tanzania, with free store pickup in Dar es Salaam.',
  alternates: { canonical: '/support/shipping-info' },
}

const tsh = (n: number) => `TSh ${n.toLocaleString('en-US')}`
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

export default function ShippingInfoPage() {
  const freeThresholdTz = freeDeliveryThreshold()
  const tiers = Object.entries(DAR_ES_SALAAM_TIERS) as [DarTier, { name: string; fee: number }][]
  const darMin = Math.min(...tiers.map(([, t]) => t.fee))
  const darMax = Math.max(...tiers.map(([, t]) => t.fee))
  /** a few example wards per tier, so shoppers can place themselves */
  const examples = (tier: DarTier) =>
    Object.entries(DAR_ES_SALAAM_WARD_TIER).filter(([, t]) => t === tier).slice(0, 4).map(([w]) => title(w)).join(', ')
  const upMin = Math.min(...DELIVERY_ZONES.map((z) => z.fee))
  const upMax = Math.max(...DELIVERY_ZONES.map((z) => z.fee))
  const regionList = (z: (typeof DELIVERY_ZONES)[number]) =>
    z.regions.filter((r) => r !== 'coast').map((r) => title(r.replace(/ (central\/south|north|south|urban\/west)$/, ''))).filter((r, i, a) => a.indexOf(r) === i).join(', ')

  const faqs = [
    { q: 'How much is delivery?', a: `It depends on where you are. In Dar es Salaam it is ${tsh(darMin)}–${tsh(darMax)} by bodaboda, depending on your ward. Other regions are ${tsh(upMin)}–${tsh(upMax)} depending on distance (we send by bus or courier to your town). Large items like 3D printers cost more to send. The exact fee for your address is shown at checkout before you pay.` },
    { q: 'When is delivery free?', a: `When the items in your order add up to ${tsh(freeThresholdTz)} or more, when every product in the order is marked "free delivery", or when you collect from our store. Large items keep a handling fee (${tsh(SIZE_SURCHARGE.large.dar)} in Dar es Salaam, ${tsh(SIZE_SURCHARGE.large.upcountry)} elsewhere).` },
    { q: 'How long does delivery take?', a: `Usually ${DAR_ES_SALAAM_ETA} in Dar es Salaam and 2–6 days to other regions depending on distance, counted from when your payment is confirmed. Checkout shows the time for your address.` },
    { q: 'Can I track my order?', a: 'Yes. Every order has a status page in your account, and you can also look it up with your order number on the order tracking page.' },
    { q: 'What if I miss the delivery?', a: `In Dar es Salaam our rider calls before coming and tries again the next working day; after ${DAR_DELIVERY_ATTEMPTS} tries the order waits at our store for pickup. Upcountry, collect your parcel quickly from the bus or courier office in your town, as they may charge for storage.` },
    { q: 'Do you deliver outside Tanzania?', a: 'Not through checkout. For an order to another country, message us on WhatsApp and we will tell you if we can arrange it and what it costs.' },
    { q: 'What if my item arrives damaged or wrong?', a: `Message us within ${RETURN_DAYS} days of delivery with your order number and a photo, and we will replace it or refund you in full, including delivery. See Returns & refunds for details.` },
  ]

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
          <Link href="/support" className="hover:text-orange-600">Help centre</Link> <span aria-hidden>/</span> Delivery & shipping
        </nav>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Delivery & shipping</h1>
        <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-300">We deliver across Tanzania. You see the exact fee for your address at checkout, before you pay.</p>

        {/* options */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl p-5 ring-1 ring-neutral-200 dark:ring-neutral-800">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40"><Truck className="h-5 w-5" /></span>
            <h2 className="mt-4 font-bold">Delivery to your door</h2>
            <p className="mt-1 text-sm text-neutral-500">Dar es Salaam {tsh(darMin)}–{tsh(darMax)} by bodaboda. Other regions {tsh(upMin)}–{tsh(upMax)} by bus or courier to your town.</p>
            <p className="mt-3 text-sm font-semibold">{DAR_ES_SALAAM_ETA} in Dar · 2–6 days elsewhere</p>
          </div>
          <div className="rounded-2xl p-5 ring-1 ring-neutral-200 dark:ring-neutral-800">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40"><Store className="h-5 w-5" /></span>
            <h2 className="mt-4 font-bold">Store pickup: free</h2>
            <p className="mt-1 text-sm text-neutral-500">Collect from {STORE_ADDRESS}. Choose &quot;Pickup&quot; at checkout.</p>
            <p className="mt-3 text-sm font-semibold">We tell you when it&apos;s ready</p>
          </div>
          <div className="rounded-2xl bg-orange-50 p-5 ring-1 ring-orange-200 dark:bg-orange-950/30 dark:ring-orange-900">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500 text-white"><Gift className="h-5 w-5" /></span>
            <h2 className="mt-4 font-bold">Free delivery over {tsh(freeThresholdTz)}</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Anywhere in Tanzania, when your items add up to {tsh(freeThresholdTz)} or more. Large items keep a handling fee.</p>
            <p className="mt-3 text-sm font-semibold">Applied automatically at checkout</p>
          </div>
        </div>

        {/* fees */}
        <section className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black tracking-tight"><MapPin className="h-5 w-5 text-orange-600" /> Dar es Salaam</h2>
            <p className="mt-1 text-sm text-neutral-500">Bodaboda to your door, {DAR_ES_SALAAM_ETA}. Your ward decides the tier; checkout shows it.</p>
            <table className="mt-4 w-full text-sm">
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {tiers.map(([tier, t]) => (
                  <tr key={tier} className="align-top">
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold">{t.name}</span>
                      <span className="block text-xs text-neutral-500">e.g. {examples(tier)}</span>
                    </td>
                    <td className="py-2.5 text-right font-bold tabular-nums">{tsh(t.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black tracking-tight"><PackageCheck className="h-5 w-5 text-orange-600" /> Other regions</h2>
            <p className="mt-1 text-sm text-neutral-500">Sent by bus or courier to your regional town. Districts outside the regional town add {tsh(OUTSIDE_TOWN_SURCHARGE)} for the onward trip; Mafia adds {tsh(ISLAND_DISTRICT_SURCHARGE.mafia)} and Ukerewe {tsh(ISLAND_DISTRICT_SURCHARGE.ukerewe)} for the boat. Checkout shows the exact fee and time for your address.</p>
            <table className="mt-4 w-full text-sm">
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {DELIVERY_ZONES.map((z) => (
                  <tr key={z.id} className="align-top">
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold">{z.name}</span>
                      <span className="block text-xs text-neutral-500">{regionList(z)}</span>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-neutral-500">{z.eta}</td>
                    <td className="py-2.5 text-right font-bold tabular-nums">{tsh(z.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* sizes */}
        <section className="mt-10">
          <h2 className="text-xl font-black tracking-tight">Bigger items</h2>
          <p className="mt-1 text-sm text-neutral-500">Prices above are for a standard parcel. Bus and courier companies charge more for big parcels, so the biggest item in your order adds:</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(['medium', 'large'] as const).map((k) => (
              <div key={k} className="rounded-2xl p-4 ring-1 ring-neutral-200 dark:ring-neutral-800">
                <p className="font-bold">{SIZE_SURCHARGE[k].label}{k === 'medium' ? ' (e.g. 1 kg filament spool)' : ' (e.g. 3D printer, water purifier)'}</p>
                <p className="mt-1 text-sm text-neutral-500">Dar es Salaam {SIZE_SURCHARGE[k].dar ? `+${tsh(SIZE_SURCHARGE[k].dar)}` : 'no extra'} · other regions +{tsh(SIZE_SURCHARGE[k].upcountry)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* faqs */}
        <section className="mt-12">
          <h2 className="text-xl font-black tracking-tight">Questions</h2>
          <div className="mt-4 divide-y divide-neutral-200 rounded-2xl ring-1 ring-neutral-200 dark:divide-neutral-800 dark:ring-neutral-800">
            {faqs.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="flex items-center justify-between gap-4">{f.q}<span aria-hidden className="text-orange-600 transition group-open:rotate-45">+</span></span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-neutral-950 p-7 text-white">
          <div>
            <h2 className="text-xl font-black">Question about a delivery?</h2>
            <p className="mt-1 text-sm text-neutral-300">Send us your order number and we&apos;ll check.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={whatsappLink('Hello Honic, I have a question about my delivery. Order number:')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold hover:bg-orange-600">
              <MessageCircle className="h-4 w-4" /> WhatsApp us
            </a>
            <Link href="/support/order-tracking" className="inline-flex items-center rounded-xl px-5 py-3 text-sm font-bold ring-1 ring-white/30 hover:ring-white">Track an order</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
