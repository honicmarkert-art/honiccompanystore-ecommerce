"use client"

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { logger } from '@/lib/logger'

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
import { InfiniteScrollTrigger } from "@/components/infinite-scroll-trigger"
import { SearchModal } from "@/components/search-modal"
import { SearchSuggestions } from "@/components/search-suggestions"
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
  Home,
  Dumbbell,
  Package,
  Tag,
  Building,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Clock,
  Filter,
  SlidersHorizontal,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  HelpCircle,
  RefreshCcw,
  Wallet,
  Mail,
  ChevronLeft,
  ChevronRight,
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
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
// import { useProducts } from "@/hooks/use-products" // Removed - using useProductsOptimized instead
import { useCart } from "@/hooks/use-cart" // Import useCart hook
import { useToast } from "@/hooks/use-toast" // Import useToast hook
import { useCompanyContext } from "@/components/company-provider"
import { Footer } from "@/components/footer"
import { useCurrency } from "@/contexts/currency-context"
import { useAuth } from "@/contexts/auth-context"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { UserProfile } from "@/components/user-profile"

// Category icons mapping - simplified
const categoryIcons: { [key: string]: any } = {
  // Electronics categories
  "Microcontrollers": Laptop,
  "Sensors": Package,
  "Power Supply": Package,
  "Development Boards": Laptop,
  "Tools": Package,
  "Resistors & Capacitors": Package,
  "Diodes & Transistors": Package,
  "Integrated Circuits": Laptop,
  "Connectors & Cables": Package,
  "Motors & Actuators": Package,
  "Starter Kits": Package,
  "Project Kits": Package,
  "Educational Materials": Package,
  "Robotics": Package,
  "Accessories": Package,
  
  // Legacy categories
  "Jewelry & Watches": Package,
  "Luggages & Bags": Package,
  "Home & Garden": Home,
  "Hair Extensions & Wigs": Package,
  "Men's Clothing": Shirt,
  "Electronics": Laptop,
  "Home Improvement & Lighting": Package,
  "Home Appliances": Package,
  "Automotive & Motorcycle": Package,
  "Shoes": Package,
  "Special Occasion Costume": Package,
  "Women's Clothing": Shirt,
  "Sports & Entertainment": Dumbbell,
  "Beauty & Health": Package,
  "Toys & Hobbies": Package,
  "Baby & Kids": Package,
  "Books & Media": Package,
  "Food & Beverages": Package,
  "Pet Supplies": Package,
  "Office & School Supplies": Package,
  "Party & Event Supplies": Package,
  "Tools & Hardware": Package,
  "Phone & Accessories": Phone,
  "Computer & Office": Laptop,
  "Fashion": Shirt,
  "Sports & Outdoors": Dumbbell,
  "Automotive": Package,
  "Health & Beauty": Package,
  "default": Package
}

