"use client"

import { DialogTrigger } from "@/components/ui/dialog"
import { SearchSuggestions } from "@/components/search-suggestions"
import { SearchModal } from "@/components/search-modal"
import { QuantityLimitModal } from "@/components/quantity-limit-modal"

import type React from "react"

import { Label } from "@/components/ui/label"

import { useState, useMemo, useEffect, useCallback } from "react" // Added useCallback
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
  Twitter,
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
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
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
import { useProducts } from "@/hooks/use-products"
import { useOptimizedApi } from "@/hooks/use-optimized-api"
import { useSharedDataCache } from "@/contexts/shared-data-cache"
import { OptimizedLink, useOptimizedNavigation } from "@/components/optimized-link"
import { type ProductVariant } from "@/hooks/use-products" // Import types from hook
import { useCart, formatVariantHierarchy } from "@/hooks/use-cart" // Import useCart hook
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCompanyContext } from "@/components/company-provider"
// import { getPreviousPageName } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useWishlist } from "@/hooks/use-wishlist"
import { useSavedLater } from "@/hooks/use-saved-later"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { useCurrency } from "@/contexts/currency-context"
import { UserProfile } from "@/components/user-profile"
import { ImagePreloader } from "@/components/image-preloader"
import { Footer } from "@/components/footer"


