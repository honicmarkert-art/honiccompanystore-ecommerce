'use client'

import { memo, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, Star } from 'lucide-react'
import { isUsableImage } from './utils'
import { canOptimizeImage } from '@/lib/image-optimize'

type Item = {
  id: number
  name: string
  slug?: string
  price: number
  originalPrice?: number
  original_price?: number
  image?: string | null
  rating?: number
  sold_count?: number
}

type Props = {
  productId: number
  categorySlug?: string | null
  /** used to find similar products by name and keep suggestions in a sensible price range */
  productName?: string
  price?: number
  formatPrice: (n: number) => string
}

/** Cards shown at first and per "Show more" click (fills 2/3/4/5/6-column rows evenly). */
const PAGE = 12


/**
 * "You may also like" (similar name, same category, similar price) — fetched only when the section nears the viewport,
 * instead of downloading the whole catalog on page load like the old page did.
 */
function RelatedProductsImpl({ productId, categorySlug, productName, price, formatPrice }: Props) {
  const ref = useRef<HTMLElement>(null)
  const [items, setItems] = useState<Item[] | null>(null)
  const [visible, setVisible] = useState(false)
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    const load = async () => {
      // fast DB search (same category, most popular first); top up from the whole store if the category is small
      const get = async (params: URLSearchParams) => {
        const r = await fetch(`/api/search?${params}`)
        const d = await r.json().catch(() => null)
        // a name search with no real match returns "closest" items: skip those
        if (params.has("q") && d?.exact === false) return [] as Item[]
        return (Array.isArray(d?.products) ? d.products : []) as Item[]
      }
      try {
        // 1) similar by name (e.g. "Bambu Lab A1 …" finds Bambu filament)  2) same category  3) similar price.
        // Big-ticket items (machines) never get padded with cheap small parts.
        const expensive = (price || 0) >= 100_000
        const band = (p: Item) => !expensive || (Number(p.price) >= (price || 0) / 20 && Number(p.price) <= (price || 0) * 5)
        const seen = new Set<number>([productId])
        const add = (list: Item[], extra: Item[]) => {
          for (const p of extra) if (!seen.has(p.id)) { seen.add(p.id); list.push(p) }
          return list
        }
        const words = (productName || '').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w.length > 1).slice(0, 3).join(' ')
        let list: Item[] = []
        if (words) add(list, await get(new URLSearchParams({ q: words, limit: '12', offset: '0' })))
        const cat = new URLSearchParams({ limit: '24', offset: '0', sort: 'popular' })
        if (categorySlug) cat.set('category', categorySlug)
        add(list, (await get(cat)).filter(band))
        if (list.length < 6) {
          const more = new URLSearchParams({ limit: '24', offset: '0', sort: 'popular' })
          if (expensive) { more.set('minPrice', String(Math.round((price || 0) / 20))); more.set('maxPrice', String(Math.round((price || 0) * 5))) }
          list = add(list, await get(more))
        }
        if (!cancelled) setItems(list.slice(0, 24))
      } catch {
        if (!cancelled) setItems([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [visible, categorySlug, productId, productName, price])

  if (items && items.length === 0) return null

  return (
    <section ref={ref} className="py-8" aria-labelledby="related-heading">
      <h2 id="related-heading" className="mb-4 text-xl font-black tracking-tight sm:text-2xl">You may also like</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {(items ? items.slice(0, shown) : Array.from({ length: 6 }).map((_, i) => ({ id: -i } as Item))).map((p) => {
          if (p.id <= 0) return <div key={p.id} className="aspect-[3/4] rounded-2xl bg-neutral-100 dark:bg-neutral-900" />
          const orig = Number(p.original_price ?? p.originalPrice ?? 0)
          const off = orig > p.price ? Math.round((1 - p.price / orig) * 100) : 0
          const img = isUsableImage(p.image) ? p.image : '/placeholder.svg'
          return (
            <Link
              key={p.id}
              href={`/products/${p.id}-${encodeURIComponent(p.slug || p.name || 'product')}`}
              className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-800"
            >
              <div className="relative aspect-square bg-white">
                <Image src={img} alt={p.name} fill sizes="(min-width:1280px) 16vw, (min-width:1024px) 20vw, (min-width:768px) 25vw, (min-width:640px) 33vw, 50vw" loading="lazy" className="object-contain p-3" unoptimized={!canOptimizeImage(img)} />
                {off > 0 && <span className="absolute left-2 top-2 rounded-md bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white">-{off}%</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1 border-t border-neutral-100 p-2.5 dark:border-neutral-800 sm:p-3">
                <h3 className="line-clamp-2 text-[13px] leading-snug">{p.name}</h3>
                <div className="mt-auto">
                  <span className="font-black text-orange-600">{formatPrice(p.price)}</span>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                    {(p.rating ?? 0) > 0 && <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(p.rating).toFixed(1)}</span>}
                    {(p.sold_count ?? 0) > 0 && <span>{p.sold_count} sold</span>}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      {items && items.length > shown && (
        <div className="mt-5 flex justify-center">
          <button onClick={() => setShown((n) => n + PAGE)} className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-semibold hover:border-orange-500 hover:text-orange-600 dark:border-neutral-700">
            Show more <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  )
}

export const RelatedProducts = memo(RelatedProductsImpl)
