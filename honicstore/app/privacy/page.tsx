import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { STORE_ADDRESS, STORE_WHATSAPP, phoneLabel } from '@/lib/contact'

/**
 * Privacy notice. Describes what the site really collects and which services really process it
 * (checked against the code), written for Tanzania's Personal Data Protection Act, 2022.
 * Update LAST_UPDATED whenever the content changes. (The old page was a generic template that
 * claimed MFA, security audits, data export and ad tracking, and showed today's date as "last updated".)
 */
export const metadata: Metadata = {
  title: 'Privacy notice | Honic Company Store',
  description: 'What personal information Honic Company Store collects, why, who processes it, and your rights under Tanzanian law.',
  alternates: { canonical: '/privacy' },
}

const LAST_UPDATED = '25 November 2026'
const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@honiccompanystore.com'

const COLLECT = [
  ['Account', 'Your name, email address, phone number, password (stored encrypted, we cannot read it), profile photo if you add one. If you sign in with Google: your name, email and Google profile photo.'],
  ['Orders', 'What you buy, delivery or billing address (region, district, ward, street), phone and email for the order, order and payment status, invoices.'],
  ['Payments', 'The mobile money number used and the payment reference. You approve payments with your own PIN on your phone; we never see or store your PIN.'],
  ['Sellers', 'For seller accounts: business name, contact person, business documents you upload, and payout details.'],
  ['Messages', 'What you send us through the contact form, quote requests, reviews, WhatsApp or email.'],
  ['Searches', 'What you search for. If you use AI search or photo search, the text or photo is sent to our AI provider to find matching products. Search photos are not stored.'],
  ['Technical', 'Your IP address (for security and to stop abuse), browser and device type, and anonymous page-view statistics.'],
]

const USE = [
  'To create and run your account, and keep it secure',
  'To take payment, deliver your order, and send order and delivery updates',
  'To handle returns, refunds, questions and complaints',
  'To find products for you in search, AI search and photo search',
  'To stop fraud, spam and abuse of the website',
  'To keep records the law requires (for example tax and invoice records)',
  'To send news or offers only if you asked for them; you can unsubscribe at any time',
]

const PROCESSORS = [
  ['Supabase', 'Database, accounts and file storage', 'Canada'],
  ['Vercel', 'Website hosting and anonymous visit statistics (no cookies)', 'Global network'],
  ['Snippe', 'Mobile money payments (M-Pesa, Airtel Money, Mixx by Yas, HaloPesa)', 'Tanzania'],
  ['Resend', 'Sending emails (order confirmations, account emails)', 'United States'],
  ['Google', 'Sign in with Google; AI search and photo search (Gemini); address lookup (Maps)', 'United States / global'],
  ['Cloudflare', 'Bot protection on sign-up forms (Turnstile)', 'Global network'],
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Privacy notice</h1>
        <p className="mt-2 text-sm text-neutral-500">Last updated {LAST_UPDATED}</p>

        <div className="mt-8 space-y-10 text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">
          <section>
            <h2 className="text-xl font-black text-neutral-950 dark:text-white">Who we are</h2>
            <p className="mt-2">
              Honic Company Store is run by <strong>Honic Company Limited</strong>, {STORE_ADDRESS}, Tanzania. We decide how your personal
              information is used on this website. Questions or requests about your data: <a href={`mailto:${PRIVACY_EMAIL}`} className="font-semibold text-orange-600 hover:underline">{PRIVACY_EMAIL}</a> or WhatsApp {phoneLabel(STORE_WHATSAPP)}.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-neutral-950 dark:text-white">What we collect</h2>
            <dl className="mt-3 divide-y divide-neutral-200 rounded-2xl ring-1 ring-neutral-200 dark:divide-neutral-800 dark:ring-neutral-800">
              {COLLECT.map(([k, v]) => (
                <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[120px_1fr]">
                  <dt className="font-semibold text-neutral-950 dark:text-white">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="text-xl font-black text-neutral-950 dark:text-white">Why we use it</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">{USE.map((u) => <li key={u}>{u}</li>)}</ul>
            <p className="mt-3">We do <strong>not</strong> sell your personal information, and we do not use advertising trackers.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-neutral-950 dark:text-white">Who else handles it</h2>
            <p className="mt-2">We use these service providers to run the store. They may only use your information to provide their service to us.</p>
            <div className="mt-3 overflow-x-auto rounded-2xl ring-1 ring-neutral-200 dark:ring-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
                  <tr><th className="px-4 py-2.5">Provider</th><th className="px-4 py-2.5">What for</th><th className="px-4 py-2.5">Where</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {PROCESSORS.map(([p, w, l]) => (
                    <tr key={p}><td className="px-4 py-2.5 font-semibold">{p}</td><td className="px-4 py-2.5">{w}</td><td className="whitespace-nowrap px-4 py-2.5">{l}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              Some of these providers store or process data <strong>outside Tanzania</strong> (for example, our database is in Canada). We choose
              providers that protect data with encryption and access controls. When you order from another seller on Honic, we share with that
              seller only what they need to fulfil your order (your name, phone and delivery address). We also share information when the law requires it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-neutral-950 dark:text-white">How long we keep it</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your account: until you ask us to delete it.</li>
              <li>Orders, payments and invoices: as long as Tanzanian tax and accounting law requires, even after your account is deleted.</li>
              <li>Messages and support requests: as long as needed to deal with them, then deleted or kept with the related order.</li>
              <li>Security logs (such as IP addresses): a short time, only to stop abuse.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-neutral-950 dark:text-white">Keeping it safe</h2>
            <p className="mt-2">
              The website uses encrypted connections (HTTPS). Passwords are stored encrypted. Only staff who need your information for their work can see it,
              and payments are confirmed with your own PIN on your phone. No system is perfectly secure: if a breach affects your information, we will tell you
              and the authorities as the law requires.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-neutral-950 dark:text-white">Your rights</h2>
            <p className="mt-2">Under the Personal Data Protection Act, 2022 you can ask us to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>tell you what information we hold about you and give you a copy;</li>
              <li>correct information that is wrong (you can also edit your details in your account);</li>
              <li>delete your information, apart from records the law makes us keep;</li>
              <li>stop sending you marketing messages (or use the unsubscribe link).</li>
            </ul>
            <p className="mt-3">
              Write to <a href={`mailto:${PRIVACY_EMAIL}`} className="font-semibold text-orange-600 hover:underline">{PRIVACY_EMAIL}</a> from the email on your account.
              If you are not happy with our answer, you can complain to the Personal Data Protection Commission of Tanzania.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-neutral-950 dark:text-white">Cookies</h2>
            <p className="mt-2">
              We only use the cookies and browser storage the website needs to work: keeping you signed in, your cart, and your settings.
              See the <Link href="/cookies" className="font-semibold text-orange-600 hover:underline">cookie notice</Link> for the full list.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-neutral-950 dark:text-white">Children</h2>
            <p className="mt-2">Accounts are for people aged 18 or over. Younger shoppers should order through a parent or guardian.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-neutral-950 dark:text-white">Changes</h2>
            <p className="mt-2">If we change this notice we will update the date at the top, and tell account holders by email about important changes.</p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
