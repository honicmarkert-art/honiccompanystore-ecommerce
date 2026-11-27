"use client"

/**
 * Buy from China product page (its own look: ink, red and gold). Cart and checkout are the shop's.
 * Shipping estimate by air or sea for the chosen quantity, from the same calculation checkout uses
 * (lib/import-freight.ts). Items without size/weight: ask the desk first, or buy and pay shipping on arrival.
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, MessageCircle, Minus, Plane, Plus, Ship, ShoppingCart, Star } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { useToast } from '@/hooks/use-toast'
import { optimizedImg } from '@/lib/image-optimize'
import { quoteFreight, isMeasured, type FreightMode, type FreightSettings } from '@/lib/import-freight'
import { galleryImages, isUsableImage, totalStock, variantLabel, variantStock, type ProductDetail, type ProductVariantDetail } from '@/app/products/[id]/_components/utils'

const tsh = (n: number) => `TSh ${Math.round(n).toLocaleString('en-US')}`
type Size = { weightKg: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null }

export function ChinaProduct({ product, size, settings, returnDays, askLink }: { product: ProductDetail; size: Size; settings: FreightSettings | null; returnDays: number; askLink: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const { addItem } = useCart()
  const variants = product.variants || []
  const [variant, setVariant] = useState<ProductVariantDetail | null>(variants.find((v) => variantStock(v) > 0) ?? variants[0] ?? null)
  const [qty, setQty] = useState(1)
  const [mode, setMode] = useState<FreightMode>('air')
  const [shot, setShot] = useState(0)
  const [added, setAdded] = useState(false)

  const images = useMemo(() => galleryImages(product), [product])
  const focus = variant?.image && isUsableImage(variant.image) ? images.indexOf(variant.image) : -1
  const shown = images[focus >= 0 ? focus : shot] || images[0]
  const price = Number(variant?.price) || product.price || 0
  const was = Number(variant?.originalPrice || (!variant ? product.originalPrice : 0) || 0)
  const stock = variant ? variantStock(variant) : totalStock(product)
  const tracked = variant ? variant.stockQuantity != null : product.stockQuantity != null
  const maxQty = tracked ? Math.max(0, stock) : 999
  const soldOut = tracked && stock <= 0
  const pricesDiffer = new Set(variants.map((v) => Number(v.price))).size > 1
  // importer bookkeeping (taobao ids, source, listing language) is not a specification for shoppers
  const internalKey = (k: string) => /^(taobao|source$|listing$|language$|import_|_)/i.test(k.trim())
  const specs = Object.entries({ ...(product.specifications || {}), ...(variant?.specifications || {}) }).filter(([k, v]) => !internalKey(k) && v != null && String(v).trim() !== '')

  const measured = isMeasured({ quantity: 1, ...size })
  const est = settings && measured ? quoteFreight([{ quantity: qty, ...size }], mode, settings) : null
  const other = settings && measured ? quoteFreight([{ quantity: qty, ...size }], mode === 'air' ? 'sea' : 'air', settings) : null
  const days = settings ? (mode === 'air' ? settings.air : settings.sea) : null

  const add = () => {
    if (soldOut) return false
    if (variants.length && !variant) { toast({ title: 'Choose an option first', variant: 'destructive' }); return false }
    addItem(product.id, qty, variant?.id?.toString(), {}, price, variant?.sku ?? undefined, variant?.image ?? undefined, product)
    setAdded(true); setTimeout(() => setAdded(false), 1800)
    toast({ title: 'Added to cart', description: `${qty} × ${product.name}${variant ? ` (${variantLabel(variant, variants.indexOf(variant))})` : ''}. Choose air or sea at checkout.` })
    return true
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">
      <Link href="/buy-from-china" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#c8102e] hover:underline"><ArrowLeft className="h-4 w-4" /> Buy from China</Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">
        {/* gallery */}
        <section aria-label="Photos" className="min-w-0">
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-[#1d1210]/10 bg-white">
            {shown
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={optimizedImg(shown, 900, 80)} alt={product.name} className="h-full w-full object-contain p-4" />
              : <span className="grid h-full place-items-center text-6xl font-black text-[#c8102e]/15" aria-hidden>进口</span>}
            <span className="absolute left-3 top-3 rounded-full bg-[#160d0c] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#f2c14e]">From China</span>
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.slice(0, 12).map((src, i) => (
                <button key={src} type="button" onClick={() => { setShot(i); if (variant?.image) setVariant(variant) }} aria-label={`Photo ${i + 1}`}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${shown === src ? 'border-[#c8102e]' : 'border-transparent ring-1 ring-[#1d1210]/10'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={optimizedImg(src, 128)} alt="" className="h-full w-full object-contain" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* buy box */}
        <section aria-label="Buy" className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#c8102e]">{product.category || 'Imported to order'}</p>
          <h1 className="mt-1 break-words text-2xl font-black leading-tight tracking-tight sm:text-3xl">{product.name}</h1>
          {(product.reviews ?? 0) > 0 && <p className="mt-1 flex items-center gap-1 text-sm text-[#1d1210]/60"><Star className="h-4 w-4 fill-[#f2c14e] text-[#f2c14e]" />{Number(product.rating).toFixed(1)} · {product.reviews} reviews</p>}

          <div className="mt-4 flex flex-wrap items-baseline gap-x-3">
            <span className="text-3xl font-black">{tsh(price)}</span>
            {was > price && <span className="text-base text-[#1d1210]/40 line-through">{tsh(was)}</span>}
          </div>
          <p className="text-xs text-[#1d1210]/60">Item price. Shipping from China is added at checkout.</p>

          {variants.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-bold">Option: <span className="font-normal text-[#1d1210]/70">{variant ? variantLabel(variant, variants.indexOf(variant)) : 'Choose one'}</span></p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v, i) => {
                  const on = variant?.id === v.id
                  const out = v.stockQuantity != null && variantStock(v) <= 0
                  return (
                    <button key={v.id} type="button" disabled={out} aria-pressed={on} onClick={() => { setVariant(v); setQty((q) => Math.max(1, Math.min(q, v.stockQuantity != null ? variantStock(v) : 999))) }}
                      className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-sm transition ${on ? 'border-[#c8102e] bg-white' : 'border-[#1d1210]/10 bg-white/60 hover:border-[#1d1210]/30'} ${out ? 'cursor-not-allowed opacity-40 line-through' : ''}`}>
                      {isUsableImage(v.image) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={optimizedImg(v.image, 72)} alt="" className="h-9 w-9 rounded-lg object-contain" loading="lazy" />}
                      <span><b className="block">{variantLabel(v, i)}</b>{pricesDiffer && <span className="block text-xs text-[#1d1210]/60">{tsh(Number(v.price))}</span>}</span>
                      {on && <Check className="h-4 w-4 text-[#c8102e]" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <span className="text-sm font-bold">Quantity</span>
            <div className="flex items-center rounded-full border border-[#1d1210]/15 bg-white">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#f7f1e8]" aria-label="Fewer"><Minus className="h-4 w-4" /></button>
              <input value={qty} inputMode="numeric" aria-label="Quantity" onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '')) || 1; setQty(Math.max(1, Math.min(n, maxQty || 1))) }} className="w-12 bg-transparent text-center font-bold outline-none" />
              <button type="button" onClick={() => setQty((q) => Math.min(maxQty || 1, q + 1))} disabled={qty >= maxQty} className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#f7f1e8] disabled:opacity-40" aria-label="More"><Plus className="h-4 w-4" /></button>
            </div>
            {soldOut && <span className="text-sm font-bold text-[#c8102e]">Sold out</span>}
          </div>

          {/* shipping from China */}
          <div className="mt-6 overflow-hidden rounded-3xl bg-[#160d0c] text-[#f7f1e8]">
            <div className="grid grid-cols-2">
              {(['air', 'sea'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                  className={`flex items-center justify-center gap-2 py-3 text-sm font-bold transition ${mode === m ? 'bg-[#c8102e] text-white' : 'text-[#f7f1e8]/70 hover:text-white'}`}>
                  {m === 'air' ? <Plane className="h-4 w-4" /> : <Ship className="h-4 w-4" />}{m === 'air' ? 'By air' : 'By sea'}
                </button>
              ))}
            </div>
            <div className="p-5">
              {!settings ? <p className="text-sm text-[#f7f1e8]/70">Shipping prices are being updated. Ask us for a price.</p>
                : measured && est ? (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#f2c14e]">Estimated shipping for {qty}</p>
                    <p className="mt-1 text-3xl font-black">{tsh(est.tzs)}</p>
                    <p className="mt-1 text-sm text-[#f7f1e8]/70">About {est.daysMin}–{est.daysMax} days · {est.chargeable} {est.unit} at ${est.rateUsd} per {est.unit}</p>
                    {other && <p className="mt-2 text-xs text-[#f7f1e8]/60">{other.mode === 'air' ? 'By air' : 'By sea'}: {tsh(other.tzs)}, about {other.daysMin}–{other.daysMax} days</p>}
                    <p className="mt-3 text-xs text-[#f7f1e8]/60">Several China items in one order travel together, which usually costs less per item. Checkout shows the final amount.</p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#f2c14e]">Size and weight not listed yet</p>
                    <p className="mt-1 text-sm text-[#f7f1e8]/80">{mode === 'air' ? `Air: $${settings.air.tiers[0]?.usd} per kg (or volume weight), about ${days?.daysMin}–${days?.daysMax} days.` : `Sea: $${settings.sea.tiers[0]?.usd} per CBM, about ${days?.daysMin}–${days?.daysMax} days.`} Two ways to go:</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      <li className="flex gap-2"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#f2c14e] text-[11px] font-black text-[#160d0c]">1</span><span><b>Ask us first</b> for the exact shipping price.</span></li>
                      <li className="flex gap-2"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#f2c14e] text-[11px] font-black text-[#160d0c]">2</span><span><b>Buy now</b> and pay the shipping on arrival: we weigh your parcel at our warehouse and send you the price.</span></li>
                    </ul>
                    <a href={askLink} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#f2c14e]/60 px-4 py-2 text-sm font-bold text-[#f2c14e] hover:bg-[#f2c14e] hover:text-[#160d0c]"><MessageCircle className="h-4 w-4" /> Ask the desk</a>
                  </>
                )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={add} disabled={soldOut} className="flex items-center justify-center gap-2 rounded-full border-2 border-[#160d0c] px-4 py-3 text-sm font-bold transition hover:bg-[#160d0c] hover:text-[#f2c14e] disabled:opacity-40">
              {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}{added ? 'Added' : 'Add to cart'}
            </button>
            <button type="button" onClick={() => { if (add()) setTimeout(() => router.push('/cart'), 150) }} disabled={soldOut} className="rounded-full bg-[#c8102e] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#c8102e]/25 transition hover:bg-[#a50d26] disabled:opacity-40">Buy now</button>
          </div>
          <p className="mt-3 text-xs text-[#1d1210]/60">Pay in TSh with mobile money. Report a problem within {returnDays} days of delivery or pickup (<Link href="/support/returns-refunds" className="underline">returns policy</Link>).</p>
        </section>
      </div>

      {/* details */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] [&>*]:min-w-0">
        {product.description && (
          <section className="rounded-3xl border border-[#1d1210]/10 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-black">About this item</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#1d1210]/80">{product.description}</p>
          </section>
        )}
        <section className="rounded-3xl border border-[#1d1210]/10 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-black">Specifications{variant?.specifications && Object.keys(variant.specifications).length ? <span className="ml-2 text-xs font-semibold text-[#c8102e]">for {variantLabel(variant, variants.indexOf(variant))}</span> : null}</h2>
          {specs.length === 0 && !measured ? <p className="mt-2 text-sm text-[#1d1210]/60">No specifications listed.</p> : (
            <dl className="mt-3 divide-y divide-[#1d1210]/10 text-sm">
              {specs.slice(0, 40).map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-[#1d1210]/60">{k}</dt><dd className="text-right font-semibold">{String(v)}</dd></div>)}
              {measured && <div className="flex justify-between gap-4 py-2"><dt className="text-[#1d1210]/60">Packed size / weight</dt><dd className="text-right font-semibold">{size.lengthCm}×{size.widthCm}×{size.heightCm} cm · {size.weightKg} kg</dd></div>}
            </dl>
          )}
        </section>
      </div>
    </main>
  )
}
