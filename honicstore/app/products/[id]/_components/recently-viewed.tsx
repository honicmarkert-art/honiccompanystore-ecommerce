'use client'

import { memo, useEffect, useState } from 'react'
import Link from 'next/link'
import { readRecentlyViewed, type ViewedProduct } from '@/lib/recently-viewed'
import { optimizedImg } from '@/lib/image-optimize'

/** "Recently viewed" row — per visitor (localStorage), shown only when there is history. */
function RecentlyViewedImpl({ excludeId, formatPrice }: { excludeId: number; formatPrice: (n: number) => string }) {
  const [items, setItems] = useState<ViewedProduct[]>([])

  // read after mount (localStorage isn't available during server rendering)
  useEffect(() => {
    const t = setTimeout(() => setItems(readRecentlyViewed().filter((p) => p.id !== excludeId).slice(0, 8)), 0)
    return () => clearTimeout(t)
  }, [excludeId])

  if (!items.length) return null

  return (
    <section className="border-t border-neutral-100 py-8 dark:border-neutral-800" aria-labelledby="recent-heading">
      <h2 id="recent-heading" className="mb-4 text-xl font-black tracking-tight sm:text-2xl">Recently viewed</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.id}-${encodeURIComponent(p.slug || p.name)}`}
            className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-800"
          >
            <div className="relative aspect-square bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={optimizedImg(p.image, 180)} alt={p.name} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-2" />
            </div>
            <div className="flex flex-1 flex-col gap-0.5 p-2">
              <p className="line-clamp-2 text-xs leading-snug">{p.name}</p>
              <p className="mt-auto text-sm font-black">{formatPrice(p.price)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export const RecentlyViewed = memo(RecentlyViewedImpl)
