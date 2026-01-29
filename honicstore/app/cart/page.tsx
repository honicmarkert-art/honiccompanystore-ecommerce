"use client"

import { BuyerRouteGuard } from '@/components/buyer-route-guard'
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

import { useState, useEffect, useMemo, useRef, useCallback, startTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { LazyImage } from "@/components/lazy-image"
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChevronLeft,
  Menu,
  X,
  DollarSign,
  Landmark,
  MessageSquareText,
  Facebook,
  Instagram,
  Youtube,
  Mail,
  CreditCard,
  Wallet,
  Truck,
  RefreshCcw,
  HelpCircle,
  ClipboardList,
  Coins,
  User,
  Palette,
  Heart,
  Package,
  ChevronRight,
  LogOut,
  Shield,
  MessageSquare,
  Ticket,
  Settings,
  Moon,
  Sun,
  CheckCircle,
  MapPin,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useCart } from "@/hooks/use-cart" // Import useCart hook
import { useProducts } from "@/hooks/use-products" // Import useProducts hook
import { useStock } from "@/hooks/use-stock" // Import useStock hook for real-time stock data
import { useWishlist } from "@/hooks/use-wishlist" // Import useWishlist hook
import { useSavedLater } from "@/hooks/use-saved-later" // Import useSavedLater hook
import { useCompanyContext } from "@/components/company-provider"
import { useCurrency } from "@/contexts/currency-context"
import { useToast } from "@/hooks/use-toast"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { SecurityGuard } from "@/components/security-guard"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { ValidationModal, useValidationModal } from "@/components/ui/validation-modal"
import { UserProfile } from "@/components/user-profile"
import { Footer } from "@/components/footer"
import { useOptimizedNavigation } from "@/components/optimized-link"

export default function CartPage() {
  return (
    <BuyerRouteGuard>
      <CartPageContent />
    </BuyerRouteGuard>
  )
}

