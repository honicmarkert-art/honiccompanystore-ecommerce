"use client"

import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from "react"
import { createPortal } from 'react-dom'
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { logger } from '@/lib/logger'
import { BuyerRouteGuard } from '@/components/buyer-route-guard'
import { EmailVerificationBanner } from '@/components/email-verification-banner'

// Extend window object for search timeout
declare global {
  interface Window {
    searchTimeout?: NodeJS.Timeout
  }
}
import Link from "next/link"
import Image from "next/image"
import { LazyImage } from "@/components/lazy-image"
import { ImagePreloader } from "@/components/image-preloader"
import { OptimizedLink } from "@/components/optimized-link"
import { ProductCard } from "@/components/product-card"
import { VirtualizedProductGrid } from "@/components/virtualized-product-grid"
import { useOptimizedNavigation } from "@/components/optimized-link"
import { useRobustApi } from "@/hooks/use-robust-api"
import { useSimpleProducts } from "@/hooks/use-simple-products"
import { useCategoryFiltering } from "@/hooks/use-category-filtering"
import { useGridColumns } from "@/hooks/use-grid-columns"
import { useIsMobile } from "@/hooks/use-mobile"
import { InfiniteScrollTrigger } from "@/components/infinite-scroll-trigger"
// import { SearchSuggestions } from "@/components/search-suggestions" // Removed - no longer using suggestion dropdown
import { 
  ProductGridSkeleton, 
  FilterSidebarSkeleton, 
  SearchBarSkeleton 
} from "@/components/ui/skeleton"
import { 
  Search, 
  ShoppingCart, 
  User, 
  Menu,
  Palette,
  DollarSign,
  Landmark,
  Star,
  Camera,
  Truck,
  Heart,
  Eye,
  Share2,
  X,
  Phone,
  Laptop,
  Shirt,
  Dumbbell,
  Package,
  Tag,
  Building,
  ChevronDown,
  ChevronLeft,
  Check,
  TrendingUp,
  TrendingDown,
  Clock,
  Filter,
  SlidersHorizontal,
  Facebook,
  Instagram,
  Youtube,
  HelpCircle,
  RefreshCcw,
  Wallet,
  Mail,
  ChevronRight,
  MessageSquare,
  CreditCard,
  Coins,
  Ticket,
  Settings,
  MoreHorizontal,
  ArrowRight,
  Moon,
  Sun,
  UserPlus,
  Sparkles,
  Compass,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
// import { useProducts } from "@/hooks/use-products" // Removed - using useProductsOptimized instead
import { useCart } from "@/hooks/use-cart" // Import useCart hook
import { useToast } from "@/hooks/use-toast" // Import useToast hook
import { checkProductStock } from "@/utils/stock-validation"
import { getLeftBadge, getRightBadge } from "@/utils/product-badges"
import { useCompanyContext } from "@/components/company-provider"
import { Footer } from "@/components/footer"
import { useCurrency } from "@/contexts/currency-context"
import { useAuth } from "@/contexts/auth-context"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { UserProfile } from "@/components/user-profile"

// Category icons mapping - simplified

// Component for navigation links that hide on screens below 13 inches
function NavigationLinks13Inch() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const [isBelow13Inch, setIsBelow13Inch] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      // Hide on screens below 13 inches (typically < 1366px width)
      setIsBelow13Inch(
        typeof window !== 'undefined' && 
        window.innerWidth < 1366
      )
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    
    return () => {
      window.removeEventListener('resize', checkScreenSize)
    }
  }, [])

  if (isBelow13Inch) {
    return null
  }

  const handleComingSoon = (e: React.MouseEvent) => {
    e.preventDefault()
    toast({
      title: "Coming Soon",
      description: "Become Seller feature will be available soon!",
      duration: 3000,
    })
  }

  return (
    <>
      <Link href="/" className={cn(themeClasses.mainText, "hover:text-orange-400 transition-colors text-sm")}>
        AI Sourcing
      </Link>
      <Link href="/" className={cn(themeClasses.mainText, "hover:text-orange-400 transition-colors text-sm")}>
        Discovery
      </Link>
      <button 
        onClick={handleComingSoon}
        className={cn("text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-colors text-sm cursor-pointer")}
      >
        Become Seller
      </button>
    </>
  )
}

function ProductsPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const { backgroundColor, setBackgroundColor, themeClasses, darkHeaderFooterClasses } = useTheme()
  // const { products, isLoading, error, retry, preloadProducts } = useProducts() // Removed - using useProductsOptimized instead
  const { addItem, isInCart, cartUniqueProducts, getItemQuantity } = useCart() // Use useCart hook
  const { toast } = useToast() // Initialize toast
  const { companyName, companyColor, companyLogo, isLoaded: companyLoaded } = useCompanyContext()
  
  // China image format fallback - tries png, jpg, jpeg, webp
  const [chinaImageSrc, setChinaImageSrc] = useState('/china.png?v=2')
  const chinaFormats = ['/china.png?v=2', '/china.jpg?v=2', '/china.jpeg?v=2', '/china.webp?v=2']
  
  // China import modal state
  const [showChinaImportModal, setShowChinaImportModal] = useState(false)
  const [pendingCartItem, setPendingCartItem] = useState<{
    productId: number
    quantity: number
    variantId?: string
    price: number
  } | null>(null)
  
  // Fallback logo system - use local logo if API is not loaded or logo is not available
  const fallbackLogo = "/android-chrome-512x512.png"
  const displayLogo = companyLoaded && companyLogo && companyLogo !== fallbackLogo && companyLogo !== "/placeholder-logo.png" ? companyLogo : fallbackLogo
  const isUsingFallbackLogo = !companyLoaded || !companyLogo || companyLogo === fallbackLogo
  const { user, isAuthenticated } = useAuth() // Add auth context
  const { openAuthModal } = useGlobalAuthModal() // Add auth modal
  const { currency, setCurrency, formatPrice } = useCurrency() // Use global currency context
  const { navigateWithPrefetch } = useOptimizedNavigation() // Optimized navigation
  const [searchTerm, setSearchTerm] = useState("")
  const [activeBrand, setActiveBrand] = useState<string | null>(null)
  // Debounce timer for clearing search URL
  const clearSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track previous URL search value to detect changes
  const prevUrlSearchRef = useRef<string>('')
  // Categories scroll state
  const categoriesScrollRef = useRef<HTMLDivElement>(null)
  // Products section ref for scrolling
  const productsSectionRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)
  // Initialize search state from URL query ?search= on mount and when URL changes
  const urlSearchParams = useSearchParams()
  

  // On hard refresh only, clear filter query params to normalize URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    const navEntries: any = (typeof performance !== 'undefined') ? performance.getEntriesByType('navigation') : []
    const navType = navEntries && navEntries[0] ? navEntries[0].type : undefined
    const legacyNav: any = (typeof performance !== 'undefined' && (performance as any).navigation) ? (performance as any).navigation : undefined
    const isReload = navType === 'reload' || legacyNav?.type === 1
    if (!isReload) return

    const params = new URLSearchParams(window.location.search)
    const hadFilters = params.has('mainCategory') || params.has('subCategories') || params.has('search')
    if (!hadFilters) return

    params.delete('mainCategory')
    params.delete('subCategories')
    params.delete('search')
    const next = params.toString()
    // Normalize URL to /products (or keep other non-filter params)
    router.replace(next ? `/products?${next}` : '/products')
  }, [])

  useEffect(() => {
    const initial = (urlSearchParams?.get('search') || '').trim()
    // Sync input field with URL search param (only when URL changes, not when user types)
    // This ensures the input reflects the actual search query from URL
    // Cancel any pending clear timeout when URL changes (prevents race conditions)
    if (clearSearchTimeoutRef.current) {
      clearTimeout(clearSearchTimeoutRef.current)
      clearSearchTimeoutRef.current = null
    }
    
    // Check if URL search value changed
    const searchChanged = prevUrlSearchRef.current !== initial
    prevUrlSearchRef.current = initial
    
    // Only update searchTerm if URL value is different from current state
    // Don't reset while user is typing (only sync from URL to state)
    setSearchTerm(prev => {
      if (prev !== initial) {
        return initial
      }
      return prev
    })
    
    // Initialize category state from URL
    // Read again after potential cleanup above
    const urlMainCategory = urlSearchParams?.get('mainCategory') || null
    // Support both subCategory (singular) and subCategories (plural, comma-separated)
    const urlSubCategory = urlSearchParams?.get('subCategory')
    const urlSubCategoriesParam = urlSearchParams?.get('subCategories')
    const urlSubCategories = urlSubCategory 
      ? [urlSubCategory] 
      : (urlSubCategoriesParam?.split(',') || [])
    
    // Set selectedMainCategory when mainCategory is in URL
    // Note: State setters will handle deduplication, so no need to compare
    if (urlMainCategory) {
      setSelectedMainCategory(urlMainCategory)
    } else if (!urlMainCategory && urlSearchParams?.get('mainCategory') === null) {
      // Only clear if URL explicitly has no mainCategory (not just missing)
      setSelectedMainCategory(null)
    }
    
    // Set selectedSubCategories when subCategories are in URL
    if (urlSubCategories.length > 0) {
      setSelectedSubCategories(urlSubCategories)
    } else if (urlSubCategories.length === 0 && !urlSubCategory && !urlSubCategoriesParam) {
      // Only clear if URL explicitly has no subCategories
      setSelectedSubCategories([])
    }
    
    // Scroll to products section when search param is set (and changed)
    if (initial && initial.length >= 3 && searchChanged) {
      setTimeout(() => {
        if (productsSectionRef.current) {
          productsSectionRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          })
        }
      }, 300) // Slightly longer delay to ensure products are loaded
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearchParams])

  // Submit search (updates URL and triggers server-side filtering)
  // Minimum 3 characters required
  const submitSearch = useCallback(() => {
    const query = (searchTerm || '').trim()
    const params = new URLSearchParams(urlSearchParams?.toString() || '')
    if (query && query.length >= 3) {
      params.set('search', query)
    } else {
      params.delete('search')
    }
    params.delete('returnTo')
    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
    
    // Close keyboard on mobile by blurring the input
    if (typeof window !== 'undefined') {
      const activeElement = document.activeElement as HTMLElement
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        activeElement.blur()
      }
    }
    
    // Use replace instead of push to avoid adding to history stack
    // This prevents full page refresh and maintains client-side routing
    // scroll: false prevents automatic scroll to top
    router.replace(nextUrl, { scroll: false })
    
    // Only scroll to products section if user is currently scrolled above it
    // This preserves scroll position if user is already viewing products
    setTimeout(() => {
      if (productsSectionRef.current && typeof window !== 'undefined') {
        const productsSectionTop = productsSectionRef.current.getBoundingClientRect().top + window.scrollY
        const currentScrollY = window.scrollY
        
        // Only scroll if products section is below current viewport or user is near top
        if (currentScrollY < productsSectionTop - 200 || currentScrollY < 200) {
          productsSectionRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          })
        }
        // Otherwise, preserve current scroll position
      }
    }, 100)
  }, [router, urlSearchParams, searchTerm])

  // Removed useRobustProducts hook - was causing duplicate API calls!
  // Filter functions are now implemented locally below
  
  // Categories state using robust API
  const { data: categories, isLoading: categoriesLoading, error: categoriesError } = useRobustApi<any[]>({
    endpoint: '/api/categories',
    retryDelay: 1000,
    maxRetries: 3,
    rateLimitCooldown: 60000
  })

  // Fallback categories in case API fails
  const fallbackMainCategories = [
    { id: 'diy-electronic-components', name: 'DIY Electronic Components', slug: 'diy-electronic-components', image_url: null, is_main: true },
    { id: 'home-electronic-devices', name: 'Home Electronic Devices', slug: 'home-electronic-devices', image_url: null, is_main: true },
    { id: 'home-office-furnitures', name: 'Home & Office furnitures', slug: 'home-office-furnitures', image_url: null, is_main: true },
    { id: 'training-kits-school-items', name: 'Training kits & School Items', slug: 'training-kits-school-items', image_url: null, is_main: true },
    { id: 'phones-telecom-devices', name: 'Phones & Telecom Devices', slug: 'phones-telecom-devices', image_url: null, is_main: true },
    { id: 'fashion-jewelry', name: 'Fashion and Jewelry', slug: 'fashion-jewelry', image_url: null, is_main: true },
    { id: 'computer-accessories', name: 'Computer & Accessories', slug: 'computer-accessories', image_url: null, is_main: true },
    { id: 'automotive-parts', name: 'Automotive Parts', slug: 'automotive-parts', image_url: null, is_main: true },
    { id: 'sports-outdoors', name: 'Sports & Outdoors', slug: 'sports-outdoors', image_url: null, is_main: true },
    { id: 'beauty-health', name: 'Beauty & Health', slug: 'beauty-health', image_url: null, is_main: true },
    { id: 'toys-games', name: 'Toys & Games', slug: 'toys-games', image_url: null, is_main: true },
    { id: 'home-appliances', name: 'Home Appliances', slug: 'home-appliances', image_url: null, is_main: true },
  ]

  // Process categories data
  const categoriesData = useMemo(() => {
    // Handle different response formats
    let categoriesArray: any[] = []
    if (categories && !categoriesError) {
    if (Array.isArray(categories)) {
      categoriesArray = categories
    } else if (categories && typeof categories === 'object' && 'categories' in categories && Array.isArray((categories as any).categories)) {
      categoriesArray = (categories as any).categories
    } else if (categories && typeof categories === 'object' && 'success' in categories && Array.isArray((categories as any).categories)) {
      // Handle API response format: { success: true, categories: [...] }
      categoriesArray = (categories as any).categories
      }
    }

    // Use fallback if API failed or returned empty
    if (categoriesError || !categoriesArray || categoriesArray.length === 0) {
      return {
        mainCategories: fallbackMainCategories,
        subCategories: [],
        allCategories: fallbackMainCategories
      }
    }

    const allCategories = categoriesArray.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      image_url: cat.image_url || null,
      parent_id: cat.parent_id,
      parent_name: cat.parent?.name,
      is_main: !cat.parent_id,
      is_sub: !!cat.parent_id,
      product_count: cat.product_count || 0,
      display_order: cat.display_order ?? 999 // Preserve display_order, default to 999 if missing
    }))

    // Sort by display_order to maintain admin-set order
    const sortedCategories = [...allCategories].sort((a, b) => {
      // Ensure display_order is treated as a number
      const orderA = Number(a.display_order) ?? 999
      const orderB = Number(b.display_order) ?? 999
      if (orderA !== orderB) {
        return orderA - orderB
      }
      // If display_order is the same, sort by name
      return (a.name || '').localeCompare(b.name || '')
    })

    const mainCategories = sortedCategories.filter(cat => cat.is_main)
    const subCategories = sortedCategories.filter(cat => cat.is_sub)

    // If no main categories found, use fallback
    if (mainCategories.length === 0) {
      return {
        mainCategories: fallbackMainCategories,
        subCategories: subCategories,
        allCategories: [...fallbackMainCategories, ...subCategories]
      }
    }

    return { mainCategories, subCategories, allCategories }
  }, [categories, categoriesLoading, categoriesError])

  // Check scroll position for categories arrows
  useEffect(() => {
    const checkScrollPosition = () => {
      if (categoriesScrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = categoriesScrollRef.current
        setShowLeftArrow(scrollLeft > 0)
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
      }
    }

    // Check on mount and after categories load
    if (categoriesData.mainCategories.length > 0) {
      setTimeout(checkScrollPosition, 100) // Small delay to ensure DOM is ready
    }

    window.addEventListener('resize', checkScrollPosition)
    return () => window.removeEventListener('resize', checkScrollPosition)
  }, [categoriesData.mainCategories.length])






  // --- Infinite Scroll States ---
  // Removed productsToShow - useInfiniteProducts handles pagination now
  const loadingRef = useRef<HTMLDivElement>(null)
  
  // Hamburger menu state
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false)



  // Advertisements state
  const [advertisements, setAdvertisements] = useState<any[]>([])
  const [adsLoading, setAdsLoading] = useState(true)
  const [currentAdIndex, setCurrentAdIndex] = useState(0)
  const [adRotationTime, setAdRotationTime] = useState(10)
  
  // Rotating promotional text with animation types and unique transition animations
  const promotionalTexts = [
    { text: "More To Love", animation: "bounce", decoration: "heart", transition: "slideInLeft" },
    { text: "Mega Choice For You Up To 40% Off", animation: "pulse", decoration: "badge", transition: "zoomIn" },
    { text: "What Are You Waiting For", animation: "slide", decoration: "arrow", transition: "slideInRight" },
    { text: "Flash Sale: 50% Off", animation: "flash", decoration: "lightning", transition: "fadeIn" },
    { text: "Free Shipping Today", animation: "slideLeftRight", decoration: "truck", transition: "slideInUp" },
    { text: "New Arrivals", animation: "fade", decoration: "star", transition: "rotateIn" },
    { text: "Buy More, Save More", animation: "scale", decoration: "tag", transition: "flipInX" },
    { text: "Weekend Special: 25% Off", animation: "wiggle", decoration: "gift", transition: "bounceIn" },
    { text: "Best Prices", animation: "glow", decoration: "check", transition: "fadeInScale" },
    { text: "Exclusive: 30% Off", animation: "shimmer", decoration: "crown", transition: "slideInDown" }
  ]
  
  // Shuffle promotional texts order for random rotation
  const shuffledPromoOrder = useMemo(() => {
    const order = Array.from({ length: promotionalTexts.length }, (_, i) => i)
    // Fisher-Yates shuffle algorithm
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]]
    }
    return order
  }, []) // Only shuffle once on mount
  
  // Animation classes mapping
  const getAnimationClass = (animation: string) => {
    const animations: Record<string, string> = {
      bounce: "animate-bounce",
      pulse: "animate-pulse",
      slide: "animate-[slide_1s_ease-in-out_infinite]",
      flash: "animate-[flash_1.5s_ease-in-out_infinite]",
      float: "animate-[float_3s_ease-in-out_infinite]",
      fade: "animate-[fade_2s_ease-in-out_infinite]",
      scale: "animate-[scale_1.5s_ease-in-out_infinite]",
      wiggle: "animate-[wiggle_1s_ease-in-out_infinite]",
      glow: "animate-[glow_2s_ease-in-out_infinite]",
      shimmer: "relative overflow-hidden bg-gradient-to-r from-blue-400 via-blue-200 to-blue-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer-text-blue_2s_linear_infinite]",
      slideLeftRight: "animate-[slideLeftRight_25s_ease-in-out_infinite]"
    }
    return animations[animation] || ""
  }
  
  // Transition animation classes mapping for text switching
  const getTransitionClass = (transition: string, isFading: boolean) => {
    if (isFading) {
      // Exit animations
      const exitAnimations: Record<string, string> = {
        slideInLeft: "animate-[slideOutLeft_0.4s_ease-in-out_forwards]",
        zoomIn: "animate-[zoomOut_0.4s_ease-in-out_forwards]",
        slideInRight: "animate-[slideOutRight_0.4s_ease-in-out_forwards]",
        fadeIn: "animate-[fadeOut_0.4s_ease-in-out_forwards]",
        slideInUp: "animate-[slideOutUp_0.4s_ease-in-out_forwards]",
        rotateIn: "animate-[rotateOut_0.4s_ease-in-out_forwards]",
        flipInX: "animate-[flipOutX_0.4s_ease-in-out_forwards]",
        bounceIn: "animate-[bounceOut_0.4s_ease-in-out_forwards]",
        fadeInScale: "animate-[fadeOutScale_0.4s_ease-in-out_forwards]",
        slideInDown: "animate-[slideOutDown_0.4s_ease-in-out_forwards]"
      }
      return exitAnimations[transition] || "animate-[fadeOut_0.4s_ease-in-out_forwards]"
    } else {
      // Enter animations
      const enterAnimations: Record<string, string> = {
        slideInLeft: "animate-[slideInLeft_0.4s_ease-in-out_forwards]",
        zoomIn: "animate-[zoomIn_0.4s_ease-in-out_forwards]",
        slideInRight: "animate-[slideInRight_0.4s_ease-in-out_forwards]",
        fadeIn: "animate-[fadeIn_0.4s_ease-in-out_forwards]",
        slideInUp: "animate-[slideInUp_0.4s_ease-in-out_forwards]",
        rotateIn: "animate-[rotateIn_0.4s_ease-in-out_forwards]",
        flipInX: "animate-[flipInX_0.4s_ease-in-out_forwards]",
        bounceIn: "animate-[bounceIn_0.4s_ease-in-out_forwards]",
        fadeInScale: "animate-[fadeInScale_0.4s_ease-in-out_forwards]",
        slideInDown: "animate-[slideInDown_0.4s_ease-in-out_forwards]"
      }
      return enterAnimations[transition] || "animate-[fadeIn_0.4s_ease-in-out_forwards]"
    }
  }
  
  // Decoration component
  const getDecoration = (decoration: string): React.ReactElement | null => {
    const decorations: Record<string, React.ReactElement> = {
      heart: <span className="text-red-500 animate-pulse">❤️</span>,
      badge: <span className="inline-block bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs sm:text-sm font-bold animate-pulse">OFFER</span>,
      arrow: <span className="text-green-500 animate-bounce">→</span>,
      lightning: <span className="text-yellow-500 animate-[flash_1s_ease-in-out_infinite]">⚡</span>,
      truck: <span className="text-blue-500 animate-[float_2s_ease-in-out_infinite]">🚚</span>,
      star: <span className="text-yellow-400 animate-spin">⭐</span>,
      tag: <span className="text-red-500 animate-[scale_1.5s_ease-in-out_infinite]">🏷️</span>,
      gift: <span className="text-purple-500 animate-[wiggle_1s_ease-in-out_infinite]">🎁</span>,
      check: <span className="text-green-500 animate-pulse">✓</span>,
      crown: <span className="text-blue-500 animate-[shimmer-blue_2s_ease-in-out_infinite]">👑</span>
    }
    return decorations[decoration] || null
  }
  
  // Random starting index in shuffled order
  const [currentPromoIndex, setCurrentPromoIndex] = useState(() => 
    Math.floor(Math.random() * promotionalTexts.length)
  )
  const [isFading, setIsFading] = useState(false)
  
  // Touch swipe state for advertisements
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  

  // Auto-scroll after page load
  useEffect(() => {
    const autoScrollTimer = setTimeout(() => {
      // Responsive scroll distance: 390px on desktop, 350px on mobile
      const isMobile = window.innerWidth < 768
      const scrollDistance = isMobile ? 350 : 390
      
      window.scrollBy({
        top: scrollDistance,
        behavior: 'smooth'
      })
    }, 10000) // Wait 10 seconds

    // Cleanup timer on unmount
    return () => clearTimeout(autoScrollTimer)
  }, [])

  // Filter state
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000])
  const [isPriceFilterOpen, setIsPriceFilterOpen] = useState(false)
  const [isCategoryNavOpen, setIsCategoryNavOpen] = useState(false)
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null)
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([])
  
  // State preservation key for this page
  const PAGE_STATE_KEY = 'products_page_state'
  
  // Save page state before navigation (moved here after state declarations)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const savePageState = () => {
      try {
        const state = {
          searchTerm,
          selectedMainCategory,
          selectedSubCategories,
          activeBrand,
          timestamp: Date.now()
        }
        sessionStorage.setItem(PAGE_STATE_KEY, JSON.stringify(state))
      } catch (e) {
        // Ignore storage errors
      }
    }

    // Save state periodically and before navigation
    const saveInterval = setInterval(savePageState, 2000) // Save every 2 seconds
    
    // Save on visibility change (when navigating away)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        savePageState()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Save on beforeunload
    window.addEventListener('beforeunload', savePageState)

    return () => {
      clearInterval(saveInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', savePageState)
    }
  }, [searchTerm, selectedMainCategory, selectedSubCategories, activeBrand, PAGE_STATE_KEY])

  // Restore page state on mount (only if URL doesn't have params)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Only restore if URL doesn't have search/category params (user is returning from detail page)
    const hasUrlParams = urlSearchParams?.get('search') || 
                         urlSearchParams?.get('mainCategory') || 
                         urlSearchParams?.get('subCategories') ||
                         urlSearchParams?.get('subCategory')
    
    if (!hasUrlParams) {
      try {
        const savedState = sessionStorage.getItem(PAGE_STATE_KEY)
        if (savedState) {
          const state = JSON.parse(savedState)
          // Only restore if state is recent (within 30 minutes)
          if (state.timestamp && Date.now() - state.timestamp < 30 * 60 * 1000) {
            if (state.searchTerm) {
              setSearchTerm(state.searchTerm)
            }
            if (state.selectedMainCategory) {
              setSelectedMainCategory(state.selectedMainCategory)
            }
            if (state.selectedSubCategories && Array.isArray(state.selectedSubCategories)) {
              setSelectedSubCategories(state.selectedSubCategories)
            }
            if (state.activeBrand !== undefined) {
              setActiveBrand(state.activeBrand)
            }
          }
        }
      } catch (e) {
        // Ignore storage errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount
  
  const [isCategoryMegaMenuOpen, setIsCategoryMegaMenuOpen] = useState(false)
  const [hoveredMegaCategory, setHoveredMegaCategory] = useState<string | null>(null)
  const categoryMegaMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const categoryMegaMenuRef = useRef<HTMLDivElement>(null)
  const [showMoreCategories, setShowMoreCategories] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const moreButtonRef = useRef<HTMLDivElement>(null)
  
  // Dynamic overflow categories state
  const [visibleCategories, setVisibleCategories] = useState<any[]>([])
  const [overflowCategories, setOverflowCategories] = useState<any[]>([])
  const mobileCategoriesContainerRef = useRef<HTMLDivElement>(null)
  const categoryItemRefs = useRef<Map<number, HTMLAnchorElement>>(new Map())
  
  // Desktop navigation overflow state
  const [desktopVisibleCategories, setDesktopVisibleCategories] = useState<any[]>([])
  const [desktopOverflowCategories, setDesktopOverflowCategories] = useState<any[]>([])
  const [showDesktopMoreCategories, setShowDesktopMoreCategories] = useState(false)
  const [desktopDropdownPosition, setDesktopDropdownPosition] = useState({ top: 0, left: 0 })
  const desktopMoreButtonRef = useRef<HTMLDivElement>(null)
  const desktopCategoriesContainerRef = useRef<HTMLDivElement>(null)
  const openCategoryMegaMenu = useCallback(() => {
    // Clear any existing timeout first
    if (categoryMegaMenuTimeoutRef.current) {
      clearTimeout(categoryMegaMenuTimeoutRef.current)
      categoryMegaMenuTimeoutRef.current = null
    }
    // Only open if cursor stays hovered for 1.2 seconds (1200ms)
    // Timer will be cleared if cursor leaves before 1.2 seconds
    categoryMegaMenuTimeoutRef.current = setTimeout(() => {
      if (!isCategoryMegaMenuOpen) {
        setIsCategoryMegaMenuOpen(true)
      }
      categoryMegaMenuTimeoutRef.current = null
    }, 1200) // 1.2 seconds delay
  }, [isCategoryMegaMenuOpen])

  const closeCategoryMegaMenu = useCallback(() => {
    // Immediately clear the open timeout when cursor leaves
    // This prevents the menu from opening if cursor left before 1.2 seconds
    if (categoryMegaMenuTimeoutRef.current) {
      clearTimeout(categoryMegaMenuTimeoutRef.current)
      categoryMegaMenuTimeoutRef.current = null
    }
    // Small delay before closing to allow moving cursor to menu
    setTimeout(() => {
      setIsCategoryMegaMenuOpen(false)
    }, 120)
  }, [])

  useEffect(() => {
    return () => {
      if (categoryMegaMenuTimeoutRef.current) {
        clearTimeout(categoryMegaMenuTimeoutRef.current)
      }
    }
  }, [])

  // Close mega menu when clicking outside
  useEffect(() => {
    if (!isCategoryMegaMenuOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryMegaMenuRef.current &&
        !categoryMegaMenuRef.current.contains(event.target as Node) &&
        // Don't close if clicking on category navigation items
        !(event.target as HTMLElement).closest('[data-category-nav]')
      ) {
        setIsCategoryMegaMenuOpen(false)
      }
    }

    // Add event listener with a small delay to avoid closing immediately when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isCategoryMegaMenuOpen])

  const hoveredMegaCategoryData = useMemo(() => {
    if (!hoveredMegaCategory) return null
    return categoriesData.mainCategories.find((cat: any) => cat.slug === hoveredMegaCategory) || null
  }, [hoveredMegaCategory, categoriesData.mainCategories])

  const megaMenuSubCategories = useMemo(() => {
    if (!hoveredMegaCategoryData) return []
    return categoriesData.subCategories.filter((sub: any) => sub.parent_id === hoveredMegaCategoryData.id)
  }, [hoveredMegaCategoryData, categoriesData.subCategories])

  const chunkedMegaMenuSubCategories = useMemo(() => {
    const chunkSize = 6
    const chunks = []
    for (let i = 0; i < megaMenuSubCategories.length; i += chunkSize) {
      chunks.push(megaMenuSubCategories.slice(i, i + chunkSize))
    }
    return chunks
  }, [megaMenuSubCategories])

  const recommendedMegaMenuSubCategories = useMemo(() => megaMenuSubCategories.slice(0, 12), [megaMenuSubCategories])

  useEffect(() => {
    if (!hoveredMegaCategory && categoriesData.mainCategories.length > 0) {
      setHoveredMegaCategory(categoriesData.mainCategories[0]?.slug || null)
    }
  }, [categoriesData.mainCategories, hoveredMegaCategory])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMoreCategories) {
        const target = event.target as Element
        if (
          !target.closest('.more-categories-dropdown') &&
          !target.closest('.more-categories-portal')
        ) {
          setShowMoreCategories(false)
        }
      }
      
      if (showDesktopMoreCategories) {
        const target = event.target as Element
        if (
          !target.closest('.desktop-more-categories-dropdown') &&
          !target.closest('.desktop-more-categories-portal')
        ) {
          setShowDesktopMoreCategories(false)
        }
      }
    }

    const handleResize = () => {
      if (showMoreCategories && moreButtonRef.current) {
        const rect = moreButtonRef.current.getBoundingClientRect()
        
        setDropdownPosition({
          top: rect.bottom + 8,
          left: rect.left
        })
      }
      
      if (showDesktopMoreCategories && desktopMoreButtonRef.current) {
        const rect = desktopMoreButtonRef.current.getBoundingClientRect()
        
        setDesktopDropdownPosition({
          top: rect.bottom + 8,
          left: rect.left
        })
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('resize', handleResize)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('resize', handleResize)
    }
  }, [showMoreCategories, showDesktopMoreCategories])
  
  // Show only first 6 categories (mobile)
  useEffect(() => {
    if (categoriesData.mainCategories.length === 0) {
      return
    }
    
    // Simply show first 6 categories
    const first6Categories = categoriesData.mainCategories.slice(0, 6)
    setVisibleCategories(first6Categories)
    setOverflowCategories([])
  }, [categoriesData.mainCategories])

  // Show maximum 4 categories for screens below 13 inches, 6 for 13 inches and above
  useEffect(() => {
    if (categoriesData.mainCategories.length === 0) {
      return
    }
    
    const updateCategories = () => {
      // Detect screens below 13 inches (typically < 1366px width)
      const isBelow13Inch = typeof window !== 'undefined' && 
        window.innerWidth < 1366
      
      // Use 4 categories for screens below 13 inches, 6 for 13 inches and above
      const maxCategories = isBelow13Inch ? 4 : 6
      const visibleCategories = categoriesData.mainCategories.slice(0, maxCategories)
      setDesktopVisibleCategories(visibleCategories)
      setDesktopOverflowCategories([])
    }
    
    // Update on mount and when categories change
    updateCategories()
    
    // Update on window resize
    window.addEventListener('resize', updateCategories)
    
    return () => {
      window.removeEventListener('resize', updateCategories)
    }
  }, [categoriesData.mainCategories])
  
  const [sortOrder, setSortOrder] = useState('price-low')

  // Pagination state - URL-based page number
  const [currentPage, setCurrentPage] = useState(1)
  // Simple Products System - Amazon/AliExpress Style
  // 150 products per page with CDN caching
  const PRODUCTS_PER_PAGE = 150 // 150 products per page

  // Convert category slugs to IDs for API filtering
  const { mainCategoryId, subCategoryIds, allCategoryIds } = useCategoryFiltering({
    selectedMainCategory,
    selectedSubCategories,
    categoriesData
  })

  const isCategoryFilterActive = !!selectedMainCategory || selectedSubCategories.length > 0
  const noCategoryMatches = isCategoryFilterActive && allCategoryIds.length === 0

  // Build dynamic no-results reason and details
  const selectedMainName = useMemo(() => {
    if (!selectedMainCategory) return null
    const m = categoriesData.mainCategories.find(c => c.slug === selectedMainCategory)
    return m?.name || selectedMainCategory
  }, [selectedMainCategory, categoriesData.mainCategories])

  const selectedSubNames = useMemo(() => {
    if (!selectedSubCategories?.length) return [] as string[]
    const map = new Map(categoriesData.subCategories.map(s => [s.slug, s.name]))
    return selectedSubCategories.map(s => map.get(s) || s)
  }, [selectedSubCategories, categoriesData.subCategories])

  // Get actual search query from URL (not from input state) to prevent live search
  const actualSearchQuery = (urlSearchParams?.get('search') || '').trim()

  const noResultsReason = useMemo(() => {
    if (actualSearchQuery) return 'search'
    if (selectedSubCategories.length > 0) return 'sub category'
    if (selectedMainCategory) return 'category'
    if (activeBrand) return 'brand'
    if (priceRange[0] > 0 || priceRange[1] < 100000) return 'price range'
    return 'filters'
  }, [actualSearchQuery, selectedSubCategories.length, selectedMainCategory, activeBrand, priceRange])




  // Simple Products Hook - 200 products per page with CDN caching
  const {
    products: primaryProducts,
    loading: primaryLoading,
    loadingMore: primaryLoadingMore,
    hasMore: primaryHasMore,
    error: primaryError,
    totalCount: primaryTotalCount,
    loadMore: primaryLoadMore,
    reset: primaryReset,
    refresh: primaryRefresh
  } = useSimpleProducts({
    limit: PRODUCTS_PER_PAGE,
    brand: activeBrand || undefined,
    search: actualSearchQuery || undefined,
    // Only use category IDs if categories are loaded AND filter is active
    // Otherwise, load products immediately without waiting for categories
    categories: (isCategoryFilterActive && allCategoryIds.length > 0) ? allCategoryIds : undefined,
    sortBy: sortOrder === 'featured' ? 'featured' : sortOrder === 'price-low' ? 'price' : sortOrder === 'price-high' ? 'price' : 'created_at',
    sortOrder: sortOrder === 'featured' ? 'desc' : sortOrder === 'price-high' ? 'desc' : 'asc',
    minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
    maxPrice: priceRange[1] < 100000 ? priceRange[1] : undefined,
    enabled: true
  })
  
  // Get page from URL on mount and when URL changes
  useEffect(() => {
    const page = parseInt(urlSearchParams?.get('page') || '1')
    if (page > 0 && page !== currentPage) {
      setCurrentPage(page)
      // Reset displayedCount when page changes (pagination handles display)
      setDisplayedCount(PRODUCTS_PER_PAGE)
    }
  }, [urlSearchParams, currentPage, PRODUCTS_PER_PAGE])

  // Infinite scroll products hook for enhanced performance

  // Simple clearFilters function
  const clearFilters = useCallback(() => {
    // Reset all filter states
    setPriceRange([0, 100000])
    setActiveBrand(null)
    setSearchTerm("")
    setSortOrder('price-low')
    // Reset products - the hook will automatically refetch due to dependency changes
    primaryReset()
  }, [primaryReset])

  // Preload products for better performance
  // useEffect(() => {
  //   preloadProducts()
  // }, [preloadProducts]) // Removed - using useProductsOptimized instead


  
  // Categories are now fetched using useRobustApi hook above

  // Fetch advertisements and rotation time with caching
  useEffect(() => {
    const fetchAds = async () => {
      try {
        setAdsLoading(true)
        
        // Check cache for advertisements (placement-specific)
        const cachedAds = localStorage.getItem('ads_cache_home')
        const cachedRotation = localStorage.getItem('ads_rotation_cache_home')
        const cacheTimestamp = localStorage.getItem('ads_cache_timestamp_home')
        const now = Date.now()
        const cacheAge = cacheTimestamp ? now - parseInt(cacheTimestamp) : Infinity
        
        
        // Use cache if it's less than 2 minutes old
        if (cachedAds && cachedRotation && cacheAge < 2 * 60 * 1000) {
          const cachedData = JSON.parse(cachedAds)
          // Filter out China page ads from cache
          const filteredCached = (cachedData || []).filter((ad: any) => ad.placement !== 'china')
          setAdvertisements(filteredCached)
          setAdRotationTime(parseInt(cachedRotation))
          setAdsLoading(false)
          return
        }
        
        // Add delay to prevent simultaneous API calls
        await new Promise(resolve => setTimeout(resolve, 200))
        
        const cacheBust = typeof window !== 'undefined' ? (localStorage.getItem('settings_cache_bust') || Date.now()) : Date.now()
        
        const [adsResponse, rotationResponse] = await Promise.all([
          fetch(`/api/advertisements?placement=home&cb=${cacheBust}`, { cache: 'no-store' }),
          fetch(`/api/advertisements/rotation-time?cb=${cacheBust}`, { cache: 'no-store' })
        ])
        
        if (adsResponse.ok) {
          const data = await adsResponse.json()
          // Filter out China page ads
          const filteredData = (data || []).filter((ad: any) => ad.placement !== 'china')
          // If no ads with placement=home, try fetching without placement filter as fallback
          if (filteredData && filteredData.length > 0) {
            setAdvertisements(filteredData)
            localStorage.setItem('ads_cache_home', JSON.stringify(filteredData))
          } else {
            // Fallback: fetch all active ads (excluding china)
            const fallbackResponse = await fetch(`/api/advertisements?cb=${cacheBust}`, { cache: 'no-store' })
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json()
              // Filter out China page ads from fallback
              const filteredFallback = (fallbackData || []).filter((ad: any) => ad.placement !== 'china')
              setAdvertisements(filteredFallback)
              localStorage.setItem('ads_cache_home', JSON.stringify(filteredFallback))
            } else {
              setAdvertisements([])
            }
          }
        } else if (adsResponse.status === 429) {
          if (cachedAds) {
            const cachedData = JSON.parse(cachedAds)
            // Filter out China page ads from cache
            const filteredCached = (cachedData || []).filter((ad: any) => ad.placement !== 'china')
            setAdvertisements(filteredCached)
          }
          }
          
        if (rotationResponse.ok) {
          const rotationData = await rotationResponse.json()
          setAdRotationTime(rotationData.rotationTime || 10)
          localStorage.setItem('ads_rotation_cache_home', (rotationData.rotationTime || 10).toString())
        } else if (rotationResponse.status === 429) {
          if (cachedRotation) {
            setAdRotationTime(parseInt(cachedRotation))
          }
          }
        
        // Update cache timestamp
        localStorage.setItem('ads_cache_timestamp_home', now.toString())
        
      } catch (error) {
      } finally {
        setAdsLoading(false)
      }
    }
    fetchAds()
  }, [])

  // Rotate advertisements based on admin-configured time
  useEffect(() => {
    if (advertisements.length <= 1) return // No need to rotate if only one ad
    
    const interval = setInterval(() => {
      setCurrentAdIndex((prevIndex: number) => (prevIndex + 1) % advertisements.length)
    }, adRotationTime * 1000) // Convert seconds to milliseconds
    
    return () => clearInterval(interval)
  }, [advertisements.length, adRotationTime])

  // Reset currentAdIndex when advertisements change or become empty
  useEffect(() => {
    if (advertisements.length === 0) {
      setCurrentAdIndex(0)
    } else if (currentAdIndex >= advertisements.length) {
      setCurrentAdIndex(0)
    }
  }, [advertisements.length, currentAdIndex])

  // Rotate promotional text with unique transition animations (using shuffled order)
  const [transitionType, setTransitionType] = useState<string>("fadeIn")
  useEffect(() => {
    // Get current text to determine rotation interval
    const currentTextIndex = shuffledPromoOrder[currentPromoIndex]
    const currentPromoItem = promotionalTexts[currentTextIndex]
    const isFreeShipping = currentPromoItem.text === "Free Shipping Today"
    
    // Free Shipping needs 25 seconds to complete scroll animation, others use 3 seconds
    const rotationInterval = isFreeShipping ? 25000 : 3000
    
    const interval = setInterval(() => {
      // Get the next text index
      const nextIndex = (currentPromoIndex + 1) % shuffledPromoOrder.length
      const nextTextIndex = shuffledPromoOrder[nextIndex]
      const nextPromoItem = promotionalTexts[nextTextIndex]
      
      // Set transition type for the next text
      setTransitionType(nextPromoItem.transition || "fadeIn")
      
      // Start exit animation
      setIsFading(true)
      
      setTimeout(() => {
        // Change to next text
        setCurrentPromoIndex(nextIndex)
        // Start enter animation
        setIsFading(false)
      }, 400) // Transition duration
    }, rotationInterval)
    
    return () => clearInterval(interval)
  }, [currentPromoIndex, shuffledPromoOrder.length])


  // Touch swipe handlers for advertisements
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe && advertisements.length > 1) {
      // Swipe left - next ad
      setCurrentAdIndex((prev: number) => (prev + 1) % advertisements.length)
    }
    if (isRightSwipe && advertisements.length > 1) {
      // Swipe right - previous ad
      setCurrentAdIndex((prev: number) => prev === 0 ? advertisements.length - 1 : prev - 1)
    }
  }

  // getMinimumPrice moved to ProductCard component for better performance

  // Batch display: Show products in batches as user scrolls
  // Responsive: 100 products on mobile, 30 on desktop
  const isMobile = useIsMobile()
  const PRODUCTS_BATCH_SIZE = useMemo(() => isMobile ? 100 : 30, [isMobile])
  
  // Preserve displayedCount across navigation using sessionStorage
  const getInitialDisplayedCount = useCallback(() => {
    if (typeof window === 'undefined') return PRODUCTS_BATCH_SIZE
    try {
      const saved = sessionStorage.getItem('products_displayed_count')
      if (saved) {
        const count = parseInt(saved, 10)
        // Only restore if it's a valid number and filters haven't changed
        const savedFilters = sessionStorage.getItem('products_filters')
        const currentFilters = JSON.stringify({
          search: actualSearchQuery,
          mainCategory: selectedMainCategory,
          subCategories: selectedSubCategories,
          brand: activeBrand,
          priceRange
        })
        if (savedFilters === currentFilters && count >= PRODUCTS_BATCH_SIZE) {
          return count
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
    return PRODUCTS_BATCH_SIZE
  }, [actualSearchQuery, selectedMainCategory, selectedSubCategories, activeBrand, priceRange, PRODUCTS_BATCH_SIZE])
  
  const [displayedCount, setDisplayedCount] = useState(getInitialDisplayedCount)
  
  // Update displayedCount when batch size changes (mobile/desktop switch)
  useEffect(() => {
    // If current displayed count is less than new batch size, update to batch size
    if (displayedCount < PRODUCTS_BATCH_SIZE) {
      setDisplayedCount(PRODUCTS_BATCH_SIZE)
    }
  }, [PRODUCTS_BATCH_SIZE])
  
  // Save displayedCount and scroll position to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem('products_displayed_count', displayedCount.toString())
      // Also save current scroll position
      sessionStorage.setItem('products_scroll_position', window.scrollY.toString())
      sessionStorage.setItem('products_filters', JSON.stringify({
        search: actualSearchQuery,
        mainCategory: selectedMainCategory,
        subCategories: selectedSubCategories,
        brand: activeBrand,
        priceRange
      }))
    } catch (e) {
      // Ignore storage errors
    }
  }, [displayedCount, actualSearchQuery, selectedMainCategory, selectedSubCategories, activeBrand, priceRange])
  
  // Reset displayed count when filters change (new search/filter)
  useEffect(() => {
    // Only reset if filters actually changed (not on initial mount)
    const hasFilters = actualSearchQuery || selectedMainCategory || selectedSubCategories.length > 0 || activeBrand || priceRange[0] > 0 || priceRange[1] < 100000
    if (hasFilters) {
      setDisplayedCount(PRODUCTS_BATCH_SIZE)
    }
  }, [actualSearchQuery, selectedMainCategory, selectedSubCategories, activeBrand, priceRange, PRODUCTS_BATCH_SIZE])
  
  // Simple display: Use products directly from hook, but limit to displayedCount
  const allFilteredProducts = useMemo(() => {
    if (primaryProducts.length === 0) return []
    
    // Prevent duplicates (out-of-stock products are now shown with badge)
    const seen = new Set<number>()
    return primaryProducts.filter((product: any) => {
      if (!product || typeof product.id !== 'number' || product.id <= 0) return false
      if (seen.has(product.id)) return false
      seen.add(product.id)
      return true
    })
  }, [primaryProducts])
  
  // Display products for current page (150 products per page)
  const displayedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE
    const endIndex = startIndex + PRODUCTS_PER_PAGE
    return allFilteredProducts.slice(startIndex, endIndex)
  }, [allFilteredProducts, currentPage, PRODUCTS_PER_PAGE])
  
  // Restore scroll position when navigating back from product detail page
  const hasRestoredScrollRef = useRef(false)
  
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hasRestoredScrollRef.current) return // Only restore once per navigation
    
    // Check if we're returning from a product detail page or cart page
    const isReturningFromDetail = sessionStorage.getItem('navigated_from_product_detail') === 'true'
    const isReturningFromCart = sessionStorage.getItem('navigated_from_cart') === 'true'
    const isReturning = isReturningFromDetail || isReturningFromCart
    
    if (isReturning) {
      // Clear the flags immediately to prevent multiple restorations
      if (isReturningFromDetail) {
        sessionStorage.removeItem('navigated_from_product_detail')
      }
      if (isReturningFromCart) {
        sessionStorage.removeItem('navigated_from_cart')
      }
      hasRestoredScrollRef.current = true
      
      // Get saved scroll position and displayed count
      const savedScroll = sessionStorage.getItem('products_scroll_position')
      const savedDisplayedCount = sessionStorage.getItem('products_displayed_count')
      
      if (savedScroll && savedDisplayedCount) {
        const scrollY = parseInt(savedScroll, 10)
        const savedCount = parseInt(savedDisplayedCount, 10)
        
        // Restore displayed count first if it was saved and is larger
        if (!isNaN(savedCount) && savedCount > displayedCount && savedCount <= allFilteredProducts.length) {
          setDisplayedCount(savedCount)
        }
        
        // Wait for products to render before restoring scroll
        // Products should be restored from cache, so they should be available quickly
        const restoreScroll = () => {
          // Check if products are rendered (from cache or fetch)
          if (allFilteredProducts.length > 0) {
            const timer = setTimeout(() => {
              if (!isNaN(scrollY) && scrollY > 0) {
                // Use requestAnimationFrame for smooth restoration
                requestAnimationFrame(() => {
                  window.scrollTo({
                    top: scrollY,
                    behavior: 'auto' // Instant scroll for restoration
                  })
                })
              }
            }, 100) // Reduced delay since products should be cached
            
            return () => clearTimeout(timer)
          } else {
            // Products not ready yet, try again (but with shorter timeout since cache should be fast)
            setTimeout(restoreScroll, 50)
          }
        }
        
        // Start restoration process (reduced delay since cache should be instant)
        setTimeout(restoreScroll, 150) // Reduced delay - products should be cached
      }
    }
  }, [displayedCount, allFilteredProducts.length])
  
  // Reset restoration flag when filters change (new search/filter)
  useEffect(() => {
    hasRestoredScrollRef.current = false
  }, [actualSearchQuery, selectedMainCategory, selectedSubCategories, activeBrand, priceRange])
  
  // Save scroll position before navigation
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleScroll = () => {
      try {
        sessionStorage.setItem('products_scroll_position', window.scrollY.toString())
      } catch (e) {
        // Ignore storage errors
      }
    }
    
    // Throttle scroll saves
    let scrollTimeout: ReturnType<typeof setTimeout>
    const throttledScroll = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(handleScroll, 150)
    }
    
    window.addEventListener('scroll', throttledScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', throttledScroll)
      clearTimeout(scrollTimeout)
    }
  }, [])
  
  // Load more products in batch when user scrolls
  const loadMoreBatch = useCallback(() => {
    if (displayedCount < allFilteredProducts.length) {
      // Show next batch (30 more products)
      setDisplayedCount(prev => Math.min(prev + PRODUCTS_BATCH_SIZE, allFilteredProducts.length))
    }
  }, [displayedCount, allFilteredProducts.length])
  
  // When new products are fetched, automatically show them in batches
  useEffect(() => {
    // If we have more products than displayed, but haven't shown them yet
    // This happens when API fetches more products
    if (allFilteredProducts.length > displayedCount && displayedCount < PRODUCTS_BATCH_SIZE * 2) {
      // Auto-show first 2 batches (60 products) when new data arrives
      setDisplayedCount(Math.min(PRODUCTS_BATCH_SIZE * 2, allFilteredProducts.length))
    }
  }, [allFilteredProducts.length, displayedCount])
  
  // Shuffled products for display (only when no filters active)
  // IMPORTANT: Preserve order when returning from detail page, only shuffle if > 5 minutes passed
  const [shuffledProducts, setShuffledProducts] = useState<any[]>([])
  const [hasShuffled, setHasShuffled] = useState(false)
  const previousDisplayedCountRef = useRef(0)
  
  // Check if user is returning from detail page or cart page
  const isReturningFromDetail = useMemo(() => {
    if (typeof window === 'undefined') return false
    try {
      const fromCart = sessionStorage.getItem('navigated_from_cart') === 'true'
      const fromDetail = sessionStorage.getItem('navigated_from_product_detail') === 'true'
      if (fromCart || fromDetail) return true
    } catch (e) {
      // Ignore storage errors
    }
    const referrer = document.referrer
    const returnTo = urlSearchParams?.get('returnTo')
    // Check if referrer contains product detail page (pattern: /products/123-product-name)
    const isFromDetailPage = referrer.includes('/products/') && referrer.match(/\/products\/\d+-/) !== null
    // Also check if returnTo is set (indicates we came back from detail page)
    return isFromDetailPage || !!returnTo
  }, [urlSearchParams])
  
  // Check if 5 minutes passed and clear shuffle state (return to normal order)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const checkAndClearShuffle = () => {
      try {
        const savedShuffleTimestamp = sessionStorage.getItem('products_shuffle_timestamp')
        if (savedShuffleTimestamp) {
          const shuffleTime = parseInt(savedShuffleTimestamp, 10)
          const timeSinceShuffle = Date.now() - shuffleTime
          const fiveMinutes = 5 * 60 * 1000 // 5 minutes in milliseconds
          
          // If more than 5 minutes passed, clear shuffle state (return to normal order)
          if (timeSinceShuffle >= fiveMinutes) {
            sessionStorage.removeItem('products_shuffled_order')
            sessionStorage.removeItem('products_shuffle_timestamp')
            sessionStorage.removeItem('products_has_shuffled')
            setShuffledProducts([])
            setHasShuffled(false)
          }
        }
      } catch (e) {
        // Ignore storage errors
      }
    }
    
    // Check immediately
    checkAndClearShuffle()
    
    // Check periodically every 30 seconds to catch when 5 minutes pass
    const interval = setInterval(checkAndClearShuffle, 30000)
    
    return () => clearInterval(interval)
  }, [displayedProducts])
  
  // When returning from detail page, always clear shuffle (show normal order)
  useEffect(() => {
    if (isReturningFromDetail && typeof window !== 'undefined') {
      try {
        // Clear shuffle state when returning from detail page
        sessionStorage.removeItem('products_shuffled_order')
        sessionStorage.removeItem('products_shuffle_timestamp')
        sessionStorage.removeItem('products_has_shuffled')
        setShuffledProducts([])
        setHasShuffled(false)
        previousDisplayedCountRef.current = 0
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, [isReturningFromDetail])
  
  // Save shuffled products order whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      if (shuffledProducts.length > 0 && hasShuffled) {
        sessionStorage.setItem('products_shuffled_order', JSON.stringify(shuffledProducts))
        // Only update timestamp if we don't have one (preserve original shuffle time)
        const existingTimestamp = sessionStorage.getItem('products_shuffle_timestamp')
        if (!existingTimestamp) {
          sessionStorage.setItem('products_shuffle_timestamp', Date.now().toString())
        }
        sessionStorage.setItem('products_has_shuffled', 'true')
      }
    } catch (e) {
      // Ignore storage errors
    }
  }, [shuffledProducts, hasShuffled])
  
  // Also save on beforeunload as backup
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleBeforeUnload = () => {
      try {
        if (shuffledProducts.length > 0 && hasShuffled) {
          sessionStorage.setItem('products_shuffled_order', JSON.stringify(shuffledProducts))
          const shuffleTimestamp = sessionStorage.getItem('products_shuffle_timestamp') || Date.now().toString()
          sessionStorage.setItem('products_shuffle_timestamp', shuffleTimestamp)
          sessionStorage.setItem('products_has_shuffled', 'true')
        }
      } catch (e) {
        // Ignore storage errors
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [shuffledProducts, hasShuffled])
  
  useEffect(() => {
    // Only shuffle when no filters are active
    const hasFilters = actualSearchQuery || selectedMainCategory || selectedSubCategories.length > 0 || activeBrand || priceRange[0] > 0 || priceRange[1] < 100000
    
    if (hasFilters) {
      // Clear shuffled products when filters are active
      setShuffledProducts([])
      setHasShuffled(false)
      previousDisplayedCountRef.current = 0
      // Clear saved shuffle state
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('products_shuffled_order')
          sessionStorage.removeItem('products_shuffle_timestamp')
          sessionStorage.removeItem('products_has_shuffled')
        } catch (e) {
          // Ignore storage errors
        }
      }
      return
    }
    
    // Only shuffle if:
    // 1. No filters active
    // 2. We have products to display
    // 3. Either: first time (hasShuffled = false) OR displayedCount decreased (user cleared/reset)
    if (!hasFilters && displayedProducts.length > 0) {
      const currentDisplayedCount = displayedProducts.length
      const previousDisplayedCount = previousDisplayedCountRef.current
      
      // Check if we should shuffle based on time
      let shouldShuffle = false
      if (typeof window !== 'undefined') {
        try {
          const savedShuffleTimestamp = sessionStorage.getItem('products_shuffle_timestamp')
          if (savedShuffleTimestamp) {
            const shuffleTime = parseInt(savedShuffleTimestamp, 10)
            const timeSinceShuffle = Date.now() - shuffleTime
            const fiveMinutes = 5 * 60 * 1000 // 5 minutes in milliseconds
            
            // Only shuffle if less than 5 minutes passed (after 5 min, show normal order)
            // Never shuffle when returning from detail page
            if (isReturningFromDetail) {
              shouldShuffle = false // Always show normal order when returning
            } else if (timeSinceShuffle < fiveMinutes) {
              // Less than 5 minutes passed - can shuffle if not shuffled yet
              shouldShuffle = !hasShuffled
            } else {
              // More than 5 minutes passed - don't shuffle (show normal order)
              shouldShuffle = false
            }
          } else {
            // No timestamp - only shuffle if we haven't shuffled yet and not returning
            shouldShuffle = !hasShuffled && !isReturningFromDetail
          }
        } catch (e) {
          shouldShuffle = !hasShuffled && !isReturningFromDetail
        }
      } else {
        shouldShuffle = !hasShuffled && !isReturningFromDetail
      }
      
      // If displayedCount decreased, reset shuffle (user cleared/reset filters)
      if (currentDisplayedCount < previousDisplayedCount) {
        setHasShuffled(false)
        previousDisplayedCountRef.current = 0
        shouldShuffle = true
        // Clear saved shuffle state
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('products_shuffled_order')
            sessionStorage.removeItem('products_shuffle_timestamp')
            sessionStorage.removeItem('products_has_shuffled')
          } catch (e) {
            // Ignore storage errors
          }
        }
      }
      
      // Only shuffle if we haven't shuffled yet OR if this is a reset (count decreased) OR time passed
      if (shouldShuffle && (!hasShuffled || currentDisplayedCount < previousDisplayedCount)) {
        // Shuffle all displayed products
        const shuffled = [...displayedProducts]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        setShuffledProducts(shuffled)
        setHasShuffled(true)
        previousDisplayedCountRef.current = currentDisplayedCount
        
        // Save shuffle timestamp
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('products_shuffle_timestamp', Date.now().toString())
            sessionStorage.setItem('products_shuffled_order', JSON.stringify(shuffled))
            sessionStorage.setItem('products_has_shuffled', 'true')
          } catch (e) {
            // Ignore storage errors
          }
        }
      } else if (currentDisplayedCount > previousDisplayedCount && !isReturningFromDetail && hasShuffled) {
        // User scrolled - append new products WITHOUT reshuffling existing ones
        // But only if not returning from detail page and we're still in shuffle mode (< 5 min)
        const newProducts = displayedProducts.slice(previousDisplayedCountRef.current)
        // Shuffle only the new products
        const shuffledNew = [...newProducts]
        for (let i = shuffledNew.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledNew[i], shuffledNew[j]] = [shuffledNew[j], shuffledNew[i]]
        }
        // Append shuffled new products to existing shuffled products
        const updatedShuffled = [...shuffledProducts, ...shuffledNew]
        setShuffledProducts(updatedShuffled)
        previousDisplayedCountRef.current = currentDisplayedCount
        
        // Update saved shuffle state (preserve original timestamp)
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('products_shuffled_order', JSON.stringify(updatedShuffled))
            // Don't update timestamp - preserve original shuffle time
            const existingTimestamp = sessionStorage.getItem('products_shuffle_timestamp')
            if (!existingTimestamp) {
              sessionStorage.setItem('products_shuffle_timestamp', Date.now().toString())
            }
            sessionStorage.setItem('products_has_shuffled', 'true')
          } catch (e) {
            // Ignore storage errors
          }
        }
      }
    } else {
      setShuffledProducts([])
      setHasShuffled(false)
      previousDisplayedCountRef.current = 0
    }
  }, [displayedProducts, actualSearchQuery, selectedMainCategory, selectedSubCategories, activeBrand, priceRange, isReturningFromDetail])

  // Check if we have products ready (for skeleton display logic)
  const hasCachedProductsInitial = primaryProducts.length > 0

  // Production-Grade: Fast initial load - reduce skeleton time
  // Show skeleton only if no prefetched/cached products available
  const [isInitialLoad, setIsInitialLoad] = useState(!hasCachedProductsInitial)
  const [hasDataLoaded, setHasDataLoaded] = useState(hasCachedProductsInitial)
  // Only show skeleton if no prefetched/cached products (instant display)
  const [showSkeleton, setShowSkeleton] = useState(!hasCachedProductsInitial)
  
  // Delay showing "No products found" to wait for all search methods to complete
  const [showNoProducts, setShowNoProducts] = useState(false)
  const noProductsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  useEffect(() => {
    // Production-Grade: Fast initial load - reduce skeleton time to minimum
    // If we have prefetched products, hide skeleton immediately
    if (hasCachedProductsInitial || primaryProducts.length > 0) {
      setIsInitialLoad(false)
      setHasDataLoaded(true)
      setShowSkeleton(false)
      return
    }
    
    // Otherwise, set timeout to hide skeleton quickly (reduced to 300ms)
    const timer = setTimeout(() => {
      setIsInitialLoad(false)
      if (displayedProducts.length > 0) {
        setHasDataLoaded(true)
        setShowSkeleton(false)
      }
    }, 300) // Reduced to 300ms for faster UX
    return () => clearTimeout(timer)
  }, [hasCachedProductsInitial, primaryProducts.length, displayedProducts.length])
  
  // Production-Grade: Track when we have data - hide skeleton IMMEDIATELY
  // Simple: Update data loaded state
  useEffect(() => {
    if (primaryProducts.length > 0 || displayedProducts.length > 0) {
      setHasDataLoaded(true)
      setShowSkeleton(false)
      setIsInitialLoad(false)
      if (noProductsTimeoutRef.current) {
        clearTimeout(noProductsTimeoutRef.current)
        noProductsTimeoutRef.current = null
      }
      setShowNoProducts(false)
    }
  }, [primaryProducts.length, displayedProducts.length])
  
  // Delay showing "No products found" message
  useEffect(() => {
    if (noProductsTimeoutRef.current) {
      clearTimeout(noProductsTimeoutRef.current)
      noProductsTimeoutRef.current = null
    }
    
    const shouldShowNoProducts = !primaryLoading && displayedProducts.length === 0
    
    if (shouldShowNoProducts) {
      noProductsTimeoutRef.current = setTimeout(() => {
        setShowNoProducts(true)
      }, 1500)
    } else {
      setShowNoProducts(false)
    }
    
    return () => {
      if (noProductsTimeoutRef.current) {
        clearTimeout(noProductsTimeoutRef.current)
        noProductsTimeoutRef.current = null
      }
    }
  }, [primaryLoading, displayedProducts.length])
  
  // Simple loading and error states - products load independently, don't wait for categories
  const isLoading = primaryLoading && displayedProducts.length === 0
  const error = primaryError
  
  // Product hover handler (no longer needed for shuffling, but kept for potential future use)
  const handleProductHover = useCallback(() => {
    // No action needed - shuffling system removed
  }, [])
  
  // Note: Price filtering, category filtering, and sorting are now done server-side
  // The API endpoint handles these parameters automatically

  // Check if we have more products to display from current batch
  const hasMoreInBatch = displayedCount < allFilteredProducts.length
  // Check if we need to fetch more from API
  const hasMoreProducts = primaryHasMore || (primaryTotalCount > 0 && allFilteredProducts.length < primaryTotalCount)
  const hasNextPage = (primaryTotalCount > currentPage * PRODUCTS_PER_PAGE) || (allFilteredProducts.length > currentPage * PRODUCTS_PER_PAGE) || primaryHasMore
  const currentPageProductCount = displayedProducts.length
  
  // Combined load more: show more from batch OR fetch from API
  const handleLoadMore = useCallback(() => {
    if (hasMoreInBatch) {
      // Show more products from current batch
      loadMoreBatch()
    } else if (hasMoreProducts) {
      // Fetch more products from API
      primaryLoadMore()
    }
  }, [hasMoreInBatch, hasMoreProducts, loadMoreBatch, primaryLoadMore])
  
  // Build next page URL with current filters
  const buildNextPageUrl = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', (currentPage + 1).toString())
    
    if (activeBrand) params.set('brand', activeBrand)
    // Use actualSearchQuery (from URL) instead of searchTerm (input state) to preserve actual search
    if (actualSearchQuery) params.set('search', actualSearchQuery)
    if (selectedMainCategory) params.set('mainCategory', selectedMainCategory)
    if (selectedSubCategories.length > 0) {
      params.set('subCategories', selectedSubCategories.join(','))
    }
    if (priceRange[0] > 0) params.set('minPrice', priceRange[0].toString())
    if (priceRange[1] < 100000) params.set('maxPrice', priceRange[1].toString())
    
    return `/products?${params.toString()}`
  }, [currentPage, activeBrand, actualSearchQuery, selectedMainCategory, selectedSubCategories, priceRange])

  const buildPreviousPageUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (currentPage > 2) {
      params.set('page', (currentPage - 1).toString())
    }
    
    if (activeBrand) params.set('brand', activeBrand)
    if (actualSearchQuery) params.set('search', actualSearchQuery)
    if (selectedMainCategory) params.set('mainCategory', selectedMainCategory)
    if (selectedSubCategories.length > 0) {
      params.set('subCategories', selectedSubCategories.join(','))
    }
    if (priceRange[0] > 0) params.set('minPrice', priceRange[0].toString())
    if (priceRange[1] < 100000) params.set('maxPrice', priceRange[1].toString())
    
    return `/products?${params.toString()}`
  }, [currentPage, activeBrand, actualSearchQuery, selectedMainCategory, selectedSubCategories, priceRange])

  // Track prefetched products to avoid duplicate requests
  const prefetchedProductsRef = useRef<Set<number>>(new Set())
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map())

  // Optimized intelligent prefetching for visible products
  useEffect(() => {
    if (displayedProducts.length === 0) return

    // Only prefetch first 6 products that haven't been prefetched yet
    const productsToPrefetch = displayedProducts
      .slice(0, 6)
      .filter((product: any) => !prefetchedProductsRef.current.has(product.id))

    productsToPrefetch.forEach((product: any, index: number) => {
      // Mark as prefetched immediately to prevent duplicates
      prefetchedProductsRef.current.add(product.id)
      
      // Stagger prefetch requests to avoid overwhelming the server
      setTimeout(() => {
        const controller = new AbortController()
        abortControllersRef.current.set(product.id, controller)
        
        fetch(`/api/products/${product.id}?minimal=false`, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        })
          .catch(() => {}) // Silent fail for prefetch
          .finally(() => {
            abortControllersRef.current.delete(product.id)
          })
      }, index * 100) // 100ms delay between each prefetch
    })
  }, [displayedProducts])

  // Optimized scroll-based prefetching (observer created once, not on every render)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const productId = entry.target.getAttribute('data-product-id')
            const id = productId ? Number(productId) : null
            
            if (id && !prefetchedProductsRef.current.has(id)) {
              prefetchedProductsRef.current.add(id)
              
              const controller = new AbortController()
              abortControllersRef.current.set(id, controller)
              
              // Prefetch product detail data
              fetch(`/api/products/${id}?minimal=false`, { 
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal
              })
                .catch(() => {}) // Silent fail for prefetch
                .finally(() => {
                  abortControllersRef.current.delete(id)
                })
            }
          }
        })
      },
      {
        rootMargin: '200px', // Start prefetching 200px before product comes into view
        threshold: 0.1
      }
    )

    // Observe all product cards (re-run when products change)
    const productCards = document.querySelectorAll('[data-product-id]')
    productCards.forEach(card => observer.observe(card))

    return () => {
      observer.disconnect()
      // Cancel any pending prefetch requests on cleanup
      abortControllersRef.current.forEach((controller: AbortController) => controller.abort())
      abortControllersRef.current.clear()
    }
  }, [displayedProducts])

  // Old loadMoreProducts logic removed - now using InfiniteScrollTrigger component with useInfiniteProducts hook





  // Filter functions
  const handlePriceFilterChange = (newRange: [number, number]) => {
    setPriceRange(newRange)
  }


  const handleClearAllFilters = () => {
    // Clear category state first
    setSelectedMainCategory(null)
    setSelectedSubCategories([])
    
    // Clear other filters
    clearFilters()
    
    // Update URL to remove all filter parameters
    const params = new URLSearchParams(urlSearchParams?.toString())
    params.delete('mainCategory')
    params.delete('subCategory')
    params.delete('subCategories')
    params.delete('search')
    params.delete('brand')
    params.delete('minPrice')
    params.delete('maxPrice')
    params.delete('page')
    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
    router.replace(nextUrl, { scroll: false }) // Use replace with scroll: false to prevent page jumping
  }

  // Category navigation handlers
  const handleMainCategorySelect = (categorySlug: string) => {
    // This function only opens the subcategories view, doesn't select categories
    // Category selection is handled by the checkbox
    setSelectedMainCategory(categorySlug)
  }

  const handleOpenSubcategoriesView = (categorySlug: string) => {
    // This function only opens the subcategories view without changing selection
    setSelectedMainCategory(categorySlug)
  }

  const handleSubCategoryToggle = (subCategorySlug: string) => {
    const newSubCategories = selectedSubCategories.includes(subCategorySlug) 
      ? selectedSubCategories.filter((slug: string) => slug !== subCategorySlug)
      : [...selectedSubCategories, subCategorySlug]
    
    setSelectedSubCategories(newSubCategories)
    
    // Update URL - clean up both subCategory (singular) and subCategories (plural)
    const params = new URLSearchParams(urlSearchParams?.toString())
    params.delete('subCategory') // Remove singular form
    if (newSubCategories.length > 0) {
      params.set('subCategories', newSubCategories.join(','))
    } else {
      params.delete('subCategories')
    }
    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
    router.replace(nextUrl, { scroll: false }) // Use replace with scroll: false to prevent page jumping
  }

  const handleBackToMainCategories = () => {
    setSelectedMainCategory(null)
    // Don't clear subcategories when going back - keep the selection
    // setSelectedSubCategories([])
    
    // Update URL - only remove mainCategory, keep subCategories if they exist
    const params = new URLSearchParams(urlSearchParams?.toString())
    params.delete('mainCategory')
    params.delete('subCategory') // Remove singular form
    // Keep subCategories in URL if they exist
    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
    router.replace(nextUrl, { scroll: false }) // Use replace with scroll: false to prevent page jumping
  }

  const handleClearCategoryFilters = () => {
    // Clear category state
    setSelectedMainCategory(null)
    setSelectedSubCategories([])
    
    // Also clear other filters to return to default state
    clearFilters()
    
    // Update URL to remove all category parameters
    const params = new URLSearchParams(urlSearchParams?.toString())
    params.delete('mainCategory')
    params.delete('subCategory')
    params.delete('subCategories')
    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
    router.replace(nextUrl, { scroll: false }) // Use replace with scroll: false to prevent page jumping
  }

  const handleSortChange = (newSortOrder: string) => {
    setSortOrder(newSortOrder)
  }

  // Handle China import modal
  const handleChinaImportConfirm = () => {
    if (pendingCartItem) {
      // Add to cart - simplified variant system (like detail page)
      // Pass variantId (numeric ID from database), no attributes, price from database
      addItem(
        pendingCartItem.productId,
        pendingCartItem.quantity,
        pendingCartItem.variantId,
        {}, // No complex attributes
        pendingCartItem.price
      )
    }
    setShowChinaImportModal(false)
    setPendingCartItem(null)
  }

  const handleChinaImportCancel = () => {
    setShowChinaImportModal(false)
    setPendingCartItem(null)
  }

  // Memoized add to cart handler to prevent unnecessary re-renders
  const handleAddToCart = useCallback((productId: number, productName: string, productPrice: number, productVariants?: any[]) => {
    // Use cached product data from primaryProducts for instant response
    const cachedProduct = primaryProducts.find((p: any) => p.id === productId)
    
    // Quick stock check using cached data
    if (cachedProduct) {
      const stockCheck = checkProductStock(cachedProduct)
      if (!stockCheck.isAvailable) {
        toast({
          title: "Out of Stock",
          description: stockCheck.message || "This product is currently unavailable.",
          variant: "destructive",
        })
        return
      }
    }
    
    // Use cached variants or provided variants
    const variants = cachedProduct?.variants || productVariants || []
    let selectedVariant: any = null
    let variantPrice: number = productPrice
    
    // If product has variants, auto-select first variant (like detail page)
    if (variants && variants.length > 0) {
      selectedVariant = variants[0] // Auto-select first variant
      variantPrice = parseFloat(selectedVariant.price) || productPrice
      
      // Quick variant stock check
      const variantStockQty = selectedVariant.stock_quantity || selectedVariant.stockQuantity || 0
      if (variantStockQty <= 0) {
        toast({
          title: "Out of Stock",
          description: "This variant is currently unavailable.",
          variant: "destructive",
        })
        return
      }
    } else {
      // No variants - use product price from cache
      variantPrice = cachedProduct?.price ? parseFloat(String(cachedProduct.price)) : productPrice
    }
    
    // Auto-set quantity to 5 for products under 500 TZS
    const quantity = variantPrice < 500 ? 5 : 1
    
    // Check if this is a China import item
    if (cachedProduct && (cachedProduct.importChina || cachedProduct.import_china)) {
      // Show modal for China import items
      setPendingCartItem({
        productId,
        quantity,
        variantId: selectedVariant?.id?.toString(),
        price: variantPrice
      })
      setShowChinaImportModal(true)
      return
    }
    
    // Add to cart immediately with cached data
    // Fetch full product data in background for validation (non-blocking)
    addItem(
      productId,
      quantity,
      selectedVariant?.id ? String(selectedVariant.id) : undefined, // Variant ID from database
      {}, // No complex attributes
      variantPrice, // Price from cache (will be validated by API)
      selectedVariant?.sku,
      selectedVariant?.image,
      cachedProduct // Pass cached product data to avoid API fetch
    )
    
    // Fetch full product data in background for server validation (non-blocking)
    fetch(`/api/products/${productId}`)
      .then(response => response.ok ? response.json() : null)
      .then(fullProductData => {
        if (fullProductData) {
          // Validate stock with fresh data
          const stockCheck = checkProductStock(fullProductData)
          if (!stockCheck.isAvailable) {
            // Show error toast if stock check fails
            toast({
              title: "Out of Stock",
              description: stockCheck.message || "This product is currently unavailable.",
              variant: "destructive",
            })
          }
        }
      })
      .catch(() => {}) // Silently handle errors - item already added optimistically
  }, [addItem, toast, setPendingCartItem, setShowChinaImportModal, primaryProducts])

  return (
    <div className={cn("flex flex-col min-h-screen w-full overflow-x-hidden", themeClasses.mainBg, themeClasses.mainText)} suppressHydrationWarning>
      {/* Preload first few product images for better performance */}
      <ImagePreloader 
        images={displayedProducts.slice(0, 6).map((p: any) => p.image).filter((img: any): img is string => Boolean(img))} 
        priority={true} 
      />
      {/* Welcome Message Bar - Mobile Only */}
      <div className="fixed top-0 z-50 w-full bg-white dark:bg-gray-900/95 backdrop-blur-sm sm:hidden" suppressHydrationWarning>
        <div className="flex items-center justify-center h-6 px-4" suppressHydrationWarning>
          {isAuthenticated && user ? (
            <div className="text-xs text-green-600 dark:text-green-400 font-medium">
              Welcome back to <span className="text-blue-600 dark:text-blue-400">{companyName}</span>
            </div>
          ) : (
            <button 
              onClick={() => openAuthModal('login')}
              className="text-xs text-gray-700 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors font-medium"
            >
              Welcome to {companyName} <span className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">login here</span> for better search
            </button>
          )}
        </div>
      </div>

      <header
        className="fixed top-6 sm:top-0 z-40 w-full bg-white dark:bg-black/50 backdrop-blur-sm border-b border-white dark:border-gray-800 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.3)] dark:shadow-[0_15px_30px_-5px_rgba(255,255,255,0.15)]"
        onMouseEnter={(e) => {
          e.stopPropagation()
          // Close mega menu when cursor enters header area (regardless of how it was opened)
          if (isCategoryMegaMenuOpen) {
            if (categoryMegaMenuTimeoutRef.current) {
              clearTimeout(categoryMegaMenuTimeoutRef.current)
            }
            setIsCategoryMegaMenuOpen(false)
          }
        }}
        onMouseLeave={(e) => {
          e.stopPropagation()
        }}
        suppressHydrationWarning
      >
        <div 
          className="flex items-center h-10 sm:h-16 px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 2xl:px-10 w-full max-w-full" 
          onMouseEnter={(e) => {
            e.stopPropagation()
            // Close mega menu when cursor enters header content area (regardless of how it was opened)
            if (isCategoryMegaMenuOpen) {
              if (categoryMegaMenuTimeoutRef.current) {
                clearTimeout(categoryMegaMenuTimeoutRef.current)
              }
              setIsCategoryMegaMenuOpen(false)
            }
          }}
          onMouseLeave={(e) => {
            e.stopPropagation()
          }}
          suppressHydrationWarning
        >
          {/* Mobile Hamburger Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="mobile-menu-toggle desktop-nav:hidden flex items-center justify-center w-8 h-8"
            onClick={() => setIsHamburgerMenuOpen(true)}
            suppressHydrationWarning
          >
            <Menu className="w-8 h-8" />
            <span className="sr-only">Open menu</span>
          </Button>
          {/* Mobile Logo - Near Nav Toggle */}
          <Link
            href="/home"
            className="flex items-center gap-1 sm:hidden text-sm font-semibold flex-shrink-0 min-w-0 ml-0.5 text-gray-900 dark:text-white"
              suppressHydrationWarning
          >
                <Image 
                  src={displayLogo} 
                  alt={`${companyName} Logo`} 
                  width={32} 
                  height={32} 
                  className="w-8 h-8 rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.15)] dark:[box-shadow:0_2px_8px_rgba(255,255,255,0.5),0_1px_4px_rgba(255,255,255,0.4)]"
                suppressHydrationWarning
            />
          </Link>
          {/* Desktop Logo */}
          <Link
            href="/home"
            className="hidden sm:flex items-center gap-1 sm:gap-2 text-sm sm:text-base lg:text-lg font-semibold flex-shrink-0 min-w-0 ml-2 sm:ml-0 text-gray-900 dark:text-white"
              suppressHydrationWarning
          >
                              <span className="sr-only" suppressHydrationWarning>{companyName}</span>
            <Image
              src={displayLogo}
              alt={`${companyName} Logo`}
              width={48}
              height={48}
                className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.15)] dark:[box-shadow:0_2px_8px_rgba(255,255,255,0.5),0_1px_4px_rgba(255,255,255,0.4)]"
                suppressHydrationWarning
            />
                              <div className="hidden sm:flex flex-col">
                                <span 
                                  className="lg:text-lg xl:text-xl 2xl:text-2xl truncate font-bold" 
                                  style={{ color: companyColor }}
                                  suppressHydrationWarning
                                >
                                  {companyName}
                  </span>
                </div>
          </Link>


          {/* All Categories Button with Mega Menu */}
          <div
            className="hidden sm:block ml-3"
            onMouseEnter={(e) => {
              e.stopPropagation()
              // Start timer - will only open if cursor stays for 1.2 seconds
              openCategoryMegaMenu()
            }}
            onMouseLeave={(e) => {
              e.stopPropagation()
              // Cancel timer if cursor leaves before 1.2 seconds
              closeCategoryMegaMenu()
            }}
            onFocusCapture={openCategoryMegaMenu}
            onBlurCapture={closeCategoryMegaMenu}
          >
            <Button
              onClick={() => setIsCategoryNavOpen(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-xs sm:text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Package className="w-4 h-4" />
              All Categories
            </Button>
          </div>

          {/* Search Bar Container - Moved to start */}
          <div className="flex-1 min-w-0 mx-2 sm:mx-3 md:mx-4 lg:mx-6 xl:mx-8 2xl:mx-10 flex items-center relative overflow-hidden" suppressHydrationWarning>
            <form 
              className="relative flex-1 flex items-center min-w-0" 
              onSubmit={(e: React.FormEvent) => {
                e.preventDefault()
                if (searchTerm.trim()) {
                  submitSearch()
                }
              }} 
              suppressHydrationWarning
            >
              {/* Search Input */}
              <div className="relative flex-1 min-w-0 w-full" suppressHydrationWarning>
              <Search
                className={cn(
                    "absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 z-10 pointer-events-none",
                    darkHeaderFooterClasses.textNeutralSecondaryFixed,
                )}
                  suppressHydrationWarning
              />
              <Input
                type="text"
                placeholder="Search for products... (min 3 chars)"
                className={cn(
                    "w-full min-w-0 pl-8 sm:pl-10 rounded-full h-8 sm:h-10 focus:border-yellow-500 focus:ring-yellow-500 text-xs sm:text-base",
                    // Adjust padding-right based on whether there's text and screen size
                    searchTerm.trim() 
                      ? "pr-8 sm:pr-12 md:pr-16" // Reduced padding to prevent cutting
                      : "pr-12 sm:pr-16 md:pr-20", // Reduced padding on mobile when empty
                    darkHeaderFooterClasses.inputBg,
                    darkHeaderFooterClasses.inputBorder,
                    darkHeaderFooterClasses.textNeutralPrimary,
                    darkHeaderFooterClasses.inputPlaceholder,
                    "overflow-hidden text-ellipsis", // Prevent text overflow
                )}
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const newValue = e.target.value
                  setSearchTerm(newValue)
                  
                  // If input is cleared (empty), debounce URL clearing by 500ms
                  if (!newValue.trim()) {
                    // Clear any existing timeout
                    if (clearSearchTimeoutRef.current) {
                      clearTimeout(clearSearchTimeoutRef.current)
                    }
                    // Set new timeout to clear URL after 500ms (only if input remains empty)
                    clearSearchTimeoutRef.current = setTimeout(() => {
                      // Double-check that searchTerm is still empty (user might have typed again)
                    const params = new URLSearchParams(urlSearchParams?.toString() || '')
                      if (params.has('search')) {
                    params.delete('search')
                    params.delete('returnTo')
                    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
                        // Use replace instead of push to avoid adding to history stack
    // This prevents full page refresh and maintains client-side routing
    router.replace(nextUrl, { scroll: false })
                      }
                      clearSearchTimeoutRef.current = null
                    }, 500)
                  } else {
                    // If user is typing (not clearing), cancel any pending clear
                    if (clearSearchTimeoutRef.current) {
                      clearTimeout(clearSearchTimeoutRef.current)
                      clearSearchTimeoutRef.current = null
                    }
                  }
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (searchTerm.trim().length >= 3) {
                    submitSearch()
                  }
                  }
                }}
                  suppressHydrationWarning
              />
              
              {/* Search Helper Message - Show when typing but less than 3 chars */}
              {searchTerm.trim().length > 0 && searchTerm.trim().length < 3 && (
                <div className={cn(
                  "absolute top-full left-0 right-0 mt-1 z-50 rounded-lg shadow-lg border p-3",
                  themeClasses.cardBg,
                  themeClasses.borderNeutralSecondary,
                  themeClasses.textNeutralSecondary
                )}>
                  <p className="text-xs sm:text-sm">
                    Type at least 3 characters to search (e.g., "ard", "uno", "load")
                  </p>
                </div>
              )}
              
              {/* Search Suggestions Dropdown - REMOVED per user request */}
              
              {/* Search Submit Button */}
              <button
                type="submit"
                disabled={!searchTerm.trim() || searchTerm.trim().length < 3}
                className={cn(
                  "absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 rounded-full flex items-center justify-center transition-colors z-10 flex-shrink-0",
                  searchTerm.trim() && searchTerm.trim().length >= 3
                    ? cn(darkHeaderFooterClasses.textNeutralSecondaryFixed, "hover:bg-neutral-200 dark:hover:bg-neutral-700")
                    : "text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
                )}
                title={searchTerm.trim().length < 3 ? "Type at least 3 characters to search" : "Search"}
              >
                <Search className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              
              {/* Clear Search Button */}
              {searchTerm && (
                <button
                  type="button" // CRITICAL: Prevent form submission when clearing
                  onClick={() => {
                    setSearchTerm("")
                    // Clear URL after 500ms debounce (only if input remains empty)
                    if (clearSearchTimeoutRef.current) {
                      clearTimeout(clearSearchTimeoutRef.current)
                    }
                    clearSearchTimeoutRef.current = setTimeout(() => {
                      // Double-check that searchTerm is still empty (user might have typed again)
                    const params = new URLSearchParams(urlSearchParams?.toString() || '')
                      if (params.has('search')) {
                    params.delete('search')
                    params.delete('returnTo')
                    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
                        // Use replace instead of push to avoid adding to history stack
    // This prevents full page refresh and maintains client-side routing
    router.replace(nextUrl, { scroll: false })
                      }
                      clearSearchTimeoutRef.current = null
                    }, 500)
                  }}
                  className={cn(
                    // Adjust position: closer on mobile when camera button is hidden
                    "absolute top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 rounded-full flex items-center justify-center z-10",
                    searchTerm.trim() 
                      ? "right-2 sm:right-10 md:right-12" // Position when typing (camera button hidden on mobile)
                      : "right-20 sm:right-10 md:right-12", // Position when empty (camera button visible)
                    darkHeaderFooterClasses.textNeutralSecondaryFixed,
                    "hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  )}
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
              )}
                
          </div>
            </form>
          </div>

          {/* Navigation Links - Near Search Bar */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-3 ml-2 xl:ml-3">
            <NavigationLinks13Inch />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "flex items-center gap-1 border-2 border-white bg-black hover:bg-white hover:border-yellow-600 transition-colors text-xs text-white mr-4 group",
                    darkHeaderFooterClasses.buttonGhostText,
                  )}
                  style={{ borderRadius: '20px' }}
                  suppressHydrationWarning
                >
                  <Settings className="w-3 h-3 text-white group-hover:text-black transition-colors" />
                  <span className="text-sm font-medium text-white group-hover:text-black transition-colors" suppressHydrationWarning>
                    Service
                  </span>
                  <span className="sr-only" suppressHydrationWarning>Service Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
              >
                <DropdownMenuLabel className="text-base font-semibold px-3 py-2">
                  Other Service
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className={darkHeaderFooterClasses.dropdownItemHoverBg}
                  onClick={(e) => {
                    e.preventDefault()
                    // Security: Use safer DOM manipulation instead of document.write
                    const newWindow = window.open('', '_blank')
                    if (newWindow) {
                      const doc = newWindow.document
                      // Create title element safely
                      const title = doc.createElement('title')
                      title.textContent = 'Coming Soon'
                      if (!doc.head) {
                        const head = doc.createElement('head')
                        doc.documentElement.appendChild(head)
                      }
                      doc.head.appendChild(title)
                      
                      // Ensure body exists
                      if (!doc.body) {
                        const body = doc.createElement('body')
                        doc.documentElement.appendChild(body)
                      }
                      
                      const body = doc.body
                      body.style.cssText = 'font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;'
                      const div = doc.createElement('div')
                      div.style.cssText = 'text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'
                      const h1 = doc.createElement('h1')
                      h1.textContent = 'Coming Soon'
                      h1.style.cssText = 'color: #333; margin-bottom: 20px;'
                      const p = doc.createElement('p')
                      p.textContent = 'This feature is coming soon. Stay tuned!'
                      p.style.cssText = 'color: #666;'
                      div.appendChild(h1)
                      div.appendChild(p)
                      body.appendChild(div)
                    }
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" /> Education Tools
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className={darkHeaderFooterClasses.dropdownItemHoverBg}
                  onClick={(e) => {
                    e.preventDefault()
                    // Security: Use safer DOM manipulation instead of document.write
                    const newWindow = window.open('', '_blank')
                    if (newWindow) {
                      const doc = newWindow.document
                      // Create title element safely
                      const title = doc.createElement('title')
                      title.textContent = 'Coming Soon'
                      if (!doc.head) {
                        const head = doc.createElement('head')
                        doc.documentElement.appendChild(head)
                      }
                      doc.head.appendChild(title)
                      
                      // Ensure body exists
                      if (!doc.body) {
                        const body = doc.createElement('body')
                        doc.documentElement.appendChild(body)
                      }
                      
                      const body = doc.body
                      body.style.cssText = 'font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;'
                      const div = doc.createElement('div')
                      div.style.cssText = 'text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'
                      const h1 = doc.createElement('h1')
                      h1.textContent = 'Coming Soon'
                      h1.style.cssText = 'color: #333; margin-bottom: 20px;'
                      const p = doc.createElement('p')
                      p.textContent = 'This feature is coming soon. Stay tuned!'
                      p.style.cssText = 'color: #666;'
                      div.appendChild(h1)
                      div.appendChild(p)
                      body.appendChild(div)
                    }
                  }}
                >
                  <Package className="w-4 h-4 mr-2" /> Electronic Manufacturing
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className={darkHeaderFooterClasses.dropdownItemHoverBg}
                  onClick={(e) => {
                    e.preventDefault()
                    // Security: Use safer DOM manipulation instead of document.write
                    const newWindow = window.open('', '_blank')
                    if (newWindow) {
                      const doc = newWindow.document
                      // Create title element safely
                      const title = doc.createElement('title')
                      title.textContent = 'Coming Soon'
                      if (!doc.head) {
                        const head = doc.createElement('head')
                        doc.documentElement.appendChild(head)
                      }
                      doc.head.appendChild(title)
                      
                      // Ensure body exists
                      if (!doc.body) {
                        const body = doc.createElement('body')
                        doc.documentElement.appendChild(body)
                      }
                      
                      const body = doc.body
                      body.style.cssText = 'font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;'
                      const div = doc.createElement('div')
                      div.style.cssText = 'text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'
                      const h1 = doc.createElement('h1')
                      h1.textContent = 'Coming Soon'
                      h1.style.cssText = 'color: #333; margin-bottom: 20px;'
                      const p = doc.createElement('p')
                      p.textContent = 'This feature is coming soon. Stay tuned!'
                      p.style.cssText = 'color: #666;'
                      div.appendChild(h1)
                      div.appendChild(p)
                      body.appendChild(div)
                    }
                  }}
                >
                  <Laptop className="w-4 h-4 mr-2" /> PCB Printing
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className={darkHeaderFooterClasses.dropdownItemHoverBg}
                  onClick={(e) => {
                    e.preventDefault()
                    // Security: Use safer DOM manipulation instead of document.write
                    const newWindow = window.open('', '_blank')
                    if (newWindow) {
                      const doc = newWindow.document
                      // Create title element safely
                      const title = doc.createElement('title')
                      title.textContent = 'Coming Soon'
                      if (!doc.head) {
                        const head = doc.createElement('head')
                        doc.documentElement.appendChild(head)
                      }
                      doc.head.appendChild(title)
                      
                      // Ensure body exists
                      if (!doc.body) {
                        const body = doc.createElement('body')
                        doc.documentElement.appendChild(body)
                      }
                      
                      const body = doc.body
                      body.style.cssText = 'font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;'
                      const div = doc.createElement('div')
                      div.style.cssText = 'text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'
                      const h1 = doc.createElement('h1')
                      h1.textContent = 'Coming Soon'
                      h1.style.cssText = 'color: #333; margin-bottom: 20px;'
                      const p = doc.createElement('p')
                      p.textContent = 'This feature is coming soon. Stay tuned!'
                      p.style.cssText = 'color: #666;'
                      div.appendChild(h1)
                      div.appendChild(p)
                      body.appendChild(div)
                    }
                  }}
                >
                  <TrendingUp className="w-4 h-4 mr-2" /> Project Development
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className={darkHeaderFooterClasses.dropdownItemHoverBg}
                  onClick={(e) => {
                    e.preventDefault()
                    toast({
                      title: "Coming Soon",
                      description: "Become Seller feature will be available soon!",
                      duration: 3000,
                    })
                  }}
                >
                  <UserPlus className="w-4 h-4 mr-2" /> Become Seller
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 flex-shrink-0 min-w-0" suppressHydrationWarning>
            {/* Mobile Cart Button - Always Visible */}
            <Link href="/cart" className="sm:hidden flex items-center">
              <Button
                variant="outline"
                size="icon"
                className="relative bg-white text-neutral-950 border-yellow-500 hover:bg-yellow-500 hover:text-white hover:border-yellow-500 rounded-full transition-colors h-8 w-8"
                suppressHydrationWarning
              >
                <ShoppingCart className="w-3 h-3" />
                <span className="sr-only">Shopping Cart</span>
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground" suppressHydrationWarning>
                  {cartUniqueProducts}
                </span>
              </Button>
            </Link>

            {/* Mobile Profile Button */}
            <div className="sm:hidden">
              {isAuthenticated ? (
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 flex items-center justify-center">
                    <UserProfile />
                  </div>
                  <span className="text-xs font-medium text-black dark:text-white truncate max-w-[80px] mt-0.5 text-center">
                    {(() => {
                      // Extract name from various sources (handles Google OAuth users)
                      const name = user?.name?.trim() || 
                                   (user as any)?.user_metadata?.full_name?.trim() || 
                                   (user as any)?.user_metadata?.name?.trim() ||
                                   user?.email?.split('@')[0] || 
                                   'User';
                      if (!name || name === '') return 'User';
                      return name.length > 5 ? name.substring(0, 5) + '...' : name;
                    })()}
                    </span>
                  </div>
                ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className={cn(
                        "flex items-center gap-1 h-8 w-8 p-0 ml-1 cursor-pointer",
                        "hover:bg-yellow-500/10 hover:text-yellow-500 transition-colors",
                        darkHeaderFooterClasses.buttonGhostText,
                        darkHeaderFooterClasses.buttonGhostHoverBg,
                      )}
                    >
                      <User className="w-4 h-4" />
                      <span className="sr-only">User Menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className={cn(
                      "w-56",
                      "bg-white text-neutral-900 border border-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800",
                    )}
                  >
                    <div className="p-2 flex flex-col gap-2">
                      <Button 
                      onClick={() => openAuthModal('login')}
                        className="w-full bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
                    >
                      Sign in
                    </Button>
                      <button
                      onClick={() => openAuthModal('register')}
                        className={cn(
                          "text-center text-sm hover:underline",
                          darkHeaderFooterClasses.textNeutralSecondaryFixed,
                        )}
                    >
                        Register
                      </button>
                  </div>
                    <DropdownMenuSeparator className={darkHeaderFooterClasses.dropdownSeparator} />
                    <DropdownMenuItem 
                      className={darkHeaderFooterClasses.dropdownItemHoverBg}
                      onClick={() => openAuthModal('login')}
                    >
                      <Package className="w-4 h-4 mr-2" /> My Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={darkHeaderFooterClasses.dropdownItemHoverBg}
                      onClick={() => openAuthModal('login')}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" /> Message Center
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={darkHeaderFooterClasses.dropdownItemHoverBg}
                      onClick={() => openAuthModal('login')}
                    >
                      <CreditCard className="w-4 h-4 mr-2" /> Payment
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={darkHeaderFooterClasses.dropdownItemHoverBg}
                      onClick={() => openAuthModal('login')}
                    >
                      <Heart className="w-4 h-4 mr-2" /> Wish List
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={darkHeaderFooterClasses.dropdownItemHoverBg}
                      onClick={() => openAuthModal('login')}
                    >
                      <Ticket className="w-4 h-4 mr-2" /> My Coupons
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>



            {/* Theme Toggle Button - Switch between White and Dark (Black) */}
          <div className="hidden sm:block">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Toggle between white and dark (black) only
                const newTheme = (backgroundColor === 'white' || backgroundColor === 'gray') ? 'dark' : 'white'
                setBackgroundColor(newTheme)
              }}
              className={cn(
                "flex items-center gap-2",
                "border-gray-300 dark:border-gray-600",
                "hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
              title={(backgroundColor === 'white' || backgroundColor === 'gray') ? 'Switch to dark theme' : 'Switch to light theme'}
              suppressHydrationWarning
            >
              {(backgroundColor === 'white' || backgroundColor === 'gray') ? (
                <>
                  <Moon className="w-4 h-4" />
                  <span className="hidden sm:inline" suppressHydrationWarning>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4" />
                  <span className="hidden sm:inline" suppressHydrationWarning>Light</span>
                </>
              )}
            </Button>
          </div>

            <div className="hidden sm:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex items-center gap-1 border-yellow-500 bg-transparent hover:bg-yellow-500/10 hover:text-yellow-600 hover:border-yellow-600 transition-colors text-xs",
                    darkHeaderFooterClasses.buttonGhostText,
                  )}
                  suppressHydrationWarning
                >
                  {currency === "USD" ? <DollarSign className="w-3 h-3" /> : <Landmark className="w-3 h-3" />}
                  {currency}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={cn(
                  themeClasses.cardBg,
                  themeClasses.mainText,
                  themeClasses.cardBorder,
                )}
              >
                <DropdownMenuItem
                  onClick={() => setCurrency("USD")}
                  className="hover:bg-yellow-500/10 hover:text-yellow-600 transition-colors"
                  suppressHydrationWarning
                >
                  <DollarSign className="w-4 h-4 mr-2" /> USD
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setCurrency("TZS")}
                  className="hover:bg-yellow-500/10 hover:text-yellow-600 transition-colors"
                  suppressHydrationWarning
                >
                  <Landmark className="w-4 h-4 mr-2" /> TZS
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
              </div>

            <Link href="/cart" className="hidden sm:block">
              <Button
                variant="outline"
                size="icon"
                className="relative bg-white text-neutral-950 border-yellow-500 hover:bg-yellow-500 hover:text-white hover:border-yellow-500 rounded-full transition-colors"
                suppressHydrationWarning
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="sr-only">Shopping Cart</span>
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground" suppressHydrationWarning>
                  {cartUniqueProducts}
                </span>
              </Button>
            </Link>

            {/* User Profile - Desktop */}
            <div className="hidden sm:block">
              {isAuthenticated ? (
                <div className="flex flex-col items-center">
                  <UserProfile />
                  <span className="text-xs text-black dark:text-white mt-1">
                    {(() => {
                      // Extract name from various sources (handles Google OAuth users)
                      const name = user?.name?.trim() || 
                                   (user as any)?.user_metadata?.full_name?.trim() || 
                                   (user as any)?.user_metadata?.name?.trim() ||
                                   user?.email?.split('@')[0] || 
                                   'User';
                      return name;
                    })()}
                  </span>
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "flex items-center gap-1 h-auto py-2 px-1 sm:px-2 ml-1 sm:ml-2 group border border-transparent hover:border-white/20 hover:bg-transparent",
                        darkHeaderFooterClasses.buttonGhostText,
                      )}
                      suppressHydrationWarning
                    >
                      <User className="w-4 h-4 sm:w-5 sm:h-5 group-hover:text-yellow-500 transition-colors" />
                      <div className="hidden sm:flex flex-col items-start text-[10px]" suppressHydrationWarning>
                        <span className="group-hover:text-yellow-500 transition-colors">Welcome</span>
                        <span className="font-semibold group-hover:text-yellow-500 transition-colors">Sign in / Register</span>
                    </div>
                      <span className="sr-only">User Menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className={cn(
                      "w-48 sm:w-56",
                      themeClasses.cardBg,
                      themeClasses.mainText,
                      themeClasses.cardBorder,
                    )}
                  >
                    <div className="p-2 flex flex-col gap-2">
                      <Button 
                        className="w-full bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
                        onClick={() => openAuthModal('login')}
                      >
                        Sign in
                      </Button>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full text-center text-sm hover:underline",
                          darkHeaderFooterClasses.textNeutralSecondaryFixed,
                        )}
                        onClick={() => openAuthModal('register')}
                      >
                        Register
                    </Button>
                  </div>
                    <DropdownMenuSeparator className={darkHeaderFooterClasses.dropdownSeparator} />
                    <DropdownMenuItem 
                      className={darkHeaderFooterClasses.dropdownItemHoverBg}
                      onClick={() => router.push('/account/orders')}
                    >
                      <Package className="w-4 h-4 mr-2" /> My Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={darkHeaderFooterClasses.dropdownItemHoverBg}
                      onClick={() => router.push('/account/messages')}
                    >
                      <Package className="w-4 h-4 mr-2" /> Message Center
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={darkHeaderFooterClasses.dropdownItemHoverBg}
                      onClick={() => router.push('/account/payment')}
                    >
                      <Package className="w-4 h-4 mr-2" /> Payment
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={darkHeaderFooterClasses.dropdownItemHoverBg}
                      onClick={() => router.push('/account/wishlist')}
                    >
                      <Heart className="w-4 h-4 mr-2" /> Wish List
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={darkHeaderFooterClasses.dropdownItemHoverBg}
                      onClick={() => router.push('/account/coupons')}
                    >
                      <Package className="w-4 h-4 mr-2" /> My Coupons
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className={darkHeaderFooterClasses.dropdownSeparator} />
                    <DropdownMenuItem 
                      className={darkHeaderFooterClasses.dropdownItemHoverBg}
                      onClick={() => {
                        const currentTheme = backgroundColor
                        const themes = ['white', 'gray', 'dark']
                        const currentIndex = themes.indexOf(currentTheme)
                        const nextIndex = (currentIndex + 1) % themes.length
                        setBackgroundColor(themes[nextIndex] as 'white' | 'gray' | 'dark')
                      }}
                    >
                      <div className="w-4 h-4 mr-2 flex items-center justify-center">
                        <div className={`w-3 h-3 rounded-full ${
                          backgroundColor === 'white' ? 'bg-gray-300 border border-gray-400' :
                          backgroundColor === 'gray' ? 'bg-gray-600' :
                          'bg-gray-800'
                        }`}></div>
                      </div>
                      Change Theme Color
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

          </div>
              </div>

        {/* Second Row - Main Categories */}
        <div 
          ref={desktopCategoriesContainerRef}
          className="hidden lg:flex items-center justify-between gap-2 xl:gap-3 py-3 px-5 overflow-hidden"
        >
          {/* Import from China Link */}
          <div 
            style={{ marginLeft: '10px', marginRight: '4px' }} 
            className="flex-shrink-0"
            onMouseEnter={(e) => {
              e.stopPropagation()
              if (isCategoryMegaMenuOpen) {
                setIsCategoryMegaMenuOpen(false)
              }
            }}
            onMouseLeave={(e) => {
              e.stopPropagation()
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              onMouseEnter={(e) => {
                e.stopPropagation()
                if (isCategoryMegaMenuOpen) {
                  setIsCategoryMegaMenuOpen(false)
                }
              }}
              onMouseLeave={(e) => {
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsCategoryMegaMenuOpen(false)
                toast({
                  title: "Coming Soon",
                  description: "This feature is coming soon. Stay tuned!",
                  duration: 3000,
                })
              }}
              className={cn(
                 "flex items-center gap-1 transition-colors text-xs text-black dark:text-white relative px-3 py-2 h-8",
                darkHeaderFooterClasses.buttonGhostText,
                "cursor-pointer",
                "[box-shadow:0_4px_6px_-1px_rgba(0,0,0,0.3),0_2px_4px_-1px_rgba(0,0,0,0.25)]",
                "hover:[box-shadow:0_10px_15px_-3px_rgba(0,0,0,0.4),0_4px_6px_-2px_rgba(0,0,0,0.3)]",
                "dark:[box-shadow:0_4px_6px_-1px_rgba(255,255,255,0.5),0_2px_4px_-1px_rgba(255,255,255,0.4)]",
                "dark:hover:[box-shadow:0_10px_15px_-3px_rgba(255,255,255,0.6),0_4px_6px_-2px_rgba(255,255,255,0.5)]"
              )}
              style={{ 
                borderRadius: '16px',
                backgroundImage: 'url(/button.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
              suppressHydrationWarning
            >
               <span className="text-xs font-medium text-black dark:text-white flex items-center gap-1.5" suppressHydrationWarning>
             <Image src={chinaImageSrc} alt="China" width={24} height={15} className="object-cover flex-shrink-0" suppressHydrationWarning onError={() => { const currentIndex = chinaFormats.indexOf(chinaImageSrc); if (currentIndex < chinaFormats.length - 1) setChinaImageSrc(chinaFormats[currentIndex + 1]); }} />
             Buy from China
                <Badge className="bg-yellow-500 text-black text-[8px] px-1 py-0 h-3 leading-none font-semibold" suppressHydrationWarning>
                  Soon
                </Badge>
              </span>
               <span className="sr-only" suppressHydrationWarning>Buy from China</span>
            </Button>
          </div>
          
          {/* Visible Main Categories - Flex to fill space */}
          <div className="flex items-center justify-between flex-1 gap-2 xl:gap-3 ml-2" data-category-nav>
            {/* AI Sourcing and Discovery buttons for tablet only */}
            <div className="hidden md:flex lg:hidden items-center gap-2 xl:gap-3 flex-shrink-0">
              <Link 
                href="/" 
                className={cn(
                  "text-sm md:text-xs lg:text-base font-medium whitespace-nowrap inline-flex items-center justify-center gap-1",
                  "transition-all duration-300 ease-in-out",
                  "transform hover:scale-110",
                  cn(themeClasses.mainText, "hover:text-yellow-500")
                )}
              >
                <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" />
                AI Sourcing
              </Link>
              <Link 
                href="/discover" 
                className={cn(
                  "text-sm md:text-xs lg:text-base font-medium whitespace-nowrap inline-flex items-center justify-center gap-1",
                  "transition-all duration-300 ease-in-out",
                  "transform hover:scale-110",
                  cn(themeClasses.mainText, "hover:text-yellow-500")
                )}
              >
                <Compass className="w-3 h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" />
                Discovery
              </Link>
            </div>
            {desktopVisibleCategories.map((cat: any) => (
            <div
                key={cat.id}
                className="relative flex-1"
                data-category-nav
                onMouseEnter={() => {
                  // Clear any existing timeout and start fresh timer
                  // Menu will only open if cursor stays for 1.2 seconds
                  if (categoryMegaMenuTimeoutRef.current) {
                    clearTimeout(categoryMegaMenuTimeoutRef.current)
                    categoryMegaMenuTimeoutRef.current = null
                  }
                  setHoveredMegaCategory(cat.slug)
                  openCategoryMegaMenu()
                }}
                onMouseLeave={() => {
                  // Cancel timer if cursor leaves before 1.2 seconds
                  // This prevents menu from opening when cursor just passes through
                  if (categoryMegaMenuTimeoutRef.current) {
                    clearTimeout(categoryMegaMenuTimeoutRef.current)
                    categoryMegaMenuTimeoutRef.current = null
                  }
                }}
            >
              <Link 
                href={`/products?mainCategory=${cat.slug}`} 
                className={cn(
                    "text-base font-medium whitespace-nowrap flex-1 text-center inline-flex items-center justify-center gap-1",
                    "transition-all duration-300 ease-in-out",
                    "transform hover:scale-110",
                    selectedMainCategory === cat.slug 
                      ? 'text-yellow-500 hover:text-yellow-600' 
                      : cn(themeClasses.mainText, "hover:text-yellow-500")
                )}
                prefetch={true}
                scroll={true}
                onClick={() => {
                  // Update state for immediate UI feedback
                  // Next.js Link will handle client-side navigation automatically
                  setSelectedMainCategory(cat.slug)
                  // Get all subcategories for this main category
                  const subcategoriesUnderMain = categoriesData.subCategories.filter((sub: any) => sub.parent_id === cat.id)
                  const allSubSlugs = subcategoriesUnderMain.map((sub: any) => sub.slug)
                  setSelectedSubCategories(allSubSlugs)
                  setIsCategoryMegaMenuOpen(false)
                }}
              >
                  {cat.name}
                  <ChevronDown className="w-3 h-3 flex-shrink-0 transition-transform duration-300 group-hover:rotate-180" />
              </Link>
            </div>
            ))}
            
          </div>
              </div>

        {/* Mobile Categories Row */}
        <div 
          ref={mobileCategoriesContainerRef}
          className="lg:hidden flex items-center justify-between gap-0 sm:gap-1 py-3 px-0 overflow-x-hidden overflow-y-visible" 
          suppressHydrationWarning
        >
          {/* Import from China Link */}
          <div 
            className="flex-shrink-0" 
            style={{ marginLeft: '4px', marginRight: '2px' }}
            onMouseEnter={(e) => {
              e.stopPropagation()
              if (isCategoryMegaMenuOpen) {
                setIsCategoryMegaMenuOpen(false)
              }
            }}
            onMouseLeave={(e) => {
              e.stopPropagation()
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              onMouseEnter={(e) => {
                e.stopPropagation()
                if (isCategoryMegaMenuOpen) {
                  setIsCategoryMegaMenuOpen(false)
                }
              }}
              onMouseLeave={(e) => {
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsCategoryMegaMenuOpen(false)
                toast({
                  title: "Coming Soon",
                  description: "This feature is coming soon. Stay tuned!",
                  duration: 3000,
                })
              }}
              className={cn(
                 "flex items-center gap-1 border-[1.5px] border-black hover:border-yellow-600 transition-colors text-[10px] px-[5px] py-1 h-6 text-black dark:border-white dark:text-black flex-shrink-0 relative",
                darkHeaderFooterClasses.buttonGhostText,
                "cursor-pointer"
              )}
               style={{ 
                 borderRadius: '12px',
                 backgroundImage: 'url(/button.jpg)',
                 backgroundSize: 'cover',
                 backgroundPosition: 'center',
                 backgroundRepeat: 'no-repeat'
               }}
              suppressHydrationWarning
            >
               <span className="text-[10px] font-medium text-black dark:text-white flex items-center gap-1" suppressHydrationWarning>
             <Image src={chinaImageSrc} alt="China" width={20} height={12} className="object-cover flex-shrink-0" suppressHydrationWarning onError={() => { const currentIndex = chinaFormats.indexOf(chinaImageSrc); if (currentIndex < chinaFormats.length - 1) setChinaImageSrc(chinaFormats[currentIndex + 1]); }} />
             Buy from China
                <Badge className="bg-yellow-500 text-black text-[7px] px-0.5 py-0 h-2.5 leading-none font-semibold" suppressHydrationWarning>
                  Soon
                </Badge>
                </span>
               <span className="sr-only" suppressHydrationWarning>Buy from China</span>
            </Button>
          </div>
          
          {/* All Categories Button - Mobile */}
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              setIsCategoryMegaMenuOpen(!isCategoryMegaMenuOpen)
            }}
            className={cn(
              "flex items-center gap-1.5 border-0 bg-white hover:bg-gray-50 dark:bg-black dark:hover:bg-gray-800 transition-colors text-[10px] px-2.5 py-1 h-6 flex-shrink-0 ml-0 sm:ml-1",
              isCategoryMegaMenuOpen && "bg-gray-100 dark:bg-gray-800"
            )}
            style={{ borderRadius: '12px' }}
          >
            <Package className="w-3 h-3 flex-shrink-0" />
            <span className="font-medium text-black dark:text-white">All Categories</span>
            <ChevronDown className={cn(
              "w-2.5 h-2.5 flex-shrink-0 transition-transform",
              isCategoryMegaMenuOpen && "rotate-180"
            )} />
          </Button>

          {/* Service Button - Mobile with Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-0 bg-white hover:bg-gray-50 dark:bg-black dark:hover:bg-gray-800 transition-colors text-[10px] px-2.5 py-1 h-6 flex-shrink-0 ml-0"
                style={{ borderRadius: '12px' }}
              >
                <Settings className="w-3 h-3 flex-shrink-0" />
                <span className="font-medium text-black dark:text-white">Service</span>
                <ChevronDown className="w-2.5 h-2.5 flex-shrink-0 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
            >
              <DropdownMenuLabel className="text-base font-semibold px-3 py-2">
                Other Service
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className={darkHeaderFooterClasses.dropdownItemHoverBg}
                onClick={(e) => {
                  e.preventDefault()
                  // Security: Use safer DOM manipulation instead of document.write
                  const newWindow = window.open('', '_blank')
                  if (newWindow) {
                    newWindow.document.open()
                    const doc = newWindow.document
                    // Create initial HTML structure without using document.write
                    doc.documentElement.innerHTML = '<head><title>Coming Soon</title></head><body></body>'
                    
                    const body = doc.body
                    if (body) {
                      body.style.cssText = 'font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;'
                      const div = doc.createElement('div')
                      div.style.cssText = 'text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'
                      const h1 = doc.createElement('h1')
                      h1.textContent = 'Coming Soon'
                      h1.style.cssText = 'color: #333; margin-bottom: 20px;'
                      const p = doc.createElement('p')
                      p.textContent = 'This feature is coming soon. Stay tuned!'
                      p.style.cssText = 'color: #666;'
                      div.appendChild(h1)
                      div.appendChild(p)
                      body.appendChild(div)
                    }
                    newWindow.document.close()
                  }
                }}
              >
                <Settings className="w-4 h-4 mr-2" /> Education Tools
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={darkHeaderFooterClasses.dropdownItemHoverBg}
                onClick={(e) => {
                  e.preventDefault()
                  // Security: Use safer DOM manipulation instead of document.write
                  const newWindow = window.open('', '_blank')
                  if (newWindow) {
                    newWindow.document.open()
                    const doc = newWindow.document
                    // Create initial HTML structure without using document.write
                    doc.documentElement.innerHTML = '<head><title>Coming Soon</title></head><body></body>'
                    
                    const body = doc.body
                    if (body) {
                      body.style.cssText = 'font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;'
                      const div = doc.createElement('div')
                      div.style.cssText = 'text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'
                      const h1 = doc.createElement('h1')
                      h1.textContent = 'Coming Soon'
                      h1.style.cssText = 'color: #333; margin-bottom: 20px;'
                      const p = doc.createElement('p')
                      p.textContent = 'This feature is coming soon. Stay tuned!'
                      p.style.cssText = 'color: #666;'
                      div.appendChild(h1)
                      div.appendChild(p)
                      body.appendChild(div)
                    }
                    newWindow.document.close()
                  }
                }}
              >
                <Package className="w-4 h-4 mr-2" /> Electronic Manufacturing
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={darkHeaderFooterClasses.dropdownItemHoverBg}
                onClick={(e) => {
                  e.preventDefault()
                  // Security: Use safer DOM manipulation instead of document.write
                  const newWindow = window.open('', '_blank')
                  if (newWindow) {
                    newWindow.document.open()
                    const doc = newWindow.document
                    // Create initial HTML structure without using document.write
                    doc.documentElement.innerHTML = '<head><title>Coming Soon</title></head><body></body>'
                    
                    const body = doc.body
                    if (body) {
                      body.style.cssText = 'font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;'
                      const div = doc.createElement('div')
                      div.style.cssText = 'text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'
                      const h1 = doc.createElement('h1')
                      h1.textContent = 'Coming Soon'
                      h1.style.cssText = 'color: #333; margin-bottom: 20px;'
                      const p = doc.createElement('p')
                      p.textContent = 'This feature is coming soon. Stay tuned!'
                      p.style.cssText = 'color: #666;'
                      div.appendChild(h1)
                      div.appendChild(p)
                      body.appendChild(div)
                    }
                    newWindow.document.close()
                  }
                }}
              >
                <Laptop className="w-4 h-4 mr-2" /> PCB Printing
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={darkHeaderFooterClasses.dropdownItemHoverBg}
                onClick={(e) => {
                  e.preventDefault()
                  // Security: Use safer DOM manipulation instead of document.write
                  const newWindow = window.open('', '_blank')
                  if (newWindow) {
                    newWindow.document.open()
                    const doc = newWindow.document
                    // Create initial HTML structure without using document.write
                    doc.documentElement.innerHTML = '<head><title>Coming Soon</title></head><body></body>'
                    
                    const body = doc.body
                    if (body) {
                      body.style.cssText = 'font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;'
                      const div = doc.createElement('div')
                      div.style.cssText = 'text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'
                      const h1 = doc.createElement('h1')
                      h1.textContent = 'Coming Soon'
                      h1.style.cssText = 'color: #333; margin-bottom: 20px;'
                      const p = doc.createElement('p')
                      p.textContent = 'This feature is coming soon. Stay tuned!'
                      p.style.cssText = 'color: #666;'
                      div.appendChild(h1)
                      div.appendChild(p)
                      body.appendChild(div)
                    }
                    newWindow.document.close()
                  }
                }}
              >
                <TrendingUp className="w-4 h-4 mr-2" /> Project Development
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className={darkHeaderFooterClasses.dropdownItemHoverBg}
                onClick={(e) => {
                  e.preventDefault()
                  toast({
                    title: "Coming Soon",
                    description: "Become Seller feature will be available soon!",
                    duration: 3000,
                  })
                }}
              >
                <UserPlus className="w-4 h-4 mr-2" /> Become Seller
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Backdrop for Mobile Mega Menu */}
        {isCategoryMegaMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
            onClick={() => setIsCategoryMegaMenuOpen(false)}
          />
        )}

        {/* Mega Menu Dropdown - Full Width Below Nav */}
        {isCategoryMegaMenuOpen && categoriesData.mainCategories.length > 0 && (
          <div 
            ref={categoryMegaMenuRef}
            className="absolute left-0 top-full w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-2xl z-50 max-h-[calc(100vh-200px)] overflow-y-auto"
            onMouseEnter={openCategoryMegaMenu}
            onMouseLeave={closeCategoryMegaMenu}
            onClick={(e) => {
              // On mobile, clicking inside the menu should not close it
              e.stopPropagation()
            }}
          >
            <div className="max-w-full px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-3 sm:py-6">
              <div className="grid grid-cols-12 gap-3 sm:gap-4">
                <div className="col-span-12 lg:col-span-3 border-r-0 lg:border-r border-gray-100 dark:border-gray-800 lg:pr-4 pb-3 lg:pb-0 max-h-[300px] sm:max-h-[360px] overflow-y-auto">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                    Main Categories
                  </p>
                  <div className="space-y-1">
                    {categoriesData.mainCategories.map((category: any) => {
                      const isActive = hoveredMegaCategory === category.slug
                      return (
                        <button
                          key={category.id}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2',
                            'transition-all duration-300 ease-in-out transform hover:scale-105',
                            isActive
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-yellow-500'
                          )}
                          onMouseEnter={() => setHoveredMegaCategory(category.slug)}
                          onFocus={() => setHoveredMegaCategory(category.slug)}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            // On mobile, just set the hovered category to show subcategories
                            // On desktop, navigate and close menu
                            if (window.innerWidth >= 1024) {
                              // Set category state and update URL
                              setSelectedMainCategory(category.slug)
                              const subcategoriesUnderMain = categoriesData.subCategories.filter((sub: any) => sub.parent_id === category.id)
                              const allSubSlugs = subcategoriesUnderMain.map((sub: any) => sub.slug)
                              setSelectedSubCategories(allSubSlugs)
                              
                              const params = new URLSearchParams(urlSearchParams?.toString())
                              params.set('mainCategory', category.slug)
                              if (allSubSlugs.length > 0) {
                                params.set('subCategories', allSubSlugs.join(','))
                              } else {
                                params.delete('subCategories')
                              }
                              const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
                              router.replace(nextUrl, { scroll: false })
                              setIsCategoryMegaMenuOpen(false)
                            } else {
                              // Mobile: just select the category to show subcategories
                              setHoveredMegaCategory(category.slug)
                            }
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            // On mobile double-click: filter by category and close menu
                            if (window.innerWidth < 1024) {
                              // Set category state and update URL
                              setSelectedMainCategory(category.slug)
                              const subcategoriesUnderMain = categoriesData.subCategories.filter((sub: any) => sub.parent_id === category.id)
                              const allSubSlugs = subcategoriesUnderMain.map((sub: any) => sub.slug)
                              setSelectedSubCategories(allSubSlugs)
                              
                              const params = new URLSearchParams(urlSearchParams?.toString())
                              params.set('mainCategory', category.slug)
                              if (allSubSlugs.length > 0) {
                                params.set('subCategories', allSubSlugs.join(','))
                              } else {
                                params.delete('subCategories')
                              }
                              const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
                              router.replace(nextUrl, { scroll: false })
                              setIsCategoryMegaMenuOpen(false)
                            }
                          }}
                        >
                          {category.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-9 mt-3 lg:mt-0">
                  {hoveredMegaCategoryData ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Subcategories
                          </p>
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            {hoveredMegaCategoryData.name}
                          </h3>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400"
                          onClick={() => {
                            // Set category state and update URL
                            setSelectedMainCategory(hoveredMegaCategoryData.slug)
                            const subcategoriesUnderMain = categoriesData.subCategories.filter((sub: any) => sub.parent_id === hoveredMegaCategoryData.id)
                            const allSubSlugs = subcategoriesUnderMain.map((sub: any) => sub.slug)
                            setSelectedSubCategories(allSubSlugs)
                            
                            const params = new URLSearchParams(urlSearchParams?.toString())
                            params.set('mainCategory', hoveredMegaCategoryData.slug)
                            if (allSubSlugs.length > 0) {
                              params.set('subCategories', allSubSlugs.join(','))
                            } else {
                              params.delete('subCategories')
                            }
                            const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
                            router.replace(nextUrl, { scroll: false })
                            setIsCategoryMegaMenuOpen(false)
                          }}
                        >
                          View all
                        </Button>
                      </div>

                      {recommendedMegaMenuSubCategories.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                            Recommended
                          </p>
                          {/* Mobile: Show 4 items, Desktop: Show 12 items */}
                          <div className="flex flex-row gap-2 sm:gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-6 xl:grid-cols-12 lg:gap-3 lg:overflow-x-visible lg:pb-0">
                            {/* Mobile: Show first 4 items */}
                            {recommendedMegaMenuSubCategories.slice(0, 4).map((sub: any) => (
                              <Link
                                key={sub.id}
                                href={`/products?mainCategory=${hoveredMegaCategoryData.slug}&subCategory=${sub.slug}`}
                                className="flex flex-col items-center gap-2 border-0 rounded-lg p-2 hover:shadow-md transition-all duration-300 ease-in-out transform hover:scale-110 flex-shrink-0 min-w-[80px] sm:min-w-[90px] lg:min-w-0"
                                onClick={() => {
                                  // Update state for immediate UI feedback
                                  // Next.js Link will handle client-side navigation automatically
                                  setSelectedMainCategory(hoveredMegaCategoryData.slug)
                                  setSelectedSubCategories([sub.slug])
                                  setIsCategoryMegaMenuOpen(false)
                                }}
                              >
                                <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-16 lg:h-16 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {sub.image_url ? (
                                    <LazyImage
                                      src={sub.image_url}
                                      alt={sub.name}
                                      width={64}
                                      height={64}
                                      className="w-full h-full object-cover rounded-lg"
                                    />
                                  ) : (
                                    <Package className="w-6 h-6 sm:w-7 sm:h-7 lg:w-6 lg:h-6 text-orange-600 dark:text-orange-300" />
                                  )}
                                </div>
                                <span className="text-[9px] sm:text-[10px] font-medium text-center text-gray-700 dark:text-gray-200 line-clamp-2 mt-1">
                                  {sub.name}
                                </span>
                              </Link>
                            ))}
                            {/* Desktop: Show additional 8 items (total 12) */}
                            {recommendedMegaMenuSubCategories.slice(4, 12).map((sub: any) => (
                              <Link
                                key={sub.id}
                                href={`/products?mainCategory=${hoveredMegaCategoryData.slug}&subCategory=${sub.slug}`}
                                className="hidden lg:flex flex-col items-center gap-2 border-0 rounded-lg p-2 hover:shadow-md transition-all duration-300 ease-in-out transform hover:scale-110"
                                onClick={() => {
                                  // Update state for immediate UI feedback
                                  // Next.js Link will handle client-side navigation automatically
                                  setSelectedMainCategory(hoveredMegaCategoryData.slug)
                                  setSelectedSubCategories([sub.slug])
                                  setIsCategoryMegaMenuOpen(false)
                                }}
                              >
                                <div className="w-16 h-16 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {sub.image_url ? (
                                    <LazyImage
                                      src={sub.image_url}
                                      alt={sub.name}
                                      width={64}
                                      height={64}
                                      className="w-full h-full object-cover rounded-lg"
                                    />
                                  ) : (
                                    <Package className="w-6 h-6 text-orange-600 dark:text-orange-300" />
                                  )}
                                </div>
                                <span className="text-[10px] font-medium text-center text-gray-700 dark:text-gray-200 line-clamp-2 mt-1">
                                  {sub.name}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {chunkedMegaMenuSubCategories.length > 0 ? (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                          {chunkedMegaMenuSubCategories.map((subGroup, idx) => (
                            <div key={idx} className="space-y-2">
                              {subGroup.map((sub: any) => (
                                <Link
                                  key={sub.id}
                                  href={`/products?mainCategory=${hoveredMegaCategoryData.slug}&subCategory=${sub.slug}`}
                                  className="group flex items-center justify-between py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-all duration-300 ease-in-out transform hover:scale-105"
                                  onClick={() => {
                                    // Update state for immediate UI feedback
                                    // Next.js Link will handle client-side navigation automatically
                                    setSelectedMainCategory(hoveredMegaCategoryData.slug)
                                    setSelectedSubCategories([sub.slug])
                                    setIsCategoryMegaMenuOpen(false)
                                  }}
                                >
                                  <span>{sub.name}</span>
                                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          No subcategories available yet.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Select a main category to view subcategories.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Ads Container - Right after category nav (Mobile) */}
      {/* Hide ads when search is active */}
      {currentPage < 2 && !actualSearchQuery && (
      <div className="lg:hidden w-full overflow-x-hidden" style={{ minHeight: '1px', marginTop: '114px', position: 'relative' }}>
        <div 
          className="relative overflow-hidden rounded-none"
          style={{ 
            width: '100vw', 
            marginLeft: 'calc(50% - 50vw)', 
            marginRight: 'calc(50% - 50vw)',
            position: 'relative'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Previous Arrow */}
          {!adsLoading && advertisements.length > 1 && (
          <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault()
                setCurrentAdIndex((prev: number) => prev === 0 ? advertisements.length - 1 : prev - 1)
              }}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 z-30 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 sm:p-3 transition-all duration-200 shadow-lg hover:shadow-xl"
              aria-label="Previous ad"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
          
          {/* Next Arrow */}
          {!adsLoading && advertisements.length > 1 && (
            <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault()
                setCurrentAdIndex((prev: number) => (prev + 1) % advertisements.length)
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 z-30 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 sm:p-3 transition-all duration-200 shadow-lg hover:shadow-xl"
              aria-label="Next ad"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {adsLoading ? (
            <div className="block h-48 sm:h-64 md:h-80 relative z-0">
              <div className="relative overflow-hidden rounded-none h-full bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Loading advertisement...</p>
              </div>
            </div>
          ) : advertisements.length > 0 && advertisements[currentAdIndex] ? (
            <Link 
              href={advertisements[currentAdIndex].link_url || "/products"}
              className="block cursor-pointer h-48 sm:h-64 md:h-80 relative z-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="relative overflow-hidden rounded-none h-full bg-gray-100 dark:bg-gray-800">
                {advertisements[currentAdIndex].media_type === 'image' ? (
                  <LazyImage
                    src={advertisements[currentAdIndex].media_url}
                    alt={advertisements[currentAdIndex].title}
                    fill
                    className="object-contain transition-opacity duration-500"
                    priority={currentAdIndex === 0}
                    quality={85}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
                  />
                ) : (
                  <video
                    key={currentAdIndex}
                    src={advertisements[currentAdIndex].media_url}
                    className="w-full h-full object-contain transition-opacity duration-500"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                )}
                {/* Ad Title Overlay */}
                {advertisements[currentAdIndex].title && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-white text-xs sm:text-sm font-medium truncate" suppressHydrationWarning>
                      {advertisements[currentAdIndex].title}
                    </p>
                  </div>
                )}
              </div>
            </Link>
          ) : (
            <div className="block h-48 sm:h-64 md:h-80 relative z-0">
              <div className="relative overflow-hidden rounded-none h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>No advertisements available</p>
              </div>
            </div>
          )}
          
          {/* Ad Navigation Dots */}
          {!adsLoading && advertisements.length > 1 && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 z-10">
              {advertisements.map((_: any, index: number) => (
                <button
                  key={index}
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault()
                    setCurrentAdIndex(index)
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentAdIndex 
                      ? 'bg-white w-6' 
                      : 'bg-white/50 hover:bg-white/75'
                  }`}
                  aria-label={`Go to ad ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Ads Container - Right after category nav (Desktop) */}
      {/* Hide ads when search is active */}
      {currentPage < 2 && !actualSearchQuery && (
      <div className="hidden lg:block w-full overflow-x-hidden" style={{ minHeight: '1px', marginTop: '125px' }}>
            <div 
              className="relative overflow-hidden rounded-none"
              style={{ 
                width: '100vw', 
                marginLeft: 'calc(50% - 50vw)', 
                marginRight: 'calc(50% - 50vw)'
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Previous Arrow */}
              {!adsLoading && advertisements.length > 1 && (
              <button
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault()
                    setCurrentAdIndex((prev: number) => prev === 0 ? advertisements.length - 1 : prev - 1)
                  }}
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 z-30 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 sm:p-3 transition-all duration-200 shadow-lg hover:shadow-xl"
                  aria-label="Previous ad"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
              
              {/* Next Arrow */}
              {!adsLoading && advertisements.length > 1 && (
                <button
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault()
                    setCurrentAdIndex((prev: number) => (prev + 1) % advertisements.length)
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 z-30 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 sm:p-3 transition-all duration-200 shadow-lg hover:shadow-xl"
                  aria-label="Next ad"
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              )}

              {adsLoading ? (
                <div className="block h-48 sm:h-64 md:h-80 relative z-0">
                  <div className="relative overflow-hidden rounded-none h-full bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Loading advertisement...</p>
                  </div>
                </div>
              ) : advertisements.length > 0 && advertisements[currentAdIndex] ? (
                <Link 
                  href={advertisements[currentAdIndex].link_url || "/products"}
                  className="block cursor-pointer h-48 sm:h-64 md:h-80 relative z-0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="relative overflow-hidden rounded-none h-full bg-gray-100 dark:bg-gray-800">
                    {advertisements[currentAdIndex].media_type === 'image' ? (
                      <LazyImage
                        src={advertisements[currentAdIndex].media_url}
                        alt={advertisements[currentAdIndex].title}
                        fill
                        className="object-contain transition-opacity duration-500"
                        priority={currentAdIndex === 0} // Priority for first ad
                        quality={85}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
                      />
                    ) : (
                      <video
                        key={currentAdIndex}
                        src={advertisements[currentAdIndex].media_url}
                        className="w-full h-full object-contain transition-opacity duration-500"
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                    )}
                    {/* Ad Title Overlay */}
                    {advertisements[currentAdIndex].title && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <p className="text-white text-xs sm:text-sm font-medium truncate" suppressHydrationWarning>
                          {advertisements[currentAdIndex].title}
                        </p>
        </div>
                    )}
                  </div>
                </Link>
              ) : (
                <div className="block h-48 sm:h-64 md:h-80 relative z-0">
                  <div className="relative overflow-hidden rounded-none h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>No advertisements available</p>
                  </div>
                </div>
              )}
              
              {/* Ad Navigation Dots */}
              {!adsLoading && advertisements.length > 1 && (
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 z-10">
                  {advertisements.map((_: any, index: number) => (
                    <button
                      key={index}
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.preventDefault()
                        setCurrentAdIndex(index)
                      }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentAdIndex 
                          ? 'bg-white w-6' 
                          : 'bg-white/50 hover:bg-white/75'
                      }`}
                      aria-label={`Go to ad ${index + 1}`}
                    />
            ))}
              </div>
              )}
            </div>
          </div>
      )}

      <main className={cn(
        "flex-1", 
        // When search is active, reduce padding since ads/categories are hidden
        actualSearchQuery
          ? "pt-[114px] sm:pt-[114px] lg:pt-[125px]" // Start right after header (no ads/categories)
          : currentPage >= 2 
            ? "pt-[114px] sm:pt-[114px] lg:pt-[125px]" // Start right after category nav (matches ad section positioning)
            : "pt-24 xs:pt-24 sm:pt-24 -mt-12 lg:-mt-16", 
        themeClasses.mainBg
      )} suppressHydrationWarning>
        <div className="container mx-auto px-4 pt-0 pb-0">
          <div className="-mb-4">
            <EmailVerificationBanner />
          </div>
        </div>

        {/* Filter and Sort Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 px-1 sm:px-2 lg:px-3 mt-2" suppressHydrationWarning>
          {/* Left Side - Filter Buttons and Product Count */}
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto" suppressHydrationWarning>
            {/* Filter Buttons */}
            <div className="flex flex-col gap-1" suppressHydrationWarning>
              <span className={cn("text-[10px] sm:text-xs uppercase tracking-wide", themeClasses.textNeutralSecondary)}>Filter by</span>
              <div className="flex items-center gap-2">
              {/* Price Filter Button */}
              <Dialog open={isPriceFilterOpen} onOpenChange={setIsPriceFilterOpen}>
                <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex items-center gap-1 sm:gap-2 bg-transparent group h-8 sm:h-10",
                    themeClasses.mainText,
                    themeClasses.borderNeutralSecondary,
                      (priceRange[0] > 0 || priceRange[1] < 100000) && "border-yellow-500 text-yellow-500"
                    )}
                  >
                    <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 group-hover:text-yellow-500 transition-colors" />
                    <span className="text-xs sm:text-sm group-hover:text-yellow-500 transition-colors">
                      Price
                    </span>
                </Button>
                </DialogTrigger>
                <DialogContent className={cn("sm:max-w-md", themeClasses.cardBg, themeClasses.mainText)}>
                  <DialogHeader>
                    <DialogTitle>Filter by Price</DialogTitle>
                    <p className="text-sm text-muted-foreground">Adjust the price range to filter products</p>
                  </DialogHeader>
                  <div className="mt-6 space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Price Range: {priceRange[0]} - {priceRange[1]} TZS</Label>
                      <Slider
                        value={priceRange}
                        onValueChange={handlePriceFilterChange}
                        max={100000}
                        min={0}
                        step={1000}
                        className="mt-2"
                      />
                        </div>
                    <div className="flex gap-2">
                  <Button
                        onClick={() => setPriceRange([0, 100000])}
                    variant="outline"
                    size="sm"
                        className="flex-1"
                  >
                        Reset
                  </Button>
                  <Button
                        onClick={() => setIsPriceFilterOpen(false)}
                        size="sm"
                        className="flex-1 bg-yellow-500 hover:bg-yellow-600"
                  >
                        Apply
                  </Button>
                </div>
              </div>
                </DialogContent>
              </Dialog>

              {/* Category Filter Button */}

              {/* Clear All Filters Button */}
            <Button
              variant="outline"
              size="sm"
                onClick={handleClearAllFilters}
              className={cn(
                  "flex items-center gap-1 sm:gap-2 bg-transparent group h-8 sm:h-10",
                themeClasses.mainText,
                themeClasses.borderNeutralSecondary,
              )}
            >
                <X className="w-3 h-3 sm:w-4 sm:h-4 group-hover:text-yellow-500 transition-colors" />
              <span className="text-xs sm:text-sm group-hover:text-yellow-500 transition-colors">
                  Clear all
              </span>
            </Button>
              </div>
            </div>

            {/* Product Count */}
            <span className={cn("text-xs sm:text-sm whitespace-nowrap flex items-center gap-1", themeClasses.textNeutralSecondary)}>
              <Package className={cn("w-3 h-3 sm:w-4 sm:h-4", themeClasses.textNeutralSecondary)} />
              {primaryLoading && displayedProducts.length === 0 ? (
                "Loading products..."
              ) : (
                `${displayedProducts.length}${primaryTotalCount > 0 ? ` of ${primaryTotalCount}` : ''} product${displayedProducts.length !== 1 ? 's' : ''}`
              )}
            </span>
          </div>

          {/* Right Side - Sort Dropdown */}
          <div className="hidden sm:flex items-center gap-2 w-full sm:w-auto" suppressHydrationWarning>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                variant="outline"
                size="sm"
                className={cn(
                  "flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-between bg-transparent group h-8 sm:h-10",
                  themeClasses.mainText,
                  themeClasses.borderNeutralSecondary,
                )}
              >
                <span className="text-xs sm:text-sm group-hover:text-yellow-500 transition-colors">
                    Sort by: {sortOrder === 'featured' ? 'Featured' : 
                              sortOrder === 'price-low' ? 'Price: Low to High' :
                              sortOrder === 'price-high' ? 'Price: High to Low' :
                              sortOrder === 'newest' ? 'Newest Arrivals' :
                              sortOrder === 'best-selling' ? 'Best Selling' : 'Price: Low to High'}
                </span>
                <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 group-hover:text-yellow-500 transition-colors" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn(themeClasses.cardBg, themeClasses.mainText, themeClasses.cardBorder)}
            >
              <DropdownMenuItem 
                className={themeClasses.buttonGhostHoverBg}
                onClick={() => handleSortChange('featured')}
              >
                <Star className="w-4 h-4 mr-2" /> Featured
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={themeClasses.buttonGhostHoverBg}
                onClick={() => handleSortChange('price-low')}
              >
                <TrendingUp className="w-4 h-4 mr-2" /> Price: Low to High
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={themeClasses.buttonGhostHoverBg}
                onClick={() => handleSortChange('price-high')}
              >
                <TrendingDown className="w-4 h-4 mr-2" /> Price: High to Low
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={themeClasses.buttonGhostHoverBg}
                onClick={() => handleSortChange('newest')}
              >
                <Clock className="w-4 h-4 mr-2" /> Newest Arrivals
              </DropdownMenuItem>
              <DropdownMenuItem
                className={themeClasses.buttonGhostHoverBg}
                onClick={() => handleSortChange('best-selling')}
              >
                <Star className="w-4 h-4 mr-2" /> Best Selling
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
              </div>
            </div>

        {/* Main Categories Thumbnails (images only) */}
        {/* Hide categories when search is active */}
        {categoriesData.mainCategories.length > 0 && currentPage < 2 && !actualSearchQuery && (
          <div className="px-1 sm:px-2 lg:px-3 mt-2 mb-4 relative">
            <div className={cn("text-lg sm:text-xl font-bold mb-2 text-center", themeClasses.mainText)}>
              Shop by Categories
            </div>
            <div className="relative">
              {/* Left Arrow Button */}
              {showLeftArrow && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 dark:bg-neutral-800/90 hover:bg-white dark:hover:bg-neutral-800 shadow-md"
                  onClick={() => {
                    if (categoriesScrollRef.current) {
                      const scrollAmount = 200
                      categoriesScrollRef.current.scrollTo({
                        left: categoriesScrollRef.current.scrollLeft - scrollAmount,
                        behavior: 'smooth'
                      })
                    }
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              
              {/* Right Arrow Button */}
              {showRightArrow && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 dark:bg-neutral-800/90 hover:bg-white dark:hover:bg-neutral-800 shadow-md"
                  onClick={() => {
                    if (categoriesScrollRef.current) {
                      const scrollAmount = 200
                      categoriesScrollRef.current.scrollTo({
                        left: categoriesScrollRef.current.scrollLeft + scrollAmount,
                        behavior: 'smooth'
                      })
                    }
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}

              <div 
                ref={categoriesScrollRef}
                className="flex items-center gap-3 overflow-x-auto py-2 scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onScroll={() => {
                  if (categoriesScrollRef.current) {
                    const { scrollLeft, scrollWidth, clientWidth } = categoriesScrollRef.current
                    setShowLeftArrow(scrollLeft > 0)
                    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
                  }
                }}
              >
                {categoriesData.mainCategories
                  .slice(0, 12)
                  .map((cat: any) => (
                    <Link
                      key={cat.id}
                      href={`/products?mainCategory=${cat.slug}`}
                      className="flex flex-col items-center flex-shrink-0 w-20 sm:w-40"
                      prefetch={true}
                      scroll={false}
                    >
                      {cat.image_url ? (
                        <div className="w-16 h-16 sm:w-[136px] sm:h-[136px] rounded-full overflow-hidden border-2 border-white bg-white">
                          <Image
                            src={cat.image_url}
                            alt={cat.name}
                            width={136}
                            height={136}
                            className="w-16 h-16 sm:w-[136px] sm:h-[136px] object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 sm:w-[136px] sm:h-[136px] rounded-full overflow-hidden border-2 border-white bg-gradient-to-br from-yellow-100 to-yellow-300 dark:from-neutral-800 dark:to-neutral-700 flex items-center justify-center text-sm sm:text-base font-semibold">
                          {cat.name?.slice(0, 2) || 'NA'}
                        </div>
                      )}
                      <span className="mt-2 text-xs text-center line-clamp-2" title={cat.name}>
                        <span className="sm:hidden">{cat.name?.split(' ')[0] || cat.name}</span>
                        <span className="hidden sm:inline">{cat.name}</span>
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Promotional Text Below Advertisement */}
        <div className="px-1 sm:px-2 lg:px-3 mb-6">
          <div className="text-center">
            <h2 
              className={`text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-black dark:text-white mb-1 font-sans ${
                getTransitionClass(transitionType, isFading)
              }`}
              style={{ minHeight: '1.5em' }}
            >
              {(() => {
                const currentTextIndex = shuffledPromoOrder[currentPromoIndex]
                const promoItem = promotionalTexts[currentTextIndex]
                const isMegaChoiceText = promoItem.text === "Mega Choice For You Up To 40% Off"
                const isFreeShipping = promoItem.text === "Free Shipping Today"
                const animationClass = getAnimationClass(promoItem.animation)
                const decoration = getDecoration(promoItem.decoration)
                
                // For Free Shipping, wrap in a container that spans full width for sliding animation
                // Truck icon should flip horizontally when moving right (point right)
                if (isFreeShipping) {
                  return (
                    <div className="relative w-full overflow-hidden" style={{ minHeight: '1.5em' }}>
                      <span className={`inline-flex items-center gap-2 ${animationClass} absolute whitespace-nowrap`}>
                        <span className="flex-shrink-0 text-blue-500 animate-[flipTruck_25s_ease-in-out_infinite]">🚚</span>
                        <span>{promoItem.text}</span>
                      </span>
                    </div>
                  )
                }
                
                return (
                  <span className={`inline-flex items-center gap-2 ${animationClass}`}>
                    {decoration && <span className="flex-shrink-0">{decoration}</span>}
                    {isMegaChoiceText ? (
                      <>
                        Mega Choice For You Up To <span className="text-blue-500 dark:text-blue-400" style={{ fontFamily: "'Times New Roman', serif" }}>40%</span> Off
                      </>
                    ) : (
                      <span>{promoItem.text}</span>
                    )}
                  </span>
                )
              })()}
            </h2>
          </div>
        </div>

        {/* Loading State - Removed for faster UX */}

        {/* Error State (Rate limiting and other errors) */}
        {error && !primaryLoading && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 px-4 text-center">
            <Package className="w-16 h-16 text-red-400 mb-4" />
                <h3 className={cn("text-lg font-semibold mb-2", themeClasses.mainText)}>
              Error Loading Products
                </h3>
                <p className={cn("text-sm mb-6 max-w-md", themeClasses.textNeutralSecondary)}>
              {error || 'Failed to load products'}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                onClick={primaryRefresh}
                    className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
                  >
                Try Again
                  </Button>
                  <Button
                    variant="outline"
                onClick={() => router.refresh()}
                    className={cn(
                      "border-neutral-300 hover:bg-neutral-100",
                      themeClasses.mainText,
                      themeClasses.borderNeutralSecondary,
                    )}
                  >
                Refresh Page
                  </Button>
                    </div>
            </div>
          )}


                {/* Products Grid */}
        <div ref={productsSectionRef} id="products-section">
        {/* Only show skeleton if: loading AND no products AND no cached data loaded - prevent multiple skeletons */}
        {(showSkeleton && primaryLoading && primaryProducts.length === 0 && !hasDataLoaded) ? (
          // Skeleton Loading State - only show when actually loading and no data available
          <div className="px-1 sm:px-2 lg:px-3">
            <ProductGridSkeleton count={24} />
          </div>
        ) : (noCategoryMatches || (displayedProducts.length === 0 && !primaryLoading && showNoProducts)) ? (
          <div className="px-4 py-10 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className={cn("text-xl font-semibold mb-2", themeClasses.mainText)}>
              Available soon
            </h3>
          </div>
        ) : !error ? (
          <InfiniteScrollTrigger
            onLoadMore={handleLoadMore}
            hasMore={hasMoreInBatch || hasMoreProducts}
            loading={primaryLoadingMore}
            error={error}
          >
            {/* Use virtual scrolling for large lists (50+ products), regular grid for smaller lists */}
            {(() => {
              const productsToDisplay = (actualSearchQuery || selectedMainCategory || selectedSubCategories.length > 0 || activeBrand || priceRange[0] > 0 || priceRange[1] < 100000)
                ? displayedProducts
                : (shuffledProducts.length > 0 ? shuffledProducts : displayedProducts)
              
              const useVirtualScrolling = productsToDisplay.length >= 50

              if (useVirtualScrolling) {
                // Virtual scrolling for large lists
                return (
                  <VirtualizedProductGrid
                    products={productsToDisplay}
                    themeClasses={themeClasses}
                    formatPrice={formatPrice}
                    isInCart={isInCart}
                    handleAddToCart={handleAddToCart}
                    pathname={pathname}
                    urlSearchParams={urlSearchParams}
                    onHover={handleProductHover}
                    className="px-1 sm:px-2 lg:px-3"
                    gap={4}
                    onItemsRendered={(startIndex, stopIndex) => {
                      // Trigger load more when user scrolls near the end
                      if (stopIndex >= productsToDisplay.length - 10 && (hasMoreInBatch || hasMoreProducts)) {
                        handleLoadMore()
                      }
                    }}
                  />
                )
              } else {
                // Regular grid for smaller lists
                return (
                  <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-8 gap-1 px-1 sm:px-2 lg:px-3" suppressHydrationWarning>
                    {productsToDisplay.length > 0 && (
                      <>
                        {/* All Product Cards - Memoized for Performance */}
                        {productsToDisplay.map((product: any, index: number) => (
                          <ProductCard
                            key={`${product.id}-${index}`}
                            product={product}
                            index={index}
                            themeClasses={themeClasses}
                            formatPrice={formatPrice}
                            isInCart={isInCart}
                            handleAddToCart={handleAddToCart}
                            pathname={pathname}
                            urlSearchParams={urlSearchParams}
                            onHover={handleProductHover}
                            priority={index < 6} // Priority for first 6 images (above the fold)
                          />
                        ))}
                      </>
                    )}
                  </div>
                )
              }
            })()}
          </InfiniteScrollTrigger>
        ) : null}
        </div>

        {/* Pagination Navigation */}
        <div className="flex flex-col items-center justify-center py-4 px-4 gap-4" suppressHydrationWarning>
          {/* Previous Page Button */}
          {currentPage > 1 && (
            <Link href={buildPreviousPageUrl()} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="bg-blue-500 text-white hover:bg-blue-600 px-8 py-4 text-base font-semibold"
              >
                ← Previous Page ({currentPage - 1})
              </Button>
            </Link>
          )}
          
          {/* Current Page Info */}
          <div className="text-center">
            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
              Page {currentPage} - Showing {displayedProducts.length} of {primaryTotalCount || allFilteredProducts.length} products
            </p>
          </div>
          
          {/* Next Page Button */}
          {hasNextPage && displayedProducts.length >= PRODUCTS_PER_PAGE && (
            <Link href={buildNextPageUrl()} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600 px-8 py-4 text-base font-semibold"
              >
                Next Page ({currentPage + 1}) →
              </Button>
            </Link>
          )}
        </div>
        
        {/* End of all products */}
        {!hasMoreProducts && !hasNextPage && displayedProducts.length > 0 && (
          <div className="flex justify-center py-8" suppressHydrationWarning>
            <p className={cn("text-lg", themeClasses.textNeutralSecondary)}>You've reached the end of the list!</p>
            </div>
        )}
        
      </main>


      {!primaryLoading && !primaryLoadingMore && <Footer />}

      {/* Category Navigation Modal */}
      <Sheet open={isCategoryNavOpen} onOpenChange={setIsCategoryNavOpen}>
        <SheetContent side="left" className={cn(themeClasses.cardBg, themeClasses.mainText, "w-80 sm:w-96", "bg-white dark:bg-neutral-900")}> 
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              All Categories
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              Browse products by category
            </p>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            {/* Main Categories View */}
            {!selectedMainCategory && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Main Categories</h3>
            <Button
                    onClick={handleClearCategoryFilters}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Clear All
                  </Button>
              </div>
                <div className="space-y-1">
                  {categoriesData.mainCategories.map((category: any) => {
                    const subcategoriesUnderMain = categoriesData.subCategories.filter((sub: any) => sub.parent_id === category.id)
                    const subcategoriesForThisMain = categoriesData.subCategories.filter((sub: any) => sub.parent_id === category.id)
                    const isMainCategorySelected = subcategoriesForThisMain.length > 0 && 
                      subcategoriesForThisMain.every((sub: any) => selectedSubCategories.includes(sub.slug)) &&
                      selectedSubCategories.every((slug: string) => subcategoriesForThisMain.some((sub: any) => sub.slug === slug))
                    
                    const areAllSubcategoriesSelected = isMainCategorySelected && 
                      subcategoriesUnderMain.every((sub: any) => selectedSubCategories.includes(sub.slug))
                    
                    return (
                      <div key={category.id} className="flex items-center gap-3 p-3 rounded-lg">
                        <div 
                          className="flex-shrink-0 cursor-pointer select-none p-1"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            
                            
                            // Toggle checkbox state
                            if (isMainCategorySelected) {
                              // Deselect main category and clear subcategories
                              setSelectedMainCategory(null)
                              setSelectedSubCategories([])
                              
                              // Update URL to remove category filters
                              const params = new URLSearchParams(urlSearchParams?.toString())
                              params.delete('mainCategory')
                              params.delete('subCategories')
                              const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
                              router.replace(nextUrl, { scroll: false }) // Use replace with scroll: false to prevent page jumping
                            } else {
                              // Select main category and all its subcategories WITHOUT opening subcategories view
                              // Don't set selectedMainCategory here - that opens the view
                              // Just set the subcategories and update URL
                              const allSubSlugs = subcategoriesUnderMain.map((sub: any) => sub.slug)
                              
                              
                              setSelectedSubCategories(allSubSlugs)
                              
                              // Update URL
                              const params = new URLSearchParams(urlSearchParams?.toString())
                              params.set('mainCategory', category.slug)
                              if (allSubSlugs.length > 0) {
                                params.set('subCategories', allSubSlugs.join(','))
                              } else {
                                params.delete('subCategories')
                              }
                              const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
                              router.replace(nextUrl, { scroll: false }) // Use replace with scroll: false to prevent page jumping
                            }
                          }}
                        >
                          <Checkbox
                            checked={isMainCategorySelected}
                            onCheckedChange={() => {}} // Handled by parent div onClick
                          />
            </div>
                        <div 
                          className="flex-1 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-2 -m-2"
                          onClick={() => handleOpenSubcategoriesView(category.slug)}
                        >
                          <div className="flex items-center gap-3">
                            <Package className="w-4 h-4" />
              <div className="flex flex-col">
                              <span className="font-medium">{category.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {subcategoriesUnderMain.length} subcategories
                              </span>
          </div>
                </div>
              </div>
                </div>
                    )
                  })}
                </div>
                </div>
            )}

            {/* Subcategories View */}
            {selectedMainCategory && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    onClick={handleBackToMainCategories}
                    variant="outline"
                    size="sm"
                    className="p-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h3 className="text-sm font-semibold">
                     {categoriesData.mainCategories.find((cat: any) => cat.slug === selectedMainCategory)?.name}
                  </h3>
              </div>
                
              <div className="space-y-1">
                  {/* All subcategories option */}
                  {(() => {
                    const currentMainCategory = categoriesData.mainCategories.find((cat: any) => cat.slug === selectedMainCategory)
                    const subcategoriesUnderMain = categoriesData.subCategories.filter((sub: any) => sub.parent_id === currentMainCategory?.id)
                    const allSubSlugs = subcategoriesUnderMain.map((sub: any) => sub.slug)
                    const areAllSelected = allSubSlugs.length > 0 && allSubSlugs.every(slug => selectedSubCategories.includes(slug))
                    
                  return (
                      <div className="flex items-center gap-3 p-3 rounded-lg">
                        <div 
                          className="flex-shrink-0 cursor-pointer select-none p-1"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (areAllSelected) {
                              setSelectedSubCategories([])
                            } else {
                              setSelectedSubCategories(allSubSlugs)
                            }
                          }}
                        >
                          <Checkbox
                            checked={areAllSelected}
                            onCheckedChange={() => {}} // Handled by parent div onClick
                          />
            </div>
                        <div 
                          className="flex-1 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-2 -m-2"
                      onClick={() => {
                            if (areAllSelected) {
                              setSelectedSubCategories([])
                            } else {
                              setSelectedSubCategories(allSubSlugs)
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Package className="w-4 h-4" />
                      <div className="flex flex-col">
                              <span className="font-medium">All Subcategories</span>
                              <span className="text-xs text-muted-foreground">Select all subcategories</span>
          </div>
        </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Individual subcategories */}
                   {categoriesData.subCategories
                     .filter((sub: any) => sub.parent_id === categoriesData.mainCategories.find((cat: any) => cat.slug === selectedMainCategory)?.id)
                     .map((subCategory: any) => (
                      <div key={subCategory.id} className="flex items-center gap-3 p-3 rounded-lg">
                        <div 
                          className="flex-shrink-0 cursor-pointer select-none p-1"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleSubCategoryToggle(subCategory.slug)
                          }}
                        >
                          <Checkbox
                            checked={selectedSubCategories.includes(subCategory.slug)}
                            onCheckedChange={() => {}} // Handled by parent div onClick
                          />
                </div>
                        <div 
                          className="flex-1 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-2 -m-2"
                          onClick={() => handleSubCategoryToggle(subCategory.slug)}
                        >
                          <div className="flex items-center gap-3">
                            <Package className="w-4 h-4" />
                            <div className="flex flex-col">
                              <span className="font-medium">{subCategory.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {subCategory.product_count || 0} products
                              </span>
              </div>
                </div>
              </div>
            </div>
                     ))}
          </div>
        </div>
            )}
      </div>

          {/* Footer Actions */}
          <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-2">
              <Button
                onClick={() => {
                  setIsCategoryNavOpen(false)
                }}
                className="w-full bg-yellow-500 hover:bg-yellow-600"
              >
                Apply Filters
              </Button>
              <Button
                onClick={() => {
                  handleClearCategoryFilters()
                  setIsCategoryNavOpen(false)
                }}
                variant="outline"
                className="w-full"
              >
              Clear All Filters
            </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile Hamburger Menu - Modern E-commerce Style */}
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
          {/* Search Section */}
          <div className="p-6 border-b border-white/10">
          <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
            <Input
              type="search"
                placeholder="Search products..."
                className="w-full pl-12 pr-4 py-3 bg-white/10 border-white/20 text-white placeholder:text-white/60 rounded-xl focus:ring-2 focus:ring-yellow-500/50"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
              }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitSearch()
                  }
                }}
            />
            </div>
          </div>

          {/* Main Navigation */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
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
                  
                  <button 
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => {
                      setIsHamburgerMenuOpen(false)
                    }}
                  >
                    <Search className="w-6 h-6 text-white group-hover:text-yellow-400 transition-colors" />
                    <span className="text-xs font-medium text-white">Search</span>
                  </button>
                </div>
              </div>



              {/* Account Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Account</h3>
                <div className="space-y-2">
                  {isAuthenticated ? (
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
                        className="w-full border-white/30 text-white hover:bg-white/10 py-3 rounded-xl"
                        onClick={() => {
                          setIsHamburgerMenuOpen(false)
                          openAuthModal('register')
                        }}
                      >
                        Create Account
                      </Button>
                    </div>
                  )}
                </div>
          </div>

              {/* Navigation */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Navigation</h3>
                <div className="space-y-2">
                  <Link 
                    href="/"
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                    onClick={() => setIsHamburgerMenuOpen(false)}
                  >
                    <Settings className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                    <span className="text-white font-medium">Service</span>
                    <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                  </Link>
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Settings</h3>
                
                {/* Theme Toggle Switch */}
                <div className="space-y-2">
                  <p className="text-xs text-white/70">Theme</p>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/10">
                    <div className="flex items-center gap-3">
                      {backgroundColor === 'dark' ? (
                        <Moon className="w-5 h-5 text-white" />
                      ) : (
                        <Sun className="w-5 h-5 text-white" />
                      )}
                      <span className="text-white font-medium text-sm">
                        {backgroundColor === 'dark' ? 'Dark' : 'Light'}
                      </span>
                    </div>
                    <Switch
                      checked={backgroundColor === 'dark'}
                      onCheckedChange={(checked) => {
                        setBackgroundColor(checked ? 'dark' : 'white')
                      }}
                      className="data-[state=checked]:bg-yellow-500"
                    />
                  </div>
                </div>

                {/* Currency Selection */}
                <div className="space-y-2">
                  <p className="text-xs text-white/70">Currency</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-10 text-xs ${currency === 'USD' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                      onClick={() => setCurrency('USD')}
                    >
                      <DollarSign className="w-3 h-3 mr-1" /> USD
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-10 text-xs ${currency === 'TZS' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                      onClick={() => setCurrency('TZS')}
                    >
                      <Landmark className="w-3 h-3 mr-1" /> TZS
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer with User Info */}
          <div className="p-6 border-t border-white/10 bg-gradient-to-r from-yellow-500/5 to-orange-500/5">
            {isAuthenticated && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10">
                <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
                  <span className="text-black font-bold text-sm">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">
                    {user?.email ? (() => {
                      const [localPart, domain] = user.email.split('@')
                      if (!domain) return user.email
                      const maskedLocal = localPart.length > 2 
                        ? `${localPart.substring(0, 2)}${'*'.repeat(Math.min(localPart.length - 2, 4))}`
                        : '***'
                      return `${maskedLocal}@${domain}`
                    })() : 'User'}
                  </p>
                  <p className="text-white/60 text-xs">Welcome back!</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>



      {/* China Import Modal */}
      {showChinaImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
                Import Notice
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-6">
                This item is not available in our local stock at the moment however we can import it directly from China within 3 – 5 days. Same price, same quality, just a short wait!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleChinaImportCancel}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChinaImportConfirm}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProductsPage() {
  return (
    <BuyerRouteGuard>
      <EmailVerificationBanner />
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <ProductsPageContent />
      </Suspense>
    </BuyerRouteGuard>
  )
} 