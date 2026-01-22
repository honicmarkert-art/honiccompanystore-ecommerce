"use client"

import { BuyerRouteGuard } from '@/components/buyer-route-guard'
import { ProductDetailErrorBoundary } from '@/components/product-detail-error-boundary'
import { DialogTrigger } from "@/components/ui/dialog"
import { SearchSuggestions } from "@/components/search-suggestions"
import { SearchModal } from "@/components/search-modal"
import { QuantityLimitModal } from "@/components/quantity-limit-modal"

import type React from "react"

import { Label } from "@/components/ui/label"

import { useState, useMemo, useEffect, useCallback, useRef } from "react" // Added useCallback
import Image from "next/image"
import { LazyImage } from "@/components/lazy-image"
import Link from "next/link"
import {
  Star,
  ShoppingCart,
  Plus,
  Minus,
  Truck,
  RefreshCcw,
  Heart,
  ChevronLeft,
  ChevronDown,
  Share2,
  Headphones,
  MessageSquareText,
  CheckCircle,
  Info,
  Package,
  Clock,
  Undo2,
  LifeBuoy,
  CalendarClock,
  ClipboardList,
  HelpCircle,
  ShieldCheck,
  BellDot,
  Facebook,
  Instagram,
  Youtube,
  CreditCard,
  Wallet,
  Mail,
  UsersIcon,
  Palette,
  Search,
  ScanSearch,
  X,
  ImageIcon,
  User,
  Coins,
  MessageSquare,
  Ticket,
  Play,
    RotateCcw,
    Edit,
    Eye,
  Settings,
  Moon,
  Sun,
  UserPlus,
  Sparkles,
  Compass,
  Laptop,
  TrendingUp,
  MapPin,
  } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast" // Import useToast hook
import { checkProductStock } from "@/utils/stock-validation"
import { getLeftBadge, getRightBadge } from '@/utils/product-badges'
import { useProducts } from "@/hooks/use-products"
import { useSharedDataCache } from "@/contexts/shared-data-cache"
import { OptimizedLink, useOptimizedNavigation } from "@/components/optimized-link"
import { type ProductVariant } from "@/hooks/use-products" // Import types from hook
import { useCart, formatVariantHierarchy } from "@/hooks/use-cart" // Import useCart hook
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation"
import { usePublicCompanyContext } from "@/contexts/public-company-context"
// import { getPreviousPageName } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { fetchJSON, fetchWithMetrics, fetchWithRetry, type FetchMetrics } from "@/lib/fetch-utils"
import { useWishlist } from "@/hooks/use-wishlist"
import { useSavedLater } from "@/hooks/use-saved-later"
import { validateReviewComment, validateRating, sanitizeString } from "@/lib/input-validation"
import { validateProductResponse, sanitizeProductData, validateReviewResponse, sanitizeReviewData } from "@/lib/response-validation"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { useCurrency } from "@/contexts/currency-context"
import { UserProfile } from "@/components/user-profile"
import { ImagePreloader } from "@/components/image-preloader"
import { Footer } from "@/components/footer"
import { 
  ProductImageSkeleton, 
  ProductInfoSkeleton, 
  VariantSelectionSkeleton, 
  RelatedProductsSkeleton,
  ButtonSkeleton 
} from "@/components/ui/skeleton"


// Component for navigation links that hide on screens below 13 inches
function NavigationLinks13InchProductDetail({ darkHeaderFooterClasses, toast }: { darkHeaderFooterClasses: any, toast: any }) {
  const [isBelow13Inch, setIsBelow13Inch] = useState(false)
  const router = useRouter()

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

  const handleComingSoon = (e: React.MouseEvent) => {
    e.preventDefault()
    toast({
      title: "Coming Soon",
      description: "This feature will be available soon!",
      duration: 3000,
    })
  }

  const handleDiscoverClick = (e: React.MouseEvent) => {
    e.preventDefault()
    router.push('/products')
  }

  if (isBelow13Inch) {
    return null
  }

  return (
    <>
      <button
        onClick={handleComingSoon}
        className={cn(
          "hidden sm:flex items-center gap-1 cursor-pointer",
          darkHeaderFooterClasses.buttonGhostText,
        )}
      >
        <Sparkles className="w-5 h-5" />
        <span className="hidden sm:inline hover:opacity-80 transition-opacity">AI Sourcing</span>
      </button>
      
      <button
        onClick={handleDiscoverClick}
        className={cn(
          "hidden sm:flex items-center gap-1 cursor-pointer",
          darkHeaderFooterClasses.buttonGhostText,
        )}
      >
        <Compass className="w-5 h-5" />
        <span className="hidden sm:inline hover:opacity-80 transition-opacity">Discovery</span>
      </button>
      
      <button
        onClick={handleComingSoon}
        className={cn(
          "hidden sm:flex items-center gap-1 cursor-pointer",
          darkHeaderFooterClasses.buttonGhostText,
        )}
      >
        <UserPlus className="w-5 h-5" />
        <span className="hidden sm:inline hover:opacity-80 transition-opacity">Become Seller</span>
      </button>
    </>
  )
}