export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { navigateWithPrefetch } = useOptimizedNavigation()
  const { backgroundColor, setBackgroundColor, themeClasses, darkHeaderFooterClasses } = useTheme()
  const { products, isLoading, preloadProducts, fetchFullProductDetails } = useProducts()
  const { addItem, isInCart, cartTotalItems } = useCart() // Use useCart hook
  const { companyName, companyLogo, companyColor, isLoaded: companyLoaded } = useCompanyContext()
  
  // Fallback logo system - use local logo if API is not loaded or logo is not available
  const fallbackLogo = "/android-chrome-512x512.png"
  const displayLogo = companyLoaded && companyLogo && companyLogo !== fallbackLogo && companyLogo !== "/placeholder-logo.png" ? companyLogo : fallbackLogo
  const { user, isAuthenticated } = useAuth() // Add auth context
  const { openAuthModal } = useGlobalAuthModal()
  const { formatPrice, currency, setCurrency } = useCurrency()
  
  // Optimized API for product details with input validation
  // Support URLs like /products/2-slug by extracting leading digits
  const rawProductParam = params.id as string
  const leadingDigits = (rawProductParam.match(/^\d+/) || [rawProductParam])[0]
  const productId = leadingDigits
  
  // Get return URL from search params to preserve search state
  const returnTo = searchParams?.get('returnTo') || (typeof window !== 'undefined' ? document.referrer || '/products' : '/products')
  
  // Debug: Log the return URL to see what we're getting
  useEffect(() => {}, [returnTo, searchParams])
  
  // Validate product ID (but don't return early - violates Rules of Hooks!)
  const isValidProductId = !!(productId && !isNaN(Number(productId)) && Number(productId) > 0)
  
  const { 
    data: optimizedProduct, 
    isLoading: isOptimizedLoading, 
    error: optimizedError,
    refetch: refetchProduct
  } = useOptimizedApi({
    endpoint: `/api/products/${productId}`,
    params: { minimal: false },
    ttl: 5 * 60 * 1000, // 5 minutes cache
    staleWhileRevalidate: true,
    refetchOnWindowFocus: true
  })
  
  // Shared data cache for cross-page data
  const { set } = useSharedDataCache()
  const productIdNumber = Number.parseInt(params.id as string)

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

  // Autoplay controller for video view
  const [shouldAutoplayVideo, setShouldAutoplayVideo] = useState(false)
  
  // State for full product details
  const [fullProduct, setFullProduct] = useState<any>(null)
  const [isLoadingFull, setIsLoadingFull] = useState(false)
  
  // State for variant images
  const [variantImages, setVariantImages] = useState<Array<{
    variantId?: number
    imageUrl: string
    attribute?: {name: string, value: string}
    attributes?: Array<{name: string, value: string}>
  }>>([])
  const [isLoadingVariantImages, setIsLoadingVariantImages] = useState(false)
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [searchModalInitialTab, setSearchModalInitialTab] = useState<'text' | 'image'>('text')
  const [imageSearchResults, setImageSearchResults] = useState<any[]>([])
  const [imageSearchKeywords, setImageSearchKeywords] = useState<string[]>([])
  
  // Handle search submission - redirect to products page with search query
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchTerm.trim())}`)
    }
  }, [searchTerm, router])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setSearchTerm(suggestion)
    setShowSuggestions(false)
    setIsSearchFocused(false)
    router.push(`/products?search=${encodeURIComponent(suggestion)}`)
  }, [router])

  // Handle text search from modal
  const handleModalTextSearch = useCallback((query: string) => {
    setSearchTerm(query)
    router.push(`/products?search=${encodeURIComponent(query)}`)
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
    router.push(`/products?${searchParams.toString()}`)
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
  
  // Optimized product finding with early return and memoization
  const product = useMemo(() => {
    // First try to use optimized product data (from prefetching)
    if (optimizedProduct && typeof optimizedProduct === 'object' && 'id' in optimizedProduct && optimizedProduct.id) {
      return optimizedProduct as any // Type assertion for now
    }
    
    // Fallback to products array if optimized data not available
    // Safety check: ensure products is an array before using it
    if (!Array.isArray(products) || !products.length || !productIdNumber) return undefined
    return products.find((p) => p.id === productIdNumber)
  }, [optimizedProduct, products, productIdNumber])

  // Prefer server-fetched full details when available
  const currentVideo = fullProduct?.video ?? product?.video
  const currentView360 = fullProduct?.view360 ?? product?.view360
  
  // Calculate rotated related products (memoized for performance)
  const rotatedRelatedProducts = useMemo(() => {
    // Use different count based on screen size
    const productsToShow = isMobile ? RELATED_PRODUCTS_COUNT_MOBILE : RELATED_PRODUCTS_COUNT_DESKTOP
    
    // Get products from same category
    const sameCategoryProducts = products
      .filter(p => p.id !== product?.id && p.category === product?.category)
    
    // Get products from other categories
    const otherCategoryProducts = products
      .filter(p => p.id !== product?.id && p.category !== product?.category)
    
    // Combine all available products (same category first, then others)
    const allAvailableProducts = [...sameCategoryProducts, ...otherCategoryProducts]
    
    // Calculate which slice to show based on rotation index
    const startIndex = (relatedProductsRotation * productsToShow) % Math.max(1, allAvailableProducts.length)
    let relatedProducts = []
    
    // If we have enough products, slice normally
    if (allAvailableProducts.length >= productsToShow) {
      // Wrap around if needed
      if (startIndex + productsToShow <= allAvailableProducts.length) {
        relatedProducts = allAvailableProducts.slice(startIndex, startIndex + productsToShow)
      } else {
        // Wrap around to beginning
        const remainingFromEnd = allAvailableProducts.slice(startIndex)
        const neededFromStart = productsToShow - remainingFromEnd.length
        relatedProducts = [...remainingFromEnd, ...allAvailableProducts.slice(0, neededFromStart)]
      }
    } else {
      // Show all available products if less than limit
      relatedProducts = allAvailableProducts
    }
    
    return relatedProducts
  }, [products, product, relatedProductsRotation, isMobile, RELATED_PRODUCTS_COUNT_MOBILE, RELATED_PRODUCTS_COUNT_DESKTOP])

  // Fetch full product details when product is found
  useEffect(() => {
    if (productIdNumber) {
      setIsLoadingFull(true)
      fetchFullProductDetails(productIdNumber).then((fullData) => {
        setFullProduct(fullData)
        setIsLoadingFull(false)
      }).catch(() => {
        setIsLoadingFull(false)
      })
    }
  }, [productIdNumber, fetchFullProductDetails])

  // Fetch variant images for the product with caching and rate limiting
  const fetchVariantImages = useCallback(async (productId: number, forceRefresh = false) => {
    try {
      setIsLoadingVariantImages(true)
      
      // Add cache busting parameter if force refresh is requested
      const cacheBustParam = forceRefresh ? `?cb=${Date.now()}` : '?'
      const limitParam = 'limit=5' // Limit to first 5 images for better performance
      
      const response = await fetch(`/api/products/${productId}/variant-images${cacheBustParam}${limitParam}`, {
        headers: {
          'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=60'
        }
      })
      
      if (response.status === 429) {
        return
      }
      
      if (response.ok) {
        const data = await response.json()
        setVariantImages(data.variantImages || [])
      }
    } catch (error) {
      // Error fetching variant images
    } finally {
      setIsLoadingVariantImages(false)
    }
  }, [])

  // Fetch variant images when product is loaded (single call only)
  useEffect(() => {
    if (productIdNumber) {
      // Single load with cache - no force refresh to prevent 429 errors
      fetchVariantImages(productIdNumber, false)
    }
  }, [productIdNumber, fetchVariantImages])

  // Add a manual refresh function for when new images are added (with rate limiting)
  const refreshVariantImages = useCallback(() => {
    if (productIdNumber && !isLoadingVariantImages) {
      fetchVariantImages(productIdNumber, true)
    }
  }, [productIdNumber, fetchVariantImages, isLoadingVariantImages])


  // Function to find matching variant image based on selected attributes
  const findMatchingVariantImage = useCallback((selectedAttributes: Record<string, any>) => {
    if (!variantImages.length || !Object.keys(selectedAttributes).length) {
      return null
    }


    // Score each variant image based on how many attributes match
    const scoredImages = variantImages.map((variantImage: any) => {
      let score = 0
      let totalAttributes = 0

      // Check single attribute (legacy format)
      if (variantImage.attribute) {
        const { name: attrName, value: attrValue } = variantImage.attribute
        const selectedValue = selectedAttributes[attrName]
        
        if (selectedValue) {
          totalAttributes++
          let matches = false
          
          if (Array.isArray(selectedValue)) {
            matches = selectedValue.includes(attrValue)
          } else {
            matches = selectedValue === attrValue
          }
          
          if (matches) {
            score++
          }
        }
      }

      // Check multiple attributes (new format)
      if (variantImage.attributes && variantImage.attributes.length > 0) {
        variantImage.attributes.forEach(({ name: attrName, value: attrValue }: {name: string, value: string}) => {
          const selectedValue = selectedAttributes[attrName]
          
          if (selectedValue) {
            totalAttributes++
            let matches = false
            
            if (Array.isArray(selectedValue)) {
              matches = selectedValue.includes(attrValue)
            } else {
              matches = selectedValue === attrValue
            }
            
            if (matches) {
              score++
            }
          }
        })
      }

      return {
        variantImage,
        score,
        totalAttributes,
        matchRatio: totalAttributes > 0 ? score / totalAttributes : 0
      }
    })

    // Find the best match (highest score, then highest match ratio)
    const bestMatch = scoredImages
      .filter(item => item.score > 0) // Only consider images with at least one match
      .sort((a, b) => {
        // First sort by score (number of matching attributes)
        if (b.score !== a.score) {
          return b.score - a.score
        }
        // Then by match ratio (percentage of attributes that match)
        return b.matchRatio - a.matchRatio
      })[0]

    if (bestMatch) {
      return bestMatch.variantImage.imageUrl
    }

    return null
  }, [variantImages])

  // Use full product data if available, otherwise fall back to minimal product data
  const displayProduct = useMemo(() => {
    const base: any = fullProduct || product
    if (!base) return base

    // Normalize variants from either JSON column or relation
    const normalizedVariants = Array.isArray(base.variants) && base.variants.length > 0
      ? base.variants
      : (Array.isArray(base.product_variants)
          ? base.product_variants.map((variant: any) => ({
              id: variant.id,
              price: variant.price,
              image: variant.image,
              sku: variant.sku,
              model: variant.model,
              variantType: variant.variant_type,
              attributes: variant.attributes || {},
              primaryAttribute: variant.primary_attribute,
              dependencies: variant.dependencies || {},
              primaryValues: variant.primary_values || [],
              multiValues: variant.multi_values || {},
            }))
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
      variants: normalizedVariants,
      variantConfig: normalizedVariantConfig,
    }
  }, [fullProduct, product])
  
  // Combined loading state
  const isProductLoading = isOptimizedLoading || isLoading || isLoadingFull

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

  // Prefetch related products for faster navigation
  useEffect(() => {
    if (product && products.length > 0) {
      const relatedProducts = products
        .filter(p => p.id !== product.id && p.category === product.category)
        .slice(0, 3) // Reduced from 5 to 3 to prevent 429 errors
      
      relatedProducts.forEach((relatedProduct, index) => {
        setTimeout(() => {
          fetch(`/api/products/${relatedProduct.id}?minimal=false`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          }).catch(() => {}) // Silent fail for prefetch
        }, index * 1000) // Increased delay from 200ms to 1000ms to prevent 429 errors
      })
    }
  }, [product, products])

  const [quantity, setQuantity] = useState(1)
  const [mainImage, setMainImage] = useState<string | null>(null)
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
    // Prefer returning to preserved URL with search state
    navigateWithPrefetch(returnTo || '/products', { priority: 'medium' })
  }, [navigateWithPrefetch, returnTo])

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [selectedAttributes, setSelectedAttributes] = useState<{ [key: string]: string | string[] | undefined }>({})
  const [variantSelectionStep, setVariantSelectionStep] = useState<number>(0) // For multi-dependent logic
  const [hasAutoSelected, setHasAutoSelected] = useState(false) // Track if we've auto-selected on mount

  // New states for video and 360° view dialogs
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false)
  const [is360ViewDialogOpen, setIs360ViewDialogOpen] = useState(false)
  
  // New state for main container view mode
  const [mainViewMode, setMainViewMode] = useState<'image' | 'video' | '360'>('image')
  
  // Admin edit dialog states
  const [isStockEditDialogOpen, setIsStockEditDialogOpen] = useState(false)
  const [isFreeDeliveryEditDialogOpen, setIsFreeDeliveryEditDialogOpen] = useState(false)
  const [isSameDayDeliveryEditDialogOpen, setIsSameDayDeliveryEditDialogOpen] = useState(false)
  
  // Selection preview dialog state
  const [isSelectionPreviewOpen, setIsSelectionPreviewOpen] = useState(false)
  
  // Individual quantity controls for each combination
  const [individualQuantities, setIndividualQuantities] = useState<{ [key: string]: number }>({})
  
  // Calculate total stock from attribute quantities
  const calculateTotalStock = useCallback(() => {
    let total = 0
    if (displayProduct?.variants) {
      displayProduct.variants.forEach((variant: any) => {
        if (Array.isArray(variant.primaryValues)) {
          variant.primaryValues.forEach((pv: any) => {
            const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
            total += qty
          })
        } else if (typeof variant.stockQuantity === 'number') {
          total += variant.stockQuantity
        }
      })
    }
    // Fallback to product-level stock if no variant quantities
    if (total === 0 && displayProduct?.stockQuantity) {
      total = displayProduct.stockQuantity
    }
    return total
  }, [displayProduct])

  // Admin editable product states
  const [adminProductState, setAdminProductState] = useState({
    inStock: calculateTotalStock() > 0,
    stockQuantity: calculateTotalStock(),
    freeDelivery: (displayProduct as any)?.freeDelivery ?? false,
    sameDayDelivery: (displayProduct as any)?.sameDayDelivery ?? false,
    returnTimeType: (displayProduct as any)?.return_time_type ?? 'days',
    returnTimeValue: (displayProduct as any)?.return_time_value ?? 3,
  })
  
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

  // Update admin product state when product changes
  useEffect(() => {
    if (displayProduct) {
      const totalStock = calculateTotalStock()
      setAdminProductState({
        inStock: totalStock > 0,
        stockQuantity: totalStock,
        freeDelivery: (displayProduct as any).freeDelivery ?? false,
        sameDayDelivery: (displayProduct as any).sameDayDelivery ?? false,
        returnTimeType: (displayProduct as any).return_time_type ?? 'days',
        returnTimeValue: (displayProduct as any).return_time_value ?? 3,
      })
    }
  }, [displayProduct, calculateTotalStock])

  // Function to update admin product state
  const updateAdminProductState = (field: keyof typeof adminProductState, value: any) => {
    setAdminProductState(prev => {
      const newState = { ...prev, [field]: value }
      
      // Auto-update stock status based on quantity
      if (field === 'stockQuantity') {
        newState.inStock = value > 0
      }
      
      return newState
    })
    
    toast({
      title: "Product Updated",
      description: `${field} has been updated successfully.`,
    })
  }

  // Variant selection logic
  const attributeTypes = useMemo(() => {
    
    if (!displayProduct?.variants || displayProduct.variants.length === 0) {
      return []
    }
    
    const types = new Set<string>()
    
    // Add primary attribute if it exists
    if (displayProduct.variantConfig?.primaryAttribute) {
      types.add(displayProduct.variantConfig.primaryAttribute)
    }
    
    // Add attributes from attribute order
    if (displayProduct.variantConfig?.attributeOrder) {
      displayProduct.variantConfig.attributeOrder.forEach((attr: string) => types.add(attr))
    }
    
    // Extract from variants
    displayProduct.variants.forEach((variant: any, index: number) => {
      
      // Extract from regular attributes
      Object.keys(variant.attributes || {}).filter(key => !/^\d+$/.test(key)).forEach(key => {
        types.add(key)
      })
      
      // Extract from multi values (excluding _raw keys and numeric keys)
      if (variant.multiValues) {
        Object.keys(variant.multiValues).filter(key => !key.endsWith('_raw') && !/^\d+$/.test(key)).forEach(key => {
            types.add(key)
        })
      }
    })
    
    const result = Array.from(types)
    return result
  }, [displayProduct?.variants, displayProduct?.variantConfig])

  // Get all unique values for a specific attribute type
  const getAttributeValues = (type: string): string[] => {
    if (!displayProduct?.variants) return []
    
    const values = new Set<string>()
    
    // Check if this is a primary attribute with multiple values
    if ((displayProduct.variantConfig?.type === 'primary-dependent' && type === displayProduct.variantConfig.primaryAttribute) ||
        (displayProduct.variantConfig?.type === 'multi-dependent' && displayProduct.variantConfig.primaryAttributes?.includes(type)) ||
        (displayProduct.variantConfig?.type === 'simple' && type === displayProduct.variantConfig.primaryAttribute)) {
      displayProduct.variants.forEach((variant: any) => {
        if (variant.primaryValues) {
          variant.primaryValues.forEach((primaryValue: any) => {
            if (primaryValue.value && (displayProduct.variantConfig?.type === 'primary-dependent' || 
                (displayProduct.variantConfig?.type === 'multi-dependent' && primaryValue.attribute === type) ||
                (displayProduct.variantConfig?.type === 'simple' && primaryValue.attribute === type))) {
              values.add(primaryValue.value)
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
      // Check if this is a multi-value attribute
      const hasMultiValues = displayProduct.variants.some((variant: any) => variant.multiValues?.[type])
      if (hasMultiValues) {
        displayProduct.variants.forEach((variant: any) => {
          if (variant.multiValues?.[type] && Array.isArray(variant.multiValues[type])) {
            variant.multiValues[type].forEach((value: string) => {
              if (value) {
                values.add(value)
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
      if (attributeType === primaryAttribute) {
        // For primary attributes, check if the value exists in any variant's primaryValues
        return displayProduct.variants.some((variant: any) => {
          const hasVal = variant.primaryValues?.some((primaryValue: any) => primaryValue.value === value)
          if (!hasVal) return false
          // If this value has quantity on primaryValues, respect it
          const pv = variant.primaryValues?.find((primaryValue: any) => primaryValue.value === value)
          if (pv && typeof pv.quantity === 'number') {
            return pv.quantity > 0
          }
          if (pv && typeof pv.quantity === 'string') {
            const qty = parseInt(pv.quantity)
            return qty > 0
          }
          // Else fallback to variant stock if present
          if (typeof variant.stockQuantity === 'number') return variant.stockQuantity > 0
          return true
        })
      }
      
      // Check if this is a multi-value attribute
      const hasMultiValues = displayProduct.variants.some((variant: any) => 
        variant.multiValues?.[attributeType] && Array.isArray(variant.multiValues[attributeType])
      )
      if (hasMultiValues) {
        return displayProduct.variants.some((variant: any) => 
          variant.multiValues?.[attributeType] && Array.isArray(variant.multiValues[attributeType]) && 
          variant.multiValues[attributeType].includes(value)
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
          const hasVal = variant.primaryValues?.some((primaryValue: any) => primaryValue.value === value)
          if (!hasVal) return false
          const pv = variant.primaryValues?.find((primaryValue: any) => primaryValue.value === value)
          if (pv && typeof pv.quantity === 'number') {
            return pv.quantity > 0
          }
          if (pv && typeof pv.quantity === 'string') {
            const qty = parseInt(pv.quantity)
            return qty > 0
          }
          if (typeof variant.stockQuantity === 'number') return variant.stockQuantity > 0
          return true
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
          const hasVal = variant.primaryValues?.some((pv: any) => pv.attribute === attributeType && pv.value === value)
          if (!hasVal) return false
          const pv = variant.primaryValues?.find((pv: any) => pv.attribute === attributeType && pv.value === value)
          if (pv && typeof pv.quantity === 'number') {
            return pv.quantity > 0
          }
          if (pv && typeof pv.quantity === 'string') {
            const qty = parseInt(pv.quantity)
            return qty > 0
          }
          if (typeof variant.stockQuantity === 'number') return variant.stockQuantity > 0
          return true
        })
      }
      
      // For non-primary attributes in multi-dependent, show all values for the current step
      if (currentStep <= variantSelectionStep) return true
      
      // For future steps, we can implement more sophisticated filtering later
      return false
    }
    
    return true
  }

  // Get available variants based on current selections
  const getAvailableVariants = (): ProductVariant[] => {
    if (!displayProduct?.variants) return []
    
    if (displayProduct.variantConfig?.type === 'simple' && !displayProduct.variantConfig.primaryAttribute) {
      return displayProduct.variants
    }
    
    if (displayProduct.variantConfig?.type === 'primary-dependent') {
      const primaryAttribute = displayProduct.variantConfig.primaryAttribute
      if (!primaryAttribute || !selectedAttributes[primaryAttribute]) {
        return displayProduct.variants
      }
      
      // For primary-dependent logic, return variants that have the selected primary value
      return displayProduct.variants.filter((variant: any) => {
        if (variant.primaryValues) {
          return variant.primaryValues.some((primaryValue: any) => 
            primaryValue.value === selectedAttributes[primaryAttribute]
          )
        }
        return variant.attributes && variant.attributes[primaryAttribute] === selectedAttributes[primaryAttribute]
      })
    }
    
    if (displayProduct.variantConfig?.type === 'simple' && displayProduct.variantConfig.primaryAttribute) {
      const primaryAttribute = displayProduct.variantConfig.primaryAttribute
      if (!selectedAttributes[primaryAttribute]) {
        return displayProduct.variants
      }
      
      // For simple logic with primaryValues, return variants that have the selected primary value
      return displayProduct.variants.filter((variant: any) => {
        if (variant.primaryValues) {
          return variant.primaryValues.some((primaryValue: any) => 
            primaryValue.value === selectedAttributes[primaryAttribute]
          )
        }
        return variant.attributes && variant.attributes[primaryAttribute] === selectedAttributes[primaryAttribute]
      })
    }
    
    if (displayProduct.variantConfig?.type === 'multi-dependent') {
      return displayProduct.variants.filter((variant: any) => {
        if (typeof variant.stockQuantity === 'number' && variant.stockQuantity <= 0) return false
        return Object.entries(selectedAttributes).every(([key, value]) => {
          if (Array.isArray(value)) {
            return value.some(v => variant.attributes && variant.attributes[key] === v)
          }
          return variant.attributes && variant.attributes[key] === value
        })
      })
    }
    
    return displayProduct.variants
  }

  // Calculate quantity based on selected attributes
  const calculateQuantityFromSelections = (): number => {
    let totalQuantity = 1
    
    Object.entries(selectedAttributes).forEach(([attribute, value]) => {
      const isPrimary = displayProduct?.variantConfig?.type === 'primary-dependent' && 
                       attribute === displayProduct.variantConfig.primaryAttribute
      
      if (!isPrimary && Array.isArray(value) && value.length > 0) {
        // For non-primary attributes, multiply by number of selections
        totalQuantity *= value.length
      }
    })
    
    return Math.max(1, totalQuantity)
  }

  // Helper function to generate cartesian product combinations
  const generateCombinations = (selections: { [key: string]: string[] }): { [key: string]: string }[] => {
    const attributes = Object.keys(selections)
    if (attributes.length === 0) return []
    
    const generateCombinationsRecursive = (currentIndex: number, currentCombination: { [key: string]: string }): { [key: string]: string }[] => {
      if (currentIndex === attributes.length) {
        return [currentCombination]
      }
      
      const attribute = attributes[currentIndex]
      const values = selections[attribute]
      const combinations: { [key: string]: string }[] = []
      
      values.forEach(value => {
        const newCombination = { ...currentCombination, [attribute]: value }
        combinations.push(...generateCombinationsRecursive(currentIndex + 1, newCombination))
      })
      
      return combinations
    }
    
    return generateCombinationsRecursive(0, {})
  }

  // Calculate total price for current selection (MEMOIZED for performance)
  const calculateTotalPrice = useMemo((): number => {
    // Use the main quantity state if user has manually changed it, otherwise use calculated quantity
    const selectedQuantity = quantity
    
    // For Multi-Dependent logic: calculate cartesian product of primary attribute prices
    if (displayProduct?.variantConfig?.type === 'multi-dependent' && 
        displayProduct.variantConfig.primaryAttributes) {
      
      // Get all selected primary attribute values
      const primaryAttributeSelections: { [key: string]: string[] } = {}
      let hasPrimarySelections = false
      
      displayProduct.variantConfig.primaryAttributes.forEach((primaryAttr: string) => {
        const selectedValues = selectedAttributes[primaryAttr]
        if (selectedValues) {
          const values = Array.isArray(selectedValues) ? selectedValues : [selectedValues]
          if (values.length > 0) {
            primaryAttributeSelections[primaryAttr] = values
            hasPrimarySelections = true
          }
        }
      })
      
      if (hasPrimarySelections) {
        // Generate all possible combinations (cartesian product)
        const combinations = generateCombinations(primaryAttributeSelections)
        
        // Calculate total price for all combinations
        let totalPrice = 0
        combinations.forEach((combination: { [key: string]: string }) => {
          let combinationPrice = 0
          
          Object.entries(combination).forEach(([attr, value]) => {
            // Find the price for this attribute-value combination
            const variantWithPrimaryValue = displayProduct.variants?.find((variant: any) => 
              variant.primaryValues?.some((pv: any) => 
                pv.value === value && pv.attribute === attr
              )
            )
            
            if (variantWithPrimaryValue) {
              const primaryValueObj = variantWithPrimaryValue.primaryValues?.find((pv: any) => 
                pv.value === value && pv.attribute === attr
              )
              if (primaryValueObj && (primaryValueObj as any).price) {
                combinationPrice += parseFloat((primaryValueObj as any).price)
              }
            }
          })
          
          totalPrice += combinationPrice
        })
        
        return totalPrice
      }
    }
    
    // For Primary-Dependent logic: use single primary attribute price
    if (displayProduct?.variantConfig?.type === 'primary-dependent' && 
        displayProduct.variantConfig.primaryAttribute && 
        selectedAttributes[displayProduct.variantConfig.primaryAttribute]) {
      
      const primaryValue = selectedAttributes[displayProduct.variantConfig.primaryAttribute] as string
      const variantWithPrimaryValue = displayProduct.variants?.find((variant: any) => 
        variant.primaryValues?.some((pv: any) => pv.value === primaryValue)
      )
      
      if (variantWithPrimaryValue) {
        const primaryValueObj = variantWithPrimaryValue.primaryValues?.find((pv: any) => pv.value === primaryValue) as { attribute: string; value: string; price?: string } | undefined
        if (primaryValueObj && primaryValueObj.price) {
          return parseFloat(primaryValueObj.price) * selectedQuantity
        }
      }
    }
    
    // For Simple logic with primaryValues: use single primary attribute price
    if (displayProduct?.variantConfig?.type === 'simple' && 
        displayProduct.variantConfig.primaryAttribute && 
        selectedAttributes[displayProduct.variantConfig.primaryAttribute]) {
      
      const primaryValue = selectedAttributes[displayProduct.variantConfig.primaryAttribute] as string
      const variantWithPrimaryValue = displayProduct.variants?.find((variant: any) => 
        variant.primaryValues?.some((pv: any) => pv.value === primaryValue)
      )
      
      if (variantWithPrimaryValue) {
        const primaryValueObj = variantWithPrimaryValue.primaryValues?.find((pv: any) => pv.value === primaryValue) as { attribute: string; value: string; price?: string } | undefined
        if (primaryValueObj && primaryValueObj.price) {
          return parseFloat(primaryValueObj.price) * selectedQuantity
        }
      }
    }
    
    // If no primary attribute or no primary attribute selected, use main product price
    return (product?.price || 0) * selectedQuantity
  }, [displayProduct?.variantConfig, displayProduct?.variants, selectedAttributes, quantity, product?.price])

  // Initialize variant selection
  useEffect(() => {
    if (displayProduct?.variants && displayProduct.variants.length > 0) {
      // For simple logic OR when variantConfig is missing, select the first variant
      if (!displayProduct.variantConfig || displayProduct.variantConfig?.type === 'simple') {
        setSelectedVariant(displayProduct.variants[0])
        setSelectedAttributes(displayProduct.variants[0].attributes || {})
      }
      // For other logic types, don't auto-select - let user choose
    }
  }, [displayProduct?.variants, displayProduct?.variantConfig])

  // Update selected variant when attributes change
  useEffect(() => {
    
    if (!displayProduct?.variants || Object.keys(selectedAttributes).length === 0) {
      return
    }
    
    let matchingVariant = null
    
    // For primary-dependent logic, prioritize finding variant with primary attribute
    if (displayProduct.variantConfig?.type === 'primary-dependent' && 
        displayProduct.variantConfig.primaryAttribute && 
        selectedAttributes[displayProduct.variantConfig.primaryAttribute]) {
      
      const primaryValue = selectedAttributes[displayProduct.variantConfig.primaryAttribute]
      matchingVariant = displayProduct.variants.find((variant: any) => 
        variant.primaryValues?.some((pv: any) => pv.value === primaryValue)
      )
    } else {
      // For other logic types, match all attributes
      matchingVariant = displayProduct.variants.find((variant: any) => {
        return Object.entries(selectedAttributes).every(([key, value]) => {
          // Handle multi-value attributes
          if (variant.multiValues?.[key]) {
            return variant.multiValues[key].includes(value as string)
          }
          
          // Handle multiple selections for non-primary attributes
          if (Array.isArray(value)) {
            return value.some(v => variant.attributes && variant.attributes[key] === v)
          }
          
          return variant.attributes && variant.attributes[key] === value
        })
      })
    }
    
    if (matchingVariant) {
      setSelectedVariant(matchingVariant)
      setMainImage(matchingVariant.image || null)
    } else {
      setSelectedVariant(null)
    }
  }, [selectedAttributes, displayProduct?.variants])

  // Update quantity when selections change
  useEffect(() => {
    const newQuantity = calculateQuantityFromSelections()
    // For products under 500 TZS, ensure minimum quantity is 5
    const finalQuantity = product && product.price < 500 ? Math.max(5, newQuantity) : newQuantity
    setQuantity(finalQuantity)
  }, [selectedAttributes, product])

  // Initialize individual quantities when attributes are selected
  useEffect(() => {
    const combinations = generateAttributeCombinations(selectedAttributes)
    if (combinations.length > 1) {
      const newIndividualQuantities: { [key: string]: number } = {}
      combinations.forEach(combination => {
        const combinationKey = Object.entries(combination).map(([key, value]) => `${key}:${value}`).join('-')
        newIndividualQuantities[combinationKey] = quantity
      })
      setIndividualQuantities(newIndividualQuantities)
    }
  }, [selectedAttributes, quantity])

  // Helper function to generate attribute combinations
  const generateAttributeCombinations = (attributes: Record<string, any>): Record<string, string>[] => {
    const entries = Object.entries(attributes).filter(([key, value]) => value !== undefined && value !== null && value !== '')
    
    if (entries.length === 0) return []
    if (entries.length === 1) {
      const [key, value] = entries[0]
      const values = Array.isArray(value) ? value : [value]
      return values.map(v => ({ [key]: v }))
    }
    
    // Generate cartesian product for multiple attributes
    const combinations: Record<string, string>[] = []
    const generateCombinations = (index: number, current: Record<string, string>) => {
      if (index === entries.length) {
        combinations.push({ ...current })
        return
      }
      
      const [key, value] = entries[index]
      const values = Array.isArray(value) ? value : [value]
      
      values.forEach(v => {
        generateCombinations(index + 1, { ...current, [key]: v })
      })
    }
    
    generateCombinations(0, {})
    return combinations
  }

  // Helper function to calculate price for a combination (MEMOIZED for performance)
  const calculatePriceForCombination = useCallback((combination: Record<string, string>): number => {
    // Check if any attribute is a primary attribute with price
    for (const [attribute, value] of Object.entries(combination)) {
      if (displayProduct.variantConfig?.primaryAttribute === attribute) {
        const variantWithPrimaryValue = displayProduct.variants?.find((variant: any) => 
          variant.primaryValues?.some((pv: any) => pv.value === value)
        )
        if (variantWithPrimaryValue) {
          const primaryValueObj = variantWithPrimaryValue.primaryValues?.find((pv: any) => pv.value === value) as { attribute: string; value: string; price?: string } | undefined
          if (primaryValueObj?.price) {
            return parseFloat(primaryValueObj.price)
          }
        }
      }
    }
    
    // Fallback to main product price
    return displayProduct?.price || 0
  }, [displayProduct?.variantConfig, displayProduct?.variants, displayProduct?.price])

  const handleAttributeSelect = (attributeType: string, value: string) => {
    setSelectedAttributes(prev => {
      const isPrimary = displayProduct?.variantConfig?.type === 'primary-dependent' && 
                       attributeType === displayProduct.variantConfig.primaryAttribute
      const isSimplePrimary = displayProduct?.variantConfig?.type === 'simple' && 
                             attributeType === displayProduct.variantConfig.primaryAttribute
      const isMultiDependentPrimary = displayProduct?.variantConfig?.type === 'multi-dependent' && 
                                     displayProduct.variantConfig.primaryAttributes?.includes(attributeType)
      
      if ((isPrimary || isSimplePrimary) && !isMultiDependentPrimary) {
        // Primary attributes in Primary-Dependent and Simple logic: single selection only
        if (prev[attributeType] === value) {
          const newAttributes = { ...prev }
          delete newAttributes[attributeType]
          return newAttributes
        }
        return {
          ...prev,
          [attributeType]: value
        }
      } else {
        // All other attributes (including Multi-Dependent primary attributes): multiple selection allowed
        const currentValues = Array.isArray(prev[attributeType]) ? prev[attributeType] : 
                            prev[attributeType] ? [prev[attributeType]] : []
        
        if (currentValues.includes(value)) {
          // Remove value if already selected
          const newValues = currentValues.filter(v => v !== value)
          return {
            ...prev,
            [attributeType]: newValues.length > 0 ? newValues : undefined
          }
        } else {
          // Add value to selection
          return {
            ...prev,
            [attributeType]: [...currentValues, value]
          }
        }
      }
    })
    
    // For multi-dependent logic, advance to next step
    if (displayProduct?.variantConfig?.type === 'multi-dependent') {
      const attributeOrder = displayProduct.variantConfig.attributeOrder || []
      const currentStep = attributeOrder.indexOf(attributeType)
      if (currentStep >= 0 && currentStep < attributeOrder.length - 1) {
        setVariantSelectionStep(currentStep + 1)
      }
    }
  }

  // Get current price, image, etc. based on selected variant
  const getCurrentPrice = (): number => {
    
    
    if (!selectedVariant) {
      const fallbackPrice = product?.price || 0
      return fallbackPrice
    }
    
    // For primary-dependent logic with primary values
    if (displayProduct?.variantConfig?.type === 'primary-dependent' && 
        displayProduct.variantConfig.primaryAttribute && 
        selectedAttributes[displayProduct.variantConfig.primaryAttribute]) {
      
      const selectedPrimaryValue = selectedAttributes[displayProduct.variantConfig.primaryAttribute] as string
      
      // Find the variant that contains this primary value
      const variantWithPrimaryValue = displayProduct.variants?.find((variant: any) => 
        variant.primaryValues?.some((pv: any) => pv.value === selectedPrimaryValue)
      )
      
      
      if (variantWithPrimaryValue) {
        const primaryValue = variantWithPrimaryValue.primaryValues?.find((pv: any) => pv.value === selectedPrimaryValue) as { attribute: string; value: string; price?: string } | undefined
        if (primaryValue && primaryValue.price) {
          const primaryPrice = parseFloat(primaryValue.price) || variantWithPrimaryValue.price || product?.price || 0
          return primaryPrice
        }
      }
    }
    
    const finalPrice = selectedVariant.price || product?.price || 0
    return finalPrice
  }

  const currentPrice = getCurrentPrice() || 0
  const currentOriginalPrice = selectedVariant?.price || product?.originalPrice || 0
  
  // Find matching variant image for the selected attributes
  const matchingVariantImage = findMatchingVariantImage(selectedAttributes)
  
  // Get only variant images for thumbnail gallery (no main product image)
  const getAllThumbnailImages = useCallback(() => {
    const images: string[] = []
    // Add only variant images (no main product image in thumbnails)
    variantImages.forEach((variantImg) => {
      if (variantImg.imageUrl && variantImg.imageUrl.trim() !== '') {
        images.push(variantImg.imageUrl)
      }
    })
    // Remove duplicates
    const uniqueImages = [...new Set(images)]
    return uniqueImages
  }, [variantImages])

  const thumbnailImages = useMemo(() => getAllThumbnailImages(), [getAllThumbnailImages])
  
  // Compute thumbnails before deriving currentImage (declare helper first)

  // Main image shows clicked thumbnail, or first thumbnail when available, or matching variant image when variant is selected; falls back to main product image
  const currentImage = (() => {
    // If user clicked a thumbnail, show that image
    if (mainImage) {
      return mainImage
    }
    
    // If any attributes are selected, try to find a matching variant image
    if (Object.keys(selectedAttributes).length > 0 && matchingVariantImage) {
      return matchingVariantImage
    }
    
    // Prefer the first thumbnail if available
    if (thumbnailImages.length > 0) {
      return thumbnailImages[0]
    }
    
    // When no thumbnails exist, show main product image
    if (product?.image && product.image.trim() !== '') {
      return product.image
    }
    
    return null
  })()
  
  // (helper declared once above)
  
  // Reset manual selection when attributes change (allow auto-update again)
  useEffect(() => {
    setIsManualImageSelection(false)
  }, [selectedAttributes])

  // Auto-update main image when attributes or thumbnails change (but not when user manually selects a thumbnail)
  useEffect(() => {
    // Don't auto-update if user has manually selected an image
    if (isManualImageSelection) {
      return
    }

    // If attributes are selected, try to find matching variant image
    if (Object.keys(selectedAttributes).length > 0) {
      if (matchingVariantImage) {
        // Auto-update to matching variant image
        setMainImage(matchingVariantImage)
      }
      // If no matching variant image found, keep current image (don't reset to main)
    } else {
      // No attributes selected: prefer first thumbnail, else main product image
      if (thumbnailImages.length > 0) {
        setMainImage(thumbnailImages[0])
    } else if (product?.image) {
      setMainImage(product.image)
      } else {
        setMainImage(null)
    }
    }
  }, [selectedAttributes, matchingVariantImage, product?.image, thumbnailImages, isManualImageSelection])
  
  const currentSKU = selectedVariant?.sku || product?.sku || ""
  const currentModel = selectedVariant?.model || product?.model || ""

  // Check if all required attributes are selected
  const isSelectionComplete = (): boolean => {
    if (!displayProduct?.variants || displayProduct.variants.length === 0) return true
    
    if (displayProduct.variantConfig?.type === 'simple') {
      return Object.keys(selectedAttributes).length > 0
    }
    
    if (displayProduct.variantConfig?.type === 'primary-dependent') {
      const primaryAttribute = displayProduct.variantConfig.primaryAttribute
      return primaryAttribute ? !!selectedAttributes[primaryAttribute] : true
    }
    
    if (displayProduct.variantConfig?.type === 'multi-dependent') {
      const attributeOrder = displayProduct.variantConfig.attributeOrder || []
      return attributeOrder.every((attr: string) => selectedAttributes[attr])
    }
    
    return true
  }

  // Get the next attribute to select for multi-dependent logic
  const getNextAttributeToSelect = (): string | null => {
    if (displayProduct?.variantConfig?.type !== 'multi-dependent') return null
    
    const attributeOrder = displayProduct?.variantConfig?.attributeOrder || []
    for (let i = 0; i < attributeOrder.length; i++) {
      if (!selectedAttributes[attributeOrder[i]]) {
        return attributeOrder[i]
      }
    }
    return null
  }

  // Check if the currently selected product/variant is in the cart
  const productInCart = useMemo(() => {
    return product ? isInCart(product.id, selectedVariant?.id) : false
  }, [isInCart, product?.id, selectedVariant?.id])

  const [activeTab, setActiveTab] = useState<"specifications" | "reviews" | "qna" | "shipping" | "warranty">(
    "specifications",
  )

  // REMOVED EARLY RETURNS - they violate Rules of Hooks
  // Loading and not-found states are now handled at the end, after all hooks

  const discountPercentage = currentOriginalPrice && currentPrice && currentOriginalPrice > currentPrice 
    ? ((currentOriginalPrice - currentPrice) / currentOriginalPrice) * 100 
    : 0


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
      
      return Math.max(minQuantity, newQuantity)
    })
  }

  // Handle individual quantity changes for each combination
  const handleIndividualQuantityChange = (combinationKey: string, delta: number) => {
    setIndividualQuantities(prev => {
      const currentQty = prev[combinationKey] || quantity
      const newQty = currentQty + delta
      
      // For products under 500 TZS, minimum quantity is 5
      const minQuantity = product && product.price < 500 ? 5 : 1
      
      // If trying to go below minimum for low-price products, show modal
      if (product && product.price < 500 && newQty < 5 && delta < 0) {
        setIsQuantityLimitModalOpen(true)
        return prev // Don't change quantity
      }
      
      const finalQty = Math.max(minQuantity, newQty)
      const newQuantities = {
        ...prev,
        [combinationKey]: finalQty
      }
      
      return newQuantities
    })
  }

  // Get individual quantity for a combination
  const getIndividualQuantity = (combinationKey: string): number => {
    return individualQuantities[combinationKey] || quantity
  }

  // Calculate true total items based on individual quantities (MEMOIZED for performance)
  const calculateTrueTotalItems = useMemo((): number => {
    const selectedEntries = Object.entries(selectedAttributes).filter(([key, value]) => value !== undefined && value !== null && value !== '')
    
    if (selectedEntries.length === 0) return quantity
    
    // Calculate total combinations
    let totalCombinations = 1
    selectedEntries.forEach(([key, value]) => {
      if (Array.isArray(value)) {
        totalCombinations *= value.length
      } else {
        totalCombinations *= 1
      }
    })
    
    // If individual quantities are set, use them
    if (Object.keys(individualQuantities).length > 0) {
      const combinations = generateAttributeCombinations(selectedAttributes)
      return combinations.reduce((total, combination) => {
        const combinationKey = Object.entries(combination).map(([key, value]) => `${key}:${value}`).join('-')
        return total + getIndividualQuantity(combinationKey)
      }, 0)
    }
    
    // Otherwise, multiply quantity by number of combinations
    return quantity * totalCombinations
  }, [selectedAttributes, quantity, individualQuantities])

  // Auto-select the first option for each attribute on initial load
  useEffect(() => {
    if (!displayProduct?.variants || displayProduct.variants.length === 0) {
      return
    }
    if (!attributeTypes || attributeTypes.length === 0) {
      return
    }
    
    // Only auto-select once
    if (hasAutoSelected) {
      return
    }

    // Only initialize once when nothing is selected yet
    const hasAnySelection = Object.values(selectedAttributes).some(v => v !== undefined && v !== null && v !== '')
    if (hasAnySelection) {
      return
    }

    const initialSelection: { [key: string]: string | string[] } = {}
    attributeTypes.forEach((attrType: string) => {
      const values = getAttributeValues(attrType)
      if (values.length > 0) {
        initialSelection[attrType] = values[0]
      }
    })

    if (Object.keys(initialSelection).length > 0) {
      setSelectedAttributes(initialSelection)
      setHasAutoSelected(true)
    }
  }, [displayProduct?.variants, attributeTypes, hasAutoSelected])

  // Get the current unit price based on selected attributes (MEMOIZED for performance)
  const getCurrentUnitPrice = useMemo((): number => {
    if (displayProduct?.variantConfig?.type === 'primary-dependent' && 
        displayProduct.variantConfig.primaryAttribute && 
        selectedAttributes[displayProduct.variantConfig.primaryAttribute]) {
      const primaryValue = selectedAttributes[displayProduct.variantConfig.primaryAttribute] as string
      const variantWithPrimaryValue = displayProduct.variants?.find((variant: any) => 
        variant.primaryValues?.some((pv: any) => pv.value === primaryValue)
      )
      if (variantWithPrimaryValue) {
        const primaryValueObj = variantWithPrimaryValue.primaryValues?.find((pv: any) => pv.value === primaryValue) as { attribute: string; value: string; price?: string } | undefined
        return primaryValueObj?.price ? parseFloat(primaryValueObj.price) : product?.price || 0
      }
    }
    return product?.price || 0
  }, [displayProduct?.variantConfig, displayProduct?.variants, selectedAttributes, product?.price])

  // Calculate true total price based on individual quantities (MEMOIZED for performance)
  const calculateTrueTotalPrice = useMemo((): number => {
    const selectedEntries = Object.entries(selectedAttributes).filter(([key, value]) => value !== undefined && value !== null && value !== '')
    
    if (selectedEntries.length === 0) return calculateTotalPrice
    
    // Calculate total combinations
    let totalCombinations = 1
    selectedEntries.forEach(([key, value]) => {
      if (Array.isArray(value)) {
        totalCombinations *= value.length
      } else {
        totalCombinations *= 1
      }
    })
    
    // If individual quantities are set, use them
    if (Object.keys(individualQuantities).length > 0) {
      const combinations = generateAttributeCombinations(selectedAttributes)
      return combinations.reduce((total, combination) => {
        const combinationKey = Object.entries(combination).map(([key, value]) => `${key}:${value}`).join('-')
        const qty = getIndividualQuantity(combinationKey)
        const unitPrice = calculatePriceForCombination(combination)
        return total + (unitPrice * qty)
      }, 0)
    }
    
    // Otherwise, calculate based on combinations
    const unitPrice = getCurrentUnitPrice
    return unitPrice * quantity * totalCombinations
  }, [selectedAttributes, calculateTotalPrice, individualQuantities, getCurrentUnitPrice, quantity, calculatePriceForCombination])

  const handleAddToCart = () => {
    
    // Validate that selected attributes have sufficient quantity
    if (displayProduct?.variants && Object.keys(selectedAttributes).length > 0) {
      for (const [attrType, attrValue] of Object.entries(selectedAttributes)) {
        if (attrValue && typeof attrValue === 'string') {
          if (!isAttributeValueAvailable(attrType, attrValue)) {
            toast({
              title: "Out of Stock",
              description: `The selected option "${attrType}: ${attrValue}" is currently unavailable.`,
              variant: "destructive",
            })
            return
          }
        }
      }
    }
    
    // Check if product has variants/attributes
    const hasVariants = displayProduct?.variants && displayProduct.variants.length > 0
    const hasAttributes = displayProduct?.variantConfig && Object.keys(displayProduct.variantConfig).length > 0
    
    
    if (hasVariants || hasAttributes) {
      // Product has variants/attributes - auto-select first options if none selected
      const currentSelectedCount = Object.entries(selectedAttributes).filter(([key, value]) => 
        value !== undefined && value !== null && value !== ''
      ).length
      
      
      if (currentSelectedCount === 0) {
        // If no attribute types available, treat as simple product
        if (attributeTypes.length === 0) {
          const fallbackPrice = getCurrentUnitPrice
          
          addItem(product.id, quantity, undefined, {}, fallbackPrice)
          
          return
        }
        
        // No attributes selected - auto-select first option for each attribute
        const newSelectedAttributes: { [key: string]: string | string[] } = {}
        
        // Get all attribute types
        // Auto-select first option for each attribute type
        attributeTypes.forEach((attrType: string) => {
          const values = getAttributeValues(attrType)
          if (values.length > 0) {
            newSelectedAttributes[attrType] = values[0] // Select first option
          }
        })
        
        // Update selected attributes
        setSelectedAttributes(newSelectedAttributes)
        
        // Use the new attributes for adding to cart
        const combinations = generateAttributeCombinations(newSelectedAttributes)
        
        if (combinations.length > 0) {
          // Add the first combination to cart
          const firstCombination = combinations[0]
          const combinationKey = Object.entries(firstCombination).map(([key, value]) => `${key}:${value}`).join('-')
          const unitPrice = calculatePriceForCombination(firstCombination)
          const variantId = `combination-0-${combinationKey}`
          
          addItem(
            product.id,
            quantity,
            variantId,
            firstCombination,
            unitPrice,
            undefined, // sku
            undefined  // image
          )
        }
        return
      }
    }
    
    // Check if selection is complete (for products with variants that have some selections)
    if (!isSelectionComplete()) {
      toast({
        title: "Selection Incomplete",
        description: "Please select all required options before adding to cart.",
        variant: "destructive",
      })
      return
    }

    // Check if we have individual quantities set (like in the dialog)
    if (Object.keys(individualQuantities).length > 0) {
      // Generate combinations just like the dialog does
      const combinations = generateAttributeCombinations(selectedAttributes)
      
      let totalItemsAdded = 0
      let totalPrice = 0
      
      // Add each combination as a separate cart item
      combinations.forEach((combination, index) => {
        const combinationKey = Object.entries(combination).map(([key, value]) => `${key}:${value}`).join('-')
        const qty = getIndividualQuantity(combinationKey)
        const unitPrice = calculatePriceForCombination(combination)
        
        if (qty > 0) {
          // Create a unique variant ID for this combination
          const variantId = `combination-${index}-${combinationKey}`
          
          addItem(
            product.id,
            qty,
            variantId,
            combination,
            unitPrice,
            undefined, // sku
            undefined  // image
          )
          
          totalItemsAdded += qty
          totalPrice += unitPrice * qty
        }
      })
      
      // Toast notification handled by cart hook
      
    } else {
      // Check if this is a simple product with no variants/attributes
      if (!hasVariants && !hasAttributes) {
        // Simple product: add as single item with quantity
        const fallbackPrice = getCurrentUnitPrice
        
        // Add to cart immediately (optimistic update)
        addItem(product.id, quantity, undefined, {}, fallbackPrice)
        
        // Toast notification handled by cart hook
        return
      }
      
      // Simple case: single item with base quantity
      // If we have selected attributes, use them even if selectedVariant is null
      if (Object.keys(selectedAttributes).length > 0) {
        
        const variantAttributes: { [key: string]: string | string[] } = {}
        
        // Add selected attributes
        Object.entries(selectedAttributes).forEach(([key, value]) => {
          if (value) {
            variantAttributes[key] = value
          }
        })
        
        // Add variant-specific attributes if we have a selected variant
        if (selectedVariant?.attributes) {
          Object.entries(selectedVariant.attributes).forEach(([key, value]) => {
            if (value && !variantAttributes[key]) {
              variantAttributes[key] = String(value)
            }
          })
        }
        
        const currentPrice = getCurrentUnitPrice
        const combinationKey = Object.entries(variantAttributes).map(([key, value]) => `${key}:${value}`).join('-')
        const variantId = selectedVariant?.id || `combination-0-${combinationKey}`
        
        
        // Add to cart immediately (optimistic update)
        addItem(
          product.id, 
          quantity, 
          variantId,
          variantAttributes,
          currentPrice,
          selectedVariant?.sku,
          selectedVariant?.image
        )
        
        
        // Toast notification handled by cart hook
      } else {
        
        const fallbackPrice = getCurrentUnitPrice
        
        // Fallback: add product without variant
        // Add to cart immediately (optimistic update)
        addItem(product.id, quantity, undefined, {}, fallbackPrice)
        
        // Toast notification handled by cart hook
      }
    }
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
    setQuantity(100) // Auto-insert 100 items
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

  const handleSetPriceAlert = () => {
    if (priceAlertTarget <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid target price.",
      })
      return
    }

    // Here you would typically save to database
    // For now, we'll just show a success message
    setHasPriceAlert(true)
    setIsPriceAlertDialogOpen(false)
    
    toast({
      title: "Price Alert Set!",
      description: `You'll be notified when ${product?.name} drops to ${formatPrice(priceAlertTarget)}`,
    })
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
  
  // Show loading state (after all hooks - respects Rules of Hooks)
  if (isProductLoading) {
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
            <h1 className={cn("text-xl font-semibold", themeClasses.mainText)}>Loading product...</h1>
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
              "flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-semibold flex-shrink-0",
              darkHeaderFooterClasses.textNeutralPrimary,
            )}
          >
            <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Back to Products</span>
            <span className="sm:hidden">Back</span>
          </Button>

          {/* Logo - Hidden on mobile */}
          <OptimizedLink
            href="/"
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

          {/* Search Bar Container */}
          <div className="flex-1 max-w-2xl mx-2 sm:mx-4 lg:mx-6 xl:mx-8 flex items-center relative">
            <form className="relative flex-1 flex items-center" onSubmit={handleSearch}>
              {/* Search Input */}
              <div className="relative flex-1">
                <Search
                  className={cn(
                    "absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 z-10",
                    darkHeaderFooterClasses.textNeutralSecondaryFixed,
                  )}
                />
                <Input
                  type="search"
                  placeholder="Search for products..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setShowSuggestions(true)
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
                  className={cn(
                    "w-full pl-8 sm:pl-10 pr-16 sm:pr-20 rounded-full h-8 sm:h-10 focus:border-yellow-500 focus:ring-yellow-500 text-xs sm:text-sm",
                    darkHeaderFooterClasses.inputBg,
                    darkHeaderFooterClasses.inputBorder,
                    darkHeaderFooterClasses.textNeutralPrimary,
                    darkHeaderFooterClasses.inputPlaceholder,
                  )}
                />
                
                {/* Search Suggestions */}
                <SearchSuggestions
                  query={searchTerm}
                  onSuggestionClick={handleSuggestionClick}
                  isVisible={showSuggestions && isSearchFocused}
                  className="mt-1"
                />
                
                {/* Camera/Search by Image Button */}
                <button
                  onClick={() => {
                    setSearchModalInitialTab('image')
                    setIsSearchModalOpen(true)
                  }}
                  className={cn(
                    "absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-8 sm:w-8 rounded-full hover:bg-yellow-500/10 hover:text-yellow-500 transition-colors flex items-center justify-center",
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
          <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">


            <Button
              variant="ghost"
              className={cn(
                "hidden sm:flex items-center gap-1",
                darkHeaderFooterClasses.buttonGhostText,
                darkHeaderFooterClasses.buttonGhostHoverBg,
              )}
            >
              <Headphones className="w-5 h-5" />
              <span className="hidden sm:inline">Support</span>
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "hidden sm:flex items-center gap-1",
                darkHeaderFooterClasses.buttonGhostText,
                darkHeaderFooterClasses.buttonGhostHoverBg,
              )}
            >
              <MessageSquareText className="w-5 h-5" />
              <span className="hidden sm:inline">Live Chat</span>
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
                {cartTotalItems > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-orange-500 text-white text-[10px] sm:text-xs font-bold" suppressHydrationWarning>
                    {cartTotalItems > 99 ? '99+' : cartTotalItems}
                </span>
                )}
              </Button>
            </OptimizedLink>

            {/* User Profile - Added to product detail page */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Hi</span>
                  <span className="text-xs font-medium text-neutral-900 dark:text-white truncate max-w-[80px] sm:max-w-[120px]">
                    {(user as any)?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                  </span>
                </div>
                <UserProfile />
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "flex items-center gap-1 sm:gap-2 h-auto py-2 px-1 sm:px-2 ml-1 sm:ml-2 cursor-pointer",
                      "hover:bg-yellow-500/10 hover:text-yellow-500 transition-colors",
                      darkHeaderFooterClasses.buttonGhostText,
                      darkHeaderFooterClasses.buttonGhostHoverBg,
                    )}
                  >
                    <User className="w-4 h-4 sm:w-4 sm:h-4" />
                    <div className="hidden sm:flex flex-col items-start text-xs">
                      <span>Welcome</span>
                      <span className="font-semibold hover:text-yellow-500 transition-colors">Sign in / Register</span>
                    </div>
                    <div className="sm:hidden flex flex-col items-center text-xs">
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Account</span>
                      <span className="font-semibold text-neutral-900 dark:text-white">Sign in</span>
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
                    <ClipboardList className="w-4 h-4 mr-2" /> My Orders
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

      <main className={cn("flex-1 w-full pt-20 pb-4 sm:pt-24 sm:pb-6 lg:pt-24 lg:pb-8 px-2 sm:px-4 lg:px-6 xl:px-8", themeClasses.mainBg)} suppressHydrationWarning>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 xl:gap-12">
          {/* Product Image Gallery */}
          <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:gap-6">
            {/* Thumbnail Gallery (Left on LG screens, Top on SM screens) */}
            <div className="flex flex-col gap-2">
              
            <div
              className={cn(
                "flex flex-row lg:flex-col gap-2 lg:max-h-[500px] lg:w-24 xl:w-28 pb-2 lg:pb-0",
                "transition-all duration-300 ease-in-out", // Add transition
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
                    "relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 lg:w-full lg:h-auto aspect-square overflow-hidden rounded-md border",
                    mainImage === imgUrl ? "border-blue-500 ring-2 ring-blue-500" : themeClasses.cardBorder,
                    cn(themeClasses.cardBg, "hover:bg-opacity-80"),
                  )}
                  onClick={() => {
                    setMainImage(imgUrl)
                    setIsManualImageSelection(true)
                    setMainViewMode('image') // Reset to image view when thumbnail is clicked
                    setShouldAutoplayVideo(false)
                  }}
                >
                  {imgUrl && (
                    <>
                    <LazyImage
                      src={imgUrl}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, 100px"
                      className="object-contain"
                      priority={index === 0} // Priority for first thumbnail
                      quality={80}
                    />
                    </>
                  )}
                  <span className="sr-only">
                    {`Variant image ${index + 1} of ${product.name}`}
                  </span>
                </Button>
              ))}
              </div>
            </div>

            {/* Main Product Image (Right on LG screens, Bottom on SM screens) */}
            <div className="flex-1 flex flex-col gap-3 sm:gap-4">
              <div
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border",
                  themeClasses.cardBorder,
                  themeClasses.cardBg,
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
                
                {/* Discount Badge */}
                {mainViewMode === 'image' && discountPercentage > 0 && (
                  <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-md">
                    -{discountPercentage.toFixed(0)}%
                  </span>
                )}

                {/* View Mode Indicator */}
                {mainViewMode !== 'image' && (
                  <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-md">
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
              <div className="flex items-center justify-center gap-8 mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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

          {/* Product Details */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                backgroundColor === "white" ? "bg-blue-100 text-blue-700" : "bg-blue-900/50 text-blue-300"
              )}>
                <Info className="w-3 h-3" /> Generic
              </span>
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                backgroundColor === "white" ? "bg-green-100 text-green-700" : "bg-green-900/50 text-green-300"
              )}>
                <CheckCircle className="w-3 h-3" /> Verified Seller
              </span>
            </div>
            <h1 className={cn("text-xl sm:text-2xl lg:text-3xl font-bold", themeClasses.mainText)}>{product.name}</h1>
            
            {/* Product Description */}
            {displayProduct?.description && (
              <p className={cn("text-sm sm:text-base leading-relaxed", themeClasses.mainText)}>
                {displayProduct.description}
              </p>
            )}
            
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
              <span className="text-blue-600 hover:underline cursor-pointer">({product.reviews} reviews)</span>
              <span className={cn("hidden sm:inline", themeClasses.textNeutralSecondary)}>|</span>
              <span className="text-blue-600 hover:underline cursor-pointer">Write a review</span>
            </div>
            <div className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
              <span className={themeClasses.textNeutralSecondary}>SKU: {currentSKU}</span>
              <span className={cn("mx-1 sm:mx-2", themeClasses.textNeutralSecondary)}>|</span>
              <span className={themeClasses.textNeutralSecondary}>Model: {currentModel}</span>
              <span className={cn("mx-1 sm:mx-2", themeClasses.textNeutralSecondary)}>|</span>
              <span className={cn("hidden sm:inline", themeClasses.textNeutralSecondary)}>
                {product.views ? product.views.toLocaleString() : '0'} engineers viewed this today
              </span>
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
                {isLoadingFull ? (
                  <span className="flex items-center gap-1 text-gray-500 font-medium">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                    Loading stock status...
                  </span>
                ) : adminProductState.inStock && adminProductState.stockQuantity > 0 ? (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" /> In Stock ({adminProductState.stockQuantity} available)
              </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 font-medium">
                    <X className="w-3 h-3 sm:w-4 sm:h-4" /> Out of Stock
                  </span>
                )}
                {/* Admin Edit Button for Stock Status */}
                {user && (user.role === 'admin' || user.profile?.is_admin) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsStockEditDialogOpen(true)}
                    className="ml-1 h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {/* Dynamic Free Delivery Status */}
              <div className="flex items-center gap-1">
                {adminProductState.freeDelivery ? (
                  <span className={cn("flex items-center gap-1 text-green-600 font-medium", themeClasses.textNeutralSecondary)}>
                <Truck className="w-3 h-3 sm:w-4 sm:h-4" /> Free delivery
              </span>
                ) : (
                  <span className={cn("flex items-center gap-1 text-gray-500", themeClasses.textNeutralSecondary)}>
                    <Truck className="w-3 h-3 sm:w-4 sm:h-4" /> Delivery fee applies
                  </span>
                )}
                {/* Admin Edit Button for Free Delivery */}
                {user && (user.role === 'admin' || user.profile?.is_admin) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFreeDeliveryEditDialogOpen(true)}
                    className="ml-1 h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {/* Dynamic Same Day Delivery Status */}
              <div className="flex items-center gap-1">
                {adminProductState.sameDayDelivery ? (
                  <span className={cn("flex items-center gap-1 text-blue-600 font-medium", themeClasses.textNeutralSecondary)}>
                <CalendarClock className="w-3 h-3 sm:w-4 sm:h-4" /> Same day delivery available
              </span>
                ) : (
                  <span className={cn("flex items-center gap-1 text-gray-500", themeClasses.textNeutralSecondary)}>
                    <CalendarClock className="w-3 h-3 sm:w-4 sm:h-4" /> Standard delivery
                  </span>
                )}
                {/* Admin Edit Button for Same Day Delivery */}
                {user && (user.role === 'admin' || user.profile?.is_admin) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSameDayDeliveryEditDialogOpen(true)}
                    className="ml-1 h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            

            {/* Dynamic Variant Selection UI */}
            {(() => {
              
              // Extract attribute types from variants - handle different data structures
              const attributeTypes = displayProduct.variants?.reduce((types: string[], variant: any) => {
                
                // Check different possible attribute structures
                if (variant.attributes && typeof variant.attributes === 'object') {
                  Object.keys(variant.attributes).forEach(key => {
                    if (!types.includes(key)) {
                      types.push(key)
                    }
                  })
                }
                
                // Also check if attributes are in a different format
                if (variant.primary_attribute && !types.includes(variant.primary_attribute)) {
                  types.push(variant.primary_attribute)
                }
                
                return types
              }, []) || []

              // If no attributes found in variants, try to get them from variantConfig
              if (attributeTypes.length === 0 && displayProduct.variantConfig) {
                if (displayProduct.variantConfig.attributeOrder) {
                  attributeTypes.push(...displayProduct.variantConfig.attributeOrder)
                }
                if (displayProduct.variantConfig.primaryAttribute && !attributeTypes.includes(displayProduct.variantConfig.primaryAttribute)) {
                  attributeTypes.push(displayProduct.variantConfig.primaryAttribute)
                }
              }

              // Helper function to get unique values for an attribute type
              const getAttributeValues = (type: string) => {
                const values = new Set<string>()
                
                // Try to get values from variants
                displayProduct.variants?.forEach((variant: any) => {
                  if (variant.attributes && variant.attributes[type]) {
                    values.add(variant.attributes[type])
                  }
                  // Also check primary_values and multi_values
                  if (variant.primary_values && Array.isArray(variant.primary_values)) {
                    variant.primary_values.forEach((val: any) => {
                      if (typeof val === 'string') {
                        values.add(val)
                      } else if (val && val.value) {
                        values.add(val.value)
                      }
                    })
                  }
                })
                
                // If no values found, try to get from variantConfig
                if (values.size === 0 && displayProduct.variantConfig) {
                  // Add some default values based on the attribute type
                  if (type.toLowerCase().includes('color')) {
                    values.add('Red')
                    values.add('Blue')
                    values.add('Green')
                  } else if (type.toLowerCase().includes('size')) {
                    values.add('Small')
                    values.add('Medium')
                    values.add('Large')
                  } else {
                    values.add('Option 1')
                    values.add('Option 2')
                    values.add('Option 3')
                  }
                }
                
                return Array.from(values)
              }

              // Helper function to handle attribute selection
              const handleAttributeSelect = (type: string, value: string) => {
                  setSelectedAttributes(prev => {
                    const newState = {
                  ...prev,
                  [type]: value
                    }
                    return newState
                  })
              }

              const hasVariants = displayProduct.variants && displayProduct.variants.length > 0
              const hasAttributeTypes = attributeTypes.length > 0
              
              
              return hasVariants && hasAttributeTypes
            })() ? (
              <div className="mt-4 space-y-2">
                <div className="border-t border-neutral-200 pt-2">
                  <h3 className={cn("text-lg font-semibold mb-0", "text-amber-700")}>
                    {displayProduct.variantConfig?.type === 'multi-dependent' ? 'Configure Your Product' : 'Select Your Options'}
                  </h3>
                </div>
                
                {/* Simple Logic: All attributes are independent */}
                {displayProduct.variantConfig?.type === 'simple' && (
                  <div className="space-y-2">
                    {attributeTypes.map((type) => (
                      <div key={type} className="space-y-2">
                        <Label className={cn("text-sm sm:text-base font-semibold capitalize flex items-center gap-2", themeClasses.mainText)}>
                          <span>{type}</span>
                            <span className={cn("text-xs italic text-gray-500", themeClasses.textNeutralSecondary)}>
                              Select your {type.toLowerCase()}
                            </span>
                        </Label>
                        <div className="flex items-center gap-1 sm:gap-2 mt-2 flex-wrap">
                          {getAttributeValues(type).map((value) => {
                              const currentSelection = selectedAttributes[type]
                              const isSelected = Array.isArray(currentSelection) 
                                ? currentSelection.includes(value)
                                : currentSelection === value
                              const isAvailable = isAttributeValueAvailable(type, value)
                              
                              // Check if this is a primary attribute with price
                              const isPrimary = displayProduct.variantConfig?.primaryAttribute === type
                              let actualPrice = null
                              let hasPrice = false
                              
                              if (isPrimary) {
                                const variantWithThisValue = displayProduct.variants?.find((v: any) => 
                                  v.primaryValues?.some((pv: any) => pv.value === value)
                                )
                                if (variantWithThisValue) {
                                  const primaryValue = variantWithThisValue.primaryValues?.find((pv: any) => pv.value === value) as { attribute: string; value: string; price?: string } | undefined
                                  if (primaryValue && primaryValue.price) {
                                    actualPrice = parseFloat(primaryValue.price)
                                    hasPrice = true
                                  }
                                }
                              }
                              
                            return (
                              <Button
                                key={value}
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() => isAvailable ? handleAttributeSelect(type, value) : undefined}
                                disabled={!isAvailable}
                                className={cn(
                                  "relative transition-all duration-200 text-xs px-2 py-1 h-7 border-orange-300 hover:border-orange-400",
                                  isSelected 
                                    ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-md" 
                                    : isAvailable
                                      ? "hover:bg-blue-900 hover:text-white"
                                      : "opacity-50 cursor-not-allowed"
                                )}
                              >
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium">{value}</span>
                                  {isPrimary && hasPrice && actualPrice !== null && (
                                    <span className={cn("text-xs font-bold", isSelected ? "text-blue-100" : "text-orange-600")}>
                                      {formatPrice(actualPrice)}
                                    </span>
                                  )}
                                  {!isAvailable && (
                                    <span className="text-xs text-gray-400">(Unavailable)</span>
                                  )}
                                </div>
                                {isSelected && (
                                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white"></div>
                                )}
                              </Button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Primary-Dependent Logic: One attribute controls pricing */}
                {displayProduct.variantConfig?.type === 'primary-dependent' && (
                  <div className="space-y-2">
                    {attributeTypes.map((type) => {
                      const isPrimary = type === displayProduct.variantConfig?.primaryAttribute
                      
                      return (
                        <div key={type} className="space-y-2">
                          <Label className={cn("text-sm sm:text-base font-semibold capitalize flex items-center gap-2", themeClasses.mainText)}>
                            <span>{type}</span>
                            <span className={cn("text-xs italic text-gray-500", themeClasses.textNeutralSecondary)}>
                              Select your {type.toLowerCase()}
                              </span>
                            {isPrimary && <span className="text-xs text-orange-600 font-medium">(Affects Price)</span>}
                          </Label>
                          <div className="flex items-center gap-1 sm:gap-2 mt-2 flex-wrap">
                                                      {getAttributeValues(type).map((value) => {
                            const isPrimary = type === displayProduct.variantConfig?.primaryAttribute
                            const currentValues = Array.isArray(selectedAttributes[type]) ? selectedAttributes[type] : 
                                                selectedAttributes[type] ? [selectedAttributes[type]] : []
                            const isSelected = isPrimary ? selectedAttributes[type] === value : currentValues.includes(value)
                            const isAvailable = isAttributeValueAvailable(type, value)
                            
                            // For primary attributes, find the actual price from primaryValues
                            let actualPrice = null
                            let hasPrice = false
                              
                              if (isPrimary) {
                                const variantWithThisValue = displayProduct.variants?.find((v: any) => 
                                  v.primaryValues?.some((pv: any) => pv.value === value)
                                )
                                if (variantWithThisValue) {
                                  const primaryValue = variantWithThisValue.primaryValues?.find((pv: any) => pv.value === value) as { attribute: string; value: string; price?: string } | undefined
                                  if (primaryValue && primaryValue.price) {
                                    actualPrice = parseFloat(primaryValue.price)
                                    hasPrice = true
                                  } else {
                                  }
                                } else {
                                }
                              }
                              
                              return (
                                <Button
                                  key={value}
                                  variant={isSelected ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => isAvailable ? handleAttributeSelect(type, value) : undefined}
                                  disabled={!isAvailable}
                                  className={cn(
                                    "relative transition-all duration-200 text-xs px-2 py-1 h-7 border-orange-300 hover:border-orange-400",
                                    isSelected 
                                      ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-md" 
                                      : isAvailable
                                        ? "hover:bg-blue-900 hover:text-white"
                                        : "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-medium">{value}</span>
                                    {isPrimary && hasPrice && actualPrice !== null && (
                                      <span className={cn("text-xs font-bold", isSelected ? "text-blue-100" : "text-orange-600")}>
                                        {formatPrice(actualPrice)}
                              </span>
                                    )}
                                    {!isAvailable && (
                                      <span className="text-xs text-gray-400">(Unavailable)</span>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white"></div>
                            )}
                        </Button>
                              )
                            })}
                    </div>
                  </div>
                      )
                    })}
              </div>
            )}

                {/* Multi-Dependent Logic: Step-by-step selection */}
                {displayProduct.variantConfig?.type === 'multi-dependent' && (
                  <div className="space-y-2">
                    {displayProduct.variantConfig.attributeOrder?.map((type: string, index: number) => {
                      const isCurrentStep = index === variantSelectionStep
                      const isCompleted = selectedAttributes[type]
                      const isAvailable = isCurrentStep || isCompleted
                      
                      return (
                        <div key={type} className={cn("space-y-2", !isAvailable && "opacity-50")}>
                          <Label className={cn("text-sm sm:text-base font-semibold capitalize flex items-center gap-2", themeClasses.mainText)}>
                            <span>{type}</span>
                            <span className={cn("text-xs italic text-gray-500", themeClasses.textNeutralSecondary)}>
                              Select your {type.toLowerCase()}
                            </span>
                            {displayProduct.variantConfig?.primaryAttributes?.includes(type) && (
                              <span className="text-xs text-orange-600 font-medium">(Affects Price)</span>
                            )}
                            {isCurrentStep && <span className="text-xs text-blue-600 font-medium">(Select Next)</span>}
                          </Label>
                          <div className="flex items-center gap-1 sm:gap-2 mt-2 flex-wrap">
                            {getAttributeValues(type).map((value) => {
                              // Handle both single and multiple selections
                              const currentSelections = selectedAttributes[type]
                              const isSelected = Array.isArray(currentSelections) 
                                ? currentSelections.includes(value)
                                : currentSelections === value
                              const isAvailable = isAttributeValueAvailable(type, value)
                              const isPrimary = displayProduct.variantConfig?.primaryAttributes?.includes(type)
                              
                              // For primary attributes, find the price from primaryValues
                              let actualPrice = null
                              let hasPrice = false
                              
                              if (isPrimary) {
                                const variantWithThisValue = displayProduct.variants?.find((v: any) => 
                                  v.primaryValues?.some((pv: any) => pv.value === value)
                                )
                                if (variantWithThisValue) {
                                  const primaryValue = variantWithThisValue.primaryValues?.find((pv: any) => pv.value === value) as { attribute: string; value: string; price?: string } | undefined
                                  if (primaryValue && primaryValue.price) {
                                    actualPrice = parseFloat(primaryValue.price)
                                    hasPrice = true
                                  }
                                }
                              }
                              
                              return (
                                <Button
                                  key={value}
                                  variant={isSelected ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => isAvailable ? handleAttributeSelect(type, value) : undefined}
                                  disabled={!isAvailable}
                                  className={cn(
                                    "relative transition-all duration-200 text-xs px-2 py-1 h-7 border-orange-300 hover:border-orange-400",
                                    isSelected 
                                      ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-md" 
                                      : isAvailable
                                        ? "hover:bg-blue-900 hover:text-white"
                                        : "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <span className="flex items-center gap-1">
                                    {value}
                                    {hasPrice && actualPrice !== null && (
                                      <span className={cn("text-xs font-medium", isSelected ? "text-blue-100" : "text-orange-600")}>
                                        {formatPrice(actualPrice)}
                                      </span>
                                    )}
                                    {!isAvailable && (
                                      <span className="text-xs text-gray-400">(Unavailable)</span>
                                    )}
                                  </span>
                                  {isSelected && (
                                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white"></div>
                                  )}
                                </Button>
                              )
                            })}
                          </div>
                          
                          {!isAvailable && (
                            <div className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
                              Complete previous selections to see available options
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Compact Selection Summary */}
                {Object.keys(selectedAttributes).length > 0 ? (
                  <div 
                    key={`preview-${JSON.stringify(individualQuantities)}-${quantity}`}
                    className={cn("border rounded-lg p-2 sm:p-3 mt-4 shadow-sm", themeClasses.cardBg, themeClasses.cardBorder)}
                  >
                      {/* All items in one row with labels above and values below */}
                      <div className="flex items-end justify-between gap-2">
                        {/* Unit Price */}
                        <div className="text-center flex-1">
                          <div className={cn("text-[10px] sm:text-xs mb-1", themeClasses.textNeutralSecondary)}>Unit Price</div>
                          <div className={cn("text-xs sm:text-sm font-semibold", themeClasses.mainText)}>
                            {formatPrice(getCurrentUnitPrice)}
                        </div>
                      </div>
                        
                        {/* Total Items */}
                        <div className="text-center flex-1">
                          <div className={cn("text-[10px] sm:text-xs mb-1", themeClasses.textNeutralSecondary)}>Total Items</div>
                          <div className={cn("text-xs sm:text-sm font-semibold", themeClasses.mainText)}>
                            {calculateTrueTotalItems}
                      </div>
                    </div>
                        
                        {/* Total Price */}
                        <div className="text-center flex-1">
                          <div className={cn("text-[10px] sm:text-xs mb-1", themeClasses.textNeutralSecondary)}>Total Price</div>
                          <div className={cn("text-sm sm:text-lg font-bold text-green-600", themeClasses.mainText)}>
                            {formatPrice(calculateTrueTotalPrice)}
                        </div>
                      </div>
                      
                        {/* Preview Button */}
                        <div className="flex-1">
                      <Button
                        onClick={() => setIsSelectionPreviewOpen(true)}
                        className={cn(
                              "hover:bg-blue-700 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium w-full",
                          backgroundColor === "white" ? "bg-blue-600" : "bg-blue-700"
                        )}
                      >
                            Preview
                      </Button>
                        </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : displayProduct.variants && displayProduct.variants.length > 0 ? (
              // Fallback: Show variants even if attribute extraction fails
              <div className="mt-4 space-y-4 sm:space-y-6">
                <div className="border-t border-neutral-200 pt-4">
                  <h3 className={cn("text-lg font-semibold mb-3", themeClasses.mainText)}>
                    Available Variants ({displayProduct.variants.length})
                  </h3>
                  <p className={cn("text-sm text-gray-600", themeClasses.textNeutralSecondary)}>
                    Select a variant to add to cart
                  </p>
                </div>
                
                <div className="grid gap-3">
                  {displayProduct.variants.map((variant: any, index: number) => (
                    <div key={variant.id || index} className={cn(
                      "p-3 rounded-lg border cursor-pointer hover:border-blue-500 transition-colors",
                      themeClasses.cardBg,
                      themeClasses.cardBorder,
                      selectedVariant?.id === variant.id ? 
                        (backgroundColor === "white" ? "border-blue-500 bg-blue-50" : "border-blue-500 bg-blue-900/20") : ""
                    )}
                    onClick={() => setSelectedVariant(variant)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {variant.image && (
                            <Image
                              src={variant.image}
                              alt={`Variant ${index + 1}`}
                              width={40}
                              height={40}
                              className="rounded-md object-cover"
                            />
                          )}
                          <div>
                            <p className={cn("font-medium", themeClasses.mainText)}>
                              Variant {index + 1}
                            </p>
                            {variant.sku && (
                              <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                                SKU: {variant.sku}
                              </p>
                            )}
                            {variant.attributes && Object.keys(variant.attributes).length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                {Object.entries(variant.attributes || {}).filter(([key]) => !/^\d+$/.test(key)).map(([key, value]) => (
                                  <span key={key} className="mr-2">
                                    {key}: {String(value)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-semibold text-lg", themeClasses.mainText)}>
                            {formatPrice(variant.price)}
                          </p>
                          {selectedVariant?.id === variant.id && (
                            <div className="text-xs text-blue-600 mt-1">✓ Selected</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedVariant && (
                  <div className={cn(
                    "mt-4 p-4 rounded-lg border",
                    backgroundColor === "white" ? "bg-blue-50 border-blue-200" : "bg-blue-900/20 border-blue-700"
                  )}>
                    <p className={cn("font-medium mb-2", themeClasses.mainText)}>
                      Selected: Variant with SKU {selectedVariant.sku}
                    </p>
                    <p className={cn("text-lg font-bold", themeClasses.mainText)}>
                      Price: {formatPrice(selectedVariant.price)}
                    </p>
                  </div>
                )}
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
                  className={cn(
                    "rounded-none h-8 w-8 sm:h-9 sm:w-9",
                    backgroundColor === "white" 
                      ? "bg-white hover:bg-gray-100 text-neutral-950" 
                      : "bg-gray-800 hover:bg-gray-700 text-white"
                  )}
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>
              <Button 
                variant="ghost" 
                onClick={handleBulkOrderClick}
                className={cn(
                  "flex items-center gap-1 group border border-transparent hover:border-white/20 hover:bg-transparent text-xs sm:text-sm",
                  backgroundColor === "dark" 
                    ? "text-blue-400 hover:text-yellow-500" 
                    : "text-blue-600 hover:bg-blue-50"
                )}
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
                  // First, call handleAddToCart to ensure item is added (with auto-select if needed)
                  handleAddToCart()
                  
                  // Then navigate to cart page after a short delay to ensure cart is updated
                  setTimeout(() => {
                  navigateWithPrefetch('/cart', { priority: 'high' })
                  }, 100)
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
                  "flex items-center gap-2 group border hover:border-white/20 hover:bg-transparent",
                  backgroundColor === "dark" 
                    ? "text-neutral-400 hover:text-yellow-500 border-neutral-600" 
                    : "hover:bg-neutral-100 bg-transparent text-neutral-600 border-neutral-300",
                  isProductInWishlist && "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                )}
                onClick={handleAddToWishlist}
              >
                <Heart className={cn(
                  "w-4 h-4 group-hover:text-yellow-500 transition-colors",
                  backgroundColor === "dark" && "group-hover:text-yellow-500",
                  isProductInWishlist && "fill-red-500 text-red-500"
                )} /> 
                <span className={cn(
                  "group-hover:text-yellow-500 transition-colors",
                  backgroundColor === "dark" && "group-hover:text-yellow-500"
                )}>
                  {isProductInWishlist ? "Remove from Wishlist" : "Add to Wishlist"} ({wishlistItems.length})
                </span>
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "flex items-center gap-2 group border hover:border-white/20 hover:bg-transparent",
                  backgroundColor === "dark" 
                    ? "text-neutral-400 hover:text-yellow-500 border-neutral-600" 
                    : "hover:bg-neutral-100 bg-transparent text-neutral-600 border-neutral-300",
                  isProductInSavedLater && "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                )}
                onClick={handleSaveForLater}
              >
                <Clock className={cn(
                  "w-4 h-4 group-hover:text-yellow-500 transition-colors",
                  backgroundColor === "dark" && "group-hover:text-yellow-500",
                  isProductInSavedLater && "fill-blue-500 text-blue-500"
                )} /> 
                <span className={cn(
                  "group-hover:text-yellow-500 transition-colors",
                  backgroundColor === "dark" && "group-hover:text-yellow-500"
                )}>
                  {isProductInSavedLater ? "Remove from Saved" : "Save for Later"} ({savedLaterItems.length})
                </span>
              </Button>
              <Dialog open={isGiftWrapDialogOpen} onOpenChange={setIsGiftWrapDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex items-center gap-2 group border hover:border-white/20 hover:bg-transparent",
                      backgroundColor === "dark" 
                        ? "text-neutral-400 hover:text-yellow-500 border-neutral-600" 
                        : "hover:bg-neutral-100 bg-transparent text-neutral-600 border-neutral-300"
                    )}
                  >
                    <GiftIcon className={cn(
                      "w-4 h-4 group-hover:text-yellow-500 transition-colors",
                      backgroundColor === "dark" && "group-hover:text-yellow-500"
                    )} /> 
                    <span className={cn(
                      "group-hover:text-yellow-500 transition-colors",
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
                      "flex items-center gap-2 group border hover:border-white/20 hover:bg-transparent",
                      backgroundColor === "dark" 
                        ? "text-neutral-400 hover:text-yellow-500 border-neutral-600" 
                        : "hover:bg-neutral-100 bg-transparent text-neutral-600 border-neutral-300"
                    )}
                  >
                    <SettingsIcon className={cn(
                      "w-4 h-4 group-hover:text-yellow-500 transition-colors",
                      backgroundColor === "dark" && "group-hover:text-yellow-500"
                    )} /> 
                    <span className={cn(
                      "group-hover:text-yellow-500 transition-colors",
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
              <p className={cn("text-sm mb-6 leading-relaxed", themeClasses.mainText)}>{product.description}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {product.specifications && Object.entries(product.specifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-2 px-3 border-b border-opacity-10" style={{ borderColor: backgroundColor === "white" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)" }}>
                    <span className={cn("font-medium text-sm flex-shrink-0", themeClasses.mainText)}>{String(key)}:</span>
                    <span className={cn("text-sm text-right break-words ml-2", themeClasses.textNeutralSecondary)}>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="bg-transparent p-4 sm:p-6">
              <h2 className={cn("text-xl font-bold mb-4", themeClasses.mainText)}>
                Customer Reviews ({product.reviews})
              </h2>
              <p className={cn("text-sm leading-relaxed", themeClasses.textNeutralSecondary)}>
                No reviews yet. Be the first to write a review!
              </p>
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
                  <span className={cn("text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full", themeClasses.mainText)}>30 Days</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Related Products Section */}
      <section className="py-8 border-t w-full">
        <div className="w-full px-1 sm:px-2 lg:px-3">
          <div className="flex items-center justify-between mb-6">
            <h2 className={cn("text-xl font-bold", themeClasses.mainText)}>You May Also Like</h2>
            <OptimizedLink 
              href={returnTo} 
              prefetch="hover"
              priority="medium"
              className={cn("text-sm font-medium hover:underline", themeClasses.textNeutralSecondary)}
            >
              View All Products
            </OptimizedLink>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1 sm:gap-3 md:gap-4 w-full">
            {rotatedRelatedProducts.map((relatedProduct: any) => {
                const discountPercentage = ((relatedProduct.originalPrice - relatedProduct.price) / relatedProduct.originalPrice) * 100
                return (
                  <Card
                    key={relatedProduct.id}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-sm w-full",
                      themeClasses.cardBg,
                      themeClasses.mainText,
                      themeClasses.cardBorder,
                    )}
                  >
                    <OptimizedLink 
                      href={`/products/${relatedProduct.id}-${encodeURIComponent(relatedProduct.slug || relatedProduct.name || 'product')}?returnTo=${encodeURIComponent(returnTo)}`} 
                      className="block relative aspect-square overflow-hidden"
                      prefetch="hover"
                      priority="medium"
                    >
                      {relatedProduct.image && (
                        <LazyImage
                          src={relatedProduct.image}
                          alt={relatedProduct.name}
                          fill
                          sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, (max-width: 1280px) 16vw, (max-width: 1536px) 14vw, 12vw"
                          className="object-cover transition-transform duration-300 hover:scale-105"
                          priority={false} // Not priority since it's below the fold
                          quality={80}
                        />
                      )}
                      {/* Delivery Badges - Top Left */}
                      <div className="absolute top-1 left-1 sm:top-2 sm:left-2 z-10 flex flex-col gap-0.5 sm:gap-1">
                        {relatedProduct.freeDelivery && (
                          <span className="bg-green-500 text-white text-[8px] sm:text-[10px] px-0.5 sm:px-1 py-0.5 rounded-none shadow-sm sm:shadow-md">
                            Free Delivery
                          </span>
                        )}
                        {relatedProduct.sameDayDelivery && (
                          <span className="bg-blue-500 text-white text-[9px] sm:text-[10px] px-0.5 sm:px-1 py-0.5 rounded-none shadow-sm sm:shadow-md">
                            Same Day
                          </span>
                        )}
                      </div>
                      
                      {/* Single Badge on Right */}
                      <div className="absolute top-0 right-0 sm:top-0 sm:right-1.5 z-10">
                        {relatedProduct.reviews > 1000 ? (
                          <span className="bg-black/60 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-none shadow-sm sm:shadow-md">
                            Popular
                          </span>
                        ) : relatedProduct.id > 10 ? (
                          <span className="bg-black/60 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-none shadow-sm sm:shadow-md">
                            New
                          </span>
                        ) : discountPercentage > 0 ? (
                          <span className="bg-black/60 text-white text-[8px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-none shadow-sm sm:shadow-md">
                            {discountPercentage.toFixed(0)}% OFF
                          </span>
                        ) : (
                          <span className="bg-black/60 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-none shadow-sm sm:shadow-md">
                            Free Shipping
                          </span>
                        )}
                      </div>
                    </OptimizedLink>
                    <CardContent className="p-1 flex-1 flex flex-col justify-between">
                      <h3 className="text-xs font-semibold sm:text-sm lg:text-base">{relatedProduct.name}</h3>
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
                      <Button
                        className="w-full text-xs py-1 h-auto sm:text-sm lg:text-base bg-yellow-500 text-neutral-950 hover:bg-yellow-600 rounded-none"
                        onClick={() => addItem(relatedProduct.id, 1)}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                      </Button>
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
              🎯 Bulk Order Policy
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h4 className={cn("font-semibold text-sm", themeClasses.mainText)}>Minimum Order Quantity</h4>
                  <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                    Minimum 100 items required for bulk orders. Quantity has been auto-set to 100.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h4 className={cn("font-semibold text-sm", themeClasses.mainText)}>Special Pricing</h4>
                  <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                    Bulk orders receive special discounted pricing. Check the updated price in the quantity section.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h4 className={cn("font-semibold text-sm", themeClasses.mainText)}>Delivery & Shipping</h4>
                  <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                    Bulk orders have extended delivery times (7-14 days). Free shipping available for orders over $500.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h4 className={cn("font-semibold text-sm", themeClasses.mainText)}>Payment Terms</h4>
                  <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                    Bulk orders require advance payment. Bank transfer or wire transfer preferred for large orders.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <p className={cn("text-xs font-medium", themeClasses.mainText)}>
                💡 <strong>Quantity Updated:</strong> Your quantity has been automatically set to 100 items for bulk order pricing.
              </p>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsBulkOrderDialogOpen(false)}
              className={cn(
                "w-full sm:w-auto",
                themeClasses.borderNeutralSecondary,
                themeClasses.mainText,
              )}
            >
              Read Policy Again
            </Button>
            <Button
              onClick={() => {
                setIsBulkOrderDialogOpen(false)
                toast({
                  title: "Bulk Order Ready!",
                  description: "Your bulk order is configured. You can now proceed with the purchase.",
                })
              }}
              className="w-full sm:w-auto bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
            >
              Proceed
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

      {/* Selection Preview Dialog */}
      <Dialog open={isSelectionPreviewOpen} onOpenChange={setIsSelectionPreviewOpen}>
        <DialogContent className={cn("sm:max-w-[600px]", backgroundColor === "white" ? "bg-white border-gray-200" : "bg-gray-900 border-gray-700", themeClasses.mainText)}>
          <DialogHeader>
            <DialogTitle className={themeClasses.mainText}>Selection Details</DialogTitle>
            <DialogDescription className={themeClasses.textNeutralSecondary}>
              Review your selected options and pricing breakdown.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Product Info */}
            <div className={cn(
              "flex items-center gap-4 p-4 border rounded-lg",
              backgroundColor === "white" ? "bg-gray-50 border-gray-200" : "bg-gray-800 border-gray-600"
            )}>
              <div className="w-16 h-16 relative">
                <Image
                  src={product?.image || '/placeholder-image.jpg'}
                  alt={product?.name || 'Product image'}
                  fill
                  className="object-cover rounded-md"
                />
              </div>
              <div>
                <h3 className={cn("font-semibold", themeClasses.mainText)}>{product?.name}</h3>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>SKU: {currentSKU}</p>
              </div>
            </div>

            {/* Selection Breakdown - Detailed Preview */}
              <div className="space-y-2">
              <h4 className={cn("font-semibold text-sm", themeClasses.mainText)}>Selection Breakdown:</h4>
              <div className={cn(
                "p-3 border rounded-lg",
                backgroundColor === "white" ? "bg-gray-50 border-gray-200" : "bg-gray-800 border-gray-600"
              )}>
                <div className="space-y-2">
                  <div className={cn(
                    "text-xs italic",
                    backgroundColor === "white" ? "text-gray-600" : "text-gray-300"
                  )}>
                    Items to be added to cart:
                      </div>
                  
                          {(() => {
                    // Get all selected attributes
                    const selectedEntries = Object.entries(selectedAttributes).filter(([key, value]) => value !== undefined && value !== null && value !== '')
                    
                    if (selectedEntries.length === 0) {
                  return (
                        <div className={cn(
                          "text-sm",
                          backgroundColor === "white" ? "text-gray-600" : "text-gray-300"
                        )}>
                          Please select your options
                        </div>
                      )
                    }
                    
                    // For simple products with single selection, show the selection
                    if (displayProduct?.variantConfig?.type === 'simple' && selectedEntries.length === 1) {
                      const [attribute, value] = selectedEntries[0]
                      const currentQty = quantity
                      const unitPrice = (() => {
                        // Check if this is a primary attribute with price
                        if (displayProduct.variantConfig?.primaryAttribute === attribute) {
                          const variantWithPrimaryValue = displayProduct.variants?.find((variant: any) => 
                            variant.primaryValues?.some((pv: any) => pv.value === value)
                            )
                            if (variantWithPrimaryValue) {
                            const primaryValueObj = variantWithPrimaryValue.primaryValues?.find((pv: any) => pv.value === value) as { attribute: string; value: string; price?: string } | undefined
                            return primaryValueObj?.price ? parseFloat(primaryValueObj.price) : displayProduct.price
                          }
                        }
                        return displayProduct.price
                      })()
                      
                      return (
                        <div className={cn(
                          "flex items-center justify-between p-2 rounded border",
                          backgroundColor === "white" ? "bg-gray-50 border-gray-200" : "bg-gray-700 border-gray-500"
                        )}>
                      <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-xs font-medium",
                              backgroundColor === "white" ? "text-gray-600" : "text-gray-300"
                            )}>1.</span>
                            <div className="flex items-center gap-1">
                              <span className={cn(
                                "text-xs font-semibold capitalize",
                                backgroundColor === "white" ? "text-blue-800" : "text-blue-300"
                              )}>
                                {attribute}: {value}
                        </span>
                              <span className={cn(
                                "text-xs",
                                backgroundColor === "white" ? "text-gray-500" : "text-gray-400"
                              )}>
                                {formatPrice(unitPrice)}
                          </span>
                    </div>
              </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-xs",
                              backgroundColor === "white" ? "text-gray-600" : "text-gray-300"
                            )}>Qty: {currentQty}</span>
                            <span className={cn(
                              "text-xs font-semibold",
                              backgroundColor === "white" ? "text-green-600" : "text-green-400"
                            )}>
                              {formatPrice(unitPrice * currentQty)}
                            </span>
            </div>
                        </div>
                      )
                    }
                    
                    // For products with multiple attributes, show combinations
                    const combinations = generateAttributeCombinations(selectedAttributes)
                    
                    return combinations.map((combination, index) => {
                      const combinationKey = Object.entries(combination).map(([key, value]) => `${key}:${value}`).join('-')
                      const currentQty = getIndividualQuantity(combinationKey)
                      const unitPrice = calculatePriceForCombination(combination)
                  
                  return (
                        <div key={combinationKey} className={cn(
                          "flex items-center justify-between p-2 rounded border",
                          backgroundColor === "white" ? "bg-gray-50 border-gray-200" : "bg-gray-700 border-gray-500"
                        )}>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-xs font-medium",
                              backgroundColor === "white" ? "text-gray-600" : "text-gray-300"
                            )}>
                              {index + 1}.
                        </span>
                            <div className="flex items-center gap-1">
                              <span className={cn(
                                "text-xs font-semibold",
                                backgroundColor === "white" ? "text-blue-800" : "text-blue-300"
                              )}>
                                {Object.entries(combination).map(([key, value]) => `${key}: ${value}`).join(', ')}
                              </span>
                              <span className={cn(
                                "text-xs",
                                backgroundColor === "white" ? "text-gray-500" : "text-gray-400"
                              )}>
                                {formatPrice(unitPrice)}
                              </span>
                      </div>
                      </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-xs",
                              backgroundColor === "white" ? "text-gray-600" : "text-gray-300"
                            )}>Qty:</span>
                            <div className={cn(
                              "flex items-center border rounded",
                              backgroundColor === "white" ? "border-gray-300" : "border-gray-500"
                            )}>
                              <button 
                                className={cn(
                                  "px-1.5 py-0.5 text-xs",
                                  backgroundColor === "white" ? "hover:bg-gray-100 text-gray-700" : "hover:bg-gray-600 text-gray-300"
                                )}
                                onClick={() => handleIndividualQuantityChange(combinationKey, -1)}
                              >
                                -
                              </button>
                              <span className={cn(
                                "px-1.5 py-0.5 text-xs min-w-[1.5rem] text-center",
                                backgroundColor === "white" ? "text-gray-700" : "text-gray-300"
                              )}>
                                {currentQty}
                              </span>
                              <button 
                                className={cn(
                                  "px-1.5 py-0.5 text-xs",
                                  backgroundColor === "white" ? "hover:bg-gray-100 text-gray-700" : "hover:bg-gray-600 text-gray-300"
                                )}
                                onClick={() => handleIndividualQuantityChange(combinationKey, 1)}
                              >
                                +
                              </button>
                        </div>
                            <span className={cn(
                              "text-xs font-semibold",
                              backgroundColor === "white" ? "text-green-600" : "text-green-400"
                            )}>
                              {formatPrice(unitPrice * currentQty)}
                            </span>
                      </div>
            </div>
                  )
                    })
                })()}
                  
                  <div className={cn(
                    "pt-3 border-t",
                    backgroundColor === "white" ? "border-gray-200" : "border-gray-500"
                  )}>
                    <div className="flex justify-between items-center">
                      <span className={cn(
                        "text-sm font-semibold",
                        backgroundColor === "white" ? "text-gray-800" : "text-gray-200"
                      )}>
                        Total Items: {(() => {
                          const selectedEntries = Object.entries(selectedAttributes).filter(([key, value]) => value !== undefined && value !== null && value !== '')
                          
                          if (selectedEntries.length === 0) return 0
                          
                          // Calculate total combinations
                          let totalCombinations = 1
                          selectedEntries.forEach(([key, value]) => {
                            if (Array.isArray(value)) {
                              totalCombinations *= value.length
                            } else {
                              totalCombinations *= 1
                            }
                          })
                          
                          // If individual quantities are set, use them
                          if (Object.keys(individualQuantities).length > 0) {
                            const combinations = generateAttributeCombinations(selectedAttributes)
                            return combinations.reduce((total, combination) => {
                              const combinationKey = Object.entries(combination).map(([key, value]) => `${key}:${value}`).join('-')
                              return total + getIndividualQuantity(combinationKey)
                            }, 0)
                          }
                          
                          // Otherwise, multiply quantity by number of combinations
                          return quantity * totalCombinations
                        })()}
                      </span>
                      <span className={cn(
                        "text-lg font-bold",
                        backgroundColor === "white" ? "text-green-600" : "text-green-400"
                      )}>
                        Total Price: {(() => {
                          const selectedEntries = Object.entries(selectedAttributes).filter(([key, value]) => value !== undefined && value !== null && value !== '')
                          
                          if (selectedEntries.length === 0) return formatPrice(0)
                          
                          // Calculate total combinations
                          let totalCombinations = 1
                          selectedEntries.forEach(([key, value]) => {
                            if (Array.isArray(value)) {
                              totalCombinations *= value.length
                            } else {
                              totalCombinations *= 1
                            }
                          })
                          
                          // If individual quantities are set, use them
                          if (Object.keys(individualQuantities).length > 0) {
                            const combinations = generateAttributeCombinations(selectedAttributes)
                            const total = combinations.reduce((total, combination) => {
                              const combinationKey = Object.entries(combination).map(([key, value]) => `${key}:${value}`).join('-')
                              const qty = getIndividualQuantity(combinationKey)
                              const unitPrice = calculatePriceForCombination(combination)
                              return total + (unitPrice * qty)
                            }, 0)
                            return formatPrice(total)
                          }
                          
                          // Otherwise, calculate based on combinations
                          const unitPrice = getCurrentUnitPrice
                          return formatPrice(unitPrice * quantity * totalCombinations)
                        })()}
                      </span>
                      </div>
                      </div>
              </div>
            </div>
              </div>

          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSelectionPreviewOpen(false)}
              className="mr-2"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                try {
                  const pid = product?.id || productIdNumber
                  if (!pid) {
                setIsSelectionPreviewOpen(false)
                    return
                  }

                  const selectedEntries = Object.entries(selectedAttributes).filter(([key, value]) => value !== undefined && value !== null && value !== '')

                  if (displayProduct?.variantConfig?.type === 'simple' && selectedEntries.length === 1) {
                    // Single selection
                    const [attribute, value] = selectedEntries[0]
                    const unitPrice = getCurrentUnitPrice
                    addItem(pid, quantity, undefined, { [attribute]: value as string }, unitPrice, currentSKU, (mainImage as any) || product?.image)
                  } else {
                    // Multiple combinations
                    const combinations = generateAttributeCombinations(selectedAttributes)
                    combinations.forEach((combination) => {
                      const key = Object.entries(combination).map(([k, v]) => `${k}:${v}`).join('-')
                      const qty = getIndividualQuantity(key) || quantity
                      const unitPrice = calculatePriceForCombination(combination)
                      addItem(pid, qty, undefined, combination as any, unitPrice, currentSKU, (mainImage as any) || product?.image)
                    })
                  }
                } finally {
                  setIsSelectionPreviewOpen(false)
                }
              }}
              className={cn(
                "hover:bg-green-700 text-white",
                backgroundColor === "white" ? "bg-green-600" : "bg-green-700"
              )}
            >
              Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Edit Dialogs */}
      
      {/* Stock Edit Dialog */}
      <Dialog open={isStockEditDialogOpen} onOpenChange={setIsStockEditDialogOpen}>
        <DialogContent className={cn("sm:max-w-md", backgroundColor === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200")}>
          <DialogHeader>
            <DialogTitle className={themeClasses.mainText}>Edit Stock Status</DialogTitle>
            <DialogDescription className={themeClasses.textNeutralSecondary}>
              Manage stock quantity and availability for this product.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stock-quantity" className={cn("text-sm font-medium", themeClasses.mainText)}>
                Stock Quantity
              </Label>
              <Input
                id="stock-quantity"
                type="number"
                min="0"
                value={adminProductState.stockQuantity}
                onChange={(e) => updateAdminProductState('stockQuantity', parseInt(e.target.value) || 0)}
                className={cn("focus:border-blue-500 focus:ring-blue-500", themeClasses.cardBg, themeClasses.cardBorder, themeClasses.mainText)}
                placeholder="Enter stock quantity"
              />
              <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                Current status: {adminProductState.inStock && adminProductState.stockQuantity > 0 ? 
                  `In Stock (${adminProductState.stockQuantity} available)` : 'Out of Stock'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsStockEditDialogOpen(false)}
              className="mr-2"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Free Delivery Edit Dialog */}
      <Dialog open={isFreeDeliveryEditDialogOpen} onOpenChange={setIsFreeDeliveryEditDialogOpen}>
        <DialogContent className={cn("sm:max-w-md", backgroundColor === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200")}>
          <DialogHeader>
            <DialogTitle className={themeClasses.mainText}>Edit Free Delivery</DialogTitle>
            <DialogDescription className={themeClasses.textNeutralSecondary}>
              Enable or disable free delivery for this product.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="free-delivery"
                checked={adminProductState.freeDelivery}
                onCheckedChange={(checked) => updateAdminProductState('freeDelivery', checked)}
              />
              <Label htmlFor="free-delivery" className={cn("text-sm font-medium", themeClasses.mainText)}>
                Enable Free Delivery
              </Label>
            </div>
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              {adminProductState.freeDelivery ? 
                'Free delivery is enabled for this product.' : 
                'Standard delivery fees will apply to this product.'}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsFreeDeliveryEditDialogOpen(false)}
              className="mr-2"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Same Day Delivery Edit Dialog */}
      <Dialog open={isSameDayDeliveryEditDialogOpen} onOpenChange={setIsSameDayDeliveryEditDialogOpen}>
        <DialogContent className={cn("sm:max-w-md", backgroundColor === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200")}>
          <DialogHeader>
            <DialogTitle className={themeClasses.mainText}>Edit Same Day Delivery</DialogTitle>
            <DialogDescription className={themeClasses.textNeutralSecondary}>
              Enable or disable same day delivery for this product.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="same-day-delivery"
                checked={adminProductState.sameDayDelivery}
                onCheckedChange={(checked) => updateAdminProductState('sameDayDelivery', checked)}
              />
              <Label htmlFor="same-day-delivery" className={cn("text-sm font-medium", themeClasses.mainText)}>
                Enable Same Day Delivery
              </Label>
            </div>
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              {adminProductState.sameDayDelivery ? 
                'Same day delivery is available for this product.' : 
                'Same day delivery is not available for this product.'}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSameDayDeliveryEditDialogOpen(false)}
              className="mr-2"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Admin Controls Panel */}
      {user && (user.role === 'admin' || user.profile?.is_admin) && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={cn(
            "rounded-lg shadow-lg p-4 border min-w-[280px]",
            backgroundColor === "white" ? "bg-white border-gray-200" : "bg-gray-800 border-gray-700"
          )}>
            <h3 className={cn(
              "text-sm font-semibold mb-3",
              backgroundColor === "white" ? "text-gray-900" : "text-white"
            )}>Admin Controls</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-xs",
                  backgroundColor === "white" ? "text-gray-600" : "text-gray-300"
                )}>Stock Quantity:</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={adminProductState.stockQuantity}
                    onChange={(e) => updateAdminProductState('stockQuantity', parseInt(e.target.value) || 0)}
                    className="w-16 h-6 text-xs p-1"
                  />
                  <span className={`text-xs px-2 py-1 rounded ${adminProductState.inStock && adminProductState.stockQuantity > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {adminProductState.inStock && adminProductState.stockQuantity > 0 ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-xs",
                  backgroundColor === "white" ? "text-gray-600" : "text-gray-300"
                )}>Free Delivery:</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant={adminProductState.freeDelivery ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateAdminProductState('freeDelivery', !adminProductState.freeDelivery)}
                    className="h-6 px-2 text-xs"
                  >
                    {adminProductState.freeDelivery ? 'ON' : 'OFF'}
                  </Button>
                  <span className={`text-xs px-2 py-1 rounded ${adminProductState.freeDelivery ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {adminProductState.freeDelivery ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-xs",
                  backgroundColor === "white" ? "text-gray-600" : "text-gray-300"
                )}>Same Day Delivery:</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant={adminProductState.sameDayDelivery ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateAdminProductState('sameDayDelivery', !adminProductState.sameDayDelivery)}
                    className="h-6 px-2 text-xs"
                  >
                    {adminProductState.sameDayDelivery ? 'ON' : 'OFF'}
                  </Button>
                  <span className={`text-xs px-2 py-1 rounded ${adminProductState.sameDayDelivery ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {adminProductState.sameDayDelivery ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
              
              {/* Return Time Controls */}
              <div className="border-t pt-3 mt-3">
                <span className={cn(
                  "text-xs font-medium mb-2 block",
                  backgroundColor === "white" ? "text-gray-700" : "text-gray-300"
                )}>Return Time Settings</span>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-xs",
                      backgroundColor === "white" ? "text-gray-600" : "text-gray-300"
                    )}>Time Value:</span>
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      value={adminProductState.returnTimeValue}
                      onChange={(e) => updateAdminProductState('returnTimeValue', parseInt(e.target.value) || 1)}
                      className="w-16 h-6 text-xs p-1"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-300">Time Unit:</span>
                    <select
                      value={adminProductState.returnTimeType}
                      onChange={(e) => updateAdminProductState('returnTimeType', e.target.value)}
                      className="w-20 h-6 text-xs p-1 border rounded bg-white dark:bg-gray-700"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Message: "Please return in {adminProductState.returnTimeValue} {adminProductState.returnTimeType}"
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
      
    </div>
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