function CartPageContent() {
  const { backgroundColor, setBackgroundColor, themeClasses, darkHeaderFooterClasses } = useTheme()
  const { cart, updateItemQuantity, removeItem, cartUniqueProducts, cartSubtotal, clearCart, isLoading } = useCart() // Use useCart hook
  const { navigateWithPrefetch } = useOptimizedNavigation()
  
  // Calculate total cart items (count variants as separate items)
  const totalCartItems = useMemo(() => {
    return cart.reduce((total, item) => {
      return total + (item.variants?.length || 1)
    }, 0)
  }, [cart])
  
  // Calculate total quantity (sum of all variant quantities)
  const totalQuantity = useMemo(() => {
    return cart.reduce((total, item) => {
      return total + (item.variants?.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) || item.totalQuantity || 0)
    }, 0)
  }, [cart])
  const { products } = useProducts() // Use useProducts hook
  const { getStock, fetchStock } = useStock() // Use stock hook for real-time stock data
  const { currency, setCurrency, formatPrice } = useCurrency() // Use global currency context
  
  
  const { companyName, companyColor, companyLogo, isLoaded: companyLoaded } = useCompanyContext()
  
  // Fallback logo system - use local logo if API is not loaded or logo is not available
  const fallbackLogo = "/android-chrome-512x512.png"
  const displayLogo = companyLoaded && companyLogo && companyLogo !== fallbackLogo && companyLogo !== "/placeholder-logo.png" ? companyLogo : fallbackLogo
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, loading: authLoading } = useAuth() // Add auth context
  const { openAuthModal } = useGlobalAuthModal()
  const { items: wishlistItems, add: addToWishlist, remove: removeFromWishlist } = useWishlist() // Use wishlist hook
  const { items: savedForLaterItems, add: addToSavedLater } = useSavedLater() // Use saved later hook
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false)
  const [isQuantityWarningModalOpen, setIsQuantityWarningModalOpen] = useState(false)
  const [quantityWarningItem, setQuantityWarningItem] = useState<{productId: number, variantId?: string, productName: string} | null>(null)
  const { showCheckoutValidation, hideModal, isOpen: isModalOpen, modalProps} = useValidationModal()
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromotion, setAppliedPromotion] = useState<{
    code: string
    name: string
    discountAmount: number
  } | null>(null)
  const [promoError, setPromoError] = useState('')
  const [isApplyingPromo, setIsApplyingPromo] = useState(false)
  
  // Fetch stock data for all cart items (debounced + only when product set changes)
  const stockDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastIdsSignatureRef = useRef<string>("")

  const uniqueSortedProductIds = useMemo(() => {
    const ids = Array.from(new Set(cart.map(i => i.productId)))
    ids.sort((a, b) => a - b)
    return ids
  }, [cart])

  useEffect(() => {
    const signature = uniqueSortedProductIds.join(',')
    if (signature === lastIdsSignatureRef.current) return
    lastIdsSignatureRef.current = signature

    if (stockDebounceRef.current) clearTimeout(stockDebounceRef.current)
    stockDebounceRef.current = setTimeout(() => {
      if (uniqueSortedProductIds.length > 0) {
        fetchStock(uniqueSortedProductIds)
      }
    }, 400)

    return () => {
      if (stockDebounceRef.current) clearTimeout(stockDebounceRef.current)
    }
  }, [uniqueSortedProductIds, fetchStock])

  // Group cart items by supplier (memoized to avoid re-computation)
  const groupedCartItems = useMemo(() => {
    const grouped: { [key: string]: typeof cart } = {}
    cart.forEach(item => {
      // Use supplierCompanyName from API (server-provided, safe)
      // If not available, use a fallback key based on product grouping
      const supplierKey = (item as any).supplierCompanyName || 
        (item as any).supplierName || 
        `group-${item.productId}` // Fallback: group by product if no supplier name
      
      if (!grouped[supplierKey]) {
        grouped[supplierKey] = []
      }
      grouped[supplierKey].push(item)
    })
    return grouped
  }, [cart])
  
  // Calculate supplier subtotals (memoized)
  const supplierSubtotals = useMemo(() => {
    const subtotals: { [key: string]: number } = {}
    Object.entries(groupedCartItems).forEach(([supplierKey, items]) => {
      subtotals[supplierKey] = items.reduce((total, item) => {
        return total + (item.totalPrice || 0)
      }, 0)
    })
    return subtotals
  }, [groupedCartItems])

  const handleQuantityChange = useCallback((productId: number, variantId: string | undefined, delta: number) => {
    const currentItem = cart.find((item) => item.productId === productId)
    if (currentItem) {
      const variant = currentItem.variants.find(v => v.variantId === variantId)
      if (variant) {
        const newQuantity = variant.quantity + delta
        const product = products.find(p => p.id === productId)
        
        // Restrict quantity reduction below 5 for products under 500 TZS
        if (delta < 0 && product && product.price < 500 && newQuantity < 5) {
          setQuantityWarningItem({
            productId,
            variantId,
            productName: product.name
          })
          setIsQuantityWarningModalOpen(true)
          return
        }
        
        // Check stock limits
        const stockQtyInc = getStock(productId)?.stockQuantity ?? (product as any)?.stockQuantity ?? null
        if (delta > 0 && stockQtyInc !== null) {
          if (newQuantity > stockQtyInc) {
            toast({
              title: "Insufficient Stock",
              description: `Only ${stockQtyInc} items available in stock.`,
              variant: "destructive"
            })
            return
          }
        }
        
        // Don't allow negative quantities
        if (newQuantity < 0) {
          return
        }
        
        startTransition(() => {
        updateItemQuantity(productId, newQuantity, variantId)
        })
      }
    }
  }, [cart, products, updateItemQuantity, toast])

  const handleQuantityInput = useCallback((productId: number, variantId: string | undefined, newQuantity: number) => {
    const currentItem = cart.find((item) => item.productId === productId)
    if (currentItem) {
      const variant = currentItem.variants.find(v => v.variantId === variantId)
      if (variant) {
        const product = products.find(p => p.id === productId)
        
        // Validate quantity
        if (newQuantity < 1) {
          newQuantity = 1
        }
        
        // Restrict quantity below 5 for products under 500 TZS
        if (product && product.price < 500 && newQuantity < 5) {
          setQuantityWarningItem({
            productId,
            variantId,
            productName: product.name
          })
          setIsQuantityWarningModalOpen(true)
          return
        }
        
        // Check stock limits
        const stockQtyTyped = getStock(productId)?.stockQuantity ?? (product as any)?.stockQuantity ?? null
        if (stockQtyTyped !== null && newQuantity > stockQtyTyped) {
          toast({
            title: "Insufficient Stock",
            description: `Only ${stockQtyTyped} items available in stock.`,
            variant: "destructive"
          })
          return
        }
        
        startTransition(() => {
          updateItemQuantity(productId, newQuantity, variantId)
        })
      }
    }
  }, [cart, products, updateItemQuantity, toast])

  const handleQuantityInputChange = useCallback((productId: number, variantId: string | undefined, value: string) => {
    const product = products.find(p => p.id === productId)
    
    // If product is under 500 TZS, prevent typing below 5
    if (product && product.price < 500) {
      const numericValue = parseInt(value) || 0
      if (numericValue > 0 && numericValue < 5) {
        // Show warning and reset to 5
        setQuantityWarningItem({
          productId,
          variantId,
          productName: product.name
        })
        setIsQuantityWarningModalOpen(true)
        return
      }
    }
    
    // Allow normal input for other products
    const newQuantity = parseInt(value) || 1
    handleQuantityInput(productId, variantId, newQuantity)
  }, [products, handleQuantityInput])

  const handleRemoveItem = useCallback((productId: number, variantId?: string) => {
    startTransition(() => removeItem(productId, variantId)) // Remove specific variant or entire product
  }, [removeItem])

  const handleClearCart = () => {
    clearCart()
    toast({
      title: "Cart Cleared",
      description: "All items have been removed from your cart.",
    })
  }

  // Calculate dynamic width for quantity input based on number length
  const getQuantityInputWidth = (qty: number) => {
    const numDigits = qty.toString().length
    const baseWidth = 1.5 // Base width in rem for mobile
    const digitWidth = 0.6 // Width per digit in rem
    const maxWidth = 4 // Maximum width in rem
    
    const calculatedWidth = baseWidth + (numDigits - 1) * digitWidth
    return Math.min(calculatedWidth, maxWidth)
  }

  // Calculate dynamic width for desktop quantity input
  const getDesktopQuantityInputWidth = (qty: number) => {
    const numDigits = qty.toString().length
    const baseWidth = 2.5 // Base width in rem for desktop
    const digitWidth = 0.8 // Width per digit in rem
    const maxWidth = 6 // Maximum width in rem
    
    const calculatedWidth = baseWidth + (numDigits - 1) * digitWidth
    return Math.min(calculatedWidth, maxWidth)
  }

  const handleSaveForLater = useCallback(async () => {
    if (cart.length === 0) {
      toast({
        title: "No items to save",
        description: "Your cart is empty. Add some items first.",
        variant: "destructive",
      })
      return
    }
    
    // Add all cart items to saved for later in parallel
    const productIds = cart.map(item => item.productId)
    await Promise.all(productIds.map(productId => addToSavedLater(productId)))
    
    // Clear cart after saving
    clearCart()
    
    toast({
      title: "Items saved for later",
      description: `${cart.length} items have been moved to your saved items.`,
    })
  }, [cart, clearCart, addToSavedLater, toast])

  const handleAddToWishlist = async (productId: number) => {
    const isAlreadyInWishlist = wishlistItems.some(wishlistItem => 
      wishlistItem.productId === productId
    )
    
    if (isAlreadyInWishlist) {
      // Remove from wishlist
      await removeFromWishlist(productId)
      toast({
        title: "Removed from wishlist",
        description: "Item has been removed from your wishlist.",
      })
    } else {
      // Add to wishlist
      const item = cart.find(cartItem => cartItem.productId === productId)
      if (item) {
        await addToWishlist(productId)
        toast({
          title: "Added to wishlist",
          description: `${item.product?.name || `Product ${productId}`} has been added to your wishlist.`,
        })
      }
    }
  }

  const isInWishlist = useCallback((productId: number) => {
    return wishlistItems.some(wishlistItem => wishlistItem.productId === productId)
  }, [wishlistItems])

  // Calculate shipping cost: 5,000 TZS if order is less than 100,000 TZS, otherwise free
  const FREE_SHIPPING_THRESHOLD = 100000 // Back to original threshold
  const SHIPPING_COST = 5000
  
  
  const selectedItems = cart.filter(i => selected[i.productId])
  const hasSelection = selectedItems.length > 0
  // Count items (variants) not quantities - for mobile display
  const selectedItemsCount = hasSelection 
    ? selectedItems.reduce((s,i)=>s+(i.variants?.length || 1), 0)
    : totalCartItems
  // Calculate total quantity (sum of quantities) for desktop display
  const selectedTotalQuantity = hasSelection 
    ? selectedItems.reduce((s,i)=>s+(i.variants?.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) || i.totalQuantity || 0), 0)
    : totalQuantity
  const selectedSubtotal = hasSelection ? selectedItems.reduce((s,i)=>s+i.totalPrice,0) : cartSubtotal

  const calculateShippingFee = (subtotal: number) => {
    // If cart total >= 100,000 TZS: Free delivery for all
    if (subtotal >= FREE_SHIPPING_THRESHOLD) return 0
    
    // If cart total < 100,000 TZS: Check if ALL selected products have free delivery
    const allProductsHaveFreeDelivery = selectedItems.every(item => {
      const product = products.find(p => p.id === item.productId)
      return (product as any)?.free_delivery === true || product?.freeDelivery === true
    })
    
    // If ALL products have free delivery: Free delivery
    // If MIXED products (some free, some paid): Apply delivery fee
    return allProductsHaveFreeDelivery ? 0 : SHIPPING_COST
  }

  // Function to determine delivery status for each product
  const getDeliveryStatus = (product: any, itemTotal: number) => {
    // Check if cart total qualifies for free shipping
    const cartQualifiesForFreeShipping = cartSubtotal >= FREE_SHIPPING_THRESHOLD
    
    // Check if individual product has free delivery (check both camelCase and snake_case)
    const productHasFreeDelivery = product?.free_delivery === true || product?.freeDelivery === true
    
    // Check if product is from China (longer delivery time)
    const isChinaImport = (product as any)?.import_china === true || product?.importChina === true
    
    // Calculate delivery days: 10 days for China imports, 3 days for local products
    const deliveryDays = isChinaImport ? 10 : 3
    const deliveryEndDate = new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000)
    
    // Priority: Cart total threshold takes precedence
    // If cart total >= 100,000 TZS: All products get free delivery
    // If cart total < 100,000 TZS: Only products with free_delivery: true get free delivery
    if (cartQualifiesForFreeShipping || (cartSubtotal < FREE_SHIPPING_THRESHOLD && productHasFreeDelivery)) {
      return {
        isFree: true,
        text: `Free delivery ${new Date().toLocaleDateString('en-GB')} - ${deliveryEndDate.toLocaleDateString('en-GB')}`,
        color: "text-green-600"
      }
    } else {
      // Show delivery fee with date
      return {
        isFree: false,
        text: `Delivery: ${formatPrice(SHIPPING_COST)} ${new Date().toLocaleDateString('en-GB')} - ${deliveryEndDate.toLocaleDateString('en-GB')}`,
        color: "text-orange-600"
      }
    }
  }
  
  const shippingCost = calculateShippingFee(selectedSubtotal)
  const discountAmount = appliedPromotion ? appliedPromotion.discountAmount : 0
  const total = selectedSubtotal + shippingCost - discountAmount

  const handleApplyPromo = useCallback(async () => {
    if (!promoCode.trim()) return

    setIsApplyingPromo(true)
    setPromoError('')

    try {
      const cartItemsForPromo = cart.map(item => ({
        productId: item.productId,
        product_id: item.productId,
        price: item.totalPrice / (item.totalQuantity || 1), // Average price per unit
        quantity: item.totalQuantity || 1
      }))

      // Calculate current subtotal
      const currentSelectedItems = cart.filter(i => selected[i.productId])
      const currentSubtotal = currentSelectedItems.length > 0 
        ? currentSelectedItems.reduce((s,i)=>s+i.totalPrice,0) 
        : cartSubtotal

      const response = await fetch('/api/promotions/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: promoCode.trim(),
          cartItems: cartItemsForPromo,
          subtotal: currentSubtotal
        })
      })

      const result = await response.json()

      if (result.success) {
        setAppliedPromotion({
          code: result.promotion.code,
          name: result.promotion.name,
          discountAmount: result.promotion.discountAmount
        })
        toast({
          title: 'Promotion Applied',
          description: `${result.promotion.name} - ${formatPrice(result.promotion.discountAmount)} discount applied!`,
        })
      } else {
        setPromoError(result.error || 'Invalid promotion code')
      }
    } catch (error) {
      setPromoError('Failed to apply promotion code. Please try again.')
    } finally {
      setIsApplyingPromo(false)
    }
  }, [promoCode, cart, cartSubtotal, toast, formatPrice])

  const toggleSelected = useCallback((productId: number) => {
    setSelected(prev => ({ ...prev, [productId]: !prev[productId] }))
  }, [])

  const allSelected = cart.length > 0 && selectedItems.length === cart.length
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected({})
    } else {
      const map: Record<number, boolean> = {}
      for (const it of cart) map[it.productId] = true
      setSelected(map)
    }
  }

  const handleProceedToCheckout = () => {
    const selectedIds = cart.filter(i => selected[i.productId]).map(i => i.productId)
    if (selectedIds.length === 0) {
      showCheckoutValidation(
        'Please select at least one item to proceed to checkout.',
        () => {
          hideModal()
          // Optionally scroll to cart items
          const cartSection = document.querySelector('[data-cart-items]')
          if (cartSection) {
            cartSection.scrollIntoView({ behavior: 'smooth' })
          }
        }
      )
      return
    }
    try { 
      // Validate selectedIds before storing
      if (Array.isArray(selectedIds) && selectedIds.every(id => typeof id === 'number' && id > 0)) {
        sessionStorage.setItem('selected_cart_items', JSON.stringify(selectedIds))
      }
      // Store applied promotion if any
      if (appliedPromotion && 
          typeof appliedPromotion.code === 'string' && 
          typeof appliedPromotion.discountAmount === 'number' && 
          appliedPromotion.discountAmount >= 0) {
        sessionStorage.setItem('applied_promotion', JSON.stringify({
          code: appliedPromotion.code,
          discountAmount: appliedPromotion.discountAmount
        }))
      } else {
        sessionStorage.removeItem('applied_promotion')
      }
      // Clear "Buy Now" mode when proceeding from cart
      sessionStorage.removeItem('buy_now_mode')
      sessionStorage.removeItem('buy_now_item_data')
    } catch (error) {
      // Silently handle storage errors
    }
    router.push('/checkout')
  }

  return (
    <div className={cn("flex flex-col min-h-screen w-full", themeClasses.mainBg, themeClasses.mainText)} suppressHydrationWarning>
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
        <div className="flex items-center h-10 sm:h-16 px-0 pr-[10px] sm:px-6 lg:px-8 w-full" suppressHydrationWarning>
          {/* Mobile Hamburger Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="mobile-menu-toggle desktop-nav:hidden flex items-center justify-center w-8 h-8 mr-2"
            onClick={() => setIsHamburgerMenuOpen(true)}
            suppressHydrationWarning
          >
            <Menu className="w-6 h-6" />
            <span className="sr-only">Open menu</span>
          </Button>

          {/* Back Button - Use referrer when not from checkout; otherwise go to products */}
          <Button
            variant="ghost"
            onClick={() => {
              try {
                const ref = document.referrer || ''
                const sameOrigin = ref && new URL(ref, window.location.origin).origin === window.location.origin
                const fromCheckout = /\/checkout(\b|\/?)/.test(ref)
                if (sameOrigin && !fromCheckout) {
                  router.back()
                } else {
                  // Mark that we're returning from cart page
                  if (typeof window !== 'undefined') {
                    try {
                      sessionStorage.setItem('navigated_from_cart', 'true')
                    } catch (e) {
                      // Ignore storage errors
                    }
                  }
                  navigateWithPrefetch('/products', { priority: 'medium', scroll: false })
                }
              } catch {
                // Mark that we're returning from cart page
                if (typeof window !== 'undefined') {
                  try {
                    sessionStorage.setItem('navigated_from_cart', 'true')
                  } catch (e) {
                    // Ignore storage errors
                  }
                }
                navigateWithPrefetch('/products', { priority: 'medium', scroll: false })
              }
            }}
            className="flex items-center gap-1 text-xs font-semibold flex-shrink-0 text-gray-900 dark:text-white p-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Products</span>
            <span className="sm:hidden">Back</span>
          </Button>

          {/* Logo */}
          <Link
            href="/home"
            className="flex items-center gap-2 text-lg font-semibold md:text-base ml-2 lg:ml-8 flex-shrink-0 text-gray-900 dark:text-white"
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
          </Link>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 lg:gap-4 ml-auto flex-shrink-0">
            {/* Theme Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const newTheme = (backgroundColor === 'white' || backgroundColor === 'gray') ? 'dark' : 'white'
                setBackgroundColor(newTheme)
              }}
              className={cn(
                "flex items-center gap-1",
                darkHeaderFooterClasses.buttonGhostText,
              )}
              title={(backgroundColor === 'white' || backgroundColor === 'gray') ? 'Switch to dark theme' : 'Switch to light theme'}
              suppressHydrationWarning
            >
              {(backgroundColor === 'white' || backgroundColor === 'gray') ? (
                <>
                  <Moon className="w-5 h-5" />
                  <span className="hidden sm:inline hover:opacity-80 transition-opacity" suppressHydrationWarning>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-5 h-5" />
                  <span className="hidden sm:inline hover:opacity-80 transition-opacity" suppressHydrationWarning>Light</span>
                </>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex items-center gap-1 bg-transparent text-xs sm:text-sm w-[20px] h-[10px] sm:w-auto sm:h-auto",
                    "border-0 sm:border sm:border-yellow-500",
                    "hover:border-0 sm:hover:border sm:hover:border-yellow-500",
                    darkHeaderFooterClasses.buttonGhostText,
                    "sm:[&:hover]:bg-opacity-10",
                  )}
                >
                  {currency === "USD" ? <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" /> : <Landmark className="w-3 h-3 sm:w-4 sm:h-4" />}
                  <span className="hidden sm:inline">{currency}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={cn(
                  // Force solid backgrounds in both themes
                  "bg-white text-neutral-900 border border-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800",
                )}
              >
                <DropdownMenuItem
                  onClick={() => setCurrency("USD")}
                  className={darkHeaderFooterClasses.dropdownItemHoverBg}
                >
                  <DollarSign className="w-4 h-4 mr-2" /> USD
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setCurrency("TZS")}
                  className={darkHeaderFooterClasses.dropdownItemHoverBg}
                >
                  <Landmark className="w-4 h-4 mr-2" /> TZS
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link href="/cart">
              <Button
                variant="default"
                size="icon"
                className="relative bg-white text-neutral-950 hover:bg-neutral-100 rounded-full text-sm w-7 h-7 sm:w-10 sm:h-10"
              >
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="sr-only">Shopping Cart</span>
                <span className="absolute -top-1 -right-1 flex h-3 w-3 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {cartUniqueProducts}
                </span>
              </Button>
            </Link>

            {/* User Profile - Hidden on Mobile */}
            <div className="hidden sm:block">
            {isAuthenticated ? (
              <div className="flex flex-col items-center">
              <UserProfile />
                <span className={cn("text-xs mt-1", themeClasses.mainText)}>
                  {(user as any)?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                </span>
              </div>
            ) : (
                <DropdownMenu key="unauthenticated">
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                        "flex items-center gap-1 h-auto py-2 px-1 sm:px-2 ml-1 sm:ml-2 group border border-transparent hover:border-white/20 hover:bg-transparent",
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
                      "w-48 sm:w-56",
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
                  <DropdownMenuItem className={darkHeaderFooterClasses.dropdownItemHoverBg}>
                    <ClipboardList className="w-4 h-4 mr-2" /> My Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem className={darkHeaderFooterClasses.dropdownItemHoverBg}>
                      <MessageSquare className="w-4 h-4 mr-2" /> Message Center
                  </DropdownMenuItem>
                  <DropdownMenuItem className={darkHeaderFooterClasses.dropdownItemHoverBg}>
                    <CreditCard className="w-4 h-4 mr-2" /> Payment
                  </DropdownMenuItem>
                  <DropdownMenuItem className={darkHeaderFooterClasses.dropdownItemHoverBg}>
                    <Heart className="w-4 h-4 mr-2" /> Wish List
                  </DropdownMenuItem>
                  <DropdownMenuItem className={darkHeaderFooterClasses.dropdownItemHoverBg}>
                    <Ticket className="w-4 h-4 mr-2" /> My Coupons
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full pt-[5.5rem] sm:pt-[5.5rem] pb-4 sm:pb-6 px-2 sm:px-4 lg:px-8" suppressHydrationWarning>
        <div className="max-w-7xl mx-auto">
          {/* Progress Indicator */}
          <div className="mb-4 sm:mb-8">
            <div className="flex items-center justify-center space-x-2 sm:space-x-4">
              <div className="flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs sm:text-sm font-bold">1</span>
                </div>
                <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-medium">Cart</span>
              </div>
              <div className="w-8 sm:w-12 h-0.5 bg-gray-300"></div>
              <div className="flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 text-xs sm:text-sm font-bold">2</span>
                </div>
                <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-gray-500">Shipping</span>
              </div>
              <div className="w-8 sm:w-12 h-0.5 bg-gray-300"></div>
              <div className="flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 text-xs sm:text-sm font-bold">3</span>
                </div>
                <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-gray-500">Payment</span>
              </div>
            </div>
          </div>

          <h1 className={cn("text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6", themeClasses.mainText)}>Shopping Cart</h1>

        {isLoading ? (
          <div className={cn("text-center py-16 sm:py-20", themeClasses.textNeutralSecondary)} suppressHydrationWarning>
            <div className="max-w-md mx-auto">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mx-auto mb-6"></div>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3">Loading your cart...</h2>
              <p className="text-sm sm:text-base mb-8 opacity-80">
                Please wait while we fetch your cart items.
              </p>
            </div>
          </div>
        ) : cart.length === 0 ? (
            <div className={cn("text-center py-16 sm:py-20", themeClasses.textNeutralSecondary)} suppressHydrationWarning>
              <div className="max-w-md mx-auto">
                <ShoppingCart className={cn("w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-6", themeClasses.textNeutralSecondary)} />
                <h2 className="text-xl sm:text-2xl font-semibold mb-3">Your cart is empty</h2>
                <p className="text-sm sm:text-base mb-8 opacity-80">
                  Looks like you haven't added anything to your cart yet.
                </p>
            <Link href="/products">
                  <Button className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600 px-8 py-3 text-base">
                    Start Shopping
                  </Button>
            </Link>
              </div>
          </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8" suppressHydrationWarning>
              {/* Cart Items List - Left Side */}
              <div className="lg:col-span-2 flex flex-col" data-cart-items suppressHydrationWarning>
                {/* Cart Header with Stats */}
                <div className={cn(
                  "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded-lg border",
                  "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200",
                  "dark:bg-gradient-to-r dark:from-gray-800 dark:to-gray-700 dark:border-gray-600"
                )}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                      <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 dark:text-yellow-400" />
                      <span className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>
                        Cart Items ({hasSelection ? selectedItems.reduce((sum, item) => sum + (item.variants?.length || 1), 0) : totalCartItems})
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 text-sm">
                      <span className={cn(themeClasses.textNeutralSecondary)}>
                        Total Items: {selectedTotalQuantity}
                      </span>
                      <span className={cn(themeClasses.textNeutralSecondary)}>
                        Subtotal: {formatPrice(selectedSubtotal)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <div className="flex sm:hidden items-center gap-2 text-xs">
                      <span className={cn(themeClasses.textNeutralSecondary)}>
                        Items: {selectedItemsCount}
                      </span>
                      <span className={cn(themeClasses.textNeutralSecondary)}>
                        Total: {formatPrice(selectedSubtotal)}
                      </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowClearConfirm(true)}
                      className={cn(
                          "text-xs",
                        themeClasses.borderNeutralSecondary,
                        themeClasses.buttonGhostHoverBg,
                      )}
                    >
                      Clear All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveForLater}
                      className={cn(
                          "text-xs",
                        themeClasses.borderNeutralSecondary,
                        themeClasses.buttonGhostHoverBg,
                      )}
                    >
                      Save for Later
                    </Button>
                    </div>
                  </div>
                </div>




                {/* Cart Items - Scrollable Container */}
                <div 
                  className="flex-1 overflow-y-auto max-h-[85vh] space-y-3 pl-2 pt-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
                  style={{
                    direction: 'rtl',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#d1d5db transparent'
                  }}
                >
                  <div style={{ direction: 'ltr' }}>
                    {/* Group cart items by supplier */}
                    {Object.entries(groupedCartItems).map(([supplierKey, supplierItems]) => {
                        const firstItem = supplierItems[0] as any
                        // Get supplier company name (same as displayed on product detail page) - NO FALLBACK
                        // Use company_name from profiles table (same as /api/products/[id]/supplier-info)
                        // SECURITY: This comes from server, no UUID exposure
                        const displaySupplierName = (firstItem as any).supplierCompanyName || null
                        const supplierIsVerified = (firstItem as any).supplierIsVerified || false
                        const supplierRegion = (firstItem as any).supplierRegion || null
                        const supplierNation = (firstItem as any).supplierNation || null
                        const supplierCompanyLogo = (firstItem as any).supplierCompanyLogo || null
                        const supplierSubtotal = supplierSubtotals[supplierKey] || 0
                        
                        // Calculate total items for this supplier
                        const supplierTotalItems = supplierItems.reduce((total, item) => {
                          return total + (item.totalQuantity || 0)
                        }, 0)
                        
                        // Build location string - only region and nation (not location field)
                        const locationParts = []
                        if (supplierRegion) locationParts.push(supplierRegion)
                        if (supplierNation) locationParts.push(supplierNation)
                        const locationString = locationParts.length > 0 ? locationParts.join(', ') : null
                        
                        return (
                          <div key={supplierKey} className="mb-6">
                            {/* Supplier Header - Display above the card with gradient background */}
                            {displaySupplierName && (
                              <div className={cn(
                                "mb-3 px-3 py-2 sm:px-4 sm:py-3 rounded-t-lg border-2 border-b-0",
                                "bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50",
                                "dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20",
                                themeClasses.cardBorder,
                                "font-semibold text-sm sm:text-base md:text-lg",
                                themeClasses.mainText,
                                "flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 md:gap-3"
                              )}>
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                                  {/* Company Logo - only show if available */}
                                  {supplierCompanyLogo && (
                                    <div className="flex-shrink-0">
                                      <Image
                                        src={supplierCompanyLogo}
                                        alt={`${displaySupplierName} logo`}
                                        width={32}
                                        height={32}
                                        className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                                      />
                                    </div>
                                  )}
                                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                  <span className="flex-1 text-xs sm:text-sm md:text-base truncate">{displaySupplierName}</span>
                                  {/* Verification badge - moved right after company name */}
                                  {supplierIsVerified && (
                                    <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 text-green-600 dark:text-green-500 font-bold stroke-[3]" />
                                      <span className="px-1.5 py-[1px] sm:px-2 sm:py-0.5 bg-blue-600 dark:bg-blue-500 text-[9px] sm:text-xs font-medium text-white rounded">Verified</span>
                                    </div>
                                  )}
                                </div>
                                {/* Location - only region and nation */}
                                {locationString && (
                                  <div className="flex items-center gap-1 sm:gap-1.5 text-gray-600 dark:text-gray-400">
                                    <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                                    <span className="text-[10px] sm:text-xs md:text-sm truncate">{locationString}</span>
                                  </div>
                                )}
                                {/* Supplier Subtotal */}
                                <div className="flex items-center gap-1 sm:gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                                  <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                                  <span className="text-[10px] sm:text-xs md:text-sm">
                                    {formatPrice(supplierSubtotal)} ({supplierTotalItems} {supplierTotalItems === 1 ? 'item' : 'items'})
                                  </span>
                                </div>
                              </div>
                            )}
                            
                            {/* Supplier's Products Card - All products from this supplier in one card */}
                            <Card className={cn(
                              displaySupplierName ? "rounded-t-none rounded-b-lg" : "",
                              themeClasses.cardBg,
                              themeClasses.cardBorder,
                              "mb-4"
                            )}>
                              <CardContent className="p-4">
                                {/* Supplier's Products - All grouped together */}
                                <div className="space-y-3">
                                {supplierItems.slice().reverse().flatMap((item, itemIndex) => {
                              const product = products.find(p => p.id === item.productId) || item.product
                              const stockData = getStock(item.productId)
                              
                              // Display each variant as an independent item
                              return (item.variants || []).map((variant: any, variantIndex: number) => {
                      const stockQty = stockData?.stockQuantity ?? (product as any)?.stockQuantity ?? null
                      const variantStockQty = variant.stock_quantity ?? variant.stockQuantity ?? stockQty
                      const variantPrice = variant.price || item.totalPrice / item.totalQuantity
                      const variantQuantity = variant.quantity || 1
                      const variantTotalPrice = variantPrice * variantQuantity
                      const uniqueKey = `${item.productId}-${variant.variantId || variantIndex}-${itemIndex}`
                      const unitPrice = variantPrice
                      const discountPercentage = product?.originalPrice && product.originalPrice > unitPrice
                        ? ((product.originalPrice - unitPrice) / product.originalPrice) * 100
                        : 0

                      return (
                        <div
                          key={uniqueKey}
                          className={cn(
                            "transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 group rounded-sm p-2 sm:p-3 border-b border-neutral-200 dark:border-gray-700 last:border-b-0",
                          )}
                        >
                          <div className="flex gap-1 sm:gap-2">
                            {/* Product Image */}
                              <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={!!selected[item.productId]}
                                onChange={() => toggleSelected(item.productId)}
                                className="mt-1"
                              />
                              <Link href={`/products/${item.productId}-${encodeURIComponent(product?.name || 'product')}?returnTo=${encodeURIComponent('/cart')}`} className="flex-shrink-0">
                              <div className="relative">
                                {product?.image && (
                                  <LazyImage
                                    src={product.image}
                                    alt={product.name}
                                    width={50}
                                    height={50}
                                    className="w-12 h-12 sm:w-16 sm:h-16 rounded object-cover border border-neutral-200 hover:border-yellow-500 transition-colors bg-gray-50"
                                    priority={false} // Not priority since it's in a list
                                    quality={80}
                                  />
                                )}
                                {discountPercentage > 0 && (
                                  <div className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[7px] sm:text-[10px] font-bold px-0.5 sm:px-1.5 py-0.5 rounded-full">
                                    -{discountPercentage.toFixed(0)}%
                                  </div>
                                )}
                              </div>
                              </Link>
                            </div>
                            
                            {/* Product Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-1">
                                <div className="flex-1 min-w-0">
                                  <Link href={`/products/${item.productId}-${encodeURIComponent(product?.name || 'product')}?returnTo=${encodeURIComponent('/cart')}`}>
                                    <h3 className={cn(
                                      "font-semibold text-xs sm:text-base hover:underline line-clamp-2",
                                      themeClasses.mainText
                                    )}>
                                      {product?.name || `Product ${item.productId}`}
                                      {variant.variant_name && (
                                        <span className="font-normal text-blue-600 dark:text-blue-400">
                                          {" | "}{variant.variant_name}
                                        </span>
                                      )}
                                    </h3>
                                  </Link>

                                  {/* Price Display */}
                                  <div className="flex flex-wrap items-baseline gap-0.5 mt-0.5 sm:mt-2">
                                    <span className={cn("font-semibold text-[10px] sm:text-sm", themeClasses.mainText)}>
                                      {formatPrice(variantPrice)}
                                    </span>
                                    {product?.originalPrice && product.originalPrice > variantPrice && (
                                      <>
                                        <span className={cn("text-[9px] sm:text-xs line-through", themeClasses.textNeutralSecondary)}>
                                          {formatPrice(product.originalPrice)}
                                        </span>
                                        <span className="text-[9px] sm:text-xs font-medium text-green-500 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-0.5 sm:px-1.5 py-0.5 rounded">
                                          Save {formatPrice(product.originalPrice - variantPrice)}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  {/* Delivery estimate */}
                                  <div className={cn("flex items-center gap-0.5 mt-0.5 sm:mt-2 text-[9px] sm:text-xs", getDeliveryStatus(product, variantTotalPrice).color)}>
                                    <Truck className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                                    <span>{getDeliveryStatus(product, variantTotalPrice).text}</span>
                                </div>

                                  {/* Mobile: Quantity Controls and Actions below product details */}
                                  <div className="flex flex-col gap-1 mt-1 sm:hidden">
                                    {/* Minimum quantity indicator for products under 500 TZS */}
                                    {product && product.price < 500 && (
                                      <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                                        Min. Qty: 5
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                    <div className="flex items-center border rounded overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-600">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleQuantityChange(item.productId, variant.variantId, -1)}
                                disabled={variantQuantity <= 1 || (product && product.price < 500 && variantQuantity <= 5)}
                                        className="rounded-none h-5 w-5 text-neutral-950 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-700"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </Button>
                                      <Input
                                        type="number"
                                        min={product && product.price < 500 ? "5" : "1"}
                                        value={variantQuantity}
                                        onChange={(e) => {
                                          handleQuantityInputChange(item.productId, variant.variantId, e.target.value)
                                        }}
                                        onKeyDown={(e) => {
                                          if (product && product.price < 500) {
                                            const key = e.key
                                            const currentValue = (e.target as HTMLInputElement).value
                                            const newValue = currentValue + key
                                            const numericValue = parseInt(newValue) || 0
                                            
                                            // Prevent typing if it would result in a value below 5
                                            if (numericValue > 0 && numericValue < 5) {
                                              e.preventDefault()
                                              setQuantityWarningItem({
                                                productId: item.productId,
                                                variantId: variant.variantId,
                                                productName: product.name
                                              })
                                              setIsQuantityWarningModalOpen(true)
                                            }
                                          }
                                        }}
                                        style={{
                                          width: `${getQuantityInputWidth(variantQuantity)}rem`,
                                          minWidth: '1.5rem',
                                          maxWidth: '4rem'
                                        }}
                                        className="px-1 py-0.5 text-[10px] font-medium text-neutral-950 dark:text-gray-100 text-center border-0 rounded-none h-5 focus:ring-0 focus:border-0 transition-all duration-200 ease-in-out"
                                      />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleQuantityChange(item.productId, variant.variantId, 1)}
                                disabled={variantStockQty !== null && variantQuantity >= variantStockQty}
                                className="rounded-none h-5 w-5 text-neutral-950 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </Button>
                            </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleAddToWishlist(item.productId)}
                                      className={cn(
                                          "h-5 w-5 hover:bg-blue-50 hover:text-blue-600",
                                          isInWishlist(item.productId) 
                                            ? "text-blue-600 fill-blue-600" 
                                            : "text-blue-500",
                                        themeClasses.buttonGhostHoverBg,
                                      )}
                                    >
                                        <Heart className={cn(
                                          "w-2.5 h-2.5",
                                          isInWishlist(item.productId) && "fill-current"
                                        )} />
                                    </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                                        onClick={() => handleRemoveItem(item.productId, variant.variantId)}
                            className={cn(
                                          "h-5 w-5 text-red-500 hover:bg-red-50 hover:text-red-600",
                              themeClasses.buttonGhostHoverBg,
                            )}
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                                      </Button>
                                    </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Desktop: Quantity Controls and Actions - Right side */}
                                <div className="hidden sm:flex flex-col items-center gap-1">
                                  {/* Minimum quantity indicator for products under 500 TZS */}
                                  {product && product.price < 500 && (
                                    <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                      Min. Qty: 5
                                    </div>
                                  )}
                                  <div className="flex items-center border rounded overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-600">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleQuantityChange(item.productId, variant.variantId, -1)}
                                      disabled={variantQuantity <= 1 || (product && product.price < 500 && variantQuantity <= 5)}
                                      className="rounded-none h-7 w-7 text-neutral-950 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-700"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={product && product.price < 500 ? "5" : "1"}
                                      value={variantQuantity}
                                      onChange={(e) => {
                                        handleQuantityInputChange(item.productId, variant.variantId, e.target.value)
                                      }}
                                      onKeyDown={(e) => {
                                        if (product && product.price < 500) {
                                          const key = e.key
                                          const currentValue = (e.target as HTMLInputElement).value
                                          const newValue = currentValue + key
                                          const numericValue = parseInt(newValue) || 0
                                          
                                          // Prevent typing if it would result in a value below 5
                                          if (numericValue > 0 && numericValue < 5) {
                                            e.preventDefault()
                                            setQuantityWarningItem({
                                              productId: item.productId,
                                              variantId: variant.variantId,
                                              productName: product.name
                                            })
                                            setIsQuantityWarningModalOpen(true)
                                          }
                                        }
                                      }}
                                      style={{
                                        width: `${getDesktopQuantityInputWidth(variantQuantity)}rem`,
                                        minWidth: '2.5rem',
                                        maxWidth: '6rem'
                                      }}
                                      className="px-2 py-0.5 text-sm font-medium text-neutral-950 dark:text-gray-100 text-center border-0 rounded-none h-7 focus:ring-0 focus:border-0 transition-all duration-200 ease-in-out"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleQuantityChange(item.productId, variant.variantId, 1)}
                                      disabled={variantStockQty !== null && variantQuantity >= variantStockQty}
                                      className="rounded-none h-7 w-7 text-neutral-950 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleAddToWishlist(item.productId)}
                                      className={cn(
                                        "h-7 w-7 hover:bg-blue-50 hover:text-blue-600",
                                        isInWishlist(item.productId) 
                                          ? "text-blue-600 fill-blue-600" 
                                          : "text-blue-500",
                                        themeClasses.buttonGhostHoverBg,
                                      )}
                                    >
                                      <Heart className={cn(
                                        "w-3.5 h-3.5",
                                        isInWishlist(item.productId) && "fill-current"
                                      )} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRemoveItem(item.productId, variant.variantId)}
                                      className={cn(
                                        "h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600",
                                        themeClasses.buttonGhostHoverBg,
                                      )}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                              </div>

                              {/* Item Total Price */}
                              <div className="flex items-center justify-between mt-0.5 sm:mt-2 pt-0.5 sm:pt-1 border-t border-neutral-200 dark:border-gray-600">
                                <span className={cn("text-[10px] sm:text-sm", themeClasses.textNeutralSecondary)}>Item Total Price:</span>
                                <span className={cn("font-bold text-xs sm:text-base", themeClasses.mainText)}>
                        {formatPrice(variantTotalPrice)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                              )
                            })
                          })}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )
                      })}
                  </div>
            </div>

              </div>

              {/* Order Summary - Right Side */}
              <div className="lg:col-span-1">
                <Card className={cn(
                  "sticky top-24 h-fit",
                  themeClasses.cardBg,
                  themeClasses.cardBorder,
                )} suppressHydrationWarning>
                  <CardContent className="p-6 space-y-6">
                    <h2 className={cn("text-xl font-bold", themeClasses.mainText)}>Order Summary</h2>
                    
                    {/* Summary Details */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>Subtotal ({hasSelection ? selectedItems.length : cart.length} items):</span>
                        <span className={cn("font-medium", themeClasses.mainText)}>{formatPrice(selectedSubtotal)}</span>
                      </div>
                      
                      {discountAmount > 0 && (
                        <div className="flex justify-between">
                          <span className={cn("text-sm text-green-600 dark:text-green-400", themeClasses.textNeutralSecondary)}>Discount:</span>
                          <span className={cn("font-medium text-green-600 dark:text-green-400", themeClasses.mainText)}>
                            -{formatPrice(discountAmount)}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex justify-between">
                        <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>Shipping:</span>
                        <span className={cn("font-medium", shippingCost === 0 ? "text-green-500" : themeClasses.mainText)}>
                          {shippingCost === 0 ? "Free" : formatPrice(shippingCost)}
                        </span>
                      </div>
                      
                      <div className="border-t pt-3">
                        <div className="flex justify-between">
                          <span className={cn("text-lg font-bold", themeClasses.mainText)}>Total:</span>
                          <span className={cn("text-lg font-bold", themeClasses.mainText)}>
                            {formatPrice(total)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Promo Code */}
                    <div className="space-y-2">
                      {appliedPromotion ? (
                        <div className="flex items-center justify-between p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Ticket className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                              <span className="text-xs sm:text-sm font-semibold text-green-800 dark:text-green-200">
                                {appliedPromotion.code}
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-300">
                              {appliedPromotion.name} • {formatPrice(appliedPromotion.discountAmount)} discount applied
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAppliedPromotion(null)
                              setPromoCode('')
                              setPromoError('')
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 h-6 w-6 p-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              placeholder="Enter promo code"
                              value={promoCode}
                              onChange={(e) => {
                                setPromoCode(e.target.value.toUpperCase())
                                setPromoError('')
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleApplyPromo()
                                }
                              }}
                              className={cn(
                                "flex-1 text-xs sm:text-sm",
                                promoError ? "border-red-500" : "",
                                themeClasses.cardBg,
                                themeClasses.borderNeutralSecondary
                              )}
                            />
                            <Button 
                              size="sm" 
                              className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600 text-xs sm:text-sm px-2 sm:px-3"
                              onClick={handleApplyPromo}
                              disabled={isApplyingPromo || !promoCode.trim()}
                            >
                              {isApplyingPromo ? '...' : 'Apply'}
                            </Button>
                          </div>
                          {promoError && (
                            <p className="text-[10px] sm:text-xs text-red-600 dark:text-red-400">
                              {promoError}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      {/* Checkout Reminder Text */}
                      <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 font-medium">
                          Please check all through your products item before checkout
                        </p>
                      </div>
                      
                      <Button 
                        className="w-full bg-yellow-500 text-neutral-950 hover:bg-yellow-600 py-2 sm:py-3 text-sm sm:text-base font-semibold"
                        size="lg"
                        onClick={handleProceedToCheckout}
                      >
                        Proceed to Checkout
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className={cn(
                          "w-full mt-[10px]",
                          themeClasses.borderNeutralSecondary,
                          themeClasses.buttonGhostHoverBg,
                        )}
                        size="lg"
                        onClick={() => {
                          // Mark that we're returning from cart page
                          if (typeof window !== 'undefined') {
                            try {
                              sessionStorage.setItem('navigated_from_cart', 'true')
                            } catch (e) {
                              // Ignore storage errors
                            }
                          }
                          navigateWithPrefetch('/products', { priority: 'medium', scroll: false })
                        }}
                      >
                        Continue Shopping
                      </Button>
                    </div>

                    {/* Additional Info */}
                    <div className="space-y-3 pt-4 border-t border-neutral-200">
                      <div className="flex items-center gap-2 text-sm">
                        <Truck className="w-4 h-4 text-green-500" />
                        <span className={cn(themeClasses.textNeutralSecondary)}>
                          Free shipping on orders over {formatPrice(FREE_SHIPPING_THRESHOLD)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <RefreshCcw className="w-4 h-4 text-blue-500" />
                        <span className={cn(themeClasses.textNeutralSecondary)}>30-day return policy</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="w-4 h-4 text-green-500" />
                        <span className={cn(themeClasses.textNeutralSecondary)}>Secure checkout</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CreditCard className="w-4 h-4 text-blue-500" />
                        <span className={cn(themeClasses.textNeutralSecondary)}>Multiple payment options</span>
                      </div>
                    </div>

                    {/* Trust Badges */}
                    <div className="pt-4 border-t border-neutral-200">
                      <p className={cn("text-xs text-center mb-3", themeClasses.textNeutralSecondary)}>
                        Trusted by millions of customers
                      </p>
                      <div className="flex justify-center items-center gap-4">
                        <div className="text-center">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1">
                            <Shield className="w-4 h-4 text-green-600" />
                          </div>
                          <span className="text-xs">Secure</span>
                        </div>
                        <div className="text-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1">
                            <Truck className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="text-xs">Fast</span>
                        </div>
                        <div className="text-center">
                          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-1">
                            <RefreshCcw className="w-4 h-4 text-yellow-600" />
                          </div>
                          <span className="text-xs">Reliable</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
          </div>
        )}
        
        {/* Recommendations Section - After Order Summary on Mobile, Below Cart Items on Desktop */}
        <div className="mt-8 lg:mt-0 lg:col-span-3">
          <h3 className={cn("text-lg font-semibold mb-4", themeClasses.mainText)}>You might also like</h3>
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {useMemo(() => {
              // Create a shuffled copy of products to show different recommendations each time
              const shuffledProducts = [...products].sort(() => Math.random() - 0.5)
              return shuffledProducts.slice(0, 8)
            }, [products]).map((product, index) => {
              const discountPercentage = product.originalPrice && product.originalPrice > product.price
                ? ((product.originalPrice - product.price) / product.originalPrice) * 100
                : 0
              
              return (
                <Link key={product.id} href={`/products/${product.id}`} className={index >= 6 ? "hidden sm:block" : ""}>
                  <Card className={cn("cursor-pointer hover:shadow-md transition-shadow group", themeClasses.cardBg, themeClasses.cardBorder)}>
                    <CardContent className="p-2">
                      <div className="relative aspect-square overflow-hidden rounded mb-2">
                        {product.image && (
                          <LazyImage
                            src={product.image}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 12vw"
                            className="object-cover transition-transform duration-200 group-hover:scale-105 bg-gray-50"
                            priority={false} // Not priority since it's in a list
                            quality={80}
                          />
                        )}
                        {discountPercentage > 0 && (
                          <div className="absolute top-1 left-1 bg-red-500 text-white text-[10px] font-bold px-1 py-0.5 rounded">
                            -{discountPercentage.toFixed(0)}%
                          </div>
                        )}
                      </div>
                      <h4 className={cn("text-xs font-medium line-clamp-2 mb-1", themeClasses.mainText)}>
                        {product.name}
                      </h4>
                      <div className="flex items-center gap-1">
                        <span className={cn("text-xs font-semibold", themeClasses.mainText)}>
                          {formatPrice(product.price)}
                        </span>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className={cn("text-[10px] line-through", themeClasses.textNeutralSecondary)}>
                            {formatPrice(product.originalPrice)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
        </div>
      </main>

      <Footer />


      {/* Clear Cart Confirmation */}
      <ValidationModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear Cart?"
        message="This action will remove all items from your cart. You cannot undo this."
        type="warning"
        buttonText="Clear All"
        cancelText="Cancel"
        showCancelButton
        onConfirm={() => { handleClearCart() }}
        onCancel={() => setShowClearConfirm(false)}
        showCloseButton
      />

      {/* Validation Modal */}
      <ValidationModal
        isOpen={isModalOpen}
        onClose={hideModal}
        {...modalProps}
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

              {/* Account Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider">Account</h3>
                <div className="space-y-2">
                  {isAuthenticated ? (
                    <>
                      <Link 
                        href="/account"
                        className="w-full flex items-center gap-2 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group text-sm"
                        onClick={() => setIsHamburgerMenuOpen(false)}
                      >
                        <User className="w-5 h-5 text-white group-hover:text-yellow-400 transition-colors" />
                        <span className="text-white font-medium">My Account</span>
                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors ml-auto" />
                      </Link>
                      <Link 
                        href="/account/orders"
                        className="w-full flex items-center gap-2 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 group text-sm"
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
                  <p className="text-white font-medium text-sm">{user?.email}</p>
                  <p className="text-white/60 text-xs">Welcome back!</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quantity Warning Modal */}
      <ValidationModal
        isOpen={isQuantityWarningModalOpen}
        onClose={() => setIsQuantityWarningModalOpen(false)}
        title="Minimum Quantity Required"
        message={`For products under 500 TZS, the minimum quantity is 5. You cannot reduce the quantity of "${quantityWarningItem?.productName}" below 5. We recommend visiting our physical shop for smaller quantities or contact our support team for assistance.`}
        type="warning"
        buttonText="Visit Our Shop"
        cancelText="Contact Support"
        showCancelButton
        onConfirm={() => {
          // Redirect to shop location or contact page
          window.open('/support', '_blank')
          setIsQuantityWarningModalOpen(false)
          setQuantityWarningItem(null)
        }}
        onCancel={() => {
          // Open contact support
          window.open(`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || 'support@honic.co'}?subject=Quantity Inquiry&body=I need assistance with ordering smaller quantities of products under 500 TZS`, '_blank')
          setIsQuantityWarningModalOpen(false)
          setQuantityWarningItem(null)
        }}
        showCloseButton
      />
    </div>
  )
} 