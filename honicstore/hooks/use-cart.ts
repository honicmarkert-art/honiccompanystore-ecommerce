"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'

// Safe logging helpers - no-op functions for production cleanliness
const safeLog = function(...args: any[]) {
  // Logging disabled for production cleanliness
}

const safeError = function(...args: any[]) {
  // Error logging disabled for production cleanliness
}

// Types
export interface SelectedVariant {
  variantId: string
  variant_name?: string | null
  attributes: { [key: string]: string | string[] } // Deprecated - use variant_name instead
  quantity: number
  price: number
  sku?: string
  image?: string
}
export interface CartItem {
  id: number
  productId: number
  variants: SelectedVariant[] // Changed from single variantId to array of variants
  totalQuantity: number // Sum of all variant quantities
  totalPrice: number // Sum of all variant prices
  currency: string
  appliedDiscount?: number
  createdAt: string
  updatedAt: string
  product?: {
    id: number
    name: string
    image: string
    price: number
    originalPrice?: number
    inStock: boolean
    stockQuantity?: number
    sku?: string
  }
}
export interface CartResponse {
  items: CartItem[]
  totals: {
    total_items: number
    subtotal: number
    total_discount: number
    final_total: number
  }
}
const CART_STORAGE_KEY = 'guest_cart'

// Migration function to convert old cart data to new object array format
const migrateCartData = (cartData: any[]): CartItem[] => {
  return cartData.map(item => ({
    ...item,
    variants: item.variants.map((variant: any) => ({
      ...variant,
      attributes: Object.entries(variant.attributes || {}).reduce((acc, [key, value]) => {
        // If value is a comma-separated string, convert to object array
        if (typeof value === 'string' && value.includes(',')) {
          acc[key] = value.split(',').map(v => ({ value: v.trim() }))
        } else {
          acc[key] = value
        }
        return acc
      }, {} as any)
    }))
  }))
}
// Build a canonical, stable variant id from attributes to guarantee merging
const buildCanonicalVariantId = (
  variantId: string | undefined,
  attributes?: { [key: string]: string | string[] }
): string => {
  // If attributes exist, create a deterministic id regardless of button index/order
  if (attributes && Object.keys(attributes).length > 0) {
    const parts = Object.keys(attributes)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => {
        const value = attributes[key]
        if (Array.isArray(value)) {
          return `${key}:${value.slice().sort().join(',')}`
        }
        return `${key}:${value}`
      })
      .join('-')
    return `combination-${parts}`
  }
  // No attributes: use provided variantId or default
  return variantId || 'default'
}
// Shallow, order-insensitive attribute equality
const areAttributesEqual = (
  a?: { [key: string]: string | string[] },
  b?: { [key: string]: string | string[] }
): boolean => {
  if (!a && !b) return true
  if (!a || !b) return false
  const keysA = Object.keys(a).sort()
  const keysB = Object.keys(b).sort()
  if (keysA.length !== keysB.length) {
        return false
  }
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) {
      return false
    }
    const va = a[keysA[i]]
    const vb = b[keysA[i]]
    if (Array.isArray(va) || Array.isArray(vb)) {
      // For arrays, compare exact order and values (don't sort)
      const sa = Array.isArray(va) ? va.join(',') : String(va)
      const sb = Array.isArray(vb) ? vb.join(',') : String(vb)
      if (sa !== sb) {
        return false
      }
    } else if (String(va) !== String(vb)) {
      return false
    }
  }
  return true
}
// Helper function to format variant attributes for display
export const formatVariantAttributes = (attributes: { [key: string]: string | string[] }): string => {
  return Object.entries(attributes)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.join(', ')}`
      }
      return `${key}: ${value}`
    })
    .join(' | ')
}
// Helper function to format variant attributes in hierarchical format (Type > Value)
export const formatVariantHierarchy = (attributes: { [key: string]: string | string[] }): string => {
  return Object.entries(attributes)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key} > ${value.join(', ')}`
      }
      return `${key} > ${value}`
    })
    .join(' | ')
}
export function useCart() {
  const { user, isAuthenticated } = useAuth()
  const { toast } = useToast()

  const [cart, setCart] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [cartSubtotal, setCartSubtotal] = useState(0)
  const [cartTotalItems, setCartTotalItems] = useState(0)
  const [cartUniqueProducts, setCartUniqueProducts] = useState(0)
  const [hasAttemptedMerge, setHasAttemptedMerge] = useState(false)
  const cartAbortRef = useRef<AbortController | null>(null)
  // Request deduplication map to prevent duplicate API calls
  const addItemRequestMap = useRef<Map<string, Promise<any>>>(new Map())

  // Migrate old cart items to new structure
  const migrateCartItem = useCallback((item: any): CartItem => {
    // If item already has new structure, preserve variant_name and migrate attributes if needed
    if (item.variants && Array.isArray(item.variants)) {
      const migrated = {
        ...item,
        variants: item.variants.map((variant: any) => ({
          ...variant,
          variant_name: variant.variant_name, // Preserve variant_name
          attributes: Object.entries(variant.attributes || {}).reduce((acc, [key, value]) => {
            // If value is a comma-separated string, convert to object array
            if (typeof value === 'string' && value.includes(',')) {
              acc[key] = value.split(',').map(v => ({ value: v.trim() }))
            } else {
              acc[key] = value
            }
            return acc
          }, {} as any)
        }))
      }
      return migrated
    }
    // Migrate old structure to new structure

    const migratedItem: CartItem = {
      id: item.id,
      productId: item.productId,
      variants: [{
        variantId: item.variantId || 'default',
        variant_name: item.variant_name || null, // Preserve variant_name if present
        attributes: Object.entries(item.attributes || {}).reduce((acc, [key, value]) => {
          // If value is a comma-separated string, convert to object array
          if (typeof value === 'string' && value.includes(',')) {
            acc[key] = value.split(',').map(v => ({ value: v.trim() }))
          } else {
            acc[key] = value
          }
          return acc
        }, {} as any),
        quantity: item.quantity || 1,
        price: item.price || 0,
        sku: item.sku,
        image: item.image
      }],
      totalQuantity: item.quantity || 1,
      totalPrice: (item.price || 0) * (item.quantity || 1),
      currency: item.currency || 'USD',
      appliedDiscount: item.appliedDiscount,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      product: item.product
    }
    return migratedItem
  }, [])

  // Load cart data with caching for instant display
  const loadServerCart = useCallback(async (useCache: boolean = true) => {
    if (!isAuthenticated) return

    // Try to load from cache first for instant display
    if (useCache) {
      try {
        const cachedCart = sessionStorage.getItem('cart_cache')
        const cacheTimestamp = sessionStorage.getItem('cart_cache_timestamp')
        if (cachedCart && cacheTimestamp) {
          const cacheAge = Date.now() - parseInt(cacheTimestamp, 10)
          // Use cache if less than 30 seconds old
          if (cacheAge < 30000) {
            const cachedData: CartResponse = JSON.parse(cachedCart)
            const migratedCart = (cachedData.items || []).map(migrateCartItem)
            setCart(migratedCart)
            setCartSubtotal(cachedData.totals.subtotal)
            setCartTotalItems(cachedData.totals.total_items)
            setIsLoading(false)
            // Continue to refresh in background
          }
        }
      } catch (error) {
        // Ignore cache errors, continue to fetch
      }
    }

    // Prevent multiple simultaneous calls
    if (cartAbortRef.current) {
      try { cartAbortRef.current.abort() } catch {}
    }
    setIsLoading(true)
    try {
      cartAbortRef.current = new AbortController()
      const response = await fetch('/api/cart', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: cartAbortRef.current.signal
      }).catch((error) => {
        // Handle AbortError gracefully
        if (error.name === 'AbortError') {
          throw error // Re-throw to be caught by outer try-catch
        }
        throw error
      })

      if (response.status === 429) {
        // brief backoff and single retry
        await new Promise(r => setTimeout(r, 400 + Math.floor(Math.random() * 300)))
        const retry = await fetch('/api/cart', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: cartAbortRef.current.signal
        })
        if (retry.ok) {
          const data: CartResponse = await retry.json()
          const migratedCart = (data.items || []).map(migrateCartItem)
          setCart(migratedCart)
          setCartSubtotal(data.totals.subtotal)
          setCartTotalItems(data.totals.total_items)
          return
        }
      }
      // Read response text once (can only be read once)
      const responseText = await response.text()

      if (response.ok) {
        const data: CartResponse = JSON.parse(responseText)
        const migratedCart = (data.items || []).map(migrateCartItem)
        setCart(migratedCart)
        setCartSubtotal(data.totals.subtotal)
        setCartTotalItems(data.totals.total_items)
        
        // Cache cart data for faster subsequent loads
        try {
          sessionStorage.setItem('cart_cache', JSON.stringify(data))
          sessionStorage.setItem('cart_cache_timestamp', Date.now().toString())
        } catch (error) {
          // Ignore cache errors
        }
      } else {
        // Parse error response
        let errorData: any = null
        try {
          errorData = JSON.parse(responseText)
        } catch (e) {
          // Not JSON, use as text
          errorData = { message: responseText || 'Unknown error' }
        }
        safeError('🛒 [USE-CART] Failed to load cart:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          errorMessage: responseText || 'No error message',
          errorData: errorData
        })

        // If 401, user might not be authenticated
        if (response.status === 401) {
          safeError('🛒 [USE-CART] Authentication failed - user may need to log in')
        }
      }
    } catch (error) {
        // Handle AbortError gracefully - don't show error for aborted requests
        if (error && (error as any).name === 'AbortError') {
          // Don't set error state for aborted requests - this is expected behavior
          return
        }
      safeError('🛒 [USE-CART] Error loading cart:', error)
    } finally {
      setIsLoading(false)
      cartAbortRef.current = null
    }
  }, [isAuthenticated, migrateCartItem])

  // Load product data for cart items that don't have it, and fetch variant_name for variants
  // SECURITY: Always re-fetch supplier info from API for guest users to prevent localStorage tampering
  // OPTIMIZED: Batch fetch product data instead of individual calls
  const loadProductDataForCartItems = useCallback(async (cartItems: CartItem[], forceRefreshSupplierInfo: boolean = false) => {
    const itemsNeedingProductData = cartItems.filter(item => !item.product)
    const itemsNeedingVariantName = cartItems.filter(item =>
      item.variants.some(v => !v.variant_name && v.variantId && v.variantId !== 'default' && !isNaN(Number(v.variantId)))
    )

    // For guest users, always refresh supplier info from API (don't trust localStorage)
    const needsSupplierInfoRefresh = forceRefreshSupplierInfo || !isAuthenticated

    if (itemsNeedingProductData.length === 0 && itemsNeedingVariantName.length === 0 && !needsSupplierInfoRefresh) return cartItems

    // Batch fetch product IDs that need data
    const productIdsToFetch = [...new Set(cartItems
      .filter(item => !item.product || item.variants.some(v => !v.variant_name && v.variantId && v.variantId !== 'default' && !isNaN(Number(v.variantId))))
      .map(item => item.productId)
    )]

    // Batch fetch products if needed
    let productsMap: { [key: number]: any } = {}
    if (productIdsToFetch.length > 0) {
      try {
        // Fetch all products in parallel (non-blocking)
        const productPromises = productIdsToFetch.map(productId => 
          fetch(`/api/products/${productId}`)
            .then(res => res.ok ? res.json() : null)
            .catch(() => null)
        )
        const products = await Promise.all(productPromises)
        products.forEach((product, index) => {
          if (product) {
            productsMap[productIdsToFetch[index]] = product
          }
        })
      } catch (error) {
        safeError('🛒 [USE-CART] Error batch fetching products:', error)
      }
    }

    const updatedItems = await Promise.all(
      cartItems.map(async (item) => {
        const needsProductData = !item.product
        const needsVariantName = item.variants.some(v => !v.variant_name && v.variantId && v.variantId !== 'default' && !isNaN(Number(v.variantId)))

        // Use cached product data from batch fetch
        const productData = productsMap[item.productId] || null

        // Fetch supplier info if needed (in background, non-blocking)
        if (needsSupplierInfoRefresh) {
          // Fetch supplier info in background without blocking
          fetch(`/api/products/${item.productId}/supplier-info`)
            .then(supplierResponse => {
              if (supplierResponse && supplierResponse.ok) {
                return supplierResponse.json()
              }
              return null
            })
            .then(supplierInfo => {
              if (supplierInfo) {
                // Update cart item with supplier info in background
                setCart(prev => prev.map(cartItem => {
                  if (cartItem.productId === item.productId) {
                    return {
                      ...cartItem,
                      supplierCompanyName: supplierInfo.companyName || null,
                      supplierIsVerified: supplierInfo.isVerified || false,
                      supplierRegion: supplierInfo.region || null,
                      supplierNation: null,
                      supplierCompanyLogo: supplierInfo.companyLogo || null
                    } as any
                  }
                  return cartItem
                }))
              }
            })
            .catch(() => {})
        }

        // If product data not in batch, fetch individually (fallback)
        if ((needsProductData || needsVariantName) && !productData) {
          try {
            const productResponse = await fetch(`/api/products/${item.productId}`)
            if (productResponse.ok) {
              const fetchedProductData = await productResponse.json()
              productsMap[item.productId] = fetchedProductData
            }
          } catch (error) {
            safeError('🛒 [USE-CART] Error fetching product data:', error)
          }
        }

        const finalProductData = productData || productsMap[item.productId]

            // Update variants with variant_name and price from database
            const updatedVariants = finalProductData ? item.variants.map((v: any) => {
              let updatedVariant = { ...v }
              if (v.variantId && v.variantId !== 'default' && !isNaN(Number(v.variantId))) {
                const variant = finalProductData.variants?.find((pv: any) => pv.id === Number(v.variantId))
                if (variant) {
                  // Always update variant_name and price from database
                  updatedVariant.variant_name = variant.variant_name || null
                  updatedVariant.price = parseFloat(variant.price) || updatedVariant.price
                }
              } else if (needsProductData) {
                // For products without variants, use product price
                updatedVariant.price = parseFloat(finalProductData.price) || updatedVariant.price
              }
              return updatedVariant
            }) : item.variants

            return {
              ...item,
              variants: updatedVariants,
              product: needsProductData && finalProductData ? {
                id: finalProductData.id,
                name: finalProductData.name,
                image: finalProductData.image,
                price: finalProductData.price,
                originalPrice: finalProductData.original_price,
                inStock: finalProductData.in_stock,
                stockQuantity: finalProductData.stock_quantity,
                sku: finalProductData.sku
              } : item.product
              // Supplier info updated in background above
            }
      })
    )

    return updatedItems
  }, [isAuthenticated, setCart])

  // Load guest cart from localStorage
  // SECURITY: Always re-fetch supplier info from API to prevent localStorage tampering
  const loadGuestCart = useCallback(async () => {
    if (isAuthenticated) return

    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      if (stored) {
        const guestCart = JSON.parse(stored)
        const migratedCart = (guestCart.items || []).map(migrateCartItem)

        // SECURITY: Always refresh supplier info from API (forceRefreshSupplierInfo = true)
        // This prevents guest users from tampering with supplier info in localStorage
        const cartWithProductData = await loadProductDataForCartItems(migratedCart, true)

        setCart(cartWithProductData)
        setCartSubtotal(guestCart.subtotal || 0)
        setCartTotalItems(guestCart.totalItems || 0)
      }
    } catch (error) {
      safeError('🛒 [USE-CART] Error loading guest cart:', error)
    }
  }, [isAuthenticated, migrateCartItem, loadProductDataForCartItems])

  // Save guest cart to localStorage
  // SECURITY: Sanitize data before saving - remove any UUIDs or sensitive data
  const saveGuestCart = useCallback((items: CartItem[], subtotal: number, totalItems: number) => {
    if (isAuthenticated) return

    try {
      // SECURITY: Sanitize items before saving - remove any UUIDs or sensitive supplier data
      // We only save display-safe supplier info (company name, logo, verification status, region)
      // Never save supplierId or any UUIDs
      const sanitizedItems = items.map(item => {
        const sanitized: any = {
          id: item.id,
          productId: item.productId,
          variants: item.variants,
          totalQuantity: item.totalQuantity,
          totalPrice: item.totalPrice,
          currency: item.currency,
          appliedDiscount: item.appliedDiscount,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          product: item.product
        }
        // Only include safe supplier display info (no UUIDs)
        if ((item as any).supplierCompanyName) {
          sanitized.supplierCompanyName = (item as any).supplierCompanyName
        }
        if ((item as any).supplierIsVerified !== undefined) {
          sanitized.supplierIsVerified = (item as any).supplierIsVerified
        }
        if ((item as any).supplierRegion) {
          sanitized.supplierRegion = (item as any).supplierRegion
        }
        if ((item as any).supplierNation) {
          sanitized.supplierNation = (item as any).supplierNation
        }
        if ((item as any).supplierCompanyLogo) {
          sanitized.supplierCompanyLogo = (item as any).supplierCompanyLogo
        }
        // SECURITY: Explicitly remove any UUIDs or sensitive fields
        delete (sanitized as any).supplierId
        delete (sanitized as any).supplier_id
        delete (sanitized as any).user_id

        return sanitized
      })

      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
        items: sanitizedItems,
        subtotal,
        totalItems
      }))
    } catch (error) {
      safeError('🛒 [USE-CART] Error saving guest cart:', error)
    }
  }, [isAuthenticated])

  // Merge guest cart into authenticated user's cart
  const mergeGuestCart = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      if (stored) {
        const guestCart = JSON.parse(stored)
        if (guestCart.items && guestCart.items.length > 0) {
          const response = await fetch('/api/cart/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ guestCart: guestCart.items })
          })

          if (response.ok) {
            const result = await response.json()
            // Clear guest cart after successful merge
            localStorage.removeItem(CART_STORAGE_KEY)
            return true
          } else {
            return false
          }
        } else {
          // No items to merge, clear empty guest cart
          localStorage.removeItem(CART_STORAGE_KEY)
          return true
        }
      }
      return true // No guest cart to merge
    } catch (error) {
      return false
    }
  }, [isAuthenticated])

  // Load appropriate cart based on authentication status
  useEffect(() => {
    if (isAuthenticated) {
      // First merge guest cart if it exists and hasn't been attempted yet, then load server cart
      const hasGuestCart = localStorage.getItem(CART_STORAGE_KEY)
      if (hasGuestCart && !hasAttemptedMerge) {
        setHasAttemptedMerge(true)
        mergeGuestCart().then(() => {
          // After merging, load the server cart
          loadServerCart()
        })
      } else {
        // No guest cart to merge or already attempted, just load server cart
        loadServerCart()
      }
    } else {
      loadGuestCart().catch(() => {})
      // Reset merge flag when not authenticated
      setHasAttemptedMerge(false)
    }
  }, [isAuthenticated, loadServerCart, loadGuestCart, mergeGuestCart, hasAttemptedMerge])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cartAbortRef.current) {
        try { cartAbortRef.current.abort() } catch {}
        cartAbortRef.current = null
      }
    }
  }, [])

  // Add item to cart with variant attributes
  const addItem = useCallback(async (
    productId: number,
    quantity: number = 1,
    variantId?: string,
    variantAttributes?: { [key: string]: string | string[] },
    variantPrice?: number,
    variantSku?: string,
    variantImage?: string,
    productData?: any // Optional: Pre-loaded product data to avoid API fetch
  ) => {
    // Normalize variant id so simple products always use a single key
    const normalizedVariantId: string = buildCanonicalVariantId(variantId, variantAttributes)

    // Use provided price immediately for faster response
    let finalVariantPrice: number = variantPrice || 0

    // Only fetch price if not provided (for guest users or fallback)
    if (variantPrice === undefined || variantPrice === null) {
      // Use a default price and fetch in background
      finalVariantPrice = 0

      // Fetch price in background without blocking
      fetch(`/api/products/${productId}`)
        .then(response => response.ok ? response.json() : null)
        .then(product => {
          if (product && product.price) {
            // Update cart with correct price if it changed
            setCart(prevCart => prevCart.map(item =>
              item.productId === productId
                ? {
                    ...item,
                    variants: item.variants.map(v =>
                      v.variantId === normalizedVariantId
                        ? { ...v, price: product.price }
                        : v
                    ),
                    totalPrice: item.variants.reduce((sum, v) =>
                      sum + ((v.variantId === normalizedVariantId ? product.price : v.price) * v.quantity), 0
                    )
                  }
                : item
            ))
          }
        })
        .catch(() => {}) // Silently handle errors
    }
    // Check if product already exists in cart - if so, increment quantity only (do not add as new item)
    const existingItem = cart.find(item => item.productId === productId)

    if (existingItem) {
      // Match by normalized variantId (treat undefined/'default'/empty as same so we always merge)
      const normId = (id: string | undefined) => (id == null || String(id).trim() === '') ? 'default' : String(id)
      const existingVariant = existingItem.variants.find(v =>
        normId(v.variantId) === normId(normalizedVariantId)
      )

      if (existingVariant) {
        // Check stock before incrementing - prevent adding more if stock is limited
        const currentQuantity = existingVariant.quantity
        const newQuantity = currentQuantity + quantity
        
        // Check stock from product data if available
        let stockQuantity = existingItem.product?.stockQuantity
        
        // If stock not available in product data, fetch it quickly
        if (stockQuantity === undefined || stockQuantity === null) {
          // Fetch stock synchronously before incrementing (only if not available)
          try {
            const stockResponse = await fetch(`/api/stock?id=${productId}`)
            if (stockResponse.ok) {
              const stockData = await stockResponse.json()
              if (stockData.stock && stockData.stock.length > 0) {
                stockQuantity = stockData.stock[0].stockQuantity
              }
            }
          } catch (error) {
            // If stock fetch fails, proceed with increment (server will validate)
            safeError('Failed to fetch stock:', error)
          }
        }
        
        // Check if stock is limited and we're trying to add more than available
        if (stockQuantity !== undefined && stockQuantity !== null && stockQuantity !== Infinity) {
          // Stock is limited - check if we can add more
          if (newQuantity > stockQuantity) {
            // Already at or over stock limit - don't increment
            toast({
              title: "Stock Limit Reached",
              description: `Only ${stockQuantity} item(s) available. You already have ${currentQuantity} in your cart.`,
              variant: "destructive",
            })
            return // Don't increment, just return
          }
        }
        
        // Update existing variant quantity
        const updatedCart = cart.map(item => {
          if (item.productId === productId) {
            const updatedVariants = item.variants.map(v =>
              (v.variantId === normalizedVariantId)
                ? { ...v, quantity: v.quantity + quantity }
                : v
            )
            const totalQuantity = updatedVariants.reduce((sum, v) => sum + v.quantity, 0)
            const totalPrice = updatedVariants.reduce((sum, v) => sum + (v.price * v.quantity), 0)

            return {
              ...item,
              variants: updatedVariants,
              totalQuantity,
              totalPrice
            }
          }
          return item
        })
        setCart(prev => {
          // Save to localStorage immediately for guest users
          if (!isAuthenticated) {
            try {
              const subtotal = updatedCart.reduce((sum, item) => sum + item.totalPrice, 0)
              const totalItems = updatedCart.reduce((sum, item) => sum + item.totalQuantity, 0)
              localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
                items: updatedCart,
                subtotal,
                totalItems
              }))
            } catch (error) {
              safeError('🛒 [CLIENT] Error saving guest cart:', error)
            }
          }
          return updatedCart
        })
        setCartTotalItems(prev => prev + quantity)
        setCartSubtotal(prev => prev + (finalVariantPrice * quantity))

      } else {
        // Use provided product data or fetch variant_name and price from database
        let variantName: string | null = null
        let variantPriceFromDB: number | null = null
        let productDataToUse = productData

        // Only fetch if product data not provided AND variant ID is numeric
        // Skip fetch if productData is already provided (performance optimization)
        if (!productDataToUse && normalizedVariantId && normalizedVariantId !== 'default' && !normalizedVariantId.toString().startsWith('combination-') && !isNaN(Number(normalizedVariantId))) {
          // Fetch in background without blocking - use cached data if available
          const requestKey = `product-${productId}`
          
          // Check for duplicate request
          if (addItemRequestMap.current.has(requestKey)) {
            // Don't await - let it happen in background
            addItemRequestMap.current.get(requestKey)
              .then(data => {
                if (data) {
                  productDataToUse = data
                  // Update variant name in background if needed
                  const variant = data.variants?.find((v: any) => v.id === Number(normalizedVariantId))
                  if (variant) {
                    setCart(prev => prev.map(item => {
                      if (item.productId === productId) {
                        return {
                          ...item,
                          variants: item.variants.map(v =>
                            v.variantId === normalizedVariantId
                              ? { ...v, variant_name: variant.variant_name || null }
                              : v
                          )
                        }
                      }
                      return item
                    }))
                  }
                }
              })
              .catch(() => {})
          } else {
            // Create new fetch request in background (non-blocking)
            const fetchPromise = fetch(`/api/products/${productId}`, {
              cache: 'default', // Use CDN cache
              headers: {
                'Cache-Control': 'max-age=60' // Cache for 60 seconds
              }
            }).then(response => response.ok ? response.json() : null)
            
            addItemRequestMap.current.set(requestKey, fetchPromise)
            
            // Don't await - fetch in background
            fetchPromise
              .then(data => {
                if (data) {
                  // Update variant name in background if needed
                  const variant = data.variants?.find((v: any) => v.id === Number(normalizedVariantId))
                  if (variant) {
                    setCart(prev => prev.map(item => {
                      if (item.productId === productId) {
                        return {
                          ...item,
                          variants: item.variants.map(v =>
                            v.variantId === normalizedVariantId
                              ? { ...v, variant_name: variant.variant_name || null }
                              : v
                          )
                        }
                      }
                      return item
                    }))
                  }
                }
              })
              .catch(() => {})
              .finally(() => {
                // Clean up after 2 seconds
                setTimeout(() => addItemRequestMap.current.delete(requestKey), 2000)
              })
          }
        }
        
        // Extract variant data from product data
        if (productDataToUse) {
          if (normalizedVariantId && normalizedVariantId !== 'default' && !normalizedVariantId.toString().startsWith('combination-') && !isNaN(Number(normalizedVariantId))) {
            const variant = productDataToUse.variants?.find((v: any) => v.id === Number(normalizedVariantId))
            if (variant) {
              variantName = variant.variant_name || null
              variantPriceFromDB = parseFloat(variant.price) || null
            }
          }
          // If no variant-specific price, use product price
          if (variantPriceFromDB === null) {
            variantPriceFromDB = parseFloat(productDataToUse.price) || 0
            }
        } else if (variantPriceFromDB === null && variantPrice !== undefined && variantPrice !== null) {
          // Fallback to provided price if no product data available
          variantPriceFromDB = variantPrice
        }
        // Use database price if available, otherwise fall back to provided price
        const finalPriceToUseForVariant = variantPriceFromDB !== null ? variantPriceFromDB : finalVariantPrice

        // Add new variant to existing product
        const newVariant: SelectedVariant = {
          variantId: normalizedVariantId,
          variant_name: variantName,
          attributes: variantAttributes || {},
          quantity,
          price: finalPriceToUseForVariant, // Always use database price
          sku: variantSku,
          image: variantImage
        }
        const updatedCart = cart.map(item => {
          if (item.productId === productId) {
            const updatedVariants = [...item.variants, newVariant]
            const totalQuantity = updatedVariants.reduce((sum, v) => sum + v.quantity, 0)
            const totalPrice = updatedVariants.reduce((sum, v) => sum + (v.price * v.quantity), 0)

            return {
              ...item,
              variants: updatedVariants,
              totalQuantity,
              totalPrice
            }
          }
          return item
        })
      setCart(prev => {
        // Save to localStorage immediately for guest users
        if (!isAuthenticated) {
          try {
            const subtotal = updatedCart.reduce((sum, item) => sum + item.totalPrice, 0)
            const totalItems = updatedCart.reduce((sum, item) => sum + item.totalQuantity, 0)
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
              items: updatedCart,
              subtotal,
              totalItems
            }))
          } catch (error) {
            safeError('🛒 [CLIENT] Error saving guest cart:', error)
          }
        }
        return updatedCart
      })
      setCartTotalItems(prev => prev + quantity)
        setCartSubtotal(prev => prev + (finalVariantPrice * quantity))

      }
    } else {
      // Use provided product data or fetch it (for both guest and authenticated users to get variant_name and price from DB)
      let productDataToUse = productData
      let variantName: string | null = null
      let variantPriceFromDB: number | null = null

      // Only fetch if product data not provided
      // If productData is provided, use it immediately (no blocking fetch)
      if (!productDataToUse) {
        // Fetch in background without blocking - proceed with optimistic update
        const requestKey = `product-${productId}`
        
        // Check for duplicate request
        if (addItemRequestMap.current.has(requestKey)) {
          // Don't await - let it happen in background
          addItemRequestMap.current.get(requestKey)
            .then(data => {
              if (data) {
                // Update cart with product data in background
                setCart(prev => prev.map(item => {
                  if (item.productId === productId && !item.product) {
                    return {
                      ...item,
                      product: {
                        id: data.id,
                        name: data.name,
                        image: data.image,
                        price: data.price,
                        originalPrice: data.original_price || data.originalPrice,
                        inStock: data.in_stock !== undefined ? data.in_stock : data.inStock,
                        stockQuantity: data.stock_quantity || data.stockQuantity,
                        sku: data.sku
                      }
                    }
                  }
                  return item
                }))
              }
            })
            .catch(() => {})
        } else {
          // Create new fetch request in background (non-blocking)
          const fetchPromise = fetch(`/api/products/${productId}`, {
            cache: 'default', // Use CDN cache
            headers: {
              'Cache-Control': 'max-age=60' // Cache for 60 seconds
            }
          }).then(response => response.ok ? response.json() : null)
          
          addItemRequestMap.current.set(requestKey, fetchPromise)
          
          // Don't await - fetch in background
          fetchPromise
            .then(data => {
              if (data) {
                // Update cart with product data in background
                setCart(prev => prev.map(item => {
                  if (item.productId === productId && !item.product) {
                    return {
                      ...item,
                      product: {
                        id: data.id,
                        name: data.name,
                        image: data.image,
                        price: data.price,
                        originalPrice: data.original_price || data.originalPrice,
                        inStock: data.in_stock !== undefined ? data.in_stock : data.inStock,
                        stockQuantity: data.stock_quantity || data.stockQuantity,
                        sku: data.sku
                      }
                    }
                  }
                  return item
                }))
              }
            })
            .catch(() => {})
            .finally(() => {
              // Clean up after 2 seconds
              setTimeout(() => addItemRequestMap.current.delete(requestKey), 2000)
            })
        }
      }

      // Extract variant_name and price from product data
      // Use provided productData immediately if available, otherwise use provided price
      if (productDataToUse) {
          // Extract variant_name and price if variantId is numeric
          if (normalizedVariantId && normalizedVariantId !== 'default' && !normalizedVariantId.toString().startsWith('combination-') && !isNaN(Number(normalizedVariantId))) {
          const variant = productDataToUse.variants?.find((v: any) => v.id === Number(normalizedVariantId))
            if (variant) {
              variantName = variant.variant_name || null
              variantPriceFromDB = parseFloat(variant.price) || null
            }
          }
          // If no variant-specific price, use product price
          if (variantPriceFromDB === null) {
          variantPriceFromDB = parseFloat(productDataToUse.price) || 0
          }
      }
      // Use database price if available, otherwise fall back to provided price
      const finalPriceToUse = variantPriceFromDB !== null && variantPriceFromDB > 0 ? variantPriceFromDB : (variantPrice || finalVariantPrice || 0)

      // Add new product with variant
      const newVariant: SelectedVariant = {
        variantId: normalizedVariantId,
        variant_name: variantName,
        attributes: variantAttributes || {},
        quantity,
        price: finalPriceToUse, // Always use database price
        sku: variantSku,
        image: variantImage
      }
      // Fetch supplier info for guest users in background (non-blocking)
      let supplierInfo: any = null
      if (!isAuthenticated) {
        // Fetch supplier info in background without blocking
        fetch(`/api/products/${productId}/supplier-info`)
          .then(supplierResponse => {
            if (supplierResponse && supplierResponse.ok) {
              return supplierResponse.json()
            }
            return null
          })
          .then(info => {
            if (info) {
              // Update cart item with supplier info in background
              setCart(prev => prev.map(item => {
                if (item.productId === productId) {
                  return {
                    ...item,
                    supplierCompanyName: info.companyName || null,
                    supplierIsVerified: info.isVerified || false,
                    supplierRegion: info.region || null,
                    supplierCompanyLogo: info.companyLogo || null
                  } as any
                }
                return item
              }))
            }
          })
          .catch(() => {}) // Ignore supplier info fetch errors
      }
      const newItem: CartItem = {
          id: Date.now(), // Temporary ID
          productId,
        variants: [newVariant],
        totalQuantity: quantity,
        totalPrice: finalPriceToUse * quantity,
        currency: 'TZS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        product: productDataToUse ? {
          id: productDataToUse.id,
          name: productDataToUse.name,
          image: productDataToUse.image,
          price: productDataToUse.price,
          originalPrice: productDataToUse.original_price || productDataToUse.originalPrice,
          inStock: productDataToUse.in_stock !== undefined ? productDataToUse.in_stock : productDataToUse.inStock,
          stockQuantity: productDataToUse.stock_quantity || productDataToUse.stockQuantity,
          sku: productDataToUse.sku
        } : undefined,
        // Add supplier info for guest users
        ...(supplierInfo ? {
          supplierCompanyName: supplierInfo.companyName || null,
          supplierIsVerified: supplierInfo.isVerified || false,
          supplierRegion: supplierInfo.region || null,
          supplierCompanyLogo: supplierInfo.companyLogo || null
        } : {})
      } as any






      setCart(prev => {
        const newCart = [...prev, newItem]
        return newCart
      })
      setCartTotalItems(prev => prev + quantity)
      setCartSubtotal(prev => prev + (finalPriceToUse * quantity))
    }
    // Show success toast immediately for instant feedback
    toast({
      title: "Added to cart",
      description: "Item has been added to your cart successfully.",
      duration: 2000, // Show for 2 seconds
    })

    // Call API for authenticated users in background (non-blocking)
    if (isAuthenticated) {
      // Don't await - let it happen in background
      (async () => {
        try {
          // Request deduplication for API calls
          const apiRequestKey = `cart-add-${productId}-${normalizedVariantId}-${quantity}`
          
          // Check if same request is already in flight
          if (addItemRequestMap.current.has(apiRequestKey)) {
            // Wait for existing request instead of creating duplicate
            try {
              await addItemRequestMap.current.get(apiRequestKey)
              return // Exit early, existing request will handle everything
            } catch (error) {
              // Continue with new request if existing one failed
            }
          }
          
          // Always send variantId so server can match existing item (same product + variant) and increment qty instead of adding duplicate
          // NOTE: We don't send price - API will fetch authoritative price from database
          const requestBody = {
            productId,
            variantId: normalizedVariantId === 'default' ? undefined : normalizedVariantId,
            quantity,
            // price: NOT SENT - API fetches from database for security
            variantAttributes: variantAttributes
          }
          
          // Create API request promise
          const apiPromise = fetch('/api/cart', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            cache: 'no-store', // Don't cache POST requests
            body: JSON.stringify(requestBody)
          }).then(async (response) => {
          const responseData = await response.json().catch((err) => {
            safeError('🛒 [CLIENT] Failed to parse API response:', err)
            return {}
          })
            return { response, responseData }
          })
          
          // Store promise for deduplication
          addItemRequestMap.current.set(apiRequestKey, apiPromise)
          
          const { response, responseData } = await apiPromise
          
          // Clean up deduplication map after request completes
          setTimeout(() => addItemRequestMap.current.delete(apiRequestKey), 1000)

          if (response.ok) {
            if (typeof safeLog === 'function') {
            }
            // Update cart item with supplier info from API response (if available)
            if (responseData.supplierCompanyName) {
              setCart(prev => prev.map(item => {
                if (item.productId === productId) {
                  return {
                    ...item,
                    supplierCompanyName: responseData.supplierCompanyName || (item as any).supplierCompanyName
                  }
                }
                return item
              }))
            }
            // Reload cart from server to get latest data including supplier info (in background)
            loadServerCart().catch(() => {})

          // Check if this was a partial stock response - show additional toast
          if (responseData.partialStock) {
            const { partialStock } = responseData
            toast({
              title: "Partial Stock Added",
              description: `${responseData.message}\n\n${partialStock.restockMessage}\n\n${partialStock.customerCare.message}\n\nContact: ${partialStock.customerCare.contactInfo.email} | ${partialStock.customerCare.contactInfo.phone}`,
              variant: "default",
              duration: 8000, // Show for 8 seconds to give time to read
            })
          }
        } else {
          safeError('🛒 [CLIENT] ❌ API request failed:', {
            status: response.status,
            statusText: response.statusText
          })

          const errorData = await response.json().catch(() => ({}))
          safeError('🛒 [CLIENT] Error response data:', errorData)

          if (errorData.error === 'Product out of stock') {
            toast({
              title: "Out of Stock",
              description: "This product is currently unavailable.",
              variant: "outOfStock",
              duration: 6000, // Warning message: 6 seconds (within 5000-8000ms range)
            })
          } else {
            toast({
              title: "Error",
              description: "Failed to sync with server. Item added locally.",
              variant: "destructive",
              duration: 4000, // Error message: 4 seconds
            })
          }
          // Rollback optimistic update
          loadServerCart().catch(() => {})
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to sync with server. Item added locally.",
          variant: "destructive",
          duration: 4000, // Error message: 4 seconds
        })

        // Rollback optimistic update
        loadServerCart().catch(() => {})
      }
      })() // Close the async function
    }
  }, [cart, isAuthenticated, loadServerCart, toast])

  // Update item quantity
  const updateItemQuantity = useCallback(async (productId: number, quantity: number, variantId?: string) => {
    const item = cart.find(item => item.productId === productId)

    if (!item) return

    // Optimistic update
    let updatedCart: CartItem[]
    let quantityDiff = 0
    let priceDiff = 0

    if (variantId) {
      // Update specific variant quantity
      const updatedVariants = item.variants.map(v => {
        if (v.variantId === variantId) {
          quantityDiff = quantity - v.quantity
          priceDiff = (v.price * quantity) - (v.price * v.quantity)
          return { ...v, quantity }
        }
        return v
      })

      const totalQuantity = updatedVariants.reduce((sum, v) => sum + v.quantity, 0)
      const totalPrice = updatedVariants.reduce((sum, v) => sum + (v.price * v.quantity), 0)

      updatedCart = cart.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, variants: updatedVariants, totalQuantity, totalPrice }
          : cartItem
      )
    } else {
      // Update entire product quantity (distribute across variants proportionally)
      const totalCurrentQuantity = item.totalQuantity
      const scaleFactor = quantity / totalCurrentQuantity

      const updatedVariants = item.variants.map(v => {
        const newQuantity = Math.round(v.quantity * scaleFactor)
        return { ...v, quantity: newQuantity }
      })

      const totalQuantity = updatedVariants.reduce((sum, v) => sum + v.quantity, 0)
      const totalPrice = updatedVariants.reduce((sum, v) => sum + (v.price * v.quantity), 0)

      quantityDiff = totalQuantity - item.totalQuantity
      priceDiff = totalPrice - item.totalPrice

      updatedCart = cart.map(cartItem =>
      cartItem.id === item.id
          ? { ...cartItem, variants: updatedVariants, totalQuantity, totalPrice }
        : cartItem
    )
    }
    setCart(updatedCart)
    setCartTotalItems(prev => prev + quantityDiff)
    setCartSubtotal(prev => prev + priceDiff)

    // Only call API for authenticated users
    if (isAuthenticated) {
      try {
        const response = await fetch('/api/cart', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            itemId: item.id,
            quantity
          })
        })

        if (!response.ok) {
          // Rollback on error
          await loadServerCart()
          toast({
            title: "Error",
            description: "Failed to update cart. Please try again.",
            variant: "destructive",
            duration: 6000, // Error message: 6 seconds (within 5000-8000ms range)
          })
        }
      } catch (error) {
        // Rollback on error
        await loadServerCart()
        toast({
          title: "Error",
          description: "Failed to update cart. Please try again.",
          variant: "destructive",
          duration: 6000, // Error message: 6 seconds (within 5000-8000ms range)
        })
      }
    }
    // For guest users, the optimistic update is sufficient
  }, [cart, loadServerCart, toast])

  // Remove item from cart
  const removeItem = useCallback(async (productId: number, variantId?: string) => {
    const item = cart.find(item => item.productId === productId)

    if (!item) return

    // Optimistic update
    let updatedCart: CartItem[]
    let removedQuantity = 0
    let removedPrice = 0

    if (variantId) {
      // Remove specific variant
      const updatedVariants = item.variants.filter(v => {
        if (v.variantId === variantId) {
          removedQuantity = v.quantity
          removedPrice = v.price * v.quantity
          return false
        }
        return true
      })

      if (updatedVariants.length === 0) {
        // Remove entire product if no variants left
        updatedCart = cart.filter(cartItem => cartItem.id !== item.id)
      } else {
        // Update product with remaining variants
        const totalQuantity = updatedVariants.reduce((sum, v) => sum + v.quantity, 0)
        const totalPrice = updatedVariants.reduce((sum, v) => sum + (v.price * v.quantity), 0)

        updatedCart = cart.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, variants: updatedVariants, totalQuantity, totalPrice }
            : cartItem
        )
      }
    } else {
      // Remove entire product
      updatedCart = cart.filter(cartItem => cartItem.id !== item.id)
      removedQuantity = item.totalQuantity
      removedPrice = item.totalPrice
    }
    setCart(updatedCart)
    setCartTotalItems(prev => prev - removedQuantity)
    setCartSubtotal(prev => prev - removedPrice)

    // Only call API for authenticated users
    if (isAuthenticated) {
      try {
        const response = await fetch('/api/cart', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            productId: item.productId, // Pass productId to delete all variants
            quantity: 0
          })
        })


        if (!response.ok) {
          // Rollback on error - restore the original cart state
          setCart(cart) // Restore original cart
          setCartTotalItems(prev => prev + removedQuantity) // Restore quantity
          setCartSubtotal(prev => prev + removedPrice) // Restore price

          toast({
            title: "Error",
            description: "Failed to remove item. Please try again.",
            variant: "destructive",
            duration: 6000,
          })
        } else {
          toast({
            title: "Removed",
            description: "Item has been removed from your cart.",
            duration: 500,
          })
        }
      } catch (error) {
        // Rollback on error - restore the original cart state
        setCart(cart) // Restore original cart
        setCartTotalItems(prev => prev + removedQuantity) // Restore quantity
        setCartSubtotal(prev => prev + removedPrice) // Restore price

        toast({
          title: "Error",
          description: "Failed to remove item. Please try again.",
          variant: "destructive",
          duration: 6000,
        })
      }
    } else {
      // For guest users, save to localStorage
      localStorage.setItem('guest_cart', JSON.stringify(updatedCart))
      toast({
        title: "Removed",
        description: "Item has been removed from your cart.",
        duration: 500,
      })
    }
  }, [cart, loadServerCart, toast])

  // Clear entire cart
  const clearCart = useCallback(async () => {
    // Optimistic update
    setCart([])
    setCartTotalItems(0)
    setCartSubtotal(0)

    if (isAuthenticated) {
      try {
        const response = await fetch('/api/cart', {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          // Rollback on error
          await loadServerCart()
          toast({
            title: "Error",
            description: "Failed to clear cart. Please try again.",
            variant: "destructive",
            duration: 6000, // Error message: 6 seconds (within 5000-8000ms range)
          })
        } else {
          toast({
            title: "Cart cleared",
            description: "Your cart has been cleared successfully.",
            duration: 500, // Success message: 500ms (within 300-1000ms range)
          })
        }
      } catch (error) {
        // Rollback on error
        await loadServerCart()
        toast({
          title: "Error",
          description: "Failed to clear cart. Please try again.",
          variant: "destructive",
          duration: 6000, // Error message: 6 seconds (within 5000-8000ms range)
        })
      }
    } else {
      // Clear guest cart
      localStorage.removeItem(CART_STORAGE_KEY)
      toast({
        title: "Cart cleared",
        description: "Your cart has been cleared successfully.",
        duration: 500, // Success message: 500ms (within 300-1000ms range)
      })
    }
  }, [isAuthenticated, loadServerCart, toast, cart.length])

  // Check if item is in cart
  const isInCart = useCallback((productId: number, variantId?: string) => {
    const item = cart.find(item => item.productId === productId)
    if (!item) return false

    if (variantId) {
      return item.variants?.some(v => v.variantId === variantId) || false
    }
    return true // Product is in cart if any variant exists
  }, [cart])

  // Get item quantity in cart
  const getItemQuantity = useCallback((productId: number, variantId?: string) => {
    const item = cart.find(item => item.productId === productId)
    if (!item) return 0

    if (variantId) {
      const variant = item.variants?.find(v => v.variantId === variantId)
      return variant ? variant.quantity : 0
    }
    return item.totalQuantity || 0
  }, [cart])

  // Update guest cart totals when cart changes
  useEffect(() => {
    if (!isAuthenticated) {
      const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0)
      const totalItems = cart.reduce((sum, item) => sum + item.totalQuantity, 0)
      const uniqueProducts = cart.length // Count unique products (cart items)
      setCartSubtotal(subtotal)
      setCartTotalItems(totalItems)
      setCartUniqueProducts(uniqueProducts)
      saveGuestCart(cart, subtotal, totalItems)
    }
  }, [cart, isAuthenticated, saveGuestCart])

  // Update unique products count for authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      const uniqueProducts = cart.length
      setCartUniqueProducts(uniqueProducts)
    }
  }, [cart, isAuthenticated])


  return {
    cart,
    isLoading,
    cartSubtotal,
    cartTotalItems,
    cartUniqueProducts,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
    isInCart,
    getItemQuantity,
    loadServerCart
  }
}