export default function Component() {
  const router = useRouter()
  const pathname = usePathname()
  const { backgroundColor, setBackgroundColor, themeClasses, darkHeaderFooterClasses } = useTheme()
  // const { products, isLoading, error, retry, preloadProducts } = useProducts() // Removed - using useProductsOptimized instead
  const { addItem, isInCart, cartTotalItems, getItemQuantity } = useCart() // Use useCart hook
  const { toast } = useToast() // Initialize toast
  const { companyName, companyColor, companyLogo } = useCompanyContext()
  const { user, isAuthenticated } = useAuth() // Add auth context
  const { openAuthModal } = useGlobalAuthModal() // Add auth modal
  const { currency, setCurrency, formatPrice } = useCurrency() // Use global currency context
  const { navigateWithPrefetch } = useOptimizedNavigation() // Optimized navigation
  const [searchTerm, setSearchTerm] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeBrand, setActiveBrand] = useState<string | null>(null)
  const [debouncedCategory, setDebouncedCategory] = useState<string | null>(null)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  // Initialize search state from URL query ?search= on mount and when URL changes
  const urlSearchParams = useSearchParams()
  
  // Debug: Log current URL state
  useEffect(() => {
    const currentUrl = `${pathname}${urlSearchParams?.toString() ? `?${urlSearchParams.toString()}` : ''}`
    console.log('🔍 Products Page - Current URL:', currentUrl)
    console.log('🔍 Products Page - Search params:', urlSearchParams?.toString())
  }, [pathname, urlSearchParams])
  
  
  useEffect(() => {
    const initial = (urlSearchParams?.get('search') || '').trim()
    // Only update when query differs to avoid loops
    if (initial && initial !== searchTerm) {
      setSearchTerm(initial)
      setDebouncedSearchTerm(initial)
    }
  }, [urlSearchParams])
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [searchModalInitialTab, setSearchModalInitialTab] = useState<'text' | 'image'>('text')
  const [imageSearchResults, setImageSearchResults] = useState<any[]>([])
  const [imageSearchKeywords, setImageSearchKeywords] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  // Debounce category changes to prevent rapid-fire API requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCategory(activeCategory)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [activeCategory])

  // Debounce search term changes to prevent rapid-fire API requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // 500ms debounce for search (longer than category)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Use the debounced category for filtering
  const activeCategoryForFilter = useMemo(() => {
    return debouncedCategory || undefined
  }, [debouncedCategory])

  // Use the debounced search term for filtering (only if it's at least 2 characters or empty)
  const activeSearchForFilter = useMemo(() => {
    const trimmed = debouncedSearchTerm.trim()
    return trimmed.length >= 2 || trimmed.length === 0 ? trimmed : undefined
  }, [debouncedSearchTerm])

  // Handle image search results
  const handleImageSearch = useCallback((products: any[], keywords: string[]) => {
    setImageSearchResults(products)
    setImageSearchKeywords(keywords)
    // Clear other filters when doing image search
    setActiveCategory(null)
    setDebouncedCategory(null)
    setSearchTerm("")
    setDebouncedSearchTerm("")
  }, [])

  // Handle text search from modal
  const handleModalTextSearch = useCallback((query: string) => {
    setSearchTerm(query)
    setDebouncedSearchTerm(query)
    // Clear image search results
    setImageSearchResults([])
    setImageSearchKeywords([])
  }, [])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setSearchTerm(suggestion)
    setDebouncedSearchTerm(suggestion)
    setShowSuggestions(false)
    setIsSearchFocused(false)
    router.push(`/products?search=${encodeURIComponent(suggestion)}`)
  }, [router])

  // Removed useRobustProducts hook - was causing duplicate API calls!
  // Filter functions are now implemented locally below
  
  // Categories state using robust API
  const { data: categories, isLoading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useRobustApi<any[]>({
    endpoint: '/api/categories',
    retryDelay: 1000,
    maxRetries: 3,
    rateLimitCooldown: 60000
  })

  // Normalize categories response into array of { id, name, slug }
  const categoriesList = useMemo(() => {
    // Some endpoints return { categories: string[] }, others may return an array directly
    const raw = Array.isArray(categories) ? categories : (categories as any)?.categories
    if (!Array.isArray(raw)) return []
    return raw.map((item: any, index: number) => {
      const name = typeof item === 'string' ? item : item?.name
      const slug = typeof item === 'string' ? item : item?.slug
      const normalizedSlug = (slug || name || '')
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      return {
        id: typeof item?.id !== 'undefined' ? item.id : index,
        name: name || '',
        slug: normalizedSlug,
      }
    }).filter(c => c.name)
  }, [categories])



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
  
  // Touch swipe state for advertisements
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  
  // Mobile category rotation state
  const [mobileCategoryStartIndex, setMobileCategoryStartIndex] = useState(0)
  const MOBILE_CATEGORIES_PER_ROW = 4 // Reduced to 4 to prevent overlapping

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isPriceFilterOpen, setIsPriceFilterOpen] = useState(false)
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false)
  const [isCategoriesNavOpen, setIsCategoriesNavOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState('featured')

  // Pagination state - URL-based page number
  const [currentPage, setCurrentPage] = useState(1)
  const PRODUCTS_PER_PAGE = 120
  const BATCH_SIZE = 20 // Load 20 at a time with infinite scroll
  
  // Get page from URL on mount
  useEffect(() => {
    const page = parseInt(urlSearchParams?.get('page') || '1')
    if (page > 0) {
      setCurrentPage(page)
    }
  }, [urlSearchParams])

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
    category: activeCategoryForFilter,
    brand: activeBrand || undefined,
    search: activeSearchForFilter || undefined, // Use filtered debounced search term
    sortBy: sortOrder === 'price-low' ? 'price' : sortOrder === 'price-high' ? 'price' : 'created_at',
    // Server-side filtering - Pass filters to API!
    minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
    maxPrice: priceRange[1] < 100000 ? priceRange[1] : undefined,
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    inStock: undefined, // Can be added if you want to filter by stock
    sortOrder: sortOrder === 'price-high' ? 'desc' : 'asc',
    useOptimized: true,
    useMaterializedView: false,
    enabled: true
  })

  // Local clearFilters function (no more duplicate API calls!)
  const clearFilters = useCallback(() => {
    // Reset all filter states
    setPriceRange([0, 100000])
    setSelectedCategories([])
    setActiveCategory(null)
    setActiveBrand(null)
    setSortOrder('featured')
    // Reset infinite scroll
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
        console.log('📢 [Advertisements] Starting products page ads fetch...')
        
        // Check cache for advertisements
        const cachedAds = localStorage.getItem('ads_cache')
        const cachedRotation = localStorage.getItem('ads_rotation_cache')
        const cacheTimestamp = localStorage.getItem('ads_cache_timestamp')
        const now = Date.now()
        const cacheAge = cacheTimestamp ? now - parseInt(cacheTimestamp) : Infinity
        
        console.log('📢 [Advertisements] Cache status:', {
          hasCachedAds: !!cachedAds,
          hasCachedRotation: !!cachedRotation,
          cacheAge: cacheAge,
          useCache: cacheAge < 2 * 60 * 1000
        })
        
        // Use cache if it's less than 2 minutes old
        if (cachedAds && cachedRotation && cacheAge < 2 * 60 * 1000) {
          console.log('✅ [Advertisements] Using cached ads data')
          setAdvertisements(JSON.parse(cachedAds))
          setAdRotationTime(parseInt(cachedRotation))
          setAdsLoading(false)
          return
        }
        
        // Add delay to prevent simultaneous API calls
        await new Promise(resolve => setTimeout(resolve, 200))
        
        const cacheBust = typeof window !== 'undefined' ? (localStorage.getItem('settings_cache_bust') || Date.now()) : Date.now()
        console.log('📢 [Advertisements] Fetching fresh ads with cache-bust:', cacheBust)
        
        const [adsResponse, rotationResponse] = await Promise.all([
          fetch(`/api/advertisements?placement=products&cb=${cacheBust}`, { cache: 'no-store' }),
          fetch(`/api/advertisements/rotation-time?cb=${cacheBust}`, { cache: 'no-store' })
        ])
        
        if (adsResponse.ok) {
          const data = await adsResponse.json()
          console.log('✅ [Advertisements] Successfully fetched products ads:', {
            count: data?.length || 0,
            timestamp: new Date().toISOString()
          })
          setAdvertisements(data || [])
          localStorage.setItem('ads_cache', JSON.stringify(data || []))
        } else if (adsResponse.status === 429) {
          console.warn('⚠️ [Advertisements] Rate limited when fetching ads, using cached data if available')
          if (cachedAds) {
            setAdvertisements(JSON.parse(cachedAds))
          }
        } else {
          console.warn('⚠️ [Advertisements] Failed to fetch advertisements:', adsResponse.status)
        }
        
        if (rotationResponse.ok) {
          const rotationData = await rotationResponse.json()
          console.log('✅ [Advertisements] Successfully fetched rotation time:', rotationData)
          setAdRotationTime(rotationData.rotationTime || 10)
          localStorage.setItem('ads_rotation_cache', (rotationData.rotationTime || 10).toString())
        } else if (rotationResponse.status === 429) {
          console.warn('⚠️ [Advertisements] Rate limited when fetching rotation time, using cached data if available')
          if (cachedRotation) {
            setAdRotationTime(parseInt(cachedRotation))
          }
        } else {
          console.warn('⚠️ [Advertisements] Failed to fetch rotation time:', rotationResponse.status)
        }
        
        // Update cache timestamp
        localStorage.setItem('ads_cache_timestamp', now.toString())
        console.log('💾 [Advertisements] Updated cache timestamp:', now)
        
      } catch (error) {
        console.error('❌ [Advertisements] Error fetching advertisements:', error)
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
      setCurrentAdIndex((prevIndex) => (prevIndex + 1) % advertisements.length)
    }, adRotationTime * 1000) // Convert seconds to milliseconds
    
    return () => clearInterval(interval)
  }, [advertisements.length, adRotationTime])

  // Auto-rotate mobile categories every 1 minute
  useEffect(() => {
    if (!categories || categories.length <= MOBILE_CATEGORIES_PER_ROW) return
    
    const interval = setInterval(() => {
      setMobileCategoryStartIndex((prevIndex) => {
        const maxStartIndex = Math.max(0, categories.length - MOBILE_CATEGORIES_PER_ROW)
        return prevIndex >= maxStartIndex ? 0 : prevIndex + 1
      })
    }, 60000) // 1 minute = 60000ms
    
    return () => clearInterval(interval)
  }, [categories, MOBILE_CATEGORIES_PER_ROW])

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
      setCurrentAdIndex((prev) => (prev + 1) % advertisements.length)
    }
    if (isRightSwipe && advertisements.length > 1) {
      // Swipe right - previous ad
      setCurrentAdIndex((prev) => prev === 0 ? advertisements.length - 1 : prev - 1)
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
    inStock: product.in_stock,
    freeDelivery: product.free_delivery,
    sameDayDelivery: product.same_day_delivery,
    variants: product.product_variants || [],
    gallery: product.image ? [product.image] : [],
    specifications: {},
    variantConfig: (product as any).variant_config
  }))

  // Use image search results if available, otherwise use infinite products
  const products = imageSearchResults.length > 0 ? imageSearchResults : adaptedInfiniteProducts as any

  // Shuffle products every 20 minutes deterministically using a time-based seed
  const shuffledProducts = useMemo(() => {
    if (!products || products.length === 0) return []
    
    // 20-minute window seed
    const windowMs = 20 * 60 * 1000
    const seed = Math.floor(Date.now() / windowMs)
    // Simple seeded shuffle (Fisher-Yates variant)
    const seededRandom = (() => {
      let s = seed ^ 0x9e3779b9
      return () => {
        // xorshift32
        s ^= s << 13; s ^= s >>> 17; s ^= s << 5
        // Convert to [0,1)
        return ((s >>> 0) / 4294967296)
      }
    })()
    const copy = products.slice()
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }, [products])
  const isLoading = infiniteLoading || (activeCategory !== debouncedCategory) || (searchTerm !== debouncedSearchTerm) || (debouncedSearchTerm.trim().length === 1) // Show loading while debouncing or typing single character
  const error = infiniteError

  // Server-side filtering is now handled by the API!
  // This component just displays what the server sends
  const displayedProducts = useMemo(() => {
    // Remove duplicates only (API handles filtering & sorting)
    const seen = new Set<number>()
    const sourceList = shuffledProducts.length > 0 ? shuffledProducts : products
    const uniqueProducts = sourceList.filter((product: any) => {
      if (seen.has(product.id)) return false
      seen.add(product.id)
      return true
    })

    // Limit to PRODUCTS_PER_PAGE (120) for current page
    const limitedProducts = uniqueProducts.slice(0, PRODUCTS_PER_PAGE)
    return limitedProducts
  }, [shuffledProducts, products, PRODUCTS_PER_PAGE])
  
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
    
    if (activeCategory) params.set('category', activeCategory)
    if (activeBrand) params.set('brand', activeBrand)
    if (searchTerm) params.set('search', searchTerm)
    if (sortOrder !== 'featured') params.set('sort', sortOrder)
    if (priceRange[0] > 0) params.set('minPrice', priceRange[0].toString())
    if (priceRange[1] < 100000) params.set('maxPrice', priceRange[1].toString())
    if (selectedCategories.length > 0) params.set('categories', selectedCategories.join(','))
    
    return `/products?${params.toString()}`
  }, [currentPage, activeCategory, activeBrand, searchTerm, sortOrder, priceRange, selectedCategories])

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
      abortControllersRef.current.forEach(controller => controller.abort())
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
      // Check if this is a multi-value attribute
      const hasMultiValues = variants.some((variant: any) => variant.multiValues?.[type])
      if (hasMultiValues) {
        variants.forEach((variant: any) => {
          if (variant.multiValues?.[type] && Array.isArray(variant.multiValues[type])) {
            variant.multiValues[type].forEach((value: string) => {
              if (value) {
                values.add(value)
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

  const handleCategoryToggle = (categoryName: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryName) 
        ? prev.filter(cat => cat !== categoryName)
        : [...prev, categoryName]
    )
  }

  const handleClearAllFilters = () => {
    setPriceRange([0, 100000])
    setSelectedCategories([])
    setSortOrder('featured')
    setActiveCategory(null)
    clearFilters()
  }

  const handleSortChange = (newSortOrder: string) => {
    setSortOrder(newSortOrder)
  }

  const handleAddToCart = async (productId: number, productName: string, productPrice: number, productVariants?: any[], variantConfig?: any) => {
    
    // Check if product has variants/attributes
    let hasVariants = productVariants && productVariants.length > 0
    let hasAttributes = variantConfig && Object.keys(variantConfig).length > 0
    
    // If variants array exists but is empty, fetch full product data
    if (Array.isArray(productVariants) && productVariants.length === 0) {
      try {
        const response = await fetch(`/api/products/${productId}`)
        if (response.ok) {
          const fullProduct = await response.json()
          
          productVariants = fullProduct.variants || []
          variantConfig = fullProduct.variantConfig || null
          hasVariants = productVariants && productVariants.length > 0
          hasAttributes = variantConfig && Object.keys(variantConfig).length > 0
        }
      } catch (error) {
        console.error('❌ Error fetching full product:', error)
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
          if (values.length > 0) {
            autoSelectedAttributes[attrType] = values[0] // Select first option
          }
        })
        
        
        // Generate combination and calculate price
        const combination = autoSelectedAttributes
        const combinationKey = Object.entries(combination).map(([key, value]) => `${key}:${value}`).join('-')
        const variantId = `combination-0-${combinationKey}`
        const variantPrice = calculatePriceForCombination(combination, productVariants, variantConfig, productPrice)
        
        
        addItem(productId, 1, variantId, combination, variantPrice)
        
        return
      }
    }
    
    // Fallback: simple product without variants - use minimum price
    const minPrice = getMinimumPrice(productPrice, productVariants)
    
    addItem(productId, 1, undefined, {}, minPrice)
  }



  return (
    <div className={cn("flex flex-col min-h-screen w-full overflow-x-hidden", themeClasses.mainBg, themeClasses.mainText)} suppressHydrationWarning>
      {/* Preload first few product images for better performance */}
      <ImagePreloader 
        images={products.slice(0, 6).map((p: any) => p.image).filter((img: any): img is string => Boolean(img))} 
        priority={true} 
      />
      {/* Welcome Message Bar - Mobile Only */}
      <div className="fixed top-0 z-50 w-full bg-stone-100/90 dark:bg-gray-900/95 backdrop-blur-sm border-b border-stone-200 dark:border-gray-700 sm:hidden" suppressHydrationWarning>
        <div className="flex items-center justify-center h-6 px-4" suppressHydrationWarning>
          {isAuthenticated && user ? (
            <div className="text-xs text-green-600 dark:text-green-400 font-medium">
              Hi! {(user as any).user_metadata?.full_name || user.email?.split('@')[0] || 'User'} - Welcome again <span className="text-blue-600 dark:text-blue-400">{companyName}</span>
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
        className="fixed top-6 z-40 w-full bg-stone-200/60 dark:bg-black/50 backdrop-blur-sm border-b border-stone-300 dark:border-gray-800 sm:top-0"
          suppressHydrationWarning
        >
        <div className="flex items-center h-10 sm:h-16 px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 2xl:px-10 w-full max-w-full" suppressHydrationWarning>
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
            href="/"
            className="flex items-center gap-1 sm:hidden text-sm font-semibold flex-shrink-0 min-w-0 ml-0.5 text-gray-900 dark:text-white"
              suppressHydrationWarning
          >
            <Image
              src={companyLogo}
              alt={`${companyName} Logo`}
              width={32}
              height={32}
                className="w-8 h-8 rounded-md"
                suppressHydrationWarning
            />
          </Link>
          {/* Desktop Logo */}
          <Link
            href="/"
            className="hidden sm:flex items-center gap-1 sm:gap-2 text-sm sm:text-base lg:text-lg font-semibold flex-shrink-0 min-w-0 ml-2 sm:ml-0 text-gray-900 dark:text-white"
              suppressHydrationWarning
          >
                              <span className="sr-only" suppressHydrationWarning>{companyName}</span>
            <Image
              src={companyLogo}
              alt={`${companyName} Logo`}
              width={48}
              height={48}
                className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-md"
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

          {/* All Categories Button */}
              <Button
            onClick={() => setIsCategoriesNavOpen(true)}
                variant="ghost"
            size="sm"
            className="hidden sm:flex items-center gap-2 ml-3 text-xs sm:text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Package className="w-4 h-4" />
            All Categories
              </Button>

          {/* Search Bar Container - Moved to start */}
          <div className="flex-1 min-w-0 mx-2 sm:mx-3 md:mx-4 lg:mx-6 xl:mx-8 2xl:mx-10 flex items-center relative" suppressHydrationWarning>
            <form 
              className="relative flex-1 flex items-center" 
              onSubmit={(e) => {
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
                type="search"
                placeholder="Search for products..."
                className={cn(
                    "w-full pl-8 sm:pl-10 pr-20 sm:pr-28 rounded-full h-8 sm:h-10 focus:border-yellow-500 focus:ring-yellow-500 text-xs sm:text-base",
                    darkHeaderFooterClasses.inputBg,
                    darkHeaderFooterClasses.inputBorder,
                    darkHeaderFooterClasses.textNeutralPrimary,
                    darkHeaderFooterClasses.inputPlaceholder,
                )}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setShowSuggestions(true)
                  // Debouncing is now handled by useEffect
                }}
                onFocus={() => {
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
              {/* Search Loading Indicator */}
              {searchTerm && searchTerm !== debouncedSearchTerm && (
                <div className="absolute right-20 sm:right-24 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
                </div>
              )}
              {/* Search Button */}
              <button
                type="submit"
                onClick={(e) => {
                  e.preventDefault()
                  if (searchTerm.trim()) {
                    handleModalTextSearch(searchTerm.trim())
                  }
                }}
                disabled={!searchTerm.trim()}
                className={cn(
                  "absolute right-12 sm:right-16 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 rounded-full flex items-center justify-center transition-colors",
                  searchTerm.trim() 
                    ? cn(darkHeaderFooterClasses.textNeutralSecondaryFixed, "hover:bg-neutral-200 dark:hover:bg-neutral-700")
                    : "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                )}
                title={searchTerm.trim() ? "Search products" : "Enter search term"}
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
                  "absolute right-6 sm:right-8 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 rounded-full flex items-center justify-center",
                  darkHeaderFooterClasses.textNeutralSecondaryFixed,
                  "hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                )}
                title="Search by image"
              >
                <Camera className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              
              {/* Clear Search Button */}
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("")
                    setDebouncedSearchTerm("") // Clear debounced term immediately
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
            <Link href="/ai-agent" className={cn(themeClasses.mainText, "hover:text-orange-400 transition-colors text-sm")}>
              AI Sourcing
            </Link>
            <Link href="/discover" className={cn(themeClasses.mainText, "hover:text-orange-400 transition-colors text-sm")}>
              Discovery
            </Link>
            <Link href="/become-supplier" className={cn(themeClasses.mainText, "hover:text-orange-400 transition-colors text-sm")}>
              Become Supplier
            </Link>
            <Link href="/buyer-central" className={cn(themeClasses.mainText, "hover:text-orange-400 transition-colors text-sm")}>
              Buyer Central
            </Link>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 flex-shrink-0 min-w-0" suppressHydrationWarning>
            {/* Mobile Cart Button - Always Visible */}
            <Link href="/cart" className="sm:hidden">
              <Button
                variant="outline"
                size="icon"
                className="relative bg-white text-neutral-950 border-yellow-500 hover:bg-yellow-500 hover:text-white hover:border-yellow-500 rounded-full transition-colors h-8 w-8"
                suppressHydrationWarning
              >
                <ShoppingCart className="w-3 h-3" />
                <span className="sr-only">Shopping Cart</span>
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground" suppressHydrationWarning>
                  {cartTotalItems}
                </span>
              </Button>
            </Link>


            {/* Theme Switcher Dropdown - Hidden on Mobile */}
            <div className="hidden sm:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                      "flex items-center gap-1 group border border-transparent hover:border-white/20 hover:bg-transparent",
                      darkHeaderFooterClasses.buttonGhostText,
                  )}
                    suppressHydrationWarning
                >
                    <Palette className="w-5 h-5 group-hover:text-yellow-500 transition-colors" />
                    <span className="sr-only" suppressHydrationWarning>Change Background Color ({backgroundColor})</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={cn(
                  darkHeaderFooterClasses.dialogSheetBg,
                  darkHeaderFooterClasses.textNeutralPrimary,
                  darkHeaderFooterClasses.dialogSheetBorder,
                )}
              >
                <DropdownMenuItem
                  onClick={() => setBackgroundColor("dark")}
                  className={cn("hover:bg-yellow-500/10 hover:text-yellow-600 transition-colors", backgroundColor === "dark" && "bg-yellow-500 text-white")}
                  suppressHydrationWarning
                >
                  Dark {backgroundColor === "dark" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setBackgroundColor("gray")}
                  className={cn("hover:bg-yellow-500/10 hover:text-yellow-600 transition-colors", backgroundColor === "gray" && "bg-yellow-500 text-white")}
                  suppressHydrationWarning
                >
                  Gray {backgroundColor === "gray" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setBackgroundColor("white")}
                  className={cn("hover:bg-yellow-500/10 hover:text-yellow-600 transition-colors", backgroundColor === "white" && "bg-yellow-500 text-white")}
                  suppressHydrationWarning
                >
                  White {backgroundColor === "white" && "✓"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                  darkHeaderFooterClasses.dialogSheetBg,
                  darkHeaderFooterClasses.textNeutralPrimary,
                  darkHeaderFooterClasses.dialogSheetBorder,
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
                  {cartTotalItems}
                </span>
              </Button>
            </Link>

            {/* User Profile - Hidden on Mobile */}
            <div className="hidden sm:block">
              {isAuthenticated ? (
                <UserProfile />
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
                      darkHeaderFooterClasses.dialogSheetBg,
                      darkHeaderFooterClasses.textNeutralPrimary,
                      darkHeaderFooterClasses.dialogSheetBorder,
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
      </header>

      {/* Secondary Navigation - Main Categories */}
              <nav className={cn(
                "backdrop-blur-md fixed z-30 w-full",
                // Adjust positioning: mobile header is top-6 (24px) + h-10 (40px) = 64px, desktop header is top-0 + h-16 (64px) = 64px
                "top-[64px] sm:top-[64px]",
                themeClasses.mainBg === "bg-white min-h-screen" 
                  ? "bg-amber-100/80 border-b border-amber-200/50" 
                  : "bg-stone-200/80 border-b border-stone-300/50"
              )}>
        <div className="flex items-center justify-center h-auto sm:h-8 px-1 sm:px-2 lg:px-4 xl:px-6 2xl:px-8 py-1 sm:py-0">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 sm:gap-2 lg:gap-3 xl:gap-4 overflow-visible sm:overflow-x-auto scrollbar-hide">
            {/* All Categories Button - Always visible */}
            <button
              onClick={() => {
                // Clear category filter to show all products
                setSearchTerm("") // Clear search term
                setDebouncedSearchTerm("") // Clear debounced search term
                setActiveCategory(null) // Clear active category
                clearFilters()
              }}
              className={cn(
                "flex items-center gap-1 px-1 py-0.5 rounded text-[8px] sm:text-[10px] lg:text-xs font-medium transition-colors whitespace-nowrap cursor-pointer",
                activeCategory === null
                  ? themeClasses.mainBg === "bg-white min-h-screen"
                    ? "text-black bg-amber-200/60"
                    : "text-black bg-stone-300/60"
                  : themeClasses.mainBg === "bg-white min-h-screen"
                    ? "text-black hover:text-black hover:bg-amber-200/40"
                    : "text-black hover:text-black hover:bg-stone-300/40"
              )}
            >
              <Home className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>All</span>
            </button>

            {/* Mobile Categories - Only show 5 with rotation */}
            {!categoriesLoading && categoriesList.slice(mobileCategoryStartIndex, mobileCategoryStartIndex + MOBILE_CATEGORIES_PER_ROW).map((category) => {
              const IconComponent = categoryIcons[category.name] || categoryIcons.default
              return (
                <button
                  key={category.name}
                  onClick={() => {
                    // Filter by specific category
                    setSearchTerm("") // Clear search term when filtering by category
                    setDebouncedSearchTerm("") // Clear debounced search term
                    setActiveCategory(category.name) // Set active category
                    // Note: No need to call filterByCategory since useInfiniteProducts handles filtering
                  }}
                  className={cn(
                    "flex items-center gap-1 px-1 py-0.5 rounded text-[8px] sm:text-[10px] lg:text-xs font-medium transition-colors whitespace-nowrap cursor-pointer",
                    activeCategory === category.name
                      ? themeClasses.mainBg === "bg-white min-h-screen"
                        ? "text-black bg-amber-200/60"
                        : "text-black bg-stone-300/60"
                      : themeClasses.mainBg === "bg-white min-h-screen"
                        ? "text-black hover:text-black hover:bg-amber-200/40"
                        : "text-black hover:text-black hover:bg-stone-300/40"
                  )}
                >
                  <IconComponent className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span>{category.name}</span>
                </button>
              )
            })}

            {/* Desktop Categories - Show all (hidden on mobile) */}
            {!categoriesLoading && categoriesList.slice(0, 10).map((category) => {
              const IconComponent = categoryIcons[category.name] || categoryIcons.default
              return (
                <button
                  key={`desktop-${category.name}`}
                  onClick={() => {
                    // Filter by specific category
                    setSearchTerm("") // Clear search term when filtering by category
                    setDebouncedSearchTerm("") // Clear debounced search term
                    setActiveCategory(category.name) // Set active category
                    // Note: No need to call filterByCategory since useInfiniteProducts handles filtering
                  }}
                  className={cn(
                    "hidden sm:flex items-center gap-1 px-1 py-0.5 rounded text-[8px] sm:text-[10px] lg:text-xs font-medium transition-colors whitespace-nowrap cursor-pointer",
                    activeCategory === category.name
                      ? themeClasses.mainBg === "bg-white min-h-screen"
                        ? "text-black bg-amber-200/60"
                        : "text-black bg-stone-300/60"
                      : themeClasses.mainBg === "bg-white min-h-screen"
                        ? "text-black hover:text-black hover:bg-amber-200/40"
                        : "text-black hover:text-black hover:bg-stone-300/40"
                  )}
                >
                  <IconComponent className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span>{category.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      <main className={cn("flex-1 pt-32 xs:pt-28 sm:pt-32", themeClasses.mainBg)} suppressHydrationWarning>

        {/* Ads Container - Above filter buttons */}
        {!adsLoading && advertisements.length > 0 && (
          <div className="px-1 sm:px-2 lg:px-3 mb-6">
            <div 
              className="w-full relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Previous Arrow */}
              {advertisements.length > 1 && (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setCurrentAdIndex((prev) => prev === 0 ? advertisements.length - 1 : prev - 1)
                  }}
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 z-30 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 sm:p-3 transition-all duration-200 shadow-lg hover:shadow-xl"
                  aria-label="Previous ad"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
              
              {/* Next Arrow */}
              {advertisements.length > 1 && (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setCurrentAdIndex((prev) => (prev + 1) % advertisements.length)
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 z-30 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 sm:p-3 transition-all duration-200 shadow-lg hover:shadow-xl"
                  aria-label="Next ad"
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              {advertisements[currentAdIndex] && (
                <Link 
                  href={advertisements[currentAdIndex].link_url || "/products"}
                  className="block cursor-pointer h-32 sm:h-48 relative z-10"
                >
                  <div className="relative overflow-hidden hover:scale-105 transition-all duration-500 rounded-sm h-full bg-gray-100 dark:bg-gray-800">
                    {advertisements[currentAdIndex].media_type === 'image' ? (
                      <LazyImage
                        key={currentAdIndex}
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
              )}
              
              {/* Ad Navigation Dots */}
              {advertisements.length > 1 && (
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 z-20">
                  {advertisements.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
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

        {/* Filter and Sort Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 px-1 sm:px-2 lg:px-3" suppressHydrationWarning>
          {/* Left Side - Filter Buttons and Product Count */}
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto" suppressHydrationWarning>
            {/* Filter Buttons */}
            <div className="flex items-center gap-2" suppressHydrationWarning>
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
              <Sheet open={isCategoryFilterOpen} onOpenChange={setIsCategoryFilterOpen}>
                <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex items-center gap-1 sm:gap-2 bg-transparent group h-8 sm:h-10",
                    themeClasses.mainText,
                    themeClasses.borderNeutralSecondary,
                      selectedCategories.length > 0 && "border-yellow-500 text-yellow-500"
                    )}
                  >
                    <Tag className="w-3 h-3 sm:w-4 sm:h-4 group-hover:text-yellow-500 transition-colors" />
                    <span className="text-xs sm:text-sm group-hover:text-yellow-500 transition-colors">
                      Categories {selectedCategories.length > 0 && `(${selectedCategories.length})`}
                    </span>
                  </Button>
                </SheetTrigger>
                <SheetContent className={cn(themeClasses.cardBg, themeClasses.mainText)}>
                  <SheetHeader>
                    <SheetTitle>Filter by Category</SheetTitle>
                    <p className="text-sm text-muted-foreground">Select categories to filter products</p>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <div className="space-y-3">
                      {categoriesList.map((category) => (
                        <div key={category.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={category.slug}
                            checked={selectedCategories.includes(category.name)}
                            onCheckedChange={() => handleCategoryToggle(category.name)}
                          />
                          <Label htmlFor={category.slug} className="text-sm">
                            {category.name}
                          </Label>
                </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                  <Button
                        onClick={() => setSelectedCategories([])}
                    variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        Clear All
                  </Button>
                  <Button
                        onClick={() => setIsCategoryFilterOpen(false)}
                        size="sm"
                        className="flex-1 bg-yellow-500 hover:bg-yellow-600"
                      >
                        Apply
                  </Button>
          </div>
                  </div>
                </SheetContent>
              </Sheet>

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

            {/* Product Count */}
            <span className={cn("text-xs sm:text-sm whitespace-nowrap flex items-center gap-1", themeClasses.textNeutralSecondary)}>
              <Package className={cn("w-3 h-3 sm:w-4 sm:h-4", themeClasses.textNeutralSecondary)} />
              {displayedProducts.length} of {infiniteTotalCount > 0 ? infiniteTotalCount : products.length} products
            </span>
          </div>

          {/* Right Side - Sort Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto" suppressHydrationWarning>
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
                              sortOrder === 'best-selling' ? 'Best Selling' : 'Featured'}
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


        {/* Promotional Text Below Advertisement */}
        <div className="px-1 sm:px-2 lg:px-3 mb-6">
          <div className="text-center">
            {/* Decorative Line Above */}
            <div className="mb-2">
              <div className="w-4/5 h-0.5 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-full mx-auto"></div>
            </div>
            
            <h2 className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-1 font-serif whitespace-nowrap overflow-hidden text-ellipsis">
              Quality-Trusted Component Store
            </h2>
            {/* Removed promotional subheading per request */}
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
        {!isLoading && !error && (
          <InfiniteScrollTrigger
            onLoadMore={infiniteLoadMore}
            hasMore={hasMoreProducts}
            loading={infiniteLoadingMore}
            error={infiniteError}
          >
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-9 gap-1 px-1 sm:px-2 lg:px-3" suppressHydrationWarning>
            {displayedProducts.length === 0 ? (
              // No Offers Found Message
              <div className="col-span-full flex flex-col items-center justify-center py-12 px-4 text-center">
                <Package className="w-16 h-16 text-neutral-400 mb-4" />
                <h3 className={cn("text-lg font-semibold mb-2", themeClasses.mainText)}>
                  No Products Available
                </h3>
                <p className={cn("text-sm mb-6 max-w-md", themeClasses.textNeutralSecondary)}>
                  We couldn't find any products at the moment. Please check back later for new products.
                </p>
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
            ) : (
              <>
                
                {/* All Product Cards */}
            {displayedProducts.map((product: any, index: number) => {
            
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
            // TEMPORARY: Create test discounts for first few products to verify display works
            let testOriginalPrice = product.originalPrice
            if (index < 3 && product.originalPrice <= product.price) {
              testOriginalPrice = Math.round(product.price * 1.2) // 20% higher than current price
            }
            
            const discountPercentage = ((testOriginalPrice - effectivePrice) / testOriginalPrice) * 100
            
            const productInCart = isInCart(product.id, product.variants?.[0]?.id) // Check if product or its default variant is in cart
            
            return (
              <Card
                key={`${product.id}-${index}`}
                data-product-id={product.id}
                className={cn(
                  "flex flex-col overflow-hidden rounded-sm",
                  themeClasses.cardBg,
                  themeClasses.mainText,
                  themeClasses.cardBorder,
                )}
                style={{ contentVisibility: 'auto', containIntrinsicSize: '320px 420px' }}
                    suppressHydrationWarning
              >
                    <OptimizedLink 
                      href={`/products/${product.id}-${encodeURIComponent(product.slug || product.name || 'product')}?returnTo=${encodeURIComponent(`${pathname}${(urlSearchParams?.get('search') || searchTerm)?.trim() ? `?search=${encodeURIComponent((urlSearchParams?.get('search') || searchTerm).trim())}` : (urlSearchParams?.toString() ? `?${urlSearchParams.toString()}` : '')}`)}`} 
                      className="block relative aspect-square overflow-hidden" 
                      prefetch={false}
                      priority="low"
                      suppressHydrationWarning
                    >
                  {product.image && (
                    <LazyImage
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-300 hover:scale-105"
                      priority={false}
                      quality={60}
                      sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 20vw"
                    />
                  )}
                  {/* Delivery Badges - Top Left */}
                  <div className="absolute top-1 left-1 sm:top-2 sm:left-2 z-10 flex flex-col gap-0.5 sm:gap-1" suppressHydrationWarning>
                    {product.freeDelivery && (
                      <span className="bg-green-500 text-white text-[8px] sm:text-[10px] px-0.5 sm:px-1 py-0.5 rounded-none shadow-sm sm:shadow-md" suppressHydrationWarning>
                        Free Delivery
                      </span>
                    )}
                    {product.sameDayDelivery && (
                      <span className="bg-blue-500 text-white text-[9px] sm:text-[10px] px-0.5 sm:px-1 py-0.5 rounded-none shadow-sm sm:shadow-md" suppressHydrationWarning>
                        Same Day
                      </span>
                    )}
                  </div>
                  
                  {/* Single Badge on Right */}
                  <div className="absolute top-0 right-0 sm:top-0 sm:right-1.5 z-10" suppressHydrationWarning>
                    {product.reviews > 1000 ? (
                          <span className="bg-black/60 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-none shadow-sm sm:shadow-md" suppressHydrationWarning>
                        Popular
                      </span>
                    ) : product.id > 10 ? (
                          <span className="bg-black/60 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-none shadow-sm sm:shadow-md" suppressHydrationWarning>
                        New
                      </span>
                    ) : discountPercentage > 0 ? (
                           <span className="bg-black/60 text-white text-[8px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-none shadow-sm sm:shadow-md" suppressHydrationWarning>
                        {discountPercentage.toFixed(0)}% OFF
                      </span>
                    ) : (
                          <span className="bg-black/60 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-none shadow-sm sm:shadow-md" suppressHydrationWarning>
                        Free Shipping
                      </span>
                    )}
                  </div>
                    </OptimizedLink>
                    <CardContent className="p-1 flex-1 flex flex-col justify-between" suppressHydrationWarning>
                      <OptimizedLink 
                        href={`/products/${product.id}-${encodeURIComponent(product.slug || product.name || 'product')}?returnTo=${encodeURIComponent(`${pathname}${(urlSearchParams?.get('search') || searchTerm)?.trim() ? `?search=${encodeURIComponent((urlSearchParams?.get('search') || searchTerm).trim())}` : (urlSearchParams?.toString() ? `?${urlSearchParams.toString()}` : '')}`)}`}
                        className="block"
                        prefetch={false}
                        priority="low"
                      >
                        <h3 className="text-xs font-semibold sm:text-sm lg:text-base hover:text-blue-600 dark:hover:text-blue-400 transition-colors" suppressHydrationWarning>{product.name}</h3>
                      </OptimizedLink>
                  <div
                    className={cn(
                      "flex items-center gap-1 text-[10px] mt-0.5 sm:text-xs",
                      themeClasses.textNeutralSecondary,
                    )}
                        suppressHydrationWarning
                  >
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < Math.floor(product.rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : themeClasses.textNeutralSecondary
                        }`}
                            suppressHydrationWarning
                      />
                    ))}
                        <span suppressHydrationWarning>({product.reviews})</span>
                  </div>
                      <div className="flex flex-wrap items-baseline gap-x-2 mt-0.5" suppressHydrationWarning>
                        <div className="text-sm font-bold sm:text-base lg:text-lg" suppressHydrationWarning>{formatPrice(effectivePrice)}</div>
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
                    className="w-full text-xs py-1 h-auto sm:text-sm lg:text-base bg-yellow-500 text-neutral-950 hover:bg-yellow-600 rounded-none"
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
        )}

        {/* Next Page Navigation */}
        {!hasMoreProducts && currentPageProductCount >= PRODUCTS_PER_PAGE && hasNextPage && (
          <div className="flex flex-col items-center justify-center py-12 px-4 gap-4" suppressHydrationWarning>
            <div className="text-center">
              <p className={cn("text-lg font-semibold mb-2", themeClasses.mainText)}>
                Showing {currentPageProductCount} products (Page {currentPage})
              </p>
              <p className={cn("text-sm mb-6", themeClasses.textNeutralSecondary)}>
                {infiniteTotalCount > PRODUCTS_PER_PAGE 
                  ? `${infiniteTotalCount - currentPageProductCount} more products available` 
                  : 'More products available'}
              </p>
            </div>
            <Link href={buildNextPageUrl()}>
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
        
        {/* No products found */}
        {products.length === 0 && !isLoading && (
          <div className="flex justify-center py-8" suppressHydrationWarning>
            <p className={cn("text-lg", themeClasses.textNeutralSecondary)}>
              No products found matching your criteria.
            </p>
          </div>
        )}
      </main>

      {/* Categories Left Navigation Panel */}
      <Sheet open={isCategoriesNavOpen} onOpenChange={setIsCategoriesNavOpen}>
        <SheetContent side="left" className={cn(themeClasses.cardBg, themeClasses.mainText, "w-80 sm:w-96")}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              All Categories
            </SheetTitle>
            <p className="text-sm text-muted-foreground">Browse products by category</p>
          </SheetHeader>
          
          <div className="mt-6 space-y-2">
            {/* All Categories Option */}
            <Button
              onClick={() => {
                setActiveCategory(null)
                clearFilters()
                setIsCategoriesNavOpen(false)
              }}
              variant="ghost"
              className={cn(
                "w-full justify-start text-left h-auto py-3 px-4 hover:bg-gray-100 dark:hover:bg-gray-800",
                activeCategory === null ? "bg-amber-100 dark:bg-amber-900/20" : ""
              )}
            >
              <Home className="w-4 h-4 mr-3" />
              <div className="flex flex-col">
                <span className="font-medium">All Categories</span>
                <span className="text-xs text-muted-foreground">View all products</span>
              </div>
            </Button>

            {/* Category List */}
            {categoriesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500"></div>
                <span className="ml-2 text-sm text-muted-foreground">Loading categories...</span>
              </div>
            ) : (
              <div className="space-y-1">
                {categoriesList.map((category) => {
                  const IconComponent = categoryIcons[category.name] || categoryIcons.default
                  return (
                    <Button
                      key={category.id}
                      onClick={() => {
                        setActiveCategory(category.name)
                        setIsCategoriesNavOpen(false)
                      }}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start text-left h-auto py-3 px-4 hover:bg-gray-100 dark:hover:bg-gray-800",
                        activeCategory === category.name ? "bg-amber-100 dark:bg-amber-900/20" : ""
                      )}
                    >
                      <IconComponent className="w-4 h-4 mr-3" />
                      <div className="flex flex-col">
                        <span className="font-medium">{category.name}</span>
                        <span className="text-xs text-muted-foreground">Browse {category.name.toLowerCase()} products</span>
                      </div>
                    </Button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => {
                  setActiveCategory(null)
                  handleClearAllFilters()
                  setIsCategoriesNavOpen(false)
                }}
                variant="outline"
                className="w-full"
              >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Clear All Filters
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Footer />

      {/* Mobile Hamburger Menu */}
      <div className={`hamburger-overlay ${isHamburgerMenuOpen ? 'open' : ''}`} onClick={() => setIsHamburgerMenuOpen(false)} />
      <div className={`hamburger-menu ${isHamburgerMenuOpen ? 'open' : ''}`}>
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 className="text-lg font-semibold text-white">Menu</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsHamburgerMenuOpen(false)}
            className="text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Search in Hamburger Menu */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              type="search"
              placeholder="Search for products..."
              className="w-full pl-10 pr-4 bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                // Debouncing is now handled by useEffect
              }}
            />
          </div>

          {/* Navigation Links */}
          <div className="space-y-2">

            <Link href="/cart" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-white">
              <ShoppingCart className="w-5 h-5" />
              Shopping Cart ({cartTotalItems})
            </Link>
          </div>

          {/* Theme Switcher */}
          <div className="border-t border-neutral-700 pt-4">
            <h3 className="text-sm font-semibold text-white mb-2">Theme</h3>
            <div className="space-y-2">
              <Button
                variant="ghost"
                className={`w-full justify-start ${backgroundColor === 'dark' ? 'bg-yellow-500 text-black' : 'text-white hover:bg-white/10'}`}
                onClick={() => setBackgroundColor('dark')}
              >
                Dark Mode
              </Button>
              <Button
                variant="ghost"
                className={`w-full justify-start ${backgroundColor === 'gray' ? 'bg-yellow-500 text-black' : 'text-white hover:bg-white/10'}`}
                onClick={() => setBackgroundColor('gray')}
              >
                Gray Mode
              </Button>
              <Button
                variant="ghost"
                className={`w-full justify-start ${backgroundColor === 'white' ? 'bg-yellow-500 text-black' : 'text-white hover:bg-white/10'}`}
                onClick={() => setBackgroundColor('white')}
              >
                Light Mode
              </Button>
            </div>
          </div>

          {/* Currency Switcher */}
          <div className="border-t border-neutral-700 pt-4">
            <h3 className="text-sm font-semibold text-white mb-2">Currency</h3>
            <div className="space-y-2">
              <Button
                variant="ghost"
                className={`w-full justify-start ${currency === 'USD' ? 'bg-yellow-500 text-black' : 'text-white hover:bg-white/10'}`}
                onClick={() => setCurrency('USD')}
              >
                <DollarSign className="w-4 h-4 mr-2" /> USD
              </Button>
              <Button
                variant="ghost"
                className={`w-full justify-start ${currency === 'TZS' ? 'bg-yellow-500 text-black' : 'text-white hover:bg-white/10'}`}
                onClick={() => setCurrency('TZS')}
              >
                <Landmark className="w-4 h-4 mr-2" /> TZS
              </Button>
            </div>
          </div>

          {/* User Account */}
          <div className="border-t border-neutral-700 pt-4">
            <h3 className="text-sm font-semibold text-white mb-2">Account</h3>
            <div className="space-y-2">
              <Button 
                className="w-full bg-yellow-500 text-black hover:bg-yellow-600"
                onClick={() => {
                  setIsHamburgerMenuOpen(false)
                  openAuthModal('login')
                }}
              >
                Sign In
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-white/20 text-white hover:bg-white/10"
                onClick={() => {
                  setIsHamburgerMenuOpen(false)
                  openAuthModal('register')
                }}
              >
                Register
              </Button>
            </div>
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
    </div>
  )
}