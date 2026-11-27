"use client"

/**
 * Cart — same look as the Marketplace and Checkout.
 * - Every item is ticked by default; untick what you don't want to buy now.
 * - Per item: quantity stepper (stock limit), save for later, wishlist, remove.
 * - Any quantity is allowed. The only floor is the payment gateway's: an order must total at least
 *   TSh 500 (Snippe rejects smaller payments), so checkout is blocked below that with a clear note.
 * - Free-delivery progress, promo code, sticky summary (desktop) / sticky checkout bar (phones).
 * Checkout reads `selected_cart_items` and `applied_promotion` from sessionStorage (unchanged contract).
 */

import { BuyerRouteGuard } from "@/components/buyer-route-guard"
import { useState, useEffect, useMemo, useRef, useCallback, startTransition, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bookmark,
  Check,
  Heart,
  Loader2,
  Lock,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Ticket,
  Trash2,
  Truck,
  X,
  HandCoins,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useCart, type CartItem } from "@/hooks/use-cart"
import { useStock } from "@/hooks/use-stock"
import { useWishlist } from "@/hooks/use-wishlist"
import { useSavedLater } from "@/hooks/use-saved-later"
import { useCurrency } from "@/contexts/currency-context"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { ValidationModal } from "@/components/ui/validation-modal"
import { BrandLogo } from "@/components/brand-logo"
import { optimizedImg } from '@/lib/image-optimize'
import { getClientShippingPricing } from "@/lib/shipping-calculator"

/** Snippe (mobile money) refuses payments under TSh 500. */
import { MIN_PAYMENT_TZS } from "@/lib/policies"
import { whatsappLink } from "@/lib/contact"
const noopSubscribe = () => () => {}

type Extra = CartItem & {
  supplierCompanyName?: string
  supplierIsVerified?: boolean
  supplierRegion?: string
  supplierNation?: string
  free_delivery?: boolean
  freeDelivery?: boolean
  import_china?: boolean
  importChina?: boolean
}

type Rec = { id: number; name: string; price: number; originalPrice?: number; image?: string | null; slug?: string }

/** Popular products for "You might also need": one shared request, started as soon as the cart page opens. */
let recsRequest: Promise<Rec[]> | null = null
function loadRecs(): Promise<Rec[]> {
  if (!recsRequest) {
    recsRequest = fetch("/api/search?sort=popular&limit=16")
      .then((r) => r.json())
      .then((d) => (Array.isArray(d?.products) ? (d.products as Rec[]) : []))
      .catch(() => { recsRequest = null; return [] })
  }
  return recsRequest
}

const productHref = (id: number, name?: string) => `/products/${id}-${encodeURIComponent(name || "product")}?returnTo=${encodeURIComponent("/cart")}`

export default function CartPage() {
  return (
    <BuyerRouteGuard>
      <CartPageContent />
    </BuyerRouteGuard>
  )
}

