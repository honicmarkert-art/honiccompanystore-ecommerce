import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { MIN_PAYMENT_TZS, RETURN_DAYS } from '@/lib/policies'
import { getFreightSettings } from '@/lib/import-freight-server'
import { FreightCalculator } from './freight-calculator'
import { whatsappLink } from '@/lib/contact'
import { ChinaCatalogue, type ChinaItem } from './china-catalogue'

/**
 * "Buy from China": items Honic imports to order (products.import_china). Its own look (ink, red and
 * gold) so shoppers can tell at a glance these are not in local stock. Every claim here comes from
 * lib/policies.ts or the live catalogue. Server-rendered, read-only, public product fields only.
 */
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Buy from China | Honic Company Store',
  description: 'Electronics and parts Honic imports to order from China, shipped to Tanzania by air or sea. Pay in TSh with mobile money.',
  alternates: { canonical: '/buy-from-china' },
}

async function loadItems(): Promise<ChinaItem[]> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data, error } = await db
    .from('products')
    .select('id, name, slug, price, original_price, image, category, brand, rating, reviews, sold_count, created_at, product_variants (price)')
    .eq('import_china', true)
    .or('is_hidden.is.null,is_hidden.eq.false')
    .order('sold_count', { ascending: false, nullsFirst: false })
    .limit(300)
  if (error) throw new Error('Could not load import items')
  return (data || []).map((p) => {
    const optionPrices = ((p.product_variants as { price: number | null }[] | null) || []).map((v) => Number(v.price)).filter((n) => n > 0)
    const options = optionPrices.length
    return {
    id: Number(p.id), name: String(p.name || ''), slug: p.slug || null, price: Number(p.price) || 0,
    originalPrice: p.original_price != null && Number(p.original_price) > Number(p.price) ? Number(p.original_price) : null,
    image: typeof p.image === 'string' && /^https:\/\//.test(p.image) ? p.image : null,
    category: String(p.category || '').trim() || 'Other', brand: p.brand || null,
    rating: Number(p.rating) || 0, reviews: Number(p.reviews) || 0, sold: Number(p.sold_count) || 0, createdAt: String(p.created_at || ''),
    options, fromPrice: options > 1 ? Math.min(...optionPrices) : options === 1 ? optionPrices[0] : Number(p.price) || 0,
  }
  })
}

