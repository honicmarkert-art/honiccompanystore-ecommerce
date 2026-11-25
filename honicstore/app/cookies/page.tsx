import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

/**
 * Cookie notice: the cookies and browser storage the site really uses (checked against the code).
 * There are no advertising or tracking cookies; visit statistics (Vercel Analytics) are cookieless.
 * Update LAST_UPDATED when the list changes.
 */
export const metadata: Metadata = {
  title: 'Cookie notice | Honic Company Store',
  description: 'The cookies and browser storage Honic Company Store uses: only what the website needs to work. No advertising trackers.',
  alternates: { canonical: '/cookies' },
}

const LAST_UPDATED = '25 November 2026'

const GROUPS = [
  {
    title: 'Needed to sign in and stay secure',
    note: 'These are required for your account to work, so they cannot be switched off.',
    rows: [
      ['sb-… (several)', 'Keeps you signed in (our account provider, Supabase)', '30 days if you tick "Keep me signed in", otherwise until you close the browser'],
      ['honic_browser_session', 'Signs you out when the browser closes if you did not tick "Keep me signed in"', 'Until the browser closes'],
      ['explicit-logout', 'Set when you sign out, so you are not signed back in automatically', 'A short time'],
      ['Cloudflare Turnstile', 'Bot check on sign-up forms (only on those forms)', 'Set by Cloudflare for the check'],
    ],
  },
  {
    title: 'Stored in your browser (not cookies)',
    note: 'Kept only on your device. Clearing your browser data removes them.',
    rows: [
      ['Cart', 'Your cart when you are not signed in', 'Until you check out or clear it'],
      ['Recently viewed', 'Products you opened, shown back to you', 'Until you clear browser data'],
      ['Currency and language', 'Your display settings', 'Until you change them'],
      ['Device check', 'Remembers this device after you sign in', 'Until you sign out'],
      ['Payment retry', 'Lets you retry a payment for an order you just placed', 'A short time'],
    ],
  },
]

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Cookie notice</h1>
        <p className="mt-2 text-sm text-neutral-500">Last updated {LAST_UPDATED}</p>

        <div className="mt-6 rounded-2xl bg-orange-50 p-5 text-[15px] leading-relaxed text-neutral-800 dark:bg-orange-950/30 dark:text-neutral-200">
          <strong>In short:</strong> we only use cookies and browser storage the website needs to work: keeping you signed in, your cart and your settings.
          We do <strong>not</strong> use advertising or tracking cookies. Our visit statistics (Vercel Analytics) do not use cookies.
        </div>

        {GROUPS.map((g) => (
          <section key={g.title} className="mt-10">
            <h2 className="text-xl font-black tracking-tight">{g.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">{g.note}</p>
            <div className="mt-3 overflow-x-auto rounded-2xl ring-1 ring-neutral-200 dark:ring-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
                  <tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">What it does</th><th className="px-4 py-2.5">How long</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {g.rows.map(([n, w, d]) => (
                    <tr key={n} className="align-top"><td className="px-4 py-2.5 font-semibold">{n}</td><td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">{w}</td><td className="px-4 py-2.5 text-neutral-500">{d}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <section className="mt-10 text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">
          <h2 className="text-xl font-black tracking-tight text-neutral-950 dark:text-white">Your choices</h2>
          <p className="mt-2">
            You can block or delete cookies in your browser settings. If you block the sign-in cookies you can still browse and use the cart,
            but you won&apos;t be able to stay signed in. For how we handle your personal information, see our{' '}
            <Link href="/privacy" className="font-semibold text-orange-600 hover:underline">privacy notice</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