function CartPageContent() {
  const router = useRouter()
  const { cart, updateItemQuantity, removeItem, cartSubtotal, clearCart, isLoading, hasLoaded } = useCart()
  const { getStock, fetchStock } = useStock()
  const { formatPrice } = useCurrency()
  const { toast } = useToast()
  const { user } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const { items: wishlistItems, add: addToWishlist, remove: removeFromWishlist } = useWishlist()
  const { add: addToSavedLater } = useSavedLater()
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false)
  // start loading recommendations in parallel with the cart, not after it
  useEffect(() => { loadRecs() }, [])

  const { freeThresholdTz: FREE_THRESHOLD } = getClientShippingPricing()

  /* ----- selection: everything ticked unless the shopper unticks it ----- */
  const [excluded, setExcluded] = useState<Record<number, true>>({})
  const isSelected = (id: number) => !excluded[id]
  const selectedItems = cart.filter((i) => isSelected(i.productId))
  const allSelected = cart.length > 0 && selectedItems.length === cart.length
  const toggleSelected = (id: number) =>
    setExcluded((prev) => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = true
      return next
    })
  const toggleAll = () => setExcluded(allSelected ? Object.fromEntries(cart.map((i) => [i.productId, true as const])) : {})

  const selectedSubtotal = selectedItems.reduce((s, i) => s + (i.totalPrice || 0), 0)
  const selectedQty = selectedItems.reduce((s, i) => s + (i.variants?.reduce((n, v) => n + (v.quantity || 0), 0) || i.totalQuantity || 0), 0)


  /* ----- promo (valid only for the subtotal it was checked against) ----- */
  const [promoCode, setPromoCode] = useState("")
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoError, setPromoError] = useState("")
  const [applyingPromo, setApplyingPromo] = useState(false)
  const [promotion, setPromotion] = useState<{ code: string; name: string; discountAmount: number; forSubtotal: number } | null>(null)
  const promoValid = !!promotion && promotion.forSubtotal === selectedSubtotal
  const discount = promoValid ? promotion!.discountAmount : 0
  const total = Math.max(0, selectedSubtotal - discount)
  // under TSh 500 is still allowed: checkout adds a small "Mobile money minimum" top-up if needed
  const belowMinimum = selectedItems.length > 0 && total > 0 && total < MIN_PAYMENT_TZS

  // "Ask for a better price": the selected items, ready to send on WhatsApp (bargaining for the whole cart)
  const offerHref = (() => {
    if (!selectedItems.length) return null
    const lines = selectedItems.flatMap((it) => {
      const name = it.product?.name || `Product ${it.productId}`
      const rows: { qty: number; price: number; option: string }[] = it.variants?.length
        ? it.variants.map((v) => ({ qty: Number(v.quantity) || 1, price: Number(v.price) || 0, option: String(v.variant_name || '') }))
        : [{ qty: it.totalQuantity || 1, price: (it.totalPrice || 0) / Math.max(1, it.totalQuantity || 1), option: '' }]
      return rows.map((r) => `- ${r.qty} × ${name}${r.option && r.option !== 'Default' ? ` (${r.option})` : ''}: ${formatPrice(r.price * r.qty)}`)
    })
    return whatsappLink(['Habari Honic, naomba punguzo kwa kikapu changu 🙏', 'Hello Honic, can you give me a better price for my cart?', '', ...lines, '', `Jumla / Total: ${formatPrice(total)}`, 'Bei yangu / My offer: '].join(String.fromCharCode(10)))
  })()

  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  // Warm up the checkout page so pressing Checkout opens instantly.
  useEffect(() => {
    router.prefetch("/checkout")
  }, [router])

  /* ----- live stock for the items in the cart (debounced, only when the product set changes) ----- */
  const ids = useMemo(() => Array.from(new Set(cart.map((i) => i.productId))).sort((a, b) => a - b), [cart])
  const idsKey = ids.join(",")
  const lastKey = useRef("")
  useEffect(() => {
    if (!idsKey || idsKey === lastKey.current) return
    lastKey.current = idsKey
    const t = setTimeout(() => fetchStock(idsKey.split(",").map(Number)), 400)
    return () => clearTimeout(t)
  }, [idsKey, fetchStock])

  /* ----- quantity rules ----- */
  const stockFor = useCallback(
    (item: CartItem) => getStock(item.productId)?.stockQuantity ?? item.product?.stockQuantity ?? null,
    [getStock]
  )

  const setQuantity = (item: CartItem, variantId: string, next: number) => {
    if (next < 1) return
    const stock = stockFor(item)
    if (stock !== null && next > stock) {
      toast({ title: "Not enough stock", description: `Only ${stock} available.`, variant: "destructive" })
          return
        }
        startTransition(() => {
      updateItemQuantity(item.productId, next, variantId)
    })
  }

  const remove = (item: CartItem, variantId?: string) => {
        startTransition(() => {
      removeItem(item.productId, variantId)
    })
    toast({ title: "Removed", description: item.product?.name || "Item removed from your cart." })
  }

  const saveForLater = async (item: CartItem) => {
    setBusy(`save-${item.productId}`)
    try {
      await addToSavedLater(item.productId)
      removeItem(item.productId)
      toast({ title: "Saved for later", description: item.product?.name })
    } finally {
      setBusy(null)
    }
  }

  const inWishlist = (id: number) => wishlistItems.some((w) => w.productId === id)
  const toggleWishlist = async (item: CartItem) => {
    if (inWishlist(item.productId)) {
      await removeFromWishlist(item.productId)
      toast({ title: "Removed from wishlist" })
    } else {
      await addToWishlist(item.productId)
      toast({ title: "Added to wishlist", description: item.product?.name })
    }
  }

  const applyPromo = async () => {
    const code = promoCode.trim()
    if (!code || applyingPromo) return
    setApplyingPromo(true)
    setPromoError("")
    try {
      const res = await fetch("/api/promotions/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          cartItems: selectedItems.map((i) => ({ productId: i.productId, product_id: i.productId, price: i.totalPrice / (i.totalQuantity || 1), quantity: i.totalQuantity || 1 })),
          subtotal: selectedSubtotal,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setPromotion({ code: result.promotion.code, name: result.promotion.name, discountAmount: result.promotion.discountAmount, forSubtotal: selectedSubtotal })
        setPromoCode("")
        toast({ title: "Code applied", description: `${result.promotion.name}: −${formatPrice(result.promotion.discountAmount)}` })
      } else {
        setPromoError(result.error || "This code isn't valid.")
      }
    } catch {
      setPromoError("Couldn't check the code. Try again.")
    } finally {
      setApplyingPromo(false)
    }
  }

  const checkout = () => {
    const selectedIds = selectedItems.map((i) => i.productId)
    if (selectedIds.length === 0) {
      toast({ title: "Nothing selected", description: "Tick at least one item to check out.", variant: "destructive" })
      return
    }
    try { 
      if (selectedIds.every((id) => typeof id === "number" && id > 0)) sessionStorage.setItem("selected_cart_items", JSON.stringify(selectedIds))
      if (promoValid && promotion) {
        sessionStorage.setItem("applied_promotion", JSON.stringify({ code: promotion.code, discountAmount: promotion.discountAmount, name: promotion.name }))
      } else {
        sessionStorage.removeItem("applied_promotion")
      }
      sessionStorage.removeItem("buy_now_mode")
      sessionStorage.removeItem("buy_now_item_data")
    } catch {}
    router.push("/checkout")
  }

  /* ----- grouping by supplier (only shown when there is more than one) ----- */
  const groups = useMemo(() => {
    const map = new Map<string, { name: string | null; verified: boolean; place: string; items: Extra[] }>()
    for (const raw of cart) {
      const item = raw as Extra
      const key = item.supplierCompanyName || "honic"
      if (!map.has(key)) {
        map.set(key, {
          name: item.supplierCompanyName || null,
          verified: !!item.supplierIsVerified,
          place: [item.supplierRegion, item.supplierNation].filter(Boolean).join(", "),
          items: [],
        })
      }
      map.get(key)!.items.push(item)
    }
    return Array.from(map.values())
  }, [cart])

  const freeLeft = Math.max(0, FREE_THRESHOLD - selectedSubtotal)
  const freeProgress = Math.min(100, Math.round((selectedSubtotal / FREE_THRESHOLD) * 100))
  const lineCount = cart.reduce((n, i) => n + (i.variants?.length || 1), 0)

  /* ----- pieces ----- */
  const header = (
    <>
    <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link href="/products" aria-label="Back to the Marketplace" className="grid h-9 w-9 place-items-center rounded-full text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950">
            <ArrowLeft className="h-5 w-5" />
            </Link>
          <BrandLogo size="md" href="/products" textClassName="hidden min-[380px]:flex" />
              </div>
        <div className="flex items-center gap-2">
          {!user && (
            <button type="button" onClick={() => openAuthModal("login")} className="rounded-full px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100">
                        Sign in
                      </button>
          )}
          <Link href="/products" className="hidden rounded-full border border-neutral-200 px-3.5 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 sm:inline-flex">
            Continue shopping
          </Link>
          </div>
        </div>
      </header>
    </>
  )

  const summary = (
    <div className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm">
      <div className="px-5 pt-5">
        <h2 className="text-base font-bold text-neutral-950">Order summary</h2>
          </div>

      {/* free delivery progress */}
      <div className="mx-5 mt-4 rounded-2xl bg-neutral-50 p-3">
        <p className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
          <Truck className={cn("h-4 w-4", freeLeft === 0 ? "text-emerald-600" : "text-orange-500")} />
          {freeLeft === 0 ? <>Free delivery<span className="font-normal text-neutral-500"> · large items keep a handling fee</span></> : <>Add <span className="tabular-nums text-neutral-950">{formatPrice(freeLeft)}</span> more for free delivery</>}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div className={cn("h-full rounded-full transition-all duration-500", freeLeft === 0 ? "bg-emerald-500" : "bg-gradient-to-r from-orange-400 to-orange-600")} style={{ width: `${freeProgress}%` }} />
            </div>
          </div>

      <dl className="space-y-2 px-5 py-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-500">Items ({selectedQty})</dt>
          <dd className="font-semibold tabular-nums">{formatPrice(selectedSubtotal)}</dd>
              </div>
        {promoValid && promotion && (
          <div className="flex items-center justify-between text-emerald-700">
            <dt className="flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5" />
              {promotion.code}
              <button type="button" onClick={() => setPromotion(null)} aria-label="Remove code" className="grid h-4 w-4 place-items-center rounded-full hover:bg-emerald-100">
                <X className="h-3 w-3" />
              </button>
            </dt>
            <dd className="font-semibold tabular-nums">−{formatPrice(discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-neutral-500">Delivery</dt>
          <dd className="text-xs font-medium text-neutral-400">Calculated at checkout</dd>
                    </div>
        <div className="flex items-end justify-between border-t border-neutral-100 pt-3">
          <dt className="font-bold text-neutral-950">Total</dt>
          <dd className="text-2xl font-black tabular-nums tracking-tight text-neutral-950">{formatPrice(total)}</dd>
                    </div>
      </dl>

      {/* promo code */}
      <div className="px-5 pb-4">
        {promotion && !promoValid && (
          <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Your selection changed. Apply <b>{promotion.code}</b> again to update the discount.</p>
        )}
        {promoOpen || (promotion && !promoValid) ? (
          <div>
            <div className="flex gap-2">
              <input
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError("") }}
                onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                placeholder="Promo code"
                aria-label="Promo code"
                className="h-10 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 text-sm uppercase tracking-wider outline-none placeholder:normal-case placeholder:tracking-normal focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15"
              />
              <button type="button" onClick={applyPromo} disabled={!promoCode.trim() || applyingPromo} className="h-10 rounded-xl bg-neutral-950 px-4 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-40">
                {applyingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
              </button>
                    </div>
            {promoError && <p className="mt-1.5 text-xs text-red-600">{promoError}</p>}
                  </div>
        ) : !promoValid ? (
          <button type="button" onClick={() => setPromoOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700">
            <Ticket className="h-4 w-4" /> Have a promo code?
          </button>
        ) : null}
                </div>

      {belowMinimum && (
        <p className="mx-5 mb-3 rounded-xl bg-stone-50 px-3 py-2 text-xs text-neutral-600">
          Mobile money payments start at <b>{formatPrice(MIN_PAYMENT_TZS)}</b>. If your total stays under that (for example with store pickup), checkout adds the difference as its own line.
        </p>
      )}

      {offerHref && (
        <a href={offerHref} target="_blank" rel="noopener noreferrer" className="mx-5 mb-3 flex items-center justify-center gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-sm font-bold text-orange-800 ring-1 ring-orange-200 hover:bg-orange-100">
          <HandCoins className="h-4 w-4" /> Omba punguzo · Ask for a better price
        </a>
      )}

      <div className="hidden px-5 pb-5 lg:block">
        <button
          type="button"
          onClick={checkout}
          disabled={selectedItems.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Checkout {selectedItems.length > 0 && `(${selectedQty})`}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-px border-t border-neutral-100 bg-neutral-100 text-center text-[11px] font-semibold text-neutral-600">
        {[
          { icon: Lock, label: "Secure payment" },
          { icon: ShieldCheck, label: "Buyer protection" },
          { icon: Truck, label: "Delivery across TZ" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1 bg-white px-2 py-3">
            <Icon className="h-4 w-4 text-orange-500" />
            {label}
                                    </div>
        ))}
                                    </div>
                                </div>
  )

  const renderLine = (item: Extra, variant: CartItem["variants"][number], showSave: boolean) => {
    const name = item.product?.name || `Product ${item.productId}`
    const price = variant.price || item.totalPrice / (item.totalQuantity || 1)
    const qty = variant.quantity || 1
    const original = item.product?.originalPrice
    const off = original && original > price ? Math.round(((original - price) / original) * 100) : 0
    const stock = stockFor(item)
    const low = stock !== null && stock > 0 && stock <= 5
    const out = stock === 0
    const china = item.import_china === true || item.importChina === true
    const freeDelivery = item.free_delivery === true || item.freeDelivery === true
    const selected = isSelected(item.productId)
    const variantName = variant.variant_name && variant.variant_name !== "Default" ? variant.variant_name : ""

                      return (
      <li key={`${item.productId}-${variant.variantId}`} className={cn("flex gap-3 py-4 transition-opacity sm:gap-4", !selected && "opacity-55")}>
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`${selected ? "Untick" : "Tick"} ${name}`}
          onClick={() => toggleSelected(item.productId)}
                          className={cn(
            "mt-7 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition sm:mt-9",
            selected ? "border-orange-500 bg-orange-500 text-white" : "border-neutral-300 bg-white hover:border-neutral-400"
          )}
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>

        <Link href={productHref(item.productId, name)} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 sm:h-24 sm:w-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={optimizedImg(variant.image || item.product?.image, 96)} alt="" className="h-full w-full object-contain p-1.5" loading="lazy" />
          {off > 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">−{off}%</span>}
                                  </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={productHref(item.productId, name)} className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900 hover:text-orange-600">
                {name}
              </Link>
              {variantName && <p className="mt-0.5 truncate text-xs text-neutral-500">{variantName}</p>}
                                  </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold tabular-nums text-neutral-950 sm:text-base">{formatPrice(price * qty)}</p>
              {qty > 1 && <p className="text-[11px] tabular-nums text-neutral-400">{formatPrice(price)} each</p>}
            </div>
                                </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium">
            {out ? (
              <span className="text-red-600">Out of stock</span>
            ) : low ? (
              <span className="text-amber-600">Only {stock} left</span>
            ) : stock !== null ? (
              <span className="text-emerald-600">In stock</span>
            ) : null}
            <span className="flex items-center gap-1 text-neutral-500">
              <Truck className="h-3 w-3" />
              {china ? "From China · air or sea, chosen at checkout" : "Dar 1–2 days · regions 2–6 days"}
              {freeDelivery && <span className="font-semibold text-emerald-600">· free delivery</span>}
            </span>
            {original && original > price && <span className="text-neutral-400 line-through">{formatPrice(original)}</span>}
                                      </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-full border border-neutral-200 bg-white">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={qty <= 1}
                  onClick={() => setQuantity(item, variant.variantId, qty - 1)}
                  className="grid h-8 w-8 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                                        type="number"
                  inputMode="numeric"
                  min={1}
                  value={qty}
                  aria-label="Quantity"
                                        onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    if (!Number.isNaN(n)) setQuantity(item, variant.variantId, n)
                  }}
                  className="w-10 bg-transparent text-center text-sm font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={stock !== null && qty >= stock}
                  onClick={() => setQuantity(item, variant.variantId, qty + 1)}
                  className="grid h-8 w-8 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
                            </div>

            <div className="flex items-center gap-0.5 text-neutral-500">
              {showSave && (
                <button
                  type="button"
                  onClick={() => saveForLater(item)}
                  disabled={busy === `save-${item.productId}`}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Save for later</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleWishlist(item)}
                aria-label={inWishlist(item.productId) ? "Remove from wishlist" : "Add to wishlist"}
                className={cn("grid h-8 w-8 place-items-center rounded-full hover:bg-neutral-100", inWishlist(item.productId) && "text-red-500")}
              >
                <Heart className={cn("h-4 w-4", inWishlist(item.productId) && "fill-current")} />
              </button>
              <button
                type="button"
                onClick={() => remove(item, variant.variantId)}
                aria-label="Remove from cart"
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
                                    </div>
                                    </div>
                                  </div>
      </li>
    )
  }

  /* ----- render ----- */
  if (!isClient || ((isLoading || !hasLoaded) && cart.length === 0)) {
    return (
      <div className="min-h-screen bg-[#f6f6f7]">
        {header}
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-3 rounded-3xl bg-white p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="h-24 w-24 animate-pulse rounded-2xl bg-neutral-100" />
                <div className="flex-1 space-y-2 pt-2">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-100" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-100" />
                                    </div>
                                  </div>
            ))}
                        </div>
          <div className="hidden h-80 animate-pulse rounded-3xl bg-white lg:block" />
                      </div>
                              </div>
    )
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#f6f6f7]">
        {header}
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <span className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-orange-100 text-orange-600">
            <ShoppingBag className="h-9 w-9" />
                                </span>
          <h1 className="mt-5 text-2xl font-black tracking-tight">Your cart is empty</h1>
          <p className="mt-2 text-sm text-neutral-500">Browse the store, or describe what you need and let AI find it.</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href="/products" className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600">
              Browse the Marketplace
            </Link>
            <Link href="/products?mode=ai" className="rounded-2xl border border-neutral-200 bg-white px-6 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-50">
              Ask AI what you need
            </Link>
                              </div>
                            </div>
        <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <Recommendations formatPrice={formatPrice} excludeIds={[]} eager />
                          </div>
                        </div>
                              )
  }

  return (
    <div className="min-h-screen bg-[#f6f6f7] text-neutral-950">
      {header}

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8 lg:pb-16">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-7">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Your cart</h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              {lineCount} {lineCount === 1 ? "item" : "items"} · {formatPrice(cartSubtotal)}
            </p>
                      </div>
          <ol className="flex items-center gap-1.5 text-xs font-semibold" aria-label="Progress">
            {["Cart", "Details", "Payment", "Done"].map((s, i) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className={cn("rounded-full px-2.5 py-1", i === 0 ? "bg-neutral-950 text-white" : "bg-white text-neutral-400 ring-1 ring-neutral-200")}>{s}</span>
                {i < 3 && <span className="h-px w-3 bg-neutral-300 sm:w-5" />}
              </li>
            ))}
          </ol>
                        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-4">
            {/* toolbar */}
            <div className="flex items-center justify-between rounded-2xl border border-neutral-200/80 bg-white px-4 py-2.5 shadow-sm">
              <button type="button" onClick={toggleAll} className="flex items-center gap-2.5 text-sm font-semibold text-neutral-800">
                <span className={cn("grid h-5 w-5 place-items-center rounded-md border-2 transition", allSelected ? "border-orange-500 bg-orange-500 text-white" : selectedItems.length ? "border-orange-500 bg-orange-100 text-orange-600" : "border-neutral-300")}>
                  {allSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : selectedItems.length ? <Minus className="h-3 w-3" strokeWidth={3} /> : null}
                          </span>
                {allSelected ? "All selected" : `${selectedItems.length} of ${cart.length} selected`}
              </button>
              <button type="button" onClick={() => setShowClearConfirm(true)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" /> Clear cart
              </button>
                    </div>

            {groups.map((g, gi) => (
              <section key={g.name || `group-${gi}`} className="rounded-3xl border border-neutral-200/80 bg-white px-4 shadow-sm sm:px-6">
                {(groups.length > 1 || g.name) && (
                  <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-3">
                    <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-neutral-900">
                      <Package className="h-4 w-4 shrink-0 text-orange-500" />
                      <span className="truncate">{g.name || "Honic Store"}</span>
                      {g.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Verified supplier" />}
                    </p>
                    {g.place && <span className="shrink-0 text-xs text-neutral-400">{g.place}</span>}
                          </div>
                )}
                <ul className="divide-y divide-neutral-100">
                  {g.items.slice().reverse().flatMap((item) => (item.variants || []).map((v) => renderLine(item, v, (item.variants || []).length === 1)))}
                </ul>
              </section>
            ))}

            <p className="flex items-center gap-2 px-1 text-xs text-neutral-500">
              <ShieldCheck className="h-4 w-4 text-neutral-400" />
              Prices are checked again at checkout. Nothing is reserved until you pay.
                        </p>
                      </div>
                      
          <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:rounded-3xl [scrollbar-width:thin]">{summary}</aside>
                    </div>

        <div className="mt-10">
          <Recommendations formatPrice={formatPrice} excludeIds={ids} />
                      </div>
      </main>

      {/* phones: sticky checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:hidden">
        {belowMinimum && <p className="mb-2 text-center text-xs text-neutral-500">Under {formatPrice(MIN_PAYMENT_TZS)}? Checkout tops it up to the mobile money minimum.</p>}
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <p className="text-[11px] font-semibold text-neutral-500">Total ({selectedQty})</p>
            <p className="text-lg font-black tabular-nums leading-tight">{formatPrice(total)}</p>
                          </div>
          <button
            type="button"
            onClick={checkout}
            disabled={selectedItems.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/30 disabled:opacity-50"
          >
            Checkout <ArrowRight className="h-4 w-4" />
          </button>
                        </div>
                          </div>

      <ValidationModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear your cart?"
        message="All items will be removed from your cart. This can't be undone."
        type="warning"
        buttonText="Clear cart"
        cancelText="Keep items"
        showCancelButton
        onConfirm={() => {
          clearCart()
          setPromotion(null)
          setShowClearConfirm(false)
          toast({ title: "Cart cleared" })
        }}
        onCancel={() => setShowClearConfirm(false)}
        showCloseButton
      />
    </div>
  )
}

/** "You might also need": popular products from the fast search API (request started when the page opens). */
function Recommendations({ formatPrice, excludeIds, eager = false }: { formatPrice: (n: number) => string; excludeIds: number[]; eager?: boolean }) {
  const [items, setItems] = useState<Rec[] | null>(null)

  useEffect(() => {
    let cancelled = false
    loadRecs().then((list) => { if (!cancelled) setItems(list) })
    return () => { cancelled = true }
  }, [])

  const shown = (items || []).filter((p) => !excludeIds.includes(p.id)).slice(0, 12)
  if (items && shown.length === 0) return null

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-lg font-bold tracking-tight">You might also need</h2>
        <Link href="/products?sort=popular" className="-my-2 inline-block py-2 text-sm font-semibold text-orange-600 hover:text-orange-700">See all</Link>
                    </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items === null
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white p-2">
                <div className="aspect-square animate-pulse rounded-xl bg-neutral-100" />
                <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-neutral-100" />
                </div>
            ))
          : shown.map((p, i) => {
              const original = p.originalPrice
              const off = original && original > p.price ? Math.round(((original - p.price) / original) * 100) : 0
              return (
                <Link key={p.id} href={productHref(p.id, p.name)} className="group rounded-2xl border border-neutral-200/70 bg-white p-2 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-neutral-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={optimizedImg(p.image, 200)} alt="" className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105" loading={eager && i < 6 ? "eager" : "lazy"} fetchPriority={eager && i < 2 ? "high" : undefined} />
                    {off > 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">−{off}%</span>}
              </div>
                  <p className="mt-2 line-clamp-2 text-xs font-medium leading-snug text-neutral-800">{p.name}</p>
                  <p className="mt-1 text-sm font-bold tabular-nums">{formatPrice(p.price)}</p>
                      </Link>
              )
            })}
                      </div>
    </section>
  )
}