export default async function ChinaPage() {
  const [items, settings] = await Promise.all([loadItems(), getFreightSettings()])
  // air and sea travel times come from the shipping rates set in the admin
  const air = settings ? `${settings.air.daysMin}–${settings.air.daysMax}` : null
  const sea = settings ? `${settings.sea.daysMin}–${settings.sea.daysMax}` : null
  const days = air && sea ? `${air} days by air or ${sea} days by sea` : 'a few weeks'
  const askLink = whatsappLink('Hello Honic, I would like to import an item from China. Here is the link or photo:')

  return (
    <div className="min-h-screen bg-[#f7f1e8] text-[#1d1210]">
      <SiteHeader />
      <main>
        {/* hero: ink with a red lattice, the route and the promise in plain words */}
        <section className="relative overflow-hidden bg-[#160d0c] text-[#f7f1e8]">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:repeating-linear-gradient(45deg,#c8102e_0_1px,transparent_1px_22px),repeating-linear-gradient(-45deg,#c8102e_0_1px,transparent_1px_22px)]" />
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#c8102e] opacity-40 blur-3xl sm:h-96 sm:w-96" />
          <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#f2c14e]/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-[#f2c14e]">
                <span aria-hidden>进口</span> Imported to order
              </p>
              <h1 className="mt-4 text-[2.1rem] font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Buy from China,<br /><span className="text-[#f2c14e]">delivered in Tanzania.</span>
              </h1>
              <p className="mt-4 max-w-xl text-base text-[#f7f1e8]/80 sm:text-lg">
                Parts and electronics we do not keep in local stock. Order here, pay in TSh with mobile money, and we bring it in for you: about <b className="text-white">{air ?? '–'} days by air</b> or <b className="text-white">{sea ?? '–'} days by sea</b>.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#catalogue" className="rounded-full bg-[#c8102e] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#c8102e]/30 transition hover:bg-[#a50d26]">Browse {items.length} import items</a>
                <a href={askLink} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[#f7f1e8]/30 px-5 py-3 text-sm font-bold transition hover:border-[#f2c14e] hover:text-[#f2c14e]">Ask for an item</a>
              </div>
            </div>

            {/* the route */}
            <ol className="relative grid gap-3 rounded-3xl border border-[#f7f1e8]/10 bg-[#f7f1e8]/[0.04] p-5 backdrop-blur-sm sm:p-6" aria-label="How an import order travels">
              {[
                { k: '01', t: 'You order and pay', d: 'Same checkout as the rest of the shop, in TSh with mobile money.' },
                { k: '02', t: 'We order it in China', d: 'Honic buys the item for you once your payment is confirmed.' },
                { k: '03', t: 'By air or by sea', d: `You choose at checkout: about ${days}, from payment.` },
                { k: '04', t: 'Delivered or picked up', d: 'We deliver it to you, or you collect it from our store in Dar es Salaam.' },
              ].map((s, i, all) => (
                <li key={s.k} className="relative flex gap-4">
                  <span className="relative flex flex-col items-center">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f2c14e] text-sm font-black text-[#160d0c]">{s.k}</span>
                    {i < all.length - 1 && <span aria-hidden className="mt-1 w-px flex-1 bg-gradient-to-b from-[#f2c14e]/70 to-transparent" />}
                  </span>
                  <span className="pb-2"><b className="block text-[15px]">{s.t}</b><span className="text-sm text-[#f7f1e8]/70">{s.d}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* three plain facts */}
        <section className="border-b border-[#1d1210]/10 bg-[#fffaf2]">
          <dl className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-[#1d1210]/10 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
            <div className="py-5 sm:px-6"><dt className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c8102e]">Arrives in</dt><dd className="mt-1 text-2xl font-black">{air ?? '–'} days by air</dd><dd className="text-sm text-[#1d1210]/60">or {sea ?? '–'} days by sea, from payment</dd></div>
            <div className="py-5 sm:px-6"><dt className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c8102e]">You pay</dt><dd className="mt-1 text-2xl font-black">TSh, mobile money</dd><dd className="text-sm text-[#1d1210]/60">full total shown before you pay</dd></div>
            <div className="py-5 sm:px-6"><dt className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c8102e]">Returns</dt><dd className="mt-1 text-2xl font-black">{RETURN_DAYS} days</dd><dd className="text-sm text-[#1d1210]/60">to report a problem, as in our <a href="/support/returns-refunds" className="underline decoration-[#c8102e] underline-offset-2">returns policy</a></dd></div>
          </dl>
        </section>

        <ChinaCatalogue items={items} days={air ? `${air} days by air` : ''} askLink={askLink} />
        {settings && <FreightCalculator settings={settings} />}

        {/* questions */}
        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-black tracking-tight">Before you order</h2>
          <div className="mt-4 divide-y divide-[#1d1210]/10 rounded-2xl border border-[#1d1210]/10 bg-white">
            {[
              { q: 'How long does it take?', a: `About ${days}, counted from the moment your payment is confirmed. You choose air or sea at checkout.` },
              { q: 'How is shipping priced?', a: 'Air is priced per kilogram (the real weight or the volume weight, whichever is bigger); sea is priced per cubic metre (CBM). The calculator above uses the same rates as checkout. Bigger shipments get a lower rate per kg or CBM.' },
              { q: 'An item has no size or weight listed', a: 'Ask us for the shipping price first, or buy it now and pay the shipping on arrival: we weigh your parcel at our warehouse and tell you the price before you pay it.' },
              { q: 'Is the price final?', a: 'The price on the item is what you pay for it. Shipping from China and delivery inside Tanzania are added at checkout, and you see the full total before you pay.' },
              { q: 'How do I pay?', a: `With mobile money in Tanzanian shillings, through the normal checkout (minimum payment TSh ${MIN_PAYMENT_TZS.toLocaleString('en-US')}).` },
              { q: 'Can I mix import items with items in stock?', a: 'Yes. Put them in the same cart. Items in stock follow normal delivery times; import items follow the import time above.' },
              { q: 'What if something is wrong when it arrives?', a: `Report it within ${RETURN_DAYS} days of delivery or pickup. Returns and refunds follow our returns policy (Help → Returns & refunds).` },
              { q: 'The item I need is not listed', a: 'Send us a link or a photo on WhatsApp. We reply whether we can import it and at what price.' },
            ].map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                  {f.q}<span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f7f1e8] text-[#c8102e] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-[#1d1210]/70">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
