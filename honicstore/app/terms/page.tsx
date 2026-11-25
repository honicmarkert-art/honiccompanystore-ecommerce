/**
 * Terms of service. Server-rendered (fast, readable by search engines). Numbers come from the real
 * policies (lib/policies.ts, delivery pricing) so the terms always match how the store works.
 */
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NON_RETURNABLE, REFUND_BUSINESS_DAYS, RETURN_DAYS, UNPAID_ORDER_EXPIRY_MINUTES, MIN_PAYMENT_TZS } from '@/lib/policies'
import { freeDeliveryThreshold } from '@/lib/shipping-pricing'
import { STORE_ADDRESS, STORE_WHATSAPP, phoneLabel, whatsappLink } from '@/lib/contact'

const COMPANY = 'Honic Company Limited'
const LEGAL_EMAIL = process.env.NEXT_PUBLIC_LEGAL_EMAIL || process.env.LEGAL_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@honiccompanystore.com'
const UPDATED = '26 November 2026'
const tsh = (n: number) => `TSh ${n.toLocaleString('en-US')}`

const SECTIONS: { id: string; title: string }[] = [
  { id: 'about', title: 'About these terms' },
  { id: 'accounts', title: 'Accounts' },
  { id: 'marketplace', title: 'The marketplace' },
  { id: 'orders', title: 'Orders and prices' },
  { id: 'offers', title: 'Price offers and codes' },
  { id: 'payments', title: 'Payments' },
  { id: 'delivery', title: 'Delivery and pickup' },
  { id: 'returns', title: 'Returns and refunds' },
  { id: 'use', title: 'Acceptable use' },
  { id: 'ip', title: 'Content and trademarks' },
  { id: 'liability', title: 'Liability' },
  { id: 'changes', title: 'Changes and law' },
  { id: 'contact', title: 'Contact' },
]

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-neutral-200 py-8 first:border-t-0 first:pt-0 dark:border-neutral-800">
      <h2 className="flex items-baseline gap-3 text-xl font-black tracking-tight sm:text-2xl">
        <span className="text-sm font-bold tabular-nums text-orange-600">{String(n).padStart(2, '0')}</span>{title}
      </h2>
      <div className="mt-4 space-y-3 text-[15px] leading-7 text-neutral-700 dark:text-neutral-300 [&_li]:pl-1 [&_strong]:text-neutral-900 dark:[&_strong]:text-white [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  const free = freeDeliveryThreshold()
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <header className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Legal</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Terms of service</h1>
          <p className="mt-3 text-neutral-600 dark:text-neutral-300">The rules for shopping and selling on the Honic marketplace. Plain language, no surprises.</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"><FileText className="h-3.5 w-3.5" /> Last updated {UPDATED}</p>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[230px_minmax(0,1fr)]">
          {/* contents */}
          <nav aria-label="Contents" className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">Contents</p>
            <ol className="grid grid-cols-1 gap-0.5 text-sm sm:grid-cols-2 lg:grid-cols-1">
              {SECTIONS.map((s, i) => (
                <li key={s.id}><a href={`#${s.id}`} className="flex gap-2 rounded-lg px-2 py-1.5 text-neutral-600 hover:bg-orange-50 hover:text-orange-700 dark:text-neutral-300 dark:hover:bg-orange-950/30"><span className="w-5 shrink-0 tabular-nums text-neutral-400">{i + 1}.</span>{s.title}</a></li>
              ))}
            </ol>
          </nav>

          <article className="min-w-0 max-w-3xl">
            <Section id="about" n={1} title="About these terms">
              <p>These terms apply when you use honiccompanystore.com and buy or sell on it. The store is run by <strong>{COMPANY}</strong>, {STORE_ADDRESS}. By using the site or placing an order you agree to these terms and to our <Link href="/privacy" className="font-semibold text-orange-600 hover:underline">privacy policy</Link>.</p>
            </Section>

            <Section id="accounts" n={2} title="Accounts">
              <ul>
                <li>You can shop as a guest or with an account. To open an account you must be <strong>18 or older</strong> and give true details.</li>
                <li>Keep your password private. You are responsible for what happens in your account; tell us straight away if you think someone else used it.</li>
                <li>You can ask us to delete your account at any time. We keep order and invoice records only as long as the law requires.</li>
                <li>We may suspend accounts used for fraud, abuse or breaking these terms.</li>
              </ul>
            </Section>

            <Section id="marketplace" n={3} title="The marketplace">
              <p>Honic is a marketplace: products are sold by the <strong>official Honic store</strong> and by <strong>independent sellers</strong>. The product page shows who sells each item.</p>
              <ul>
                <li>Sellers are responsible for their listings: descriptions, photos, stock and that the item matches what was shown.</li>
                <li>Whoever the seller is, you pay Honic at checkout and our returns and refund rules below apply to your order.</li>
                <li>Sellers agree to the seller terms they accept when they register, in addition to these terms.</li>
              </ul>
            </Section>

            <Section id="orders" n={4} title="Orders and prices">
              <ul>
                <li>Prices are in Tanzanian shillings and include what you pay for the item. The delivery fee for your address is shown at checkout before you pay.</li>
                <li>We work to keep prices and stock correct. If a price or stock level was clearly wrong, we will tell you and you can cancel for a full refund.</li>
                <li>An order is confirmed when the payment succeeds. Unpaid orders are cancelled automatically after {UNPAID_ORDER_EXPIRY_MINUTES} minutes.</li>
                <li>We may refuse or cancel an order (for example for suspected fraud or an item that cannot be supplied). If you paid, you get a full refund.</li>
              </ul>
            </Section>

            <Section id="offers" n={5} title="Price offers and codes">
              <ul>
                <li>You can ask for a better price with <strong>Make an offer</strong> or on WhatsApp. We may accept, counter or decline; there is no obligation either way.</li>
                <li>If we agree a price, you get a <strong>one-time code</strong> for that product and quantity. It works once, for 48 hours, in your cart.</li>
                <li>Coupon codes have their own conditions (minimum spend, end date, products). Codes cannot be exchanged for cash.</li>
                <li><strong>Never pay on WhatsApp</strong> or to a personal number. All payments are made through checkout on this website.</li>
              </ul>
            </Section>

            <Section id="payments" n={6} title="Payments">
              <ul>
                <li>We accept <strong>mobile money</strong>: M-Pesa, Airtel Money, Mixx by Yas and HaloPesa. Card payments are not available yet.</li>
                <li>You confirm every payment with your own PIN on your phone. We never see or store your PIN.</li>
                <li>Mobile money cannot take payments under {tsh(MIN_PAYMENT_TZS)}. If an order totals less, checkout adds the difference as its own line (&ldquo;Mobile money minimum&rdquo;) before you pay.</li>
                <li>Orders are paid in full at checkout. Your invoice (PDF) is available after payment.</li>
              </ul>
            </Section>

            <Section id="delivery" n={7} title="Delivery and pickup">
              <ul>
                <li>We deliver across Tanzania: usually 1–2 days in Dar es Salaam and 2–6 days to other regions. You can also collect free from our store in Dar es Salaam.</li>
                <li>The fee depends on your region (and area within Dar es Salaam) and parcel size, and is shown before you pay. Delivery is free when your items add up to {tsh(free)} or more, or for products marked &ldquo;free delivery&rdquo;.</li>
                <li>Orders outside Tanzania are by arrangement only.</li>
                <li>Check your parcel when it arrives and tell us about any problem within the return period.</li>
              </ul>
            </Section>

            <Section id="returns" n={8} title="Returns and refunds">
              <ul>
                <li><strong>Wrong, damaged or faulty item:</strong> tell us within {RETURN_DAYS} days of delivery. We replace or refund in full and pay the return transport.</li>
                <li><strong>Change of mind:</strong> within {RETURN_DAYS} days, unused and unopened in the original packaging. You pay the return transport; the delivery fee is not refunded.</li>
                <li>Refunds are sent within {REFUND_BUSINESS_DAYS} business days after we receive and check the item, to the mobile money number used for the order.</li>
                <li>Paid orders that have not been sent can be cancelled for a full refund.</li>
              </ul>
              <p className="font-semibold text-neutral-900 dark:text-white">Not returnable for a change of mind:</p>
              <ul>{NON_RETURNABLE.map((x) => <li key={x}>{x}</li>)}</ul>
              <p>Your rights under Tanzanian consumer law are not affected. See <Link href="/support/returns-refunds" className="font-semibold text-orange-600 hover:underline">how returns work</Link>.</p>
            </Section>

            <Section id="use" n={9} title="Acceptable use">
              <p>Do not use the site to:</p>
              <ul>
                <li>break the law, commit fraud or pay with money that is not yours;</li>
                <li>try to get into accounts or systems that are not yours, spread malware or overload the site;</li>
                <li>copy or scrape the site with automated tools, or resell our content without permission;</li>
                <li>post false, offensive or misleading content, or harass other people.</li>
              </ul>
              <p>We may remove content, cancel orders or close accounts that break these rules, and report illegal activity.</p>
            </Section>

            <Section id="ip" n={10} title="Content and trademarks">
              <ul>
                <li>The Honic name, logo, site design and our own texts and photos belong to {COMPANY} or its licensors. Do not copy them without permission.</li>
                <li>Sellers and shoppers keep ownership of what they post (product details, reviews) and let us show it on the site.</li>
                <li>Other brand names belong to their owners.</li>
              </ul>
            </Section>

            <Section id="liability" n={11} title="Liability">
              <ul>
                <li>The website is provided &ldquo;as is&rdquo;. We work to keep it available and correct but cannot promise it is always free of errors or interruptions.</li>
                <li>Products you buy are covered by the returns rules above. As far as the law allows, we are not liable for indirect losses, and our liability for an order is limited to what you paid for it.</li>
                <li>We are not responsible for delays caused by events outside our control (for example network outages or extreme weather).</li>
                <li>Nothing in these terms limits liability that cannot be limited under Tanzanian law.</li>
              </ul>
            </Section>

            <Section id="changes" n={12} title="Changes and law">
              <ul>
                <li>We may update these terms. The date at the top shows the latest version; important changes are announced on the site or by email. Orders follow the terms that applied when you placed them.</li>
                <li>These terms are governed by the laws of the United Republic of Tanzania. We will always try to solve problems with you directly first.</li>
              </ul>
            </Section>

            <Section id="contact" n={13} title="Contact">
              <p>Questions about these terms or a legal notice:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <a href={`mailto:${LEGAL_EMAIL}`} className="rounded-2xl bg-stone-50 p-4 ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-800"><span className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">Email</span><span className="font-semibold">{LEGAL_EMAIL}</span></a>
                <a href={whatsappLink('Hello Honic, a question about your terms')} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-stone-50 p-4 ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-800"><span className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">WhatsApp</span><span className="font-semibold">{phoneLabel(STORE_WHATSAPP)}</span></a>
                <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-neutral-200 sm:col-span-2 dark:bg-neutral-900 dark:ring-neutral-800"><span className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">Post / visit</span><span className="font-semibold">{COMPANY}, {STORE_ADDRESS}</span></div>
              </div>
            </Section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
