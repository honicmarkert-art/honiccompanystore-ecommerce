"use client"

/**
 * Checkout — one page, matching the Marketplace look.
 *   1. Contact   2. Delivery (address or store pickup)   3. Payment (mobile money via Snippe)
 * Sticky order summary on desktop; collapsible summary + sticky pay bar on phones.
 *
 * Payment flow (unchanged from the old wizard):
 *   validate -> fresh server shipping estimate -> POST /api/orders (or reuse the order already created)
 *   -> POST /api/payment/snippe (server checks the amount against the saved order)
 *   -> poll GET /api/payment/snippe every 3 s -> /checkout/success
 */

import { BuyerRouteGuard } from "@/components/buyer-route-guard"
import { useState, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { logger } from "@/lib/logger"
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Package,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Store,
  Ticket,
  Truck,
  UserRound,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useCart, type CartItem } from "@/hooks/use-cart"
import { useAuth } from "@/contexts/auth-context"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { useCurrency } from "@/contexts/currency-context"
import { useToast } from "@/hooks/use-toast"
import { validateTanzaniaPhone, validateEmail } from "@/lib/phone-validation"
import { TANZANIA_REGIONS, DISTRICTS_BY_REGION, getWardOptions } from "@/lib/tanzania-address"
import { CheckoutPageSkeleton } from "@/components/ui/skeleton"
import { sessionStorage as safeSessionStorage, getSecureErrorMessage, fetchWithRetry } from "@/lib/checkout-utils"
import { getClientShippingPricing, shouldDeferShippingFeeDisplay } from "@/lib/shipping-calculator"
import { calculateShippingFee } from "@/lib/shipping-pricing"
import { useTranslation } from "@/hooks/use-translation"
import { CheckoutLanguageToggle } from "@/components/checkout-language-toggle"
import { BrandLogo } from "@/components/brand-logo"
import { safeImageSrc, optimizedImg } from "@/lib/image-optimize"
import { MIN_PAYMENT_TZS, TOP_UP_LABEL, paymentTopUp } from "@/lib/policies"
import { MODE_LABEL, type FreightMode, type FreightQuote } from "@/lib/import-freight"
import { DAR_ES_SALAAM_TIERS } from "@/lib/shipping-pricing-config"
import { BOUGHT_ITEMS_KEY, saveLocalOrder, savePendingOrder, takePendingOrder } from "@/lib/local-orders"

interface Address {
  fullName: string
  address1: string
  address2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
  email: string
  streetName?: string
  tin?: string
  region?: string
  district?: string
  ward?: string
  /** Set at submit when known; used server-side for distance / flat shipping. */
  lat?: number
  lon?: number
}

type Section = "shippingAddress" | "billingAddress"
type Delivery = "shipping" | "pickup"
type Errors = Record<string, string>

const EMPTY_ADDRESS: Address = {
  fullName: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "Tanzania",
  phone: "",
  email: "",
  streetName: "",
  tin: "",
  region: "",
  district: "",
  ward: "",
}

const COUNTRIES = ["Tanzania", "Kenya", "Uganda", "Rwanda"]
/** Delivery is Tanzania-only (pricing is per Tanzanian region); orders abroad are arranged on WhatsApp */
const SHIP_COUNTRIES = ["Tanzania"]
/** Mobile-money networks Snippe supports. The network is detected from the number automatically. */
const NETWORKS = [
  { name: "M-Pesa", wallet: "M-Pesa", provider: "mpesa", operator: "Vodacom", logo: "/payments/mpesa.svg" },
  { name: "Airtel Money", wallet: "Airtel Money", provider: "airtel", operator: "Airtel", logo: "/payments/airtel.svg" },
  { name: "Mixx by Yas", wallet: "Mixx by Yas", provider: "tigo", operator: "Yas", logo: "/payments/yas.svg" },
  { name: "Halotel", wallet: "HaloPesa", provider: "halopesa", operator: "Halotel", logo: "/payments/halotel.png" },
] as const
type Network = (typeof NETWORKS)[number]

/** Official network logo on a white tile (files in /public/payments, from Wikimedia Commons). */
function NetworkMark({ n, size = "md" }: { n: Network; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-neutral-200",
        size === "sm" ? "h-5 w-7 p-0.5" : "h-9 w-12 p-1"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={n.logo} alt="" className="h-full w-full object-contain" />
    </span>
  )
}

/** Turns the network's reason into something the shopper can act on. */
function friendlyPaymentError(reason: string | undefined, provider: string | undefined, amount: string) {
  const wallet = NETWORKS.find((n) => provider && provider.includes(n.provider))?.wallet || "mobile money"
  const r = (reason || "").toLowerCase()
  if (r.includes("insufficient")) return `Not enough balance on your ${wallet} account for ${amount}. Top up, or use a different number, then try again.`
  if (r.includes("cancel") || r.includes("rejected by user") || r.includes("declined by user")) return "The payment prompt was cancelled on the phone. Try again when you're ready."
  if (r.includes("expire") || r.includes("timeout") || r.includes("timed out")) return "The PIN prompt expired before it was approved. Try again and enter your PIN within a minute."
  if (r.includes("pin")) return `Wrong PIN on ${wallet}. Try again.`
  if (r.includes("limit")) return `This payment is over your ${wallet} limit. Use another number or a smaller order.`
  return reason ? `${wallet} declined the payment: ${reason}` : "The payment was not completed. You can try again."
}

/** Snippe (mobile money) refuses payments under TSh 500, so smaller orders are stopped before payment. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Field order used to scroll to the first problem. */
const ERROR_ORDER = [
  "shippingFullName", "shippingPhone", "shippingEmail",
  "shippingRegion", "shippingDistrict", "shippingWard", "shippingCity", "shippingStreet", "shippingAddress1",
  "billingFullName", "billingPhone", "billingEmail", "billingCity", "billingStreet", "billingAddress1",
]

function detectNetwork(phone: string): Network | null {
  const d = phone.replace(/\D/g, "")
  const p = d.startsWith("255") ? d.slice(3, 5) : d.startsWith("0") ? d.slice(1, 3) : d.slice(0, 2)
  const name =
    ["74", "75", "76"].includes(p) ? "M-Pesa" :
    ["68", "69", "78"].includes(p) ? "Airtel Money" :
    ["65", "67", "71", "77"].includes(p) ? "Mixx by Yas" :
    ["61", "62"].includes(p) ? "Halotel" : null
  return NETWORKS.find((n) => n.name === name) || null
}

/** Reads the items being bought: a "Buy now" item, the items ticked in the cart, or the whole cart. */
function readSelection(cart: CartItem[]): { items: CartItem[]; buyNow: boolean } {
  let selectedIds: number[] = []
  let buyNowItem: CartItem | null = null
  try {
    const raw = safeSessionStorage.getItem("selected_cart_items")
      if (raw) {
        const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every((id: unknown) => typeof id === "number" && id > 0)) selectedIds = parsed
    }
    if (safeSessionStorage.getItem("buy_now_mode") === "true") {
      const data = safeSessionStorage.getItem("buy_now_item_data")
      const parsed = data ? JSON.parse(data) : null
      if (parsed && typeof parsed === "object" && typeof (parsed as CartItem).productId === "number") buyNowItem = parsed as CartItem
    }
  } catch {}
  if (buyNowItem) return { items: [buyNowItem], buyNow: true }
  return { items: selectedIds.length > 0 ? cart.filter((i) => selectedIds.includes(i.productId)) : cart, buyNow: false }
}

function readPromotion(): { code: string; discountAmount: number; name?: string } | null {
  if (typeof window === "undefined") return null
  try {
    const parsed = JSON.parse(safeSessionStorage.getItem("applied_promotion") || "null")
    if (parsed && typeof parsed.code === "string" && typeof parsed.discountAmount === "number" && parsed.discountAmount >= 0) {
      return { code: parsed.code, discountAmount: parsed.discountAmount, name: typeof parsed.name === "string" ? parsed.name : undefined }
      }
    } catch {}
  return null
}

const noopSubscribe = () => () => {}

export default function CheckoutPage() {
  return (
    <BuyerRouteGuard>
      <CheckoutPageContent />
    </BuyerRouteGuard>
  )
}

/* ---------- small form building blocks ---------- */

