"use client"

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
  Twitter,
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
import { useCompanyContext } from "@/components/company-provider"
import { useCurrency } from "@/contexts/currency-context"
import { useToast } from "@/hooks/use-toast"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { SecurityGuard } from "@/components/security-guard"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { ValidationModal, useValidationModal } from "@/components/ui/validation-modal"
import { UserProfile } from "@/components/user-profile"
import { CartSelectionPreview } from "@/components/cart-selection-preview"
import { Footer } from "@/components/footer"

export default function CartPage() {
  return <CartPageContent />
}

function CartPageContent() {
  const { backgroundColor, setBackgroundColor, themeClasses, darkHeaderFooterClasses } = useTheme()
  const { cart, updateItemQuantity, removeItem, cartTotalItems, cartSubtotal, clearCart, isLoading } = useCart() // Use useCart hook
  const { products } = useProducts() // Use useProducts hook
  const { getStock, fetchStock } = useStock() // Use stock hook for real-time stock data
  const { currency, setCurrency, formatPrice } = useCurrency() // Use global currency context
  
  // Debug logging
  const { companyName, companyColor, companyLogo, isLoaded: companyLoaded } = useCompanyContext()
  
  // Fallback logo system - use local logo if API is not loaded or logo is not available
  const fallbackLogo = "/android-chrome-512x512.png"
  const displayLogo = companyLoaded && companyLogo && companyLogo !== fallbackLogo && companyLogo !== "/placeholder-logo.png" ? companyLogo : fallbackLogo
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, loading: authLoading } = useAuth() // Add auth context
  const { openAuthModal } = useGlobalAuthModal()
  const [savedForLater, setSavedForLater] = useState<any[]>([])
  const [wishlist, setWishlist] = useState<any[]>([])
  const [previewItem, setPreviewItem] = useState<any>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false)
  const [isQuantityWarningModalOpen, setIsQuantityWarningModalOpen] = useState(false)
  const [quantityWarningItem, setQuantityWarningItem] = useState<{productId: number, variantId?: string, productName: string} | null>(null)
  const { showCheckoutValidation, hideModal, isOpen: isModalOpen, modalProps} = useValidationModal()
  
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

  const handleRemoveItem = useCallback((productId: number) => {
    startTransition(() => removeItem(productId, undefined)) // Always remove entire product
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

  const handleSaveForLater = useCallback(() => {
    if (cart.length === 0) {
      toast({
        title: "No items to save",
        description: "Your cart is empty. Add some items first.",
        variant: "destructive",
      })
      return
    }
    
    startTransition(() => {
      setSavedForLater(prev => ([...prev, ...cart]))
      clearCart()
    })
    toast({
      title: "Items saved for later",
      description: `${cart.length} items have been moved to your saved items.`,
    })
  }, [cart, clearCart, toast])

  const handleAddToWishlist = (productId: number) => {
    const isAlreadyInWishlist = wishlist.some(wishlistItem => 
      wishlistItem.id === productId
    )
    
    if (isAlreadyInWishlist) {
      // Remove from wishlist
      setWishlist(wishlist.filter(wishlistItem => wishlistItem.id !== productId))
      toast({
        title: "Removed from wishlist",
        description: "Item has been removed from your wishlist.",
      })
    } else {
      // Add to wishlist
    const item = cart.find(cartItem => cartItem.productId === productId)
    if (item) {
      setWishlist([...wishlist, { id: productId, name: item.product?.name || `Product ${productId}` }])
      toast({
        title: "Added to wishlist",
        description: `${item.product?.name || `Product ${productId}`} has been added to your wishlist.`,
      })
      }
    }
  }

  const isInWishlist = useCallback((productId: number) => {
    return wishlist.some(wishlistItem => wishlistItem.id === productId)
  }, [wishlist])

  // Calculate shipping cost: 5,000 TZS if order is less than 100,000 TZS, otherwise free
  const FREE_SHIPPING_THRESHOLD = 100000
  const SHIPPING_COST = 5000
  
  const selectedItems = cart.filter(i => selected[i.productId])
  const hasSelection = selectedItems.length > 0
  const selectedItemsCount = hasSelection ? selectedItems.reduce((s,i)=>s+i.totalQuantity,0) : cartTotalItems
  const selectedSubtotal = hasSelection ? selectedItems.reduce((s,i)=>s+i.totalPrice,0) : cartSubtotal

  const calculateShippingFee = (subtotal: number) => {
    return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
  }
  
  const shippingCost = calculateShippingFee(selectedSubtotal)
  const total = selectedSubtotal + shippingCost

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
    try { sessionStorage.setItem('selected_cart_items', JSON.stringify(selectedIds)) } catch {}
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
                  router.push('/products')
                }
              } catch {
                router.push('/products')
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
            href="/"
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
            {/* Theme Switcher Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                          className={cn(
                            "flex items-center gap-1",
                            darkHeaderFooterClasses.buttonGhostText,
                            darkHeaderFooterClasses.buttonGhostHoverBg,
                          )}
                >
                  <Palette className="w-5 h-5" />
                  <span className="sr-only">Change Theme</span>
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
                  onClick={() => setBackgroundColor("dark")}
                  className={cn(darkHeaderFooterClasses.dropdownItemHoverBg, backgroundColor === "dark" && "bg-yellow-500 text-white")}
                >
                  Dark {backgroundColor === "dark" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setBackgroundColor("gray")}
                  className={cn(darkHeaderFooterClasses.dropdownItemHoverBg, backgroundColor === "gray" && "bg-yellow-500 text-white")}
                >
                  Gray {backgroundColor === "gray" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setBackgroundColor("white")}
                  className={cn(darkHeaderFooterClasses.dropdownItemHoverBg, backgroundColor === "white" && "bg-yellow-500 text-white")}
                >
                  White {backgroundColor === "white" && "✓"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                          className={cn(
                            "flex items-center gap-1 border-yellow-500 bg-transparent text-xs sm:text-sm w-[20px] h-[10px] sm:w-auto sm:h-auto",
                            darkHeaderFooterClasses.buttonGhostText,
                            darkHeaderFooterClasses.buttonGhostHoverBg,
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
                  {cartTotalItems}
                </span>
              </Button>
            </Link>

            {/* User Profile - Hidden on Mobile */}
            <div className="hidden sm:block">
            {isAuthenticated ? (
              <UserProfile />
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
                    <Coins className="w-4 h-4 mr-2" /> My Coins
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

      <main className="flex-1 w-full pt-20 sm:pt-20 pb-4 sm:pb-6 px-2 sm:px-4 lg:px-8" suppressHydrationWarning>
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
              <div className="lg:col-span-2 space-y-2" data-cart-items suppressHydrationWarning>
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
                        Cart Items ({hasSelection ? selectedItems.length : cart.length})
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 text-sm">
                      <span className={cn(themeClasses.textNeutralSecondary)}>
                        Total Items: {selectedItemsCount}
                      </span>
                      <span className={cn(themeClasses.textNeutralSecondary)}>
                        Subtotal: {formatPrice(selectedSubtotal)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <div className="flex sm:hidden items-center gap-2 text-xs">
                      <span className={cn(themeClasses.textNeutralSecondary)}>
                        Items: {cartTotalItems}
                      </span>
                      <span className={cn(themeClasses.textNeutralSecondary)}>
                        Total: {formatPrice(cartSubtotal)}
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




                {/* Cart Items */}
                <div className="space-y-1">
                  {cart.slice().reverse().map((item, index) => {
                    const product = products.find(p => p.id === item.productId) || item.product
                    const stockData = getStock(item.productId)
                    const stockQty = stockData?.stockQuantity ?? (product as any)?.stockQuantity ?? null
                    
                    // Debug logging removed
                    
                    
                    // If item has multiple variants, display as one product with multiple selections
                    if (item.variants && item.variants.length > 1) {
                      return (
                        <Card
                          key={`${item.productId}-${index}`}
                          className={cn(
                            "transition-all duration-200 hover:shadow-lg group rounded-sm",
                            themeClasses.cardBg,
                            themeClasses.cardBorder,
                          )}
                          suppressHydrationWarning
                        >
                          <CardContent className="p-0.5 sm:p-1">
                            {/* Product Header */}
                            <div className="flex gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                              {/* Select checkbox */}
                              <div className="flex items-start">
                                <input
                                  type="checkbox"
                                  checked={!!selected[item.productId]}
                                  onChange={() => toggleSelected(item.productId)}
                                  className="mt-1"
                                />
                              </div>
                              {/* Product Image */}
                              <Link href={`/products/${item.productId}`} className="flex-shrink-0">
                                <div className="relative">
                                  {product?.image && (
                                    <LazyImage
                                      src={product.image}
                                      alt={product.name}
                                      width={50}
                                      height={50}
                                      className="w-12 h-12 sm:w-15 sm:h-15 rounded object-cover border border-neutral-200 hover:border-yellow-500 transition-colors bg-gray-50"
                                      priority={false} // Not priority since it's in a list
                                      quality={80}
                                    />
                                  )}
                                </div>
                              </Link>

                              {/* Product Details */}
                              <div className="flex-1 min-w-0">
                                <Link href={`/products/${item.productId}`}>
                                  <h3 className={cn(
                                    "font-semibold text-xs hover:underline line-clamp-2",
                                    themeClasses.mainText
                                  )}>
                                    {product?.name || "Unknown Product"}
                                  </h3>
                                </Link>
                                
                                {/* Product SKU */}
                                <div className="mt-0.5 sm:mt-1">
                                  <span className={cn("text-[9px] sm:text-[10px]", themeClasses.textNeutralSecondary)}>
                                    SKU: {product?.sku || "N/A"}
                                  </span>
                                </div>

                                {/* Delivery estimate */}
                                <div className="flex items-center gap-1 mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] text-green-600">
                                  <Truck className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                                  <span>Free delivery by {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setPreviewItem(item)
                                    setIsPreviewOpen(true)
                                  }}
                                  className={cn(
                                    "h-5 sm:h-6 px-1 sm:px-2 text-[10px] sm:text-xs text-green-500 hover:bg-green-50 hover:text-green-600",
                                    themeClasses.buttonGhostHoverBg,
                                  )}
                                >
                                  Preview
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleAddToWishlist(item.productId)}
                                  className={cn(
                                    "h-5 w-5 sm:h-6 sm:w-6 hover:bg-blue-50 hover:text-blue-600",
                                    isInWishlist(item.productId) 
                                      ? "text-blue-600 fill-blue-600" 
                                      : "text-blue-500",
                                    themeClasses.buttonGhostHoverBg,
                                  )}
                                >
                                  <Heart className={cn(
                                    "w-2 h-2 sm:w-2.5 sm:h-2.5",
                                    isInWishlist(item.productId) && "fill-current"
                                  )} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(item.productId)}
                                  className={cn(
                                    "h-5 w-5 sm:h-6 sm:w-6 text-red-500 hover:bg-red-50 hover:text-red-600",
                                    themeClasses.buttonGhostHoverBg,
                                  )}
                                >
                                  <Trash2 className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Compact Selection Summary */}
                            <div className="border-t border-neutral-200 pt-0.5 sm:pt-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <span className={cn("text-[10px] sm:text-xs font-medium", themeClasses.mainText)}>
                                    {item.variants.length} selection{item.variants.length > 1 ? 's' : ''}
                                  </span>
                                  <span className={cn("text-[10px] sm:text-xs", themeClasses.textNeutralSecondary)}>
                                    • {item.totalQuantity} items
                                  </span>
                                </div>
                                <span className={cn("text-xs sm:text-sm font-semibold text-green-600", themeClasses.mainText)}>
                                  {formatPrice(item.totalPrice)}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    }
                    
                    // Single variant or legacy item display
                    
                    const unitPrice = item.totalPrice / item.totalQuantity
                    const discountPercentage = product?.originalPrice && product.originalPrice > unitPrice
                      ? ((product.originalPrice - unitPrice) / product.originalPrice) * 100
                      : 0

                    return (
                      <Card
                        key={`${item.productId}-${item.variants[0]?.variantId || "base"}-${index}`}
                        className={cn(
                          "transition-all duration-200 hover:shadow-lg group rounded-sm",
                          themeClasses.cardBg,
                          themeClasses.cardBorder,
                        )}
                        suppressHydrationWarning
                      >
                        <CardContent className="p-1 sm:p-2">
                          <div className="flex gap-1 sm:gap-2">
                            {/* Product Image */}
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={!!selected[item.productId]}
                                onChange={() => toggleSelected(item.productId)}
                                className="mt-1"
                              />
                              <Link href={`/products/${item.productId}`} className="flex-shrink-0">
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
                                  <Link href={`/products/${item.productId}`}>
                                    <h3 className={cn(
                                      "font-semibold text-xs sm:text-base hover:underline line-clamp-2",
                                      themeClasses.mainText
                                    )}>
                                      {product?.name || `Product ${item.productId}`}
                                    </h3>
                                  </Link>
                                  

                                  {/* Price Display */}
                                  <div className="flex flex-wrap items-baseline gap-0.5 mt-0.5 sm:mt-2">
                                    <span className={cn("font-semibold text-[10px] sm:text-sm", themeClasses.mainText)}>
                                      {formatPrice(item.totalPrice / item.totalQuantity)}
                                    </span>
                                    {product?.originalPrice && product.originalPrice > (item.totalPrice / item.totalQuantity) && (
                                      <>
                                        <span className={cn("text-[9px] sm:text-xs line-through", themeClasses.textNeutralSecondary)}>
                                          {formatPrice(product.originalPrice)}
                                        </span>
                                        <span className="text-[9px] sm:text-xs font-medium text-green-500 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-0.5 sm:px-1.5 py-0.5 rounded">
                                          Save {formatPrice(product.originalPrice - unitPrice)}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  {/* Delivery estimate */}
                                  <div className="flex items-center gap-0.5 mt-0.5 sm:mt-2 text-[9px] sm:text-xs text-green-600">
                                    <Truck className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                                    <span>Free delivery by {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
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
                                onClick={() => handleQuantityChange(item.productId, item.variants[0]?.variantId, -1)}
                                disabled={item.totalQuantity <= 1 || (product && product.price < 500 && item.totalQuantity <= 5)}
                                        className="rounded-none h-5 w-5 text-neutral-950 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-700"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </Button>
                                      <Input
                                        type="number"
                                        min={product && product.price < 500 ? "5" : "1"}
                                        value={item.totalQuantity}
                                        onChange={(e) => {
                                          handleQuantityInputChange(item.productId, item.variants[0]?.variantId, e.target.value)
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
                                                variantId: item.variants[0]?.variantId,
                                                productName: product.name
                                              })
                                              setIsQuantityWarningModalOpen(true)
                                            }
                                          }
                                        }}
                                        style={{
                                          width: `${getQuantityInputWidth(item.totalQuantity)}rem`,
                                          minWidth: '1.5rem',
                                          maxWidth: '4rem'
                                        }}
                                        className="px-1 py-0.5 text-[10px] font-medium text-neutral-950 dark:text-gray-100 text-center border-0 rounded-none h-5 focus:ring-0 focus:border-0 transition-all duration-200 ease-in-out"
                                      />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleQuantityChange(item.productId, item.variants[0]?.variantId, 1)}
                                disabled={stockQty !== null && item.totalQuantity >= stockQty}
                                className="rounded-none h-5 w-5 text-neutral-950 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </Button>
                            </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setPreviewItem(item)
                                        setIsPreviewOpen(true)
                                      }}
                                      className={cn(
                                          "h-5 px-1 text-[9px] text-green-500 hover:bg-green-50 hover:text-green-600",
                                        themeClasses.buttonGhostHoverBg,
                                      )}
                                    >
                                        Preview
                                    </Button>
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
                                        onClick={() => handleRemoveItem(item.productId)}
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
                                      onClick={() => handleQuantityChange(item.productId, item.variants[0]?.variantId, -1)}
                                      disabled={item.totalQuantity <= 1 || (product && product.price < 500 && item.totalQuantity <= 5)}
                                      className="rounded-none h-7 w-7 text-neutral-950 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-700"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={product && product.price < 500 ? "5" : "1"}
                                      value={item.totalQuantity}
                                      onChange={(e) => {
                                        handleQuantityInputChange(item.productId, item.variants[0]?.variantId, e.target.value)
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
                                              variantId: item.variants[0]?.variantId,
                                              productName: product.name
                                            })
                                            setIsQuantityWarningModalOpen(true)
                                          }
                                        }
                                      }}
                                      style={{
                                        width: `${getDesktopQuantityInputWidth(item.totalQuantity)}rem`,
                                        minWidth: '2.5rem',
                                        maxWidth: '6rem'
                                      }}
                                      className="px-2 py-0.5 text-sm font-medium text-neutral-950 dark:text-gray-100 text-center border-0 rounded-none h-7 focus:ring-0 focus:border-0 transition-all duration-200 ease-in-out"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleQuantityChange(item.productId, item.variants[0]?.variantId, 1)}
                                      disabled={stockQty !== null && item.totalQuantity >= stockQty}
                                      className="rounded-none h-7 w-7 text-neutral-950 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setPreviewItem(item)
                                        setIsPreviewOpen(true)
                                      }}
                                      className={cn(
                                        "h-7 px-3 text-sm text-green-500 hover:bg-green-50 hover:text-green-600",
                                        themeClasses.buttonGhostHoverBg,
                                      )}
                                    >
                                      Preview
                                    </Button>
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
                                      onClick={() => handleRemoveItem(item.productId)}
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

                              {/* Item Total */}
                              <div className="flex items-center justify-between mt-0.5 sm:mt-2 pt-0.5 sm:pt-1 border-t border-neutral-200 dark:border-gray-600">
                                <span className={cn("text-[10px] sm:text-sm", themeClasses.textNeutralSecondary)}>Item Total:</span>
                                <span className={cn("font-bold text-xs sm:text-base", themeClasses.mainText)}>
                        {formatPrice(item.totalPrice)}
                                </span>
                              </div>
                            </div>
                      </div>
                    </CardContent>
                  </Card>
                    )
                  })}
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
                            {formatPrice(selectedSubtotal + shippingCost)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Promo Code */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Enter promo code"
                          className={cn(
                            "flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border rounded-md",
                            // Use explicit classes for consistent dark/light appearance
                            "bg-white text-neutral-900 placeholder:text-neutral-400 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-400 dark:border-neutral-800",
                          )}
                        />
                        <Button size="sm" className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600 text-xs sm:text-sm px-2 sm:px-3">
                          Apply
                        </Button>
                      </div>
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
                      
                      <Link href="/products" className="block mt-[10px]">
                        <Button 
                          variant="outline" 
                          className={cn(
                            "w-full",
                            themeClasses.borderNeutralSecondary,
                            themeClasses.buttonGhostHoverBg,
                          )}
                          size="lg"
                        >
                          Continue Shopping
                        </Button>
                      </Link>
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
            {products.slice(0, 8).map((product, index) => {
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

      {/* Selection Preview Dialog */}
      {previewItem && (
        <CartSelectionPreview
          item={previewItem}
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false)
            setPreviewItem(null)
          }}
          onQuantityChange={handleQuantityChange}
          formatPrice={formatPrice}
        />
      )}

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
                      {cartTotalItems > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-black">
                          {cartTotalItems}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-white">Cart</span>
                  </Link>
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
          window.open('/help', '_blank')
          setIsQuantityWarningModalOpen(false)
          setQuantityWarningItem(null)
        }}
        onCancel={() => {
          // Open contact support
          window.open('mailto:support@honic.co?subject=Quantity Inquiry&body=I need assistance with ordering smaller quantities of products under 500 TZS', '_blank')
          setIsQuantityWarningModalOpen(false)
          setQuantityWarningItem(null)
        }}
        showCloseButton
      />
    </div>
  )
} 