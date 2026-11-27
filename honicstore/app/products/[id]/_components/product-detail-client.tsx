'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { whatsappLink } from '@/lib/contact'
import { MakeOffer } from '@/components/product/make-offer'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck, Bell, MessageCircle, Check, ChevronRight, Eye, Heart, Loader2, MapPin, Minus, Package,
  Plus, RotateCcw, Share2, ShoppingCart, Star, Truck, Users, Zap, Bookmark,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCart } from '@/hooks/use-cart'
import { useToast } from '@/hooks/use-toast'
import { useWishlist } from '@/hooks/use-wishlist'
import { useSavedLater } from '@/hooks/use-saved-later'
import { useAuth } from '@/contexts/auth-context'
import { useCurrency } from '@/contexts/currency-context'
import { usePublicCompanyContext } from '@/contexts/public-company-context'
import { checkProductStock } from '@/utils/stock-validation'
import { DetailHeader } from './detail-header'
import { Gallery } from './gallery'
import { ProductTabs } from './product-tabs'
import { RelatedProducts } from './related-products'
import { DeliveryEstimate } from './delivery-estimate'
import { RETURN_DAYS } from '@/lib/policies'
import { RecentlyViewed } from './recently-viewed'
import { recordView } from '@/lib/recently-viewed'
import {
  galleryImages, isUsableImage, minQuantityFor, totalStock, variantLabel, variantStock,
  type ProductDetail, type ProductVariantDetail, type SupplierInfo,
} from './utils'

type PendingAction = { type: 'add' | 'buy'; quantity: number; variantId?: string; price: number }

const BULK_ORDER_MINIMUM = 100

