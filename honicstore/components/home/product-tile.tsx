import Link from 'next/link'
import { Star } from 'lucide-react'
import { Price } from '@/components/price'
import { optimizedImg } from '@/lib/image-optimize'
import type { HomeProduct } from '@/lib/home-data'

export const productHref = (p: { id: number; name: string; slug?: string | null }) =>
  `/products/${p.id}-${encodeURIComponent(p.slug || p.name)}`

/** Compact product card used on the home page (server-rendered; price follows the chosen currency). */
export function ProductTile({ p, priority = false }: { p: HomeProduct; priority?: boolean }) {
  const off = p.originalPrice && p.originalPrice > p.price ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0
  return (
    <Link href={productHref(p)} className="group flex flex-col rounded-2xl border border-neutral-200/70 bg-white p-2 transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/5">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-neutral-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={optimizedImg(p.image, 200)}
          alt={p.name}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
        />
        {off > 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">−{off}%</span>}
        {p.inStock === false && <span className="absolute inset-x-1.5 bottom-1.5 rounded-lg bg-neutral-950/75 py-0.5 text-center text-[11px] font-semibold text-white">Out of stock</span>}
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-2">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-neutral-800">{p.name}</p>
        <div className="mt-auto flex items-end justify-between gap-1 pt-2">
          <div className="min-w-0">
            <Price value={p.price} className="block text-sm font-black tabular-nums text-neutral-950" />
            {off > 0 && <Price value={p.originalPrice!} className="block text-[11px] tabular-nums text-neutral-400 line-through" />}
          </div>
          {p.rating ? (
            <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-neutral-500">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(p.rating).toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
