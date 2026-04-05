"use client"

// Note: ISR (revalidate) cannot be used in client components
// CPU optimization is handled via API route caching and CDN caching instead

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { OptimizedLink } from '@/components/optimized-link'
import { PromotionalCartPopup } from '@/components/promotional-cart-popup'
import { StoreDownloadLinksRow } from '@/components/store-download-links'
import { logger } from '@/lib/logger'
import { 
  Search, 
  Camera, 
  DollarSign,
  Landmark,
  ShoppingCart, 
  User, 
  Users,
  Menu,
  X,
  Play,
  Shield,
  FileText,
  Layers,
  Expand,
  HelpCircle,
  Flag,
  Truck,
  Eye,
  Zap,
  Cpu,
  CircuitBoard,
  Package,
  ChevronRight,
  Bot,
  Lightbulb,
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  CreditCard,
  Coins,
  Ticket,
  Settings,
  Heart,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  ArrowRight,
  CheckCircle,
  Building2,
  Headphones
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCompanyContext } from '@/components/company-provider'
import { UserProfile } from '@/components/user-profile'
import { useAuth } from '@/contexts/auth-context'
import { useGlobalAuthModal } from '@/contexts/global-auth-modal'
import { useCurrency } from '@/contexts/currency-context'
import { useLanguage } from '@/contexts/language-context'
import { useCart } from '@/hooks/use-cart'
import { useTheme } from '@/hooks/use-theme'
import { Switch } from '@/components/ui/switch'
import { Moon, Sun } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// Helper function to detect if a file is a video
const isVideoFile = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv']
  return videoExtensions.some(ext => url.toLowerCase().includes(ext))
}

