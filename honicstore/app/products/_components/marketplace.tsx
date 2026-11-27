'use client'

/**
 * Marketplace — the main products page.
 * Route: /products   (?search=…  &mode=ai  &mainCategory=… &subCategory=…  &sort= &minPrice= &maxPrice= &inStock=1)
 *
 * Real data:
 *  - /api/categories      → category sidebar / chips / drawer / "continue exploring"
 *  - /api/search          → typed search + "Handpicked for you" (DB function search_products_v2: typo-tolerant, ranked)
 *  - /api/search/ai       → AI search: Gemini turns a natural-language request into keywords/category/price/sort
 *  - Honic Lens (photo search) via openLens()
 *  - useCart (add to cart + count), useCurrency, usePublicCompanyContext
 * Recently viewed is shared with the product page (lib/recently-viewed).
 * Titles / canonical URLs per view are set by the server wrapper (app/products/page.tsx).
 *
 * Layout adapts per breakpoint:
 *  - phone  (<640):  sticky search bar, category chip strip, swipe cards, 2-col grid,
 *                    icon add-to-cart, bottom tab bar + category drawer
 *  - tablet (640–1023): chip strip, 2×2 card grid + full-width promo, 3–4 col grid
 *  - desktop (≥1024): category sidebar with flyout, card row + promo, 5–6 col grid,
 *                    floating help rail
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight, BadgeCheck, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  ClipboardList, FileText, Home, LayoutGrid, Loader2, Menu, MessageCircle, Minus, Plus,
  ScanSearch, Search, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, Star, Truck, User, X, Zap,
} from 'lucide-react'
import { optimizedImg } from '@/lib/image-optimize'
import { freeDeliveryThreshold } from '@/lib/shipping-pricing'
import { useCurrency } from '@/contexts/currency-context'
import { useCart } from '@/hooks/use-cart'
import { useToast } from '@/hooks/use-toast'
import { usePublicCompanyContext } from '@/contexts/public-company-context'
import { checkProductStock } from '@/utils/stock-validation'
import { openLens } from '@/components/image-search/lens'
import { BrandLogo } from '@/components/brand-logo'
import { readRecentlyViewed, recordView } from '@/lib/recently-viewed'

// ---------- types ----------
type Category = {
  id: string
  name: string
  slug: string
  image_url?: string | null
  parent_id?: string | null
  parent_slug?: string | null
  is_main?: boolean
  product_count?: number
}

type Variant = { id?: number | string; price?: number | string; stock_quantity?: number; stockQuantity?: number; image?: string | null; variant_name?: string | null }

type Product = {
  id: number
  name: string
  slug?: string
  price: number
  original_price?: number
  originalPrice?: number
  image?: string | null
  rating?: number
  reviews?: number
  category?: string
  sold_count?: number
  free_delivery?: boolean
  freeDelivery?: boolean
  importChina?: boolean
  import_china?: boolean
  is_new?: boolean
  sameDayDelivery?: boolean
  same_day_delivery?: boolean
  supplier_verified?: boolean
  stockQuantity?: number
  stock_quantity?: number
  gallery?: unknown
  variants?: Variant[]
  [k: string]: unknown
}

type SearchMode = 'ai' | 'products'
type FormatPrice = (n: number) => string
type AddToCart = (p: Product) => Promise<boolean>
type CartQty = { of: (p: Product) => number; set: (p: Product, qty: number) => void }

const PAGE_SIZE = 24

// Real searches that return products (checked against the catalog)
const PLACEHOLDERS = [
  'water purifier',
  'arduino uno',
  '3D printer',
  'soldering iron',
  'starter kit',
]

const PROMO_SLIDES = [
  { kicker: 'Honic picks', title: 'Top-rated this week', subtitle: 'Products our customers keep coming back for', cta: 'Shop picks', href: '/products', theme: 'dark' as const },
  { kicker: 'Delivery', title: `Free over TSh ${freeDeliveryThreshold().toLocaleString('en-US')}`, subtitle: 'Delivered anywhere in Tanzania, or pick up free in Dar es Salaam', cta: 'Delivery details', href: '/support/shipping-info', theme: 'yellow' as const },
  { kicker: 'Grow with us', title: 'Sell on Honic', subtitle: 'Open your shop and reach buyers across Tanzania', cta: 'Get started', href: '/become-supplier', theme: 'light' as const },
]

const SLIDE_STYLES = {
  dark: { wrap: 'bg-gradient-to-br from-orange-500 to-rose-500 text-white', kicker: 'text-orange-100', sub: 'text-orange-50', cta: 'bg-white text-orange-600' },
  yellow: { wrap: 'bg-gradient-to-br from-amber-100 via-orange-50 to-white text-neutral-950', kicker: 'text-orange-700', sub: 'text-neutral-600', cta: 'bg-orange-500 text-white' },
  light: { wrap: 'bg-gradient-to-br from-rose-100 via-pink-50 to-white text-neutral-950', kicker: 'text-rose-700', sub: 'text-neutral-600', cta: 'bg-neutral-900 text-white' },
}

// ---------- helpers ----------
const slugify = (s: string) =>
  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'product'
const productHref = (p: Product) => (p.importChina || p.import_china ? `/buy-from-china/${p.id}` : `/products/${p.id}-${slugify(p.slug || p.name || '')}`)

const categoryHref = (c: Category) =>
  c.is_main || !c.parent_slug
    ? `/products?mainCategory=${encodeURIComponent(c.slug)}`
    : `/products?mainCategory=${encodeURIComponent(c.parent_slug)}&subCategory=${encodeURIComponent(c.slug)}`

const isImageUrl = (s?: string | null) => !!s && /^(https?:)?\/\//.test(s)

const firstVariantId = (p: Product) => (p.variants?.[0]?.id != null ? String(p.variants[0].id) : undefined)
/** Smallest quantity a card allows (any quantity; the TSh 500 payment minimum is checked on the order total) */
const MIN_QTY = 1
/** Old links used ?sortBy=rating / created_at */
const LEGACY_SORT: Record<string, SortBy> = { rating: 'popular', created_at: 'newest', newest: 'newest', price_asc: 'price_asc', price_desc: 'price_desc', popular: 'popular' }
const SORT_TITLES: Partial<Record<SortBy, string>> = { popular: 'Best sellers', newest: 'New arrivals', rating: 'Top rated' }
/** Fisher-Yates shuffle (a new array). */
function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
/** After every 10 regular items, 2 or 3 items from the (already shuffled) pool; each pool item once. */
/** Small seeded random numbers, so the mix stays put while more products load. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
/**
 * 2 or 3 pool items in every block of 10 regular items, at random places inside the block and never
 * next to each other (each pool item once). Same seed = same layout, so loading more never reshuffles.
 */
function mixIn<T extends { id: number }>(base: T[], pool: T[], seed: number): T[] {
  if (!pool.length) return base
  const seen = new Set(base.map((p) => p.id))
  const extra = pool.filter((p) => !seen.has(p.id))
  const out: T[] = []
  let next = 0
  for (let start = 0; start < base.length; start += 10) {
    const block = base.slice(start, start + 10)
    if (block.length < 10) { out.push(...block); break } // a partial last block waits for the next page
    const rnd = seeded(seed + start)
    const take = rnd() < 0.5 ? 2 : 3
    // insertion points 1..9 (after that many regular items), at least 2 apart
    const points: number[] = []
    for (let guard = 0; points.length < take && guard < 50; guard++) {
      const p = 1 + Math.floor(rnd() * 9)
      if (points.every((q) => Math.abs(q - p) >= 2)) points.push(p)
    }
    block.forEach((p, i) => {
      out.push(p)
      if (points.includes(i + 1) && next < extra.length) out.push(extra[next++])
    })
  }
  return out
}
/** Stock of the variant the card adds, else the product total. */
const stockOf = (p: Product) => {
  const v = p.variants?.[0]
  if (v) return Number(v.stock_quantity ?? v.stockQuantity ?? 0)
  return Number(p.stockQuantity ?? p.stock_quantity ?? 0)
}
/** First real extra photo (not the main image, not a placeholder) for the hover swap. */
const hoverImageOf = (p: Product) => {
  const list = Array.isArray(p.gallery) ? (p.gallery as unknown[]) : []
  const extra = [...list, ...(p.variants || []).map(v => v.image)]
  return (extra.find(u => typeof u === 'string' && isImageUrl(u) && u !== p.image && !u.includes('placeholder')) as string | undefined) || null
}

// Recently viewed — shared with the product page (lib/recently-viewed)
const readHistory = () => readRecentlyViewed() as unknown as Product[]
const pushHistory = (p: Product) => recordView({ id: p.id, name: p.name, slug: p.slug, price: p.price, image: p.image ?? null, category: p.category ?? null })

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onOutside])
}

// ---------- page ----------
export default function MarketplacePage() {
  // useSearchParams needs a Suspense boundary for server rendering
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <Marketplace />
    </Suspense>
  )
}

type AiGroup = { term: string; matchedTerm?: string; why: string; count: number; exact: boolean; productIds: number[] }
type SellerChip = { id: string; name: string; verified: boolean; products: number }
type ResultsState = {
  products: Product[]
  sellers: SellerChip[] // sellers whose business name matches the search
  seller: SellerChip | null // set when the list is filtered to one seller
  total: number
  hasMore: boolean
  exact: boolean
  loading: boolean
  error: string | null
  interpretation: AiInterpretation | null
  groups: AiGroup[]
  relaxed: boolean
}
const EMPTY_RESULTS: ResultsState = { products: [], sellers: [], seller: null, total: 0, hasMore: false, exact: true, loading: false, error: null, interpretation: null, groups: [], relaxed: false }

