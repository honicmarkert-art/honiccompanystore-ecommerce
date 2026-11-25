import type { Metadata } from 'next'
import Link from 'next/link'
import { Ban, Clock, MessageCircle, PackageX, RefreshCw, ShieldCheck, Smartphone, Undo2 } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { STORE_ADDRESS, whatsappLink } from '@/lib/contact'
import { NON_RETURNABLE, REFUND_BUSINESS_DAYS, RETURN_DAYS, UNPAID_ORDER_EXPIRY_MINUTES } from '@/lib/policies'

/**
 * Returns, refunds and cancellations: the real policy (lib/policies.ts).
 * (The old page showed made-up "recent returns", a return-label download that didn't exist,
 * a 30-day window and an in-account return button.)
 */
export const metadata: Metadata = {
  title: 'Returns & refunds | Honic Company Store',
  description: `Wrong, damaged or faulty item? Tell us within ${RETURN_DAYS} days and we replace it or refund you to your mobile money number.`,
  alternates: { canonical: '/support/returns-refunds' },
}

export default function ReturnsRefundsPage() {
  const steps = [
    { title: 'Message us', text: `On WhatsApp or by email, within ${RETURN_DAYS} days of delivery or pickup. Send your order number, what is wrong, and a photo or short video.` },
    { title: 'We reply with the next step', text: 'Often we can fix it on the spot (wrong option, missing part). Otherwise we tell you how to send the item back.' },
    { title: 'Send it back', text: `Drop it at our store (${STORE_ADDRESS}), give it to our rider in Dar es Salaam, or send it by bus/courier from your town.` },
    { title: 'Replacement or refund', text: `We check the item and send a replacement, or refund you within ${REFUND_BUSINESS_DAYS} business days.` },
  ]

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
          <Link href="/support" className="hover:text-orange-600">Help centre</Link> <span aria-hidden>/</span> Returns & refunds
        </nav>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Returns & refunds</h1>
        <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-300">
          Something wrong with your order? Tell us within {RETURN_DAYS} days and we will make it right.
        </p>

        {/* the two cases */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-orange-50 p-6 ring-1 ring-orange-200 dark:bg-orange-950/30 dark:ring-orange-900">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500 text-white"><ShieldCheck className="h-5 w-5" /></span>
            <h2 className="mt-4 text-lg font-bold">Wrong, damaged or faulty item</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-700 dark:text-neutral-300">
              <li>• Tell us within <strong>{RETURN_DAYS} days</strong> of delivery or pickup</li>
              <li>• We <strong>replace it or refund you in full</strong>, including the delivery fee</li>
              <li>• We pay the transport to send it back</li>
              <li>• Also applies if the item is not as described on the product page</li>
            </ul>
          </div>
          <div className="rounded-2xl p-6 ring-1 ring-neutral-200 dark:ring-neutral-800">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"><Undo2 className="h-5 w-5" /></span>
            <h2 className="mt-4 text-lg font-bold">Changed your mind</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-700 dark:text-neutral-300">
              <li>• Within <strong>{RETURN_DAYS} days</strong>, unused and unopened, in the original packaging</li>
              <li>• You pay the transport to send it back</li>
              <li>• We refund the item price (the delivery fee is not refunded)</li>
              <li>• Not possible for the items listed below</li>
            </ul>
          </div>
        </div>

        {/* how */}
        <section className="mt-12">
          <h2 className="text-xl font-black tracking-tight">How to return an item</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl p-5 ring-1 ring-neutral-200 dark:ring-neutral-800">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-neutral-950 text-sm font-bold text-white dark:bg-white dark:text-neutral-950">{i + 1}</span>
                <h3 className="mt-3 font-bold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-500">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={whatsappLink('Hello Honic, I want to return an item. Order number:')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600">
              <MessageCircle className="h-4 w-4" /> Start a return on WhatsApp
            </a>
            <Link href="/account/orders" className="inline-flex items-center rounded-xl px-5 py-3 text-sm font-bold ring-1 ring-neutral-300 hover:ring-orange-500 dark:ring-neutral-700">Find your order number</Link>
          </div>
        </section>

        {/* details */}
        <section className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl p-6 ring-1 ring-neutral-200 dark:ring-neutral-800">
            <h2 className="flex items-center gap-2 font-bold"><Smartphone className="h-5 w-5 text-orange-600" /> Refunds</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              We send refunds to the <strong>same mobile money number you paid with</strong>, within {REFUND_BUSINESS_DAYS} business days after we receive and
              check the item (or after we approve a cancellation). We tell you on WhatsApp or by email when it is sent.
            </p>
          </div>
          <div className="rounded-2xl p-6 ring-1 ring-neutral-200 dark:ring-neutral-800">
            <h2 className="flex items-center gap-2 font-bold"><Ban className="h-5 w-5 text-orange-600" /> Cancelling an order</h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              <li>• <strong>Not paid yet:</strong> the order cancels itself after {UNPAID_ORDER_EXPIRY_MINUTES} minutes. Nothing to do.</li>
              <li>• <strong>Paid, not sent yet:</strong> message us and we cancel it and refund you in full.</li>
              <li>• <strong>Already sent or ready for pickup:</strong> it can&apos;t be cancelled, but you can return it as above.</li>
            </ul>
          </div>
          <div className="rounded-2xl p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 md:col-span-2">
            <h2 className="flex items-center gap-2 font-bold"><PackageX className="h-5 w-5 text-orange-600" /> Can&apos;t be returned if you change your mind</h2>
            <ul className="mt-2 grid gap-1.5 text-sm text-neutral-600 dark:text-neutral-300 sm:grid-cols-2">
              {NON_RETURNABLE.map((x) => <li key={x}>• {x}</li>)}
            </ul>
            <p className="mt-3 text-xs text-neutral-500">
              A wrong, damaged or faulty item is always covered, even if it is in this list. This policy does not limit your rights under Tanzanian consumer law.
            </p>
          </div>
        </section>

        <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-neutral-950 p-7 text-white">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black"><Clock className="h-5 w-5 text-orange-400" /> Not sure if it qualifies?</h2>
            <p className="mt-1 text-sm text-neutral-300">Ask us first. We reply during business hours.</p>
          </div>
          <a href={whatsappLink('Hello Honic, I have a question about a return. Order number:')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold hover:bg-orange-600">
            <RefreshCw className="h-4 w-4" /> Ask on WhatsApp
          </a>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
