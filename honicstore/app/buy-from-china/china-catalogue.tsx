"use client"

/**
 * Import catalogue: search, category chips and sort happen in the browser (the list is small and
 * already on the page, so nothing waits on the network). Cards open the normal product page with
 * from=china, where the item is added to the cart (the import time was explained on this page).
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Star, X } from 'lucide-react'
import { optimizedImg } from '@/lib/image-optimize'

export type ChinaItem = {
  id: number; name: string; slug: string | null; price: number; originalPrice: number | null; image: string | null
  category: string; brand: string | null; rating: number; reviews: number; sold: number; createdAt: string
  /** number of options (sizes, models...) and the lowest price among them */
  options: number; fromPrice: number
}
const tsh = (n: number) => `TSh ${Math.round(n).toLocaleString('en-US')}`
type Sort = 'popular' | 'newest' | 'price_asc' | 'price_desc'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'popular', label: 'Most bought' }, { id: 'newest', label: 'Newest' }, { id: 'price_asc', label: 'Price: low to high' }, { id: 'price_desc', label: 'Price: high to low' },
]

export function ChinaCatalogue({ items, days, askLink }: { items: ChinaItem[]; days: string; askLink: string }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [sort, setSort] = useState<Sort>('popular')

  const cats = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items) m.set(i.category, (m.get(i.category) || 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [items])

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)
    const list = items.filter((i) => (!cat || i.category === cat) && words.every((w) => `${i.name} ${i.brand || ''} ${i.category}`.toLowerCase().includes(w)))
    const by: Record<Sort, (a: ChinaItem, b: ChinaItem) => number> = {
      popular: (a, b) => b.sold - a.sold, newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      price_asc: (a, b) => a.fromPrice - b.fromPrice, price_desc: (a, b) => b.fromPrice - a.fromPrice,
    }
    return [...list].sort(by[sort])
  }, [items, q, cat, sort])

  return (
    <section id="catalogue" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#c8102e]">The import shelf</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Order from China</h2>
        </div>
        <p className="text-sm text-[#1d1210]/60">{shown.length} of {items.length} items · each arrives in about {days} days</p>
      </div>

      {/* controls */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search import items</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1d1210]/40" />
          <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 80))} placeholder="Search the import shelf" maxLength={80}
            className="h-12 w-full rounded-full border border-[#1d1210]/15 bg-white pl-11 pr-11 text-[15px] outline-none transition placeholder:text-[#1d1210]/40 focus:border-[#c8102e] focus:ring-4 focus:ring-[#c8102e]/10" />
          {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[#1d1210]/50 hover:bg-[#f7f1e8]"><X className="h-4 w-4" /></button>}
        </label>
        <label className="flex h-12 shrink-0 items-center gap-2 rounded-full border border-[#1d1210]/15 bg-white px-4 text-sm">
          <span className="text-[#1d1210]/50">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-transparent font-bold outline-none" aria-label="Sort">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>
      {cats.length > 1 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Categories">
          <Chip on={!cat} onClick={() => setCat('')}>All <span className="opacity-60">{items.length}</span></Chip>
          {cats.map(([c, n]) => <Chip key={c} on={cat === c} onClick={() => setCat(cat === c ? '' : c)}>{c} <span className="opacity-60">{n}</span></Chip>)}
        </div>
      )}

      {/* grid */}
      {shown.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-[#1d1210]/20 bg-white px-6 py-12 text-center">
          <p className="text-lg font-black">{items.length ? 'Nothing on the shelf matches that.' : 'The import shelf is empty right now.'}</p>
          <p className="mt-1 text-sm text-[#1d1210]/60">Send us a link or photo and we tell you if we can bring it in.</p>
          <a href={askLink} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-full bg-[#c8102e] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#a50d26]">Ask on WhatsApp</a>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {shown.map((i) => (
            <li key={i.id}>
              <Link href={`/products/${i.id}${i.slug ? `-${encodeURIComponent(i.slug)}` : ''}?from=china&returnTo=${encodeURIComponent('/buy-from-china')}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#1d1210]/10 bg-white transition hover:-translate-y-0.5 hover:border-[#c8102e]/40 hover:shadow-xl hover:shadow-[#c8102e]/10">
                <span className="relative block aspect-square bg-[#fbf6ee]">
                  {i.image
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={optimizedImg(i.image, 360)} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.04]" />
                    : <span className="grid h-full place-items-center text-4xl font-black text-[#c8102e]/20" aria-hidden>进口</span>}
                </span>
                <span className="flex flex-1 flex-col p-3">
                  <span className="line-clamp-2 text-[13px] font-semibold leading-snug sm:text-sm">{i.name}</span>
                  {i.reviews > 0 && <span className="mt-1 flex items-center gap-1 text-[11px] text-[#1d1210]/60"><Star className="h-3 w-3 fill-[#f2c14e] text-[#f2c14e]" />{i.rating.toFixed(1)} · {i.reviews}</span>}
                  <span className="mt-auto pt-2">
                    {i.options > 1 && <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#c8102e]">From</span>}
                    <b className="block text-base font-black text-[#1d1210] sm:text-lg">{tsh(i.fromPrice)}</b>
                    {i.options > 1 ? <span className="block text-xs text-[#1d1210]/60">{i.options} options</span> : i.originalPrice && <span className="block text-xs text-[#1d1210]/40 line-through">{tsh(i.originalPrice)}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${on ? 'bg-[#160d0c] text-[#f2c14e]' : 'bg-white text-[#1d1210]/80 ring-1 ring-[#1d1210]/15 hover:ring-[#c8102e]/50'}`}>
      {children}
    </button>
  )
}