function Marketplace() {
  const router = useRouter()
  const sp = useSearchParams()
  // URL is the source of truth for search/filters (shareable, back button works)
  const urlQ = (sp.get('search') || sp.get('q') || '').trim()
  const urlMode: SearchMode = sp.get('mode') === 'ai' ? 'ai' : 'products'
  const urlCat = sp.get('subCategory') || sp.get('mainCategory') || sp.get('category') || ''
  const urlSort = ((sp.get('sort') && (Object.keys(SORT_LABELS) as string[]).includes(sp.get('sort')!) ? sp.get('sort') : LEGACY_SORT[sp.get('sortBy') || '']) || 'relevance') as SortBy
  const urlMin = sp.get('minPrice') || ''
  const urlMax = sp.get('maxPrice') || ''
  const urlStock = sp.get('inStock') === '1'
  const urlSeller = /^[0-9a-f-]{36}$/i.test(sp.get('seller') || '') ? sp.get('seller')! : ''
  const isResults = !!(urlQ || urlCat || urlSeller || urlSort !== 'relevance')
  const { formatPrice } = useCurrency()
  const { cartTotalItems, addItem, getItemQuantity, updateItemQuantity, removeItem } = useCart()
  const { toast } = useToast()
  const { companyName } = usePublicCompanyContext()
  const brand = companyName || 'Honic'

  // banner / header
  const [showBanner, setShowBanner] = useState(true)
  const [compactHeader, setCompactHeader] = useState(false)
  const [allCatsOpen, setAllCatsOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const allCatsRef = useRef<HTMLDivElement>(null)
  useOutsideClick(allCatsRef, useCallback(() => setAllCatsOpen(false), []))

  // search
  const [mode, setMode] = useState<SearchMode>(urlMode)
  const [query, setQuery] = useState(urlQ)
  useEffect(() => { setQuery(urlQ); setMode(urlMode) }, [urlQ, urlMode])

  // search results
  const [results, setResults] = useState<ResultsState>(EMPTY_RESULTS)
  const resultsReq = useRef(0)
  const [phIndex, setPhIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  // data
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [history, setHistory] = useState<Product[]>([])
  const [activeChip, setActiveChip] = useState<string | null>(null)

  // desktop sidebar
  const [hoverCat, setHoverCat] = useState<Category | null>(null)
  const catListRef = useRef<HTMLDivElement>(null)

  // carousel
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)

  // overlays
  const [rfqOpen, setRfqOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [showTop, setShowTop] = useState(false)

  // ---- effects ----
  useEffect(() => {
    setHistory(readHistory())
    try {
      if (sessionStorage.getItem('honic_deals_banner') === 'closed') setShowBanner(false)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setPhIndex(i => (i + 1) % PLACEHOLDERS.length), 3500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setSlide(s => (s + 1) % PROMO_SLIDES.length), 5500)
    return () => clearInterval(t)
  }, [paused])

  useEffect(() => {
    const onScroll = () => {
      setCompactHeader(window.scrollY > 300)
      setShowTop(window.scrollY > 900)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = drawerOpen || rfqOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen, rfqOpen])

  useEffect(() => {
    let cancelled = false
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => { if (!cancelled && Array.isArray(d?.categories)) setCategories(d.categories) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const loadProducts = useCallback(async (from: number) => {
    setLoadingProducts(true)
    try {
      const r = await fetch(`/api/search?sort=popular&limit=${PAGE_SIZE}&offset=${from}&china=exclude`)
      const d = await r.json()
      const list: Product[] = Array.isArray(d?.products) ? d.products : []
      setProducts(prev => (from === 0 ? list : [...prev, ...list.filter(p => !prev.some(x => x.id === p.id))]))
      setOffset(typeof d?.nextOffset === 'number' ? d.nextOffset : from + list.length)
      setHasMore(!!d?.hasMore)
    } catch {
      setHasMore(false)
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  useEffect(() => { if (!isResults && products.length === 0) loadProducts(0) }, [loadProducts, isResults, products.length])

  // ---- search results (typed or AI) ----
  const loadResults = useCallback(async (from: number) => {
    const id = ++resultsReq.current
    setResults(r => ({ ...(from === 0 ? EMPTY_RESULTS : r), loading: true, error: null }))
    try {
      let url: string
      if (urlMode === 'ai' && urlQ && !urlSeller) {
        url = `/api/search/ai?q=${encodeURIComponent(urlQ)}&limit=${PAGE_SIZE * 2}`
      } else {
        const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(from), sort: urlSort })
        if (urlQ) p.set('q', urlQ)
        if (urlCat) p.set('category', urlCat)
        if (urlMin) p.set('minPrice', urlMin)
        if (urlMax) p.set('maxPrice', urlMax)
        if (urlStock) p.set('inStock', '1')
        if (urlSeller) p.set('seller', urlSeller)
        url = `/api/search?${p}`
      }
      const res = await fetch(url)
      const d = await res.json().catch(() => null)
      if (id !== resultsReq.current) return
      if (!res.ok) throw new Error(d?.error || 'Search failed. Please try again.')
      const list: Product[] = Array.isArray(d?.products) ? d.products : []
      setResults(r => ({
        products: from === 0 ? list : [...r.products, ...list.filter(p => !r.products.some(x => x.id === p.id))],
        sellers: from === 0 ? (Array.isArray(d?.sellers) ? d.sellers : []) : r.sellers,
        seller: d?.seller || (from === 0 ? null : r.seller),
        total: Number(d?.total) || 0,
        hasMore: urlMode === 'ai' ? false : !!d?.hasMore,
        exact: d?.exact !== false,
        loading: false,
        error: null,
        interpretation: d?.interpretation || null,
        groups: Array.isArray(d?.groups) ? d.groups : [],
        relaxed: !!d?.relaxed,
      }))
    } catch (e) {
      if (id !== resultsReq.current) return
      setResults(r => ({ ...r, loading: false, error: e instanceof Error ? e.message : 'Search failed.' }))
    }
  }, [urlQ, urlMode, urlCat, urlSort, urlMin, urlMax, urlStock, urlSeller])

  useEffect(() => {
    if (isResults) { loadResults(0); window.scrollTo({ top: 0 }) }
  }, [isResults, loadResults])

  /** Update one or more URL params (filters); empty value removes it. */
  const setParams = useCallback((next: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k) }
    p.delete('returnTo')
    router.push(`/products${p.toString() ? `?${p}` : ''}`, { scroll: false })
  }, [router, sp])

  // ---- derived ----
  const mainCats = useMemo(() => categories.filter(c => c.is_main || !c.parent_id), [categories])
  const subsOf = useCallback((c: Category) => categories.filter(s => s.parent_id === c.id), [categories])

  // "Continue exploring": categories from recently viewed items, else the biggest categories
  const explore = useMemo(() => {
    const want = history.length ? 2 : 3 // three cards when "Recently viewed" is hidden
    const names = Array.from(new Set(history.map(h => h.category).filter(Boolean))) as string[]
    const picks = names.slice(0, want).map(name => ({
      label: name,
      product: products.find(p => p.category === name && !history.some(h => h.id === p.id)) || history.find(h => h.category === name),
    }))
    const fill = [...mainCats].sort((a, b) => (b.product_count || 0) - (a.product_count || 0))
    let i = 0
    while (picks.length < want && i < fill.length) {
      const c = fill[i++]
      const product = products.find(p => p.category === c.name)
      if (product && !picks.some(p => p.label === c.name)) picks.push({ label: c.name, product })
    }
    // still short (most departments are empty for now): fill with different popular products
    const used = new Set(picks.map(p => p.product?.id))
    for (const p of products) {
      if (picks.length >= want) break
      if (!used.has(p.id) && p.category && !picks.some(x => x.label === p.category)) { picks.push({ label: p.category, product: p }); used.add(p.id) }
    }
    return picks
  }, [history, products, mainCats])

  // China items: a random few among the regular ones (2-3 in every 10), not all of them in a block
  const [chinaPool, setChinaPool] = useState<Product[]>([])
  const [mixSeed] = useState(() => Math.floor(Math.random() * 1_000_000)) // a new layout each visit
  useEffect(() => {
    let off = false
    fetch('/api/search?china=only&limit=60')
      .then(r => r.json())
      .then(d => { if (!off && Array.isArray(d?.products)) setChinaPool(shuffle(d.products as Product[])) })
      .catch(() => {})
    return () => { off = true }
  }, [])
  const shownProducts = useMemo(() => {
    const base = activeChip ? products.filter(p => p.category === activeChip) : products
    const pool = activeChip ? chinaPool.filter(p => p.category === activeChip) : chinaPool
    return mixIn(base, pool, mixSeed)
  }, [products, chinaPool, activeChip, mixSeed])

  // ---- actions ----
  const runSearch = (q?: string) => {
    const term = (q ?? query).trim() || PLACEHOLDERS[phIndex]
    const params = new URLSearchParams({ search: term })
    if (mode === 'ai') params.set('mode', 'ai')
    else if (urlCat) params.set(sp.get('subCategory') ? 'subCategory' : 'mainCategory', urlCat)
    router.push(`/products?${params.toString()}`)
  }

  /** "Upload a list": a photo goes to Honic Lens; a .txt/.csv searches its first item */
  const onSearchFile = async (file: File) => {
    setFileError(null)
    if (file.type.startsWith('image/')) { openLens(file); return }
    if (file.size > 1024 * 1024) { setFileError('That file is too big. Use a short .txt or .csv list.'); return }
    try {
      const text = await file.text()
      const first = text.split(/\r?\n/).map(l => l.split(',')[0].trim()).find(Boolean)
      if (first) { setQuery(first.slice(0, 100)); runSearch(first.slice(0, 100)) }
      else setFileError('That file looks empty.')
    } catch {
      setFileError('Could not read that file. Use .txt, .csv or a photo.')
    }
  }

  const openProduct = (p: Product) => {
    pushHistory(p)
    setHistory(readHistory())
  }

  // Stock check, first variant auto-selected; China imports open the product page (shipping notice)
  const addToCart: AddToCart = async (p) => {
    const stock = checkProductStock(p)
    if (!stock.isAvailable) {
      toast({ title: 'Out of stock', description: stock.message || 'This product is currently unavailable.', variant: 'destructive' })
      return false
    }
    if ((p.variants?.length ?? 0) > 1 || p.importChina || p.import_china) {
      // several options: the shopper picks one on the product page; China imports need its shipping notice
      openProduct(p)
      router.push(productHref(p))
      return false
    }
    const variant = p.variants?.[0]
    if (variant && (variant.stock_quantity ?? variant.stockQuantity ?? 0) <= 0) {
      toast({ title: 'Out of stock', description: 'This option is currently unavailable.', variant: 'destructive' })
      return false
    }
    const price = variant ? Number(variant.price) || p.price : p.price
    const qty = 1
    try {
      await addItem(p.id, qty, variant?.id != null ? String(variant.id) : undefined, {}, price, undefined, undefined, p)
      toast({ title: 'Added to cart', description: p.name })
      return true
    } catch {
      toast({ title: 'Could not add to cart', description: 'Please try again.', variant: 'destructive' })
      return false
    }
  }

  // Lets cards show a − qty + stepper once the product is in the cart
  const cartQty: CartQty = {
    of: (p) => getItemQuantity(p.id, firstVariantId(p)),
    set: (p, qty) => {
      const vid = firstVariantId(p)
      const stock = stockOf(p)
      if (qty < MIN_QTY) { removeItem(p.id, vid); return }
      if (stock > 0 && qty > stock) {
        toast({ title: `Only ${stock} available`, description: p.name })
        qty = stock
      }
      updateItemQuantity(p.id, qty, vid)
    },
  }

  const scrollCats = (dir: 1 | -1) => catListRef.current?.scrollBy({ top: dir * 120, behavior: 'smooth' })

  const logo = <BrandLogo size="md" textClassName="hidden min-[380px]:flex" />

  const searchForm = (compact: boolean) => (
    <form
      role="search"
      data-lens
      onSubmit={e => { e.preventDefault(); runSearch() }}
      className={compact
        ? 'flex min-w-0 flex-1 items-center rounded-full border-2 border-orange-500 bg-white pl-3 sm:pl-4'
        : 'mx-auto mt-5 max-w-3xl rounded-2xl border-2 border-orange-500 bg-white p-2.5 shadow-[6px_6px_0_0_#fdba74] transition-shadow focus-within:shadow-[8px_8px_0_0_#fdba74] sm:p-3'}
    >
      {compact ? (
        <>
          <Search className="h-4 w-4 shrink-0 text-neutral-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={PLACEHOLDERS[phIndex]}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
            aria-label="Search products"
          />
          <button type="button" onClick={() => openLens()} className="p-2 text-neutral-600 hover:text-orange-600" aria-label="Search by photo">
            <Camera className="h-5 w-5" />
          </button>
          <button className="m-0.5 hidden items-center gap-1 rounded-full bg-orange-500 px-4 py-1.5 text-sm font-bold text-white hover:bg-orange-600 sm:flex">
            Find it
          </button>
        </>
      ) : (
        <>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={mode === 'ai' ? 'Describe what you need, e.g. "a sensor to weigh a baby for my project" — any language' : `Try "${PLACEHOLDERS[phIndex]}"`}
            className="w-full bg-transparent px-1 py-1 text-[15px] outline-none placeholder:text-neutral-400"
            aria-label="Search products"
          />
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center text-[13px] text-neutral-700">
              <button type="button" onClick={() => openLens()} aria-label="Photo search" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-orange-50">
                <Camera className="h-4 w-4" /> <span className="hidden min-[420px]:inline">Photo search</span>
              </button>
              <span className="mx-1 h-4 w-px bg-neutral-300" />
              <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Upload a shopping list" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-orange-50">
                <FileText className="h-4 w-4" /> <span className="hidden min-[420px]:inline">Upload a list</span>
              </button>
            </div>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 sm:px-6"
            >
              <Search className="h-4 w-4" /> Find it
            </button>
          </div>
          {fileError && <p className="mt-2 text-xs text-red-600" role="alert">{fileError}</p>}
        </>
      )}
    </form>
  )

  // ---------- render ----------
  return (
    <div className="min-h-screen bg-white pb-20 text-neutral-900 lg:pb-0">
      {/* Announcement bar */}
      {showBanner && (
        <div className="relative flex min-h-9 items-center justify-center bg-gradient-to-r from-rose-800 via-rose-700 to-rose-600 px-10 py-2 text-center text-xs font-medium text-white sm:text-sm">
          <Zap className="mr-1.5 hidden h-4 w-4 shrink-0 fill-amber-300 text-amber-300 sm:block" />
          <span>
            Deals are live on <span className="font-bold text-amber-300">selected items</span> from Honic and trusted sellers
          </span>
          <Link href="/#deals" className="ml-3 hidden items-center gap-1 font-semibold text-amber-300 hover:underline md:inline-flex">
            Shop deals <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            aria-label="Close announcement"
            onClick={() => { setShowBanner(false); try { sessionStorage.setItem('honic_deals_banner', 'closed') } catch {} }}
            className="absolute right-1 rounded p-2.5 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sticky compact header — appears on scroll (all sizes) */}
      <div className={`fixed inset-x-0 top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur transition-transform duration-300 ${compactHeader ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-3 py-2 sm:gap-4 sm:px-4">
          {logo}
          {searchForm(true)}
          <div className="hidden lg:block"><HeaderIcons cartCount={cartTotalItems} /></div>
          <Link href="/cart" className="-m-2 p-2 lg:hidden" aria-label="Cart">
            <span className="relative block"><ShoppingCart className="h-6 w-6" /><CartBadge count={cartTotalItems} /></span>
          </Link>
        </div>
      </div>

      {/* Hero */}
      <header className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,#ffedd5_0%,#ffffff_55%)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(#d4d4d4_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto max-w-[1400px] px-3 sm:px-4">
          {/* top row */}
          <div className="flex items-center justify-between gap-3 pt-3 sm:pt-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setDrawerOpen(true)} className="rounded-lg p-1.5 hover:bg-neutral-100 lg:hidden" aria-label="Open categories">
                <Menu className="h-5 w-5" />
              </button>
              {logo}
            </div>
            <div className="flex items-center gap-3 text-sm sm:gap-5">
              <span className="hidden items-center gap-1.5 text-[13px] text-neutral-600 md:flex"><Truck className="h-4 w-4 text-orange-600" /> Delivery across Tanzania</span>
              <div className="hidden lg:block"><HeaderIcons cartCount={cartTotalItems} /></div>
              <div className="flex items-center gap-3 lg:hidden">
                <Link href="/account" className="-m-2 p-2.5" aria-label="Account"><User className="h-5 w-5" /></Link>
                <Link href="/cart" className="-m-2 p-2.5" aria-label="Cart">
                  <span className="relative block"><ShoppingCart className="h-5 w-5" /><CartBadge count={cartTotalItems} /></span>
                </Link>
              </div>
            </div>
          </div>

          {/* nav row (desktop) */}
          <nav className="mt-3 hidden items-center justify-between text-[13px] text-neutral-700 lg:flex">
            <div className="flex items-center gap-5">
              <div ref={allCatsRef} className="relative">
                <button onClick={() => setAllCatsOpen(o => !o)} className="flex items-center gap-1.5 font-semibold text-neutral-950 hover:text-orange-600">
                  <LayoutGrid className="h-4 w-4" /> Shop by category <ChevronDown className="h-3 w-3" />
                </button>
                {allCatsOpen && (
                  <div className="absolute left-0 top-full z-30 mt-2 grid max-h-[70vh] w-[720px] grid-cols-3 gap-x-6 gap-y-1 overflow-y-auto rounded-2xl border bg-white p-4 shadow-xl">
                    {mainCats.length === 0 && <span className="text-neutral-500">Loading…</span>}
                    {mainCats.map(c => (
                      <Link key={c.id} href={categoryHref(c)} className="truncate rounded-lg px-2 py-1.5 hover:bg-orange-50">{c.name}</Link>
                    ))}
                  </div>
                )}
              </div>
              <Link href="/products?sort=popular" className={`hover:text-orange-600 ${urlSort === 'popular' && !urlQ && !urlCat ? 'font-semibold text-orange-600' : ''}`}>Best sellers</Link>
              <Link href="/#deals" className="hover:text-orange-600">Today&apos;s deals</Link>
              <Link href="/products?sort=newest" className={`hover:text-orange-600 ${urlSort === 'newest' && !urlQ && !urlCat ? 'font-semibold text-orange-600' : ''}`}>New arrivals</Link>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/help" className="hover:text-orange-600">Help</Link>
              <Link href="/support/order-tracking" className="hover:text-orange-600">Track order</Link>
              <Link href="/become-supplier" className="rounded-full bg-orange-500 px-3 py-1 font-semibold text-white hover:bg-orange-600">Sell on {brand}</Link>
            </div>
          </nav>

          {/* headline + mode switch */}
          <div className={`text-center ${isResults ? 'mt-4 sm:mt-5' : 'mt-6 sm:mt-10'}`}>
            {!isResults && (<>
              <h1 className="text-[26px] font-black leading-tight tracking-tight text-neutral-950 sm:text-4xl lg:text-5xl">
                Find it. <span className="relative whitespace-nowrap"><span className="relative z-10">Order it.</span><span aria-hidden className="absolute inset-x-0 bottom-1 z-0 h-3 bg-orange-200 sm:h-4" /></span> Get it.
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600 sm:text-base">
                Shop the official Honic store and trusted sellers, delivered across Tanzania.
              </p>
            </>)}
            <div className={`${isResults ? '' : 'mt-5 '}inline-flex rounded-full border border-neutral-200 bg-white p-1 text-sm font-semibold shadow-sm`}>
              <ModeButton active={mode === 'products'} onClick={() => setMode('products')}>
                <Search className="h-4 w-4" /> Products
              </ModeButton>
              <ModeButton active={mode === 'ai'} onClick={() => setMode('ai')}>
                <Sparkles className="h-4 w-4" /> AI Mode
              </ModeButton>
            </div>
          </div>

          {searchForm(false)}

          {/* popular searches (landing view only) */}
          {!isResults && <div className="mx-auto mt-4 flex max-w-3xl gap-2 overflow-x-auto pb-1 text-xs [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible">
            <span className="shrink-0 py-1 text-neutral-500">Popular:</span>
            {PLACEHOLDERS.slice(0, 4).map(t => (
              <button key={t} onClick={() => { setQuery(t); runSearch(t) }} className="shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-2 hover:border-orange-500">
                {t}
              </button>
            ))}
          </div>}

          <input ref={fileInputRef} type="file" accept="image/*,.txt,.csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onSearchFile(f); e.target.value = '' }} />
          <div className={isResults ? 'h-2 sm:h-3' : 'h-8 sm:h-12'} />
        </div>
      </header>

      {isResults && (
        <SearchResults
          q={urlQ}
          sortTitle={!urlQ && !urlCat ? SORT_TITLES[urlSort] || null : null}
          mode={urlMode}
          category={categories.find(c => c.slug === urlCat) || null}
          mainCats={mainCats}
          sort={urlSort}
          minPrice={urlMin}
          maxPrice={urlMax}
          inStock={urlStock}
          state={results}
          onParams={setParams}
          onLoadMore={() => loadResults(results.products.length)}
          onTryAi={() => router.push(`/products?search=${encodeURIComponent(urlQ)}&mode=ai`)}
          formatPrice={formatPrice}
          onOpen={openProduct}
          onAdd={addToCart}
          cart={cartQty}
        />
      )}

      {!isResults && (<>
      {/* Trust strip — horizontal scroll on phone, 3 columns from md */}
      <section className="border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto flex max-w-[1200px] snap-x gap-3 overflow-x-auto px-3 py-4 [scrollbar-width:none] sm:px-4 md:grid md:grid-cols-3 md:gap-0 md:divide-x md:overflow-visible md:py-5">
          <TrustItem icon={<BadgeCheck className="h-6 w-6" />} title="Official store + trusted sellers" text="Buy from the official Honic store and verified sellers." />
          <TrustItem icon={<ShieldCheck className="h-6 w-6" />} title="Pay with confidence" text="Your order is protected from checkout to delivery." />
          <TrustItem icon={<Truck className="h-6 w-6" />} title="Delivery across Tanzania" text="Track every order from checkout to your door." />
        </div>
      </section>

      {/* Category chips — phone & tablet */}
      <section className="lg:hidden">
        <div className="flex gap-3 overflow-x-auto px-3 py-4 [scrollbar-width:none] sm:px-4">
          {mainCats.length === 0 && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex shrink-0 flex-col items-center gap-1.5"><div className="h-14 w-14 animate-pulse rounded-2xl bg-neutral-100" /><div className="h-2 w-12 animate-pulse rounded bg-neutral-100" /></div>
          ))}
          {mainCats.map(c => (
            <Link key={c.id} href={categoryHref(c)} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 text-center sm:w-20">
              <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-orange-50 ring-1 ring-orange-200 sm:h-16 sm:w-16">
                {isImageUrl(c.image_url)
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={optimizedImg(c.image_url, 64)} alt="" className="h-full w-full object-cover" />
                  : <span className="text-lg font-black text-orange-600">{c.name[0]}</span>}
              </span>
              <span className="line-clamp-2 text-[11px] leading-tight text-neutral-700 sm:text-xs">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Main module row */}
      <section className="mx-auto max-w-[1200px] px-3 sm:px-4 lg:py-6">
        <div className="grid gap-3 lg:grid-cols-[230px_1fr] lg:gap-4">
          {/* Desktop category sidebar */}
          <div className="relative hidden lg:block" onMouseLeave={() => setHoverCat(null)}>
            <div className="flex h-[272px] rounded-2xl border border-neutral-200 bg-white">
              <div ref={catListRef} className="flex-1 overflow-y-auto py-2 [scrollbar-width:thin]">
                <p className="px-4 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Categories</p>
                {mainCats.map(c => (
                  <SidebarRow key={c.id} cat={c} active={hoverCat?.id === c.id} onEnter={() => setHoverCat(c)} />
                ))}
                {mainCats.length === 0 && Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="mx-4 my-3 h-4 animate-pulse rounded bg-neutral-100" />
                ))}
              </div>
              <div className="flex flex-col justify-between py-2 pr-1">
                <button onClick={() => scrollCats(-1)} className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900" aria-label="Scroll up"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => scrollCats(1)} className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900" aria-label="Scroll down"><ChevronDown className="h-4 w-4" /></button>
              </div>
            </div>
            {hoverCat && (
              <div className="absolute left-full top-0 z-20 ml-2 h-[272px] w-[min(560px,calc(100vw-300px))] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold">{hoverCat.name}</h3>
                  <Link href={categoryHref(hoverCat)} className="text-xs font-semibold text-orange-600 hover:underline">See everything</Link>
                </div>
                {subsOf(hoverCat).length ? (
                  <div className="grid grid-cols-4 gap-3">
                    {subsOf(hoverCat).map(s => (
                      <Link key={s.id} href={categoryHref(s)} className="group flex flex-col items-center gap-1.5 text-center text-xs">
                        <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-orange-50 group-hover:ring-2 group-hover:ring-orange-400">
                          {isImageUrl(s.image_url)
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={optimizedImg(s.image_url, 64)} alt="" className="h-full w-full object-cover" />
                            : <span className="text-lg font-black text-orange-600">{s.name[0]}</span>}
                        </span>
                        <span className="line-clamp-2">{s.name}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Browse everything in {hoverCat.name}.</p>
                )}
              </div>
            )}
          </div>

          {/*
            Cards + promo
            phone:   promo on top, then a swipeable row of cards
            tablet:  promo full width, then 3 cards in a row
            desktop: 3 cards + promo in one row
          */}
          <div className="flex min-w-0 flex-col gap-3 lg:grid lg:grid-cols-[1fr_1fr_1fr_1.5fr] lg:gap-4">
            <div className="order-1 lg:order-2 lg:col-span-1">
              <PromoCarousel slide={slide} setSlide={setSlide} setPaused={setPaused} products={products} />
            </div>

            <div className="order-2 -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:order-1 lg:col-span-3 lg:gap-4">
              {history.length > 0 && (
                <MiniCard title="Recently viewed" subtitle={`${history.length} item${history.length > 1 ? 's' : ''}`}>
                  <HistoryStrip items={history} formatPrice={formatPrice} onOpen={openProduct} />
                </MiniCard>
              )}

              {explore.map((k, i) => (
                <MiniCard key={i} title="Continue exploring" subtitle={k.label}>
                  {k.product ? (
                    <Link href={productHref(k.product)} onClick={() => openProduct(k.product!)} className="flex flex-1 flex-col items-center justify-between rounded-xl bg-white p-3">
                      <ProductImg src={k.product.image} alt={k.product.name} className="h-28 w-full object-contain lg:h-32" />
                      <span className="text-sm font-bold">{formatPrice(k.product.price)}</span>
                    </Link>
                  ) : (
                    <div className="flex-1 animate-pulse rounded-xl bg-white" />
                  )}
                </MiniCard>
              ))}
              {/* placeholders while products load */}
              {explore.length === 0 && Array.from({ length: history.length ? 2 : 3 }).map((_, i) => (
                <MiniCard key={`sk-${i}`} title="Continue exploring" subtitle="Loading…">
                  <div className="flex-1 animate-pulse rounded-xl bg-white" />
                </MiniCard>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Handpicked */}
      <section className="mt-4 bg-stone-50 py-6 sm:py-8">
        <div className="mx-auto max-w-[1200px] px-3 sm:px-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-black tracking-tight sm:text-2xl">Handpicked for you</h2>
              <p className="text-sm text-neutral-500">Fresh finds from across the {brand} catalog</p>
            </div>
            <Link href="/products?sort=popular" className="-my-2 flex items-center gap-1 py-2 text-sm font-semibold hover:underline">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* quick filter by category present in the loaded products */}
          <CategoryFilter products={products} active={activeChip} onChange={setActiveChip} />

          <ProductGrid products={shownProducts} formatPrice={formatPrice} onOpen={openProduct} onAdd={addToCart} cart={cartQty} />

          {loadingProducts && (
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-white" />)}
            </div>
          )}
          {!loadingProducts && hasMore && products.length > 0 && (
            <div className="mt-8 text-center">
              <button onClick={() => loadProducts(offset)} className="w-full rounded-xl border-2 border-orange-500 bg-white px-8 py-3 text-sm font-bold hover:bg-orange-500 hover:text-white sm:w-auto">
                Show more products
              </button>
            </div>
          )}
          {!loadingProducts && shownProducts.length === 0 && (
            <p className="py-10 text-center text-sm text-neutral-500">No products to show right now.</p>
          )}
        </div>
      </section>

      </>)}

      {/* Desktop floating help rail */}
      <aside className="fixed bottom-24 right-4 z-30 hidden w-[76px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-center text-[11px] shadow-lg lg:flex">
        <RailButton icon={<MessageCircle className="h-5 w-5" />} label="Chat" onClick={() => setHelpOpen(o => !o)} />
        <RailButton icon={<FileText className="h-5 w-5" />} label="Get a quote" onClick={() => setRfqOpen(true)} />
        <RailButton icon={<ScanSearch className="h-5 w-5" />} label={`${brand} Lens`} onClick={() => openLens()} />
        {showTop && <RailButton icon={<ChevronUp className="h-5 w-5" />} label="Top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />}
      </aside>

      {/* Phone/tablet bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 text-[11px] font-medium text-neutral-600 sm:text-xs">
          <Link href="/" className="flex flex-col items-center justify-center gap-0.5 py-2">
            <Home className="h-5 w-5" />
            Home
          </Link>
          <TabButton icon={<LayoutGrid className="h-5 w-5" />} label="Categories" onClick={() => setDrawerOpen(true)} />
          <button onClick={() => openLens()} className="flex flex-col items-center justify-center" aria-label="Search by photo">
            <span className="-mt-5 grid h-12 w-12 place-items-center rounded-full bg-orange-500 text-white shadow-lg ring-4 ring-white">
              <ScanSearch className="h-5 w-5" />
            </span>
            <span className="mt-0.5">Lens</span>
          </button>
          <TabButton icon={<FileText className="h-5 w-5" />} label="Quote" onClick={() => setRfqOpen(true)} />
          <Link href="/cart" className="relative flex flex-col items-center justify-center gap-0.5 py-2">
            <span className="relative"><ShoppingBag className="h-5 w-5" /><CartBadge count={cartTotalItems} /></span>
            Cart
          </Link>
        </div>
      </nav>

      {drawerOpen && <CategoryDrawer brand={brand} mainCats={mainCats} subsOf={subsOf} onClose={() => setDrawerOpen(false)} />}
      {rfqOpen && <RfqModal onClose={() => setRfqOpen(false)} defaultProduct={query} />}
      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
    </div>
  )
}

// ---------- small components ----------
function CartBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function HeaderIcons({ cartCount }: { cartCount: number }) {
  return (
    <div className="flex items-center gap-4 text-neutral-800">
      <Link href="/support" className="hover:text-orange-600" aria-label="Messages"><MessageCircle className="h-5 w-5" /></Link>
      <Link href="/orders" className="hover:text-orange-600" aria-label="Orders"><ClipboardList className="h-5 w-5" /></Link>
      <Link href="/account" className="hover:text-orange-600" aria-label="Account"><User className="h-5 w-5" /></Link>
      <Link href="/cart" className="relative hover:text-orange-600" aria-label="Cart">
        <ShoppingCart className="h-5 w-5" />
        <CartBadge count={cartCount} />
      </Link>
    </div>
  )
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors sm:px-5 ${active ? 'bg-orange-500 text-white' : 'text-neutral-600 hover:text-orange-600'}`}
    >
      {children}
    </button>
  )
}

function TrustItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex min-w-[240px] snap-start items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-neutral-200 md:min-w-0 md:rounded-none md:bg-transparent md:px-6 md:py-0 md:ring-0">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500 text-white">{icon}</div>
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="text-xs text-neutral-600">{text}</p>
      </div>
    </div>
  )
}

function SidebarRow({ cat, active, onEnter }: { cat: Category; active: boolean; onEnter: () => void }) {
  return (
    <Link
      href={categoryHref(cat)}
      onMouseEnter={onEnter}
      className={`mx-1.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] ${active ? 'bg-orange-500 font-semibold text-white' : 'hover:bg-neutral-100'}`}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-md bg-neutral-100 text-[11px] font-bold text-neutral-500">
        {isImageUrl(cat.image_url)
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={optimizedImg(cat.image_url, 32)} alt="" className="h-full w-full object-cover" />
          : cat.name[0]}
      </span>
      <span className="line-clamp-1 flex-1">{cat.name}</span>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
    </Link>
  )
}

function MiniCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex h-[236px] w-[46vw] min-w-[160px] max-w-[220px] shrink-0 snap-start flex-col rounded-2xl bg-stone-100 p-3 sm:w-auto sm:max-w-none lg:h-[272px]">
      <h3 className="text-sm font-bold sm:text-base">{title}</h3>
      <p className="mb-2 truncate text-xs text-neutral-500">{subtitle}</p>
      {children}
    </div>
  )
}

function PromoCarousel({ slide, setSlide, setPaused, products }: {
  slide: number; setSlide: React.Dispatch<React.SetStateAction<number>>; setPaused: (b: boolean) => void; products: Product[]
}) {
  const touchX = useRef<number | null>(null)
  const go = (d: number) => setSlide(s => (s + d + PROMO_SLIDES.length) % PROMO_SLIDES.length)
  return (
    <div
      className="relative h-[180px] overflow-hidden rounded-2xl sm:h-[220px] lg:h-[272px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; setPaused(true) }}
      onTouchEnd={e => {
        if (touchX.current != null) {
          const dx = e.changedTouches[0].clientX - touchX.current
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        }
        touchX.current = null
        setPaused(false)
      }}
    >
      {PROMO_SLIDES.map((s, i) => {
        const st = SLIDE_STYLES[s.theme]
        const img = products.filter(p => isImageUrl(p.image))[i]
        return (
          <Link
            key={s.title}
            href={s.href}
            aria-hidden={i !== slide}
            tabIndex={i === slide ? 0 : -1}
            className={`absolute inset-0 flex flex-col justify-between p-4 transition-all duration-700 sm:p-5 ${st.wrap} ${i === slide ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-6 opacity-0'}`}
          >
            <div className="relative z-10 max-w-[60%] lg:max-w-[70%]">
              <span className={`text-[11px] font-bold uppercase tracking-widest ${st.kicker}`}>{s.kicker}</span>
              <h3 className="mt-1 text-xl font-black leading-tight sm:text-2xl">{s.title}</h3>
              <p className={`mt-1 text-xs sm:text-sm ${st.sub}`}>{s.subtitle}</p>
            </div>
            <span className={`relative z-10 inline-flex w-fit items-center gap-1 rounded-full px-4 py-2 text-xs font-bold sm:text-sm ${st.cta}`}>
              {s.cta} <ArrowRight className="h-4 w-4" />
            </span>
            {img && (
              <span className="absolute -right-4 bottom-0 top-0 flex w-[45%] items-center justify-center">
                <span className="grid aspect-square w-[85%] max-w-[170px] place-items-center rounded-full bg-white/90 p-4 shadow-xl">
                  <ProductImg src={img.image} alt="" className="h-full w-full object-contain" />
                </span>
              </span>
            )}
          </Link>
        )
      })}
      <button onClick={() => go(-1)} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1 text-neutral-950 shadow hover:bg-white sm:block" aria-label="Previous slide">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button onClick={() => go(1)} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1 text-neutral-950 shadow hover:bg-white sm:block" aria-label="Next slide">
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="absolute bottom-3 right-4 flex gap-1.5">
        {PROMO_SLIDES.map((_, i) => (
          <button key={i} onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`} className={`-m-2 flex h-8 items-center px-2 ${SLIDE_STYLES[PROMO_SLIDES[slide].theme].wrap.includes('text-white') ? 'text-white' : 'text-neutral-950'}`}><span className={`block h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-current' : 'w-1.5 bg-current opacity-40'}`} /></button>
        ))}
      </div>
    </div>
  )
}

function ProductImg({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [err, setErr] = useState(false)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={!isImageUrl(src) || err ? '/placeholder.svg' : optimizedImg(src, 192)}
      alt={alt}
      loading="lazy"
      onError={() => setErr(true)}
      className={className}
    />
  )
}

/**
 * Card image for a fixed square box. Square-ish product shots are shown whole
 * (contain + padding); clearly portrait/landscape photos — e.g. a printer shot in
 * a room — fill the square (cover) instead of shrinking to a thin strip.
 */
function CardImg({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  const [err, setErr] = useState(false)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={!isImageUrl(src) || err ? '/placeholder.svg' : optimizedImg(src, 240)}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setErr(true)}
      // every photo fills the square card (tall or wide photos are trimmed at the edges, never shrunk)
      className={`absolute inset-0 h-full w-full ${!isImageUrl(src) || err ? 'object-contain p-6' : 'object-cover'} ${className}`}
    />
  )
}

function HistoryStrip({ items, formatPrice, onOpen }: { items: Product[]; formatPrice: FormatPrice; onOpen: (p: Product) => void }) {
  const [i, setI] = useState(0)
  const p = items[i % items.length]
  return (
    <div className="relative flex flex-1 flex-col">
      <Link href={productHref(p)} onClick={() => onOpen(p)} className="flex flex-1 flex-col items-center justify-between rounded-xl bg-white p-3">
        <ProductImg src={p.image} alt={p.name} className="h-28 w-full object-contain lg:h-32" />
        <span className="text-sm font-bold">{formatPrice(p.price)}</span>
      </Link>
      {items.length > 1 && (
        <div className="pointer-events-none absolute inset-x-1 top-1/2 flex -translate-y-1/2 justify-between">
          <button onClick={() => setI(v => (v - 1 + items.length) % items.length)} className="pointer-events-auto rounded-full bg-white p-0.5 shadow" aria-label="Previous item"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setI(v => (v + 1) % items.length)} className="pointer-events-auto rounded-full bg-white p-0.5 shadow" aria-label="Next item"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  )
}

function CategoryFilter({ products, active, onChange }: { products: Product[]; active: string | null; onChange: (c: string | null) => void }) {
  const cats = useMemo(() => {
    const counts = new Map<string, number>()
    products.forEach(p => { if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1) })
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c]) => c)
  }, [products])
  if (cats.length < 2) return null
  const chip = (label: string, value: string | null) => (
    <button
      key={label}
      onClick={() => onChange(value)}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${active === value ? 'bg-orange-500 text-white' : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:ring-orange-400'}`}
    >
      {label}
    </button>
  )
  return (
    <div className="-mx-3 mb-4 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      {chip('All', null)}
      {cats.map(c => chip(c, c))}
    </div>
  )
}

