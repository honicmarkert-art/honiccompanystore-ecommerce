'use client'

import { memo, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Bell, Bookmark, Camera, ChevronDown, ChevronRight, Clock, Heart, HelpCircle, LayoutGrid, LogIn, LogOut,
  Menu, MessageSquare, Package, Search, Settings, ShieldCheck, ShoppingCart, Store, Truck, User, X, Zap, Plane } from 'lucide-react'
import { optimizedImg } from '@/lib/image-optimize'
import { useAuth } from '@/contexts/auth-context'
import { useGlobalAuthModal } from '@/contexts/global-auth-modal'
import { openLens } from '@/components/image-search/lens'
import { BrandLogo } from '@/components/brand-logo'
import { useCurrency } from '@/contexts/currency-context'
import { useCartCount } from '@/hooks/use-cart-count'

const isUsableImage = (src?: string | null): src is string =>
  !!src && /^(https?:\/\/|\/)/.test(src.trim()) && !src.includes('placeholder')

type Category = { id: string; name: string; slug: string; parent_id?: string | null; parent_slug?: string | null; is_main?: boolean; product_count?: number }
type Suggestion = { id: number; name: string; slug?: string; price: number; image?: string | null; category?: string }

/**
 * One header for the whole store (home, Marketplace, categories, product pages, account...):
 * info strip, logo, categories mega-menu, search with live suggestions + photo search, wishlist,
 * cart, account menu and a phone drawer. Product pages also pass `product` for the slim buy bar.
 */
type Props = {
  companyName?: string
  logo?: string // unused: BrandLogo reads the company logo itself
  /** Pages that already track the cart (product page) pass the live count; others read it from storage. */
  cartCount?: number
  wishlistCount?: number
  /** Where the phone back arrow goes when there's no history. Omit to hide the back arrow (e.g. home). */
  returnTo?: string
  formatPrice?: (n: number) => string
  /** Desktop: slim product bar shown once the buy buttons scroll away (product pages only) */
  showProductBar?: boolean
  product?: { name: string; image?: string | null; price: number; inStock: boolean }
  onAddToCart?: () => void
  onBuyNow?: () => void
}

const RECENT_KEY = 'honic_recent_searches'
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 6) } catch { return [] } }
const saveRecent = (q: string) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...readRecent().filter((x) => x !== q)].slice(0, 6))) } catch { /* storage blocked */ } }

const categoryHref = (c: Category) =>
  c.is_main || !c.parent_slug
    ? `/products?mainCategory=${encodeURIComponent(c.slug)}`
    : `/products?mainCategory=${encodeURIComponent(c.parent_slug)}&subCategory=${encodeURIComponent(c.slug)}`

const productHref = (p: Suggestion) => `/products/${p.id}-${encodeURIComponent(p.slug || p.name)}`

// Categories are shared by every product page visit — fetch once per session
let categoriesPromise: Promise<Category[]> | null = null
const loadCategories = () =>
  (categoriesPromise ??= fetch('/api/categories').then((r) => r.json()).then((d) => (Array.isArray(d?.categories) ? d.categories : [])).catch(() => { categoriesPromise = null; return [] }))

function useOutside(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [ref, open, close])
}

