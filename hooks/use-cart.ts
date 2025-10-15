"use client"

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'

// Types
export interface SelectedVariant {
  variantId: string
  attributes: { [key: string]: string | string[] }
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
  if (keysA.length !== keysB.length) return false
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false
    const va = a[keysA[i]]
    const vb = b[keysA[i]]
    if (Array.isArray(va) || Array.isArray(vb)) {
      const sa = Array.isArray(va) ? va.slice().sort().join(',') : String(va)
      const sb = Array.isArray(vb) ? vb.slice().sort().join(',') : String(vb)
      if (sa !== sb) return false
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
  const [hasAttemptedMerge, setHasAttemptedMerge] = useState(false)

  // Migrate old cart items to new structure
  const migrateCartItem = useCallback((item: any): CartItem => {
    // If item already has new structure, return as is
    if (item.variants && Array.isArray(item.variants)) {
      return item
    }
    
    // Migrate old structure to new structure
    const migratedItem: CartItem = {
      id: item.id,
      productId: item.productId,
      variants: [{
        variantId: item.variantId || 'default',
        attributes: item.attributes || {},
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

  // Load cart data
  const loadServerCart = useCallback(async () => {
    if (!isAuthenticated) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/cart', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data: CartResponse = await response.json()
        const migratedCart = (data.items || []).map(migrateCartItem)
        setCart(migratedCart)
        setCartSubtotal(data.totals.subtotal)
        setCartTotalItems(data.totals.total_items)
      } else {
      }
    } catch (error) {
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, migrateCartItem])

  // Load product data for cart items that don't have it
  const loadProductDataForCartItems = useCallback(async (cartItems: CartItem[]) => {
    const itemsNeedingProductData = cartItems.filter(item => !item.product)
    
    if (itemsNeedingProductData.length === 0) return cartItems
    
    
    const updatedItems = await Promise.all(
      cartItems.map(async (item) => {
        if (item.product) return item // Already has product data
        
        try {
          const response = await fetch(`/api/products/${item.productId}`)
          if (response.ok) {
            const productData = await response.json()
            return {
              ...item,
              product: {
                id: productData.id,
                name: productData.name,
                image: productData.image,
                price: productData.price,
                originalPrice: productData.original_price,
                inStock: productData.in_stock,
                stockQuantity: productData.stock_quantity,
                sku: productData.sku
              }
            }
          }
        } catch (error) {
        }
        
        return item // Return original item if product data loading failed
      })
    )
    
    return updatedItems
  }, [])

  // Load guest cart from localStorage
  const loadGuestCart = useCallback(async () => {
    if (isAuthenticated) return

    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      if (stored) {
        const guestCart = JSON.parse(stored)
        const migratedCart = (guestCart.items || []).map(migrateCartItem)
        
        // Load product data for items that don't have it
        const cartWithProductData = await loadProductDataForCartItems(migratedCart)
        
        setCart(cartWithProductData)
        setCartSubtotal(guestCart.subtotal || 0)
        setCartTotalItems(guestCart.totalItems || 0)
      }
    } catch (error) {
    }
  }, [isAuthenticated, migrateCartItem, loadProductDataForCartItems])

  // Save guest cart to localStorage
  const saveGuestCart = useCallback((items: CartItem[], subtotal: number, totalItems: number) => {
    if (isAuthenticated) return

    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
        items,
        subtotal,
        totalItems
      }))
    } catch (error) {
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

  // Add item to cart with variant attributes
  const addItem = useCallback(async (
    productId: number, 
    quantity: number = 1, 
    variantId?: string,
    variantAttributes?: { [key: string]: string | string[] },
    variantPrice?: number,
    variantSku?: string,
    variantImage?: string
  ) => {
    // Guests are allowed: we update local cart and skip server calls below.
    
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
    // Check if product already exists in cart
    const existingItem = cart.find(item => item.productId === productId)

    if (existingItem) {
      
      
      // Check if this exact selection already exists (match by canonical id OR attributes)
      const existingVariant = existingItem.variants.find(v => (
        v.variantId === normalizedVariantId || areAttributesEqual(v.attributes, variantAttributes)
      ))
      
      if (existingVariant) {
        
        // Update existing variant quantity
        const updatedCart = cart.map(item => {
          if (item.productId === productId) {
            const updatedVariants = item.variants.map(v => 
              (v.variantId === normalizedVariantId || areAttributesEqual(v.attributes, variantAttributes)) 
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
        setCart(updatedCart)
        setCartTotalItems(prev => prev + quantity)
        setCartSubtotal(prev => prev + (finalVariantPrice * quantity))
        
      } else {
        // Add new variant to existing product
        const newVariant: SelectedVariant = {
          variantId: normalizedVariantId,
          attributes: variantAttributes || {},
          quantity,
          price: finalVariantPrice,
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
      setCart(updatedCart)
      setCartTotalItems(prev => prev + quantity)
        setCartSubtotal(prev => prev + (finalVariantPrice * quantity))
        
      }
    } else {

      // Add new product with variant
      const newVariant: SelectedVariant = {
        variantId: normalizedVariantId,
        attributes: variantAttributes || {},
        quantity,
        price: finalVariantPrice,
        sku: variantSku,
        image: variantImage
      }
      
      // Fetch product data for guest users
      let productData = null
      if (!isAuthenticated) {
        try {
          const response = await fetch(`/api/products/${productId}`)
          if (response.ok) {
            productData = await response.json()

          }
        } catch (error) {
        }
      }

      
      const newItem: CartItem = {
          id: Date.now(), // Temporary ID
          productId,
        variants: [newVariant],
        totalQuantity: quantity,
        totalPrice: finalVariantPrice * quantity,
        currency: 'USD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        product: productData ? {
          id: productData.id,
          name: productData.name,
          image: productData.image,
          price: productData.price,
          originalPrice: productData.original_price,
          inStock: productData.in_stock,
          stockQuantity: productData.stock_quantity,
          sku: productData.sku
        } : undefined
      }






      setCart(prev => {
        const newCart = [...prev, newItem]
        return newCart
      })
        setCartTotalItems(prev => prev + quantity)
      setCartSubtotal(prev => prev + (finalVariantPrice * quantity))
      
    }

    // Call API for authenticated users in background (non-blocking)
    if (isAuthenticated) {
      // Don't await - let it happen in background
      (async () => {
        try {
          // For simple products (no attributes), send undefined so API normalizes to NULL
          const isSimpleSelection = !variantAttributes || Object.keys(variantAttributes).length === 0
          const requestBody = {
            productId,
            variantId: isSimpleSelection ? undefined : normalizedVariantId,
            quantity,
            price: finalVariantPrice,
            variantAttributes: variantAttributes
          }

          const response = await fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(requestBody)
          })

          if (response.ok) {
            const responseData = await response.json()

            // Reload cart to get updated data
            await loadServerCart()
          
          // Check if this was a partial stock response
          if (responseData.partialStock) {
            const { partialStock } = responseData
            toast({
              title: "Partial Stock Added",
              description: `${responseData.message}\n\n${partialStock.restockMessage}\n\n${partialStock.customerCare.message}\n\nContact: ${partialStock.customerCare.contactInfo.email} | ${partialStock.customerCare.contactInfo.phone}`,
              variant: "default",
              duration: 8000, // Show for 8 seconds to give time to read
            })
          } else {
            toast({
              title: "Added to cart",
              description: "Item has been added to your cart successfully.",
              duration: 500, // Success message: 500ms (within 300-1000ms range)
            })
          }
        } else {
          const errorData = await response.json()
          
          if (errorData.error === 'Product out of stock') {
            toast({
              title: "Out of Stock",
              description: errorData.message,
              variant: "outOfStock",
              duration: 6000, // Warning message: 6 seconds (within 5000-8000ms range)
            })
          } else {
            toast({
              title: "Error",
              description: errorData.error || "Failed to add item to cart",
              variant: "destructive",
              duration: 6000, // Error message: 6 seconds (within 5000-8000ms range)
            })
          }

          // Rollback optimistic update
          await loadServerCart()
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to add item to cart. Please try again.",
          variant: "destructive",
          duration: 6000, // Error message: 6 seconds (within 5000-8000ms range)
        })

        // Rollback optimistic update
        await loadServerCart()
      }
      })() // Close the async function
    } else {
      // For guest users, just show success message

      toast({
        title: "Added to cart",
        description: "Item has been added to your cart successfully.",
        duration: 500, // Success message: 500ms (within 300-1000ms range)
      })
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
          headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            itemId: item.id,
            quantity: 0
          })
        })

        if (!response.ok) {
          // Rollback on error
          await loadServerCart()
          toast({
            title: "Error",
            description: "Failed to remove item. Please try again.",
            variant: "destructive",
            duration: 6000, // Error message: 6 seconds (within 5000-8000ms range)
          })
        } else {
          toast({
            title: "Removed",
            description: "Item has been removed from your cart.",
            duration: 500, // Success message: 500ms (within 300-1000ms range)
          })
        }
      } catch (error) {
        // Rollback on error
        await loadServerCart()
        toast({
          title: "Error",
          description: "Failed to remove item. Please try again.",
          variant: "destructive",
          duration: 6000, // Error message: 6 seconds (within 5000-8000ms range)
        })
      }
    } else {
      // For guest users, show success message
      toast({
        title: "Removed",
        description: "Item has been removed from your cart.",
        duration: 500, // Success message: 500ms (within 300-1000ms range)
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
          credentials: 'include'
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
      setCartSubtotal(subtotal)
      setCartTotalItems(totalItems)
      saveGuestCart(cart, subtotal, totalItems)
    }
  }, [cart, isAuthenticated, saveGuestCart])


  return {
    cart,
    isLoading,
    cartSubtotal,
    cartTotalItems,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
    isInCart,
    getItemQuantity,
    loadServerCart
  }
}