function ProductGrid({ products, formatPrice, onOpen, onAdd, cart }: { products: Product[]; formatPrice: FormatPrice; onOpen: (p: Product) => void; onAdd: AddToCart; cart: CartQty }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {products.map(p => <ProductCard key={p.id} p={p} formatPrice={formatPrice} onOpen={onOpen} onAdd={onAdd} qty={cart.of(p)} onQty={cart.set} />)}
    </div>
  )
}

function ProductCard({ p, formatPrice, onOpen, onAdd, qty, onQty }: {
  p: Product
  formatPrice: FormatPrice
  onOpen: (p: Product) => void
  onAdd: AddToCart
  qty: number
  onQty: (p: Product, qty: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [hovered, setHovered] = useState(false)
  const orig = Number(p.original_price ?? p.originalPrice ?? 0)
  const off = !(p.variants && p.variants.length > 1) && orig > p.price ? Math.round((1 - p.price / orig) * 100) : 0
  const china = !!(p.importChina || p.import_china)
  const optionCount = p.variants?.length ?? 0
  const multi = optionCount > 1
  const optionPrices = (p.variants || []).map((v) => Number(v.price)).filter((n) => n > 0)
  const fromPrice = multi && optionPrices.length ? Math.min(...optionPrices) : p.price
  const sameDay = !!(p.sameDayDelivery || p.same_day_delivery)
  const freeDelivery = !!(p.free_delivery || p.freeDelivery)
  const stock = stockOf(p)
  const lowStock = stock > 0 && stock <= 5
  const hoverImg = hoverImageOf(p)
  const min = MIN_QTY

  // At most two corner badges, in a fixed order, so cards stay clean (From China always shows)
  const badges = [
    china && <span key="imp" className="rotate-[-4deg] rounded-md border-2 border-[#c8102e] bg-white/90 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#c8102e]">{typeof p.importDays === 'string' ? `Import · ${p.importDays}` : 'Import'}</span>,
    off > 0 && <span key="off" className="rounded-md bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white">-{off}%</span>,
    p.is_new && <span key="new" className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[11px] font-bold text-white">NEW</span>,
  ].filter(Boolean).slice(0, 2)

  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation() }

  const handleAdd = async (e: React.MouseEvent) => {
    stop(e)
    if (adding) return
    setAdding(true)
    await onAdd(p)
    setAdding(false)
  }

  const step = (e: React.MouseEvent, d: number) => {
    stop(e)
    onQty(p, d < 0 && qty <= min ? 0 : qty + d)
  }

  return (
    <Link
      href={productHref(p)}
      onClick={() => onOpen(p)}
      onMouseEnter={() => setHovered(true)}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200/70 hover:ring-orange-400"
    >
      {/* Fixed square: images are absolutely positioned so a tall photo can never stretch the card */}
      <div className="relative aspect-square overflow-hidden bg-white">
        <CardImg src={p.image} alt={p.name} />
        {hoverImg && hovered && (
          <CardImg src={hoverImg} alt="" className="bg-white opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        )}
        {badges.length > 0 && <div className="absolute left-2 top-2 flex flex-col items-start gap-1">{badges}</div>}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
        {/* Always two lines tall, so prices line up across a row */}
        <h3 className="line-clamp-2 min-h-[2.25rem] text-[13px] leading-snug text-neutral-800">
          {p.supplier_verified && <BadgeCheck className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-sky-500" aria-label="Verified supplier" />}
          {p.name}
        </h3>
        <div className="mt-auto pt-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            {multi && <span className="text-[11px] text-neutral-500">From</span>}
            <span className="text-[15px] font-black sm:text-base">{formatPrice(fromPrice)}</span>
            {off > 0 && <span className="text-[11px] text-neutral-400 line-through">{formatPrice(orig)}</span>}
          </div>
          <div className="mt-1 flex min-h-[1rem] flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500">
            {(p.rating ?? 0) > 0 && (
              <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(p.rating).toFixed(1)}</span>
            )}
            {multi && <span className="font-medium text-neutral-700">{optionCount} options</span>}
            {lowStock && !multi
              ? <span className="font-semibold text-amber-600">Only {stock} left</span>
              : (p.sold_count ?? 0) > 0 && <span>{p.sold_count} sold</span>}
            {sameDay
              ? <span className="flex items-center gap-0.5 font-medium text-orange-600"><Zap className="h-3 w-3" />Same day</span>
              : freeDelivery && <span className="flex items-center gap-0.5 font-medium text-emerald-700"><Truck className="h-3 w-3" />Free delivery</span>}
          </div>
        </div>

        {qty > 0 && !china && !multi ? (
          // In cart: quantity stepper instead of the button
          <div onClick={stop} className="mt-2 flex min-h-9 items-center justify-between rounded-xl bg-orange-50 ring-1 ring-orange-200">
            <button onClick={(e) => step(e, -1)} className="grid h-9 w-9 place-items-center rounded-xl text-orange-700 hover:bg-orange-100" aria-label={qty <= min ? 'Remove from cart' : 'Decrease quantity'}>
              {qty <= min ? <X className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            </button>
            <span className="text-sm font-bold text-orange-700" aria-live="polite">{qty} in cart</span>
            <button onClick={(e) => step(e, 1)} disabled={stock > 0 && qty >= stock} className="grid h-9 w-9 place-items-center rounded-xl text-orange-700 hover:bg-orange-100 disabled:opacity-40" aria-label="Increase quantity">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleAdd}
            disabled={adding}
            className="mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-2 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-600 active:bg-orange-700 sm:text-[13px]"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : china || multi ? <ArrowRight className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {multi ? 'Choose option' : china ? 'View item' : 'Add to cart'}
          </button>
        )}
      </div>
    </Link>
  )
}

type SortBy = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating' | 'popular'
type AiInterpretation = {
  parts?: { term: string; why: string }[]
  keywords: string
  categorySlug: string | null
  categoryName: string | null
  minPrice: number | null
  maxPrice: number | null
  inStock: boolean
  sort: SortBy
  summary: string
}

const SORT_LABELS: Record<SortBy, string> = {
  relevance: 'Best match',
  popular: 'Most popular',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  newest: 'Newest',
  rating: 'Top rated',
}

function PriceFilter({ minPrice, maxPrice, onApply }: { minPrice: string; maxPrice: string; onApply: (min: string | null, max: string | null) => void }) {
  const [minDraft, setMinDraft] = useState(minPrice)
  const [maxDraft, setMaxDraft] = useState(maxPrice)
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onApply(minDraft.replace(/\D/g, '') || null, maxDraft.replace(/\D/g, '') || null) }}
      className="flex shrink-0 items-center gap-1 rounded-full bg-white py-1.5 pl-3 pr-1.5 text-xs ring-1 ring-neutral-200"
    >
      <span className="font-semibold text-neutral-500">Price</span>
      <input value={minDraft} onChange={(e) => setMinDraft(e.target.value)} inputMode="numeric" placeholder="Min" aria-label="Minimum price" className="-my-1.5 w-16 bg-transparent px-1 py-1.5 outline-none" />
      <span className="text-neutral-400">–</span>
      <input value={maxDraft} onChange={(e) => setMaxDraft(e.target.value)} inputMode="numeric" placeholder="Max" aria-label="Maximum price" className="-my-1.5 w-16 bg-transparent px-1 py-1.5 outline-none" />
      <button type="submit" className="rounded-full bg-neutral-900 px-3 py-2 font-semibold text-white">Go</button>
    </form>
  )
}