function SiteHeaderImpl({ companyName, cartCount: cartCountProp, wishlistCount = 0, returnTo, formatPrice: formatPriceProp, showProductBar = false, product, onAddToCart, onBuyNow }: Props) {
  const router = useRouter()
  const { formatPrice: formatPriceCtx } = useCurrency()
  const formatPrice = formatPriceProp || formatPriceCtx
  const storedCount = useCartCount()
  const cartCount = cartCountProp ?? storedCount
  const { user, isAuthenticated, signOut } = useAuth() as any
  const { openAuthModal } = useGlobalAuthModal()

  const [categories, setCategories] = useState<Category[]>([])
  const [catOpen, setCatOpen] = useState(false)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  // results are stored with the term they belong to; what to show is derived (no setState in effects)
  const [found, setFound] = useState<{ term: string; list: Suggestion[] }>({ term: '', list: [] })
  const [recent, setRecent] = useState<string[]>([])
  const [hi, setHi] = useState(-1)

  const catRef = useRef<HTMLDivElement>(null)
  const accRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useOutside(catRef, catOpen, () => setCatOpen(false))
  useOutside(accRef, accountOpen, () => setAccountOpen(false))
  useOutside(searchRef, focused, () => setFocused(false))

  const mainCats = categories.filter((c) => c.is_main || !c.parent_id)
  const subsOf = (id: string) => categories.filter((c) => c.parent_id === id)
  const ensureCategories = () => { if (!categories.length) loadCategories().then(setCategories) }

  // Debounced live suggestions (fast DB search: /api/search)
  const term = q.trim()
  const suggestions = term.length >= 2 && found.term === term ? found.list : []
  const searching = term.length >= 2 && found.term !== term
  useEffect(() => {
    if (term.length < 2) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=6`, { signal: ctrl.signal })
        const d = await r.json()
        setFound({ term, list: Array.isArray(d?.products) ? d.products.slice(0, 6) : [] })
      } catch {
        if (!ctrl.signal.aborted) setFound({ term, list: [] })
      }
    }, 200)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [term])


  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawer])

  const runSearch = (term: string) => {
    const t = term.trim()
    if (!t) return
    saveRecent(t)
    setFocused(false)
    inputRef.current?.blur()
    router.push(`/products?search=${encodeURIComponent(t)}`)
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => (i + 1) % suggestions.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => (i <= 0 ? suggestions.length - 1 : i - 1)) }
    if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); setFocused(false); router.push(productHref(suggestions[hi])) }
  }

  const goBack = () => (window.history.length > 1 && document.referrer.startsWith(window.location.origin) ? router.back() : router.push(returnTo || '/'))
  const firstName = (user?.name || user?.email || '').split(/[\s@]/)[0]
  const initial = (firstName || 'U').charAt(0).toUpperCase()

  const accountLinks = [
    { href: '/account/orders', label: 'My orders', icon: Package },
    { href: '/account/messages', label: 'Messages', icon: MessageSquare },
    { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
    { href: '/account/saved-later', label: 'Saved for later', icon: Bookmark },
    { href: '/account/price-alerts', label: 'Price alerts', icon: Bell },
    { href: '/account/settings', label: 'Settings', icon: Settings },
  ]

  const showDropdown = focused && (q.trim().length >= 2 || recent.length > 0)

  return (
    <>
      {/* Info strip (desktop, scrolls away) */}
      <div className="hidden bg-neutral-950 text-[12px] text-neutral-300 lg:block">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-orange-400" />Fast delivery across Tanzania</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-orange-400" />Secure payment</span>
          </div>
          <nav className="flex items-center gap-5">
            <Link href="/support/order-tracking" className="hover:text-white">Track order</Link>
            <Link href="/support" className="flex items-center gap-1 hover:text-white"><HelpCircle className="h-3.5 w-3.5" />Help</Link>
            <Link href="/become-supplier" className="flex items-center gap-1 font-semibold text-orange-400 hover:text-orange-300"><Store className="h-3.5 w-3.5" />Sell on {companyName || 'Honic'}</Link>
          </nav>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-1.5 px-2 sm:h-16 sm:gap-3 sm:px-6">
          {returnTo ? (
            <>
              <button onClick={goBack} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 lg:hidden" aria-label="Go back">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="hidden sm:block"><BrandLogo size="md" textClassName="hidden xl:flex" /></span>
            </>
          ) : (
            <BrandLogo size="md" showText={false} className="sm:hidden" />
          )}
          {!returnTo && <span className="hidden sm:block"><BrandLogo size="md" textClassName="hidden xl:flex" /></span>}

          {/* The two shops (desktop) */}
          <nav aria-label="Shops" className="hidden shrink-0 items-center gap-1 lg:flex">
            <Link href="/products" className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-neutral-700 hover:bg-orange-50 hover:text-orange-700 dark:text-neutral-200 dark:hover:bg-neutral-800"><Store className="h-4 w-4" />Marketplace</Link>
            <Link href="/buy-from-china" className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[#c8102e] hover:bg-red-50 dark:text-red-400 dark:hover:bg-neutral-800"><Plane className="h-4 w-4" />Buy from China</Link>
          </nav>

          {/* Categories mega menu (desktop) */}
          <div ref={catRef} className="relative hidden lg:block" onMouseEnter={ensureCategories}>
            <button
              onClick={() => { ensureCategories(); setCatOpen((o) => !o) }}
              aria-expanded={catOpen}
              className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${catOpen ? 'bg-orange-500 text-white' : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800'}`}
            >
              <LayoutGrid className="h-4 w-4" /> Categories <ChevronDown className={`h-4 w-4 ${catOpen ? 'rotate-180' : ''}`} />
            </button>
            {catOpen && (
              <div className="absolute left-0 top-12 z-50 flex w-[640px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
                <ul className="max-h-[420px] w-60 shrink-0 overflow-y-auto border-r border-neutral-100 py-2 dark:border-neutral-800">
                  {mainCats.length === 0 && Array.from({ length: 6 }).map((_, i) => <li key={i} className="mx-3 my-2 h-5 rounded bg-neutral-100 dark:bg-neutral-800" />)}
                  {mainCats.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={categoryHref(c)}
                        onMouseEnter={() => setActiveCat(c.id)}
                        onClick={() => setCatOpen(false)}
                        className={`flex items-center justify-between px-4 py-2 text-sm ${activeCat === c.id ? 'bg-orange-50 font-semibold text-orange-700 dark:bg-orange-950/30' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}
                      >
                        <span className="truncate">{c.name}</span>
                        {subsOf(c.id).length > 0 && <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="max-h-[420px] flex-1 overflow-y-auto p-4">
                  {(() => {
                    const cat = mainCats.find((c) => c.id === activeCat) || mainCats[0]
                    if (!cat) return null
                    const subs = subsOf(cat.id)
                    return (
                      <>
                        <Link href={categoryHref(cat)} onClick={() => setCatOpen(false)} className="mb-3 flex items-center gap-1 text-sm font-bold hover:text-orange-600">
                          All {cat.name} <ChevronRight className="h-4 w-4" />
                        </Link>
                        <div className="grid grid-cols-2 gap-1">
                          {subs.map((s) => (
                            <Link key={s.id} href={categoryHref(s)} onClick={() => setCatOpen(false)} className="truncate rounded-lg px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-orange-600 dark:text-neutral-300 dark:hover:bg-neutral-800">
                              {s.name}
                            </Link>
                          ))}
                        </div>
                        {subs.length === 0 && <p className="text-sm text-neutral-500">Browse everything in {cat.name}.</p>}
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Search with live suggestions */}
          <form
            ref={searchRef}
            role="search"
            data-lens
            onSubmit={(e) => { e.preventDefault(); runSearch(q) }}
            className="relative min-w-0 flex-1 sm:mx-auto sm:max-w-2xl"
          >
            <div className="flex h-10 items-center rounded-full border-2 border-neutral-200 bg-neutral-50 pl-3 focus-within:border-orange-500 focus-within:bg-white dark:border-neutral-700 dark:bg-neutral-900">
              <Search className="h-4 w-4 shrink-0 text-neutral-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setHi(-1) }}
                onFocus={() => { setFocused(true); setRecent(readRecent()) }}
                onKeyDown={onKey}
                placeholder="Search products, brands, kits…"
                aria-label="Search products"
                aria-autocomplete="list"
                className="min-w-0 flex-1 self-stretch bg-transparent px-2 py-2 text-sm outline-none"
              />
              {q && <button type="button" onClick={() => { setQ(''); inputRef.current?.focus() }} className="p-1 text-neutral-400 hover:text-neutral-700" aria-label="Clear search"><X className="h-4 w-4" /></button>}
              <button type="button" onClick={() => { setFocused(false); openLens() }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-orange-50 hover:text-orange-600" aria-label="Search by photo" title="Search by photo (or paste / drop an image)">
                <Camera className="h-[18px] w-[18px]" />
              </button>
              <button type="submit" className="m-0.5 hidden h-8 rounded-full bg-orange-500 px-5 text-sm font-bold text-white hover:bg-orange-600 sm:block">Search</button>
            </div>

            {showDropdown && (
              <div className="absolute inset-x-0 top-12 z-50 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
                {q.trim().length < 2 ? (
                  <div className="p-3">
                    <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Recent searches
                      <button type="button" onClick={() => { try { localStorage.removeItem(RECENT_KEY) } catch { /* ignore */ } setRecent([]) }} className="normal-case tracking-normal hover:text-orange-600">Clear</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recent.map((r) => (
                        <button type="button" key={r} onClick={() => { setQ(r); runSearch(r) }} className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-sm hover:bg-orange-50 hover:text-orange-700 dark:bg-neutral-800">
                          <Clock className="h-3.5 w-3.5 opacity-60" />{r}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {searching && suggestions.length === 0 && <p className="px-4 py-3 text-sm text-neutral-500">Searching…</p>}
                    {!searching && suggestions.length === 0 && <p className="px-4 py-3 text-sm text-neutral-500">No matches yet — press Enter to search all products.</p>}
                    <ul role="listbox">
                      {suggestions.map((s, i) => {
                        const img = isUsableImage(s.image) ? s.image! : '/placeholder.svg'
                        return (
                          <li key={s.id} role="option" aria-selected={hi === i}>
                            <Link href={productHref(s)} onClick={() => { saveRecent(q.trim()); setFocused(false) }} className={`flex items-center gap-3 px-3 py-2 ${hi === i ? 'bg-orange-50 dark:bg-orange-950/30' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={optimizedImg(img, 40)} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain ring-1 ring-neutral-100" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{s.name}</span>
                                {s.category && <span className="block truncate text-xs text-neutral-500">{s.category}</span>}
                              </span>
                              <span className="shrink-0 text-sm font-bold">{formatPrice(s.price)}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                    <button type="submit" className="flex w-full items-center gap-2 border-t border-neutral-100 px-4 py-3 text-left text-sm font-semibold text-orange-600 hover:bg-orange-50 dark:border-neutral-800">
                      <Search className="h-4 w-4" /> See all results for “{q.trim()}”
                    </button>
                  </>
                )}
              </div>
            )}
          </form>

          {/* Right icons */}
          <Link href="/account/wishlist" className="relative hidden h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 sm:grid" aria-label="Wishlist">
            <Heart className="h-5 w-5" />
            {wishlistCount > 0 && <Count n={wishlistCount} />}
          </Link>
          <Link href="/cart" className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label={`Cart, ${cartCount} items`}>
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && <Count n={cartCount} />}
          </Link>

          {/* Account (desktop dropdown) */}
          <div ref={accRef} className="relative hidden lg:block">
            {isAuthenticated ? (
              <button onClick={() => setAccountOpen((o) => !o)} aria-expanded={accountOpen} className="flex h-10 items-center gap-2 rounded-full pl-1 pr-3 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                {isUsableImage(user?.profile?.avatar)
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={user.profile.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                  : <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-sm font-bold text-white">{initial}</span>}
                <span className="max-w-[90px] truncate text-sm font-semibold">{firstName || 'Account'}</span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </button>
            ) : (
              <button onClick={() => openAuthModal('login')} className="flex h-10 items-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-bold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950">
                <User className="h-4 w-4" /> Sign in
              </button>
            )}
            {accountOpen && isAuthenticated && (
              <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl bg-white py-2 shadow-2xl ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
                <div className="border-b border-neutral-100 px-4 pb-2 dark:border-neutral-800">
                  <p className="truncate text-sm font-semibold">{user?.name || firstName}</p>
                  <p className="truncate text-xs text-neutral-500">{user?.email}</p>
                </div>
                {accountLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} onClick={() => setAccountOpen(false)} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-neutral-50 hover:text-orange-600 dark:hover:bg-neutral-800">
                    <Icon className="h-4 w-4 opacity-70" />{label}
                  </Link>
                ))}
                <button onClick={() => { setAccountOpen(false); signOut?.() }} className="mt-1 flex w-full items-center gap-3 border-t border-neutral-100 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-neutral-800 dark:hover:bg-red-950/30">
                  <LogOut className="h-4 w-4" />Sign out
                </button>
              </div>
            )}
          </div>

          <button onClick={() => { ensureCategories(); setDrawer(true) }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop product bar (product pages only) */}
        {product && (
        <div className={`hidden overflow-hidden border-t border-neutral-100 bg-white transition-[max-height] duration-200 dark:border-neutral-800 dark:bg-neutral-950 lg:block ${showProductBar ? 'max-h-16' : 'max-h-0 border-t-0'}`} aria-hidden={!showProductBar}>
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={isUsableImage(product.image) ? optimizedImg(product.image, 44) : '/placeholder.svg'} alt="" className="h-11 w-11 rounded-lg bg-white object-contain ring-1 ring-neutral-200" />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{product.name}</p>
            <span className="text-lg font-black">{formatPrice(product.price)}</span>
            <button onClick={onAddToCart} disabled={!product.inStock} tabIndex={showProductBar ? 0 : -1} className="flex h-10 items-center gap-2 rounded-full bg-orange-500 px-5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">
              <ShoppingCart className="h-4 w-4" /> Add to cart
            </button>
            <button onClick={onBuyNow} disabled={!product.inStock} tabIndex={showProductBar ? 0 : -1} className="flex h-10 items-center gap-2 rounded-full bg-neutral-950 px-5 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950">
              <Zap className="h-4 w-4" /> Buy now
            </button>
          </div>
        </div>
        )}
      </header>

      {/* Phone/tablet drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-neutral-950/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col bg-white shadow-2xl dark:bg-neutral-950">
            <div className="flex items-center justify-between border-b border-neutral-100 p-4 dark:border-neutral-800">
              {isAuthenticated ? (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-500 font-bold text-white">{initial}</span>
                  <div className="min-w-0"><p className="truncate font-semibold">Hi, {firstName}</p><p className="truncate text-xs text-neutral-500">{user?.email}</p></div>
                </div>
              ) : (
                <button onClick={() => { setDrawer(false); openAuthModal('login') }} className="flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white">
                  <LogIn className="h-4 w-4" /> Sign in / Register
                </button>
              )}
              <button onClick={() => setDrawer(false)} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* The two shops */}
              <div className="grid grid-cols-2 gap-2 border-b border-neutral-100 p-4 dark:border-neutral-800">
                <Link href="/products" onClick={() => setDrawer(false)} className="flex items-center gap-2 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"><Store className="h-5 w-5" />Marketplace</Link>
                <Link href="/buy-from-china" onClick={() => setDrawer(false)} className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-[#c8102e] dark:bg-red-950/30 dark:text-red-300"><Plane className="h-5 w-5" />Buy from China</Link>
              </div>
              {isAuthenticated && (
                <div className="grid grid-cols-3 gap-2 border-b border-neutral-100 p-4 dark:border-neutral-800">
                  {accountLinks.slice(0, 6).map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} onClick={() => setDrawer(false)} className="flex flex-col items-center gap-1 rounded-xl bg-neutral-50 p-2.5 text-center text-[11px] font-medium dark:bg-neutral-900">
                      <Icon className="h-5 w-5 text-orange-500" />{label}
                    </Link>
                  ))}
                </div>
              )}
              <p className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Shop by category</p>
              <ul className="pb-2">
                {mainCats.length === 0 && Array.from({ length: 6 }).map((_, i) => <li key={i} className="mx-4 my-3 h-4 rounded bg-neutral-100 dark:bg-neutral-800" />)}
                {mainCats.map((c) => (
                  <li key={c.id}>
                    <Link href={categoryHref(c)} onClick={() => setDrawer(false)} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900">
                      {c.name}<ChevronRight className="h-4 w-4 opacity-40" />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-t border-neutral-100 p-4 text-sm dark:border-neutral-800">
                <Link href="/support/order-tracking" onClick={() => setDrawer(false)} className="flex items-center gap-3 py-2"><Truck className="h-4 w-4 opacity-70" />Track order</Link>
                <Link href="/support" onClick={() => setDrawer(false)} className="flex items-center gap-3 py-2"><HelpCircle className="h-4 w-4 opacity-70" />Help & support</Link>
                <Link href="/become-supplier" onClick={() => setDrawer(false)} className="flex items-center gap-3 py-2 font-semibold text-orange-600"><Store className="h-4 w-4" />Sell on {companyName || 'Honic'}</Link>
                {isAuthenticated && (
                  <button onClick={() => { setDrawer(false); signOut?.() }} className="mt-2 flex items-center gap-3 py-2 text-red-600"><LogOut className="h-4 w-4" />Sign out</button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute right-0 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white ring-2 ring-white dark:ring-neutral-950">
      {n > 99 ? '99+' : n}
    </span>
  )
}

export const SiteHeader = memo(SiteHeaderImpl)
