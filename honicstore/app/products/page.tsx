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
import { useOptimizedNavigation } from "@/components/optimized-link"
import { useRobustApi } from "@/hooks/use-robust-api"
import { useInfiniteProducts } from "@/hooks/use-infinite-products"
import { useCategoryFiltering } from "@/hooks/use-category-filtering"
import { InfiniteScrollTrigger } from "@/components/infinite-scroll-trigger"
import { SearchModal } from "@/components/search-modal"
import { SearchSuggestions } from "@/components/search-suggestions"
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
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
// import { useProducts } from "@/hooks/use-products" // Removed - using useProductsOptimized instead
import { useCart } from "@/hooks/use-cart" // Import useCart hook
import { useToast } from "@/hooks/use-toast" // Import useToast hook
import { checkProductStock, validateAutoSelectedStock } from "@/utils/stock-validation"
import { getLeftBadge, getRightBadge } from "@/utils/product-badges"
import { useCompanyContext } from "@/components/company-provider"
import { Footer } from "@/components/footer"
import { useCurrency } from "@/contexts/currency-context"
import { useAuth } from "@/contexts/auth-context"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { UserProfile } from "@/components/user-profile"

// Category icons mapping - simplified

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
    combination?: any
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
  // Categories scroll state
  const categoriesScrollRef = useRef<HTMLDivElement>(null)
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
    // Only update when query differs to avoid loops
    if (initial && initial !== searchTerm) {
      setSearchTerm(initial)
    }
    
    // Initialize category state from URL
    // Read again after potential cleanup above
    const urlMainCategory = urlSearchParams?.get('mainCategory') || null
    // Support both subCategory (singular) and subCategories (plural, comma-separated)
    const urlSubCategory = urlSearchParams?.get('subCategory')
    const urlSubCategoriesParam = urlSearchParams?.get('subCategories')
    const urlSubCategories = urlSubCategory 
      ? [urlSubCategory] 
      : (urlSubCategoriesParam?.split(',') || [])
    
    // Only set selectedMainCategory if it's different AND we're not in the middle of a checkbox operation
    // The checkbox should only set selectedSubCategories, not selectedMainCategory
    if (urlMainCategory && urlMainCategory !== selectedMainCategory) {
      // Set selectedMainCategory when mainCategory is in URL
      setSelectedMainCategory(urlMainCategory)
    }
    
    if (urlSubCategories.length > 0 && JSON.stringify(urlSubCategories) !== JSON.stringify(selectedSubCategories)) {
      setSelectedSubCategories(urlSubCategories)
    }
  }, [urlSearchParams])
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [searchModalInitialTab, setSearchModalInitialTab] = useState<'text' | 'image'>('text')
  const [imageSearchResults, setImageSearchResults] = useState<any[]>([])
  const [imageSearchKeywords, setImageSearchKeywords] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  // Submit search (updates URL and triggers server-side filtering)
  const submitSearch = useCallback(() => {
    const query = (searchTerm || '').trim()
    setShowSuggestions(false)
    setIsSearchFocused(false)
    const params = new URLSearchParams(urlSearchParams?.toString() || '')
    if (query) {
      params.set('search', query)
    } else {
      params.delete('search')
    }
    // keep other filters; drop returnTo to avoid loops
    params.delete('returnTo')
    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
    router.push(nextUrl)
  }, [router, urlSearchParams, searchTerm])


  // Handle image search results
  const handleImageSearch = useCallback((products: any[], keywords: string[]) => {
    setImageSearchResults(products)
    setImageSearchKeywords(keywords)
    // Clear other filters when doing image search
    setSearchTerm("")
  }, [])

  // Handle text search from modal
  const handleModalTextSearch = useCallback((query: string) => {
    setSearchTerm(query)
    // Clear image search results
    setImageSearchResults([])
    setImageSearchKeywords([])
  }, [])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setSearchTerm(suggestion)
    setShowSuggestions(false)
    setIsSearchFocused(false)
    // Preserve existing category params when applying a suggestion
    const params = new URLSearchParams(urlSearchParams?.toString())
    params.set('search', suggestion)
    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
    router.push(nextUrl)
  }, [router, urlSearchParams])

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
  
  // Rotating promotional text
  const promotionalTexts = [
    "More To Love",
    "Mega Choice For You Up To 40% Off",
    "What Are You Waiting For"
  ]
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0)
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
  const [isCategoryMegaMenuOpen, setIsCategoryMegaMenuOpen] = useState(false)
  const [hoveredMegaCategory, setHoveredMegaCategory] = useState<string | null>(null)
  const categoryMegaMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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
    if (categoryMegaMenuTimeoutRef.current) {
      clearTimeout(categoryMegaMenuTimeoutRef.current)
    }
    // Add 400ms delay before opening
    categoryMegaMenuTimeoutRef.current = setTimeout(() => {
    if (!isCategoryMegaMenuOpen) {
      setIsCategoryMegaMenuOpen(true)
    }
    }, 400)
  }, [isCategoryMegaMenuOpen])

  const closeCategoryMegaMenu = useCallback(() => {
    if (categoryMegaMenuTimeoutRef.current) {
      clearTimeout(categoryMegaMenuTimeoutRef.current)
    }
    categoryMegaMenuTimeoutRef.current = setTimeout(() => {
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

  // Show maximum 6 categories (no More button)
  useEffect(() => {
    if (categoriesData.mainCategories.length === 0) {
      return
    }
    
    // Show maximum 6 categories
    const maxCategories = categoriesData.mainCategories.slice(0, 6)
    setDesktopVisibleCategories(maxCategories)
    setDesktopOverflowCategories([])
  }, [categoriesData.mainCategories])
  
  const [sortOrder, setSortOrder] = useState('price-low')

  // Pagination state - URL-based page number
  const [currentPage, setCurrentPage] = useState(1)
  const PRODUCTS_PER_PAGE = 120
  const BATCH_SIZE = 24 // Load 24 at a time with infinite scroll

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

  const noResultsReason = useMemo(() => {
    if (searchTerm) return 'search'
    if (selectedSubCategories.length > 0) return 'sub category'
    if (selectedMainCategory) return 'category'
    if (activeBrand) return 'brand'
    if (priceRange[0] > 0 || priceRange[1] < 100000) return 'price range'
    return 'filters'
  }, [searchTerm, selectedSubCategories.length, selectedMainCategory, activeBrand, priceRange])




  // Calculate initial offset based on current page
  const initialOffset = (currentPage - 1) * PRODUCTS_PER_PAGE

  // Infinite scroll products hook for enhanced performance
  const {
    products: infiniteProducts,
    loading: infiniteLoading,
    loadingMore: infiniteLoadingMore,
    hasMore: infiniteHasMore,
    error: infiniteError,
    totalCount: infiniteTotalCount,
    loadMore: infiniteLoadMore,
    reset: infiniteReset,
    refresh: infiniteRefresh
  } = useInfiniteProducts({
    limit: BATCH_SIZE,
    initialOffset, // Start from page offset
    // Server-side filtering with PostgreSQL full-text search
    brand: activeBrand || undefined,
    search: searchTerm || undefined,
    categories: isCategoryFilterActive ? allCategoryIds : undefined,
    sortBy: sortOrder === 'featured' ? 'featured' : sortOrder === 'price-low' ? 'price' : sortOrder === 'price-high' ? 'price' : 'created_at',
    sortOrder: sortOrder === 'featured' ? 'desc' : sortOrder === 'price-high' ? 'desc' : 'asc',
    minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
    maxPrice: priceRange[1] < 100000 ? priceRange[1] : undefined,
    useOptimized: true,
    useMaterializedView: false,
    enabled: !categoriesLoading && !noCategoryMatches // Disable fetching if filter has no matching category IDs
  })

  // Force refetch when category parameters change
  useEffect(() => {
    if (allCategoryIds.length > 0 && !categoriesLoading) {
      // Reset and refetch when categories are loaded and we have category IDs
      infiniteReset()
    }
  }, [allCategoryIds, categoriesLoading, infiniteReset])

  // Reset products immediately when any filter changes to prevent showing old products
  useEffect(() => {
    infiniteReset()
  }, [selectedMainCategory, selectedSubCategories, activeBrand, searchTerm, priceRange, infiniteReset])
  
  // Get page from URL on mount
  useEffect(() => {
    const page = parseInt(urlSearchParams?.get('page') || '1')
    if (page > 0) {
      setCurrentPage(page)
    }
  }, [urlSearchParams])

  // Infinite scroll products hook for enhanced performance

  // Local clearFilters function (no more duplicate API calls!)
  const clearFilters = useCallback(() => {
    // Reset all filter states
    setPriceRange([0, 100000])
    setActiveBrand(null)
    setSearchTerm("")
    setSortOrder('price-low')
    // Reset infinite scroll - the hook will automatically refetch due to dependency changes
    infiniteReset()
  }, [infiniteReset])

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

  // Rotate promotional text with fade animation
  useEffect(() => {
    const interval = setInterval(() => {
      setIsFading(true)
      setTimeout(() => {
        setCurrentPromoIndex((prevIndex) => (prevIndex + 1) % promotionalTexts.length)
        setIsFading(false)
      }, 300) // Half of animation duration
    }, 3000) // Change text every 3 seconds
    
    return () => clearInterval(interval)
  }, [promotionalTexts.length])


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

  // Helper function to calculate minimum price from variants
  const getMinimumPrice = (productPrice: number, variants?: any[]): number => {
    if (!variants || variants.length === 0) {
      return productPrice
    }

    let minPrice = productPrice

    // Check primary values for minimum price
    variants.forEach((variant: any) => {
      if (variant.primaryValues) {
        variant.primaryValues.forEach((pv: any) => {
          if (pv.price) {
            const variantPrice = parseFloat(pv.price)
            if (variantPrice < minPrice) {
              minPrice = variantPrice
            }
          }
        })
      }
      
      // Check variant base price
      if (variant.price && variant.price < minPrice) {
        minPrice = variant.price
      }
    })

    return minPrice
  }

  // Use infinite scroll products as primary source, fallback to optimized products
  // Convert infinite products to match the expected interface
  const adaptedInfiniteProducts = infiniteProducts.map(product => ({
    ...product,
    description: product.description || '',
    image: product.image || '',
    category: product.category || '',
    brand: product.brand || '',
    originalPrice: product.original_price || product.price,
    original_price: product.original_price, // Keep original_price field for badge calculation
    inStock: product.in_stock,
    freeDelivery: product.free_delivery,
    sameDayDelivery: product.same_day_delivery,
    is_new: product.is_new, // For "New" badge calculation
    is_featured: (product as any).is_featured || false, // For "Featured" badge
    updated_at: product.updated_at, // For "New" badge calculation
    variants: product.product_variants || [],
    gallery: product.image ? [product.image] : [],
    specifications: {},
    variantConfig: (product as any).variant_config
  }))

  // Use server-side filtering with PostgreSQL full-text search
  const products = imageSearchResults.length > 0 ? imageSearchResults : adaptedInfiniteProducts as any

  // Old shuffling system removed - now using smart shuffling system above

  // Smart Product Shuffling System
  const [shuffledProducts, setShuffledProducts] = useState<any[]>([])
  const [isShufflingPaused, setIsShufflingPaused] = useState(false)
  // Use ref to avoid re-renders on every user activity
  const userActivityTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const shuffleIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isUserActiveRef = useRef(false)
  
  // Shuffling configuration
  const SHUFFLE_INTERVAL = 30000 // 30 seconds
  const IDLE_TIMEOUT = 5000 // 5 seconds of inactivity before resuming
  
  // Shuffle products function
  const shuffleProducts = useCallback((products: any[]) => {
    if (products.length === 0) return products
    
    const shuffled = [...products]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }, [])
  
  // Keep shuffled list in sync when new products arrive (append-only to preserve current order)
  useEffect(() => {
    if (products.length === 0) return
    if (shuffledProducts.length === 0) {
      setShuffledProducts(products)
      return
    }
    if (products.length > shuffledProducts.length) {
      const existingIds = new Set(shuffledProducts.map((p: any) => p.id))
      const newOnes = products.filter((p: any) => !existingIds.has(p.id))
      if (newOnes.length > 0) {
        setShuffledProducts((prev: any[]) => [...prev, ...newOnes])
      }
    }
  }, [products, shuffledProducts])

  // When filters/search/categories change, reset the shuffle buffer so we only show the new filtered list
  useEffect(() => {
    setShuffledProducts([])
  }, [activeBrand, searchTerm, selectedMainCategory, selectedSubCategories, priceRange])

  // Server-side filtering is now handled by the API!
  // Build the list to display (uses shuffled order when active)
  const displayedProducts = useMemo(() => {
    // If we're loading, return empty to show skeleton
    if (infiniteLoading) {
      return []
    }
    
    // Always use the current products array from the API
    // Never fall back to shuffledProducts when filters are active - always show what API returns
    const hasActiveFilters = searchTerm || selectedMainCategory || selectedSubCategories.length > 0 || activeBrand || priceRange[0] > 0 || priceRange[1] < 100000
    
    // If we have active filters, only use products from API (never shuffledProducts)
    // This ensures we show "no products found" message when filters return no results
    if (hasActiveFilters) {
      const seen = new Set<number>()
      const uniqueProducts = products.filter((product: any) => {
        if (seen.has(product.id)) return false
        seen.add(product.id)
        return true
      })
      return uniqueProducts.slice(0, PRODUCTS_PER_PAGE)
    }
    
    // No active filters - can use shuffledProducts as fallback for better UX
    const baseList = products.length > 0 ? products : shuffledProducts

    const seen = new Set<number>()
    const uniqueProducts = baseList.filter((product: any) => {
      if (seen.has(product.id)) return false
      seen.add(product.id)
      return true
    })
    return uniqueProducts.slice(0, PRODUCTS_PER_PAGE)
  }, [products, shuffledProducts, PRODUCTS_PER_PAGE, searchTerm, selectedMainCategory, selectedSubCategories, activeBrand, priceRange, infiniteLoading])

  // Track initial load state - more aggressive loading
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [hasDataLoaded, setHasDataLoaded] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(true)
  
  useEffect(() => {
    // Set initial load to false after a longer delay
    const timer = setTimeout(() => setIsInitialLoad(false), 3000) // 3 seconds
    return () => clearTimeout(timer)
  }, [])
  
  // Track when we have actual data
  useEffect(() => {
    if (displayedProducts.length > 0) {
      setHasDataLoaded(true)
      // Hide skeleton after data loads and a short delay
      setTimeout(() => setShowSkeleton(false), 1000)
    }
  }, [displayedProducts.length])
  
  // More aggressive loading condition
  const isLoading = infiniteLoading || categoriesLoading || isInitialLoad || !hasDataLoaded
  const error = infiniteError
  

  // Handle user activity detection
  const handleUserActivity = useCallback(() => {
    isUserActiveRef.current = true
    setIsShufflingPaused(true)
    
    // Clear existing timeout
    if (userActivityTimeoutRef.current) {
      clearTimeout(userActivityTimeoutRef.current)
    }
    
    // Set new timeout to resume shuffling
    const timeout = setTimeout(() => {
      isUserActiveRef.current = false
      setIsShufflingPaused(false)
    }, IDLE_TIMEOUT)
    
    userActivityTimeoutRef.current = timeout
  }, [IDLE_TIMEOUT])
  
  // Set up shuffling interval
  useEffect(() => {
    if (shuffledProducts.length > 0 && !isShufflingPaused) {
      shuffleIntervalRef.current = setInterval(() => {
        if (!isUserActiveRef.current) {
          setShuffledProducts((prev: any[]) => shuffleProducts(prev))
        }
      }, SHUFFLE_INTERVAL)
    }
    
    return () => {
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current)
      }
    }
  }, [shuffledProducts.length, isShufflingPaused, SHUFFLE_INTERVAL])
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (userActivityTimeoutRef.current) {
        clearTimeout(userActivityTimeoutRef.current)
      }
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current)
      }
    }
  }, [])
  
  // Event listeners for user activity
  useEffect(() => {
    const events = ['scroll', 'mousemove', 'keydown', 'touchstart', 'click']
    
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true })
    })
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity)
      })
    }
  }, [handleUserActivity])
  
  // Specific pause triggers for search and filters
  const handleSearchActivity = useCallback(() => {
    handleUserActivity()
  }, [handleUserActivity])
  
  const handleFilterActivity = useCallback(() => {
    handleUserActivity()
  }, [handleUserActivity])
  
  const handleProductHover = useCallback(() => {
    handleUserActivity()
  }, [handleUserActivity])
  
  // Removed UI badge for shuffle/pause status
  
  // Note: Price filtering, category filtering, and sorting are now done server-side
  // The API endpoint handles these parameters automatically

  // Check if we have more products beyond the current page limit
  const hasMoreProducts = infiniteHasMore && displayedProducts.length < PRODUCTS_PER_PAGE
  const hasNextPage = infiniteTotalCount > PRODUCTS_PER_PAGE || (displayedProducts.length >= PRODUCTS_PER_PAGE && infiniteHasMore)
  const currentPageProductCount = displayedProducts.length
  
  // Build next page URL with current filters
  const buildNextPageUrl = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', (currentPage + 1).toString())
    
    if (activeBrand) params.set('brand', activeBrand)
    if (searchTerm) params.set('search', searchTerm)
    // Sort parameter removed - use default sorting
    if (priceRange[0] > 0) params.set('minPrice', priceRange[0].toString())
    if (priceRange[1] < 100000) params.set('maxPrice', priceRange[1].toString())
    
    return `/products?${params.toString()}`
  }, [currentPage, activeBrand, searchTerm, priceRange])

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




  // Helper function to get attribute values for a specific type
  const getAttributeValuesForType = (type: string, variants?: any[], variantConfig?: any): string[] => {
    if (!variants) return []
    
    const values = new Set<string>()
    
    // Check if this is a primary attribute with multiple values
    if ((variantConfig?.type === 'primary-dependent' && type === variantConfig.primaryAttribute) ||
        (variantConfig?.type === 'multi-dependent' && variantConfig.primaryAttributes?.includes(type)) ||
        (variantConfig?.type === 'simple' && type === variantConfig.primaryAttribute)) {
      
      variants.forEach((variant: any) => {
        if (variant.primaryValues) {
          variant.primaryValues.forEach((primaryValue: any) => {
            if (primaryValue.value && (variantConfig?.type === 'primary-dependent' || 
                (variantConfig?.type === 'multi-dependent' && primaryValue.attribute === type) ||
                (variantConfig?.type === 'simple' && primaryValue.attribute === type))) {
              values.add(primaryValue.value)
            }
          })
        }
      })
    } else {
      // Check if this is a multi-value attribute (array of objects in attributes)
      const hasArrayValues = variants.some((variant: any) => 
        variant.attributes?.[type] && Array.isArray(variant.attributes[type])
      )
      
      if (hasArrayValues) {
        variants.forEach((variant: any) => {
          if (variant.attributes?.[type] && Array.isArray(variant.attributes[type])) {
            variant.attributes[type].forEach((item: any) => {
              if (item) {
                // Handle both object format {value: "white"} and string format "white"
                const value = typeof item === 'object' && item.value ? item.value : item
                if (value) {
                  values.add(value)
                }
              }
            })
          }
        })
      } else {
        // For regular attributes
        variants.forEach((variant: any) => {
          if (variant.attributes && variant.attributes[type]) {
            values.add(variant.attributes[type])
          }
        })
      }
    }
    
    return Array.from(values)
  }

  // Helper function to calculate price for a combination (MEMOIZED for performance)
  const calculatePriceForCombination = useCallback((combination: { [key: string]: string | string[] }, variants?: any[], variantConfig?: any, basePrice?: number): number => {
    if (!variants || !variantConfig) return basePrice || 0
    
    // For primary-dependent logic, find the primary attribute price
    if (variantConfig.type === 'primary-dependent' && variantConfig.primaryAttribute) {
      const primaryValue = combination[variantConfig.primaryAttribute]
      if (primaryValue) {
        const variant = variants.find((v: any) => 
          v.primaryValues?.some((pv: any) => pv.value === primaryValue)
        )
        if (variant) {
          const primaryValueObj = variant.primaryValues?.find((pv: any) => pv.value === primaryValue)
          if (primaryValueObj && primaryValueObj.price) {
            return parseFloat(primaryValueObj.price)
          }
        }
      }
    }
    
    // Fallback to base price
    return basePrice || 0
  }, [])

  // Filter functions
  const handlePriceFilterChange = (newRange: [number, number]) => {
    setPriceRange(newRange)
  }


  const handleClearAllFilters = () => {
    setSelectedMainCategory(null)
    setSelectedSubCategories([])
    clearFilters()
    
    // Update URL to remove category parameters
    const params = new URLSearchParams(urlSearchParams?.toString())
    params.delete('mainCategory')
    params.delete('subCategory')
    params.delete('subCategories')
    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
    router.push(nextUrl)
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
    router.push(nextUrl)
  }

  const handleBackToMainCategories = () => {
    setSelectedMainCategory(null)
    setSelectedSubCategories([])
    
    // Update URL
    const params = new URLSearchParams(urlSearchParams?.toString())
    params.delete('mainCategory')
    params.delete('subCategory')
    params.delete('subCategories')
    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
    router.push(nextUrl)
  }

  const handleClearCategoryFilters = () => {
    setSelectedMainCategory(null)
    setSelectedSubCategories([])
    
    // Update URL
    const params = new URLSearchParams(urlSearchParams?.toString())
    params.delete('mainCategory')
    params.delete('subCategory')
    params.delete('subCategories')
    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
    router.push(nextUrl)
  }

  const handleSortChange = (newSortOrder: string) => {
    setSortOrder(newSortOrder)
  }

  // Handle China import modal
  const handleChinaImportConfirm = () => {
    if (pendingCartItem) {
      addItem(
        pendingCartItem.productId,
        pendingCartItem.quantity,
        pendingCartItem.variantId,
        pendingCartItem.combination,
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

  const handleAddToCart = async (productId: number, productName: string, productPrice: number, productVariants?: any[], variantConfig?: any) => {
    
    // Check if product has variants/attributes
    let hasVariants = productVariants && productVariants.length > 0
    let hasAttributes = variantConfig && Object.keys(variantConfig).length > 0
    
    // If variants array exists but is empty, fetch full product data
    let fullProductData = null
    if (Array.isArray(productVariants) && productVariants.length === 0) {
      try {
        const response = await fetch(`/api/products/${productId}`)
        if (response.ok) {
          fullProductData = await response.json()
          
          productVariants = fullProductData.variants || []
          variantConfig = fullProductData.variantConfig || null
          hasVariants = productVariants && productVariants.length > 0
          hasAttributes = variantConfig && Object.keys(variantConfig).length > 0
        }
      } catch (error) {
      }
    }

    // Check basic product stock before proceeding
    const productForStockCheck = products.find((p: any) => p.id === productId) || fullProductData
    if (productForStockCheck) {
      const stockCheck = checkProductStock(productForStockCheck)
      
      if (!stockCheck.isAvailable) {
        toast({
          title: "Out of Stock",
          description: stockCheck.message || "This product is currently unavailable.",
          variant: "destructive",
        })
        return
      }
    }
    
    if (hasVariants || hasAttributes) {
      
      // Get attribute types from variant config or variants
      const attributeTypes: string[] = []
      
      if (variantConfig?.primaryAttribute) {
        attributeTypes.push(variantConfig.primaryAttribute)
      }
      
      if (variantConfig?.attributeOrder) {
        variantConfig.attributeOrder.forEach((attr: string) => {
          if (!attributeTypes.includes(attr)) {
            attributeTypes.push(attr)
          }
        })
      }
      
      // Extract attributes from variants if not in config
      if (productVariants) {
        productVariants.forEach((variant: any) => {
          // Extract from regular attributes
          Object.keys(variant.attributes || {}).forEach(key => {
            if (!attributeTypes.includes(key)) {
              attributeTypes.push(key)
            }
          })
          
          // Extract from multi values
          if (variant.multiValues) {
            Object.keys(variant.multiValues).forEach(key => {
              if (!key.endsWith('_raw') && !attributeTypes.includes(key)) {
                attributeTypes.push(key)
              }
            })
          }
        })
      }
      
      
      // Derive attribute types from variantConfig (supports multiple shapes)
      let derivedAttributeTypes: string[] = []
      if (variantConfig) {
        if (Array.isArray(variantConfig.attributeOrder) && variantConfig.attributeOrder.length > 0) {
          derivedAttributeTypes = variantConfig.attributeOrder
        } else if (Array.isArray(variantConfig.primaryAttributes) && variantConfig.primaryAttributes.length > 0) {
          derivedAttributeTypes = variantConfig.primaryAttributes
        } else if (typeof variantConfig.primaryAttribute === 'string' && variantConfig.primaryAttribute.length > 0) {
          derivedAttributeTypes = [variantConfig.primaryAttribute]
        }
      }

      
      if (derivedAttributeTypes.length > 0) {
        // Auto-select first option for each attribute type
        const autoSelectedAttributes: { [key: string]: string | string[] } = {}
        
        derivedAttributeTypes.forEach((attrType: string) => {
          const values = getAttributeValuesForType(attrType, productVariants, variantConfig)
          if (values.length > 0) autoSelectedAttributes[attrType] = values[0] // Select first option
        })
        
        // Validate stock for auto-selected attributes
        const stockValidation = validateAutoSelectedStock(productForStockCheck)
        if (!stockValidation.isAvailable) {
          toast({
            title: "Out of Stock",
            description: stockValidation.message || "The selected options are currently unavailable.",
            variant: "destructive",
          })
          return
        }
        
        // Generate combination and calculate price
        const combination = autoSelectedAttributes
        const combinationKey = Object.entries(combination).map(([key, value]) => `${key}:${value}`).join('-')
        const variantId = `combination-0-${combinationKey}`
        const variantPrice = calculatePriceForCombination(combination, productVariants, variantConfig, productPrice)
        
        
        // Auto-set quantity to 5 for products under 500 TZS
        const quantity = variantPrice < 500 ? 5 : 1
        
        // Check if this is a China import item
        const product = products.find((p: any) => p.id === productId)
        if (product && (product.importChina || product.import_china)) {
          // Show modal for China import items
          setPendingCartItem({
            productId,
            quantity,
            variantId,
            combination,
            price: variantPrice
          })
          setShowChinaImportModal(true)
          return
        }
        
        addItem(productId, quantity, variantId, combination, variantPrice)
        return
      }
    }
    
    // Fallback: simple product without variants - use minimum price
    const minPrice = getMinimumPrice(productPrice, productVariants)
    
    // Auto-set quantity to 5 for products under 500 TZS
    const quantity = minPrice < 500 ? 5 : 1
    
    // Check if this is a China import item
    const productForChinaCheck = products.find((p: any) => p.id === productId)
    if (productForChinaCheck && (productForChinaCheck.importChina || productForChinaCheck.import_china)) {
      // Show modal for China import items
      setPendingCartItem({
        productId,
        quantity,
        variantId: undefined,
        combination: {},
        price: minPrice
      })
      setShowChinaImportModal(true)
      return
    }
    
    addItem(productId, quantity, undefined, {}, minPrice)
  }

  return (
    <div className={cn("flex flex-col min-h-screen w-full overflow-x-hidden", themeClasses.mainBg, themeClasses.mainText)} suppressHydrationWarning>
      {/* Preload first few product images for better performance */}
      <ImagePreloader 
        images={products.slice(0, 6).map((p: any) => p.image).filter((img: any): img is string => Boolean(img))} 
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
              openCategoryMegaMenu()
            }}
            onMouseLeave={(e) => {
              e.stopPropagation()
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
          <div className="flex-1 min-w-0 mx-2 sm:mx-3 md:mx-4 lg:mx-6 xl:mx-8 2xl:mx-10 flex items-center relative" suppressHydrationWarning>
            <form 
              className="relative flex-1 flex items-center" 
              onSubmit={(e: React.FormEvent) => {
                e.preventDefault()
                if (searchTerm.trim()) {
                  handleModalTextSearch(searchTerm.trim())
                }
              }} 
              suppressHydrationWarning
            >
              {/* Search Input */}
              <div className="relative flex-1" suppressHydrationWarning>
              <Search
                className={cn(
                    "absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 z-10",
                    darkHeaderFooterClasses.textNeutralSecondaryFixed,
                )}
                  suppressHydrationWarning
              />
              <Input
                type="text"
                placeholder="Search for products..."
                className={cn(
                    "w-full pl-8 sm:pl-10 pr-32 sm:pr-40 rounded-full h-8 sm:h-10 focus:border-yellow-500 focus:ring-yellow-500 text-xs sm:text-base",
                    darkHeaderFooterClasses.inputBg,
                    darkHeaderFooterClasses.inputBorder,
                    darkHeaderFooterClasses.textNeutralPrimary,
                    darkHeaderFooterClasses.inputPlaceholder,
                )}
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value
                  setSearchTerm(value)
                  setShowSuggestions(true)
                  handleSearchActivity()
                  // If user manually cleared, remove search from URL immediately
                  if (value.trim() === '') {
                    const params = new URLSearchParams(urlSearchParams?.toString() || '')
                    params.delete('search')
                    params.delete('returnTo')
                    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
                    router.push(nextUrl)
                  }
                  // Debouncing is now handled by useEffect
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  handleSearchActivity()
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitSearch()
                  }
                }}
                onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                  handleSearchActivity()
                  setIsSearchFocused(true)
                  if (searchTerm.length >= 2) {
                    setShowSuggestions(true)
                  }
                }}
                
                onBlur={() => {
                  // Delay hiding suggestions to allow clicks
                  setTimeout(() => {
                    setIsSearchFocused(false)
                    setShowSuggestions(false)
                  }, 200)
                }}
                  suppressHydrationWarning
              />
              
              {/* Search Suggestions */}
              <SearchSuggestions
                query={searchTerm}
                onSuggestionClick={handleSuggestionClick}
                isVisible={showSuggestions && isSearchFocused}
                className="mt-1"
              />
              
              {/* Search Loading Indicator - removed since we're using client-side filtering */}
              
              {/* Search Submit Button */}
              <button
                type="submit"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault()
                  if (searchTerm.trim()) {
                    submitSearch()
                  }
                }}
                disabled={!searchTerm.trim()}
                className={cn(
                  "absolute right-6 sm:right-8 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 rounded-full flex items-center justify-center transition-colors",
                  searchTerm.trim() 
                    ? cn(darkHeaderFooterClasses.textNeutralSecondaryFixed, "hover:bg-neutral-200 dark:hover:bg-neutral-700")
                    : "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                )}
                title="Search"
              >
                <Search className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              
              {/* Image Search Button */}
              <button
                onClick={() => {
                  setSearchModalInitialTab('image')
                  setIsSearchModalOpen(true)
                }}
                className={cn(
                  "absolute right-12 sm:right-16 top-1/2 -translate-y-1/2 px-2 py-1 rounded flex items-center justify-center text-xs sm:text-sm text-yellow-500 hover:text-yellow-600",
                  "hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors whitespace-nowrap"
                )}
                title="Search by image"
              >
                <Camera className="w-4 h-4 sm:hidden" />
                <span className="hidden sm:inline">Search by image</span>
              </button>
              
              {/* Clear Search Button */}
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("")
                    // Also clear URL immediately
                    const params = new URLSearchParams(urlSearchParams?.toString() || '')
                    params.delete('search')
                    params.delete('returnTo')
                    const nextUrl = `/products${params.toString() ? `?${params.toString()}` : ''}`
                    router.push(nextUrl)
                  }}
                  className={cn(
                    "absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 rounded-full flex items-center justify-center",
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
            <Link href="/" className={cn(themeClasses.mainText, "hover:text-orange-400 transition-colors text-sm")}>
              AI Sourcing
            </Link>
            <Link href="/" className={cn(themeClasses.mainText, "hover:text-orange-400 transition-colors text-sm")}>
              Discovery
            </Link>
            <Link href="/become-supplier" target="_blank" rel="noopener noreferrer" className={cn("text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-colors text-sm")}>
              Become Supplier
            </Link>
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
                    const newWindow = window.open('', '_blank')
                    if (newWindow) {
                      newWindow.document.write(`
                        <html>
                          <head><title>Coming Soon</title></head>
                          <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;">
                            <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                              <h1 style="color: #333; margin-bottom: 20px;">Coming Soon</h1>
                              <p style="color: #666;">This feature is coming soon. Stay tuned!</p>
                            </div>
                          </body>
                        </html>
                      `)
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
                    const newWindow = window.open('', '_blank')
                    if (newWindow) {
                      newWindow.document.write(`
                        <html>
                          <head><title>Coming Soon</title></head>
                          <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;">
                            <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                              <h1 style="color: #333; margin-bottom: 20px;">Coming Soon</h1>
                              <p style="color: #666;">This feature is coming soon. Stay tuned!</p>
                            </div>
                          </body>
                        </html>
                      `)
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
                    const newWindow = window.open('', '_blank')
                    if (newWindow) {
                      newWindow.document.write(`
                        <html>
                          <head><title>Coming Soon</title></head>
                          <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;">
                            <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                              <h1 style="color: #333; margin-bottom: 20px;">Coming Soon</h1>
                              <p style="color: #666;">This feature is coming soon. Stay tuned!</p>
                            </div>
                          </body>
                        </html>
                      `)
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
                    const newWindow = window.open('', '_blank')
                    if (newWindow) {
                      newWindow.document.write(`
                        <html>
                          <head><title>Coming Soon</title></head>
                          <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;">
                            <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                              <h1 style="color: #333; margin-bottom: 20px;">Coming Soon</h1>
                              <p style="color: #666;">This feature is coming soon. Stay tuned!</p>
                            </div>
                          </body>
                        </html>
                      `)
                      newWindow.document.close()
                    }
                  }}
                >
                  <TrendingUp className="w-4 h-4 mr-2" /> Project Development
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className={darkHeaderFooterClasses.dropdownItemHoverBg}
                  asChild
                >
                  <Link href="/become-supplier" className="flex items-center">
                    <UserPlus className="w-4 h-4 mr-2" /> Become Supplier
                  </Link>
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
                      <Coins className="w-4 h-4 mr-2" /> My Coins
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
                      onClick={() => router.push('/account/coins')}
                    >
                      <Package className="w-4 h-4 mr-2" /> My Coins
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
          <div className="flex items-center justify-between flex-1 gap-2 xl:gap-3 ml-2">
            {desktopVisibleCategories.map((cat: any) => (
            <div
                key={cat.id}
                className="relative flex-1"
                onMouseEnter={() => {
                  if (categoryMegaMenuTimeoutRef.current) {
                    clearTimeout(categoryMegaMenuTimeoutRef.current)
                  }
                  setHoveredMegaCategory(cat.slug)
                  openCategoryMegaMenu()
                }}
                onMouseLeave={() => {
                  // Don't close immediately, let the mega menu handle it
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
                prefetch={false}
                scroll={false}
                onClick={(e) => {
                  e.preventDefault()
                  router.push(`/?mainCategory=${cat.slug}`)
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
               <span className="text-[10px] font-medium text-[var(--tw-ring-offset-color)] flex items-center gap-1" suppressHydrationWarning>
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
                  const newWindow = window.open('', '_blank')
                  if (newWindow) {
                    newWindow.document.write(`
                      <html>
                        <head><title>Coming Soon</title></head>
                        <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;">
                          <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <h1 style="color: #333; margin-bottom: 20px;">Coming Soon</h1>
                            <p style="color: #666;">This feature is coming soon. Stay tuned!</p>
                          </div>
                        </body>
                      </html>
                    `)
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
                  const newWindow = window.open('', '_blank')
                  if (newWindow) {
                    newWindow.document.write(`
                      <html>
                        <head><title>Coming Soon</title></head>
                        <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;">
                          <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <h1 style="color: #333; margin-bottom: 20px;">Coming Soon</h1>
                            <p style="color: #666;">This feature is coming soon. Stay tuned!</p>
                          </div>
                        </body>
                      </html>
                    `)
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
                  const newWindow = window.open('', '_blank')
                  if (newWindow) {
                    newWindow.document.write(`
                      <html>
                        <head><title>Coming Soon</title></head>
                        <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;">
                          <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <h1 style="color: #333; margin-bottom: 20px;">Coming Soon</h1>
                            <p style="color: #666;">This feature is coming soon. Stay tuned!</p>
                          </div>
                        </body>
                      </html>
                    `)
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
                  const newWindow = window.open('', '_blank')
                  if (newWindow) {
                    newWindow.document.write(`
                      <html>
                        <head><title>Coming Soon</title></head>
                        <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;">
                          <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <h1 style="color: #333; margin-bottom: 20px;">Coming Soon</h1>
                            <p style="color: #666;">This feature is coming soon. Stay tuned!</p>
                          </div>
                        </body>
                      </html>
                    `)
                    newWindow.document.close()
                  }
                }}
              >
                <TrendingUp className="w-4 h-4 mr-2" /> Project Development
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className={darkHeaderFooterClasses.dropdownItemHoverBg}
                asChild
              >
                <Link href="/become-supplier" className="flex items-center">
                  <UserPlus className="w-4 h-4 mr-2" /> Become Supplier
                </Link>
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
                              router.push(`/?mainCategory=${category.slug}`)
                              setIsCategoryMegaMenuOpen(false)
                            } else {
                              // Mobile: just select the category to show subcategories
                              setHoveredMegaCategory(category.slug)
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
                            router.push(`/?mainCategory=${hoveredMegaCategoryData.slug}`)
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
                                onClick={(e) => {
                                  e.preventDefault()
                                  router.push(`/?mainCategory=${hoveredMegaCategoryData.slug}&subCategory=${sub.slug}`)
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
                                onClick={(e) => {
                                  e.preventDefault()
                                  router.push(`/?mainCategory=${hoveredMegaCategoryData.slug}&subCategory=${sub.slug}`)
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
                                  onClick={(e) => {
                                    e.preventDefault()
                                    router.push(`/?mainCategory=${hoveredMegaCategoryData.slug}&subCategory=${sub.slug}`)
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
      {currentPage < 2 && (
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
      {currentPage < 2 && (
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
        currentPage >= 2 
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
              {Math.min(displayedProducts.length, infiniteTotalCount > 0 ? infiniteTotalCount : products.length)} of {infiniteTotalCount > 0 ? infiniteTotalCount : products.length} products
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
        {categoriesData.mainCategories.length > 0 && currentPage < 2 && (
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
                      prefetch={false}
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
              className={`text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-black dark:text-white mb-1 font-sans transition-opacity duration-500 ease-in-out ${
                isFading ? 'opacity-0' : 'opacity-100'
              }`}
              style={{ minHeight: '1.5em' }}
            >
              {currentPromoIndex === 1 ? (
                <>
                  Mega Choice For You Up To <span className="text-blue-500 dark:text-blue-400" style={{ fontFamily: "'Times New Roman', serif" }}>40%</span> Off
                </>
              ) : (
                promotionalTexts[currentPromoIndex]
              )}
            </h2>
          </div>
        </div>

        {/* Loading State - Removed for faster UX */}

        {/* Error State (Rate limiting and other errors) */}
        {infiniteError && !infiniteLoading && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 px-4 text-center">
            <Package className="w-16 h-16 text-red-400 mb-4" />
                <h3 className={cn("text-lg font-semibold mb-2", themeClasses.mainText)}>
              Error Loading Products
                </h3>
                <p className={cn("text-sm mb-6 max-w-md", themeClasses.textNeutralSecondary)}>
              {infiniteError}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                onClick={infiniteRefresh}
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

                {/* Image Search Results Indicator */}
        {imageSearchResults.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="text-blue-800 dark:text-blue-200 font-medium">
                  Image Search Results ({imageSearchResults.length} products found)
                </span>
              </div>
              <button
                onClick={() => {
                  setImageSearchResults([])
                  setImageSearchKeywords([])
                }}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
              >
                <X className="w-4 h-4" />
              </button>
                  </div>
            {imageSearchKeywords.length > 0 && (
              <div className="mt-2">
                <span className="text-sm text-blue-700 dark:text-blue-300">Keywords: </span>
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  {imageSearchKeywords.join(', ')}
                </span>
                </div>
            )}
              </div>
        )}

                {/* Products Grid */}
        {showSkeleton || isLoading ? (
          // Skeleton Loading State
          <div className="px-1 sm:px-2 lg:px-3">
            <ProductGridSkeleton count={24} />
          </div>
        ) : (noCategoryMatches || displayedProducts.length === 0) ? (
          <div className="px-4 py-10 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className={cn("text-xl font-semibold mb-2", themeClasses.mainText)}>
              No products found
            </h3>
            {(searchTerm || selectedMainCategory || selectedSubCategories.length || activeBrand || priceRange[0] > 0 || priceRange[1] < 100000) && (
              <div className={cn("text-sm mb-6 max-w-md mx-auto", themeClasses.textNeutralSecondary)}>
                <p className="mb-2">Selected filters:</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {searchTerm && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium">
                      Search: "{searchTerm}"
                    </span>
                  )}
                  {selectedMainCategory && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs font-medium">
                      Category: {selectedMainName}
                    </span>
                  )}
                  {selectedSubCategories.length > 0 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-xs font-medium">
                      Sub: {selectedSubNames.join(', ')}
                    </span>
                  )}
                  {activeBrand && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 text-xs font-medium">
                      Brand: {activeBrand}
                    </span>
                  )}
                  {(priceRange[0] > 0 || priceRange[1] < 100000) && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs font-medium">
                      Price: {priceRange[0]} - {priceRange[1]} TZS
                    </span>
                  )}
                </div>
              </div>
            )}
            {(searchTerm || selectedMainCategory || selectedSubCategories.length || activeBrand || priceRange[0] > 0 || priceRange[1] < 100000) && (
              <Button
                onClick={clearFilters}
                className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        ) : !error ? (
          <InfiniteScrollTrigger
            onLoadMore={infiniteLoadMore}
            hasMore={hasMoreProducts}
            loading={infiniteLoadingMore}
            error={infiniteError}
          >
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-8 gap-1 px-1 sm:px-2 lg:px-3" suppressHydrationWarning>
            {displayedProducts.length > 0 && (
              <>
                
                {/* All Product Cards */}
            {(shuffledProducts.length > 0 ? shuffledProducts : displayedProducts).map((product: any, index: number) => {
            
            // If product has variants and variantConfig, compute first-combination price for display
            let effectivePrice = product.price
            if (product?.variants && product.variants.length > 0 && product?.variantConfig) {
              const attributeTypesLocal = Array.isArray(product.variantConfig?.attributeOrder)
                ? product.variantConfig.attributeOrder
                : (product.variantConfig?.primaryAttributes || [])
              const autoAttributes: { [k: string]: string | string[] } = {}
              attributeTypesLocal.forEach((attr: string) => {
                const values = getAttributeValuesForType(attr, product.variants, product.variantConfig)
                if (values.length > 0) autoAttributes[attr] = values[0]
              })
              if (Object.keys(autoAttributes).length > 0) {
                effectivePrice = calculatePriceForCombination(autoAttributes, product.variants, product.variantConfig, product.price)
              }
            }
            // Calculate pricing display for all products (deterministic)
            let testOriginalPrice = product.originalPrice
            // If no original price or original price is same as current price, synthesize a stable discount (10-30%) based on product id
            if (testOriginalPrice <= effectivePrice) {
              // Simple deterministic pseudo-random based on product id
              const idNumber = Number(product.id) || 0
              const hash = (idNumber * 9301 + 49297) % 233280
              const fraction = hash / 233280 // [0,1)
              const discountRate = 0.10 + (fraction * 0.20) // 10%..30%
              testOriginalPrice = Math.round(effectivePrice / (1 - discountRate))
            }
            
            const discountPercentage = ((testOriginalPrice - effectivePrice) / testOriginalPrice) * 100
            
            const productInCart = isInCart(product.id, product.variants?.[0]?.id) // Check if product or its default variant is in cart
            const hasFreeShipping = product.free_delivery === true ||
              product.freeDelivery === true ||
              (product as any)?.free_shipping === true ||
              (product as any)?.freeShipping === true
            
            return (
              <Card
                key={`${product.id}-${index}`}
                data-product-id={product.id}
                onMouseEnter={handleProductHover}
                onFocus={handleProductHover}
                className={cn(
                  "flex flex-col overflow-hidden rounded-lg border-0 shadow-none",
                  "transform transition-all duration-300 ease-in-out",
                  "hover:scale-105 hover:shadow-xl hover:shadow-gray-300/60 dark:hover:shadow-gray-700/60",
                  "hover:z-10 relative hover:ring-2 hover:ring-blue-500/20",
                  themeClasses.cardBg,
                  themeClasses.mainText,
                )}
                style={{ contentVisibility: 'auto', containIntrinsicSize: '320px 420px' }}
                    suppressHydrationWarning
              >
                    <OptimizedLink 
                      href={`/products/${product.id}-${encodeURIComponent(product.slug || product.name || 'product')}?returnTo=${encodeURIComponent(`${pathname}${(urlSearchParams?.toString() ? `?${urlSearchParams.toString()}` : '')}` || window.location.href)}`} 
                      className="block relative aspect-square overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600" 
                      prefetch={false}
                      priority="low"
                      suppressHydrationWarning
                    >
                  {product.image && (
                    <LazyImage
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-300 hover:scale-110"
                      priority={false}
                      quality={60}
                      sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 20vw"
                    />
                  )}
                  {/* Corner decoration */}
                  <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-orange-500 z-20"></div>

                  {/* Badges - Separate left and right badge systems */}
                  {(() => {
                    const leftBadge = getLeftBadge(product)
                    const rightBadge = getRightBadge(product)
                    const hasChinaBadge = product.importChina || product.import_china
                    const hasRightBadge = rightBadge.type !== 'none'
                    
                    // Calculate top position for China badge (below New/Discount badge if it exists)
                    const chinaBadgeTop = hasRightBadge ? 'top-6 sm:top-7' : 'top-0'
                    
                    return (
                      <>
                        {/* Left side badge (Popular vs Free Shipping) */}
                        {leftBadge.type !== 'none' && (
                          <div className="absolute top-0 left-0 sm:top-0 sm:left-1.5 z-10" suppressHydrationWarning>
                            <span className={leftBadge.className} suppressHydrationWarning>
                              {leftBadge.text}
                      </span>
        </div>
                        )}
                        
                        {/* Right side badge (New vs Discount) */}
                        {rightBadge.type !== 'none' && (
                          <div className="absolute top-0 right-0 sm:top-0 sm:right-1.5 z-10" suppressHydrationWarning>
                  <span 
                              className={rightBadge.className} 
                              style={rightBadge.customStyle}
                              suppressHydrationWarning
                  >
                              {rightBadge.text}
                  </span>
                </div>
                        )}
                        
                        {/* China badge - Right side, below New/Discount badge */}
                        {hasChinaBadge && (
                          <div className={`absolute ${chinaBadgeTop} right-0 sm:right-1.5 z-10`} suppressHydrationWarning>
                            <span 
                              className="bg-red-600 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-none shadow-sm sm:shadow-md"
                              suppressHydrationWarning
                            >
                              China
                  </span>
                </div>
                        )}
                      </>
                    )
                  })()}
                    </OptimizedLink>
                    <CardContent className="p-1 flex-1 flex flex-col justify-between" suppressHydrationWarning>
                      <OptimizedLink 
                        href={`/products/${product.id}-${encodeURIComponent(product.slug || product.name || 'product')}?returnTo=${encodeURIComponent(`${pathname}${(urlSearchParams?.toString() ? `?${urlSearchParams.toString()}` : '')}` || window.location.href)}`}
                        className="block"
                        prefetch={false}
                        priority="low"
                      >
                        <h3 className="text-xs font-semibold sm:text-sm lg:text-base hover:text-blue-600 dark:hover:text-blue-400 hover:scale-105 transition-all duration-300 line-clamp-2 overflow-hidden" suppressHydrationWarning>{product.name}</h3>
                      </OptimizedLink>
                  {/* Sold count - on new line above ratings on mobile */}
                  {product.sold_count && (
                    <div className="sm:hidden text-[10px] mt-0.5" suppressHydrationWarning>
                      <span className={themeClasses.textNeutralSecondary} suppressHydrationWarning>
                        {product.sold_count >= 1000 
                          ? `${(product.sold_count / 1000).toFixed(1)}k+` 
                          : `${product.sold_count}+`} sold out
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-1 text-[10px] mt-0.5 sm:text-xs min-h-[1.5rem]",
                      themeClasses.textNeutralSecondary,
                    )}
                        suppressHydrationWarning
                  >
                    {/* Sold count - inline on desktop */}
                    {product.sold_count && (
                      <span className="hidden sm:inline text-xs whitespace-nowrap" suppressHydrationWarning>
                        {product.sold_count >= 1000 
                          ? `${(product.sold_count / 1000).toFixed(1)}k+` 
                          : `${product.sold_count}+`} sold
                      </span>
                    )}
                    {product.sold_count && (
                      <span className="hidden sm:inline mx-0.5" suppressHydrationWarning>•</span>
                    )}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                          className={`w-3 h-3 flex-shrink-0 ${
                          i < Math.floor(product.rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : themeClasses.textNeutralSecondary
                        }`}
                        suppressHydrationWarning
                      />
                    ))}
                      <span className="whitespace-nowrap" suppressHydrationWarning>({product.reviews})</span>
                    </div>
                  </div>
                  {hasFreeShipping && (
                    <div
                      className="text-[10px] sm:text-xs font-semibold text-red-600 uppercase tracking-wide mt-1 flex items-center gap-1"
                      suppressHydrationWarning
                    >
                      <span aria-hidden="true">•</span>
                      <span>Free Shipping</span>
                    </div>
                  )}
                      <div className="flex flex-wrap items-baseline gap-x-2 mt-0.5" suppressHydrationWarning>
                        {/* Main Price */}
                        <div className="text-sm font-bold sm:text-base lg:text-lg" suppressHydrationWarning>
                          {formatPrice(effectivePrice)}
                        </div>
                        
                        {/* Original Price and Discount - Always show for all products */}
                        {testOriginalPrice > effectivePrice && (
                      <>
                            <div className={cn("text-[10px] line-through sm:text-xs", themeClasses.textNeutralSecondary)} suppressHydrationWarning>
                              {formatPrice(testOriginalPrice)}
                </div>
                            <div className="text-[10px] font-medium text-green-600" suppressHydrationWarning>
                          {discountPercentage.toFixed(0)}% OFF
                </div>
                      </>
                    )}
              </div>


                </CardContent>
                    <CardFooter className="px-1 pb-1 pt-0 flex flex-col gap-1" suppressHydrationWarning>
                  <Button
                    className={cn(
                      "w-full text-xs py-1 h-auto sm:text-sm lg:text-base rounded-b-sm rounded-t-none transform transition-all duration-200 hover:scale-105 hover:shadow-md",
                      (product.importChina || product.import_china) 
                        ? "bg-red-800 text-white hover:bg-red-900" 
                        : "bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
                    )}
                    onClick={() => handleAddToCart(product.id, product.name, product.price, product.variants, product.variantConfig)}
                        suppressHydrationWarning
                  >
                    <>
                          <ShoppingCart className="w-4 h-4 mr-2" suppressHydrationWarning /> Add to Cart
                    </>
                  </Button>
                </CardFooter>
              </Card>
            )
                })}
              </>
            )}
              </div>
          </InfiniteScrollTrigger>
        ) : null}

        {/* Next Page Navigation */}
        {!hasMoreProducts && currentPageProductCount >= PRODUCTS_PER_PAGE && hasNextPage && (
          <div className="flex flex-col items-center justify-center py-2 px-4 gap-2" suppressHydrationWarning>
            <div className="text-center">
              <p className={cn("text-sm mb-2", themeClasses.textNeutralSecondary)}>
                {infiniteTotalCount > PRODUCTS_PER_PAGE 
                  ? `${infiniteTotalCount - currentPageProductCount} more products available` 
                  : 'More products available'}
              </p>
            </div>
            <Link href={buildNextPageUrl()} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600 px-8 py-4 text-base font-semibold"
              >
                Next Page ({currentPage + 1}) →
              </Button>
            </Link>
          </div>
        )}
        
        {/* End of all products */}
        {!hasMoreProducts && !hasNextPage && products.length > 0 && (
          <div className="flex justify-center py-8" suppressHydrationWarning>
            <p className={cn("text-lg", themeClasses.textNeutralSecondary)}>You've reached the end of the list!</p>
            </div>
        )}
        
      </main>


      {!infiniteLoading && !infiniteLoadingMore && !(categoriesLoading && infiniteProducts.length === 0) && <Footer />}

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
                              router.push(nextUrl)
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
                              router.push(nextUrl)
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
                  handleSearchActivity()
              }}
                onFocus={handleSearchActivity}
                onKeyDown={(e) => {
                  handleSearchActivity()
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
                      setIsSearchModalOpen(true)
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
                
                {/* Theme Selection */}
            <div className="space-y-2">
                  <p className="text-xs text-white/70">Theme</p>
                  <div className="grid grid-cols-3 gap-2">
              <Button
                variant="ghost"
                      size="sm"
                      className={`h-10 text-xs ${backgroundColor === 'dark' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                onClick={() => setBackgroundColor('dark')}
              >
                      Dark
              </Button>
              <Button
                variant="ghost"
                      size="sm"
                      className={`h-10 text-xs ${backgroundColor === 'gray' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                onClick={() => setBackgroundColor('gray')}
              >
                      Gray
              </Button>
              <Button
                variant="ghost"
                      size="sm"
                      className={`h-10 text-xs ${backgroundColor === 'white' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                onClick={() => setBackgroundColor('white')}
              >
                      Light
              </Button>
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

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onTextSearch={handleModalTextSearch}
        onImageSearch={handleImageSearch}
        currentSearchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        initialTab={searchModalInitialTab}
      />


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