function ProductDetailPageContent() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { navigateWithPrefetch } = useOptimizedNavigation()
  const { backgroundColor, setBackgroundColor, themeClasses, darkHeaderFooterClasses } = useTheme()
  const { products, isLoading, preloadProducts } = useProducts()
  const { addItem, isInCart, cartUniqueProducts } = useCart() // Use useCart hook
  const { companyName, companyLogo, companyColor, isLoaded: companyLoaded } = usePublicCompanyContext()
  
  // Fallback logo system - use local logo if API is not loaded or logo is not available
  const fallbackLogo = "/android-chrome-512x512.png"
  const displayLogo = companyLoaded && companyLogo && companyLogo !== fallbackLogo && companyLogo !== "/placeholder-logo.png" ? companyLogo : fallbackLogo
  const { user, isAuthenticated } = useAuth() // Add auth context
  const { openAuthModal } = useGlobalAuthModal()
  
  // State for reviews
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [reviewFormData, setReviewFormData] = useState({
    rating: 0,
    comment: '',
    images: [] as string[]
  })
  const [submittingReview, setSubmittingReview] = useState(false)
  const { formatPrice, currency, setCurrency } = useCurrency()
  
  // Optimized API for product details with input validation
  // Support URLs like /products/2-slug by extracting leading digits
  const rawProductParam = params.id as string
  const leadingDigits = (rawProductParam.match(/^\d+/) || [rawProductParam])[0]
  const productId = leadingDigits
  
  // Get return URL from search params to preserve search state
  const returnTo = searchParams?.get('returnTo') || '/products'
  
  // Check if user came from China page
  const fromChina = searchParams?.get('from') === 'china'
  
  // Shared data cache for cross-page data
  const { set } = useSharedDataCache()
  
  // Validate product ID (but don't return early - violates Rules of Hooks!)
  const productIdNumber: number = Number.parseInt(params.id as string) || 0
  const isValidProductId: boolean = !!(productId && !isNaN(Number(productId)) && Number(productId) > 0)
  
  // Single optimized product state - fetch once, use CDN cache
  const [productData, setProductData] = useState<any>(null)
  const [isLoadingProduct, setIsLoadingProduct] = useState(false)
  
  // Check cache first, then fetch - enables immediate display from cache
  // But prioritize API data over cached data to ensure full details are shown
  const product = useMemo(() => {
    // Priority 1: Use fetched product data (has full details from API)
    if (productData && typeof productData === 'object' && 'id' in productData && productData.id) {
      return productData
    }
    // Priority 2: Check shared cache (may have limited fields from list page)
    // Only use cached product if we're not currently loading (to avoid showing stale data)
    if (!isLoadingProduct && Array.isArray(products) && products.length > 0 && productIdNumber) {
      const foundProduct = products.find((p) => p.id === productIdNumber)
      if (foundProduct) {
        return foundProduct
      }
    }
    return undefined
  }, [products, productIdNumber, productData, isLoadingProduct])

  // Request deduplication - prevent duplicate API calls
  const fetchRequestRef = useRef<Map<string, Promise<any>>>(new Map())
  const lastFetchedProductIdRef = useRef<number | null>(null)
  
  // Reset productData when product ID changes (separate effect to avoid race conditions)
  useEffect(() => {
    if (productIdNumber && isValidProductId) {
      // Reset if navigating to a different product
      if (lastFetchedProductIdRef.current !== null && lastFetchedProductIdRef.current !== productIdNumber) {
        setProductData(null)
        lastFetchedProductIdRef.current = null
      }
    }
  }, [productIdNumber, isValidProductId])
  
  // Single parallel fetch with CDN caching - ALL data in parallel, no delays
  // Always fetch from API to get full details (description, specifications, variant images)
  // Cached product from list page may not have all fields
  useEffect(() => {
    if (!productIdNumber || !isValidProductId) return
    
    // Only skip fetch if we already have full data for THIS product
    if (productData && productData.id === productIdNumber && lastFetchedProductIdRef.current === productIdNumber) {
      return
    }

    setIsLoadingProduct(true)
    
    // AbortController for request cancellation
    const abortController = new AbortController()
    const signal = abortController.signal
    
    // Request deduplication key
    const requestKey = `product-${productIdNumber}`
    
    // Check if request is already in flight
    if (fetchRequestRef.current.has(requestKey)) {
      fetchRequestRef.current.get(requestKey)?.then(() => {
        setIsLoadingProduct(false)
      }).catch(() => {
        setIsLoadingProduct(false)
      })
      return
    }
    
    // Performance tracking
    const performanceMetrics: FetchMetrics[] = []
    
    // Helper function for safe fetch with retry, timeout, and metrics
    const safeFetch = async <T = any>(url: string, fetchOptions: { cache?: RequestCache } & RequestInit = {}): Promise<T | null> => {
      try {
        const { cache: cacheOption, ...restOptions } = fetchOptions
        const { response, metrics } = await fetchWithMetrics(url, {
          ...restOptions,
          signal,
          timeout: 10000, // 10 second timeout
          retries: 2, // Retry twice on failure
          retryDelay: 500, // Start with 500ms delay
          exponentialBackoff: true, // Use exponential backoff
          headers: {
            'Content-Type': 'application/json',
            ...restOptions.headers
          },
          cache: cacheOption || 'default' // Use provided cache option or default
        })
        
        // Track performance metrics
        performanceMetrics.push(metrics)
        
        if (!response.ok) {
          // Log non-2xx responses for monitoring
          if (response.status >= 500) {
          }
          return null
        }
        
        return await response.json()
      } catch (error: any) {
        // Ignore abort errors (expected when component unmounts)
        if (error?.name === 'AbortError' || signal.aborted) {
          return null
        }
        
        // Log metrics if available
        if (error.metrics) {
          performanceMetrics.push(error.metrics)
        }
        return null
      }
    }
    
    // Parallel fetch: ALL requests simultaneously (CDN cached)
    // Add cache-busting timestamp for first load to ensure fresh data
    const cacheBuster = lastFetchedProductIdRef.current === null ? `?t=${Date.now()}` : ''
    const fetchPromise = Promise.all([
      // Main product fetch (CDN cache enabled, but bust cache on first load)
      safeFetch(`/api/products/${productIdNumber}${cacheBuster}`, {
        priority: 'high' as RequestPriority,
        cache: lastFetchedProductIdRef.current === null ? 'no-cache' : 'default'
      }),
      
      // Variant images (parallel, CDN cached, but bust cache on first load)
      safeFetch(`/api/products/${productIdNumber}/variant-images?limit=5${cacheBuster}`, {
        cache: lastFetchedProductIdRef.current === null ? 'no-cache' : 'default'
      }),
      
      // Reviews (parallel, CDN cached)
      safeFetch(`/api/products/${productIdNumber}/reviews`),
      
      // Sold count (parallel, CDN cached)
      safeFetch(`/api/products/${productIdNumber}/sold-count`)
    ]).then(([productResult, variantImagesData, reviewsData, soldCountData]) => {
      // Remove from deduplication map
      fetchRequestRef.current.delete(requestKey)
      
      // Log performance metrics if available
      if (performanceMetrics.length > 0) {
        const totalDuration = performanceMetrics.reduce((sum, m) => sum + m.duration, 0)
        const avgDuration = totalDuration / performanceMetrics.length
        const cacheHitRate = performanceMetrics.filter(m => m.cached).length / performanceMetrics.length
        
      }
      
      // Security: Validate product response before using
      if (productResult && validateProductResponse(productResult)) {
        // Sanitize product data to prevent XSS
        const sanitizedProduct = sanitizeProductData(productResult)
        
        // Merge all data immediately - no delays
        const mergedProduct = {
          ...sanitizedProduct,
          variantImages: variantImagesData?.variantImages || sanitizedProduct.variantImages || [],
          reviews: reviewsData?.reviews || sanitizedProduct.reviews || [],
          sold_count: soldCountData?.soldCount || sanitizedProduct.sold_count || 0
        }
        
        setProductData(mergedProduct)
        lastFetchedProductIdRef.current = productIdNumber // Track that we've fetched this product
        
        // Update variant images state (validate structure and normalize)
        if (variantImagesData?.variantImages && Array.isArray(variantImagesData.variantImages)) {
          // Normalize variant images to ensure consistent structure
          const normalizedVariantImages: Array<{
            variantId?: number
            imageUrl: string
            attribute?: {name: string, value: string}
            attributes?: Array<{name: string, value: string}>
          }> = []
          
          variantImagesData.variantImages.forEach((img: any) => {
            // Handle different formats: string, object with imageUrl, or object with image
            if (typeof img === 'string' && img.trim() !== '') {
              normalizedVariantImages.push({ imageUrl: img.trim() })
            } else if (img && typeof img === 'object') {
              const imageUrl = (img.imageUrl || img.image || img.url || '').trim()
              if (imageUrl) {
                normalizedVariantImages.push({
                  imageUrl,
                  variantId: img.variantId || img.variant_id,
                  attribute: img.attribute,
                  attributes: img.attributes
                })
              }
            }
          })
          
          setVariantImages(normalizedVariantImages)
        } else if (variantImagesData && Array.isArray(variantImagesData)) {
          // Handle case where API returns array directly
          const normalizedVariantImages: Array<{
            variantId?: number
            imageUrl: string
            attribute?: {name: string, value: string}
            attributes?: Array<{name: string, value: string}>
          }> = []
          
          variantImagesData.forEach((img: any) => {
            if (typeof img === 'string' && img.trim() !== '') {
              normalizedVariantImages.push({ imageUrl: img.trim() })
            } else if (img && typeof img === 'object') {
              const imageUrl = (img.imageUrl || img.image || img.url || '').trim()
              if (imageUrl) {
                normalizedVariantImages.push({
                  imageUrl,
                  variantId: img.variantId || img.variant_id,
                  attribute: img.attribute,
                  attributes: img.attributes
                })
              }
            }
          })
          
          setVariantImages(normalizedVariantImages)
        }
        
        // Security: Validate and sanitize reviews before setting
        if (reviewsData && validateReviewResponse(reviewsData)) {
          const reviews = Array.isArray(reviewsData.reviews) ? reviewsData.reviews : reviewsData
          const sanitizedReviews = Array.isArray(reviews) 
            ? reviews.map((review: any) => sanitizeReviewData(review)).filter(Boolean)
            : []
          setReviews(sanitizedReviews)
        }
        
        // Update sold count state
        if (soldCountData) {
          setSoldCount({
            soldCount: soldCountData.soldCount || 0,
            buyersCount: soldCountData.buyersCount || null
          })
        }
      } else {
        // Log if product not found
      }
      
      setIsLoadingProduct(false)
    }).catch((error: any) => {
      // Remove from deduplication map on error
      fetchRequestRef.current.delete(requestKey)
      
      // Only log non-abort errors
      if (error?.name !== 'AbortError') {
      }
      setIsLoadingProduct(false)
    })
    
    // Store promise for deduplication
    fetchRequestRef.current.set(requestKey, fetchPromise)
    
    return () => {
      abortController.abort()
      // Clean up deduplication map after 5 seconds
      setTimeout(() => {
        fetchRequestRef.current.delete(requestKey)
      }, 5000)
    }
  }, [productIdNumber, isValidProductId, productData]) // Use productData instead of product to ensure we always fetch full details

  // Fetch fresh variant images/thumbnails from database after 3 seconds
  // This ensures thumbnails are loaded even if initial fetch didn't include them
  useEffect(() => {
    if (!productIdNumber || !isValidProductId) return
    
    const refreshTimer = setTimeout(async () => {
      try {
        // Fetch variant images with cache-busting to ensure fresh data from DB
        const response = await fetch(`/api/products/${productIdNumber}/variant-images?limit=5&t=${Date.now()}`, {
          cache: 'no-cache',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          
          // Update variant images state if we got new data
          if (data?.variantImages && Array.isArray(data.variantImages)) {
            const normalizedVariantImages: Array<{
              variantId?: number
              imageUrl: string
              attribute?: {name: string, value: string}
              attributes?: Array<{name: string, value: string}>
            }> = []
            
            data.variantImages.forEach((img: any) => {
              if (typeof img === 'string' && img.trim() !== '') {
                normalizedVariantImages.push({ imageUrl: img.trim() })
              } else if (img && typeof img === 'object') {
                const imageUrl = (img.imageUrl || img.image || img.url || '').trim()
                if (imageUrl) {
                  normalizedVariantImages.push({
                    imageUrl,
                    variantId: img.variantId || img.variant_id,
                    attribute: img.attribute,
                    attributes: img.attributes
                  })
                }
              }
            })
            
            // Only update if we have new variant images
            if (normalizedVariantImages.length > 0) {
              setVariantImages(normalizedVariantImages)
            }
          }
        }
      } catch (error) {
        // Silently fail - initial fetch already handled this
      }
    }, 3000) // 3 second delay
    
    return () => clearTimeout(refreshTimer)
  }, [productIdNumber, isValidProductId])

  // Helpers for video rendering
  const isDirectVideoFile = (url?: string | null) => !!url && /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url)
  const isYouTubeUrl = (url?: string | null) => !!url && (url.includes('youtube.com') || url.includes('youtu.be'))
  const convertToEmbedUrl = (url?: string | null): string => {
    if (!url) return ''
    if (url.includes('/embed/')) return url
    if (url.includes('youtube.com/watch')) {
      const videoId = url.split('v=')[1]?.split('&')[0]
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0]
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }
    return url
  }

  // Force TZS currency for product pages per requirement
  useEffect(() => {
    if (currency !== 'TZS') {
      setCurrency('TZS')
    }
  }, [currency, setCurrency])

  // Track product view - use ref to prevent multiple tracking calls
  const viewTrackingRef = useRef<Set<string>>(new Set())
  
  useEffect(() => {
    if (!isValidProductId || !productId) return
    
    // Use ref-based tracking only (more reliable than sessionStorage)
    // Check if we've already tracked this view in this session
    if (viewTrackingRef.current.has(productId)) return
    
    // Mark as tracking immediately to prevent race conditions
    viewTrackingRef.current.add(productId)
    
    // Track view with retry logic
    fetchWithRetry(`/api/products/${productId}/view`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      retries: 2, // Retry twice for view tracking
      retryDelay: 500, // Shorter delay for view tracking
      exponentialBackoff: true
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.views !== undefined) {
          // Update local product views count silently without triggering re-renders
          setProductData((prev: any) => {
            if (prev?.views === data.views) return prev // Prevent unnecessary updates
            return {
              ...prev,
              views: data.views
            }
          })
        }
      })
      .catch(error => {
        // Remove from ref on error so it can retry if needed
        viewTrackingRef.current.delete(productId)
        // Silent fail for view tracking - don't log errors
      })
  }, [productId, isValidProductId]) // Only depend on productId, removed product to prevent re-runs

  // Autoplay controller for video view
  const [shouldAutoplayVideo, setShouldAutoplayVideo] = useState(false)
  
  // Consolidated state - all data loaded in parallel
  const [variantImages, setVariantImages] = useState<Array<{
    variantId?: number
    imageUrl: string
    attribute?: {name: string, value: string}
    attributes?: Array<{name: string, value: string}>
  }>>([])
  
  // State for supplier/company name
  const [supplierCompanyName, setSupplierCompanyName] = useState<string | null>(null)
  
  // State for supplier info
  const [supplierInfo, setSupplierInfo] = useState<{
    companyName: string | null
    companyLogo: string | null
    isVerified: boolean
    detailSentence: string | null
    rating: number | null
    reviewCount: number | null
    supplierId: string | null
    productCount: number | null
    totalViews: number | null
    region: string | null
  } | null>(null)
  
  // State for sold count
  const [soldCount, setSoldCount] = useState<{
    soldCount: number
    buyersCount: number | null
  } | null>(null)
  const [soldCountLoading, setSoldCountLoading] = useState(false)

  // Reviews and sold count are now loaded in parallel with product (see main useEffect above)
  // Removed redundant fetches - all data loads simultaneously

  // Fetch supplier information when product is loaded
  useEffect(() => {
    const fetchSupplierInfo = async () => {
      if (!product?.id) return
      
      try {
        // Use API route with retry logic
        const response = await fetchWithRetry(`/api/products/${product.id}/supplier-info`, {
          retries: 2,
          retryDelay: 1000,
          exponentialBackoff: true
        })
        
        if (!response.ok) {
          return
        }
        
        const data = await response.json()
        
        if (data.error) {
          return
        }
        
        setSupplierInfo({
          companyName: data.companyName || null,
          companyLogo: data.companyLogo || null,
          isVerified: data.isVerified || false,
          detailSentence: data.detailSentence || null,
          rating: data.rating || null,
          reviewCount: data.reviewCount || null,
          supplierId: data.supplierId || null,
          productCount: data.productCount || null,
          totalViews: data.totalViews || null,
          region: data.region || null
        })
        setSupplierCompanyName(data.companyName || null)
      } catch (error) {
        // Error fetching supplier info
      }
    }
    
    fetchSupplierInfo()
  }, [product?.id])
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [searchModalInitialTab, setSearchModalInitialTab] = useState<'text' | 'image'>('text')
  const [imageSearchResults, setImageSearchResults] = useState<any[]>([])
  const [imageSearchKeywords, setImageSearchKeywords] = useState<string[]>([])
  // Debounce timer for clearing search URL
  const clearSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Submit search (redirects to products page with search query)
  // Minimum 3 characters required - same as product list page
  const submitSearch = useCallback(() => {
    const query = (searchTerm || '').trim()
    if (query && query.length >= 3) {
      navigateWithPrefetch(`/products?search=${encodeURIComponent(query)}`, { priority: 'medium', scroll: true })
    }
  }, [searchTerm, navigateWithPrefetch])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setSearchTerm(suggestion)
    setShowSuggestions(false)
    setIsSearchFocused(false)
    if (suggestion.trim().length >= 3) {
      navigateWithPrefetch(`/products?search=${encodeURIComponent(suggestion)}`, { priority: 'medium', scroll: true })
    }
  }, [navigateWithPrefetch])

  // Handle text search from modal
  const handleModalTextSearch = useCallback((query: string) => {
    setSearchTerm(query)
    navigateWithPrefetch(`/products?search=${encodeURIComponent(query)}`, { priority: 'medium', scroll: true })
  }, [router])

  // Handle image search from modal
  const handleImageSearch = useCallback((products: any[], keywords: string[]) => {
    setImageSearchResults(products)
    setImageSearchKeywords(keywords)
    // Redirect to products page with image search results
    const searchParams = new URLSearchParams()
    if (keywords.length > 0) {
      searchParams.set('image_search', keywords.join(' '))
    }
    navigateWithPrefetch(`/products?${searchParams.toString()}`, { priority: 'medium', scroll: true })
  }, [router])
  
  // "You May Also Like" rotation state - changes every 30 seconds
  const [relatedProductsRotation, setRelatedProductsRotation] = useState(0)
   // Responsive product count: 15 on mobile, 32 on desktop
  const [isMobile, setIsMobile] = useState(false)
  const RELATED_PRODUCTS_COUNT_MOBILE = 15
  const RELATED_PRODUCTS_COUNT_DESKTOP = 32
  const ROTATION_INTERVAL = 30000 // 30 seconds
  
  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // Mobile is < 768px (md breakpoint)
    }
    
    // Check on mount
    checkMobile()
    
    // Listen for resize
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Auto-rotate "You May Also Like" products every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRelatedProductsRotation(prev => prev + 1)
    }, ROTATION_INTERVAL)
    
    return () => clearInterval(interval)
  }, [])

  // Prefer server-fetched full details when available
  // Use product data directly (already includes all details from parallel fetch)
  const currentVideo = product?.video
  const currentView360 = product?.view360
  
  // Calculate randomly selected related products (memoized for performance)
  // Uses rotation index as seed for consistent random selection per rotation
  const rotatedRelatedProducts = useMemo(() => {
    // Use different count based on screen size
    const productsToShow = isMobile ? RELATED_PRODUCTS_COUNT_MOBILE : RELATED_PRODUCTS_COUNT_DESKTOP
    
    // Get all available products (excluding current product)
    const allAvailableProducts = products.filter(p => p.id !== product?.id)
    
    if (allAvailableProducts.length === 0) {
      return []
    }
    
    // Shuffle array randomly using Fisher-Yates algorithm with rotation as seed
    // This ensures different random selection on each rotation while maintaining consistency
    const shuffled = [...allAvailableProducts]
    
    // Use rotation index as seed for pseudo-random shuffling
    // This ensures different products are shown on each rotation
    let seed = relatedProductsRotation
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    
    // Fisher-Yates shuffle with seeded random
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    
    // Return first N products after shuffling
    return shuffled.slice(0, Math.min(productsToShow, shuffled.length))
  }, [products, product, relatedProductsRotation, isMobile, RELATED_PRODUCTS_COUNT_MOBILE, RELATED_PRODUCTS_COUNT_DESKTOP])

  // Variant images are now loaded in parallel with product data (see main useEffect above)

  // Variant images are loaded in parallel with product data (see main useEffect above)



  // Use product data - already includes all details from parallel fetch
  const displayProduct = useMemo(() => {
    const base: any = product
    if (!base) return base

    // Parse specifications if it's a JSON string
    let parsedSpecifications = base.specifications || {}
    if (typeof base.specifications === 'string' && base.specifications.trim()) {
      try {
        parsedSpecifications = JSON.parse(base.specifications)
      } catch (e) {
        // If parsing fails, try to use as-is or set to empty object
        parsedSpecifications = {}
      }
    } else if (typeof base.specifications === 'object' && base.specifications !== null) {
      parsedSpecifications = base.specifications
    }

    // Normalize variants from either JSON column or relation
    const normalizedVariants = Array.isArray(base.variants) && base.variants.length > 0
      ? base.variants.map((variant: any) => ({
          ...variant,
          // Ensure variant_name is preserved
          variant_name: variant.variant_name || null,
          stock_quantity: variant.stock_quantity || variant.stockQuantity || 0,
          stockQuantity: variant.stockQuantity || variant.stock_quantity || 0,
          in_stock: variant.in_stock !== undefined ? variant.in_stock : (variant.inStock !== undefined ? variant.inStock : true)
        }))
      : (Array.isArray(base.product_variants)
          ? base.product_variants.map((variant: any) => {
              // Parse primary_values if it's a JSON string
              let primaryValues = variant.primary_values || variant.primaryValues || []
              if (typeof primaryValues === 'string') {
                try {
                  primaryValues = JSON.parse(primaryValues)
                } catch (e) {
                  primaryValues = []
                }
              }
              
              return {
                id: variant.id,
                price: variant.price,
                image: variant.image,
                sku: variant.sku,
                model: variant.model,
                variantType: variant.variant_type,
                attributes: variant.attributes || {},
                primaryAttribute: variant.primary_attribute,
                dependencies: variant.dependencies || {},
                primaryValues: Array.isArray(primaryValues) ? primaryValues : [],
                // Also preserve snake_case for compatibility
                primary_values: Array.isArray(primaryValues) ? primaryValues : [],
                // Include simplified variant fields
                variant_name: variant.variant_name,
                stock_quantity: variant.stock_quantity,
                stockQuantity: variant.stock_quantity,
                in_stock: variant.in_stock,
              }
            })
          : [])

    // Normalize/derive variantConfig
    const rawConfig = base.variantConfig
    let normalizedVariantConfig = rawConfig
    if (!rawConfig) {
      normalizedVariantConfig = normalizedVariants.length > 0 ? { type: 'simple' } : rawConfig
    } else {
      const supportedTypes = new Set(['simple', 'primary-dependent', 'multi-dependent'])
      if (!supportedTypes.has(rawConfig.type)) {
        // Map unknown types (e.g., "variable") to the closest supported logic
        if (Array.isArray(rawConfig.primaryAttributes) && rawConfig.primaryAttributes.length > 0) {
          normalizedVariantConfig = {
            ...rawConfig,
            type: 'multi-dependent',
          }
        } else if (rawConfig.primaryAttribute) {
          normalizedVariantConfig = {
            ...rawConfig,
            type: 'primary-dependent',
          }
        } else {
          normalizedVariantConfig = { type: 'simple' }
        }
      }
      // Ensure attributeOrder exists to guide UI if multiple attributes are present
      if (!normalizedVariantConfig.attributeOrder || normalizedVariantConfig.attributeOrder.length === 0) {
        const discoveredTypes = new Set<string>()
        // Prefer declared primary keys first
        if (normalizedVariantConfig.primaryAttribute) discoveredTypes.add(normalizedVariantConfig.primaryAttribute)
        if (Array.isArray(normalizedVariantConfig.primaryAttributes)) {
          normalizedVariantConfig.primaryAttributes.forEach((t: string) => discoveredTypes.add(t))
        }
        // Also derive from variant attributes present
        normalizedVariants.forEach((v: any) => {
          Object.keys(v.attributes || {}).forEach((k) => discoveredTypes.add(k))
          if (Array.isArray(v.primaryValues)) {
            v.primaryValues.forEach((pv: any) => pv?.attribute && discoveredTypes.add(pv.attribute))
          }
        })
        normalizedVariantConfig = {
          ...normalizedVariantConfig,
          attributeOrder: Array.from(discoveredTypes),
        }
      }
    }

    return {
      ...base,
      description: base.description || '', // Ensure description is always present
      specifications: parsedSpecifications,
      variants: normalizedVariants,
      variantConfig: normalizedVariantConfig,
    }
  }, [product])
  
  // Combined loading state
  const isProductLoading = isLoadingProduct || isLoading

  // Preload products on mount for better performance
  useEffect(() => {
    preloadProducts()
  }, [preloadProducts])

  // Share product data with other pages for faster navigation
  useEffect(() => {
    if (product && product.id) {
      set(`product:${product.id}`, product, 5 * 60 * 1000) // 5 minutes cache
    }
  }, [product, set])

  // Prefetch related products cautiously with abort + single 429 retry
  useEffect(() => {
    if (!product || products.length === 0) return
    const controller = new AbortController()
    const timeouts: ReturnType<typeof setTimeout>[] = []

    const candidates = products
        .filter(p => p.id !== product.id && p.category === product.category)
      .slice(0, 3)

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    const schedulePrefetch = (id: number, delay: number) => {
      const t = setTimeout(async () => {
        try {
          const url = `/api/products/${id}?minimal=false`
          // Use retry logic with exponential backoff for prefetching
          await fetchWithRetry(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            retries: 1, // Only retry once for prefetching
            retryDelay: 500,
            exponentialBackoff: true
          }).catch(() => {}) // Silent fail for prefetching
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            // ignore
          }
        }
      }, delay)
      timeouts.push(t)
    }

    candidates.forEach((p, i) => schedulePrefetch(p.id, 600 * i))

    return () => {
      controller.abort()
      timeouts.forEach(clearTimeout)
    }
  }, [product, products])

  const [quantity, setQuantity] = useState(1)
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState<number | null>(null)
  const [isManualImageSelection, setIsManualImageSelection] = useState(false)
  const [isQuantityLimitModalOpen, setIsQuantityLimitModalOpen] = useState(false)
  
  // Auto-set quantity to 5 for products under 500 TZS
  useEffect(() => {
    if (product && product.price < 500) {
      setQuantity(5)
    }
  }, [product])

  // New states for functionality
  const [isGiftWrapDialogOpen, setIsGiftWrapDialogOpen] = useState(false)
  
  // Wishlist functionality
  const { add: addToWishlist, remove: removeFromWishlist, has: isInWishlist, items: wishlistItems } = useWishlist()
  const isProductInWishlist = isInWishlist(product?.id || 0)
  
  // Save for Later functionality
  const { add: addToSavedLater, remove: removeFromSavedLater, has: isInSavedLater, items: savedLaterItems } = useSavedLater()
  const isProductInSavedLater = isInSavedLater(product?.id || 0)

  // Prefetch related routes for better performance
  useEffect(() => {
    const prefetchRelatedRoutes = () => {
      // Prefetch common navigation routes
      router.prefetch('/products')
      router.prefetch('/cart')
      router.prefetch('/account')
      
      // Prefetch account sub-routes
      router.prefetch('/account/orders')
      router.prefetch('/account/wishlist')
    }

    // Use requestIdleCallback for better performance
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(prefetchRelatedRoutes, { timeout: 1000 })
    } else {
      setTimeout(prefetchRelatedRoutes, 500)
    }
  }, [router])

  // Optimize navigation with useCallback
  const handleBackNavigation = useCallback(() => {
    // Mark that we're returning from product detail
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('navigated_from_product_detail', 'true')
      } catch (e) {
        // Ignore storage errors
      }
    }
    // Prefer returning to preserved URL with search state
    // Use scroll: false to prevent Next.js from scrolling to top
    navigateWithPrefetch(returnTo || '/products', { priority: 'medium', scroll: false })
  }, [navigateWithPrefetch, returnTo])

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)

  // Enhanced variant image matching - use selected variant image if available
  // Also check variantImages array for matching images by ID or attributes
  const findMatchingVariantImage = useCallback(() => {
    if (!selectedVariant) return null
    
    // First check if selected variant has an image
    if (selectedVariant.image && selectedVariant.image.trim() !== '') {
      return selectedVariant.image
    }
    
    if (variantImages.length === 0) return null
    
    // Try to find matching image by variant ID
    if (selectedVariant.id) {
      const matchingById = variantImages.find((img: any) => 
        img.variantId === selectedVariant.id || 
        img.variantId === Number(selectedVariant.id)
      )
      if (matchingById?.imageUrl) {
        return matchingById.imageUrl
      }
    }
    
    // Try to match by attributes if variantId is not available
    if (selectedVariant.attributes && typeof selectedVariant.attributes === 'object') {
      const variantAttributes = selectedVariant.attributes
      
      // Check if any variant image matches the variant's attributes
      const matchingByAttributes = variantImages.find((img: any) => {
        // Check if image has matching attributes
        if (img.attributes && Array.isArray(img.attributes)) {
          return img.attributes.some((attr: any) => {
            const attrName = attr?.name || attr?.attribute
            const attrValue = attr?.value || attr?.value
            return variantAttributes[attrName] === attrValue
          })
        }
        // Check single attribute match
        if (img.attribute && img.attribute.name && img.attribute.value) {
          return variantAttributes[img.attribute.name] === img.attribute.value
        }
        return false
      })
      
      if (matchingByAttributes?.imageUrl) {
        return matchingByAttributes.imageUrl
      }
    }
    
    // If no specific match found but variant images exist, return the first one
    // This ensures variant images are displayed even without explicit matching
    if (variantImages.length > 0 && variantImages[0]?.imageUrl) {
      return variantImages[0].imageUrl
    }
    
    return null
  }, [selectedVariant, variantImages])

  // New states for video and 360° view dialogs
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false)
  const [is360ViewDialogOpen, setIs360ViewDialogOpen] = useState(false)
  
  // New state for main container view mode
  const [mainViewMode, setMainViewMode] = useState<'image' | 'video' | '360'>('image')
  
  
  // Selection preview dialog state
  
  // Calculate total stock from simplified variants
  const calculateTotalStock = useCallback(() => {
    let total = 0
    if (displayProduct?.variants) {
      displayProduct.variants.forEach((variant: any) => {
        const qty = variant.stock_quantity || variant.stockQuantity || 0
        total += typeof qty === 'number' ? qty : parseInt(String(qty)) || 0
      })
    }
    // Fallback to product-level stock if no variant quantities
    if (total === 0 && displayProduct?.stockQuantity) {
      total = displayProduct.stockQuantity
    }
    return total
  }, [displayProduct])

  // Product display state (derived from product data)
  const productDisplayState = useMemo(() => {
    const totalStock = calculateTotalStock()
    return {
      inStock: totalStock > 0,
      stockQuantity: totalStock,
      freeDelivery: (displayProduct as any)?.freeDelivery ?? false,
      sameDayDelivery: (displayProduct as any)?.sameDayDelivery ?? false,
      returnTimeType: (displayProduct as any)?.return_time_type ?? 'days',
      returnTimeValue: (displayProduct as any)?.return_time_value ?? 3,
    }
  }, [displayProduct, calculateTotalStock])
  
  // Missing state variables that were removed during optimization
  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false)
  const [hasGiftWrap, setHasGiftWrap] = useState(false)
  const [customizationText, setCustomizationText] = useState("")
  const [isMainImageFocused, setIsMainImageFocused] = useState(false) // New state for image focus
  const [isBulkOrderDialogOpen, setIsBulkOrderDialogOpen] = useState(false) // New state for bulk order dialog
  const [isPriceAlertDialogOpen, setIsPriceAlertDialogOpen] = useState(false) // New state for price alert dialog
  const [priceAlertTarget, setPriceAlertTarget] = useState<number>(0) // Target price for alert
  const [hasPriceAlert, setHasPriceAlert] = useState(false) // Track if user has set a price alert

  const { toast } = useToast() // Initialize toast
  
  // China import modal state
  const [showChinaImportModal, setShowChinaImportModal] = useState(false)
  const [pendingCartAction, setPendingCartAction] = useState<{
    type: 'add' | 'buy'
    quantity: number
    variantId?: string
    combination?: any
    price: number
  } | null>(null)

  // Handle China import modal
  const handleChinaImportConfirm = () => {
    if (pendingCartAction && displayProduct) {
      if (pendingCartAction.type === 'add') {
        addItem(
          displayProduct.id,
          pendingCartAction.quantity,
          pendingCartAction.variantId,
          pendingCartAction.combination,
          pendingCartAction.price
        )
      } else if (pendingCartAction.type === 'buy') {
        // Handle buy now action - create a separate cart item that won't merge
        const buyNowItem = {
          id: Date.now(), // Use timestamp as unique ID to prevent merging
          productId: displayProduct.id,
          variants: [{
            variantId: pendingCartAction.variantId || 'base',
            attributes: pendingCartAction.combination || {},
            quantity: pendingCartAction.quantity,
            price: pendingCartAction.price,
            sku: displayProduct.sku,
            image: displayProduct.image
          }],
          totalQuantity: pendingCartAction.quantity,
          totalPrice: pendingCartAction.price * pendingCartAction.quantity,
          currency: 'TZS',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          product: {
            id: displayProduct.id,
            name: displayProduct.name,
            image: displayProduct.image,
            price: pendingCartAction.price,
            originalPrice: displayProduct.originalPrice,
            inStock: displayProduct.inStock,
            stockQuantity: displayProduct.stockQuantity,
            sku: displayProduct.sku
          }
        }
        
        // Add this as a separate item to cart
        addItem(
          displayProduct.id,
          pendingCartAction.quantity,
          pendingCartAction.variantId,
          pendingCartAction.combination,
          pendingCartAction.price
        )
        
        // Store the buy now item details for checkout
        try {
          sessionStorage.setItem('buy_now_item_data', JSON.stringify(buyNowItem))
          sessionStorage.setItem('buy_now_mode', 'true')
        } catch (error) {
          // Fallback if sessionStorage fails
        }
        
        router.push('/checkout')
      }
    }
    setShowChinaImportModal(false)
    setPendingCartAction(null)
  }

  const handleChinaImportCancel = () => {
    setShowChinaImportModal(false)
    setPendingCartAction(null)
  }



  // Get all unique values for a specific attribute type
  const getAttributeValues = (type: string): string[] => {
    if (!displayProduct?.variants) return []
    
    const values = new Set<string>()
    
    // Check if this is a primary attribute with multiple values
    const primaryAttribute = displayProduct.variantConfig?.primaryAttribute
    const primaryAttributes = displayProduct.variantConfig?.primaryAttributes || []
    const isPrimary = type === primaryAttribute || primaryAttributes.includes(type)
    const isPrimaryDependent = displayProduct.variantConfig?.type === 'primary-dependent'
    const isMultiDependent = displayProduct.variantConfig?.type === 'multi-dependent'
    const isSimple = displayProduct.variantConfig?.type === 'simple'
    
    if (isPrimary && (isPrimaryDependent || isMultiDependent || isSimple)) {
      displayProduct.variants.forEach((variant: any) => {
        // Check primaryValues (camelCase)
        if (variant.primaryValues && Array.isArray(variant.primaryValues)) {
          variant.primaryValues.forEach((primaryValue: any) => {
            // IMPORTANT: Filter by attribute type to avoid mixing values from different attributes
            const valAttribute = primaryValue.attribute || primaryValue.attributeName
            if (primaryValue.value && valAttribute === type) {
              values.add(primaryValue.value)
            }
          })
        }
        // Also check primary_values (snake_case)
        if (variant.primary_values && Array.isArray(variant.primary_values)) {
          variant.primary_values.forEach((primaryValue: any) => {
            if (typeof primaryValue === 'string') {
              // For string values, we can't determine attribute, so skip or handle differently
              // But since we're filtering by type, we should only add if we can verify the attribute
            } else if (primaryValue && primaryValue.value) {
              const valAttribute = primaryValue.attribute || primaryValue.attributeName
              if (valAttribute === type) {
                values.add(primaryValue.value)
              }
            }
          })
        }
      })
      // Fallback when primaryValues are absent: derive values from variant.attributes
      if (values.size === 0) {
        displayProduct.variants.forEach((variant: any) => {
          const attrVal = variant?.attributes?.[type]
          if (typeof attrVal === 'string' && attrVal.trim()) {
            values.add(attrVal)
          } else if (Array.isArray(attrVal)) {
            attrVal.filter(Boolean).forEach((v: string) => values.add(v))
          }
        })
      }
    } else {
      // Check if this attribute has array values
      const hasArrayValues = displayProduct.variants.some((variant: any) => 
        variant.attributes?.[type] && Array.isArray(variant.attributes[type])
      )
      if (hasArrayValues) {
        displayProduct.variants.forEach((variant: any) => {
          if (variant.attributes?.[type] && Array.isArray(variant.attributes[type])) {
            variant.attributes[type].forEach((item: any) => {
              if (item) {
                // Handle both object format {value: "white"} and string format "white"
                const value = typeof item === 'object' && item.value ? item.value : item
                if (value) {
                  // Clean up the value by removing extra quotes and trimming spaces
                  const cleanedValue = value.replace(/^["']|["']$/g, '').trim()
                  if (cleanedValue) {
                    values.add(cleanedValue)
                  }
                }
              }
            })
          }
        })
      } else {
        // For regular attributes, use the old method
        displayProduct.variants.forEach((variant: any) => {
          if (variant.attributes && variant.attributes[type]) {
            values.add(variant.attributes[type])
          }
        })
      }
    }
    
        const result = Array.from(values)
        return result
  }

  // Check if a specific attribute value is available given current selections
  const isAttributeValueAvailable = (attributeType: string, value: string): boolean => {
    if (!displayProduct?.variants) {
      return false
    }
    
    // For simple logic, check quantity if available
    if (displayProduct.variantConfig?.type === 'simple' && !displayProduct.variantConfig.primaryAttribute) {
      // Simple without primary attribute - check variant stock
      return displayProduct.variants.some((variant: any) => {
        if (typeof variant.stockQuantity === 'number') return variant.stockQuantity > 0
        return true
      })
    }
    
    // For primary-dependent logic
    if (displayProduct.variantConfig?.type === 'primary-dependent') {
      const primaryAttribute = displayProduct.variantConfig.primaryAttribute
      const primaryAttributes = displayProduct.variantConfig.primaryAttributes || []
      // Check if this is a primary attribute (either single primaryAttribute or in primaryAttributes array)
      const isPrimary = attributeType === primaryAttribute || primaryAttributes.includes(attributeType)
      
      if (isPrimary) {
        // For primary attributes, check if the value exists in any variant's primaryValues
        // IMPORTANT: Filter by attribute type to avoid matching values from other attributes
        return displayProduct.variants.some((variant: any) => {
          // Check primaryValues (camelCase)
          let hasVal = false
          let pv: any = null
          
          if (variant.primaryValues && Array.isArray(variant.primaryValues)) {
            pv = variant.primaryValues.find((pv: any) => 
              pv.value === value && (pv.attribute === attributeType || pv.attributeName === attributeType)
            )
            hasVal = !!pv
          }
          
          // Also check primary_values (snake_case)
          if (!hasVal && variant.primary_values && Array.isArray(variant.primary_values)) {
            pv = variant.primary_values.find((pv: any) => {
              if (typeof pv === 'string') return pv === value
              return pv.value === value && (pv.attribute === attributeType || pv.attributeName === attributeType)
            })
            hasVal = !!pv
          }
          
          if (!hasVal) return false
          
          // If this value has quantity on primaryValues, respect it
          // If quantity is missing, null, undefined, or 0, the value is unavailable
          if (pv) {
            if (typeof pv.quantity === 'number') {
              return pv.quantity > 0
            }
            if (typeof pv.quantity === 'string') {
              const qty = parseInt(pv.quantity)
              return !isNaN(qty) && qty > 0
            }
            // If quantity field exists but is null/undefined, check if it's explicitly set
            // If quantity is missing entirely, check variant stock as fallback
            if (pv.hasOwnProperty('quantity') && (pv.quantity === null || pv.quantity === undefined || pv.quantity === '')) {
              return false // Explicitly no quantity = unavailable
            }
          }
          // If no quantity field at all, check variant stock as fallback
          if (typeof variant.stockQuantity === 'number') {
            return variant.stockQuantity > 0
          }
          // If no quantity info at all, consider it unavailable
          return false
        })
      }
      
      // Check if this attribute has array values
      const hasArrayValues = displayProduct.variants.some((variant: any) => 
        variant.attributes?.[attributeType] && Array.isArray(variant.attributes[attributeType])
      )
      if (hasArrayValues) {
        return displayProduct.variants.some((variant: any) => 
          variant.attributes?.[attributeType] && Array.isArray(variant.attributes[attributeType]) && 
          variant.attributes[attributeType].some((item: any) => {
            const v = typeof item === 'object' && item.value ? item.value : item
            const cleanedValue = v.replace(/^["']|["']$/g, '').trim()
            return cleanedValue === value
          })
        )
      }
      
      // For regular secondary attributes, check if they exist with any primary value
      return displayProduct.variants.some((variant: any) => 
        variant.attributes && variant.attributes[attributeType] === value
      )
    }
    
    // For simple logic with primaryValues
    if (displayProduct.variantConfig?.type === 'simple' && displayProduct.variantConfig.primaryAttribute) {
      const primaryAttribute = displayProduct.variantConfig.primaryAttribute
      if (attributeType === primaryAttribute) {
        // For primary attributes, check if the value exists in any variant's primaryValues
        return displayProduct.variants.some((variant: any) => {
          const hasVal = variant.primaryValues?.some((primaryValue: any) => 
            primaryValue.value === value && (primaryValue.attribute === attributeType || primaryValue.attributeName === attributeType)
          )
          if (!hasVal) return false
          const pv = variant.primaryValues?.find((primaryValue: any) => 
            primaryValue.value === value && (primaryValue.attribute === attributeType || primaryValue.attributeName === attributeType)
          )
          if (pv) {
            if (typeof pv.quantity === 'number') {
              return pv.quantity > 0
            }
            if (typeof pv.quantity === 'string') {
              const qty = parseInt(pv.quantity)
              return !isNaN(qty) && qty > 0
            }
            // If quantity field exists but is null/undefined, it's unavailable
            if (pv.hasOwnProperty('quantity') && (pv.quantity === null || pv.quantity === undefined || pv.quantity === '')) {
              return false
            }
          }
          // If no quantity field at all, check variant stock as fallback
          if (typeof variant.stockQuantity === 'number') {
            return variant.stockQuantity > 0
          }
          // If no quantity info at all, consider it unavailable
          return false
        })
      }
      
      // For regular secondary attributes, check if they exist
      return displayProduct.variants.some((variant: any) => 
        variant.attributes && variant.attributes[attributeType] === value
      )
    }
    
    // For multi-dependent logic
    if (displayProduct.variantConfig?.type === 'multi-dependent') {
      const attributeOrder = displayProduct.variantConfig.attributeOrder || []
      const currentStep = attributeOrder.indexOf(attributeType)
      const primaryAttributes = displayProduct.variantConfig.primaryAttributes || []
      
      // Check if this is a primary attribute
      if (primaryAttributes.includes(attributeType)) {
        // Check quantity for primary attributes
        return displayProduct.variants.some((variant: any) => {
          // Check primaryValues (camelCase)
          let hasVal = false
          let pv: any = null
          
          if (variant.primaryValues && Array.isArray(variant.primaryValues)) {
            pv = variant.primaryValues.find((pv: any) => 
              pv.attribute === attributeType && pv.value === value
            )
            hasVal = !!pv
          }
          
          // Also check primary_values (snake_case)
          if (!hasVal && variant.primary_values && Array.isArray(variant.primary_values)) {
            pv = variant.primary_values.find((pv: any) => {
              if (typeof pv === 'string') return false
              return pv.attribute === attributeType && pv.value === value
            })
            hasVal = !!pv
          }
          
          if (!hasVal) return false
          
          if (pv) {
            if (typeof pv.quantity === 'number') {
              return pv.quantity > 0
            }
            if (typeof pv.quantity === 'string') {
              const qty = parseInt(pv.quantity)
              return !isNaN(qty) && qty > 0
            }
            // If quantity field exists but is null/undefined, it's unavailable
            if (pv.hasOwnProperty('quantity') && (pv.quantity === null || pv.quantity === undefined || pv.quantity === '')) {
              return false
            }
          }
          // If no quantity field at all, check variant stock as fallback
          if (typeof variant.stockQuantity === 'number') {
            return variant.stockQuantity > 0
          }
          // If no quantity info at all, consider it unavailable
          return false
        })
      }
      
      // For non-primary attributes in multi-dependent, show all values for the current step
      // Note: variantSelectionStep logic removed - all values are shown for multi-dependent variants
      return true
    }
    
    return true
  }

  // Get available variants - simplified (no filtering needed)
  const getAvailableVariants = (): ProductVariant[] => {
    if (!displayProduct?.variants) return []
    return displayProduct.variants
  }

  // Calculate quantity based on selected attributes
  // Calculate total price for current selection - simplified
  const calculateTotalPrice = useMemo((): number => {
    if (selectedVariant) {
      return (selectedVariant.price || product?.price || 0) * quantity
    }
    return (product?.price || 0) * quantity
  }, [selectedVariant, quantity, product?.price])

  // Initialize variant selection - simple system
  useEffect(() => {
    if (displayProduct?.variants && displayProduct.variants.length > 0) {
      // Select the first variant by default
        setSelectedVariant(displayProduct.variants[0])
    }
  }, [displayProduct?.variants])


  // Simple variant selection handler
  const handleVariantSelect = (variantId: string) => {
    const variant = displayProduct?.variants?.find((v: any) => v.id?.toString() === variantId)
    if (variant) {
      setSelectedVariant(variant)
    }
  }

  // Get current price based on selected variant
  const getCurrentPrice = (): number => {
    if (selectedVariant) {
      return selectedVariant.price || product?.price || 0
    }
    return product?.price || 0
  }

  const currentPrice = getCurrentPrice() || 0
  const currentOriginalPrice = selectedVariant?.originalPrice || product?.originalPrice || 0
  
  // No variant image matching needed - using simple variant system
  // Find matching variant image for the selected variant
  const matchingVariantImage = findMatchingVariantImage()
  
  // Get thumbnail images: use variant images if available, fill remaining with main product image
  const getAllThumbnailImages = useCallback(() => {
    const images: string[] = []
    const mainProductImage = product?.image?.trim() || ''
    
    // Collect variant images - handle different formats
    variantImages.forEach((variantImg: any) => {
      let imageUrl = ''
      if (typeof variantImg === 'string') {
        imageUrl = variantImg.trim()
      } else if (variantImg && typeof variantImg === 'object') {
        imageUrl = (variantImg.imageUrl || variantImg.image || variantImg.url || '').trim()
      }
      
      if (imageUrl && imageUrl !== '') {
        images.push(imageUrl)
      }
    })
    
    // Also check if variants have images
    if (displayProduct?.variants && Array.isArray(displayProduct.variants)) {
      displayProduct.variants.forEach((variant: any) => {
        if (variant.image && typeof variant.image === 'string' && variant.image.trim() !== '') {
          images.push(variant.image.trim())
        }
      })
    }
    
    // Remove duplicates
    const uniqueVariantImages = [...new Set(images)]
    
    // If no variant images exist, use main product image for all thumbnails (create 8 thumbnails)
    if (uniqueVariantImages.length === 0 && mainProductImage) {
      return Array(8).fill(mainProductImage)
    }
    
    // If some variant images exist, fill remaining slots with main product image (up to 8 total)
    const targetThumbnailCount = 8
    const remainingSlots = Math.max(0, targetThumbnailCount - uniqueVariantImages.length)
    
    if (remainingSlots > 0 && mainProductImage) {
      // Add main product image to fill remaining slots
      const filledImages = [...uniqueVariantImages, ...Array(remainingSlots).fill(mainProductImage)]
      return filledImages
    }
    
    // If we have more than 8 variant images, limit to 8
    return uniqueVariantImages.slice(0, targetThumbnailCount)
  }, [variantImages, product?.image, displayProduct?.variants])

  const thumbnailImages = useMemo(() => getAllThumbnailImages(), [getAllThumbnailImages])
  
  // Compute thumbnails before deriving currentImage (declare helper first)

  // Main image shows clicked thumbnail, or first thumbnail when available, or matching variant image when variant is selected; falls back to main product image
  // Memoized to prevent unnecessary recalculations and image flickering
  const currentImage = useMemo(() => {
    // If user clicked a thumbnail, show that image
    if (mainImage) {
      return mainImage
    }
    
    // If variant is selected, use its matching image
    if (matchingVariantImage) {
      return matchingVariantImage
    }
    
    // If variant images exist, prioritize showing them (even if no variant is selected)
    // This ensures variant images are displayed when available
    if (variantImages.length > 0 && variantImages[0]?.imageUrl) {
      return variantImages[0].imageUrl
    }
    
    // Prefer the first thumbnail if available (prioritize variant images over main image)
    // This prevents showing main image first, then switching to thumbnail
    if (thumbnailImages.length > 0) {
      // Check if first thumbnail is different from main product image
      const firstThumbnail = thumbnailImages[0]
      if (firstThumbnail && firstThumbnail !== product?.image) {
        return firstThumbnail
      }
      // If thumbnails exist but first one is main image, still use it
      if (firstThumbnail) {
        return firstThumbnail
      }
    }
    
    // When no thumbnails exist, show main product image
    if (product?.image && product.image.trim() !== '') {
      return product.image
    }
    
    return null
  }, [mainImage, matchingVariantImage, thumbnailImages, variantImages, product?.image])
  
  // (helper declared once above)
  
  // Reset manual selection when variant changes (allow auto-update again)
  useEffect(() => {
    setIsManualImageSelection(false)
    setSelectedThumbnailIndex(null)
  }, [selectedVariant])

  // Initialize mainImage on first load - prevents showing main image then switching to thumbnail
  // Also retry after 3 seconds if variant images aren't loaded yet
  useEffect(() => {
    // Only initialize once when product loads
    if (!product?.image || mainImage) return
    
    let retryTimer: NodeJS.Timeout | null = null
    
    const checkAndSetImage = (): boolean => {
      // ALWAYS check thumbnail images FIRST before using product main image
      // Thumbnails include variant images, so they should be prioritized
      if (thumbnailImages.length > 0) {
        // Prioritize variant images if available
        if (variantImages.length > 0 && variantImages[0]?.imageUrl) {
          // Use first variant image
          setMainImage(variantImages[0].imageUrl)
          const matchingIndex = thumbnailImages.findIndex(img => img === variantImages[0].imageUrl)
          setSelectedThumbnailIndex(matchingIndex >= 0 ? matchingIndex : 0)
          return true // Successfully set image
        } else if (thumbnailImages[0] !== product.image) {
          // If variant images array is empty but thumbnails exist, use first thumbnail
          setMainImage(thumbnailImages[0])
          setSelectedThumbnailIndex(0)
          return true // Successfully set image
        } else if (thumbnailImages.length > 0) {
          // Even if thumbnail is same as main image, use it for consistency
          setMainImage(thumbnailImages[0])
          setSelectedThumbnailIndex(0)
          return true // Successfully set image
        }
      }
      
      // If thumbnails not available yet, return false to retry
      return false
    }
    
    // Initial check after 100ms
    const initTimer = setTimeout(() => {
      if (!checkAndSetImage()) {
        // If thumbnails not loaded, retry after 3 seconds
        retryTimer = setTimeout(() => {
          if (!checkAndSetImage()) {
            // Still no thumbnails after retry, use main product image as fallback
            // This ensures we always show something, even if variant images fail to load
            setMainImage(product.image)
            setSelectedThumbnailIndex(null)
          }
        }, 3000) // 3 second retry
      }
    }, 100) // Small delay to allow variant images to load
    
    return () => {
      clearTimeout(initTimer)
      if (retryTimer) {
        clearTimeout(retryTimer)
      }
    }
  }, [product?.image, thumbnailImages, variantImages, mainImage]) // Include variantImages to react when they load

  // Auto-update main image when variant changes (but not when user manually selects a thumbnail)
  useEffect(() => {
    // Don't auto-update if user has manually selected an image
    if (isManualImageSelection) {
      return
    }

    // If variant is selected, use its matching image
    if (matchingVariantImage) {
      setMainImage(matchingVariantImage)
      const matchingIndex = thumbnailImages.findIndex(img => img === matchingVariantImage)
      setSelectedThumbnailIndex(matchingIndex >= 0 ? matchingIndex : null)
    } else if (variantImages.length > 0 && variantImages[0]?.imageUrl) {
      // If no variant selected but variant images exist, show first variant image
      if (mainImage !== variantImages[0].imageUrl) {
        setMainImage(variantImages[0].imageUrl)
        const matchingIndex = thumbnailImages.findIndex(img => img === variantImages[0].imageUrl)
        setSelectedThumbnailIndex(matchingIndex >= 0 ? matchingIndex : 0)
      }
    } else if (thumbnailImages.length > 0 && !matchingVariantImage) {
      // Only update if thumbnails are available and no variant is selected
      // Check if current mainImage is the main product image (to avoid unnecessary updates)
      if (mainImage === product?.image && thumbnailImages[0] !== product?.image) {
        setMainImage(thumbnailImages[0])
        setSelectedThumbnailIndex(0)
      }
    }
  }, [matchingVariantImage, thumbnailImages, isManualImageSelection, selectedVariant, mainImage, product?.image, variantImages])
  
  const currentSKU = selectedVariant?.sku || product?.sku || ""
  const currentModel = selectedVariant?.model || product?.model || ""


  // Check if the currently selected product/variant is in the cart
  const productInCart = useMemo(() => {
    return product ? isInCart(product.id, selectedVariant?.id) : false
  }, [isInCart, product?.id, selectedVariant?.id])

  const [activeTab, setActiveTab] = useState<"specifications" | "reviews" | "qna" | "shipping" | "warranty">(
    "specifications",
  )
  
  const [expandedSpecs, setExpandedSpecs] = useState(false)

  // REMOVED EARLY RETURNS - they violate Rules of Hooks
  // Loading and not-found states are now handled at the end, after all hooks

  const discountPercentage = currentOriginalPrice && currentPrice && currentOriginalPrice > currentPrice 
    ? ((currentOriginalPrice - currentPrice) / currentOriginalPrice) * 100 
    : 0


  // Get current available stock (memoized for performance)
  const currentAvailableStock = useMemo((): number => {
    // If variant is selected, use variant stock
    if (selectedVariant) {
      const variantAny = selectedVariant as any
      const variantStock = variantAny.stock_quantity || variantAny.stockQuantity || 0
      return typeof variantStock === 'number' ? variantStock : parseInt(String(variantStock)) || 0
    }
    
    // If product has variants, calculate total stock
    if (displayProduct?.variants && displayProduct.variants.length > 0) {
      let total = 0
      displayProduct.variants.forEach((variant: any) => {
        const qty = variant.stock_quantity || variant.stockQuantity || 0
        total += typeof qty === 'number' ? qty : parseInt(String(qty)) || 0
      })
      return total
    }
    
    // Fallback to product-level stock
    if (displayProduct?.stockQuantity) {
      return typeof displayProduct.stockQuantity === 'number' 
        ? displayProduct.stockQuantity 
        : parseInt(String(displayProduct.stockQuantity)) || 0
    }
    
    return 0
  }, [selectedVariant, displayProduct])

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const newQuantity = prev + delta
      // For products under 500 TZS, minimum quantity is 5
      const minQuantity = product && product.price < 500 ? 5 : 1
      
      // If trying to go below minimum for low-price products, show modal
      if (product && product.price < 500 && newQuantity < 5 && delta < 0) {
        setIsQuantityLimitModalOpen(true)
        return prev // Don't change quantity
      }
      
      // Check stock before incrementing
      if (delta > 0) {
        if (newQuantity > currentAvailableStock) {
          toast({
            title: "Insufficient Stock",
            description: `Only ${currentAvailableStock} ${currentAvailableStock === 1 ? 'unit' : 'units'} available${selectedVariant ? ` for this variant` : ''}.`,
            variant: "destructive",
          })
          return prev // Don't change quantity
        }
      }
      
      return Math.max(minQuantity, newQuantity)
    })
  }


  // Simplified unit price - use selected variant price
  const getCurrentUnitPrice = useMemo((): number => {
    return getCurrentPrice()
  }, [selectedVariant, product?.price])

  const handleAddToCart = (): boolean | undefined => {
    // Check basic product stock first
    if (displayProduct) {
      const stockCheck = checkProductStock(displayProduct)
      
      if (!stockCheck.isAvailable) {
        toast({
          title: "Out of Stock",
          description: stockCheck.message || "This product is currently unavailable.",
          variant: "destructive",
        })
        return false
      }
    }
    
    // Check if this is a China import item first (skip modal if from China page)
    if (!fromChina && displayProduct && (displayProduct.importChina || displayProduct.import_china)) {
      const currentPrice = getCurrentPrice()
      setPendingCartAction({
        type: 'add',
        quantity,
        variantId: selectedVariant?.id?.toString(),
        price: currentPrice
      })
      setShowChinaImportModal(true)
      return false
    }
    
    // Check if variant is selected and has stock
    if (displayProduct?.variants && displayProduct.variants.length > 0) {
      if (!selectedVariant) {
            toast({
          title: "Please Select a Variant",
          description: "Please select a variant before adding to cart.",
              variant: "destructive",
            })
            return false
      }
      
      const variantAny = selectedVariant as any
      const stockQty = variantAny.stock_quantity || variantAny.stockQuantity || 0
      if (stockQty < quantity) {
      toast({
          title: "Insufficient Stock",
          description: `Only ${stockQty} units available for this variant.`,
        variant: "destructive",
      })
      return false
    }
    }
    
    // Add to cart - simplified variant system
    // Pass pre-loaded product data to avoid redundant API fetch (performance optimization)
    // Security: Price is NOT sent to API - server fetches authoritative price from database
    const currentPrice = getCurrentPrice()
    const variantId = selectedVariant?.id?.toString()
    
        addItem(
          product.id, 
          quantity, 
          variantId,
      {}, // No complex attributes
          currentPrice, // Used for optimistic UI update only - server validates actual price
          selectedVariant?.sku,
          selectedVariant?.image,
          product // Pass pre-loaded product data to avoid API fetch
        )
    
    return true
  }

  const handleAddToWishlist = async () => {
    if (!product?.id) return
    
    if (isProductInWishlist) {
      await removeFromWishlist(product.id)
      toast({
        title: "Removed from Wishlist",
        description: `${product.name} removed from your wishlist.`,
      })
    } else {
      await addToWishlist(product.id)
    toast({
      title: "Added to Wishlist!",
        description: `${product.name} added to your wishlist.`,
      })
    }
  }

  const handleSaveForLater = async () => {
    if (!product?.id) return
    
    if (isProductInSavedLater) {
      await removeFromSavedLater(product.id)
      toast({
        title: "Removed from Saved for Later",
        description: `${product.name} removed from your saved items.`,
      })
    } else {
      await addToSavedLater(product.id)
      toast({
        title: "Saved for Later!",
        description: `${product.name} saved for later.`,
      })
    }
  }

  const handleApplyGiftWrap = () => {
    setIsGiftWrapDialogOpen(false)
    toast({
      title: "Gift Wrap Applied!",
      description: `Gift wrapping ${hasGiftWrap ? "enabled" : "disabled"}.`,
    })
  }

  const handleApplyCustomization = () => {
    setIsCustomizeDialogOpen(false)
    toast({
      title: "Customization Applied!",
      description: `Product customized with: "${customizationText}"`,
    })
  }

  const handleBulkOrderClick = () => {
    const availableStock = currentAvailableStock
    const BULK_ORDER_MINIMUM = 100
    
    // Check if stock can support bulk order
    if (availableStock < BULK_ORDER_MINIMUM) {
      toast({
        title: "Insufficient Stock for Bulk Order",
        description: `Bulk orders require minimum 100 items, but only ${availableStock} ${availableStock === 1 ? 'unit' : 'units'} available${selectedVariant ? ` for this variant` : ''}.`,
        variant: "destructive",
      })
      return // Don't proceed with bulk order
    }
    
    // Set quantity to 100 and open dialog
    setQuantity(BULK_ORDER_MINIMUM)
    setIsBulkOrderDialogOpen(true)
  }

  // Calculate dynamic width for quantity input based on number length
  const getQuantityInputWidth = (qty: number) => {
    const numDigits = qty.toString().length
    const baseWidth = 2.5 // Base width in rem
    const digitWidth = 0.8 // Width per digit in rem
    const maxWidth = 6 // Maximum width in rem
    
    const calculatedWidth = baseWidth + (numDigits - 1) * digitWidth
    return Math.min(calculatedWidth, maxWidth)
  }

  const handlePriceAlertClick = () => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to set price alerts.",
      })
      return
    }
    
    // Set initial target price to current price
    const targetPrice = currentPrice || product?.price || 0
    setPriceAlertTarget(targetPrice)
    setIsPriceAlertDialogOpen(true)
  }

  const handleSetPriceAlert = async () => {
    if (priceAlertTarget <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid target price.",
      })
      return
    }

    if (!product?.id) {
      toast({
        title: "Error",
        description: "Product information is missing.",
        variant: "destructive"
      })
      return
    }

    try {
      const response = await fetch('/api/user/price-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          targetPrice: priceAlertTarget
        })
      })

      const data = await response.json()

      if (response.ok) {
        setHasPriceAlert(true)
        setIsPriceAlertDialogOpen(false)
        toast({
          title: "Price Alert Set!",
          description: `You'll be notified when ${product?.name} drops to ${formatPrice(priceAlertTarget)}`,
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to set price alert",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set price alert. Please try again.",
        variant: "destructive"
      })
    }
  }

  // Handle invalid product ID (after all hooks - respects Rules of Hooks)
  if (!isValidProductId) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Product ID</h1>
        <p className="text-gray-600">The product ID must be a valid positive number.</p>
      </div>
    )
  }
  
  // Show loading skeleton ONLY when product data is completely unavailable (false/null)
  // Product details show FIRST as soon as product data exists - priority over everything
  if (!product) {
    return (
      <div className={cn("flex flex-col min-h-screen", themeClasses.mainBg, themeClasses.mainText)}>
        {/* Full Header - No skeleton needed as it's hardcoded */}
        <header
          className={cn(
            "sticky top-0 z-40 w-full border-b",
            darkHeaderFooterClasses.headerBg,
            darkHeaderFooterClasses.headerBorder,
          )}
        >
          <div className="flex items-center h-16 px-4 sm:px-6 lg:px-8 w-full">
            {/* Back Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackNavigation}
              className={cn(
                "flex items-center gap-1 sm:gap-2 text-sm sm:text-base lg:text-lg font-semibold flex-shrink-0 min-w-0",
                darkHeaderFooterClasses.textNeutralPrimary,
              )}
            >
              <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Back to Products</span>
              <span className="sm:hidden">Back</span>
            </Button>

            {/* Logo */}
            <OptimizedLink
              href="/home"
              prefetch="hover"
              priority="low"
              className={cn(
                "hidden sm:flex items-center gap-1 sm:gap-2 text-sm sm:text-base lg:text-lg font-semibold flex-shrink-0 min-w-0 ml-1 sm:ml-2 lg:ml-4 xl:ml-6",
                darkHeaderFooterClasses.textNeutralPrimary,
              )}
            >
              <Image
                src={displayLogo}
                alt={`${companyName} Logo`}
                width={48}
                height={48}
                className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-md"
              />
              <div className="hidden sm:flex flex-col">
                <span 
                  className="lg:text-lg xl:text-xl 2xl:text-2xl truncate font-bold" 
                  style={{ color: companyColor }}
                >
                  {companyName}
                </span>
              </div>
            </OptimizedLink>

            {/* Search Bar */}
            <div className="flex-1 max-w-2xl mx-2 sm:mx-4 lg:mx-6 xl:mx-8 flex items-center relative">
              <div className="relative flex-1 flex items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 z-10 text-gray-400" />
                  <div className="w-full h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Cart Button */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full pb-4 sm:pb-6 lg:pb-8 px-2 sm:px-4 lg:px-6 xl:px-8 pt-4 sm:pt-8 lg:pt-12">
          {/* Skeleton Loading State */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 xl:gap-12">
            {/* Product Image Gallery Skeleton */}
            <ProductImageSkeleton />
            
            {/* Product Info Skeleton */}
            <div className="space-y-6">
              <ProductInfoSkeleton />
              <VariantSelectionSkeleton />
              <div className="flex gap-3">
                <ButtonSkeleton className="h-12 w-32" />
                <ButtonSkeleton className="h-12 w-24" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Show not found (after all hooks - respects Rules of Hooks)
  if (!product) {
    return (
      <div className={cn("flex flex-col min-h-screen", themeClasses.mainBg, themeClasses.mainText)}>
        <header
          className={cn(
            "sticky top-0 z-40 w-full border-b",
            darkHeaderFooterClasses.headerBg,
            darkHeaderFooterClasses.headerBorder,
          )}
        >
          <div className="flex items-center h-16 px-4 sm:px-6 lg:px-8 w-full">
            <OptimizedLink
              href={returnTo}
              scroll={false}
              prefetch="hover"
              priority="medium"
              className={cn(
                "flex items-center gap-2 text-lg font-semibold md:text-base",
                darkHeaderFooterClasses.textNeutralPrimary,
              )}
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back to Products</span>
            </OptimizedLink>
          </div>
        </header>
        <main className="flex-1 container py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h1 className={cn("text-2xl font-bold mb-2", themeClasses.mainText)}>Product Not Found</h1>
            <p className={cn("text-gray-600 mb-6", themeClasses.textNeutralSecondary)}>
              The product you're looking for doesn't exist or has been removed.
            </p>
            <OptimizedLink
              href={returnTo}
              scroll={false}
              prefetch="hover"
              priority="high"
              className="inline-flex items-center px-6 py-3 bg-yellow-500 text-neutral-950 rounded-md hover:bg-yellow-600 transition-colors"
            >
              Browse Products
            </OptimizedLink>
          </div>
        </main>
        <Footer />
      </div>
    )
  }
  
  return (
    <div className={cn("flex flex-col min-h-screen w-full", themeClasses.mainBg, themeClasses.mainText)}>
      {/* Preload main product image and gallery for better performance */}
      <ImagePreloader 
        images={[
          product?.image,
          ...(Array.isArray(product?.gallery) ? product.gallery : [])
        ].filter(Boolean)} 
        priority={true} 
      />
      {/* Welcome Message Bar - Mobile Only */}
      <div className="fixed top-0 z-50 w-full bg-stone-100/90 dark:bg-gray-900/95 backdrop-blur-sm border-b border-stone-200 dark:border-gray-700 sm:hidden">
        <div className="flex items-center justify-center h-6 px-4">
          {user ? (
            <div className="text-xs text-green-600 dark:text-green-400 font-medium">
              Hi! {(user as any).user_metadata?.full_name || user.email?.split('@')[0] || 'User'} - Welcome again <span className="text-blue-600 dark:text-blue-400">{companyName || 'Honic Co.'}</span>
            </div>
          ) : (
            <button 
              onClick={() => openAuthModal('login')}
              className="text-xs text-gray-700 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors font-medium"
            >
              Welcome to {companyName || 'Honic Co.'} <span className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">login here</span> for better search
            </button>
          )}
        </div>
      </div>

      <header
        className={cn(
          "fixed top-6 z-40 w-full border-b sm:top-0",
          darkHeaderFooterClasses.headerBg,
          darkHeaderFooterClasses.headerBorder,
        )}
      >
        <div className="flex items-center h-10 sm:h-16 px-2 sm:px-4 lg:px-6 xl:px-8 w-full">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={handleBackNavigation}
            className={cn(
              "flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium flex-shrink-0 transition-opacity",
              isProductLoading 
                ? "opacity-60 hover:opacity-80" 
                : "opacity-80 hover:opacity-100",
              darkHeaderFooterClasses.textNeutralPrimary,
            )}
          >
            <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Back to Products</span>
            <span className="sm:hidden">Back</span>
          </Button>

          {/* Logo - Hidden on mobile */}
          <OptimizedLink
            href="/home"
            prefetch="hover"
            priority="low"
            className={cn(
              "hidden sm:flex items-center gap-1 sm:gap-2 text-sm sm:text-base lg:text-lg font-semibold flex-shrink-0 min-w-0 ml-1 sm:ml-2 lg:ml-4 xl:ml-6",
              darkHeaderFooterClasses.textNeutralPrimary,
            )}
          >
            <Image
              src={displayLogo}
              alt={`${companyName} Logo`}
              width={48}
              height={48}
              className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-md"
            />
            <div className="hidden sm:flex flex-col">
              <span 
                className="lg:text-lg xl:text-xl 2xl:text-2xl truncate font-bold" 
                style={{ color: companyColor }}
              >
                {companyName}
              </span>
            </div>
          </OptimizedLink>


          {/* Search Bar Container - Same as product list page */}
          <div className="flex-1 min-w-0 mx-2 sm:mx-3 md:mx-4 lg:mx-6 xl:mx-8 2xl:mx-10 flex items-center relative overflow-hidden" suppressHydrationWarning>
            <form 
              className="relative flex-1 flex items-center min-w-0" 
              onSubmit={(e: React.FormEvent) => {
                e.preventDefault()
                if (searchTerm.trim() && searchTerm.trim().length >= 3) {
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
                  
                  // If input is cleared (empty), cancel any pending clear timeout
                  if (!newValue.trim()) {
                    // Clear any existing timeout
                    if (clearSearchTimeoutRef.current) {
                      clearTimeout(clearSearchTimeoutRef.current)
                      clearSearchTimeoutRef.current = null
                    }
                  } else {
                    // If user is typing (not clearing), cancel any pending clear
                    if (clearSearchTimeoutRef.current) {
                      clearTimeout(clearSearchTimeoutRef.current)
                      clearSearchTimeoutRef.current = null
                    }
                    // Show suggestions if length >= 2
                    if (newValue.length >= 2) {
                      setShowSuggestions(true)
                      setIsSearchFocused(true)
                    }
                  }
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
              
              {/* Search Suggestions */}
              {showSuggestions && isSearchFocused && searchTerm.length >= 2 && (
                <div className="mt-1 absolute top-full left-0 right-0 z-50">
                  <SearchSuggestions
                    query={searchTerm}
                    onSelect={handleSuggestionClick}
                  />
                </div>
              )}
              
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
                    setShowSuggestions(false)
                    setIsSearchFocused(false)
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
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
              )}
              
              {/* Camera/Search by Image Button */}
              <button
                type="button"
                onClick={() => {
                  setSearchModalInitialTab('image')
                  setIsSearchModalOpen(true)
                }}
                className={cn(
                  "absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-8 sm:w-8 rounded-full hover:bg-yellow-500/10 hover:text-yellow-500 transition-colors flex items-center justify-center z-10",
                  searchTerm.trim() ? "hidden" : "flex", // Hide when typing
                  darkHeaderFooterClasses.textNeutralSecondaryFixed,
                )}
                title="Search by image"
              >
                <ScanSearch className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              </div>
            </form>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0 ml-auto text-[13px] leading-5">
            <NavigationLinks13InchProductDetail darkHeaderFooterClasses={darkHeaderFooterClasses} toast={toast} />
            {/* Service Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "hidden sm:flex items-center gap-1",
                    darkHeaderFooterClasses.buttonGhostText,
                    darkHeaderFooterClasses.buttonGhostHoverBg,
                  )}
                >
                  <Settings className="w-5 h-5" />
                  <span className="hidden sm:inline">Service</span>
                  <span className="sr-only">Service Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={cn(
                  "w-56",
                  "bg-white text-neutral-900 border border-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800",
                )}
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
            
            {/* Dark Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const newTheme = (backgroundColor === 'white' || backgroundColor === 'gray') ? 'dark' : 'white'
                setBackgroundColor(newTheme)
              }}
              className={cn(
                "hidden sm:flex items-center gap-1",
                darkHeaderFooterClasses.buttonGhostText,
                darkHeaderFooterClasses.buttonGhostHoverBg,
              )}
              title={(backgroundColor === 'white' || backgroundColor === 'gray') ? 'Switch to dark theme' : 'Switch to light theme'}
              suppressHydrationWarning
            >
              {(backgroundColor === 'white' || backgroundColor === 'gray') ? (
                <>
                  <Moon className="w-5 h-5" />
                  <span className="hidden sm:inline" suppressHydrationWarning>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-5 h-5" />
                  <span className="hidden sm:inline" suppressHydrationWarning>Light</span>
                </>
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className={cn("hidden sm:flex", darkHeaderFooterClasses.buttonGhostText, darkHeaderFooterClasses.buttonGhostHoverBg)}
            >
              <Share2 className="w-5 h-5" />
              <span className="sr-only">Share</span>
            </Button>
            <OptimizedLink 
              href="/cart"
              prefetch="hover"
              priority="high"
              className="inline-block"
            >
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "relative rounded-full transition-colors border-yellow-500 hover:bg-yellow-500 hover:text-white hover:border-yellow-500",
                  // Smaller on mobile
                  "w-7 h-7 p-0 sm:w-10 sm:h-10",
                  backgroundColor === "white" ? "bg-white text-neutral-950" : "bg-gray-800 text-white"
                )}
                suppressHydrationWarning
              >
                <ShoppingCart className="w-3 h-3 sm:w-5 sm:h-5" />
                <span className="sr-only">Shopping Cart</span>
                {cartUniqueProducts > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-orange-500 text-white text-[10px] sm:text-xs font-bold" suppressHydrationWarning>
                    {cartUniqueProducts > 99 ? '99+' : cartUniqueProducts}
                </span>
                )}
              </Button>
            </OptimizedLink>

            {/* Spacer between cart and profile */}
            <div className="w-2.5"></div>

            {/* User Profile - Moved to right side after cart */}
            {isAuthenticated ? (
              <div className="flex flex-col items-center mr-1 -mt-2 sm:mt-0">
                <div className="w-6 h-6 sm:w-8 sm:h-8">
              <UserProfile />
                </div>
                <span className="hidden sm:block text-[8px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 sm:mt-1 truncate max-w-[60px] sm:max-w-[80px]">
                  {(user as any)?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                </span>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "flex items-center gap-1 h-auto py-2 px-1 sm:px-2 mr-1 group border border-transparent hover:border-white/20 hover:bg-transparent",
                      darkHeaderFooterClasses.buttonGhostText,
                    )}
                  >
                    <User className="w-4 h-4 sm:w-5 sm:h-5 group-hover:text-yellow-500 transition-colors" />
                    <div className="hidden sm:flex flex-col items-start text-[10px]">
                      <span className="group-hover:text-yellow-500 transition-colors">Welcome</span>
                      <span className="font-semibold group-hover:text-yellow-500 transition-colors">Sign in / Register</span>
                    </div>
                    <span className="sr-only">User Menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className={cn(
                    "w-56",
                    // Force solid backgrounds in both themes
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
        </div>
      </header>

      <main className={cn("flex-1 w-full pb-4 sm:pb-6 lg:pb-8 px-3 sm:px-6 lg:px-16 xl:px-24 2xl:px-32", themeClasses.mainBg, "pt-20 sm:pt-24 lg:pt-24")} suppressHydrationWarning>
        {/* Show product details immediately when product data is available */}
        {/* Priority: Product Details (first) > Ads > Images */}
        {/* Skeleton only shows when data is false/null (not available) */}
        {product ? (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2 lg:gap-2 xl:gap-3">
          {/* Product Image Gallery - Show skeleton only if image data is not available (false/null) */}
          {product.image ? (
          <div className="flex flex-col-reverse gap-3 sm:gap-4 lg:flex-row lg:gap-6">
            {/* Mobile: Horizontal Thumbnails (Top on SM screens) */}
            <div className="flex flex-col gap-2 lg:hidden">
              <div
                className={cn(
                  "flex flex-row gap-2 pb-2 overflow-x-auto",
                  "scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
                  "transition-all duration-300 ease-in-out",
                  isMainImageFocused
                    ? "opacity-20 scale-90 pointer-events-none"
                    : "opacity-100 scale-100 pointer-events-auto",
                )}
              >
                {thumbnailImages.map((imgUrl, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="icon"
                    className={cn(
                      "relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 aspect-square overflow-hidden rounded-md border",
                      selectedThumbnailIndex === index ? "border-black ring-1 ring-blue-500" : "border-black/30",
                      cn(themeClasses.cardBg, "hover:bg-opacity-80"),
                    )}
                    onClick={() => {
                      setMainImage(imgUrl)
                      setSelectedThumbnailIndex(index)
                      setIsManualImageSelection(true)
                      setMainViewMode('image')
                      setShouldAutoplayVideo(false)
                    }}
                  >
                    {imgUrl && (
                      <LazyImage
                        src={imgUrl}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, 100px"
                        className="object-contain"
                        priority={index === 0}
                        quality={80}
                      />
                    )}
                    <span className="sr-only">
                      {`Variant image ${index + 1} of ${product.name}`}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Desktop: Blue Background Container with Thumbnails (Left on LG screens) */}
            <div className="hidden lg:flex flex-col gap-2">
              <div
                className={cn(
                  "bg-transparent rounded-lg flex-shrink-0 relative",
                  "lg:w-24 xl:w-28 lg:h-[550px]",
                  "flex flex-col gap-2 px-1 py-2",
                  "overflow-y-auto",
                  "scrollbar-hide",
                  "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
                  "shadow-[inset_0_0_20px_rgba(0,0,0,0.3),0_20px_20px_-10px_rgba(0,0,0,0.4)] dark:shadow-[inset_0_0_20px_rgba(255,255,255,0.3),0_20px_20px_-10px_rgba(255,255,255,0.4)]",
                  "transition-all duration-300 ease-in-out",
                  isMainImageFocused
                    ? "opacity-20 scale-90 pointer-events-none"
                    : "opacity-100 scale-100 pointer-events-auto",
                )}
                style={{
                  maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
                }}
              >
                {thumbnailImages.map((imgUrl, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="icon"
                    className={cn(
                      "relative flex-shrink-0 w-full lg:h-auto aspect-square overflow-hidden rounded-md border",
                      selectedThumbnailIndex === index ? "border-black ring-1 ring-black" : "border-black/30",
                      "bg-white/10 hover:bg-white/20 transition-colors",
                    )}
                    onClick={() => {
                      setMainImage(imgUrl)
                      setSelectedThumbnailIndex(index)
                      setIsManualImageSelection(true)
                      setMainViewMode('image')
                      setShouldAutoplayVideo(false)
                    }}
                  >
                    {imgUrl && (
                      <LazyImage
                        src={imgUrl}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, 100px"
                        className="object-contain"
                        priority={index === 0}
                        quality={80}
                      />
                    )}
                    <span className="sr-only">
                      {`Variant image ${index + 1} of ${product.name}`}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Main Product Image (Right on LG screens, Bottom on SM screens) */}
            <div className="flex-1 flex flex-col gap-[5px] sm:gap-[5px] items-center lg:items-start">
              {/* Supplier Company Name with Logo - Only show if supplierInfo exists */}
              {supplierInfo && (
                <div className="flex flex-col gap-1 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {supplierInfo?.companyLogo && (
                      <Image
                        src={supplierInfo.companyLogo}
                        alt={`${supplierInfo?.companyName || ''} Logo`}
                        width={20}
                        height={20}
                        className="w-5 h-5 object-contain flex-shrink-0"
                      />
                    )}
                    {supplierInfo?.companyName && (
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {supplierInfo.companyName}
                      </span>
                    )}
                    {/* Verified Badge - Show if verified */}
                    {supplierInfo?.isVerified && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 rounded">
                        <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                        <span className="text-[10px] font-medium text-green-700 dark:text-green-400">Verified</span>
                      </div>
                    )}
                    {/* View Count and View Seller Products Link */}
                    {supplierInfo?.totalViews !== null && supplierInfo?.totalViews !== undefined && (
                      <>
                        <span className="text-xs text-gray-600 dark:text-gray-400 sm:hidden">
                          ({supplierInfo.totalViews.toLocaleString()}) view{supplierInfo.totalViews !== 1 ? 's' : ''}
                        </span>
                        {product?.id && (
                          <OptimizedLink
                            href={`/products?supplierByProduct=${product.id}`}
                            className="hidden sm:inline-flex text-xs text-blue-600 dark:text-blue-400 hover:underline items-center gap-1 ml-1"
                          >
                            <span>({supplierInfo.totalViews.toLocaleString()})</span>
                            <span>view seller products</span>
                          </OptimizedLink>
                        )}
                      </>
                    )}
                  </div>
                  {/* Rating and detail sentence section - Only show if supplier info exists */}
                  {(supplierInfo?.rating || supplierInfo?.reviewCount || supplierInfo?.detailSentence) && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {/* Company Rating - Only show if rating exists */}
                      {(supplierInfo.rating || supplierInfo.reviewCount) && (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${
                                supplierInfo.rating && supplierInfo.rating > 0 && i < Math.floor(supplierInfo.rating)
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300 dark:text-gray-600"
                              }`}
                            />
                          ))}
                          {supplierInfo.rating && (
                            <span className="font-medium ml-0.5">{supplierInfo.rating}</span>
                          )}
                          {supplierInfo.reviewCount && supplierInfo.reviewCount > 0 && (
                            <span className="text-gray-400">({supplierInfo.reviewCount >= 1000 ? `${(supplierInfo.reviewCount / 1000).toFixed(1)}k` : supplierInfo.reviewCount})</span>
                          )}
                        </div>
                      )}
                      {/* Only show separator if both rating and detail sentence exist */}
                      {(supplierInfo.rating || supplierInfo.reviewCount) && supplierInfo.detailSentence && (
                        <span>|</span>
                      )}
                      {/* Detail Sentence - Only show if it exists */}
                      {supplierInfo.detailSentence && (
                        <span>{supplierInfo.detailSentence}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border",
                  themeClasses.cardBorder,
                  themeClasses.cardBg,
                  "max-w-[calc(95%-20px)] max-h-[calc(95%-20px)] sm:max-w-[calc(90%-20px)] sm:max-h-[calc(90%-20px)]",
                  "w-[95%] sm:w-[90%] lg:w-[85%] mx-auto lg:mx-0",
                )}
              >
                {/* Main Image View */}
                {mainViewMode === 'image' && currentImage && (
                  <div className="relative w-full h-full overflow-hidden">
                  <LazyImage
                    src={currentImage}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw"
                    className="object-contain"
                    priority={true} // Priority for main product image
                    quality={90}
                    placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAICEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                    />
                    
                    {/* Magnifier Glass Overlay */}
                    {isMainImageFocused && (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          width: '300px',
                          height: '300px',
                          borderRadius: '50%',
                          border: '3px solid #3b82f6',
                          boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
                          background: 'transparent',
                          zIndex: 10,
                          transform: 'translate(-50%, -50%)',
                          left: '50%',
                          top: '50%',
                          transition: 'all 0.1s ease-out'
                        }}
                      >
                        <div
                          className="absolute inset-0 rounded-full overflow-hidden"
                          style={{
                            backgroundImage: `url(${currentImage})`,
                            backgroundSize: '250%',
                            backgroundPosition: '50% 50%',
                            backgroundRepeat: 'no-repeat'
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Mouse tracking for magnifier */}
                    {isMainImageFocused && (
                      <div
                        className="absolute inset-0 cursor-crosshair"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const y = e.clientY - rect.top
                          
                          const magnifier = e.currentTarget.parentElement?.querySelector('.absolute.pointer-events-none') as HTMLElement
                          if (magnifier) {
                            magnifier.style.left = `${x}px`
                            magnifier.style.top = `${y}px`
                            
                            const backgroundX = ((x / rect.width) * 100) - 20
                            const backgroundY = ((y / rect.height) * 100) - 20
                            
                            const background = magnifier.querySelector('div') as HTMLElement
                            if (background) {
                              background.style.backgroundPosition = `${backgroundX}% ${backgroundY}%`
                            }
                          }
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Video View */}
                {mainViewMode === 'video' && currentVideo && (
                  isDirectVideoFile(currentVideo) ? (
                    <video
                      className="w-full h-full rounded-lg"
                      controls
                      autoPlay={shouldAutoplayVideo}
                      muted={false}
                      loop
                      playsInline
                      poster={currentImage || product.image || undefined}
                      src={currentVideo}
                    />
                  ) : (
                    <iframe
                      src={(() => {
                        if (isYouTubeUrl(currentVideo)) {
                          const base = convertToEmbedUrl(currentVideo)
                          const match = base.match(/embed\/([a-zA-Z0-9_-]+)/)
                          const vid = match ? match[1] : ''
                          return shouldAutoplayVideo
                            ? `${base}?autoplay=1&mute=0&loop=1${vid ? `&playlist=${vid}` : ''}`
                            : base
                        }
                        // For generic embeds, try to append autoplay and unmuted if allowed
                        return shouldAutoplayVideo ? `${currentVideo}${currentVideo.includes('?') ? '&' : '?'}autoplay=1&muted=0&loop=1` : currentVideo
                      })()}
                      title={`${product.name} Product Video`}
                      className="w-full h-full rounded-lg"
                      allowFullScreen
                      allow="autoplay; encrypted-media"
                    />
                  )
                )}

                {/* No Video Message */}
                {mainViewMode === 'video' && (!currentVideo || currentVideo.trim() === '') && (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <Play className="w-16 h-16 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      No Video Available
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      This product doesn't have a video demonstration yet.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMainViewMode('image')}
                      className="flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Back to Image
                    </Button>
                  </div>
                )}

                {/* 360° View */}
                {mainViewMode === '360' && currentView360 && (
                  isYouTubeUrl(currentView360) ? (
                    <iframe
                      src={(() => {
                        const base = convertToEmbedUrl(currentView360)
                        const match = base.match(/embed\/([a-zA-Z0-9_-]+)/)
                        const vid = match ? match[1] : ''
                        return shouldAutoplayVideo
                          ? `${base}?autoplay=1&mute=0&loop=1${vid ? `&playlist=${vid}` : ''}`
                          : base
                      })()}
                      title={`${product.name} 360° View`}
                      className="w-full h-full rounded-lg"
                      allowFullScreen
                      allow="autoplay; encrypted-media"
                    />
                  ) : (
                    <iframe
                      src={currentView360}
                      title={`${product.name} 360° View`}
                      className="w-full h-full rounded-lg"
                      allowFullScreen
                      allow="autoplay; encrypted-media"
                    />
                  )
                )}

                {/* No 360° View Message */}
                {mainViewMode === '360' && !currentView360 && (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <RotateCcw className="w-16 h-16 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      No 360° View Available
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      This product doesn't have a 360° view yet.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMainViewMode('image')}
                      className="flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Back to Image
                    </Button>
                  </div>
                )}

                {/* Variant indicator */}
                {mainViewMode === 'image' && selectedVariant && selectedVariant.image !== product.image && (
                  <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-md">
                    Variant Image
                  </div>
                )}
                

                {/* China Import Badge (only show if not from China page) */}
                {!fromChina && mainViewMode === 'image' && (displayProduct?.importChina || displayProduct?.import_china) && (
                  <div className="absolute bottom-2 left-2 z-30">
                    <span className="inline-flex items-center justify-center bg-red-600 text-white text-[10px] sm:text-[12px] font-semibold px-2 py-1 rounded shadow-sm">
                      i - China
                    </span>
                  </div>
                )}
                

                {/* View Mode Indicator */}
                {mainViewMode !== 'image' && (
                  <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded shadow-sm z-20">
                    {mainViewMode === 'video' ? 'Video Mode' : '360° View'}
                  </div>
                )}

                {/* Toggle button for image focus (only in image mode) */}
                {mainViewMode === 'image' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "absolute bottom-2 right-2 z-10",
                    "bg-black/50 text-white hover:bg-black/70",
                    "transition-colors duration-200",
                  )}
                  onClick={() => setIsMainImageFocused(!isMainImageFocused)}
                >
                  {isMainImageFocused ? "Exit Focus" : "Focus Image"}
                </Button>
                )}

                {/* Back to Image button (for video and 360° modes) */}
                {mainViewMode !== 'image' && (
                <Button
                  variant="ghost"
                    size="sm"
                    className={cn(
                      "absolute bottom-2 right-2 z-10",
                      "bg-black/50 text-white hover:bg-black/70",
                      "transition-colors duration-200",
                    )}
                    onClick={() => setMainViewMode('image')}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Back to Image
                </Button>
                )}
                      </div>
              {/* Video and 360° View Controls */}
              <div className={cn("flex items-center justify-center gap-8 mt-2 p-4 rounded-lg w-[85%] mx-auto lg:mx-0", themeClasses.cardBg)}>
                {/* Always show video button */}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex items-center gap-2 hover:text-blue-600 hover:border-blue-600 transition-colors duration-200",
                    "text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
                    mainViewMode === 'video' && "text-blue-600 border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  )}
                  onClick={() => {
                    if (currentVideo && currentVideo.trim() !== '') {
                      setMainViewMode('video')
                      setShouldAutoplayVideo(true)
                    } else {
                      setMainViewMode('video') // Show "no video" message
                      setShouldAutoplayVideo(false)
                    }
                  }}
                >
                  <Play className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {mainViewMode === 'video' ? 'Hide Video' : 'Play Video'}
                  </span>
                </Button>

                {/* Always show 360° button */}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex items-center gap-2 hover:text-blue-600 hover:border-blue-600 transition-colors duration-200",
                    "text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
                    mainViewMode === '360' && "text-blue-600 border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  )}
                  onClick={() => {
                    if (currentView360 && currentView360.trim() !== '') {
                      setMainViewMode('360')
                      setShouldAutoplayVideo(true)
                    } else {
                      setMainViewMode('360') // Show "no 360° view" message
                      setShouldAutoplayVideo(false)
                    }
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {mainViewMode === '360' ? 'Hide 360°' : '360° View'}
                  </span>
                </Button>
              </div>
            </div>
          </div>
          ) : (
            // Show skeleton only if image data is not available (false/null)
            <ProductImageSkeleton />
          )}

          {/* Product Details Container - Show immediately when product data is available */}
          <div className="flex flex-col gap-4 h-[650px] overflow-y-scroll scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] rounded-lg pl-4 pt-4 pb-4 pr-2">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                backgroundColor === "white" ? "bg-blue-100 text-blue-700" : "bg-blue-900/50 text-blue-300"
              )}>
                <Info className="w-3 h-3" /> Generic
              </span>
              {supplierInfo?.isVerified && (
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                  backgroundColor === "white" ? "bg-green-100 text-green-700" : "bg-green-900/50 text-green-300"
                )}>
                  <CheckCircle className="w-3 h-3" /> Verified Seller
                </span>
              )}
              {supplierInfo?.isVerified && supplierInfo.region && (
                <span className={cn(
                  "text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1"
                )}>
                  <MapPin className="w-3 h-3" />
                  {supplierInfo.region}
                </span>
              )}
            </div>
            <h1 className={cn("text-xl sm:text-2xl lg:text-3xl font-bold", themeClasses.mainText)}>{product.name}</h1>
            
            {/* Product Description */}
            {displayProduct?.description ? (
              <p className={cn("text-sm sm:text-base leading-relaxed mb-4", themeClasses.mainText)}>
                {displayProduct.description}
              </p>
            ) : displayProduct?.description === '' || !displayProduct?.description ? (
              <p className={cn("text-sm sm:text-base leading-relaxed mb-4 italic", themeClasses.textNeutralSecondary)}>
                No description available for this product.
              </p>
            ) : null}
            
            <div className={cn("flex items-center gap-1 sm:gap-2 text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map(
                  (
                    _,
                    i, // Star rating
                  ) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 sm:w-4 sm:h-4 ${
                        i < Math.floor(product.rating) ? "fill-yellow-400 text-yellow-400" : "text-neutral-300"
                      }`}
                    />
                  ),
                )}
              </div>
              <span className={themeClasses.textNeutralSecondary}>{product.rating}</span>
              <span className={cn("hidden sm:inline", themeClasses.textNeutralSecondary)}>|</span>
              <span className="text-blue-600 hover:underline cursor-pointer" onClick={() => setActiveTab("reviews")}>({product.reviews} reviews)</span>
              <span className={cn("hidden sm:inline", themeClasses.textNeutralSecondary)}>|</span>
              <span className="text-blue-600 hover:underline cursor-pointer" onClick={() => {
                if (!isAuthenticated) {
                  openAuthModal()
                } else {
                  setIsReviewModalOpen(true)
                }
              }}>Write a review</span>
            </div>
            <div className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
              <span className={themeClasses.textNeutralSecondary}>SKU: {currentSKU}</span>
              <span className={cn("mx-1 sm:mx-2", themeClasses.textNeutralSecondary)}>|</span>
              <span className={themeClasses.textNeutralSecondary}>Model: {currentModel}</span>
              <span className={cn("mx-1 sm:mx-2", themeClasses.textNeutralSecondary)}>|</span>
              <span className={cn("hidden sm:inline", themeClasses.textNeutralSecondary)}>
                {product.views ? product.views.toLocaleString() : '0'} people viewed this product
              </span>
              {soldCount && soldCount.soldCount > 0 && (
                <>
                  <span className={cn("mx-1 sm:mx-2", themeClasses.textNeutralSecondary)}>|</span>
                  <span className={cn("hidden sm:inline", themeClasses.textNeutralSecondary)}>
                    {soldCount.soldCount.toLocaleString()} {soldCount.soldCount === 1 ? 'item' : 'items'} sold
                    {soldCount.buyersCount !== null && soldCount.buyersCount > 0 && (
                      <span> to {soldCount.buyersCount.toLocaleString()} {soldCount.buyersCount === 1 ? 'person' : 'people'}</span>
                    )}
                  </span>
                </>
              )}
            </div>

            <div className="mt-4">
              {/* Desktop: All in one row - prices on left, Set Price Alert on right */}
              <div className="hidden lg:block">
                <div className="flex items-baseline justify-between">
                  {/* Left side: Prices */}
                  <div className="flex items-baseline gap-2">
                    {/* Main Price */}
                    <span className={cn("text-3xl sm:text-4xl lg:text-5xl font-bold", themeClasses.mainText)}>
                      {formatPrice(currentPrice)}
                    </span>
                    
                    {/* Original Price + Save Badge */}
              {currentOriginalPrice > currentPrice && (
                      <div className="flex items-baseline gap-2">
                <span className={cn("text-sm sm:text-base line-through", themeClasses.textNeutralSecondary)}>
                  {formatPrice(currentOriginalPrice)}
                </span>
                <span className={cn(
                          "text-white text-xs font-semibold px-2 py-1 rounded text-center",
                  backgroundColor === "white" ? "bg-red-500" : "bg-red-600"
                )}>
                  Save {formatPrice(currentOriginalPrice - currentPrice)}
                </span>
                      </div>
              )}
                  </div>
                  
                  {/* Right side: Set Price Alert */}
                  {currentOriginalPrice > currentPrice && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePriceAlertClick}
                className={cn(
                  "border border-transparent lg:border",
                  backgroundColor === "dark"
                    ? "text-white hover:text-yellow-500 lg:border-neutral-600"
                    : "text-blue-600 hover:text-blue-700 lg:border-neutral-300",
                  hasPriceAlert && "text-green-600 hover:text-green-700"
                )}
              >
                      {hasPriceAlert ? "✓ Alert Set" : "Set Price Alert"}
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Mobile: Stacked layout */}
              <div className="lg:hidden">
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-3xl sm:text-4xl lg:text-5xl font-bold", themeClasses.mainText)}>
                    {formatPrice(currentPrice)}
                </span>
                  {currentOriginalPrice > currentPrice && (
                    <span className={cn("text-sm sm:text-base line-through", themeClasses.textNeutralSecondary)}>
                      {formatPrice(currentOriginalPrice)}
                    </span>
                  )}
                </div>
                
                {/* Mobile: Action Buttons below prices */}
                {currentOriginalPrice > currentPrice && (
                  <div className="flex items-center justify-between mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePriceAlertClick}
                      className={cn(
                        "border border-transparent lg:border",
                        backgroundColor === "dark"
                          ? "text-white hover:text-yellow-500 lg:border-neutral-600"
                          : "text-blue-600 hover:text-blue-700 lg:border-neutral-300",
                        hasPriceAlert && "text-green-600 hover:text-green-700"
                      )}
                    >
                      {hasPriceAlert ? "✓ Alert Set" : "Set Price Alert"}
              </Button>
                    
                    <span className={cn(
                      "text-white text-xs font-semibold px-2 py-1 rounded text-center",
                      backgroundColor === "white" ? "bg-red-500" : "bg-red-600"
                    )}>
                      Save {formatPrice(currentOriginalPrice - currentPrice)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className={cn("flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm mt-2", themeClasses.textNeutralSecondary)}>
              {/* Dynamic Stock Status */}
              <div className="flex items-center gap-1">
                {isLoadingProduct ? (
                  <span className="flex items-center gap-1 text-gray-500 font-medium">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                    Loading stock status...
                  </span>
                ) : productDisplayState.inStock && productDisplayState.stockQuantity > 0 ? (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" /> In Stock ({productDisplayState.stockQuantity} available)
              </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 font-medium">
                    <X className="w-3 h-3 sm:w-4 sm:h-4" /> Out of Stock
                  </span>
                )}
              </div>

              {/* Dynamic Free Delivery Status */}
              <div className="flex items-center gap-1">
                {productDisplayState.freeDelivery ? (
                  <span className={cn("flex items-center gap-1 text-green-600 font-medium", themeClasses.textNeutralSecondary)}>
                <Truck className="w-3 h-3 sm:w-4 sm:h-4" /> Free delivery
              </span>
                ) : (
                  <span className={cn("flex items-center gap-1 text-gray-500", themeClasses.textNeutralSecondary)}>
                    <Truck className="w-3 h-3 sm:w-4 sm:h-4" /> Delivery fee applies
                  </span>
                )}
              </div>

              {/* Dynamic Same Day Delivery Status */}
              <div className="flex items-center gap-1">
                {productDisplayState.sameDayDelivery ? (
                  <span className={cn("flex items-center gap-1 text-blue-600 font-medium", themeClasses.textNeutralSecondary)}>
                <CalendarClock className="w-3 h-3 sm:w-4 sm:h-4" /> Same day delivery available
              </span>
                ) : (
                  <span className={cn("flex items-center gap-1 text-gray-500", themeClasses.textNeutralSecondary)}>
                    <CalendarClock className="w-3 h-3 sm:w-4 sm:h-4" /> Standard delivery
                  </span>
                )}
              </div>
            </div>

            

            {/* Simple Variant Selection - List all variants */}
            {displayProduct.variants && displayProduct.variants.length > 0 ? (
              <div className="mt-4 space-y-4 sm:space-y-6">
                <div className="border-t border-neutral-200 pt-4">
                  <Label className={cn("text-lg font-semibold mb-3 block", themeClasses.mainText)}>
                    Select product type
                        </Label>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {displayProduct.variants.map((variant: any) => {
                      const stockQty = variant.stock_quantity || variant.stockQuantity || 0
                      const isInStock = stockQty > 0
                      const isSelected = selectedVariant?.id === variant.id
                            return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => handleVariantSelect(variant.id?.toString() || '')}
                          disabled={!isInStock}
                                className={cn(
                            "px-4 py-2 rounded-md text-sm sm:text-base font-medium transition-all whitespace-nowrap overflow-hidden text-ellipsis max-w-full",
                                  isSelected 
                              ? backgroundColor === "white"
                                ? "bg-blue-600 text-white border-2 border-blue-700"
                                : "bg-blue-700 text-white border-2 border-blue-500"
                              : cn(
                                  themeClasses.cardBg,
                                  themeClasses.mainText,
                                  themeClasses.cardBorder,
                                  "border-2 hover:opacity-80"
                                ),
                            !isInStock && "opacity-50 cursor-not-allowed"
                          )}
                          title={variant.variant_name || `Variant ${variant.id}`}
                        >
                          {variant.variant_name || `Variant ${variant.id}`}
                        </button>
                            )
                          })}
                        </div>
                      </div>
              </div>
            ) : displayProduct.variants && displayProduct.variants.length === 0 ? (
              <div className="mt-4 space-y-4 sm:space-y-6">
                <div className="border-t border-neutral-200 pt-4">
                  <h3 className={cn("text-lg font-semibold mb-3", themeClasses.mainText)}>
                    Product Options
                  </h3>
                  <div className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                    This product has no variant options available.
                  </div>
                </div>
              </div>
            ) : null}

            {/* Quantity Selector and Add to Cart/Buy Now */}
            <div className="space-y-2 mt-4 sm:mt-6">
              {/* Minimum quantity indicator for products under 500 TZS - Mobile: above, Desktop: inline */}
              {product && product.price < 500 && (
                <div className="text-sm text-amber-600 dark:text-amber-400 font-medium sm:hidden">
                  Min. Qty: 5
                </div>
              )}
              <div className="flex items-center gap-2 sm:gap-4">
                <Label htmlFor="quantity" className={cn("text-sm sm:text-base font-semibold", themeClasses.mainText)}>
                Quantity:
              </Label>
              {/* Minimum quantity indicator for products under 500 TZS - Desktop only */}
              {product && product.price < 500 && (
                <div className="hidden sm:block text-sm text-amber-600 dark:text-amber-400 font-medium">
                  Min. Qty: 5
                </div>
              )}
              <div
                className={cn(
                  "flex items-center border rounded-md overflow-hidden max-h-8 sm:max-h-9",
                  backgroundColor === "white" ? "border-neutral-200 bg-white" : "border-neutral-600 bg-gray-800"
                )}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                  className={cn(
                    "rounded-none h-8 w-8 sm:h-9 sm:w-9",
                    backgroundColor === "white" 
                      ? "bg-white hover:bg-gray-100 text-neutral-950" 
                      : "bg-gray-800 hover:bg-gray-700 text-white"
                  )}
                >
                  <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
                <Input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => {
                    const newQuantity = Number.parseInt(e.target.value) || 1
                    const minQuantity = product && product.price < 500 ? 5 : 1
                    
                    // If trying to go below minimum for low-price products, show modal
                    if (product && product.price < 500 && newQuantity < 5) {
                      setIsQuantityLimitModalOpen(true)
                      return // Don't change quantity
                    }
                    
                    // Check stock before setting quantity
                    if (newQuantity > currentAvailableStock) {
                      toast({
                        title: "Insufficient Stock",
                        description: `Only ${currentAvailableStock} ${currentAvailableStock === 1 ? 'unit' : 'units'} available${selectedVariant ? ` for this variant` : ''}.`,
                        variant: "destructive",
                      })
                      // Set to max available stock instead of preventing change
                      setQuantity(Math.max(minQuantity, Math.min(currentAvailableStock, newQuantity)))
                      return
                    }
                    
                    setQuantity(Math.max(minQuantity, newQuantity))
                  }}
                  style={{
                    width: `${getQuantityInputWidth(quantity)}rem`,
                    minWidth: '2.5rem',
                    maxWidth: '6rem'
                  }}
                  className={cn(
                    "text-center border-x rounded-none h-8 sm:h-9 focus:ring-0 focus:border-blue-500 bg-white",
                    "border-neutral-200",
                    "text-neutral-950",
                    "text-xs sm:text-sm",
                    "transition-all duration-200 ease-in-out",
                    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                  )}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= currentAvailableStock}
                  className={cn(
                    "rounded-none h-8 w-8 sm:h-9 sm:w-9",
                    backgroundColor === "white" 
                      ? "bg-white hover:bg-gray-100 text-neutral-950" 
                      : "bg-gray-800 hover:bg-gray-700 text-white",
                    quantity >= currentAvailableStock && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>
              <Button 
                variant="ghost" 
                onClick={handleBulkOrderClick}
                disabled={currentAvailableStock < 100}
                className={cn(
                  "flex items-center gap-1 group border border-transparent hover:border-white/20 hover:bg-transparent text-xs sm:text-sm",
                  backgroundColor === "dark" 
                    ? "text-blue-400 hover:text-yellow-500" 
                    : "text-blue-600 hover:bg-blue-50",
                  currentAvailableStock < 100 && "opacity-50 cursor-not-allowed"
                )}
                title={currentAvailableStock < 100 ? `Insufficient stock. Only ${currentAvailableStock} ${currentAvailableStock === 1 ? 'unit' : 'units'} available.` : "Bulk order (minimum 100 items)"}
              >
                <UsersIcon className={cn(
                  "w-3 h-3 sm:w-4 sm:h-4 group-hover:text-yellow-500 transition-colors",
                  backgroundColor === "dark" && "group-hover:text-yellow-500"
                )} /> 
                <span className={cn(
                  "group-hover:text-yellow-500 transition-colors",
                  backgroundColor === "dark" && "group-hover:text-yellow-500"
                )}>
                  Bulk Order
                </span>
              </Button>
              
            </div>

          </div>

            <div className="flex gap-2 sm:gap-4 mt-4 sm:mt-6">
              <Button
                className="flex-1 py-2 sm:py-3 text-sm sm:text-lg bg-teal-500 text-white hover:bg-teal-600"
                onClick={handleAddToCart}
              >
                {productInCart ? (
                  <>
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" /> Add More
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" /> Add to Cart
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  // Check if this is a China import item first (skip modal if from China page)
                  if (!fromChina && displayProduct && (displayProduct.importChina || displayProduct.import_china)) {
                    const currentPrice = getCurrentPrice()
                    setPendingCartAction({
                      type: 'buy',
                      quantity,
                      variantId: selectedVariant?.id?.toString(),
                      price: currentPrice
                    })
                    setShowChinaImportModal(true)
                    return
                  }
                  
                  // First, call handleAddToCart to ensure item is added (with auto-select if needed)
                  // If successful, navigate to cart. If out of stock, show toast only.
                  const success = handleAddToCart()
                  
                  // Only navigate to cart if item was successfully added
                  if (success) {
                    // Then navigate to cart page after a short delay to ensure cart is updated
                    setTimeout(() => {
                      navigateWithPrefetch('/cart', { priority: 'high' })
                    }, 100)
                  }
                }}
                className={cn(
                  "flex-1 py-2 sm:py-3 text-sm sm:text-lg group border border-transparent hover:border-white/20 hover:bg-transparent",
                  backgroundColor === "dark" 
                    ? "text-teal-400 hover:text-yellow-500 border-teal-400" 
                    : "border-teal-500 text-teal-500 hover:bg-teal-50 bg-transparent"
                )}
              >
                <ZapIcon className={cn(
                  "w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 group-hover:text-yellow-500 transition-colors",
                  backgroundColor === "dark" && "group-hover:text-yellow-500"
                )} /> 
                <span className={cn(
                  "group-hover:text-yellow-500 transition-colors",
                  backgroundColor === "dark" && "group-hover:text-yellow-500"
                )}>
                  Buy Now
                </span>
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mt-4">
              <Button
                variant="outline"
                className={cn(
                  "flex items-center justify-center gap-1 sm:gap-2 group border hover:border-white/20 hover:bg-transparent",
                  "min-w-0 px-1 sm:px-2 py-2 text-[10px] sm:text-xs",
                  "whitespace-normal break-words",
                  backgroundColor === "dark" 
                    ? "text-neutral-400 hover:text-yellow-500 border-neutral-600" 
                    : "hover:bg-neutral-100 bg-transparent text-neutral-600 border-neutral-300",
                  isProductInWishlist && "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                )}
                onClick={handleAddToWishlist}
              >
                <Heart className={cn(
                  "w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 group-hover:text-yellow-500 transition-colors",
                  backgroundColor === "dark" && "group-hover:text-yellow-500",
                  isProductInWishlist && "fill-red-500 text-red-500"
                )} /> 
                <span className={cn(
                  "group-hover:text-yellow-500 transition-colors text-center leading-tight",
                  backgroundColor === "dark" && "group-hover:text-yellow-500"
                )}>
                  <span className="hidden sm:inline">{isProductInWishlist ? "Remove from Wishlist" : "Add to Wishlist"}</span>
                  <span className="sm:hidden">{isProductInWishlist ? "Remove" : "Wishlist"}</span>
                  <span className="whitespace-nowrap"> ({wishlistItems.length})</span>
                </span>
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "flex items-center justify-center gap-1 sm:gap-2 group border hover:border-white/20 hover:bg-transparent",
                  "min-w-0 px-1 sm:px-2 py-2 text-[10px] sm:text-xs",
                  "whitespace-normal break-words",
                  backgroundColor === "dark" 
                    ? "text-neutral-400 hover:text-yellow-500 border-neutral-600" 
                    : "hover:bg-neutral-100 bg-transparent text-neutral-600 border-neutral-300",
                  isProductInSavedLater && "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                )}
                onClick={handleSaveForLater}
              >
                <Clock className={cn(
                  "w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 group-hover:text-yellow-500 transition-colors",
                  backgroundColor === "dark" && "group-hover:text-yellow-500",
                  isProductInSavedLater && "fill-blue-500 text-blue-500"
                )} /> 
                <span className={cn(
                  "group-hover:text-yellow-500 transition-colors text-center leading-tight",
                  backgroundColor === "dark" && "group-hover:text-yellow-500"
                )}>
                  <span className="hidden sm:inline">{isProductInSavedLater ? "Remove from Saved" : "Save for Later"}</span>
                  <span className="sm:hidden">{isProductInSavedLater ? "Remove" : "Save"}</span>
                  <span className="whitespace-nowrap"> ({savedLaterItems.length})</span>
                </span>
              </Button>
              <Dialog open={isGiftWrapDialogOpen} onOpenChange={setIsGiftWrapDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex items-center justify-center gap-1 sm:gap-2 group border hover:border-white/20 hover:bg-transparent",
                      "min-w-0 px-1 sm:px-2 py-2 text-[10px] sm:text-xs",
                      "whitespace-normal",
                      backgroundColor === "dark" 
                        ? "text-neutral-400 hover:text-yellow-500 border-neutral-600" 
                        : "hover:bg-neutral-100 bg-transparent text-neutral-600 border-neutral-300"
                    )}
                  >
                    <GiftIcon className={cn(
                      "w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 group-hover:text-yellow-500 transition-colors",
                      backgroundColor === "dark" && "group-hover:text-yellow-500"
                    )} /> 
                    <span className={cn(
                      "group-hover:text-yellow-500 transition-colors text-center leading-tight",
                      backgroundColor === "dark" && "group-hover:text-yellow-500"
                    )}>
                      Gift Wrap
                    </span>
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className={cn(
                    "sm:max-w-[425px]",
                    backgroundColor === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200",
                    themeClasses.mainText,
                  )}
                >
                  <DialogHeader>
                    <DialogTitle className={themeClasses.mainText}>Gift Wrapping Options</DialogTitle>
                    <DialogDescription className={themeClasses.textNeutralSecondary}>
                      Select your gift wrapping preferences.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="gift-wrap-checkbox"
                        checked={hasGiftWrap}
                        onCheckedChange={(checked) => setHasGiftWrap(checked as boolean)}
                        className={cn(
                          "border-transparent bg-transparent data-[state=checked]:border-transparent",
                          themeClasses.checkboxCheckedBg,
                          themeClasses.checkboxCheckedText,
                        )}
                      />
                      <Label htmlFor="gift-wrap-checkbox" className={themeClasses.mainText}>
                        Add gift wrapping for {formatPrice(5.0)}
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={handleApplyGiftWrap}
                      className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
                    >
                      Apply
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isCustomizeDialogOpen} onOpenChange={setIsCustomizeDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex items-center justify-center gap-1 sm:gap-2 group border hover:border-white/20 hover:bg-transparent",
                      "min-w-0 px-1 sm:px-2 py-2 text-[10px] sm:text-xs",
                      "whitespace-normal",
                      backgroundColor === "dark" 
                        ? "text-neutral-400 hover:text-yellow-500 border-neutral-600" 
                        : "hover:bg-neutral-100 bg-transparent text-neutral-600 border-neutral-300"
                    )}
                  >
                    <SettingsIcon className={cn(
                      "w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 group-hover:text-yellow-500 transition-colors",
                      backgroundColor === "dark" && "group-hover:text-yellow-500"
                    )} /> 
                    <span className={cn(
                      "group-hover:text-yellow-500 transition-colors text-center leading-tight",
                      backgroundColor === "dark" && "group-hover:text-yellow-500"
                    )}>
                      Customize
                    </span>
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className={cn(
                    "sm:max-w-[425px]",
                    backgroundColor === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200",
                    themeClasses.mainText,
                  )}
                >
                  <DialogHeader>
                    <DialogTitle className={themeClasses.mainText}>Product Customization</DialogTitle>
                    <DialogDescription className={themeClasses.textNeutralSecondary}>
                      Enter your customization text or options below.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Label htmlFor="custom-text" className={themeClasses.mainText}>
                      Custom Engraving/Text:
                    </Label>
                    <Input
                      id="custom-text"
                      placeholder="e.g., 'Happy Birthday John'"
                      value={customizationText}
                      onChange={(e) => setCustomizationText(e.target.value)}
                      className={cn(
                        "focus:border-yellow-500 focus:ring-yellow-500",
                        darkHeaderFooterClasses.inputBg,
                        darkHeaderFooterClasses.inputBorder,
                        darkHeaderFooterClasses.textNeutralPrimary,
                        darkHeaderFooterClasses.inputPlaceholder,
                      )}
                    />
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      Additional customization options (e.g., font, color) can be added here.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={handleApplyCustomization}
                      className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
                    >
                      Apply Customization
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>






        <div className={cn("sticky bottom-0 z-30 w-full shadow-lg mt-8", themeClasses.cardBg, themeClasses.cardBorder)}>
          <div className="container flex justify-around items-center h-14 px-4 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              onClick={() => setActiveTab("specifications")}
              className={cn(
                "flex flex-col items-center gap-1",
                activeTab === "specifications" ? "text-blue-600 font-semibold" : themeClasses.textNeutralSecondary,
              )}
            >
              <ClipboardList className="w-5 h-5" />
              <span className="text-xs">Specifications</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setActiveTab("reviews")}
              className={cn(
                "flex flex-col items-center gap-1",
                activeTab === "reviews" ? "text-blue-600 font-semibold" : themeClasses.textNeutralSecondary,
              )}
            >
              <Star className="w-5 h-5" />
              <span className="text-xs">Reviews ({product.reviews})</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setActiveTab("qna")}
              className={cn(
                "flex flex-col items-center gap-1",
                activeTab === "qna" ? "text-blue-600 font-semibold" : themeClasses.textNeutralSecondary,
              )}
            >
              <HelpCircle className="w-5 h-5" />
              <span className="text-xs">Q&A</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setActiveTab("shipping")}
              className={cn(
                "flex flex-col items-center gap-1",
                activeTab === "shipping" ? "text-blue-600 font-semibold" : themeClasses.textNeutralSecondary,
              )}
            >
              <Truck className="w-5 h-5" />
              <span className="text-xs">Shipping</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setActiveTab("warranty")}
              className={cn(
                "flex flex-col items-center gap-1",
                activeTab === "warranty" ? "text-blue-600 font-semibold" : themeClasses.textNeutralSecondary,
              )}
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs">Warranty</span>
            </Button>
          </div>
        </div>

        {/* Tab Content - Positioned below selection card */}
        <div className="mt-4">
          {activeTab === "specifications" && (
            <div className="bg-transparent p-4 sm:p-6">
              <h2 className={cn("text-xl font-bold mb-4", themeClasses.mainText)}>Product Specifications</h2>
              {/* Product Description */}
              {displayProduct?.description ? (
                <div className={cn("text-sm mb-6 leading-relaxed p-4 rounded-lg", themeClasses.cardBg, themeClasses.cardBorder)}>
                  <h3 className={cn("font-semibold mb-2", themeClasses.mainText)}>Description</h3>
                  <p className={cn("text-sm leading-relaxed", themeClasses.mainText)}>{displayProduct.description}</p>
                </div>
              ) : null}
              <div className="relative">
                <div className={cn(
                  "grid grid-cols-1 md:grid-cols-2 gap-2 transition-all duration-300 ease-in-out",
                  !expandedSpecs ? "max-h-96 overflow-hidden" : ""
                )}>
                  {displayProduct?.specifications && Object.keys(displayProduct.specifications).length > 0 ? (
                    Object.entries(displayProduct.specifications).map(([key, value]) => {
                    // Handle both old format (string) and new format (object with value)
                    let specValue = ''
                    
                    if (typeof value === 'string') {
                      specValue = value
                    } else if (typeof value === 'object' && value !== null) {
                      specValue = (value as any).value || ''
                    } else {
                      specValue = String(value)
                    }
                    
                    return (
                      <div key={key} className="py-2 px-3 border-b border-opacity-10" style={{ borderColor: backgroundColor === "white" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn("font-medium text-sm flex-shrink-0", themeClasses.mainText)}>{String(key)}:</span>
                          <span className={cn("text-sm text-right break-words ml-2 flex-1", themeClasses.textNeutralSecondary)}>{specValue}</span>
                        </div>
                      </div>
                    )
                  })
                  ) : (
                    <div className={cn("col-span-2 py-8 text-center", themeClasses.textNeutralSecondary)}>
                      <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No specifications available for this product.</p>
                    </div>
                  )}
                </div>
                
                {/* Show More/Less button for specifications table */}
                {displayProduct?.specifications && Object.keys(displayProduct.specifications).length > 4 && (
                  <div className="mt-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedSpecs(!expandedSpecs)}
                      className={cn("flex items-center gap-2", themeClasses.textNeutralSecondary)}
                    >
                      {expandedSpecs ? 'Show Less' : 'Show More'}
                      <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", expandedSpecs && "transform rotate-180")} />
                    </Button>
                  </div>
                )}
                
                {/* Specification Images Section - Display below specifications table */}
                {(() => {
                  // Handle both array of strings and array of objects
                  const specImages = displayProduct?.specificationImages || []
                  const imageUrls = Array.isArray(specImages) 
                    ? specImages.map((img: any) => {
                        if (typeof img === 'string') return img
                        if (img && typeof img === 'object' && img.imageUrl) return img.imageUrl
                        if (img && typeof img === 'object' && img.url) return img.url
                        return String(img || '')
                      }).filter((url: string) => url && url.trim() !== '')
                    : []
                  
                  return imageUrls.length > 0 ? (
                    <div className="mt-6 pt-6 border-t border-opacity-10" style={{ borderColor: backgroundColor === "white" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)" }}>
                      <h3 className={cn("text-lg font-semibold mb-4", themeClasses.mainText)}>Specification Images</h3>
                      <div className="space-y-[1px]">
                        {imageUrls.map((imgUrl: string, imgIndex: number) => (
                          <div key={imgIndex} className="relative group w-full">
                            <div className="relative w-full overflow-hidden rounded-lg cursor-pointer hover:opacity-80 transition-opacity bg-transparent">
                              <Image
                                src={imgUrl}
                                alt={`Specification image ${imgIndex + 1}`}
                                width={800}
                                height={600}
                                className="w-full h-auto object-contain"
                                sizes="100vw"
                                onClick={() => {
                                  // Open image in new tab
                                  window.open(imgUrl, '_blank')
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                })()}
              </div>
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="bg-transparent p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className={cn("text-xl font-bold", themeClasses.mainText)}>
                  Customer Reviews ({product.reviews})
                </h2>
                {isAuthenticated && (
                  <Button
                    onClick={() => setIsReviewModalOpen(true)}
                    className="text-sm"
                    size="sm"
                  >
                    Write a Review
                  </Button>
                )}
              </div>
              
              {reviewsLoading ? (
                <div className="text-center py-8">
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Loading reviews...</p>
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-8">
                  <p className={cn("text-sm leading-relaxed mb-4", themeClasses.textNeutralSecondary)}>
                    No reviews yet. Be the first to write a review!
                  </p>
                  {!isAuthenticated && (
                    <Button
                      onClick={() => openAuthModal()}
                      className="text-sm"
                      size="sm"
                    >
                      Sign in to Write a Review
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className={cn("border-b pb-6 last:border-b-0", themeClasses.cardBorder)}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            {review.userAvatar ? (
                              <Image src={review.userAvatar} alt={review.userName} width={40} height={40} className="w-10 h-10 rounded-full" />
                            ) : (
                              <User className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                          <div>
                            <p className={cn("font-medium text-sm", themeClasses.mainText)}>{review.userName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3 h-3 ${
                                      i < review.rating
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-gray-300 dark:text-gray-600"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                                {new Date(review.date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {review.comment && (
                        <p className={cn("text-sm leading-relaxed mb-3", themeClasses.mainText)}>
                          {review.comment}
                        </p>
                      )}
                      {review.images && review.images.length > 0 && (
                        <div className="flex gap-2 mb-3 flex-wrap">
                          {review.images.map((img: string, idx: number) => (
                            <Image
                              key={idx}
                              src={img}
                              alt={`Review image ${idx + 1}`}
                              width={80}
                              height={80}
                              className="w-20 h-20 object-cover rounded"
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <button
                          className={cn("text-xs flex items-center gap-1 hover:text-blue-600 transition-colors", themeClasses.textNeutralSecondary)}
                          onClick={async () => {
                            if (!isAuthenticated) {
                              openAuthModal()
                              return
                            }
                            // Toggle helpful vote
                            try {
                              const { createClient } = await import('@supabase/supabase-js')
                              const supabase = createClient(
                                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                              )
                              const { data: { session } } = await supabase.auth.getSession()
                              
                              if (!session) {
                                openAuthModal()
                                return
                              }
                              
                              // Use retry logic for helpful vote
                              const response = await fetchWithRetry(`/api/products/${product.id}/reviews/${review.id}/helpful`, {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${session.access_token}`
                                },
                                retries: 2,
                                retryDelay: 500,
                                exponentialBackoff: true
                              })
                              if (response.ok) {
                                // Refetch reviews with retry logic
                                const reviewsResponse = await fetchWithRetry(`/api/products/${product.id}/reviews`, {
                                  retries: 2,
                                  retryDelay: 500,
                                  exponentialBackoff: true
                                })
                                if (reviewsResponse.ok) {
                                  const data = await reviewsResponse.json()
                                  setReviews(data.reviews || [])
                                }
                              }
                            } catch (error) {
                              // Error toggling helpful
                            }
                          }}
                        >
                          <HelpCircle className="w-3 h-3" />
                          Helpful ({review.helpful})
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "qna" && (
            <div className="bg-transparent p-4 sm:p-6">
              <h2 className={cn("text-xl font-bold mb-4", themeClasses.mainText)}>Questions & Answers</h2>
              <p className={cn("text-sm leading-relaxed", themeClasses.textNeutralSecondary)}>
                No questions asked yet. Ask a question about this product!
              </p>
            </div>
          )}

          {activeTab === "shipping" && (
            <div className="bg-transparent p-4 sm:p-6">
              <h2 className={cn("text-xl font-bold mb-4", themeClasses.mainText)}>Shipping & Delivery</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 px-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 rounded-lg border border-green-200/30 dark:border-green-800/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                      <Package className="w-4 h-4 text-green-600" />
                </div>
                    <div>
                      <p className={cn("font-medium text-sm", themeClasses.mainText)}>Free Shipping</p>
                      <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>On orders over $50</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-xs font-medium text-green-600", themeClasses.mainText)}>Available</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between py-3 px-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn("font-medium text-sm", themeClasses.mainText)}>Delivery Time</p>
                      <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>Standard shipping</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-xs font-medium text-blue-600", themeClasses.mainText)}>3-5 days</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "warranty" && (
            <div className="bg-transparent p-4 sm:p-6">
              <h2 className={cn("text-xl font-bold mb-4", themeClasses.mainText)}>Warranty Information</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-4 py-2 px-3 border-l-4 border-green-500 bg-green-50/50 dark:bg-green-950/10 rounded-r-lg">
                  <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className={cn("font-medium text-sm", themeClasses.mainText)}>Manufacturer Warranty</p>
                    <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>1 year coverage included</p>
                </div>
                  <span className={cn("text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full", themeClasses.mainText)}>1 Year</span>
                </div>
                
                <div className="flex items-center gap-4 py-2 px-3 border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-950/10 rounded-r-lg">
                  <RotateCcw className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className={cn("font-medium text-sm", themeClasses.mainText)}>Return Policy</p>
                    <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>Full refund guarantee</p>
                  </div>
                  <span className={cn("text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full", themeClasses.mainText)}>
                    {Math.max(1, Math.floor((productDisplayState.returnTimeValue || 7) * 0.7))} {productDisplayState.returnTimeType === 'days' ? 'Day' : 'Hour'}{Math.max(1, Math.floor((productDisplayState.returnTimeValue || 7) * 0.7)) !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          )}
          </div>
          </>
        ) : (
          // Show full skeleton only if product data is not available
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2 lg:gap-2 xl:gap-3">
            {/* Product Image Gallery Skeleton */}
            <ProductImageSkeleton />
            
            {/* Product Info Skeleton */}
            <div className="space-y-6">
              <ProductInfoSkeleton />
              <VariantSelectionSkeleton />
              <div className="flex gap-3">
                <ButtonSkeleton className="h-12 w-32" />
                <ButtonSkeleton className="h-12 w-24" />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Related Products Section */}
      <section className="py-8 border-t w-full">
        <div className="w-full px-1 sm:px-2 lg:px-3">
          <div className="flex items-center justify-between mb-6">
            <h2 className={cn("text-xl font-bold", themeClasses.mainText)}>You May Also Like</h2>
            <OptimizedLink 
              href={returnTo} 
              prefetch="hover"
              scroll={false}
              priority="medium"
              className={cn("text-sm font-medium hover:underline", themeClasses.textNeutralSecondary)}
              onClick={() => {
                // Mark that we're returning from product detail
                if (typeof window !== 'undefined') {
                  try {
                    sessionStorage.setItem('navigated_from_product_detail', 'true')
                  } catch (e) {
                    // Ignore storage errors
                  }
                }
              }}
            >
              View All Products
            </OptimizedLink>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1 px-1 sm:px-2 lg:px-3 w-full">
            {rotatedRelatedProducts.map((relatedProduct: any) => {
                const discountPercentage = ((relatedProduct.originalPrice - relatedProduct.price) / relatedProduct.originalPrice) * 100
                
                // Check if product is out of stock
                const isOutOfStock = !relatedProduct.inStock && !relatedProduct.in_stock
                
                // Get badges for the related product
                const leftBadge = getLeftBadge(relatedProduct)
                const rightBadge = getRightBadge(relatedProduct)
                
                
                return (
                  <Card
                    key={relatedProduct.id}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-lg w-full border-0 shadow-none",
                      "transform transition-all duration-300 ease-in-out",
                      "hover:scale-105 hover:shadow-xl hover:shadow-gray-300/60 dark:hover:shadow-gray-700/60",
                      "hover:z-10 relative hover:ring-2 hover:ring-blue-500/20",
                      themeClasses.cardBg,
                      themeClasses.mainText,
                      isOutOfStock && "opacity-75"
                    )}
                  >
                    <OptimizedLink 
                      href={`/products/${relatedProduct.id}-${encodeURIComponent(relatedProduct.slug || relatedProduct.name || 'product')}?returnTo=${encodeURIComponent(returnTo)}`} 
                      className="block relative aspect-square overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600"
                      prefetch="hover"
                      priority="medium"
                      scroll={false}
                    >
                      {relatedProduct.image && (
                        <LazyImage
                          src={relatedProduct.image}
                          alt={relatedProduct.name}
                          fill
                          sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, (max-width: 1280px) 16vw, (max-width: 1536px) 14vw, 12vw"
                          className={cn(
                            "object-cover transition-transform duration-300 hover:scale-110",
                            isOutOfStock && "grayscale"
                          )}
                          priority={false} // Not priority since it's below the fold
                          quality={60}
                        />
                      )}
                      
                      {/* Out of Stock Overlay */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
                          <span className="bg-red-600 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-md shadow-lg uppercase tracking-wide">
                            Out of Stock
                          </span>
                        </div>
                      )}
                      
                      {/* Orange chamfered corner - Top Right */}
                      <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-orange-500 z-20"></div>
                      
                      {/* Left Badge - Top Left */}
                      {leftBadge.type !== 'none' && (
                        <div className="absolute top-0 left-0 sm:top-0 sm:left-1.5 z-10" suppressHydrationWarning>
                          <span 
                            className={leftBadge.className}
                            style={leftBadge.customStyle}
                            suppressHydrationWarning
                          >
                            {leftBadge.text}
                          </span>
                        </div>
                      )}
                      
                      {/* Right Badge - Top Right */}
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
                      
                      {/* Origin Badge - Bottom Left if imported from China */}
                      {relatedProduct.importChina && (
                        <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 z-10">
                          <span className="bg-red-600 text-white text-[8px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-none shadow-sm sm:shadow-md">
                            i - China
                          </span>
                      </div>
                      )}
                      
                    </OptimizedLink>
                    <CardContent className="p-1 flex-1 flex flex-col justify-between">
                      <h3 className="text-xs font-semibold sm:text-sm lg:text-base line-clamp-2 overflow-hidden">{relatedProduct.name}</h3>
                      <div
                        className={cn(
                          "flex items-center gap-1 text-[10px] mt-0.5 sm:text-xs",
                          themeClasses.textNeutralSecondary,
                        )}
                      >
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < Math.floor(relatedProduct.rating)
                                ? "fill-yellow-400 text-yellow-400"
                                : themeClasses.textNeutralSecondary
                            }`}
                          />
                        ))}
                        <span>({relatedProduct.reviews})</span>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-2 mt-0.5">
                        <div className="text-sm font-bold sm:text-base lg:text-lg">{formatPrice(relatedProduct.price)}</div>
                        {relatedProduct.originalPrice > relatedProduct.price && (
                          <>
                            <div className={cn("text-[10px] line-through sm:text-xs", themeClasses.textNeutralSecondary)}>
                              {formatPrice(relatedProduct.originalPrice)}
                            </div>
                            <div className="text-[10px] font-medium text-green-400">
                              {discountPercentage.toFixed(0)}% OFF
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="px-1 pb-1 pt-0 flex flex-col gap-1">
                      {isOutOfStock ? (
                        <Button
                          className="w-full text-xs py-1 h-auto sm:text-sm lg:text-base bg-gray-400 text-white cursor-not-allowed rounded-b-sm rounded-t-none"
                          disabled
                        >
                          <X className="w-4 h-4 mr-2" /> Out of Stock
                        </Button>
                      ) : (
                      <Button
                        className="w-full text-xs py-1 h-auto sm:text-sm lg:text-base bg-yellow-500 text-neutral-950 hover:bg-yellow-600 rounded-b-sm rounded-t-none transform transition-all duration-200 hover:scale-105 hover:shadow-md"
                        onClick={() => addItem(relatedProduct.id, 1)}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                      </Button>
                      )}
                    </CardFooter>
                  </Card>
                )
              })}
          </div>
        </div>
      </section>

      <Footer />

      {/* Bulk Order Dialog */}
      <Dialog open={isBulkOrderDialogOpen} onOpenChange={setIsBulkOrderDialogOpen}>
        <DialogContent className={cn("sm:max-w-md", backgroundColor === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200", themeClasses.mainText)}>
          <DialogHeader>
            <DialogTitle className={cn("text-lg font-bold", themeClasses.mainText)}>
              Bulk Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
              Minimum 100 items required. Quantity has been set to 100 with special bulk pricing.
            </p>
            {currentAvailableStock >= 100 && (
              <p className={cn("text-xs text-green-600 dark:text-green-400", themeClasses.textNeutralSecondary)}>
                ✓ {currentAvailableStock} items available in stock
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setIsBulkOrderDialogOpen(false)
              }}
              className="w-full bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Alert Dialog */}
      <Dialog open={isPriceAlertDialogOpen} onOpenChange={setIsPriceAlertDialogOpen}>
        <DialogContent className={cn("sm:max-w-md", themeClasses.cardBg, themeClasses.mainText, themeClasses.cardBorder)}>
          <DialogHeader>
            <DialogTitle className={cn("text-lg font-bold", darkHeaderFooterClasses.textNeutralPrimary)}>
              🔔 Set Price Alert
            </DialogTitle>
            <DialogDescription className={cn("text-sm", darkHeaderFooterClasses.textNeutralSecondaryFixed)}>
              Get notified when the price drops to your target amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="target-price" className={cn("text-sm font-medium", darkHeaderFooterClasses.textNeutralPrimary)}>
                Target Price
              </Label>
              <div className="relative">
                <span className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-sm", darkHeaderFooterClasses.textNeutralSecondaryFixed)}>
                  {currency === "USD" ? "$" : "TSh"}
                </span>
                <Input
                  id="target-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceAlertTarget}
                  onChange={(e) => setPriceAlertTarget(parseFloat(e.target.value) || 0)}
                  className={cn(
                    "pl-8 focus:border-blue-500 focus:ring-blue-500",
                    darkHeaderFooterClasses.inputBg,
                    darkHeaderFooterClasses.inputBorder,
                    darkHeaderFooterClasses.textNeutralPrimary,
                  )}
                  placeholder="Enter target price"
                />
    </div>
              <p className={cn("text-xs", darkHeaderFooterClasses.textNeutralSecondaryFixed)}>
                Current price: {formatPrice(currentPrice)}
              </p>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className={cn("text-xs font-medium", darkHeaderFooterClasses.textNeutralPrimary)}>
                💡 <strong>How it works:</strong> We'll send you an email notification when the price drops to or below your target price.
              </p>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsPriceAlertDialogOpen(false)}
              className={cn(
                "w-full sm:w-auto",
                themeClasses.borderNeutralSecondary,
                themeClasses.mainText,
              )}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetPriceAlert}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            >
              Set Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      
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
      
      {/* Quantity Limit Modal */}
      <QuantityLimitModal
        isOpen={isQuantityLimitModalOpen}
        onClose={() => setIsQuantityLimitModalOpen(false)}
        productName={product?.name}
      />

      {/* Review Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
            <DialogDescription>
              Share your experience with {product?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="flex items-center gap-2 mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReviewFormData({ ...reviewFormData, rating: i + 1 })}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        i < reviewFormData.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300 dark:text-gray-600"
                      }`}
                    />
                  </button>
                ))}
                {reviewFormData.rating > 0 && (
                  <span className="ml-2 text-sm text-gray-500">
                    {reviewFormData.rating} {reviewFormData.rating === 1 ? 'star' : 'stars'}
                  </span>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="review-comment">Your Review</Label>
              <textarea
                id="review-comment"
                className={cn(
                  "mt-2 w-full min-h-[120px] px-3 py-2 rounded-md border",
                  themeClasses.cardBorder,
                  themeClasses.mainText,
                  "bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                )}
                placeholder="Share your thoughts about this product..."
                value={reviewFormData.comment}
                onChange={(e) => setReviewFormData({ ...reviewFormData, comment: e.target.value })}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsReviewModalOpen(false)
                  setReviewFormData({ rating: 0, comment: '', images: [] })
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  // Security: Validate and sanitize input
                  if (!validateRating(reviewFormData.rating)) {
                    toast({
                      title: "Invalid Rating",
                      description: "Please select a valid rating (1-5 stars)",
                      variant: "destructive"
                    })
                    return
                  }

                  // Validate and sanitize review comment
                  const commentValidation = validateReviewComment(reviewFormData.comment)
                  if (!commentValidation.valid) {
                    toast({
                      title: "Invalid Comment",
                      description: commentValidation.error || "Please enter a valid comment",
                      variant: "destructive"
                    })
                    return
                  }

                  setSubmittingReview(true)
                  try {
                    // Use app auth state first
                    if (!isAuthenticated) {
                      toast({
                        title: "Authentication Required",
                        description: "Please log in to submit a review.",
                        variant: "destructive"
                      })
                      openAuthModal('login')
                      return
                    }

                    const response = await fetch('/api/contact/send', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        name: sanitizeString(user?.name || user?.email || 'Unknown user', 255),
                        email: user?.email || 'no-email@unknown.com',
                        phone: sanitizeString(user?.profile?.phone || '', 50),
                        subject: `New product review for ID ${product?.id}`,
                        message: [
                          `Product ID: ${product?.id}`,
                          `Product Name: ${sanitizeString(product?.name || '', 500)}`,
                          '',
                          `Rating: ${reviewFormData.rating} / 5`,
                          '',
                          'Comment:',
                          commentValidation.sanitized || '(no comment provided)',
                          '',
                          reviewFormData.images?.length
                            ? `Attached image URLs:\n${reviewFormData.images.join('\n')}`
                            : 'No images attached.'
                        ].join('\n'),
                        inquiryType: 'support'
                      })
                    })

                    if (response.ok) {
                      setIsReviewModalOpen(false)
                      setReviewFormData({ rating: 0, comment: '', images: [] })
                      toast({
                        title: 'Thank you!',
                        description: 'Your review has been sent to our team via email.',
                      })
                    } else {
                      const error = await response.json().catch(() => null)
                      const message =
                        error?.message ||
                        `Failed to submit review (status ${response.status}). Please try again.`
                      alert(message)
                    }
                  } catch (error) {
                    alert('Failed to submit review. Please try again.')
                  } finally {
                    setSubmittingReview(false)
                  }
                }}
                disabled={submittingReview || reviewFormData.rating === 0}
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                This item is not available in our local stock at the moment. However, we can import it  within 7-10 days. Same price, same quality, just a short wait!
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

export default function ProductDetailPage() {
  return (
    <BuyerRouteGuard>
      <ProductDetailErrorBoundary>
      <ProductDetailPageContent />
      </ProductDetailErrorBoundary>
    </BuyerRouteGuard>
  )
}

// Additional icons used in the new layout
function PlayCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  )
}

function CameraIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 3A6 6 0 0 0 6 9H2v2h4a6 6 0 0 0 8.5 8.83" />
      <path d="M9 15h6l3 3-3 3H9" />
      <path d="M22 9a6 6 0 0 0-8.5-5.83" />
    </svg>
  )
}

function ZapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function GiftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 12 12 12 12 22 21 10 12 10 13 2" />
      <path d="M20 12V7.5A2.5 2.5 0 0 0 17.5 5h-11A2.5 2.5 0 0 0 4 7.5v14.5" />
      <path d="M20 12H4" />
      <path d="M12 2v3" />
      <path d="M7.5 5h9" />
    </svg>
  )
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V22a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73.73l.22.38a2 2 0 0 0-.73 2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0-.73-2.73l-.22-.39a2 2 0 0 0 2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V2a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

      {/* Admin Edit Dialogs - Removed to fix errors */}

