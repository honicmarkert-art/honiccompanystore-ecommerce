"use client"

/**
 * Buy from China product page: the regular product page's features (zoom gallery with video / 360,
 * options, quantity, reviews, specifications, save, share, recently viewed, sticky buy bar on phones)
 * in the China look (ink, red, gold), plus import features: air and sea side by side with arrival dates,
 * shipping per piece by quantity, the import journey, US$ equivalent, ask the desk / bulk quotes and
 * more from the import shelf. Shipping comes from lib/import-freight.ts, the same as checkout.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ChevronRight, Heart, MessageCircle, Minus, PackageCheck, Plane, Plus, Share2, Ship, ShieldCheck, ShoppingCart, Smartphone, Star, Users } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { useToast } from '@/hooks/use-toast'
import { useWishlist } from '@/hooks/use-wishlist'
import { optimizedImg } from '@/lib/image-optimize'
import { recordView } from '@/lib/recently-viewed'
import { quoteFreight, isMeasured, type FreightMode, type FreightSettings } from '@/lib/import-freight'
import { Gallery } from '@/app/products/[id]/_components/gallery'
import { ProductTabs } from '@/app/products/[id]/_components/product-tabs'
import { galleryImages, isUsableImage, totalStock, variantLabel, variantStock, type ProductDetail, type ProductVariantDetail } from '@/app/products/[id]/_components/utils'

const tsh = (n: number) => `TSh ${Math.round(n).toLocaleString('en-US')}`
type Size = { weightKg: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null }
export type RelatedItem = { id: number; name: string; price: number; originalPrice: number | null; image: string | null; sameCategory: boolean; sold: number }
const QTY_STEPS = [1, 5, 10, 25]

export function ChinaProduct({ product, size, settings, related, sold, returnDays, askLink, bulkLink }: {
  product: ProductDetail; size: Size; settings: FreightSettings | null; related: RelatedItem[]; sold: number; returnDays: number; askLink: string; bulkLink: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { addItem } = useCart()
  const { add: addToWishlist, remove: removeFromWishlist, has: isInWishlist } = useWishlist()
  const variants = useMemo(() => product.variants || [], [product.variants])
  const [variant, setVariant] = useState<ProductVariantDetail | null>(variants.find((v) => variantStock(v) > 0) ?? variants[0] ?? null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [today, setToday] = useState<Date | null>(null)
  const [sticky, setSticky] = useState(false)
  const buyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setToday(new Date()) // eslint-disable-line react-hooks/set-state-in-effect -- arrival dates use the shopper's clock (not the server's)
    recordView({ id: product.id, name: product.name, price: product.price, image: product.image, category: product.category })
  }, [product.id, product.name, product.price, product.image, product.category])
  // phone: show the sticky buy bar once the main buttons scroll away
  useEffect(() => {
    const el = buyRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setSticky(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const images = useMemo(() => galleryImages(product), [product])
  const price = Number(variant?.price) || product.price || 0
  const was = Number(variant?.originalPrice || (!variant ? product.originalPrice : 0) || 0)
  const off = was > price ? Math.round((1 - price / was) * 100) : 0
  const stock = variant ? variantStock(variant) : totalStock(product)
  const tracked = variant ? variant.stockQuantity != null : product.stockQuantity != null
  const maxQty = tracked ? Math.max(0, stock) : 999
  const soldOut = tracked && stock <= 0
  const pricesDiffer = new Set(variants.map((v) => Number(v.price))).size > 1
  const saved = isInWishlist(product.id)

  // specifications: the product's, the chosen option's on top, and the packed size when known
  const measured = isMeasured({ quantity: 1, ...size })
  const shownProduct = useMemo(() => ({
    ...product,
    specifications: {
      ...(product.specifications || {}), ...(variant?.specifications || {}),
      ...(measured ? { 'Packed size (one piece)': `${size.lengthCm} × ${size.widthCm} × ${size.heightCm} cm`, 'Packed weight (one piece)': `${size.weightKg} kg` } : {}),
    },
  }), [product, variant, measured, size])

  const quote = (mode: FreightMode, q: number) => (settings && measured ? quoteFreight([{ quantity: q, ...size }], mode, settings) : null)
  const air = quote('air', qty)
  const sea = quote('sea', qty)
  const usd = settings ? price / settings.usdTzs : 0
  const arrive = (from: number, to: number) => {
    if (!today) return null
    const d = (n: number) => new Date(today.getTime() + n * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return `${d(from)} – ${d(to)}`
  }

  const add = () => {
    if (soldOut) return false
    if (variants.length && !variant) { toast({ title: 'Choose an option first', variant: 'destructive' }); return false }
    addItem(product.id, qty, variant?.id?.toString(), {}, price, variant?.sku ?? undefined, variant?.image ?? undefined, product)
    setAdded(true); setTimeout(() => setAdded(false), 1800)
    toast({ title: 'Added to cart', description: `${qty} × ${product.name}${variant ? ` (${variantLabel(variant, variants.indexOf(variant))})` : ''}. Choose air or sea at checkout.` })
    return true
  }
  const buyNow = () => { if (add()) setTimeout(() => router.push('/cart'), 150) }
  const toggleSave = async () => {
    if (saved) { await removeFromWishlist(product.id); toast({ title: 'Removed from your list', description: product.name }) }
    else { await addToWishlist(product.id); toast({ title: 'Saved to your list', description: product.name }) }
  }
  const share = async () => {
    const url = window.location.href.split('?')[0]
    try {
      if (navigator.share) await navigator.share({ title: product.name, url })
      else { await navigator.clipboard.writeText(url); toast({ title: 'Link copied' }) }
    } catch { /* cancelled */ }
  }

  const shipCard = (mode: FreightMode, q: ReturnType<typeof quote>) => {
    const s = settings ? (mode === 'air' ? settings.air : settings.sea) : null
    const cheaper = air && sea && q && q.tzs === Math.min(air.tzs, sea.tzs) && air.tzs !== sea.tzs
    return (
      <div className={`relative rounded-2xl p-4 ring-1 ${mode === 'air' ? 'bg-white/[0.06] ring-white/10' : 'bg-white/[0.06] ring-white/10'}`}>
        {cheaper && <span className="absolute -top-2 right-3 rounded-full bg-[#f2c14e] px-2 py-0.5 text-[10px] font-black uppercase text-[#160d0c]">Cheaper</span>}
        <p className="flex items-center gap-2 text-sm font-bold">{mode === 'air' ? <Plane className="h-4 w-4 text-[#f2c14e]" /> : <Ship className="h-4 w-4 text-[#f2c14e]" />}{mode === 'air' ? 'By air' : 'By sea'}</p>
        <p className="mt-1 text-xl font-black tabular-nums">{q ? tsh(q.tzs) : 'After weighing'}</p>
        {s && <p className="text-xs text-[#f7f1e8]/60">{s.daysMin}–{s.daysMax} days{arrive(s.daysMin, s.daysMax) ? ` · arrives ${arrive(s.daysMin, s.daysMax)}` : ''}</p>}
        {q && <p className="mt-1 text-[11px] text-[#f7f1e8]/50">{q.chargeable} {q.unit} × ${q.rateUsd}/{q.unit}</p>}
      </div>
    )
  }

  return (
    <main className="pb-28 lg:pb-16">
      {/* top bar */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-5 sm:px-6">
        <Link href="/buy-from-china" className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[#c8102e] hover:underline"><ArrowLeft className="h-4 w-4 shrink-0" /><span className="truncate">Buy from China{product.category ? ` · ${product.category}` : ''}</span></Link>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={toggleSave} aria-pressed={saved} aria-label={saved ? 'Remove from your list' : 'Save to your list'} className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-[#1d1210]/10 hover:ring-[#c8102e]/50"><Heart className={`h-5 w-5 ${saved ? 'fill-[#c8102e] text-[#c8102e]' : ''}`} /></button>
          <button type="button" onClick={share} aria-label="Share" className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-[#1d1210]/10 hover:ring-[#c8102e]/50"><Share2 className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="mx-auto mt-4 grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">
        <section aria-label="Photos" className="min-w-0">
          <div className="overflow-hidden rounded-3xl bg-white p-2 ring-1 ring-[#1d1210]/10 sm:p-3">
            <Gallery images={images} alt={product.name} video={product.video} view360={product.view360} focusImage={variant?.image && isUsableImage(variant.image) ? variant.image : null} />
          </div>
        </section>

        <section aria-label="Buy" className="min-w-0">
          <h1 className="break-words text-2xl font-black leading-tight tracking-tight sm:text-3xl">{product.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#1d1210]/60">
            {(product.reviews ?? 0) > 0 && <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-[#f2c14e] text-[#f2c14e]" />{Number(product.rating).toFixed(1)} · {product.reviews} reviews</span>}
            {sold > 0 && <span className="flex items-center gap-1"><Users className="h-4 w-4" />{sold} bought</span>}
            {product.brand && <span>Brand: <b className="text-[#1d1210]/80">{product.brand}</b></span>}
          </p>

          <div className="mt-4 rounded-3xl bg-white p-4 ring-1 ring-[#1d1210]/10 sm:p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-black tabular-nums">{tsh(price)}</span>
              {off > 0 && <><span className="text-base text-[#1d1210]/40 line-through">{tsh(was)}</span><span className="rounded-full bg-[#c8102e] px-2 py-0.5 text-xs font-black text-white">−{off}%</span></>}
            </div>
            <p className="mt-0.5 text-xs text-[#1d1210]/60">{usd > 0 ? `≈ US$ ${usd.toFixed(2)} · ` : ''}item price; shipping from China is added at checkout</p>

            {variants.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-bold">Option: <span className="font-normal text-[#1d1210]/70">{variant ? variantLabel(variant, variants.indexOf(variant)) : 'Choose one'}</span></p>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v, i) => {
                    const on = variant?.id === v.id
                    const out = v.stockQuantity != null && variantStock(v) <= 0
                    return (
                      <button key={v.id} type="button" disabled={out} aria-pressed={on} onClick={() => { setVariant(v); setQty((q) => Math.max(1, Math.min(q, v.stockQuantity != null ? variantStock(v) : 999))) }}
                        className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-sm transition ${on ? 'border-[#c8102e] bg-[#fff5f5]' : 'border-[#1d1210]/10 hover:border-[#1d1210]/30'} ${out ? 'cursor-not-allowed opacity-40 line-through' : ''}`}>
                        {isUsableImage(v.image) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={optimizedImg(v.image, 72)} alt="" className="h-9 w-9 rounded-lg object-contain" loading="lazy" />}
                        <span><b className="block">{variantLabel(v, i)}</b>{pricesDiffer && <span className="block text-xs text-[#1d1210]/60">{tsh(Number(v.price))}</span>}</span>
                        {on && <Check className="h-4 w-4 text-[#c8102e]" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold">Quantity</span>
              <div className="flex items-center rounded-full bg-[#f7f1e8]">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white" aria-label="Fewer"><Minus className="h-4 w-4" /></button>
                <input value={qty} inputMode="numeric" aria-label="Quantity" onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '')) || 1; setQty(Math.max(1, Math.min(n, maxQty || 1))) }} className="w-12 bg-transparent text-center font-bold outline-none" />
                <button type="button" onClick={() => setQty((q) => Math.min(maxQty || 1, q + 1))} disabled={qty >= maxQty} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white disabled:opacity-40" aria-label="More"><Plus className="h-4 w-4" /></button>
              </div>
              {soldOut ? <span className="text-sm font-bold text-[#c8102e]">Sold out</span> : tracked && stock <= 5 ? <span className="text-sm font-semibold text-amber-700">Only {stock} left</span> : null}
            </div>

            <div ref={buyRef} className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={add} disabled={soldOut} className="flex items-center justify-center gap-2 rounded-full border-2 border-[#160d0c] px-4 py-3 text-sm font-bold transition hover:bg-[#160d0c] hover:text-[#f2c14e] disabled:opacity-40">
                {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}{added ? 'Added' : 'Add to cart'}
              </button>
              <button type="button" onClick={buyNow} disabled={soldOut} className="rounded-full bg-[#c8102e] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#c8102e]/25 transition hover:bg-[#a50d26] disabled:opacity-40">Buy now</button>
            </div>
          </div>

          {/* shipping from China, side by side */}
          <div className="mt-4 rounded-3xl bg-[#160d0c] p-4 text-[#f7f1e8] sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#f2c14e]">Shipping for {qty} {qty === 1 ? 'piece' : 'pieces'}</p>
              <span className="text-[11px] text-[#f7f1e8]/50">you choose at checkout</span>
            </div>
            {settings ? <div className="grid grid-cols-2 gap-3">{shipCard('air', air)}{shipCard('sea', sea)}</div> : <p className="text-sm text-[#f7f1e8]/70">Shipping prices are being updated. Ask us for a price.</p>}
            {settings && !measured && (
              <p className="mt-3 text-sm text-[#f7f1e8]/75">Size and weight are not listed yet. <b className="text-white">Ask us first</b>, or <b className="text-white">buy now and pay the shipping on arrival</b>: we weigh your parcel at our warehouse and send you the price.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={askLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[#f2c14e]/50 px-3.5 py-2 text-xs font-bold text-[#f2c14e] hover:bg-[#f2c14e] hover:text-[#160d0c]"><MessageCircle className="h-4 w-4" /> Ask the desk</a>
              <a href={bulkLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-xs font-bold hover:border-white/60"><PackageCheck className="h-4 w-4" /> Bulk quote</a>
            </div>
          </div>

          <ul className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <li className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-[#1d1210]/10"><Smartphone className="h-4 w-4 shrink-0 text-[#c8102e]" />Pay in TSh, mobile money</li>
            <li className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-[#1d1210]/10"><ShieldCheck className="h-4 w-4 shrink-0 text-[#c8102e]" /><span>{returnDays}-day <Link href="/support/returns-refunds" className="underline">returns</Link></span></li>
            <li className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-[#1d1210]/10"><PackageCheck className="h-4 w-4 shrink-0 text-[#c8102e]" />China items ship together</li>
          </ul>
        </section>
      </div>

      {/* the import journey */}
      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6" aria-label="How your import travels">
        <ol className="grid gap-3 rounded-3xl bg-white p-4 ring-1 ring-[#1d1210]/10 sm:grid-cols-4 sm:p-6">
          {[
            { t: 'You order and pay', d: 'Mobile money, in TSh' },
            { t: 'We buy it in China', d: 'once your payment is confirmed' },
            { t: 'It travels to Tanzania', d: settings ? `air ${settings.air.daysMin}–${settings.air.daysMax} days · sea ${settings.sea.daysMin}–${settings.sea.daysMax} days` : 'by air or by sea' },
            { t: 'Delivered or picked up', d: settings && arrive(settings.air.daysMin, settings.air.daysMax) ? `by air around ${arrive(settings.air.daysMin, settings.air.daysMax)}` : 'anywhere in Tanzania' },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-3 sm:flex-col">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#160d0c] text-sm font-black text-[#f2c14e]">{i + 1}</span>
              <span><b className="block text-sm">{s.t}</b><span className="text-xs text-[#1d1210]/60">{s.d}</span></span>
            </li>
          ))}
        </ol>
      </section>

      {/* shipping per piece by quantity (only when size and weight are known) */}
      {settings && measured && (
        <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6" aria-label="Shipping per piece">
          <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-[#1d1210]/10">
            <p className="px-5 pt-4 text-lg font-black">Buy more, ship cheaper per piece</p>
            <p className="px-5 text-xs text-[#1d1210]/60">Shipping for the whole quantity, and what it comes to per piece.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead><tr className="border-y border-[#1d1210]/10 text-[11px] font-bold uppercase tracking-wider text-[#1d1210]/50"><th className="px-5 py-2">Pieces</th><th className="px-3 py-2 text-right">By air</th><th className="px-5 py-2 text-right">By sea</th></tr></thead>
                <tbody className="divide-y divide-[#1d1210]/5">
                  {QTY_STEPS.map((n) => {
                    const a = quote('air', n), b = quote('sea', n)
                    return (
                      <tr key={n} className={n === qty ? 'bg-[#fff5f5]' : ''}>
                        <td className="px-5 py-2.5 font-bold">{n}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{a ? <>{tsh(a.tzs)}<span className="block text-[11px] text-[#1d1210]/50">{tsh(a.tzs / n)} each</span></> : '—'}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{b ? <>{tsh(b.tzs)}<span className="block text-[11px] text-[#1d1210]/50">{tsh(b.tzs / n)} each</span></> : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* description, specifications and reviews (shared with the regular product page) */}
      <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-white px-4 pb-5 ring-1 ring-[#1d1210]/10 sm:px-6 [&>*:first-child]:mt-0 [&_section]:mt-0">
          <ProductTabs product={shownProduct} />
        </div>
      </section>

      {/* more from the import shelf */}
      {related.length > 0 && (
        <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6" aria-label="More from the import shelf">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-2xl font-black tracking-tight">More from the import shelf</h2>
            <Link href="/buy-from-china#catalogue" className="flex shrink-0 items-center text-sm font-bold text-[#c8102e] hover:underline">All <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {related.map((r) => (
              <li key={r.id} className="w-40 shrink-0 sm:w-48">
                <Link href={`/buy-from-china/${r.id}`} className="group block overflow-hidden rounded-2xl bg-white ring-1 ring-[#1d1210]/10 transition hover:ring-[#c8102e]/40">
                  <span className="relative block aspect-square overflow-hidden bg-[#fbf6ee]">{r.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={optimizedImg(r.image, 260)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-2 transition group-hover:scale-[1.04]" />}</span>
                  <span className="block p-2.5"><span className="line-clamp-2 text-[13px] font-semibold leading-snug">{r.name}</span><b className="mt-1 block text-sm">{tsh(r.price)}</b></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* phone: sticky buy bar */}
      <div className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#1d1210]/10 bg-[#f7f1e8]/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform lg:hidden ${sticky ? 'translate-y-0' : 'translate-y-full'}`} aria-hidden={!sticky}>
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <span className="min-w-0 flex-1"><b className="block truncate text-sm">{tsh(price)}</b><span className="block truncate text-[11px] text-[#1d1210]/60">{qty} × {variant ? variantLabel(variant, variants.indexOf(variant)) : product.name}</span></span>
          <button type="button" onClick={add} disabled={soldOut} tabIndex={sticky ? 0 : -1} className="grid h-11 w-11 place-items-center rounded-full border-2 border-[#160d0c] disabled:opacity-40" aria-label="Add to cart">{added ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}</button>
          <button type="button" onClick={buyNow} disabled={soldOut} tabIndex={sticky ? 0 : -1} className="h-11 rounded-full bg-[#c8102e] px-6 text-sm font-bold text-white disabled:opacity-40">Buy now</button>
        </div>
      </div>
    </main>
  )
}
