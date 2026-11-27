"use client"

/**
 * Buy from China product page: the regular product page layout and features (gallery, options,
 * quantity, buy buttons, save, share, reviews, sticky bar...) in China mode: a simple shipping card
 * (air and sea price for this product) instead of local delivery, and the import shelf below.
 */
import Link from 'next/link'
import { ChevronRight, MessageCircle, Plane, Ship } from 'lucide-react'
import { optimizedImg } from '@/lib/image-optimize'
import { quoteFreight, isMeasured, type FreightSettings } from '@/lib/import-freight'
import { ProductDetailClient } from '@/app/products/[id]/_components/product-detail-client'
import type { ProductDetail } from '@/app/products/[id]/_components/utils'

const tsh = (n: number) => `TSh ${Math.round(n).toLocaleString('en-US')}`
type Size = { weightKg: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null }
export type RelatedItem = { id: number; name: string; price: number; originalPrice: number | null; image: string | null; sameCategory: boolean; sold: number }

/** Shipping from China for this product: the two prices, or how it is priced when the size is not known. */
function ShippingCard({ quantity, size, settings, askLink }: { quantity: number; size: Size; settings: FreightSettings | null; askLink: string }) {
  const item = { quantity: Math.max(1, quantity), ...size }
  const known = !!settings && isMeasured(item)
  const air = known ? quoteFreight([item], 'air', settings!) : null
  const sea = known ? quoteFreight([item], 'sea', settings!) : null
  const row = (icon: React.ReactNode, label: string, price: string, days: string) => (
    <li className="flex items-center gap-3 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300">{icon}</span>
      <span className="min-w-0 flex-1"><b className="block text-sm">{label}</b><span className="text-xs text-neutral-500">{days}</span></span>
      <b className="shrink-0 text-sm tabular-nums">{price}</b>
    </li>
  )
  return (
    <section aria-label="Shipping from China" className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-sm font-bold">Shipping from China</p>
      {!settings ? (
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Shipping prices are being updated. Ask us for the price.</p>
      ) : known && air && sea ? (
        <>
          <ul className="mt-1 divide-y divide-neutral-100 dark:divide-neutral-800">
            {row(<Plane className="h-4 w-4" />, 'By air', tsh(air.tzs), `About ${air.daysMin}–${air.daysMax} days`)}
            {row(<Ship className="h-4 w-4" />, 'By sea', tsh(sea.tzs), `About ${sea.daysMin}–${sea.daysMax} days`)}
          </ul>
          <p className="mt-1 text-xs text-neutral-500">For {item.quantity} {item.quantity === 1 ? 'piece' : 'pieces'}. You choose air or sea at checkout.</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            We weigh this item at our warehouse and send you the shipping price; you pay it when it arrives.
            Air from ${settings.air.tiers[0]?.usd} per kg ({settings.air.daysMin}–{settings.air.daysMax} days), sea from ${settings.sea.tiers[0]?.usd} per CBM ({settings.sea.daysMin}–{settings.sea.daysMax} days).
          </p>
          <a href={askLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:underline dark:text-red-300"><MessageCircle className="h-4 w-4" /> Ask the shipping price first</a>
        </>
      )}
      <p className="mt-2 border-t border-neutral-100 pt-2 text-xs text-neutral-500 dark:border-neutral-800">Delivery inside Tanzania is added at checkout, as for other items.</p>
    </section>
  )
}

function ImportShelf({ related }: { related: RelatedItem[] }) {
  if (!related.length) return null
  return (
    <section className="mt-12" aria-label="More from Buy from China">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">More from Buy from China</h2>
        <Link href="/buy-from-china#catalogue" className="flex shrink-0 items-center text-sm font-semibold text-orange-600 hover:underline">See all <ChevronRight className="h-4 w-4" /></Link>
      </div>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {related.map((r) => (
          <li key={r.id} className="w-40 shrink-0 sm:w-48">
            <Link href={`/buy-from-china/${r.id}`} className="group block overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200 transition hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-800">
              <span className="relative block aspect-square overflow-hidden bg-neutral-50">{r.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={optimizedImg(r.image, 260)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.04]" />}</span>
              <span className="block p-2.5"><span className="line-clamp-2 text-[13px] leading-snug">{r.name}</span><b className="mt-1 block text-sm">{tsh(r.price)}</b></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ChinaProduct({ product, size, settings, related, askLink }: { product: ProductDetail; size: Size; settings: FreightSettings | null; related: RelatedItem[]; askLink: string }) {
  return (
    <ProductDetailClient
      key={product.id}
      initialProduct={product}
      china={{
        shipping: (quantity) => <ShippingCard quantity={quantity} size={size} settings={settings} askLink={askLink} />,
        related: <ImportShelf related={related} />,
      }}
    />
  )
}
