"use client"

/**
 * The product list behind Wishlist and Saved for later: search, sort, add to cart,
 * move to the other list, remove. Products with options open the product page to choose them.
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Heart, Clock, Loader2, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { useProductsByIds } from '@/hooks/use-products-by-ids'
import { useCart } from '@/hooks/use-cart'
import { useCurrency } from '@/contexts/currency-context'
import { optimizedImg } from '@/lib/image-optimize'

type Entry = { productId: number; addedAt: string }
type Sort = 'added' | 'price_low' | 'price_high' | 'name'

export function SavedProducts({
  kind, entries, loading, remove, moveTo,
}: {
  kind: 'wishlist' | 'saved'
  entries: Entry[]
  loading: boolean
  remove: (id: number) => Promise<void> | void
  /** add to the other list (the item is then removed from this one) */
  moveTo: (id: number) => Promise<void> | void
}) {
  const ids = useMemo(() => entries.map((e) => e.productId), [entries])
  const { products, loading: productsLoading, error } = useProductsByIds(ids)
  const { addItem } = useCart()
  const { formatPrice } = useCurrency()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('added')
  const [busy, setBusy] = useState<string | null>(null)
  const [added, setAdded] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const otherLabel = kind === 'wishlist' ? 'Save for later' : 'Move to wishlist'
  const OtherIcon = kind === 'wishlist' ? Clock : Heart

  const rows = useMemo(() => {
    const addedAt = new Map(entries.map((e) => [e.productId, +new Date(e.addedAt)]))
    const term = q.trim().toLowerCase()
    const list = products.filter((p) => !term || p.name.toLowerCase().includes(term) || (p.category || '').toLowerCase().includes(term))
    return list.sort((a, b) =>
      sort === 'price_low' ? a.price - b.price
        : sort === 'price_high' ? b.price - a.price
          : sort === 'name' ? a.name.localeCompare(b.name)
            : (addedAt.get(b.id) || 0) - (addedAt.get(a.id) || 0))
  }, [products, entries, q, sort])

  const run = async (key: string, fn: () => Promise<unknown> | unknown, failMsg: string) => {
    setBusy(key); setActionError(null)
    try { await fn() } catch { setActionError(failMsg) } finally { setBusy(null) }
  }

  const showSkeleton = (loading || productsLoading) && products.length === 0

  if (!showSkeleton && entries.length === 0) {
    const Icon = kind === 'wishlist' ? Heart : Clock
    return (
      <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
        <Icon className="mx-auto h-10 w-10 text-neutral-300" />
        <p className="mt-3 font-semibold">{kind === 'wishlist' ? 'Your wishlist is empty' : 'Nothing saved for later'}</p>
        <p className="mt-1 text-sm text-neutral-500">
          {kind === 'wishlist' ? 'Tap the heart on any product to keep it here.' : 'Items you save from your cart wait here until you are ready.'}
        </p>
        <Link href="/products" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600">Browse products <ArrowRight className="h-4 w-4" /></Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {entries.length > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block flex-1">
            <span className="sr-only">Search saved items</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or category" className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-orange-500 dark:border-neutral-700 dark:bg-neutral-900" />
          </label>
          <label className="block">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-orange-500 sm:w-auto dark:border-neutral-700 dark:bg-neutral-900">
              <option value="added">Recently added</option>
              <option value="price_low">Price: low to high</option>
              <option value="price_high">Price: high to low</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      )}

      {(error || actionError) && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{actionError || 'Could not load the products. Please refresh the page.'}</p>
      )}

      {showSkeleton ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />)}</div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-neutral-500 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">No saved items match &ldquo;{q}&rdquo;.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => {
            const href = `/products/${(p as { slug?: string }).slug || p.id}`
            const hasOptions = (p.variants?.length || 0) > 1
            const off = p.originalPrice > p.price ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0
            return (
              <li key={p.id} className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-neutral-200 sm:gap-4 sm:p-4 dark:bg-neutral-900 dark:ring-neutral-800">
                <Link href={href} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-neutral-100 sm:h-28 sm:w-28 dark:ring-neutral-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image ? optimizedImg(p.image, 240) : '/placeholder.jpg'} alt="" loading="lazy" className="h-full w-full object-contain p-1.5" />
                  {off > 0 && <span className="absolute left-1.5 top-1.5 rounded-md bg-orange-500 px-1.5 py-0.5 text-xs font-bold text-white">-{off}%</span>}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={href} className="-my-1 line-clamp-2 py-1 text-sm font-semibold hover:text-orange-600 sm:text-base">{p.name}</Link>
                  {p.category && <p className="mt-0.5 truncate text-xs text-neutral-500">{p.category}</p>}
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-black tabular-nums">{formatPrice(p.price)}</span>
                    {off > 0 && <span className="text-xs text-neutral-400 line-through tabular-nums">{formatPrice(p.originalPrice)}</span>}
                    <span className={`text-xs font-semibold ${p.inStock ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>{p.inStock ? 'In stock' : 'Out of stock'}</span>
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                    {!p.inStock ? null : hasOptions ? (
                      <Link href={href} className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2.5 text-sm font-bold text-white hover:bg-orange-600">Choose options</Link>
                    ) : (
                      <button
                        onClick={() => run(`cart-${p.id}`, async () => { await addItem(p.id, 1, undefined, {}, p.price); setAdded(p.id) }, `Could not add ${p.name} to your cart.`)}
                        disabled={busy === `cart-${p.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
                      >
                        {busy === `cart-${p.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : added === p.id ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                        {added === p.id ? 'In cart' : 'Add to cart'}
                      </button>
                    )}
                    <button
                      onClick={() => run(`move-${p.id}`, () => moveTo(p.id), 'Could not move the item. Please try again.')}
                      disabled={busy === `move-${p.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-stone-100 px-3.5 py-2.5 text-sm font-semibold hover:bg-stone-200 disabled:opacity-60 dark:bg-neutral-800"
                    >
                      <OtherIcon className="h-4 w-4" /> <span className="hidden sm:inline">{otherLabel}</span><span className="sm:hidden">{kind === 'wishlist' ? 'Later' : 'Wishlist'}</span>
                    </button>
                    <button
                      onClick={() => run(`rm-${p.id}`, () => remove(p.id), 'Could not remove the item. Please try again.')}
                      disabled={busy === `rm-${p.id}`}
                      aria-label={`Remove ${p.name}`}
                      className="ml-auto grid h-10 w-10 place-items-center rounded-xl text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-950/30"
                    >
                      {busy === `rm-${p.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