const inputClass = (error?: string) =>
  cn(
    "h-11 w-full rounded-xl border bg-white px-3.5 text-base text-neutral-950 outline-none transition placeholder:text-neutral-400 sm:text-sm",
    "focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15",
    error ? "border-red-400 bg-red-50/40" : "border-neutral-200 hover:border-neutral-300"
  )

function Field({ id, label, error, hint, optional, className, children }: {
  id: string
  label: string
  error?: string
  hint?: string
  optional?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-semibold text-neutral-700">
        {label}
        {optional && <span className="text-xs font-normal text-neutral-400">optional</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600" role="alert">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-neutral-400">{hint}</p>
      ) : null}
    </div>
  )
}

function SectionCard({ n, icon, title, subtitle, done, children }: {
  n: number
  icon: ReactNode
  title: string
  subtitle?: string
  done?: boolean
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-sm font-black transition-colors",
            done ? "bg-emerald-500 text-white" : "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md shadow-orange-500/30"
          )}
          aria-hidden="true"
        >
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-neutral-950">
            {title}
            <span className="text-orange-400 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

/* ---------- page ---------- */

function CheckoutPageContent() {
  const router = useRouter()
  const { cart, updateItemQuantity } = useCart()
  const { user } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const { formatPrice } = useCurrency()
  const { toast } = useToast()
  const t = useTranslation()
  /** Translated label without the trailing " *" the old form used. */
  const label = (key: string) => t(key).replace(/\s*\*\s*$/, "")

  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false)

  const { items: selectedItems, buyNow } = readSelection(cart)
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0)
  const { freeThresholdTz: FREE_SHIPPING_THRESHOLD } = getClientShippingPricing()

  const [deliveryOption, setDeliveryOption] = useState<Delivery>("shipping")
  // Buy from China items: shipping from China by air or sea (priced by the server: /api/import-freight)
  const [freightMode, setFreightMode] = useState<FreightMode>("air")
  const [freight, setFreight] = useState<{ chinaItems: number; air: FreightQuote | null; sea: FreightQuote | null } | null>(null)
  const [freightLoading, setFreightLoading] = useState(false)
  const [shippingAddress, setShippingAddress] = useState<Address>(EMPTY_ADDRESS)
  const [billingAddress, setBillingAddress] = useState<Address>(EMPTY_ADDRESS)
  const [sameAsShipping, setSameAsShipping] = useState(true)
  const [waUpdates, setWaUpdates] = useState(true)
  const [waOffers, setWaOffers] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [summaryOpen, setSummaryOpen] = useState(false)

  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [paymentLinkGenerated, setPaymentLinkGenerated] = useState(false)
  const [orderReferenceId, setOrderReferenceId] = useState<string | null>(null)
  const lastOrderRef = useRef<{ signature: string; reference: string; amount: number } | null>(null)
  const [waitSeconds, setWaitSeconds] = useState(0)
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [appliedPromotion] = useState(readPromotion)

  /* ----- shipping fee ----- */
  type DeliveryInfo = { zone: string; eta: string | null; baseFee: number; sizeSurcharge: number; size: string; freeReason: string | null }
  const [shippingEstimate, setShippingEstimate] = useState<{ subtotal: number; shipping: number; total: number; delivery?: DeliveryInfo | null } | null>(null)
  const [shippingEstimateLoading, setShippingEstimateLoading] = useState(false)

  // Shown until the server estimate arrives: same calculator as the server (lib/shipping-pricing),
  // without item sizes (the estimate adds any large-item fee).
  const fallbackShippingFee = calculateShippingFee({
    deliveryOption,
    region: shippingAddress.region,
    district: shippingAddress.district,
    ward: shippingAddress.ward,
    subtotal: selectedSubtotal,
    allProductsHaveFreeDelivery: selectedItems.length > 0 && selectedItems.every((item) => {
      const extra = item as CartItem & { free_delivery?: boolean; freeDelivery?: boolean }
      return extra.free_delivery === true || extra.freeDelivery === true
    }),
  }).shippingFee

  const deferShippingFee = shouldDeferShippingFeeDisplay(deliveryOption, shippingAddress)
  const displaySubtotal = shippingEstimate?.subtotal ?? selectedSubtotal
  const shippingFee = deliveryOption === "pickup" || deferShippingFee ? 0 : (shippingEstimate?.shipping ?? fallbackShippingFee)
  const shippingFeeLoading = !deferShippingFee && shippingEstimateLoading && deliveryOption === "shipping"
  const promotionDiscount = appliedPromotion ? appliedPromotion.discountAmount : 0
  const hasChina = (freight?.chinaItems ?? 0) > 0
  const chinaFreight = hasChina ? (freightMode === "air" ? freight!.air : freight!.sea) : null
  const importFreight = chinaFreight?.tzs || 0
  const baseTotal = displaySubtotal + shippingFee + importFreight - promotionDiscount
  // mobile money can't take under TSh 500: very small orders are topped up (shown as its own line)
  const topUp = deliveryOption === "shipping" && deferShippingFee ? 0 : paymentTopUp(baseTotal)
  const orderTotal = baseTotal + topUp

  const isTz = shippingAddress.country === "Tanzania"
  const estimateBody = (items: { productId: number; variantId: string | null; quantity: number }[]) => ({
      items,
      deliveryOption,
    country: deliveryOption === "shipping" ? shippingAddress.country : undefined,
    region: deliveryOption === "shipping" && isTz ? shippingAddress.region : undefined,
    district: deliveryOption === "shipping" && isTz ? shippingAddress.district : undefined,
    ward: deliveryOption === "shipping" && isTz ? shippingAddress.ward : undefined,
    city: deliveryOption === "shipping" ? shippingAddress.city : undefined,
    streetName: deliveryOption === "shipping" && isTz ? shippingAddress.streetName : undefined,
    address1: deliveryOption === "shipping" && isTz ? shippingAddress.address1 : undefined,
    address2: deliveryOption === "shipping" && isTz ? shippingAddress.address2 : undefined,
  })
  const estimateItems = selectedItems.flatMap((item) =>
    (item.variants || []).map((v) => ({ productId: item.productId, variantId: v.variantId ?? null, quantity: v.quantity ?? 1 }))
  )

  // China shipping prices for the selected items (sizes and weights come from the server)
  const freightKey = JSON.stringify(estimateItems.map((i) => ({ productId: i.productId, quantity: i.quantity })))
  useEffect(() => {
    const items = JSON.parse(freightKey) as { productId: number; quantity: number }[]
    if (!items.length) { setFreight(null); return } // eslint-disable-line react-hooks/set-state-in-effect -- nothing to price
    let off = false
    setFreightLoading(true)
    fetch("/api/import-freight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) })
      .then((r) => r.json())
      .then((d) => { if (!off) setFreight({ chinaItems: Number(d?.chinaItems) || 0, air: d?.air || null, sea: d?.sea || null }) })
      .catch(() => { if (!off) setFreight(null) })
      .finally(() => { if (!off) setFreightLoading(false) })
    return () => { off = true }
  }, [freightKey])

  // Stable key so the estimate is only refetched when items / delivery / location really change.
  const shippingEstimateKey = JSON.stringify(estimateBody(estimateItems))

  useEffect(() => {
    const body = JSON.parse(shippingEstimateKey) as ReturnType<typeof estimateBody>
    let cancelled = false
    const skip = body.items.length === 0 || shouldDeferShippingFeeDisplay(body.deliveryOption, shippingAddress)
    const run = async () => {
      if (skip) {
      setShippingEstimate(null)
      setShippingEstimateLoading(false)
      return
    }
    setShippingEstimateLoading(true)
      try {
        const res = await fetch("/api/cart/shipping-estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: shippingEstimateKey,
        })
        const data = await res.json()
        if (cancelled) return
        setShippingEstimate(
          data.error ? null : { subtotal: Number(data.subtotal) || 0, shipping: Number(data.shipping) || 0, total: Number(data.total) || 0, delivery: data.delivery ?? null }
        )
      } catch {
        if (!cancelled) setShippingEstimate(null)
      } finally {
        if (!cancelled) setShippingEstimateLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingEstimateKey])

  /* ----- geocode the structured address (optional; improves distance-based fees) ----- */
  // Only the location fields form the query, so typing a name or phone never triggers a lookup.
  const geoQuery = (() => {
    if (deliveryOption !== "shipping") return ""
    const a = shippingAddress
    const tz = (a.country || "Tanzania").toLowerCase().includes("tanzania")
    const parts = (tz
      ? [a.ward, a.district, a.region, a.streetName, a.address1, a.address2, a.country || "Tanzania"]
      : [a.streetName, a.address1, a.address2, a.city, a.state, a.country || "Tanzania"]
    ).map((s) => s?.trim()).filter(Boolean) as string[]
    const hasEnough = tz ? !!(a.region && (a.district || a.ward || a.streetName?.trim() || a.address1?.trim())) : parts.length >= 2
    return hasEnough && parts.length >= 2 ? parts.reverse().join(", ") : ""
  })()
  const geocodeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!geoQuery) return
    if (geocodeRef.current) clearTimeout(geocodeRef.current)
    geocodeRef.current = setTimeout(async () => {
      geocodeRef.current = null
      try {
        const res = await fetch(`/api/forward-geocode?q=${encodeURIComponent(geoQuery)}`)
        const data = await res.json()
        if (Array.isArray(data) && data[0]?.lat != null && data[0]?.lon != null) {
          const lat = parseFloat(data[0].lat)
          const lon = parseFloat(data[0].lon)
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) setLocationCoords({ lat, lon })
        }
      } catch {
        // keep previous coords
      }
    }, 800)
    return () => {
      if (geocodeRef.current) clearTimeout(geocodeRef.current)
    }
  }, [geoQuery])

  /* ----- prefill from the signed-in account (once, never over the shopper's edits) ----- */
  const prefilledRef = useRef(false)
  useEffect(() => {
    if (!user?.email || prefilledRef.current) return
    prefilledRef.current = true
    // profile columns vary between accounts; read them loosely
    const profile = (user.profile || {}) as Record<string, string | undefined>
    setShippingAddress((prev) => {
      if (prev.email || prev.fullName || prev.phone) return prev
      return {
        ...prev,
        email: user.email || "",
        fullName: user.name || profile.full_name || "",
        phone: profile.phone || "",
        address1: prev.address1 || profile.address || "",
        city: prev.city || profile.city || "",
        state: prev.state || profile.state || "",
        postalCode: prev.postalCode || profile.postal_code || "",
      }
    })
  }, [user])

  /* ----- payment status polling ----- */
  useEffect(() => {
    if (!paymentLinkGenerated || !orderReferenceId) return
    let stopped = false
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/payment/snippe?orderReference=${encodeURIComponent(orderReferenceId)}&t=${Date.now()}`, { cache: "no-store" })
        const data = await response.json().catch(() => null)
        if (stopped || !data?.success) return
        if (data.paymentStatus === "paid" || data.paymentStatus === "completed" || data.paymentStatus === "success") {
          stopped = true
          const saved = takePendingOrder(orderReferenceId) || {
            referenceId: orderReferenceId,
            status: "paid",
            total: orderTotal,
            currency: "TZS",
            createdAt: new Date().toISOString(),
            customerName: "",
            phone: "",
            email: "",
            items: [],
          }
          saved.status = "paid"
          saveLocalOrder(saved)
          // no automatic download: the result page offers the invoice PDF when the shopper wants it
          router.push(`/checkout/success?orderReference=${encodeURIComponent(orderReferenceId)}`)
        } else if (data.paymentStatus === "failed") {
          stopped = true
          setPaymentLinkGenerated(false)
          setIsProcessingPayment(false)
          const message = friendlyPaymentError(data.failureReason, data.provider, formatPrice(orderTotal))
          setPaymentError(message)
          toast({ title: "Payment not completed", description: message, variant: "destructive", duration: 8000 })
        }
      } catch {
        // keep waiting; the next check tries again
      }
    }
    checkStatus()
    const timer = setInterval(checkStatus, 3000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [paymentLinkGenerated, orderReferenceId, orderTotal, router, toast, formatPrice])

  // The request phase gives up after 60 s (slow networks); the shopper can retry with the same order.
  useEffect(() => {
    if (!isProcessingPayment) return
    const id = setTimeout(() => {
      setHasTimedOut(true)
      setIsProcessingPayment(false)
    }, 60000)
    return () => clearTimeout(id)
  }, [isProcessingPayment])

  // Seconds spent waiting for the PIN (shown so the wait feels accounted for).
  useEffect(() => {
    if (!paymentLinkGenerated) return
    const started = Date.now()
    const id = setInterval(() => setWaitSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => {
      clearInterval(id)
      setWaitSeconds(0)
    }
  }, [paymentLinkGenerated])

  /** Back to the form. The created order is kept so a new attempt reuses it. */
  const handleRetryPayment = () => {
    setHasTimedOut(false)
    setIsProcessingPayment(false)
    setPaymentLinkGenerated(false)
    setPaymentError(null)
  }

  /* ----- form helpers ----- */
  const setField = (section: Section, field: keyof Address, value: string, clear: string[] = []) => {
    const set = section === "shippingAddress" ? setShippingAddress : setBillingAddress
    set((prev) => ({ ...prev, [field]: value }))
    const prefix = section === "shippingAddress" ? "shipping" : "billing"
    const key = prefix + (field === "address1" ? "Address1" : field === "streetName" ? "Street" : field.charAt(0).toUpperCase() + field.slice(1))
    const keys = [key, ...clear]
    if (keys.some((k) => errors[k])) {
      setErrors((prev) => {
        const next = { ...prev }
        keys.forEach((k) => delete next[k])
        return next
      })
    }
  }

  const onRegion = (region: string) => {
    const districts = (region && DISTRICTS_BY_REGION[region]) || []
    const district = districts.length === 1 ? districts[0] : ""
    const wards = district ? getWardOptions(district) : []
    setShippingAddress((prev) => ({ ...prev, region, district, ward: wards.length === 1 ? wards[0] : "", city: region || prev.city }))
    setErrors((prev) => {
      const n = { ...prev }
      delete n.shippingRegion
      delete n.shippingDistrict
      delete n.shippingWard
      return n
    })
  }

  const onDistrict = (district: string) => {
    const wards = district ? getWardOptions(district) : []
    setShippingAddress((prev) => ({ ...prev, district, ward: wards.length === 1 ? wards[0] : "" }))
    setErrors((prev) => {
      const n = { ...prev }
      delete n.shippingDistrict
      delete n.shippingWard
      return n
    })
  }

  const toggleBilling = (useSame: boolean) => {
    setSameAsShipping(useSame)
    if (!useSame) {
      // start the separate billing details from the contact details
      setBillingAddress((prev) => ({
      ...prev,
        fullName: prev.fullName || shippingAddress.fullName,
        phone: prev.phone || shippingAddress.phone,
        email: prev.email || shippingAddress.email,
        city: prev.city || shippingAddress.region || shippingAddress.city,
      }))
    }
  }

  /* ----- validation ----- */
  const validate = (): Errors => {
    const e: Errors = {}
    const s = shippingAddress
    if (!s.fullName.trim()) e.shippingFullName = t("checkout.errFullNameRequired")
    if (!s.phone.trim()) e.shippingPhone = t("checkout.errPhoneRequired")
    else if (!validateTanzaniaPhone(s.phone).valid) e.shippingPhone = t("checkout.errInvalidPhoneFormat")
    // email is not required: checked only when the shopper fills it in
    if (s.email.trim() && (!EMAIL_RE.test(s.email.trim()) || !validateEmail(s.email.trim()).valid)) e.shippingEmail = t("checkout.errEmailInvalid")

    if (deliveryOption === "shipping") {
      if (s.country === "Tanzania") {
        if (!s.region?.trim()) e.shippingRegion = t("checkout.errRegionRequired")
        if (!s.district?.trim()) e.shippingDistrict = t("checkout.errDistrictRequired")
        if (!s.ward?.trim()) e.shippingWard = t("checkout.errWardRequired")
      } else if (!s.city.trim()) {
        e.shippingCity = t("checkout.errCityRequired")
      }
      if (!s.streetName?.trim()) e.shippingStreet = t("checkout.errStreetRequired")
      if (!s.address1.trim()) e.shippingAddress1 = t("checkout.errHouseRequired")
    }

    if (!sameAsShipping) {
      const b = billingAddress
      if (!b.fullName.trim()) e.billingFullName = t("checkout.errFullNameRequired")
      if (!b.phone.trim()) e.billingPhone = t("checkout.errPhoneRequired")
      else if (!validateTanzaniaPhone(b.phone).valid) e.billingPhone = t("checkout.errInvalidPhoneFormat")
      if (b.email.trim() && !EMAIL_RE.test(b.email.trim())) e.billingEmail = t("checkout.errEmailInvalid")
      if (!b.city.trim()) e.billingCity = t("checkout.errCityRequired")
      if (!b.streetName?.trim()) e.billingStreet = t("checkout.errStreetRequired")
      if (!b.address1.trim()) e.billingAddress1 = t("checkout.errBillingAddressRequired")
    }
    return e
  }

  /* ----- order + payment ----- */
  const submitOrder = async (orderData: Record<string, unknown>) => {
    const response = await fetchWithRetry(
      "/api/orders",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(orderData) },
      2
    )
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(getSecureErrorMessage(errorData.error || new Error("Order submission failed"), "Failed to submit order. Please try again."))
    }
    return response.json()
  }

  const handlePlaceOrder = async () => {
    if (isProcessingPayment || paymentLinkGenerated) return
    // Items come from the same selection the summary shows (incl. "Buy now").
    const { items } = readSelection(cart)
    if (items.length === 0) {
      toast({ title: t("checkout.toastEmptyCartTitle"), description: t("checkout.toastEmptyCartDesc"), variant: "destructive" })
        return
      }

    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      const first = ERROR_ORDER.find((k) => found[k])
      const el = first ? document.getElementById(first) : null
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        setTimeout(() => el.focus({ preventScroll: true }), 300)
      }
      toast({ title: "Check your details", description: "A few fields need your attention.", variant: "destructive" })
        return
      }

    setIsProcessingPayment(true)
    setHasTimedOut(false)
    setPaymentError(null)
    setPaymentLinkGenerated(false)

    try {
      const customerInfo = shippingAddress
      const orderNumber = `ORD-${Date.now()}`
      const orderItems = items.flatMap((item) =>
        item.variants.map((v) => ({ productId: item.productId, variantId: v.variantId ?? null, quantity: v.quantity ?? 1 }))
      )

      // Use the server's numbers (same zones/rates as POST /api/orders).
      let serverShippingFee = deliveryOption === "pickup" ? 0 : (shippingEstimate?.shipping ?? fallbackShippingFee)
      let serverSubtotal = shippingEstimate?.subtotal ?? items.reduce((sum, item) => sum + item.totalPrice, 0)
      const hasFreshEstimate = deliveryOption === "pickup" || (typeof shippingEstimate?.subtotal === "number" && typeof shippingEstimate?.shipping === "number")
      if (!hasFreshEstimate) {
        try {
          const res = await fetch("/api/cart/shipping-estimate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(estimateBody(orderItems)),
          })
          const estimate = await res.json()
          if (!estimate.error && typeof estimate.subtotal === "number" && typeof estimate.shipping === "number") {
          serverSubtotal = estimate.subtotal
          serverShippingFee = estimate.shipping
        }
      } catch {
          // fall back to the values above
      }
      }
      if (hasChina && (freightLoading || !chinaFreight)) {
        toast({ title: "One moment", description: "We are still working out the shipping from China. Try again in a few seconds.", variant: "destructive" })
        return
      }
      const serverBase = Math.round(serverSubtotal + serverShippingFee + importFreight - promotionDiscount)
      const totalAmount = serverBase + paymentTopUp(serverBase)

      const orderData = {
        orderNumber,
        userId: user?.id || null,
        customerName: customerInfo.fullName,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone,
        whatsappUpdates: waUpdates,
        whatsappOffers: waOffers,
        items: items.flatMap((item) =>
          item.variants.map((variant) => ({
            productId: item.productId,
            productName: item.product?.name || `Product ${item.productId}`,
            variantId: variant.variantId && variant.variantId !== "default" && !isNaN(Number(variant.variantId)) ? parseInt(variant.variantId) : null,
            variantName: variant.variant_name || "Default",
            variantAttributes: null,
            quantity: variant.quantity,
            unitPrice: variant.price,
            totalPrice: variant.price * variant.quantity,
          name: item.product?.name || `Product ${item.productId}`,
          }))
        ),
        shippingAddress: {
          ...shippingAddress,
          ...(deliveryOption === "shipping" && locationCoords ? { lat: locationCoords.lat, lon: locationCoords.lon } : {}),
        },
        billingAddress: sameAsShipping ? shippingAddress : billingAddress,
        deliveryOption,
        shippingFee: serverShippingFee,
        promotionCode: appliedPromotion?.code || null,
        promotionDiscount,
        importFreightMode: hasChina ? freightMode : undefined,
        totalAmount,
        timestamp: new Date().toISOString(),
      }

      // Retrying with the same items, delivery and total reuses the order created earlier, so a
      // declined payment doesn't leave duplicate orders. Anything changed -> a new order.
      // (The old code asked GET /api/orders/[ref] first; that route needs a login, returned 401
      // for guests and so created a new order on every retry.)
      const signature = JSON.stringify({ items: orderItems, deliveryOption, totalAmount, shippingAddress, billing: orderData.billingAddress })
      let reference: string
      let amount: number
      if (lastOrderRef.current && lastOrderRef.current.signature === signature) {
        reference = lastOrderRef.current.reference
        amount = lastOrderRef.current.amount
            } else {
        const result = await submitOrder(orderData)
        reference = result.order.referenceId || orderNumber
        amount = Number(result.order.totalAmount) || orderData.totalAmount
        lastOrderRef.current = { signature, reference, amount }
      }
      setOrderReferenceId(reference)

      // The payment API checks the amount against the saved order (anti-tampering).
      const response = await fetch("/api/payment/snippe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          amount: String(amount),
          currency: "TZS",
            orderId: reference,
          idempotencyKey: `checkout-link:${reference}:${String(amount)}`,
            customerDetails: {
            fullName: customerInfo.fullName,
            email: customerInfo.email,
            phone: customerInfo.phone,
            firstName: customerInfo.fullName.split(" ")[0] || "",
            lastName: customerInfo.fullName.split(" ").slice(1).join(" ") || "",
            },
          }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed" }))
        throw new Error(getSecureErrorMessage(errorData.error || "Failed", "Unable to send the payment request. Please try again."))
      }
      const data = await response.json()
      if (!data.success || !data.paymentReference) {
        throw new Error(getSecureErrorMessage(data.error || "No payment request", "Unable to send the payment request. Please try again."))
      }

      safeSessionStorage.setItem("last_order_reference", reference)
      // the result page removes exactly these from the cart once the payment is confirmed
      try {
        const bought = readSelection(cart)
        safeSessionStorage.setItem(BOUGHT_ITEMS_KEY, JSON.stringify({
          ref: String(reference).replace(/[^A-Za-z0-9]/g, "").toLowerCase(),
          all: !bought.buyNow && bought.items.length === cart.length,
          items: bought.buyNow ? [] : bought.items.flatMap((item): { productId: number; variantId: string | null }[] =>
            item.variants?.length ? item.variants.map((v) => ({ productId: item.productId, variantId: v.variantId ?? null })) : [{ productId: item.productId, variantId: null }]),
        }))
      } catch { /* storage unavailable: items simply stay in the cart */ }
      savePendingOrder({
        referenceId: reference,
        status: "pending",
        total: Number(amount) || 0,
        currency: "TZS",
        createdAt: new Date().toISOString(),
        customerName: customerInfo.fullName || "",
        phone: customerInfo.phone || "",
        email: customerInfo.email || "",
        items: orderData.items.map((item) => ({
          name: item.productName || item.name || "Item",
          quantity: Number(item.quantity) || 1,
          total: Number(item.totalPrice) || 0,
        })),
      })
      setPaymentLinkGenerated(true)
        setIsProcessingPayment(false)
      toast({ title: "Check your phone", description: "A payment request was sent to your mobile money number. Approve it with your PIN.", duration: 6000 })
    } catch (error: unknown) {
      const err = error as { message?: string; stack?: string; name?: string }
      logger.error("Payment initiation error:", { error, message: err.message, stack: err.stack, name: err.name })
      setIsProcessingPayment(false)
      setPaymentLinkGenerated(false)
      const message = getSecureErrorMessage(error, "Something went wrong. Please try again.")
      setPaymentError(message)
      toast({ title: "Order error", description: message, variant: "destructive", duration: 5000 })
    }
  }

  /* ----- derived view data ----- */
  const paymentPhone = shippingAddress.phone
  const network = detectNetwork(paymentPhone)
  const paying = isProcessingPayment || paymentLinkGenerated || hasTimedOut
  const contactDone = !!(shippingAddress.fullName.trim() && validateTanzaniaPhone(shippingAddress.phone).valid && (!shippingAddress.email.trim() || EMAIL_RE.test(shippingAddress.email.trim())))
  const deliveryDone =
    deliveryOption === "pickup" ||
    !!((isTz ? shippingAddress.region && shippingAddress.district && shippingAddress.ward : shippingAddress.city.trim()) &&
      shippingAddress.streetName?.trim() && shippingAddress.address1.trim())

  const lines = selectedItems.flatMap((item) =>
    (item.variants || []).map((variant) => ({
      key: `${item.productId}-${variant.variantId || variant.variant_name || "item"}`,
      productId: item.productId,
      variantId: variant.variantId,
      name: item.product?.name || "Item",
      variant: variant.variant_name && variant.variant_name !== "Default" ? variant.variant_name : "",
      quantity: variant.quantity || 1,
      price: variant.price || 0,
      total: (variant.price || 0) * (variant.quantity || 1),
      image: safeImageSrc(variant.image || item.product?.image || ""),
    }))
  )
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0)

  const feeText = deliveryOption === "pickup"
    ? t("checkout.free")
    : deferShippingFee
      ? "Add your region"
      : shippingFeeLoading
        ? null
        : shippingFee === 0
          ? t("checkout.free")
          : formatPrice(shippingFee)

  // the "Deliver to me" card shows the real delivery fee even while Store Pickup is selected
  // (while pickup is selected the estimates are for pickup, so show delivery's real starting price)
  const deliveryOnlyFee = shippingEstimate?.shipping ?? fallbackShippingFee
  const lowestDeliveryFee = Math.min(...Object.values(DAR_ES_SALAAM_TIERS).map((tier) => tier.fee))
  const deliveryBadge = deliveryOption === "pickup"
    ? (selectedSubtotal >= FREE_SHIPPING_THRESHOLD ? t("checkout.free") : `From ${formatPrice(lowestDeliveryFee)}`)
    : deferShippingFee ? "Add your region" : shippingFeeLoading ? null : deliveryOnlyFee === 0 ? t("checkout.free") : formatPrice(deliveryOnlyFee)

  const payLabel = isProcessingPayment ? "Sending request…" : paymentError ? t("checkout.tryAgain") : `Pay ${formatPrice(orderTotal)}`

  /* ----- pieces ----- */
  const payButton = (className?: string) => (
    <button
      type="button"
      onClick={handlePlaceOrder}
      disabled={isProcessingPayment || paymentLinkGenerated || lines.length === 0}
                         className={cn(
        "group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition",
        "hover:from-orange-600 hover:to-orange-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {isProcessingPayment ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
      <span className="tabular-nums">{payLabel}</span>
    </button>
  )

  const summary = (
    <div className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <h2 className="text-base font-bold text-neutral-950">Order summary</h2>
        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
                        </div>

      <ul className="max-h-[22rem] divide-y divide-neutral-100 overflow-y-auto px-5">
        {lines.map((line) => (
          <li key={line.key} className="flex gap-3 py-3">
            <Link
              href={`/products/${line.productId}-${encodeURIComponent(line.name)}?returnTo=${encodeURIComponent("/checkout")}`}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={optimizedImg(line.image, 64)} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
            </Link>
                  <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-neutral-900">{line.name}</p>
              {line.variant && <p className="mt-0.5 truncate text-xs text-neutral-500">{line.variant}</p>}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                {buyNow || paying ? (
                  <span className="text-xs text-neutral-500">Qty {line.quantity} × {formatPrice(line.price)}</span>
                ) : (
                  <div className="flex items-center rounded-full border border-neutral-200">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={line.quantity <= 1}
                      onClick={() => updateItemQuantity(line.productId, line.quantity - 1, line.variantId)}
                      className="grid h-7 w-7 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="min-w-6 text-center text-xs font-bold tabular-nums">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => updateItemQuantity(line.productId, line.quantity + 1, line.variantId)}
                      className="grid h-7 w-7 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <span className="text-sm font-bold tabular-nums text-neutral-950">{formatPrice(line.total)}</span>
              </div>
              </div>
          </li>
        ))}
      </ul>

      {appliedPromotion && (
        <div className="mx-5 mt-2 flex items-center gap-2 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <Ticket className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            <b>{appliedPromotion.code}</b> · {appliedPromotion.name || t("cart.promotionNameFallback")}
          </span>
                  </div>
      )}

      <dl className="space-y-2 px-5 py-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-500">Subtotal</dt>
          <dd className="font-semibold tabular-nums">{formatPrice(displaySubtotal)}</dd>
                </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">{deliveryOption === "pickup" ? t("checkout.storePickupTitle") : "Delivery"}</dt>
          <dd className={cn("font-semibold", (feeText === t("checkout.free")) && "text-emerald-600", deferShippingFee && deliveryOption === "shipping" && "text-xs font-medium text-neutral-400")}>
            {feeText ?? <span className="inline-block h-3.5 w-14 animate-pulse rounded bg-neutral-200 align-middle" />}
          </dd>
        </div>
        {/* where it goes, how long, and why (zone, delivery time, large-item fee, free delivery) */}
        {deliveryOption === "shipping" && !deferShippingFee && shippingEstimate?.delivery && (
          <p className="-mt-1 text-right text-[11px] leading-snug text-neutral-500">
            {shippingEstimate.delivery.zone}{shippingEstimate.delivery.eta ? ` · ${shippingEstimate.delivery.eta}` : ""}
            {shippingEstimate.delivery.freeReason === "threshold" && <span className="block text-emerald-700">Free delivery on orders over {formatPrice(FREE_SHIPPING_THRESHOLD)}</span>}
            {shippingEstimate.delivery.sizeSurcharge > 0 && <span className="block">Includes {formatPrice(shippingEstimate.delivery.sizeSurcharge)} {shippingEstimate.delivery.size === "large" ? "large-item" : "bigger-item"} handling</span>}
          </p>
        )}
        {hasChina && (
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Shipping from China ({MODE_LABEL[freightMode]})
              {(chinaFreight?.unmeasured ?? 0) > 0 && <span className="block text-[11px] leading-snug text-neutral-400">{chinaFreight!.unmeasured} item{chinaFreight!.unmeasured === 1 ? "" : "s"} priced after weighing, paid on arrival</span>}
            </dt>
            <dd className="font-semibold tabular-nums">{freightLoading || !chinaFreight ? <span className="inline-block h-3.5 w-14 animate-pulse rounded bg-neutral-200 align-middle" /> : chinaFreight.measured === 0 ? <span className="text-xs font-medium text-neutral-500">After weighing</span> : formatPrice(importFreight)}</dd>
          </div>
        )}
        {promotionDiscount > 0 && (
          <div className="flex justify-between text-emerald-700">
            <dt>Discount</dt>
            <dd className="font-semibold tabular-nums">−{formatPrice(promotionDiscount)}</dd>
                  </div>
        )}
        {topUp > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">{TOP_UP_LABEL}<span className="block text-[11px] leading-snug text-neutral-400">Mobile money payments start at {formatPrice(MIN_PAYMENT_TZS)}</span></dt>
            <dd className="font-semibold tabular-nums">+{formatPrice(topUp)}</dd>
          </div>
        )}
        <div className="flex items-end justify-between border-t border-neutral-100 pt-3">
          <dt className="font-bold text-neutral-950">Total</dt>
          <dd className="text-right">
            <span className="block text-2xl font-black tabular-nums tracking-tight text-neutral-950">{formatPrice(orderTotal)}</span>
            {deliveryOption === "shipping" && deferShippingFee && <span className="text-[11px] text-neutral-400">+ delivery once you pick a region</span>}
          </dd>
                  </div>
      </dl>

      {!paying && (
        <div className="hidden px-5 pb-5 lg:block">
          {payButton()}
          {paymentError && <p className="mt-2 text-center text-sm text-red-600">{paymentError}</p>}
                      </div>
      )}

      <div className="grid grid-cols-3 gap-px border-t border-neutral-100 bg-neutral-100 text-center text-[11px] font-semibold text-neutral-600">
        {[
          { icon: Lock, label: "Secure checkout" },
          { icon: ShieldCheck, label: "PIN stays private" },
          { icon: ReceiptText, label: "Instant receipt" },
        ].map(({ icon: Icon, label: l }) => (
          <div key={l} className="flex flex-col items-center gap-1 bg-white px-2 py-3">
            <Icon className="h-4 w-4 text-orange-500" />
            {l}
                    </div>
        ))}
                    </div>
                  </div>
  )

  const select = (id: string, value: string, onChange: (v: string) => void, options: readonly string[], placeholder: string, error?: string, disabled?: boolean) => (
    <div className="relative">
                        <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputClass(error), "appearance-none pr-9 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400")}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
                        </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              </div>
  )

  const contactSection = (
    <SectionCard n={1} icon={<UserRound className="h-4 w-4" />} title="Contact" subtitle="We send order updates and the receipt here." done={contactDone}>
      {!user && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-neutral-50 px-4 py-3 text-sm">
          <span className="text-neutral-600">Have an account? Sign in to fill this in and track your order.</span>
          <button type="button" onClick={() => openAuthModal("login")} className="font-bold text-orange-600 hover:text-orange-700">
            Sign in
          </button>
                    </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="shippingFullName" label={label("checkout.fullNameLabel")} error={errors.shippingFullName} className="sm:col-span-2">
          <input
            id="shippingFullName"
            autoComplete="name"
            value={shippingAddress.fullName}
            onChange={(e) => setField("shippingAddress", "fullName", e.target.value)}
            placeholder={t("checkout.phFullName")}
            className={inputClass(errors.shippingFullName)}
          />
        </Field>
        <Field id="shippingPhone" label={label("checkout.phoneLabel")} error={errors.shippingPhone} hint="The mobile money number that will pay">
          <input
            id="shippingPhone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={shippingAddress.phone}
            onChange={(e) => setField("shippingAddress", "phone", e.target.value)}
            placeholder="0712 345 678"
            className={inputClass(errors.shippingPhone)}
          />
        </Field>
        <Field id="shippingEmail" label={label("checkout.emailLabel")} error={errors.shippingEmail}>
          <input
            id="shippingEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={shippingAddress.email}
            onChange={(e) => setField("shippingAddress", "email", e.target.value)}
            placeholder={t("checkout.phEmail")}
            className={inputClass(errors.shippingEmail)}
          />
        </Field>
                    </div>
      {/* WhatsApp consent: order updates (on by default, clearly stated) and offers (only if ticked) */}
      <div className="mt-4 space-y-2 rounded-2xl bg-emerald-50/60 p-3.5 text-sm dark:bg-emerald-950/20">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={waUpdates} onChange={(e) => setWaUpdates(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600" />
          <span><span className="font-semibold">Send my order updates on WhatsApp</span><span className="block text-xs text-neutral-500">Receipt, invoice and delivery updates to this number. Taarifa za oda kwa WhatsApp.</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={waOffers} onChange={(e) => setWaOffers(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600" />
          <span><span className="font-semibold">Also send me offers on WhatsApp</span><span className="block text-xs text-neutral-500">Deals and new arrivals, a few times a month. Reply STOP any time.</span></span>
        </label>
      </div>
    </SectionCard>
  )

  const deliveryChoices: { value: Delivery; icon: ReactNode; title: string; line: string; badge: string }[] = [
    { value: "shipping", icon: <Truck className="h-5 w-5" />, title: "Deliver to me", line: t("checkout.estDeliveryValue"), badge: deliveryBadge ?? "…" },
    { value: "pickup", icon: <Store className="h-5 w-5" />, title: t("checkout.storePickupTitle"), line: "Dar es Salaam · ready same or next day", badge: t("checkout.free") },
  ]

  const deliverySection = (
    <SectionCard n={2} icon={<MapPin className="h-4 w-4" />} title="Delivery" subtitle={t("checkout.deliveryOptionSubtitle")} done={contactDone && deliveryDone}>
      <div role="radiogroup" aria-label={t("checkout.deliveryOptionTitle")} className="grid gap-3 sm:grid-cols-2">
        {deliveryChoices.map((c) => {
          const active = deliveryOption === c.value
                        return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setDeliveryOption(c.value)}
                            className={cn(
                "relative flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition",
                active ? "border-orange-500 bg-orange-50/60 shadow-sm" : "border-neutral-200 hover:border-neutral-300"
              )}
            >
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", active ? "bg-orange-500 text-white" : "bg-neutral-100 text-neutral-500")}>
                {c.icon}
                                      </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-bold text-neutral-950">{c.title}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", c.badge === t("checkout.free") ? "bg-emerald-100 text-emerald-700" : "bg-white text-neutral-600 ring-1 ring-neutral-200")}>
                    {c.badge}
                                          </span>
                                          </span>
                <span className="mt-0.5 block text-xs text-neutral-500">{c.line}</span>
              </span>
              <span className={cn("absolute right-3 top-3 hidden h-4 w-4 rounded-full border-2", active ? "border-orange-500 bg-orange-500" : "border-neutral-300")} />
            </button>
          )
        })}
                </div>

      {deliveryOption === "pickup" ? (
        <div className="mt-4 flex gap-3 rounded-2xl bg-neutral-950 p-4 text-white">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
          <div className="text-sm">
            <p className="font-semibold">{t("checkout.storePickupDesc")}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
              <Clock className="h-3.5 w-3.5" /> {t("checkout.pickupTimeValue")}
            </p>
            <p className="mt-1 text-xs text-neutral-400">Bring your order number. It is shown after you pay (and emailed to you if you gave an email).</p>
                          </div>
                        </div>
                      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field id="shippingCountry" label={label("checkout.countryLabel")}>
            {select("shippingCountry", shippingAddress.country, (v) => setField("shippingAddress", "country", v || "Tanzania"), SHIP_COUNTRIES, "Tanzania")}
          </Field>
          {isTz ? (
            <>
              <Field id="shippingRegion" label={label("checkout.regionLabel")} error={errors.shippingRegion}>
                {select("shippingRegion", shippingAddress.region || "", onRegion, TANZANIA_REGIONS, t("checkout.selectRegion"), errors.shippingRegion)}
              </Field>
              <Field id="shippingDistrict" label={label("checkout.districtLabel")} error={errors.shippingDistrict}>
                {select(
                  "shippingDistrict",
                  shippingAddress.district || "",
                  onDistrict,
                  DISTRICTS_BY_REGION[shippingAddress.region || ""] ?? [],
                  shippingAddress.region ? t("checkout.selectDistrict") : "Pick a region first",
                  errors.shippingDistrict,
                  !shippingAddress.region
                )}
              </Field>
              <Field id="shippingWard" label={label("checkout.wardLabel")} error={errors.shippingWard}>
                {select(
                  "shippingWard",
                  shippingAddress.ward || "",
                  (v) => setField("shippingAddress", "ward", v),
                  getWardOptions(shippingAddress.district || ""),
                  shippingAddress.district ? t("checkout.selectWard") : "Pick a district first",
                  errors.shippingWard,
                  !shippingAddress.district
                )}
              </Field>
                    </>
                  ) : (
            <Field id="shippingCity" label={label("checkout.regionCityLabel")} error={errors.shippingCity}>
              <input
                id="shippingCity"
                autoComplete="address-level2"
                value={shippingAddress.city}
                onChange={(e) => setField("shippingAddress", "city", e.target.value)}
                placeholder={t("checkout.phRegionCityNonTz")}
                className={inputClass(errors.shippingCity)}
              />
            </Field>
          )}
          <Field id="shippingStreet" label={label("checkout.streetNameLabel")} error={errors.shippingStreet}>
            <input
              id="shippingStreet"
              autoComplete="address-line1"
              value={shippingAddress.streetName || ""}
              onChange={(e) => setField("shippingAddress", "streetName", e.target.value)}
              placeholder={t("checkout.phStreet")}
              className={inputClass(errors.shippingStreet)}
            />
          </Field>
          <Field id="shippingAddress1" label={label("checkout.houseNumberLabel")} error={errors.shippingAddress1}>
            <input
              id="shippingAddress1"
              autoComplete="address-line2"
              value={shippingAddress.address1}
              onChange={(e) => setField("shippingAddress", "address1", e.target.value)}
              placeholder={t("checkout.phHouse")}
              className={inputClass(errors.shippingAddress1)}
            />
          </Field>
          <Field id="shippingLandmark" label={t("checkout.famousPlaceLabel").replace(/\s*\(.*\)\s*$/, "")} optional hint="Helps the rider find you" className="sm:col-span-2">
            <input
              id="shippingLandmark"
              value={shippingAddress.address2 || ""}
              onChange={(e) => setField("shippingAddress", "address2", e.target.value)}
              placeholder={t("checkout.phMoreDetails")}
              className={inputClass()}
            />
          </Field>
          {!deferShippingFee && (
            <p className="flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs font-medium text-orange-800 sm:col-span-2">
              <Truck className="h-4 w-4 shrink-0" />
              {shippingFeeLoading ? "Working out the delivery fee…" : `Delivery to ${[shippingAddress.ward, shippingAddress.district, shippingAddress.region || shippingAddress.city].filter(Boolean).join(", ")}: ${feeText}`}
            </p>
          )}
                        </div>
      )}
    </SectionCard>
  )

  const freightChoice = (m: FreightMode) => {
    const q = m === "air" ? freight?.air : freight?.sea
    const on = freightMode === m
    return (
      <button type="button" key={m} onClick={() => setFreightMode(m)} aria-pressed={on}
        className={cn("flex-1 rounded-2xl border-2 p-3 text-left transition", on ? "border-[#c8102e] bg-red-50/60" : "border-neutral-200 hover:border-neutral-400")}>
        <span className="flex items-center justify-between gap-2"><b className="text-sm">{m === "air" ? "✈ Air" : "🚢 Sea"}</b>{q && <span className="text-sm font-bold tabular-nums">{q.measured ? formatPrice(q.tzs) : "After weighing"}</span>}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{q ? `About ${q.daysMin}–${q.daysMax} days` : "…"}{q && q.measured > 0 ? ` · ${q.chargeable} ${q.unit} at ${q.rateUsd}/${q.unit}` : ""}</span>
      </button>
    )
  }
  const chinaSection = hasChina ? (
    <SectionCard n={3} icon={<Truck className="h-4 w-4" />} title="Shipping from China" subtitle="Your China items travel together. Choose how.">
      <div className="flex flex-col gap-2 sm:flex-row">{freightChoice("air")}{freightChoice("sea")}</div>
      {(chinaFreight?.unmeasured ?? 0) > 0 && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {chinaFreight!.unmeasured} of your China items {chinaFreight!.unmeasured === 1 ? "has" : "have"} no listed size or weight. You pay for {chinaFreight!.unmeasured === 1 ? "it" : "them"} now; we weigh the parcel when it reaches our warehouse and tell you the {MODE_LABEL[freightMode].toLowerCase()} shipping price, which you pay on delivery or pickup.
        </p>
      )}
      <p className="mt-2 text-[11px] text-neutral-500">Delivery inside Tanzania (above) is separate. Shipping prices follow our published air and sea rates.</p>
    </SectionCard>
  ) : null

  const paymentSection = (
    <SectionCard n={hasChina ? 4 : 3} icon={<Smartphone className="h-4 w-4" />} title="Payment" subtitle="Pay with mobile money. You approve it on your phone.">
      <div className="rounded-2xl border-2 border-orange-500 bg-orange-50/40 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500 text-white">
            <Smartphone className="h-5 w-5" />
                  </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-neutral-950">Mobile money</p>
            <p className="mt-0.5 text-sm text-neutral-600">
              {paymentPhone.trim()
                ? <>A payment prompt goes to <b className="tabular-nums text-neutral-900">{paymentPhone}</b>.</>
                : "A payment prompt goes to the phone number above."}{" "}
              Your PIN never touches this website.
            </p>
                </div>
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-orange-500 text-white">
            <Check className="h-3 w-3" />
          </span>
                </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {NETWORKS.map((n) => {
            const on = network?.name === n.name
                      return (
                        <div
                key={n.name}
                          className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-xl bg-white px-2 pb-2 pt-2.5 ring-1 transition",
                  on ? "ring-2 ring-orange-500" : network ? "opacity-40 grayscale ring-neutral-200" : "ring-neutral-200"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={n.logo} alt="" className="h-8 w-full object-contain" />
                <span className="w-full truncate text-center text-[11px] font-semibold text-neutral-700">{n.name}</span>
                {on && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-orange-500 text-white">
                    <Check className="h-2.5 w-2.5" />
                                    </span>
                )}
                        </div>
                      )
          })}
        </div>
        <p className="mt-2.5 text-xs text-neutral-500">
          {network
            ? <>Detected <b className="text-neutral-800">{network.wallet}</b> from your number. No need to choose a network.</>
            : "No need to choose a network: it's detected from your phone number."}
        </p>
                </div>

      {/* billing / invoice details */}
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 p-4 transition hover:border-neutral-300">
        <input
          type="checkbox"
          checked={!sameAsShipping}
          onChange={(e) => toggleBilling(!e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-neutral-900">I need an invoice with a TIN or different billing details</span>
          <span className="block text-xs text-neutral-500">Otherwise your contact{deliveryOption === "shipping" ? " and delivery" : ""} details are used for billing.</span>
                    </span>
      </label>

      {!sameAsShipping && (
        <div className="mt-4 grid gap-4 rounded-2xl bg-neutral-50 p-4 sm:grid-cols-2">
          <Field id="billingFullName" label="Name on invoice" error={errors.billingFullName} className="sm:col-span-2">
            <input id="billingFullName" value={billingAddress.fullName} onChange={(e) => setField("billingAddress", "fullName", e.target.value)} placeholder="Person or company name" className={inputClass(errors.billingFullName)} />
          </Field>
          <Field id="billingPhone" label={label("checkout.phoneLabel")} error={errors.billingPhone}>
            <input id="billingPhone" type="tel" inputMode="tel" value={billingAddress.phone} onChange={(e) => setField("billingAddress", "phone", e.target.value)} placeholder="0712 345 678" className={inputClass(errors.billingPhone)} />
          </Field>
          <Field id="billingEmail" label={label("checkout.emailLabel")} error={errors.billingEmail}>
            <input id="billingEmail" type="email" inputMode="email" value={billingAddress.email} onChange={(e) => setField("billingAddress", "email", e.target.value)} placeholder={t("checkout.phEmail")} className={inputClass(errors.billingEmail)} />
          </Field>
          <Field id="billingTin" label={t("checkout.tinOptionalLabel").replace(/\s*\(.*\)\s*$/, "")} optional>
            <input id="billingTin" inputMode="numeric" value={billingAddress.tin || ""} onChange={(e) => setField("billingAddress", "tin", e.target.value)} placeholder={t("checkout.phTin")} className={inputClass()} />
          </Field>
          <Field id="billingCountry" label={label("checkout.countryLabel")}>
            {select("billingCountry", billingAddress.country, (v) => setField("billingAddress", "country", v || "Tanzania"), COUNTRIES, "Tanzania")}
          </Field>
          <Field id="billingCity" label={label("checkout.regionCityLabel")} error={errors.billingCity}>
            <input id="billingCity" value={billingAddress.city} onChange={(e) => setField("billingAddress", "city", e.target.value)} placeholder={t("checkout.phRegionCityBilling")} className={inputClass(errors.billingCity)} />
          </Field>
          <Field id="billingStreet" label={label("checkout.streetNameLabel")} error={errors.billingStreet}>
            <input id="billingStreet" value={billingAddress.streetName || ""} onChange={(e) => setField("billingAddress", "streetName", e.target.value)} placeholder={t("checkout.phStreet")} className={inputClass(errors.billingStreet)} />
          </Field>
          <Field id="billingAddress1" label={label("checkout.houseNumberLabel")} error={errors.billingAddress1}>
            <input id="billingAddress1" value={billingAddress.address1} onChange={(e) => setField("billingAddress", "address1", e.target.value)} placeholder={t("checkout.phHouse")} className={inputClass(errors.billingAddress1)} />
          </Field>
          <Field id="billingPostalCode" label={t("checkout.postalCodeOptionalLabel").replace(/\s*\(.*\)\s*$/, "")} optional>
            <input id="billingPostalCode" inputMode="numeric" value={billingAddress.postalCode} onChange={(e) => setField("billingAddress", "postalCode", e.target.value)} placeholder={t("checkout.phPostal")} className={inputClass()} />
          </Field>
                    </div>
                  )}

      <p className="mt-4 text-xs leading-relaxed text-neutral-500">
        By paying you agree to our{" "}
        <Link href="/terms" className="font-semibold text-neutral-700 underline-offset-2 hover:underline">terms</Link> and{" "}
        <Link href="/privacy" className="font-semibold text-neutral-700 underline-offset-2 hover:underline">privacy policy</Link>.
        The amount is set by the saved order and can&apos;t be changed in the browser.
      </p>
    </SectionCard>
  )

  const waitingSteps = [
    { label: "Order saved", done: !isProcessingPayment || paymentLinkGenerated, active: isProcessingPayment && !paymentLinkGenerated },
    { label: `Prompt sent to ${paymentPhone || "your phone"}`, done: paymentLinkGenerated, active: isProcessingPayment },
    { label: "Approve with your PIN", done: false, active: paymentLinkGenerated },
    { label: "Payment confirmed", done: false, active: false },
  ]

  const paymentPanel = (
    <section className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm" role="status" aria-live="polite">
      <div className="relative px-5 pb-6 pt-6 sm:px-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-60 w-60 rounded-full bg-orange-200/50 blur-3xl" />
        {hasTimedOut ? (
          <div className="relative text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-orange-50">
              <Clock className="h-7 w-7 text-orange-500" />
                    </span>
            <h2 className="mt-4 text-xl font-bold text-neutral-950">The request took too long</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">Your network may be slow. Nothing was charged. Try again: the same order and amount are used.</p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <button type="button" onClick={() => { handleRetryPayment(); setTimeout(handlePlaceOrder, 0) }} className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600">
                <RotateCcw className="h-4 w-4" /> Try again
              </button>
              <button type="button" onClick={handleRetryPayment} className="rounded-2xl border border-neutral-200 px-5 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50">
                Change details
              </button>
                  </div>
                    </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-4">
              <div className="relative grid h-20 w-20 shrink-0 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-orange-400/20 motion-reduce:animate-none" />
                <span className="absolute inset-2 animate-pulse rounded-full bg-orange-100" />
                <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/40">
                  {paymentLinkGenerated ? <Smartphone className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
                        </span>
                      </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">{paymentLinkGenerated ? "Check your phone" : "Connecting"}</p>
                <h2 className="mt-1 text-xl font-bold text-neutral-950 sm:text-2xl">{paymentLinkGenerated ? "Enter your PIN to pay" : "Sending a secure request…"}</h2>
                <p className="mt-1 flex items-center gap-2 text-2xl font-black tabular-nums tracking-tight text-neutral-950">
                  {formatPrice(orderTotal)}
                  {network && <span className="flex items-center gap-1.5 rounded-full bg-neutral-100 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold tracking-normal text-neutral-600"><NetworkMark n={network} size="sm" />{network.wallet}</span>}
                      </p>
                    </div>
                  </div>

            <ol className="mt-6 space-y-3">
              {waitingSteps.map((s) => (
                <li key={s.label} className={cn("flex items-center gap-3 text-sm transition-colors", s.done ? "text-neutral-500" : s.active ? "font-semibold text-neutral-950" : "text-neutral-300")}>
                  <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-white transition", s.done ? "bg-emerald-500" : s.active ? "bg-orange-500 ring-4 ring-orange-500/20" : "bg-neutral-100")}>
                    {s.done ? <Check className="h-3.5 w-3.5" /> : s.active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  </span>
                  {s.label}
                </li>
              ))}
            </ol>

            {paymentLinkGenerated && (
              <div className="mt-6 rounded-2xl bg-orange-50/70 p-4 text-sm text-neutral-700 ring-1 ring-orange-100">
                <p className="flex items-center gap-2 font-semibold text-neutral-950">
                  <Zap className="h-4 w-4 text-orange-500" /> No prompt on {network?.wallet || "your phone"}?
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-neutral-600">
                  <li>Keep the phone unlocked with network signal; prompts can take up to a minute.</li>
                  <li>Make sure the wallet has at least {formatPrice(orderTotal)}. With too little balance the network declines before the PIN prompt.</li>
                  <li>Keep this page open; it updates by itself once you approve.</li>
                </ul>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs tabular-nums text-neutral-500">Waiting {Math.floor(waitSeconds / 60)}:{String(waitSeconds % 60).padStart(2, "0")}</span>
                  <button type="button" onClick={handleRetryPayment} className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-800 hover:bg-neutral-50">
                    Change number / send again
                  </button>
                      </div>
                        </div>
                      )}
                        </div>
                      )}
                    </div>
      <div className="flex items-center justify-center gap-4 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3 text-[11px] font-semibold text-neutral-500">
        <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Amount locked</span>
        <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> PIN stays on your phone</span>
                  </div>
    </section>
  )

  const steps = [
    { label: "Cart", done: true },
    { label: "Details", done: paying, active: !paying },
    { label: "Payment", done: false, active: paying },
    { label: "Done", done: false },
  ]

  /* ----- render ----- */
  return (
    <div className="min-h-screen bg-[#f6f6f7] text-neutral-950">
      <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Link href="/cart" aria-label={t("checkout.backToCart")} className="grid h-9 w-9 place-items-center rounded-full text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950">
              <ArrowLeft className="h-5 w-5" />
          </Link>
            <BrandLogo size="md" href="/products" textClassName="hidden min-[380px]:flex" />
          </div>
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 sm:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-neutral-400" /> Secure checkout
            </span>
            <CheckoutLanguageToggle />
          </div>
        </div>
      </header>

      {!isClient ? (
        <div className="mx-auto max-w-6xl px-4 py-8">
          <CheckoutPageSkeleton />
              </div>
      ) : lines.length === 0 && !paying ? (
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-orange-100 text-orange-600">
            <Package className="h-7 w-7" />
                    </span>
          <h1 className="mt-5 text-2xl font-bold">Nothing to check out yet</h1>
          <p className="mt-2 text-sm text-neutral-500">{t("checkout.toastEmptyCartDesc")}</p>
          <Link href="/products" className="mt-6 inline-flex rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600">
            Browse the Marketplace
          </Link>
                </div>
      ) : (
        <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8 lg:pb-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-7">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{t("checkout.title")}</h1>
            <ol className="flex items-center gap-1.5 text-xs font-semibold" aria-label="Progress">
              {steps.map((s, i) => (
                <li key={s.label} className="flex items-center gap-1.5">
                  <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1", s.done ? "bg-emerald-100 text-emerald-700" : s.active ? "bg-neutral-950 text-white" : "bg-white text-neutral-400 ring-1 ring-neutral-200")}>
                    {s.done && <Check className="h-3 w-3" />}
                    {s.label}
                  </span>
                  {i < steps.length - 1 && <span className="h-px w-3 bg-neutral-300 sm:w-5" />}
                </li>
              ))}
            </ol>
            </div>

          {/* phones: collapsible summary */}
          <div className="mb-4 lg:hidden">
            <button
              type="button"
              onClick={() => setSummaryOpen((o) => !o)}
              aria-expanded={summaryOpen}
              className="flex w-full items-center justify-between rounded-2xl border border-neutral-200/80 bg-white px-4 py-3 text-sm shadow-sm"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Package className="h-4 w-4 text-orange-500" />
                {summaryOpen ? "Hide" : "Show"} order summary
                <ChevronDown className={cn("h-4 w-4 transition-transform", summaryOpen && "rotate-180")} />
              </span>
              <span className="font-black tabular-nums">{formatPrice(orderTotal)}</span>
            </button>
            {summaryOpen && <div className="mt-3">{summary}</div>}
        </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-4">
              {paying ? (
                paymentPanel
              ) : (
                <>
                  {contactSection}
                  {deliverySection}
                  {chinaSection}
                  {paymentSection}
                </>
                  )}
                </div>
            <aside className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:rounded-3xl [scrollbar-width:thin]">{summary}</aside>
          </div>
        </main>
      )}

      {/* phones: sticky pay bar */}
      {isClient && lines.length > 0 && !paying && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:hidden">
          {paymentError && <p className="mb-2 text-center text-xs text-red-600">{paymentError}</p>}
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <p className="text-[11px] font-semibold text-neutral-500">Total</p>
              <p className="text-lg font-black tabular-nums leading-tight">{formatPrice(orderTotal)}</p>
        </div>
            {payButton("flex-1")}
      </div>
        </div>
    )}
    </div>
  )
}
 