function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === '/home') return pathname === '/home' || pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function LandingPage() {
  const router = useRouter()
  const pathname = usePathname()
  const { currency, setCurrency } = useCurrency()
  const { language, setLanguage } = useLanguage()
  const { toast } = useToast()
  const { 
    companyName, 
    companyColor, 
    companyLogo, 
    mainHeadline, 
    heroBackgroundImage,
    serviceRetailImages,
    servicePrototypingImages,
    servicePcbImages,
    serviceAiImages,
    serviceStemImages,
    serviceHomeImages,
    serviceImageRotationTime,
    settings: adminSettings,
    isLoaded: companyLoaded
  } = useCompanyContext()
  
  // Fallback logo system - use local logo if API is not loaded or logo is not available
  const fallbackLogo = "/android-chrome-512x512.png"
  const displayLogo = companyLoaded && companyLogo && companyLogo !== fallbackLogo && companyLogo !== "/placeholder-logo.png" ? companyLogo : fallbackLogo
  const { user } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const { cartUniqueProducts } = useCart()
  const { backgroundColor, setBackgroundColor } = useTheme()
  const [searchTerm, setSearchTerm] = useState('')
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [email, setEmail] = useState('')
  const [ads, setAds] = useState<any[]>([])
  const [adRotation, setAdRotation] = useState<number>(5000)
  const [isPromotionalCartOpen, setIsPromotionalCartOpen] = useState(false)
  const [promotionalProducts, setPromotionalProducts] = useState<any[]>([])
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false)
  const [headerScrolled, setHeaderScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /** Stable URL: never use Date.now() per render (scroll/header updates re-render and would reload the image). */
  const heroBackgroundCssUrl = useMemo(() => {
    if (!heroBackgroundImage) return ''
    if (typeof window === 'undefined') return heroBackgroundImage
    try {
      const bust = localStorage.getItem('settings_cache_bust')
      if (bust) {
        const sep = heroBackgroundImage.includes('?') ? '&' : '?'
        return `${heroBackgroundImage}${sep}cb=${bust}`
      }
    } catch {
      /* ignore */
    }
    return heroBackgroundImage
  }, [heroBackgroundImage])

  useEffect(() => {
    if (!heroBackgroundCssUrl) return
    const img = new window.Image()
    img.src = heroBackgroundCssUrl
  }, [heroBackgroundCssUrl])

  // Fetch admin-controlled advertisements (same API as product list)
  useEffect(() => {
    let cancelled = false
    const loadAds = async () => {
      try {
        const cacheBust = typeof window !== 'undefined' ? (localStorage.getItem('settings_cache_bust') || Date.now()) : Date.now()
        
        const [adsRes, rotRes] = await Promise.all([
          fetch(`/api/advertisements?placement=home&cb=${cacheBust}`, { cache: 'no-store' }),
          fetch(`/api/advertisements/rotation-time?cb=${cacheBust}`, { cache: 'no-store' })
        ])
        
        if (!cancelled) {
          if (adsRes.ok) {
            const adsData = await adsRes.json()
            setAds(adsData)
          } else {
          }
          
          if (rotRes.ok) {
            const rotationData = await rotRes.json()
            setAdRotation(rotationData)
          } else {
          }
        }
      } catch (error) {
      }
    }
    loadAds()
    return () => { cancelled = true }
  }, [])

  // Fetch promotional products and show popup after 10 seconds
  useEffect(() => {
    const fetchPromotionalProducts = async () => {
      try {
        // Fetch more products to find ones with real images
        const response = await fetch('/api/products?limit=20')
        if (response.ok) {
          const data = await response.json()
          
          // Filter products with real images (not placeholder)
          const productsWithRealImages = (data.products || []).filter((product: any) => 
            product.image && !product.image.includes('placeholder')
          )
          
          // Take first 3 products with real images
          const selectedProducts = productsWithRealImages.slice(0, 3)
          
          setPromotionalProducts(selectedProducts)
        }
      } catch (error) {
      }
    }

    fetchPromotionalProducts()

    // Show popup after 10 seconds
    const timer = setTimeout(() => {
      setIsPromotionalCartOpen(true)
    }, 10000)

    return () => clearTimeout(timer)
  }, [])

  // Rotate promotional products every 10 seconds
  useEffect(() => {
    if (!isPromotionalCartOpen) return

    const interval = setInterval(async () => {
      try {
        // Get random offset to fetch different products each time
        const randomOffset = Math.floor(Math.random() * 50) // Random offset 0-49
        const response = await fetch(`/api/products?limit=20&offset=${randomOffset}`)
        if (response.ok) {
          const data = await response.json()
          
          // Filter products with real images (not placeholder)
          const productsWithRealImages = (data.products || []).filter((product: any) => 
            product.image && !product.image.includes('placeholder')
          )
          
          // Take first 3 products with real images
          const selectedProducts = productsWithRealImages.slice(0, 3)
          
          setPromotionalProducts(selectedProducts)
        }
      } catch (error) {
      }
    }, 10000) // 10 seconds

    return () => clearInterval(interval)
  }, [isPromotionalCartOpen])

  const handleSearch = () => {
    if (searchTerm.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchTerm.trim())}`)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !email.includes('@')) {
      return
    }

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()

      if (result.success) {
        setEmail('')
        // You can add a toast notification here if needed
      }
    } catch (error) {
      }
  }


  const frequentlySearched = [
    'DHT11 sensor',
    'Arduino Uno',
    'ESP32 module',
    'sensor'
  ]

  const features: any[] = []


  const footerLinks = {
    company: [
      { name: 'About Us', href: '/about' },
      { name: 'Our Story', href: '/about#our-story' },
      { name: 'Careers', href: '/contact' },
      { name: 'Press & Media', href: '/about' },
      { name: 'Contact Us', href: '/contact' },
    ],
    services: [
      { name: 'Electronics Supply', href: '/services/electronics' },
      { name: 'Prototyping Services', href: '/services/prototyping' },
      { name: 'PCB Printing', href: '/services/pcb' },
      { name: 'AI Consultancy', href: '/services/ai' }
    ],
    support: [
      { name: 'Help Center', href: '/support' },
      { name: 'Order Tracking', href: '/tracking' },
      { name: 'Returns & Refunds', href: '/returns' },
      { name: 'Shipping Info', href: '/shipping' },
      { name: 'Technical Support', href: '/support' }
    ],
    legal: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
      { name: 'Cookie Policy', href: '/cookies' },
      { name: 'GDPR Compliance', href: '/gdpr' },
      { name: 'Data Protection', href: '/data-protection' }
    ]
  }

  const socialLinks = [
    { name: 'Facebook', icon: <Facebook className="w-5 h-5" />, href: '/social/facebook' },
    { name: 'Twitter', icon: <Twitter className="w-5 h-5" />, href: '/social/twitter' },
    { name: 'Instagram', icon: <Instagram className="w-5 h-5" />, href: '/social/instagram' },
    { name: 'LinkedIn', icon: <Linkedin className="w-5 h-5" />, href: '/social/linkedin' },
    { name: 'YouTube', icon: <Youtube className="w-5 h-5" />, href: '/social/youtube' }
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white" suppressHydrationWarning>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-gray-950/65 backdrop-blur-xl backdrop-saturate-150 transition-[box-shadow,border-color,background-color] duration-300',
          headerScrolled
            ? 'border-white/15 bg-gray-950/82 shadow-lg shadow-black/35'
            : 'shadow-sm shadow-black/25'
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/45 to-transparent opacity-90"
          aria-hidden
        />
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => router.push('/home')}
            className="flex min-w-0 max-w-[55%] sm:max-w-none items-center gap-2.5 rounded-xl text-left transition-all hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 sm:px-1.5 sm:py-1"
          >
            <span className="relative shrink-0 rounded-lg ring-1 ring-white/15 transition-shadow hover:ring-amber-400/40">
              <Image
                src={displayLogo}
                alt={`${companyName || 'Store'} logo`}
                width={44}
                height={44}
                className="h-10 w-10 rounded-lg sm:h-11 sm:w-11"
              />
            </span>
            <span
              className="truncate text-base font-bold tracking-tight text-white sm:text-lg lg:text-xl"
              style={{ color: companyColor || undefined }}
            >
              {companyName || 'Honic Co.'}
            </span>
          </button>

          <nav
            className="hidden items-center gap-0.5 md:flex lg:gap-1"
            aria-label="Main"
          >
            {(
              [
                ['/products', 'Products'],
                ['/categories', 'Categories'],
                ['/services', 'Services'],
                ['/support', 'Help'],
              ] as const
            ).map(([href, label]) => {
              const active = isNavActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                    active &&
                      'after:absolute after:bottom-1 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-amber-400'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2">
            <span
              className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 lg:inline-flex"
              title="We deliver in Tanzania"
            >
              <Flag className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              TZ
            </span>

            <div
              className="hidden items-center rounded-lg border border-white/15 bg-black/30 p-0.5 sm:flex"
              role="group"
              aria-label="Language"
            >
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors',
                  language === 'en'
                    ? 'bg-amber-500 text-gray-950'
                    : 'text-white/65 hover:text-white'
                )}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('sw')}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors',
                  language === 'sw'
                    ? 'bg-amber-500 text-gray-950'
                    : 'text-white/65 hover:text-white'
                )}
              >
                SW
              </button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="hidden h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/15 hover:text-white md:inline-flex"
                  aria-label={`Currency: ${currency}`}
                >
                  {currency === 'USD' ? (
                    <DollarSign className="h-3.5 w-3.5 opacity-90" aria-hidden />
                  ) : (
                    <Landmark className="h-3.5 w-3.5 opacity-90" aria-hidden />
                  )}
                  <span>{currency}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[9rem]">
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={() => setCurrency('USD')}
                >
                  <DollarSign className="h-4 w-4" />
                  US Dollar (USD)
                  {currency === 'USD' && (
                    <CheckCircle className="ml-auto h-4 w-4 text-amber-600" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={() => setCurrency('TZS')}
                >
                  <Landmark className="h-4 w-4" />
                  Tanzanian Shilling (TZS)
                  {currency === 'TZS' && (
                    <CheckCircle className="ml-auto h-4 w-4 text-amber-600" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={() => router.push('/cart')}
              className="relative flex items-center gap-2 rounded-lg p-2 text-white transition-colors hover:bg-white/10 md:px-2.5"
              aria-label={`Shopping cart${cartUniqueProducts > 0 ? `, ${cartUniqueProducts} items` : ''}`}
            >
              <ShoppingCart className="h-5 w-5 shrink-0 sm:h-[22px] sm:w-[22px]" />
              <span className="hidden text-sm font-medium text-white/90 lg:inline">
                Cart
              </span>
              {cartUniqueProducts > 0 && (
                <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] translate-x-0.5 -translate-y-0.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-gray-950 lg:right-1 lg:top-0.5">
                  {cartUniqueProducts > 99 ? '99+' : cartUniqueProducts}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsHamburgerMenuOpen(true)}
              className="rounded-lg p-2 text-white hover:bg-white/10 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="hidden items-center gap-2 border-l border-white/15 pl-3 md:flex">
              {user ? (
                <div className="flex flex-col items-end gap-0.5">
                  <UserProfile />
                  <span className="max-w-[140px] truncate text-[11px] text-white/50">
                    {(user as any)?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Account'}
                  </span>
                </div>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-white hover:bg-white/10 hover:text-white"
                    onClick={() => openAuthModal('login')}
                  >
                    Sign in
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 bg-amber-500 px-4 font-semibold text-gray-950 hover:bg-amber-400"
                    onClick={() => openAuthModal('register')}
                  >
                    Sign up
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="pt-14 sm:pt-16">

      {/*
        Hero background source:
        - When `heroBackgroundImage` is set: image URL from company settings (API field `hero_background_image`),
          loaded via `useCompanyContext()` → fetch `/api/company/settings` in `useCompanySettings`. Class `hero-bg-responsive` in globals.css sets cover/center.
        - When empty: layered CSS gradients only (no image).
      */}
      <section className="relative min-h-[min(88dvh,40rem)] overflow-hidden pb-14 pt-8 sm:min-h-0 sm:pb-20 sm:pt-10 md:pt-14">
        <div
          className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full blur-3xl opacity-25 sm:h-80 sm:w-80"
          style={{ background: companyColor || '#f97316' }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl"
          aria-hidden
        />

        <div
          className={cn('absolute inset-0', heroBackgroundImage && 'hero-bg-responsive')}
          style={{
            backgroundImage: heroBackgroundCssUrl ? `url(${heroBackgroundCssUrl})` : 'none',
            backgroundColor: heroBackgroundImage ? 'transparent' : undefined,
            backgroundPosition: heroBackgroundImage ? 'center center' : undefined,
            backgroundRepeat: heroBackgroundImage ? 'no-repeat' : undefined,
          }}
        >
          {heroBackgroundImage ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/50 to-gray-950" />
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-600/10 via-transparent to-violet-900/20" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-gray-900 to-gray-950" />
              <div
                className="absolute inset-0 opacity-35"
                style={{
                  background: companyColor
                    ? `radial-gradient(ellipse 90% 70% at 50% 0%, ${companyColor}55, transparent 50%)`
                    : 'radial-gradient(ellipse 90% 70% at 50% 0%, rgba(249,115,22,0.3), transparent 50%)',
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 from-20% via-transparent to-transparent" />
            </>
          )}
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12 lg:items-start">
            <div className="lg:col-span-7">
              <div className="mb-5 flex flex-wrap items-center gap-3 sm:mb-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/90 backdrop-blur-sm sm:text-sm">
                  <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                  <span>Trusted · Delivery across Tanzania</span>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-xs text-amber-400/90 transition-colors hover:text-amber-300 sm:text-sm"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                    <Play className="h-3 w-3 fill-current" aria-hidden />
                  </span>
                  About {companyName || 'us'}
                </button>
              </div>

              <h1 className="mb-3 text-3xl font-bold leading-[1.12] tracking-tight text-white drop-shadow-md sm:text-4xl md:text-5xl lg:text-[2.75rem] lg:leading-tight xl:text-5xl">
                {mainHeadline || 'The leading B2B ecommerce platform for global trade'}
              </h1>
              <p className="mb-6 max-w-xl text-sm leading-relaxed text-white/65 sm:mb-8 sm:text-base">
                Search thousands of parts and kits — secure checkout, fast support, built for makers and businesses.
              </p>

              <div className="mb-4 w-full max-w-xl sm:mb-5">
                <div className="rounded-xl border border-white/15 bg-white/10 p-1 shadow-xl backdrop-blur-md sm:rounded-2xl sm:p-1.5">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Search products, brands, categories…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="h-11 w-full rounded-lg border-0 bg-white pr-[5.5rem] pl-4 text-gray-900 shadow-inner focus-visible:ring-2 focus-visible:ring-amber-500 sm:h-12 sm:rounded-xl sm:pr-28 md:h-14 md:text-lg"
                    />
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="hidden h-9 w-9 p-0 hover:bg-gray-100 sm:inline-flex"
                        aria-label="Image search"
                      >
                        <Camera className="h-4 w-4 text-gray-600" />
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSearch}
                        className="h-9 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-gray-950 hover:bg-amber-400 sm:h-10 sm:px-4 sm:rounded-xl"
                      >
                        <Search className="mr-1 inline h-4 w-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Search</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex max-w-xl flex-wrap items-center gap-2">
                <span className="w-full text-xs font-medium text-white/45 sm:w-auto sm:mr-1">Popular</span>
                {frequentlySearched.map((term, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:border-amber-400/35 hover:bg-white/18"
                    onClick={() => {
                      setSearchTerm(term)
                      router.push(`/products?search=${encodeURIComponent(term)}`)
                    }}
                  >
                    {term}
                  </Badge>
                ))}
              </div>
            </div>

            <aside className="lg:col-span-5">
              <div className="rounded-2xl border border-white/10 bg-gray-950/40 p-6 shadow-2xl backdrop-blur-md sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">Get started</p>
                <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">Shop in a few clicks</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Browse categories or jump straight to products — same secure cart and checkout.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <Button
                    size="lg"
                    className="h-12 w-full bg-amber-500 font-semibold text-gray-950 hover:bg-amber-400 sm:h-11"
                    onClick={() => router.push('/products')}
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Shop now
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-full border-white/25 bg-transparent text-white hover:bg-white/10 sm:h-11"
                    onClick={() => router.push('/categories')}
                  >
                    Browse categories
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
                <ul className="mt-6 space-y-3 border-t border-white/10 pt-6 text-sm text-white/75">
                  <li className="flex items-start gap-3">
                    <Truck className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
                    <span>Nationwide delivery options at checkout</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
                    <span>Secure payments & order protection</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
                    <span>Help when you need it</span>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Call to Action — flows into features + footer (no gray “void” band) */}
      <section className="relative overflow-hidden py-7 sm:py-9 pb-6 sm:pb-7">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gray-950 via-[#0d1117] to-slate-950"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_15%_10%,rgba(251,191,36,0.2),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_92%_88%,rgba(139,92,246,0.14),transparent_52%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(251,191,36,0.06)_50%,transparent_60%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400/90 sm:text-xs">
            For teams & makers
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            Ready to stock your workspace?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
            Join buyers who use {companyName || 'our store'} for reliable parts, fair pricing, and checkout that
            stays simple from cart to door — no clutter, just what you need to keep projects moving.
          </p>

          <ul className="mx-auto mt-5 grid max-w-2xl grid-cols-1 gap-2.5 text-left sm:grid-cols-3 sm:gap-3">
            <li className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 backdrop-blur-sm">
              <Package className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-white">One cart, many categories</p>
                <p className="text-xs leading-snug text-white/50">Browse electronics, tools, and supplies together.</p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 backdrop-blur-sm">
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-white">Straightforward checkout</p>
                <p className="text-xs leading-snug text-white/50">Clear totals, shipping choices, and payment options.</p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 backdrop-blur-sm">
              <Headphones className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-white">Help when you need it</p>
                <p className="text-xs leading-snug text-white/50">Support and order updates so you are never stuck.</p>
              </div>
            </li>
          </ul>

          <div className="mt-6 flex flex-col items-stretch justify-center gap-2.5 sm:mt-7 sm:flex-row sm:items-center sm:gap-3">
            <Button
              size="lg"
              className="h-11 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 font-semibold text-gray-950 shadow-lg shadow-amber-900/25 hover:from-amber-400 hover:to-orange-400 sm:h-12 sm:w-auto"
              onClick={() => router.push('/products')}
            >
              Start shopping
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 w-full rounded-xl border-amber-400/45 bg-zinc-950/50 text-amber-50 shadow-none hover:border-amber-400/65 hover:bg-amber-500/15 hover:text-white sm:h-12 sm:w-auto"
              onClick={() => openAuthModal('register')}
            >
              Create account
            </Button>
          </div>
        </div>
      </section>

      {/* Features — same base as footer, flush under CTA */}
      <section className="bg-gray-950 pt-3 pb-5 sm:pt-4 sm:pb-6 lg:pb-8">
        <div className="container mx-auto px-4">
          {/* Admin-controlled Advertisements (like product list) */}
          {ads && ads.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3 mb-4 sm:mb-6">
              {ads.slice(0,3).map((ad: any, i: number) => (
                <OptimizedLink key={i} href={ad.link || '/products'} className="block group" target="_blank" rel="noopener noreferrer">
                  <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gray-800/80 shadow-lg shadow-black/20 transition-all duration-300 hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-900/10 hover:-translate-y-0.5">
                    {ad.image ? (
                      <img src={ad.image} alt={ad.title || 'Advertisement'} className="w-full h-36 object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="h-36 flex items-center justify-center text-sm text-gray-500 bg-gray-800">Advertisement</div>
                    )}
                    <div className="p-4 border-t border-white/5">
                      <h3 className="text-sm font-semibold text-white">{ad.title || 'Promo'}</h3>
                      {ad.subtitle && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{ad.subtitle}</p>}
                    </div>
                  </div>
                </OptimizedLink>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-5 lg:gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-gray-800 rounded-lg p-4 sm:p-6 text-center hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => {
                  if (feature.title === 'Logistics Solutions') {
                    router.push('/logistics')
                  } else if (feature.title === 'Become Seller') {
                    toast({
                      title: "Coming Soon",
                      description: "Become Seller feature will be available soon!",
                      duration: 3000,
                    })
                  }
                }}
              >
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-500 rounded-lg flex items-center justify-center">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-300 text-xs sm:text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Floating Help Buttons */}
      <div className="fixed right-2 sm:right-4 bottom-4 flex flex-col space-y-2">
        <Button
          size="sm"
          className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500 hover:bg-orange-600 rounded-full p-0"
        >
          <Expand className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
        <Button
          size="sm"
          className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-700 hover:bg-gray-600 rounded-full p-0"
        >
          <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
      </div>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-300">
        {/* Main Footer Content */}
        <div className="px-6 pt-5 pb-8 sm:pt-6 sm:pb-10 lg:pt-7 lg:pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8">
            {/* Company Info */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-1 sm:gap-2 mb-4">
                  <Image 
                  src={displayLogo} 
                  alt={`${companyName} Logo`} 
                  width={48} 
                  height={48}
                  className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-md"
                />
                <div className="flex flex-col">
                  <span 
                    className="lg:text-lg xl:text-xl 2xl:text-2xl truncate font-bold" 
                    style={{ color: companyColor }}
                  >
                    {companyName || 'Honic Co.'}
                  </span>
                </div>
              </div>
              <p className="text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">
                Empowering innovation through comprehensive electronics solutions, prototyping services, 
                and AI-driven guidance for students, developers, and businesses worldwide.
              </p>
              
              {/* Contact Info */}
              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                  <span className="text-xs sm:text-sm">
                    {adminSettings?.contactEmail || `info@${companyName?.toLowerCase().replace(/\s+/g, '') || 'honicco'}.com`}
                  </span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                  <span className="text-xs sm:text-sm">
                    {adminSettings?.contactPhone || '+255 123 456 789'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                  <span className="text-xs sm:text-sm">
                    {adminSettings?.address || 'Dar es Salaam, Tanzania'}
                  </span>
                </div>
              </div>

              {/* Social Links */}
              <div className="flex space-x-2 sm:space-x-4">
                {socialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.href}
                    className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-colors"
                    aria-label={social.name}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Mobile: Company | Services | Support — one row, three columns */}
            <div className="col-span-1 grid w-full min-w-0 grid-cols-3 gap-x-2 gap-y-0 md:hidden">
              <div className="min-w-0">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white">Company</h3>
                <ul className="space-y-1.5">
                  {footerLinks.company.map((link, index) => (
                    <li key={index} className="min-w-0">
                      <a
                        href={link.href}
                        className="block break-words text-[11px] leading-snug text-gray-300 hover:text-orange-400 transition-colors"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white">Services</h3>
                <ul className="space-y-1.5">
                  {footerLinks.services.map((link, index) => (
                    <li key={index} className="min-w-0">
                      <a
                        href={link.href}
                        className="block break-words text-[11px] leading-snug text-gray-300 hover:text-orange-400 transition-colors"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white">Support</h3>
                <ul className="space-y-1.5">
                  {footerLinks.support.map((link, index) => (
                    <li key={index} className="min-w-0">
                      <a
                        href={link.href}
                        className="block break-words text-[11px] leading-snug text-gray-300 hover:text-orange-400 transition-colors"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Company Links — tablet/desktop */}
            <div className="hidden md:block">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-white">Company</h3>
              <ul className="space-y-1 sm:space-y-2">
                {footerLinks.company.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-xs sm:text-sm hover:text-orange-400 transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services Links — tablet/desktop */}
            <div className="hidden md:block">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-white">Services</h3>
              <ul className="space-y-1 sm:space-y-2">
                {footerLinks.services.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-xs sm:text-sm hover:text-orange-400 transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support Links — tablet/desktop */}
            <div className="hidden md:block">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-white">Support</h3>
              <ul className="space-y-1 sm:space-y-2">
                {footerLinks.support.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="text-xs sm:text-sm hover:text-orange-400 transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Newsletter Section */}
          <div className="border-t border-gray-800 mt-8 sm:mt-12 pt-6 sm:pt-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">Stay Updated</h3>
                <p className="text-xs sm:text-sm text-gray-400">
                  Subscribe to our newsletter for the latest updates, exclusive offers, and industry insights.
                </p>
              </div>
              <form
                onSubmit={handleNewsletterSubmit}
                className="flex w-full max-w-xl flex-row items-stretch gap-2 lg:max-w-none"
              >
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-10 min-w-0 flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-400 text-xs sm:text-sm"
                  required
                />
                <Button
                  type="submit"
                  className="h-auto min-h-10 shrink-0 border-0 bg-orange-500 px-4 text-white hover:bg-orange-600 text-xs sm:text-sm"
                >
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Download App Section */}
          <div className="border-t border-gray-800 mt-6 sm:mt-8 pt-6 sm:pt-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">Get Our Mobile App</h3>
                <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
                  Download our mobile app for a better shopping experience on the go.
                </p>
                <StoreDownloadLinksRow />
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  <span className="text-xs sm:text-sm">Secure Payment</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  <span className="text-xs sm:text-sm">24/7 Support</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  <span className="text-xs sm:text-sm">Free Shipping</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-gray-800">
          <div className="px-6 py-4 sm:py-6">
            <div className="flex flex-col md:flex-row items-center justify-between space-y-3 sm:space-y-4 md:space-y-0">
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs sm:text-sm">
                <span>&copy; 2024 {companyName || 'Honic Co.'}. All rights reserved.</span>
                <div className="flex flex-wrap justify-center sm:justify-start space-x-2 sm:space-x-4">
                  {footerLinks.legal.map((link, index) => (
                    <a key={index} href={link.href} className="hover:text-orange-400 transition-colors">
                      {link.name}
                    </a>
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm">
                <span>Made with Honic Company Limited in Tanzania</span>
                <div className="flex items-center space-x-2">
                  <Flag className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>TZ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
      </div>

      {/* Promotional Cart Popup */}
      <PromotionalCartPopup
        isOpen={isPromotionalCartOpen}
        onClose={() => setIsPromotionalCartOpen(false)}
        products={promotionalProducts}
      />

      {/* Mobile Hamburger Menu */}
      <div className={`hamburger-overlay ${isHamburgerMenuOpen ? 'open' : ''}`} onClick={() => setIsHamburgerMenuOpen(false)} />
      <div className={`hamburger-menu ${isHamburgerMenuOpen ? 'open' : ''}`}>
        {/* Header with Logo and Close */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
          <div className="flex items-center gap-3">
            <Image
              src={displayLogo}
              alt={`${companyName} Logo`}
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg"
            />
            <div>
              <h2 className="text-lg font-bold text-white">{companyName}</h2>
              <p className="text-xs text-white/70">Menu</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsHamburgerMenuOpen(false)}
            className="text-white hover:bg-white/20 rounded-full"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
        
        <div className="flex flex-col h-full">
          {/* Main Navigation */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Link 
                    href="/products"
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <Package className="w-6 h-6 text-white group-hover:text-yellow-400 transition-colors" />
                    <span className="text-xs font-medium text-white">Products</span>
                  </Link>
                  
                  <Link 
                    href="/cart"
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <div className="relative">
                      <ShoppingCart className="w-6 h-6 text-white group-hover:text-yellow-400 transition-colors" />
                      {cartUniqueProducts > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-black">
                          {cartUniqueProducts}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-white">Cart</span>
                  </Link>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">
                  Preferences
                </h3>
                <div className="flex flex-col gap-3">
                  <div
                    className="flex w-fit items-center rounded-lg border border-white/10 bg-black/30 p-0.5 sm:hidden"
                    role="group"
                    aria-label="Language"
                  >
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={cn(
                        'rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                        language === 'en'
                          ? 'bg-amber-500 text-gray-950'
                          : 'text-white/65 hover:text-white'
                      )}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('sw')}
                      className={cn(
                        'rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                        language === 'sw'
                          ? 'bg-amber-500 text-gray-950'
                          : 'text-white/65 hover:text-white'
                      )}
                    >
                      SW
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 md:hidden">
                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={cn(
                        'flex flex-1 min-w-[7rem] items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors',
                        currency === 'USD'
                          ? 'border-amber-400/60 bg-amber-500/15 text-white'
                          : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                      )}
                    >
                      <DollarSign className="h-4 w-4" />
                      USD
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('TZS')}
                      className={cn(
                        'flex flex-1 min-w-[7rem] items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors',
                        currency === 'TZS'
                          ? 'border-amber-400/60 bg-amber-500/15 text-white'
                          : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                      )}
                    >
                      <Landmark className="h-4 w-4" />
                      TZS
                    </button>
                  </div>
                </div>
              </div>

              {/* Account Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Account</h3>
                <div className="space-y-2">
                  {user ? (
                    <>
                      <Link 
                        href="/account"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <User className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">My Account</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/account/orders"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <Package className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">My Orders</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/account/wishlist"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <Heart className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">Wishlist</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/account/messages"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <MessageSquare className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">Messages</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/account/payment"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <CreditCard className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">Payment</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/account/coins"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <Coins className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">My Coins</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/account/coupons"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <Ticket className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">My Coupons</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/account/settings"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <Settings className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">Settings</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/contact"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <MessageSquare className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">Contact Us</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/about"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <Users className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">About Us</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/support"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <HelpCircle className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">Support</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/support/order-tracking"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <Package className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">Order Tracking</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/categories"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <Layers className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">All Categories</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-center text-white/60 text-sm mb-2">
                        Sign in to access your account
                      </div>
                      <Button 
                        className="w-full bg-yellow-500 text-black hover:bg-yellow-400 font-medium py-3 rounded-xl"
                        onClick={() => {
                          setIsHamburgerMenuOpen(false)
                          openAuthModal('login')
                        }}
                      >
                        Sign In
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-amber-400/45 bg-zinc-950/70 py-3 text-amber-50 shadow-none hover:border-amber-400/65 hover:bg-amber-500/15 hover:text-white rounded-xl"
                        onClick={() => {
                          setIsHamburgerMenuOpen(false)
                          openAuthModal('register')
                        }}
                      >
                        Create Account
                      </Button>
                      <Link 
                        href="/contact"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <MessageSquare className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">Contact Us</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/about"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <Users className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">About Us</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/support"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <HelpCircle className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">Support</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/support/order-tracking"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <Package className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">Order Tracking</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/categories"
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <Layers className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">All Categories</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer with Theme Toggle and User Info */}
          <div className="p-6 border-t border-white/10 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 space-y-4">
            {/* Theme Toggle Switch - Mobile Only */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/10">
              <div className="flex items-center gap-3">
                {backgroundColor === 'dark' ? (
                  <Moon className="w-5 h-5 text-white" />
                ) : (
                  <Sun className="w-5 h-5 text-white" />
                )}
                <span className="text-white font-medium text-sm">Theme</span>
              </div>
              <Switch
                checked={backgroundColor === 'dark'}
                onCheckedChange={(checked) => {
                  setBackgroundColor(checked ? 'dark' : 'white')
                }}
                className="data-[state=checked]:bg-yellow-500"
              />
            </div>
            
            {user && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10">
                <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
                  <span className="text-black font-bold text-sm">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">{user?.email}</p>
                  <p className="text-white/60 text-xs">Welcome back!</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
} 