export function ProductDetailClient({ initialProduct, categorySlug = null, returnTo: returnToParam, from }: { initialProduct: ProductDetail; categorySlug?: string | null; returnTo?: string; from?: string }) {
  const router = useRouter()
  // Only same-site paths are honoured, so returnTo cannot send shoppers off-site
  const returnTo = returnToParam && returnToParam.startsWith('/') && !returnToParam.startsWith('//') ? returnToParam : '/products'
  const fromChina = from === 'china'

  const { toast } = useToast()
  const { user, isAuthenticated, loading: authLoading } = useAuth() as any
  const { formatPrice, currency, setCurrency } = useCurrency()
  const { addItem, isInCart, cartUniqueProducts } = useCart()
  const { items: wishlistItems, add: addToWishlist, remove: removeFromWishlist, has: isInWishlist } = useWishlist()
  const { add: addToSavedLater, remove: removeFromSavedLater, has: isInSavedLater } = useSavedLater()
  const { companyName, companyLogo } = usePublicCompanyContext()

  const [product, setProduct] = useState<ProductDetail>(initialProduct)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantDetail | null>(initialProduct.variants?.find((v) => variantStock(v) > 0) ?? initialProduct.variants?.[0] ?? null)
  const [quantity, setQuantity] = useState(minQuantityFor(Number(initialProduct.variants?.[0]?.price) || initialProduct.price))
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null)
  const [sold, setSold] = useState<{ soldCount: number; buyersCount: number | null } | null>(null)
  const [justAdded, setJustAdded] = useState(false)
  const [showStickyBar, setShowStickyBar] = useState(false)

  const [bulkOpen, setBulkOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertTarget, setAlertTarget] = useState(0)
  const [hasAlert, setHasAlert] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const buyButtonsRef = useRef<HTMLDivElement>(null)
  const viewTracked = useRef(false)

  // (Moving to another product remounts this component via key={product.id} in page.tsx, so all
  //  local state starts fresh — no reset effect needed.)

  // Product pages always show TZS (previous behaviour)
  useEffect(() => {
    if (currency !== 'TZS') setCurrency('TZS')
  }, [currency, setCurrency])

  // Suppliers browse from their dashboard — redirect without blocking the page for everyone else
  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return
    const meta = user.user_metadata || {}
    const app = user.app_metadata || {}
    const isSupplier = user.isSupplier || user.profile?.is_supplier || meta.is_supplier || meta.isSupplier || app.is_supplier || app.isSupplier
    if (isSupplier && user.role !== 'admin') router.replace('/supplier/dashboard')
  }, [authLoading, isAuthenticated, user, router])

  // Secondary data after first paint: view count, supplier, sold count — all in parallel
  useEffect(() => {
    const id = product.id
    let cancelled = false
    if (!viewTracked.current) {
      viewTracked.current = true
      fetch(`/api/products/${id}/view`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
        .then((r) => r.json())
        .then((d) => { if (!cancelled && d?.success && typeof d.views === 'number') setProduct((p) => (p.views === d.views ? p : { ...p, views: d.views })) })
        .catch(() => { viewTracked.current = false })
    }
    fetch(`/api/products/${id}/supplier-info`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d && !d.error) setSupplier(d) })
      .catch(() => {})
    fetch(`/api/products/${id}/sold-count`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d && typeof d.soldCount === 'number') setSold(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [product.id])

  // Show the phone sticky bar once the main buy buttons scroll out of view
  useEffect(() => {
    const el = buyButtonsRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setShowStickyBar(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // ---- derived ----
  const images = useMemo(() => galleryImages(product), [product])
  const stock = useMemo(() => totalStock(product), [product])
  const hasVariants = (product.variants?.length ?? 0) > 0
  // options with different prices show their price on every button
  const optionPricesDiffer = new Set((product.variants || []).map((v) => Number(v.price))).size > 1
  // specifications: the product's, with the chosen option's own values on top
  const shownProduct = useMemo(() => {
    const own = selectedVariant?.specifications
    if (!own || !Object.keys(own).length) return product
    return { ...product, specifications: { ...(product.specifications || {}), ...own } }
  }, [product, selectedVariant])
  const availableStock = selectedVariant ? variantStock(selectedVariant) : stock
  const price = Number(selectedVariant?.price) || product.price || 0
  const originalPrice = Number(selectedVariant?.originalPrice || product.originalPrice || 0)
  const discount = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0
  const minQty = minQuantityFor(price)
  const inStock = stock > 0
  const isChina = !fromChina && product.importChina
  const inWishlist = isInWishlist(product.id)
  const inSaved = isInSavedLater(product.id)
  const inCart = isInCart(product.id, selectedVariant?.id != null ? String(selectedVariant.id) : undefined)
  // Store policy is the minimum (lib/policies.ts); a seller may offer longer
  const returnUnit = product.return_time_type ?? 'days'
  const returnDays = returnUnit === 'days' ? Math.max(Number(product.return_time_value) || 0, RETURN_DAYS) : (product.return_time_value ?? RETURN_DAYS)

  // ---- actions ----
  const changeQty = useCallback((delta: number) => {
    setQuantity((prev) => {
      const next = prev + delta
      if (delta > 0 && next > availableStock) {
        toast({
          title: 'Insufficient Stock',
          description: `Only ${availableStock} ${availableStock === 1 ? 'unit' : 'units'} available${selectedVariant ? ' for this option' : ''}.`,
          variant: 'destructive',
        })
        return prev
      }
      return Math.max(minQty, next)
    })
  }, [availableStock, selectedVariant, minQty, toast])

  const setQtyDirect = (raw: string) => {
    const n = parseInt(raw.replace(/\D/g, ''), 10)
    if (Number.isNaN(n)) return
    if (n < minQty) { setQuantity(minQty); return }
    if (n > availableStock && availableStock > 0) {
      toast({ title: 'Insufficient Stock', description: `Only ${availableStock} available.`, variant: 'destructive' })
      setQuantity(availableStock)
      return
    }
    setQuantity(n)
  }

  /** Same checks and order as the previous page. Returns true when the item was added. */
  const addToCart = (): boolean => {
    const stockCheck = checkProductStock(product as any)
    if (!stockCheck.isAvailable) {
      toast({ title: 'Out of Stock', description: stockCheck.message || 'This product is currently unavailable.', variant: 'destructive' })
      return false
    }
    if (isChina) {
      setPending({ type: 'add', quantity, variantId: selectedVariant?.id?.toString(), price })
      return false
    }
    if (hasVariants) {
      if (!selectedVariant) {
        toast({ title: 'Please choose an option', description: 'Select an option before adding to cart.', variant: 'destructive' })
        return false
      }
      const qty = variantStock(selectedVariant)
      if (qty < quantity) {
        toast({ title: 'Insufficient Stock', description: `Only ${qty} units available for this option.`, variant: 'destructive' })
        return false
      }
    }
    addItem(product.id, quantity, selectedVariant?.id?.toString(), {}, price, selectedVariant?.sku ?? undefined, selectedVariant?.image ?? undefined, product)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1800)
    toast({ title: 'Added to cart', description: `${quantity} × ${product.name}` })
    return true
  }

  const buyNow = () => {
    if (isChina) {
      setPending({ type: 'buy', quantity, variantId: selectedVariant?.id?.toString(), price })
      return
    }
    if (addToCart()) setTimeout(() => router.push('/cart'), 100)
  }

  const confirmChinaImport = () => {
    if (!pending) return
    addItem(product.id, pending.quantity, pending.variantId, {}, pending.price)
    if (pending.type === 'buy') {
      try {
        sessionStorage.setItem('buy_now_item_data', JSON.stringify({
          id: Date.now(),
          productId: product.id,
          variants: [{ variantId: pending.variantId || 'base', attributes: {}, quantity: pending.quantity, price: pending.price, sku: product.sku, image: product.image }],
          totalQuantity: pending.quantity,
          totalPrice: pending.price * pending.quantity,
          currency: 'TZS',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          product: { id: product.id, name: product.name, image: product.image, price: pending.price, originalPrice: product.originalPrice, inStock: product.inStock, stockQuantity: product.stockQuantity, sku: product.sku },
        }))
        sessionStorage.setItem('buy_now_mode', 'true')
      } catch { /* sessionStorage unavailable */ }
      router.push('/checkout')
    } else {
      toast({ title: 'Added to cart', description: `${pending.quantity} × ${product.name} (import)` })
    }
    setPending(null)
  }

  const toggleWishlist = async () => {
    if (inWishlist) { await removeFromWishlist(product.id); toast({ title: 'Removed from Wishlist', description: product.name }) }
    else { await addToWishlist(product.id); toast({ title: 'Added to Wishlist', description: product.name }) }
  }

  const toggleSaved = async () => {
    if (inSaved) { await removeFromSavedLater(product.id); toast({ title: 'Removed from Saved for Later', description: product.name }) }
    else { await addToSavedLater(product.id); toast({ title: 'Saved for Later', description: product.name }) }
  }

  const share = async () => {
    const url = window.location.href.split('?')[0]
    try {
      if (navigator.share) await navigator.share({ title: product.name, url })
      else { await navigator.clipboard.writeText(url); toast({ title: 'Link copied', description: 'Product link copied to clipboard.' }) }
    } catch { /* user cancelled */ }
  }

  const openBulk = () => {
    if (availableStock < BULK_ORDER_MINIMUM) {
      toast({
        title: 'Not enough stock for a bulk order',
        description: `Bulk orders need at least ${BULK_ORDER_MINIMUM} items, but only ${availableStock} ${availableStock === 1 ? 'unit is' : 'units are'} available.`,
        variant: 'destructive',
      })
      return
    }
    setQuantity(BULK_ORDER_MINIMUM)
    setBulkOpen(true)
  }

  const openAlert = () => {
    if (!isAuthenticated) { toast({ title: 'Sign in required', description: 'Please sign in to set price alerts.' }); return }
    setAlertTarget(price)
    setAlertOpen(true)
  }

  const saveAlert = async () => {
    if (alertTarget <= 0) { toast({ title: 'Invalid Price', description: 'Please enter a valid target price.' }); return }
    try {
      const r = await fetch('/api/user/price-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, targetPrice: alertTarget }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setHasAlert(true)
        setAlertOpen(false)
        toast({ title: 'Price alert set', description: `We'll email you when it drops to ${formatPrice(alertTarget)}.` })
      } else {
        toast({ title: 'Error', description: d.error || 'Failed to set price alert', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to set price alert. Please try again.', variant: 'destructive' })
    }
  }

  // Seller card. Products without a supplier profile are sold by the store itself.
  const sellerName = supplier ? (supplier.companyName || companyName || 'Honic Company Store') : null
  const sellerLogo = supplier && isUsableImage(supplier.companyLogo) ? supplier.companyLogo : (supplier && !supplier.companyName && isUsableImage(companyLogo) ? companyLogo : null)
  const isOfficial = !!supplier && !supplier.companyName
  const sellerStats = supplier ? [
    supplier.rating ? { key: 'rating', value: <span className="inline-flex items-center gap-1">{supplier.rating.toFixed(1)}<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /></span>, label: supplier.reviewCount ? `${supplier.reviewCount} reviews` : 'Rating' } : null,
    supplier.productCount ? { key: 'products', value: supplier.productCount.toLocaleString(), label: 'Products' } : null,
    supplier.region ? { key: 'region', value: <span className="inline-flex max-w-full items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0 text-orange-500" /><span className="truncate">{supplier.region}</span></span>, label: 'Ships from' } : null,
  ].filter(Boolean) as { key: string; value: React.ReactNode; label: string }[] : []
  // "Seller pass": identity on one side, stats on the other, joined by a perforated tear line.
  // Lays out side by side when the card is wide enough (container query), stacked when narrow.
  const supplierCard = (
    <section aria-label="Seller" className="[container-type:inline-size]">
      <div className="relative flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-orange-50 via-white to-white ring-1 ring-neutral-200 dark:from-orange-500/10 dark:via-neutral-900 dark:to-neutral-900 dark:ring-neutral-800 [@container(min-width:540px)]:flex-row [@container(min-width:540px)]:items-stretch">
        {/* soft glow + dot texture */}
        <span aria-hidden className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full bg-orange-300/30 blur-3xl dark:bg-orange-500/20" />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-60 [background-image:radial-gradient(theme(colors.neutral.300)_1px,transparent_1px)] [background-size:12px_12px] [mask-image:linear-gradient(to_left,black,transparent)] dark:[background-image:radial-gradient(theme(colors.neutral.700)_1px,transparent_1px)]" />

        <div className="relative flex min-w-0 flex-1 items-center gap-3.5 p-4">
          {supplier ? (
            <>
              <span className="relative shrink-0 rounded-2xl bg-gradient-to-br from-orange-400 via-orange-500 to-rose-500 p-[2px] shadow-lg shadow-orange-500/20">
                <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-[14px] bg-white text-lg font-black text-orange-600 dark:bg-neutral-900">
                  {sellerLogo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={sellerLogo} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
                    : (sellerName || 'H').trim().charAt(0).toUpperCase()}
                </span>
                {(supplier.isVerified || isOfficial) && (
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-white shadow ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
                    <BadgeCheck className="h-4 w-4 text-sky-500" aria-label="Verified" />
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600/80 dark:text-orange-400/80">Sold by</p>
                <p className="truncate text-[15px] font-extrabold leading-snug text-neutral-950 dark:text-white">{sellerName}</p>
                {(isOfficial || supplier.isVerified) && (
                  <span className={`mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${isOfficial ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950' : 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isOfficial ? 'bg-orange-400' : 'bg-sky-500'}`} />
                    {isOfficial ? 'Official store' : 'Verified seller'}
                  </span>
                )}
                {supplier.detailSentence && <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{supplier.detailSentence}</p>}
              </div>
            </>
          ) : (
            <><div className="h-[52px] w-[52px] animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" /><div className="flex-1 space-y-2"><div className="h-2.5 w-16 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" /><div className="h-3.5 w-2/3 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" /></div></>
          )}
        </div>

        {sellerStats.length > 0 && (
          <>
            {/* tear line with ticket notches: horizontal when stacked, vertical when side by side */}
            <div aria-hidden className="relative mx-4 border-t-2 border-dashed border-neutral-200 dark:border-neutral-700 [@container(min-width:540px)]:mx-0 [@container(min-width:540px)]:my-4 [@container(min-width:540px)]:border-l-2 [@container(min-width:540px)]:border-t-0">
              <span className="absolute -left-[26px] -top-[9px] h-4 w-4 rounded-full bg-white ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800 [@container(min-width:540px)]:-left-[9px] [@container(min-width:540px)]:-top-[26px]" />
              <span className="absolute -right-[26px] -top-[9px] h-4 w-4 rounded-full bg-white ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800 [@container(min-width:540px)]:-bottom-[26px] [@container(min-width:540px)]:-left-[9px] [@container(min-width:540px)]:right-auto [@container(min-width:540px)]:top-auto" />
            </div>
            <dl className="relative grid grid-flow-col auto-cols-fr divide-x divide-neutral-200/80 px-1 py-3 dark:divide-neutral-800 [@container(min-width:540px)]:flex [@container(min-width:540px)]:items-center [@container(min-width:540px)]:py-0 [@container(min-width:540px)]:pl-1 [@container(min-width:540px)]:pr-3">
              {sellerStats.map((st) => (
                <div key={st.key} className="flex min-w-0 flex-col items-center px-1 text-center [@container(min-width:540px)]:max-w-[9.5rem] [@container(min-width:540px)]:px-3">
                  <dt className="order-last mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{st.label}</dt>
                  <dd className="max-w-full truncate text-[13px] font-extrabold [@container(min-width:540px)]:text-sm text-neutral-950 dark:text-white">{st.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </section>
  )

  const badges = (
    <>
      {discount > 0 && <span className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-bold text-white shadow">-{discount}%</span>}
      {product.importChina && <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-red-700 shadow ring-1 ring-red-200">Imported from China</span>}
    </>
  )

  const logo = isUsableImage(companyLogo) ? companyLogo : '/android-chrome-192x192.png'

  // "Recently viewed" (per visitor, localStorage)
  useEffect(() => {
    recordView({ id: product.id, name: product.name, slug: (product as any).slug, price: product.price, image: images[0] || product.image, category: product.category })
  }, [product.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // WhatsApp: the store's WhatsApp line (lib/contact.ts, +255 786 957 939 unless NEXT_PUBLIC_WHATSAPP_NUMBER is set)
  const whatsappHref = useMemo(() => {
    // Same link on server and browser (window.location made them differ -> hydration error)
    const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://honiccompanystore.com').replace(/\/$/, '')
    const text = `Hello, I'm interested in "${product.name}" (${formatPrice(price)}). ${site}/products/${product.id}`
    return whatsappLink(text)
  }, [product.name, product.id, price, formatPrice])

  // ---------- render ----------
  return (
    <div className="min-h-screen bg-white pb-24 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 lg:pb-0">
      <DetailHeader
        companyName={companyName}
        logo={logo}
        cartCount={cartUniqueProducts}
        wishlistCount={wishlistItems?.length || 0}
        returnTo={returnTo}
        formatPrice={formatPrice}
        showProductBar={showStickyBar}
        product={{ name: product.name, image: selectedVariant?.image || images[0], price, inStock }}
        onAddToCart={addToCart}
        onBuyNow={buyNow}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 overflow-x-auto whitespace-nowrap py-1 text-xs text-neutral-500 [scrollbar-width:none] sm:text-sm [&_a]:inline-block [&_a]:py-2.5">
          <Link href="/" className="hover:text-orange-600">Home</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <Link href={returnTo} className="hover:text-orange-600">Products</Link>
          {product.category && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              <Link href={categorySlug ? `/products?category=${encodeURIComponent(categorySlug)}` : `/products?search=${encodeURIComponent(product.category)}`} className="hover:text-orange-600">{product.category}</Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-neutral-800 dark:text-neutral-200">{product.name}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 xl:gap-14">
          <div className="flex min-w-0 flex-col">
            <Gallery images={images} alt={product.name} video={product.video} view360={product.view360} focusImage={selectedVariant?.image} badges={badges} />
            <div className="hidden shrink-0 pt-6 lg:block">{supplierCard}</div>
          </div>

          {/* Buy box */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {product.brand && <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold dark:bg-neutral-800">{product.brand}</span>}
              {product.category && <span className="text-neutral-500">{product.category}</span>}
              {product.sku && <span className="text-neutral-400">SKU {product.sku}</span>}
            </div>

            <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight sm:text-3xl">{product.name}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              {(product.reviews || 0) > 0 ? (
                <a href="#details" className="-my-2 flex items-center gap-1 py-2 hover:text-orange-600">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-neutral-900 dark:text-white">{Number(product.rating || 0).toFixed(1)}</span>
                  <span>({product.reviews} {product.reviews === 1 ? 'review' : 'reviews'})</span>
                </a>
              ) : (
                <a href="#details" className="-my-2 flex items-center gap-1 py-2 hover:text-orange-600">
                  <Star className="h-4 w-4 text-neutral-300" /> No reviews yet
                </a>
              )}
              {sold && sold.soldCount > 0 && <span className="flex items-center gap-1"><Package className="h-4 w-4" />{sold.soldCount} sold</span>}
              {typeof product.views === 'number' && product.views >= 100 && <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{product.views.toLocaleString()} views</span>}
            </div>

            {/* Price card */}
            <div className="mt-5 rounded-3xl bg-gradient-to-br from-orange-50 to-rose-50 p-4 ring-1 ring-orange-100 dark:from-orange-950/30 dark:to-rose-950/20 dark:ring-orange-900/40 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-3xl font-black tracking-tight text-neutral-950 dark:text-white sm:text-4xl">{formatPrice(price)}</span>
                    {discount > 0 && (
                      <>
                        <span className="text-base text-neutral-400 line-through">{formatPrice(originalPrice)}</span>
                        <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">Save {formatPrice(originalPrice - price)}</span>
                      </>
                    )}
                  </div>
                  {minQty > 1 && <p className="mt-1 text-xs text-neutral-600">Minimum order: {minQty} pieces</p>}
                </div>
                <button onClick={openAlert} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${hasAlert ? 'bg-orange-500 text-white ring-orange-500' : 'bg-white text-neutral-700 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700'}`}>
                  <Bell className="h-3.5 w-3.5" /> {hasAlert ? 'Alert set' : 'Price alert'}
                </button>
              </div>
            </div>

            {/* Status chips */}
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium sm:text-sm">
              {inStock ? (
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${availableStock <= 5 ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'}`}>
                  <span className={`h-2 w-2 rounded-full ${availableStock <= 5 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  {availableStock <= 5 ? `Only ${availableStock} left` : `In stock (${availableStock})`}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-red-700 dark:bg-red-900/20 dark:text-red-300"><span className="h-2 w-2 rounded-full bg-red-500" />Out of stock</span>
              )}
              {product.freeDelivery && <span className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800"><Truck className="h-4 w-4 text-emerald-600" />Free delivery</span>}
              {product.sameDayDelivery && <span className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800"><Zap className="h-4 w-4 text-orange-500" />Same-day delivery</span>}
              <Link href="/support/returns-refunds" className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 hover:bg-neutral-200 dark:bg-neutral-800"><RotateCcw className="h-4 w-4" />{returnDays}-{returnUnit === 'days' ? 'day' : returnUnit} returns</Link>
            </div>

            {/* Variants */}
            {hasVariants && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Option: <span className="font-normal text-neutral-600 dark:text-neutral-400">{selectedVariant ? variantLabel(selectedVariant, product.variants.indexOf(selectedVariant)) : 'Choose one'}</span></span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v, i) => {
                    const active = selectedVariant?.id === v.id
                    const out = variantStock(v) <= 0
                    return (
                      <button
                        key={v.id}
                        onClick={() => { setSelectedVariant(v); setQuantity((q) => Math.min(Math.max(q, minQty), Math.max(variantStock(v), minQty))) }}
                        disabled={out}
                        aria-pressed={active}
                        className={`group relative flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-sm transition-all ${active ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30' : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-700'} ${out ? 'cursor-not-allowed opacity-40 line-through' : ''}`}
                      >
                        {isUsableImage(v.image) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.image} alt="" className="h-9 w-9 rounded-lg bg-white object-contain" loading="lazy" />
                        )}
                        <span>
                          <span className="block font-semibold">{variantLabel(v, i)}</span>
                          {(optionPricesDiffer || Number(v.price) !== product.price) && <span className="block text-xs text-neutral-500">{formatPrice(Number(v.price))}</span>}
                        </span>
                        {active && <Check className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-orange-500 p-0.5 text-white" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="text-sm font-semibold">Quantity</span>
              <div className="flex items-center rounded-full border border-neutral-300 dark:border-neutral-700">
                <button onClick={() => changeQty(-1)} disabled={!inStock} className="grid h-10 w-10 place-items-center rounded-full hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
                <input value={quantity} onChange={(e) => setQtyDirect(e.target.value)} inputMode="numeric" aria-label="Quantity" className="w-12 bg-transparent text-center font-semibold outline-none" />
                <button onClick={() => changeQty(1)} disabled={!inStock} className="grid h-10 w-10 place-items-center rounded-full hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
              </div>
              <span className="text-sm text-neutral-500">Total <span className="font-bold text-neutral-900 dark:text-white">{formatPrice(price * quantity)}</span></span>
            </div>

            {/* Main actions */}
            <div ref={buyButtonsRef} className="mt-6 grid grid-cols-2 gap-3">
              <Button
                onClick={addToCart}
                disabled={!inStock}
                className={`h-12 rounded-2xl text-base font-bold shadow-sm transition-colors ${justAdded ? 'bg-emerald-500 hover:bg-emerald-500' : 'bg-orange-500 hover:bg-orange-600'} text-white`}
              >
                {justAdded ? <><Check className="mr-2 h-5 w-5" /> Added</> : <><ShoppingCart className="mr-2 h-5 w-5" /> {inCart ? 'Add more' : 'Add to cart'}</>}
              </Button>
              <Button onClick={buyNow} disabled={!inStock} className="h-12 rounded-2xl bg-neutral-950 text-base font-bold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200">
                <Zap className="mr-2 h-5 w-5" /> Buy now
              </Button>
            </div>

            {/* Secondary actions */}
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs font-medium">
              <SecondaryAction active={inWishlist} onClick={toggleWishlist} icon={<Heart className={`h-5 w-5 ${inWishlist ? 'fill-rose-500 text-rose-500' : ''}`} />} label={inWishlist ? 'Saved' : 'Wishlist'} />
              <SecondaryAction active={inSaved} onClick={toggleSaved} icon={<Bookmark className={`h-5 w-5 ${inSaved ? 'fill-orange-500 text-orange-500' : ''}`} />} label="Later" />
              <SecondaryAction onClick={openBulk} icon={<Users className="h-5 w-5" />} label="Bulk order" />
              <SecondaryAction onClick={share} icon={<Share2 className="h-5 w-5" />} label="Share" />
            </div>

            {/* bargaining: offer -> team replies with a one-time code -> pay here */}
            {price > 0 && availableStock > 0 && (
              <MakeOffer
                productId={product.id}
                variantId={selectedVariant?.id != null ? Number(selectedVariant.id) : null}
                productName={selectedVariant?.variant_name ? `${product.name} (${selectedVariant.variant_name})` : product.name}
                price={price}
                quantity={quantity}
                maxQuantity={availableStock}
                formatPrice={formatPrice}
                defaultName={user?.name || user?.profile?.full_name || ''}
                defaultPhone={user?.profile?.phone || ''}
                defaultEmail={user?.email || ''}
              />
            )}

            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900"
              >
                <MessageCircle className="h-5 w-5" /> Ask about this product on WhatsApp
              </a>
            )}

            {/* Delivery fee & time for the shopper's area (same calculator as checkout) */}
            <DeliveryEstimate price={price} quantity={quantity} shippingSize={product.shippingSize} freeDelivery={product.freeDelivery} formatPrice={formatPrice} />

            {/* Supplier (phones/tablets; desktop shows it under the gallery) */}
            <div className="mt-6 lg:hidden">{supplierCard}</div>
          </div>
        </div>

        <div className="mt-10 lg:mt-14">
          <ProductTabs product={shownProduct} />
        </div>

        <RelatedProducts productId={product.id} categorySlug={categorySlug} productName={product.name} price={product.price} formatPrice={formatPrice} />
        <RecentlyViewed excludeId={product.id} formatPrice={formatPrice} />
      </main>

      {/* Phone/tablet sticky buy bar */}
      <div className={`fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] transition-transform duration-200 will-change-transform dark:border-neutral-800 dark:bg-neutral-950 lg:hidden ${showStickyBar ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-neutral-500">{quantity} × {product.name}</p>
            <p className="text-lg font-black">{formatPrice(price * quantity)}</p>
          </div>
          <Button onClick={addToCart} disabled={!inStock} size="icon" className={`h-11 w-11 rounded-2xl ${justAdded ? 'bg-emerald-500 hover:bg-emerald-500' : 'bg-orange-500 hover:bg-orange-600'} text-white`} aria-label="Add to cart">
            {justAdded ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
          </Button>
          <Button onClick={buyNow} disabled={!inStock} className="h-11 rounded-2xl bg-neutral-950 px-5 font-bold text-white hover:bg-neutral-800">
            Buy now
          </Button>
        </div>
      </div>

      {/* Dialogs */}

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk order</DialogTitle>
            <DialogDescription>Minimum {BULK_ORDER_MINIMUM} items. We&apos;ve set your quantity to {BULK_ORDER_MINIMUM}.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">✓ {availableStock} items available in stock</p>
          <DialogFooter><Button className="w-full rounded-xl" onClick={() => setBulkOpen(false)}>OK</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set a price alert</DialogTitle>
            <DialogDescription>We&apos;ll email you when the price drops to your target or lower.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="target-price">Target price (TSh)</Label>
            <Input id="target-price" type="number" min="0" step="1" value={alertTarget || ''} onChange={(e) => setAlertTarget(parseFloat(e.target.value) || 0)} className="h-11 rounded-xl" />
            <p className="text-xs text-neutral-500">Current price: {formatPrice(price)}</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl" onClick={() => setAlertOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={saveAlert}>Set alert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null) }}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import notice</DialogTitle>
            <DialogDescription>
              This item is not in our local stock at the moment, but we can import it within 7–10 days. Same price, same quality — just a short wait.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl" onClick={() => setPending(null)}>Cancel</Button>
            <Button className="rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={confirmChinaImport}>
              {pending?.type === 'buy' ? 'Continue to checkout' : 'Add to cart'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SecondaryAction({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 ring-1 transition-colors ${active ? 'bg-orange-50 ring-orange-200 dark:bg-orange-950/30 dark:ring-orange-900' : 'ring-neutral-200 hover:bg-neutral-50 dark:ring-neutral-800 dark:hover:bg-neutral-900'}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export function ProductDetailFallback() {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-2">
      <div className="aspect-square animate-pulse rounded-3xl bg-neutral-100" />
      <div className="space-y-4">
        <div className="h-8 w-3/4 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-12 animate-pulse rounded-2xl bg-neutral-100" />
        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
      </div>
    </div>
  )
}