const SW_HINT = /\b(nataka|nitafute|nitafutie|natafuta|tafuta|nahitaji|kupima|kutengeneza|mradi|yangu|wangu|kwa|ya|wa|za|vya|cha|na|ni|bei|nafuu|mtoto|joto|uzito|kifaa|vifaa|kwenye)\b/gi

const AI_STEPS = {
  en: ['Reading your request', 'Working out the parts you need', 'Searching our catalog', 'Picking the best matches'],
  sw: ['Ninasoma ombi lako', 'Ninatambua vifaa unavyohitaji', 'Ninatafuta kwenye bidhaa zetu', 'Ninachagua bora zaidi'],
}

/** Shown while AI search runs (usually 2–7 s): request bubble, animated orb, timed steps, shimmering preview. */
function AiThinking({ q }: { q: string }) {
  const sw = (q.match(SW_HINT) || []).length >= 2
  const steps = sw ? AI_STEPS.sw : AI_STEPS.en
  const [step, setStep] = useState(0)

  useEffect(() => {
    // advance through the steps; the last one stays active until results arrive
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1500)
    return () => clearInterval(t)
  }, [steps.length])

  return (
    <div className="mb-6 overflow-hidden rounded-3xl bg-neutral-950 text-white shadow-xl" role="status" aria-live="polite">
      <div className="relative px-4 pb-5 pt-5 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 animate-pulse rounded-full bg-orange-500/25 blur-3xl" />

        {/* the shopper's request */}
        <div className="flex justify-end">
          <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-orange-500 px-4 py-2.5 text-sm font-medium shadow-lg shadow-orange-900/30">
            {q}
          </p>
        </div>

        {/* animated AI orb + status */}
        <div className="mt-5 flex items-center gap-4">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-orange-500/20 motion-reduce:animate-none" />
            <span className="absolute inset-2 animate-pulse rounded-full bg-orange-500/30" />
            <span className="relative grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-900/50">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </span>
            {/* orbiting spark */}
            <span className="absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.9)] [animation:ai-orbit_2.4s_linear_infinite] motion-reduce:hidden" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold" key={step} style={{ animation: 'ai-step-in .35s ease-out' }}>
              {steps[step]}
              <span className="ml-1 inline-flex gap-0.5 align-middle">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-orange-300" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-neutral-400">{sw ? 'AI inafanya kazi — sekunde chache tu' : 'AI is on it — just a few seconds'}</p>
          </div>
        </div>

        {/* steps checklist */}
        <ol className="mt-5 grid gap-2 sm:grid-cols-2">
          {steps.map((label, i) => {
            const done = i < step
            const active = i === step
            return (
              <li key={label} className={`flex items-center gap-2 text-[13px] transition-colors duration-300 ${done ? 'text-neutral-300' : active ? 'text-white' : 'text-neutral-600'}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full transition-all duration-300 ${done ? 'bg-emerald-500' : active ? 'bg-orange-500 ring-4 ring-orange-500/25' : 'bg-white/10'}`}>
                  {done ? <Check className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                </span>
                {label}
              </li>
            )
          })}
        </ol>
      </div>

      {/* shimmering preview of the answer */}
      <div className="grid gap-3 border-t border-white/10 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <span className="ai-shimmer h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <span className="ai-shimmer block h-3 w-1/3 rounded-full" />
                <span className="ai-shimmer block h-2.5 w-3/4 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden space-y-2.5 rounded-2xl bg-white/[0.04] p-4 lg:block">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="ai-shimmer h-10 w-10 rounded-xl" />
              <span className="ai-shimmer block h-2.5 flex-1 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * AI answer for project-style requests: assistant bubble + numbered parts timeline + "Suggested kit"
 * (best match per part, total price, one-tap "Add kit to cart").
 */
function AiPlan({ q, it, groups, products, relaxed, formatPrice, onAdd }: {
  q: string
  it: AiInterpretation
  groups: AiGroup[]
  products: Product[]
  relaxed: boolean
  formatPrice: FormatPrice
  onAdd: AddToCart
}) {
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const pick = (g: AiGroup) => products.find((p) => p.id === g.productIds[0]) || null
  const kit = groups.map((g) => ({ g, p: pick(g) })).filter((x): x is { g: AiGroup; p: Product } => !!x.p)
  const total = kit.reduce((sum, { p }) => sum + Number(p.price || 0), 0)
  const minPrice = (g: AiGroup) => {
    const prices = g.productIds.map((id) => products.find((p) => p.id === id)?.price).filter((n): n is number => typeof n === 'number')
    return prices.length ? Math.min(...prices) : null
  }

  const addKit = async () => {
    if (adding) return
    setAdding(true)
    let ok = 0
    for (const { p } of kit) if (await onAdd(p)) ok++
    setAdding(false)
    if (ok) { setAdded(true); setTimeout(() => setAdded(false), 2500) }
  }

  return (
    <div className="mb-6 overflow-hidden rounded-3xl bg-neutral-950 text-white shadow-xl">
      {/* assistant reply */}
      <div className="relative px-4 pb-4 pt-5 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange-500/25 blur-3xl" />
        <p className="truncate text-[11px] text-neutral-400">You asked: “{q}”</p>
        <div className="mt-2 flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-900/40">
            <Sparkles className="h-[18px] w-[18px]" />
          </span>
          <div className="rounded-2xl rounded-tl-sm bg-white/10 px-4 py-2.5 text-sm font-medium leading-relaxed backdrop-blur">
            {it.summary || 'Here is what you need.'}
            {relaxed && <span className="mt-1 block text-xs font-normal text-neutral-400">Some details were loosened to find matches.</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-0 border-t border-white/10 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* parts timeline */}
        <ol className="relative px-4 py-5 sm:px-6">
          {groups.map((g, i) => {
            const available = g.count > 0
            const from = minPrice(g)
            return (
              <li key={g.term} className="relative flex gap-3 pb-5 last:pb-0">
                {i < groups.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-gradient-to-b from-orange-500/70 to-white/10" />}
                <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ${available ? 'bg-orange-500 text-white ring-4 ring-orange-500/20' : 'bg-white/10 text-neutral-400'}`}>
                  {available ? i + 1 : '–'}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="font-bold capitalize">{g.term}</h3>
                    {available ? (
                      <a href={`#part-${i}`} className="text-xs font-semibold text-orange-300 hover:text-orange-200">See {g.count} {g.count === 1 ? 'option' : 'options'} ↓</a>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-neutral-300">Not in store yet</span>
                    )}
                  </div>
                  {g.why && <p className="mt-0.5 text-[13px] leading-snug text-neutral-400">{g.why}</p>}
                  {available && from != null && <p className="mt-1 text-xs text-neutral-300">from <span className="font-bold text-white">{formatPrice(from)}</span></p>}
                </div>
              </li>
            )
          })}
        </ol>

        {/* suggested kit */}
        {kit.length > 0 && (
          <aside className="border-t border-white/10 bg-white/[0.04] px-4 py-5 sm:px-6 lg:border-l lg:border-t-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-300">Suggested kit</p>
            <ul className="mt-3 space-y-2.5">
              {kit.map(({ g, p }) => (
                <li key={g.term} className="flex items-center gap-3">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white">
                    <ProductImg src={p.image} alt="" className="absolute inset-0 h-full w-full object-contain p-1" />
                  </span>
                  <Link href={productHref(p)} className="min-w-0 flex-1 text-[13px] leading-snug hover:text-orange-200">
                    <span className="line-clamp-2">{p.name}</span>
                  </Link>
                  <span className="shrink-0 text-sm font-bold">{formatPrice(p.price)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-3">
              <span className="text-sm text-neutral-300">Kit total</span>
              <span className="text-xl font-black">{formatPrice(total)}</span>
            </div>
            <button
              onClick={addKit}
              disabled={adding}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-colors ${added ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'} disabled:opacity-70`}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
              {added ? 'Kit added to cart' : `Add kit to cart (${kit.length} ${kit.length === 1 ? 'item' : 'items'})`}
            </button>
            <p className="mt-2 text-center text-[11px] text-neutral-500">You can swap any item from the options below.</p>
          </aside>
        )}
      </div>
    </div>
  )
}

function SearchResults({
  q, sortTitle, mode, category, mainCats, sort, minPrice, maxPrice, inStock, state,
  onParams, onLoadMore, onTryAi, formatPrice, onOpen, onAdd, cart,
}: {
  q: string
  sortTitle: string | null
  mode: SearchMode
  category: Category | null
  mainCats: Category[]
  sort: SortBy
  minPrice: string
  maxPrice: string
  inStock: boolean
  state: ResultsState
  onParams: (next: Record<string, string | null>) => void
  onLoadMore: () => void
  onTryAi: () => void
  formatPrice: FormatPrice
  onOpen: (p: Product) => void
  onAdd: AddToCart
  cart: CartQty
}) {
  const ai = mode === 'ai'
  const it = state.interpretation
  const seller = state.seller
  const title = seller ? (q ? `“${q}” from ${seller.name}` : seller.name) : q ? (ai ? 'AI search' : `Results for “${q}”`) : category?.name || sortTitle || 'All products'
  const hasFilters = !!(minPrice || maxPrice || inStock || (q && category) || sort !== 'relevance' || seller)

  return (
    <section className="mx-auto max-w-[1200px] px-3 py-5 sm:px-4 sm:py-8" aria-live="polite">
      {/* Title row */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Marketplace</p>
          <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">{title}</h1>
          {!state.loading && !state.error && (
            <p className="text-sm text-neutral-500">
              {ai && state.groups.length > 1
                ? <>{state.groups.filter((g) => g.count > 0).length} of {state.groups.length} parts available · {state.total} products</>
                : <>{state.total.toLocaleString()} {state.total === 1 ? 'product' : 'products'}</>}
              {ai && q ? <> for “{q}”</> : null}
            </p>
          )}
        </div>
        <Link href="/products" className="flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:border-orange-500 hover:text-orange-600">
          <X className="h-3.5 w-3.5" /> {q ? 'Clear search' : 'Back to marketplace'}
        </Link>
      </div>

      {/* one seller's shop: who they are, and a way back to everything */}
      {seller && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-neutral-200 sm:p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-500 text-lg font-black text-white" aria-hidden>{seller.name.slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">Seller</span>
            <span className="flex items-center gap-1 truncate font-bold">{seller.name}{seller.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Verified seller" />}</span>
            <span className="block text-xs text-neutral-500">{seller.products.toLocaleString()} {seller.products === 1 ? 'product' : 'products'} on Honic</span>
          </span>
          <button type="button" onClick={() => onParams({ seller: null })} className="flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:border-orange-500 hover:text-orange-600"><X className="h-3.5 w-3.5" /> All sellers</button>
        </div>
      )}
      {/* sellers whose name matches what was typed: tap to see only their products */}
      {!seller && !ai && state.sellers.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Sellers matching “{q}”</p>
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
            {state.sellers.map((s) => (
              <button key={s.id} type="button" onClick={() => onParams({ seller: s.id, search: null, q: null })}
                className="flex shrink-0 items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 text-sm font-semibold ring-1 ring-neutral-200 transition hover:ring-orange-400">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-orange-100 text-xs font-black text-orange-700" aria-hidden>{s.name.slice(0, 1).toUpperCase()}</span>
                <span className="max-w-[180px] truncate">{s.name}</span>{s.verified && <BadgeCheck className="h-4 w-4 text-sky-500" aria-label="Verified seller" />}
                <span className="text-xs font-normal text-neutral-500">{s.products}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI answer: project plan (several parts) or compact bubble (single product) */}
      {ai && it && state.groups.length > 1 && (
        <AiPlan q={q} it={it} groups={state.groups} products={state.products} relaxed={state.relaxed} formatPrice={formatPrice} onAdd={onAdd} />
      )}
      {ai && it && state.groups.length <= 1 && (
        <div className="mb-4 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-3 sm:p-4">
          <p className="flex items-start gap-2 text-sm font-semibold text-neutral-800">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            <span>{it.summary || 'Here is what we found.'}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
{state.groups.length <= 1 && it.keywords && <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-orange-200">🔎 {it.keywords}</span>}
            {it.categoryName && <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-orange-200">📂 {it.categoryName}</span>}
            {(it.minPrice != null || it.maxPrice != null) && (
              <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-orange-200">
                💰 {it.minPrice != null ? formatPrice(it.minPrice) : '0'} – {it.maxPrice != null ? formatPrice(it.maxPrice) : 'any'}
              </span>
            )}
            {it.inStock && <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-orange-200">✅ In stock</span>}
            {it.sort !== 'relevance' && <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-orange-200">↕ {SORT_LABELS[it.sort]}</span>}
          </div>
          {state.relaxed && <p className="mt-2 text-xs text-neutral-600">No exact match for every detail, so we widened the search a little.</p>}
        </div>
      )}

      {/* Filters (typed search & categories). Horizontal scroll on phones. */}
      {!ai && (
        <div className="-mx-3 mb-4 flex items-center gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          <label className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2.5 text-xs font-semibold ring-1 ring-neutral-200">
            <span className="text-neutral-500">Sort</span>
            <select value={sort} onChange={(e) => onParams({ sort: e.target.value === 'relevance' ? null : e.target.value })} className="-my-2.5 bg-transparent py-2.5 font-semibold outline-none">
              {(Object.keys(SORT_LABELS) as SortBy[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
            </select>
          </label>

          <label className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2.5 text-xs font-semibold ring-1 ring-neutral-200">
            <span className="text-neutral-500">Category</span>
            <select
              value={category && mainCats.some((c) => c.id === category.id) ? category.slug : category ? category.slug : ''}
              onChange={(e) => onParams({ mainCategory: e.target.value || null, subCategory: null, category: null })}
              className="-my-2.5 max-w-[9rem] bg-transparent py-2.5 font-semibold outline-none"
            >
              <option value="">All</option>
              {category && !mainCats.some((c) => c.id === category.id) && <option value={category.slug}>{category.name}</option>}
              {mainCats.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
          </label>

          {/* keyed: resets its inputs when the URL price changes (no setState-in-effect) */}
          <PriceFilter key={`${minPrice}|${maxPrice}`} minPrice={minPrice} maxPrice={maxPrice} onApply={(min, max) => onParams({ minPrice: min, maxPrice: max })} />

          <button
            type="button"
            onClick={() => onParams({ inStock: inStock ? null : '1' })}
            aria-pressed={inStock}
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${inStock ? 'bg-orange-500 text-white ring-orange-500' : 'bg-white ring-neutral-200 hover:ring-orange-400'}`}
          >
            {inStock && <Check className="h-3.5 w-3.5" />} In stock
          </button>

          {hasFilters && (
            <button type="button" onClick={() => onParams({ sort: null, minPrice: null, maxPrice: null, inStock: null, ...(q ? { mainCategory: null, subCategory: null, category: null } : {}) })} className="shrink-0 px-2 text-xs font-semibold text-orange-600 hover:underline">
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* Honest notice when nothing matched by name */}
      {!state.loading && !state.error && q && !state.exact && state.products.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          We don’t have products named “{q}”. These are the closest items in our catalog.
          {!ai && <> <button onClick={onTryAi} className="font-semibold underline">Try AI search</button> for a smarter match.</>}
        </div>
      )}

      {state.error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          {state.error} <button onClick={onLoadMore} className="ml-1 font-semibold underline">Try again</button>
        </div>
      )}

      {state.products.length > 0 && ai && state.groups.length > 1 ? (
        <div className="space-y-8">
          {state.groups.map((g, i) => {
            const items = g.productIds.map((id) => state.products.find((p) => p.id === id)).filter(Boolean) as Product[]
            if (!items.length) return null
            return (
              <div key={g.term} id={`part-${i}`} className="scroll-mt-24">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-lg font-black capitalize">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-orange-500 text-xs text-white">{i + 1}</span>
                    {g.term}
                  </h2>
                  {g.count > items.length && (
                    <Link href={`/products?search=${encodeURIComponent(g.matchedTerm || g.term)}`} className="text-sm font-semibold text-orange-600 hover:underline">
                      See all {g.count} →
                    </Link>
                  )}
                </div>
                <ProductGrid products={items} formatPrice={formatPrice} onOpen={onOpen} onAdd={onAdd} cart={cart} />
              </div>
            )
          })}
        </div>
      ) : state.products.length > 0 ? (
        <ProductGrid products={state.products} formatPrice={formatPrice} onOpen={onOpen} onAdd={onAdd} cart={cart} />
      ) : null}

      {/* AI search: animated "thinking" panel so the wait feels natural (typed search keeps the quick skeleton) */}
      {state.loading && ai && state.products.length === 0 && q && <AiThinking key={q} q={q} />}

      {state.loading && !(ai && state.products.length === 0) && (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: state.products.length ? 6 : 12 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-neutral-100" />)}
        </div>
      )}

      {!state.loading && state.hasMore && state.products.length > 0 && (
        <div className="mt-8 text-center">
          <button onClick={onLoadMore} className="w-full rounded-xl border-2 border-orange-500 bg-white px-8 py-3 text-sm font-bold hover:bg-orange-500 hover:text-white sm:w-auto">
            Load more ({state.total - state.products.length} more)
          </button>
        </div>
      )}

      {/* Empty category: nothing listed yet (not a spelling problem) */}
      {!state.loading && !state.error && state.products.length === 0 && !q && category && !hasFilters && (
        <div className="mx-auto max-w-md rounded-3xl bg-neutral-50 px-6 py-12 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-3 font-bold">Nothing in {category.name} yet.</p>
          <p className="mt-1 text-sm text-neutral-500">Sellers are joining. Check back soon, or have a look around the store.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/products?sort=popular" className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white">Shop best sellers</Link>
            <Link href="/become-supplier" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-neutral-200">Sell in {category.name}</Link>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!state.loading && !state.error && state.products.length === 0 && !(!q && category && !hasFilters) && (
        <div className="mx-auto max-w-md rounded-3xl bg-neutral-50 px-6 py-12 text-center">
          <Search className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-3 font-bold">No products found{q ? ` for “${q}”` : ''}.</p>
          <p className="mt-1 text-sm text-neutral-500">{q ? 'Check the spelling, use fewer words, or try one of these:' : 'Try removing a filter, or one of these:'}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {!ai && q && <button onClick={onTryAi} className="flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white"><Sparkles className="h-4 w-4" />Ask AI</button>}
            <button onClick={() => openLens()} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-neutral-200"><Camera className="h-4 w-4" />Search by photo</button>
            <Link href="/products" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-neutral-200">Browse all</Link>
          </div>
        </div>
      )}
    </section>
  )
}

function RailButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 border-b border-neutral-100 px-1 py-3 last:border-b-0 hover:bg-orange-50">
      {icon}
      <span className="leading-tight text-neutral-700">{label}</span>
    </button>
  )
}

function TabButton({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-0.5 py-2 ${active ? 'font-bold text-neutral-950' : ''}`}>
      {icon}
      {label}
    </button>
  )
}

function CategoryDrawer({ brand, mainCats, subsOf, onClose }: {
  brand: string; mainCats: Category[]; subsOf: (c: Category) => Category[]; onClose: () => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Categories">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* phone: bottom sheet · tablet: left panel */}
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-white sm:inset-y-0 sm:left-0 sm:right-auto sm:max-h-none sm:w-[380px] sm:rounded-none sm:rounded-r-3xl">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-neutral-300 sm:hidden" />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-black">Shop {brand}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-neutral-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {mainCats.length === 0 && <p className="p-4 text-sm text-neutral-500">Loading categories…</p>}
          {mainCats.map(c => {
            const subs = subsOf(c)
            const isOpen = open === c.id
            return (
              <div key={c.id} className="border-b border-neutral-100 last:border-0">
                <div className="flex items-center">
                  <Link href={categoryHref(c)} onClick={onClose} className="flex flex-1 items-center gap-3 px-2 py-3 text-sm font-semibold">
                    <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-orange-50 text-sm font-black text-orange-600">
                      {isImageUrl(c.image_url)
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={optimizedImg(c.image_url, 64)} alt="" className="h-full w-full object-cover" />
                        : c.name[0]}
                    </span>
                    {c.name}
                  </Link>
                  {subs.length > 0 && (
                    <button onClick={() => setOpen(isOpen ? null : c.id)} className="p-3" aria-label={isOpen ? 'Collapse' : 'Expand'} aria-expanded={isOpen}>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="grid grid-cols-2 gap-1 pb-3 pl-14 pr-2">
                    {subs.map(s => (
                      <Link key={s.id} href={categoryHref(s)} onClick={onClose} className="truncate rounded-lg px-2 py-1.5 text-sm text-neutral-600 hover:bg-orange-50">{s.name}</Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm font-semibold">
          <Link href="/support/order-tracking" onClick={onClose} className="rounded-xl bg-stone-100 py-2.5 text-center">Track order</Link>
          <Link href="/help" onClick={onClose} className="rounded-xl bg-stone-100 py-2.5 text-center">Help</Link>
        </div>
      </div>
    </div>
  )
}

function RfqModal({ onClose, defaultProduct }: { onClose: () => void; defaultProduct: string }) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ product: defaultProduct, quantity: '', unit: 'Pieces', details: '', email: '' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/contact/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryType: 'rfq',
          name: form.email,
          email: form.email,
          subject: `Quote request: ${form.product}`,
          message: `Quantity: ${form.quantity} ${form.unit}\n\n${form.details || '(no extra details)'}`,
        }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.success) throw new Error(d?.error || 'Could not send your request.')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your request.')
    } finally {
      setSending(false)
    }
  }

  const field = 'w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-300'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Get a quote">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-black">Get a quote</h2>
            <p className="text-xs text-neutral-500">Buying in bulk? Tell us what you need and we&apos;ll get back to you.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-neutral-100"><X className="h-5 w-5" /></button>
        </div>
        {sent ? (
          <div className="py-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-orange-500 text-white"><Check className="h-7 w-7" /></span>
            <p className="mt-3 font-bold">Request sent</p>
            <p className="text-sm text-neutral-500">We&apos;ll reply to {form.email} with pricing.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 text-sm">
            <input required maxLength={200} value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} placeholder="What are you looking for?" aria-label="Product" className={field} />
            <div className="flex gap-2">
              <input required type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="Quantity" aria-label="Quantity" className={`${field} flex-1`} />
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} aria-label="Unit" className="rounded-xl border border-neutral-300 px-3 py-2.5">
                {['Pieces', 'Sets', 'Boxes', 'Cartons', 'Kilograms', 'Meters'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <textarea value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} rows={4} maxLength={3000} placeholder="Specs, target price, delivery town…" aria-label="Details" className={field} />
            <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Your email" aria-label="Your email" className={field} />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <button disabled={sending} className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-60">
              {sending ? 'Sending…' : 'Send request'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed bottom-24 right-24 z-50 hidden w-80 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl lg:block">
      <div className="flex items-center justify-between bg-orange-500 px-4 py-3 text-white">
        <span className="flex items-center gap-2 font-bold"><MessageCircle className="h-4 w-4" /> Need a hand?</span>
        <button onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <p className="rounded-xl bg-orange-50 p-3">Hi! 👋 We can help you find a product, check stock or track an order.</p>
        <div className="grid gap-2">
          <Link href="/support" className="rounded-xl border px-3 py-2 hover:border-orange-500">Talk to support</Link>
          <Link href="/help" className="rounded-xl border px-3 py-2 hover:border-orange-500">Browse help articles</Link>
          <Link href="/support/order-tracking" className="rounded-xl border px-3 py-2 hover:border-orange-500">Track my order</Link>
        </div>
      </div>
    </div>
  )
}
