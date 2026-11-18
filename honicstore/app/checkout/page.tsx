"use client"

import { BuyerRouteGuard } from '@/components/buyer-route-guard'
import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { LazyImage } from "@/components/lazy-image"
import { logger } from '@/lib/logger'
import {
  ChevronLeft,
  Truck,
  MapPin,
  Package,
  Clock,
  Zap,
  Gift,
  ShieldCheck,
  Smartphone,
  Lock,
  Ticket,
  Plus,
  Minus,
  Check,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useCart, type CartItem } from "@/hooks/use-cart"
import { useAuth } from "@/contexts/auth-context"
import { useCompanyContext } from "@/components/company-provider"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { useCurrency } from "@/contexts/currency-context"
import { useToast } from "@/hooks/use-toast"
import { validateTanzaniaPhone, validateEmail } from "@/lib/phone-validation"
import { TANZANIA_REGIONS, DISTRICTS_BY_REGION, getWardOptions } from "@/lib/tanzania-address"
import { CheckoutPageSkeleton } from "@/components/ui/skeleton"
import { 
  sessionStorage as safeSessionStorage,
  getSecureErrorMessage,
  fetchWithRetry
} from "@/lib/checkout-utils"
import { getClientShippingPricing, shouldDeferShippingFeeDisplay } from "@/lib/shipping-calculator"
import { useTranslation } from "@/hooks/use-translation"
import { CheckoutLanguageToggle } from "@/components/checkout-language-toggle"
import { downloadOrderReceipt, saveLocalOrder, savePendingOrder, takePendingOrder } from "@/lib/local-orders"

interface ShippingAddress {
  fullName: string
  address1: string
  address2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
  email: string
  streetName?: string
  tin?: string
  region?: string
  district?: string
  ward?: string
  /** Set at submit when known; used server-side for distance / flat shipping. */
  lat?: number
  lon?: number
}

interface PaymentDetails {
  paymentMethod: 'snippe' | 'card' | 'mobile_money'
  cardNumber?: string
  expiryDate?: string
  cvv?: string
  cardholderName?: string
  mobileNumber?: string
  mobileProvider?: string
}

interface FormData {
  shippingAddress: ShippingAddress
  billingAddress: ShippingAddress
  paymentDetails: PaymentDetails
  sameAsBilling: boolean
  sameAsShipping: boolean
}

export default function CheckoutPage() {
  return (
    <BuyerRouteGuard>
      <CheckoutPageContent />
    </BuyerRouteGuard>
  )
}

function CheckoutPageContent() {
  const router = useRouter()
  const { themeClasses, darkHeaderFooterClasses } = useTheme()
  const { cart, updateItemQuantity } = useCart()
  const { user } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const { companyName, companyLogo, isLoaded: companyLoaded } = useCompanyContext()
  const { toast } = useToast()
  
  // Fallback logo system - use local logo if API is not loaded or logo is not available
  const fallbackLogo = "/android-chrome-512x512.png"
  const displayLogo = companyLoaded && companyLogo && companyLogo !== fallbackLogo && companyLogo !== "/placeholder-logo.png" ? companyLogo : fallbackLogo
  const { formatPrice } = useCurrency()
  const t = useTranslation()

  // Get selected items for display
  const getSelectedItems = () => {
    let selectedIds: number[] = []
    let buyNowMode: boolean = false
    let buyNowItemData: CartItem | null = null
    
    try { 
      const raw = safeSessionStorage.getItem('selected_cart_items')
      if (raw) {
        const parsed = JSON.parse(raw)
        // Validate that parsed data is an array of numbers
        if (Array.isArray(parsed) && parsed.every((id: unknown) => typeof id === 'number' && id > 0)) {
          selectedIds = parsed
        }
      }
      
      const buyNowModeRaw = safeSessionStorage.getItem('buy_now_mode')
      if (buyNowModeRaw === 'true') buyNowMode = true
      
      const buyNowDataRaw = safeSessionStorage.getItem('buy_now_item_data')
      if (buyNowDataRaw) {
        const parsed = JSON.parse(buyNowDataRaw)
        // Validate buyNowItemData structure
        if (parsed && typeof parsed === 'object' && typeof (parsed as CartItem).productId === 'number') {
          buyNowItemData = parsed as CartItem
        }
      }
    } catch {}
    
    // If this is a "Buy Now" action, use the stored item data
    if (buyNowMode && buyNowItemData) {
      // Return only the specific "Buy Now" item with correct quantity and price
      return [buyNowItemData]
    }
    
    // Regular cart behavior - show all selected items or all cart items
    return selectedIds.length > 0 ? cart.filter(i => selectedIds.includes(i.productId)) : cart
  }

  // Calculate totals for selected items only
  const selectedItems = getSelectedItems()
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0)

  // Same as cart page - for qty input width
  const getDesktopQuantityInputWidth = (qty: number) => {
    const n = String(qty).length
    return Math.min(6, Math.max(2.5, 2.5 + n * 0.8))
  }
  
  
  const { freeThresholdTz: FREE_SHIPPING_THRESHOLD, flatRateTz: SHIPPING_COST } = getClientShippingPricing()

  const [currentStep, setCurrentStep] = useState(0)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [paymentLinkGenerated, setPaymentLinkGenerated] = useState(false)
  const [, setCheckoutLinkUrl] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string>("")
  const [orderReferenceId, setOrderReferenceId] = useState<string | null>(null)
  const [orderPickupId, setOrderPickupId] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [deliveryOption, setDeliveryOption] = useState<'shipping' | 'pickup'>('shipping')
  // Location coords when structured address is forward-geocoded (optional on order payload)
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null)

  const [formData, setFormData] = useState<FormData>({
    shippingAddress: {
      fullName: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "Tanzania",
      phone: "",
      email: "",
      streetName: "",
      tin: "",
      region: "",
      district: "",
      ward: "",
    },
    billingAddress: {
      fullName: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "Tanzania",
      phone: "",
      email: "",
      streetName: "",
      tin: "",
      region: "",
      district: "",
      ward: "",
    },
    paymentDetails: {
      paymentMethod: 'snippe',
      cardNumber: "",
      expiryDate: "",
      cvv: "",
      cardholderName: "",
      mobileNumber: "",
      mobileProvider: "",
    },
    sameAsBilling: false,
    sameAsShipping: false,
  })

  // Server-side shipping estimate (from shipping address / location); used in Order Summary
  const [shippingEstimate, setShippingEstimate] = useState<{
    subtotal: number
    shipping: number
    total: number
    shippingBase?: number
    shippingDistanceAddon?: number
    shippingGeocoded?: boolean
  } | null>(null)
  const [shippingEstimateLoading, setShippingEstimateLoading] = useState(false)

  // Fallback client-side shipping (when server estimate not yet available)
  const calculateShippingFee = () => {
    if (deliveryOption === 'pickup') return 0
    if (selectedSubtotal >= FREE_SHIPPING_THRESHOLD) return 0
    const allProductsHaveFreeDelivery = selectedItems.every(item => {
      const extra = item as CartItem & { free_delivery?: boolean; freeDelivery?: boolean }
      return extra.free_delivery === true || extra.freeDelivery === true
    })
    return allProductsHaveFreeDelivery ? 0 : SHIPPING_COST
  }

  const fallbackShippingFee = calculateShippingFee()
  const displaySubtotal = shippingEstimate?.subtotal ?? selectedSubtotal
  const deferShippingFeeDisplay = shouldDeferShippingFeeDisplay(deliveryOption, formData.shippingAddress)
  const displayShipping =
    deliveryOption === 'pickup'
      ? 0
      : deferShippingFeeDisplay
        ? 0
        : (shippingEstimate?.shipping ?? fallbackShippingFee)
  const shippingFee = displayShipping
  const shippingFeeLineLoading = deferShippingFeeDisplay ? false : shippingEstimateLoading
  
  // Get applied promotion from sessionStorage
  const [appliedPromotion, setAppliedPromotion] = useState<{
    code: string
    discountAmount: number
    name?: string
  } | null>(null)
  
  useEffect(() => {
    try {
      const promoData = safeSessionStorage.getItem('applied_promotion')
      if (promoData) {
        const parsed = JSON.parse(promoData)
        // Validate promotion data structure
        if (parsed && typeof parsed === 'object' && 
            typeof parsed.code === 'string' && 
            typeof parsed.discountAmount === 'number' && 
            parsed.discountAmount >= 0) {
          setAppliedPromotion({
            code: parsed.code,
            discountAmount: parsed.discountAmount,
            name: typeof parsed.name === 'string' ? parsed.name : undefined,
          })
        }
      }
    } catch {}
  }, [])

  // Stable key for shipping estimate so we only refetch when cart/location/delivery actually change
  const shippingEstimateKey = (() => {
    const items = selectedItems.flatMap((item) =>
      (item.variants || []).map((v) => [item.productId, v.variantId ?? null, v.quantity ?? 1])
    )
    const a = formData.shippingAddress
    return JSON.stringify({
      items,
      deliveryOption,
      region: a.region,
      district: a.district,
      ward: a.ward,
      country: a.country,
      city: a.city,
      streetName: a.streetName,
      address1: a.address1,
      address2: a.address2,
    })
  })()

  // Fetch server-side shipping estimate when items, delivery option, or location (shipping address) change
  useEffect(() => {
    const items = selectedItems.flatMap((item) =>
      (item.variants || []).map((v) => ({
        productId: item.productId,
        variantId: v.variantId ?? null,
        quantity: v.quantity ?? 1,
      }))
    )
    if (items.length === 0) {
      setShippingEstimate(null)
      setShippingEstimateLoading(false)
      return
    }
    if (shouldDeferShippingFeeDisplay(deliveryOption, formData.shippingAddress)) {
      setShippingEstimate(null)
      setShippingEstimateLoading(false)
      return
    }
    let cancelled = false
    setShippingEstimateLoading(true)
    fetch('/api/cart/shipping-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        deliveryOption,
        country: deliveryOption === 'shipping' ? formData.shippingAddress.country : undefined,
        region:
          deliveryOption === 'shipping' && formData.shippingAddress.country === 'Tanzania'
            ? formData.shippingAddress.region
            : undefined,
        district:
          deliveryOption === 'shipping' && formData.shippingAddress.country === 'Tanzania'
            ? formData.shippingAddress.district
            : undefined,
        ward:
          deliveryOption === 'shipping' && formData.shippingAddress.country === 'Tanzania'
            ? formData.shippingAddress.ward
            : undefined,
        city: deliveryOption === 'shipping' ? formData.shippingAddress.city : undefined,
        streetName:
          deliveryOption === 'shipping' && formData.shippingAddress.country === 'Tanzania'
            ? formData.shippingAddress.streetName
            : undefined,
        address1:
          deliveryOption === 'shipping' && formData.shippingAddress.country === 'Tanzania'
            ? formData.shippingAddress.address1
            : undefined,
        address2:
          deliveryOption === 'shipping' && formData.shippingAddress.country === 'Tanzania'
            ? formData.shippingAddress.address2
            : undefined,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setShippingEstimate(null)
          return
        }
        setShippingEstimate({
          subtotal: Number(data.subtotal) || 0,
          shipping: Number(data.shipping) ?? 0,
          total: Number(data.total) ?? 0,
          shippingBase: typeof data.shippingBase === 'number' ? data.shippingBase : undefined,
          shippingDistanceAddon:
            typeof data.shippingDistanceAddon === 'number' ? data.shippingDistanceAddon : undefined,
          shippingGeocoded: typeof data.shippingGeocoded === 'boolean' ? data.shippingGeocoded : undefined,
        })
      })
      .catch(() => {
        if (!cancelled) setShippingEstimate(null)
      })
      .finally(() => {
        if (!cancelled) setShippingEstimateLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [shippingEstimateKey])

  const promotionDiscount = appliedPromotion ? appliedPromotion.discountAmount : 0
  const orderTotal = displaySubtotal + displayShipping - promotionDiscount

  useEffect(() => {
    if (!paymentLinkGenerated || !orderReferenceId) return
    let stopped = false
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/payment/snippe?orderReference=${encodeURIComponent(orderReferenceId)}&t=${Date.now()}`, { cache: "no-store" })
        const data = await response.json().catch(() => null)
        if (stopped || !data?.success) return
        if (data.paymentStatus === 'paid' || data.paymentStatus === 'completed' || data.paymentStatus === 'success') {
          stopped = true
          const saved = takePendingOrder(orderReferenceId) || {
            referenceId: orderReferenceId,
            status: "paid",
            total: orderTotal,
            currency: "TZS",
            createdAt: new Date().toISOString(),
            customerName: "",
            phone: "",
            email: "",
            items: [],
          }
          saved.status = "paid"
          saveLocalOrder(saved)
          try {
            if (!sessionStorage.getItem(`honic-receipt-${orderReferenceId}`)) {
              downloadOrderReceipt(saved)
              sessionStorage.setItem(`honic-receipt-${orderReferenceId}`, "1")
            }
          } catch {}
          router.push(`/checkout/success?orderReference=${encodeURIComponent(orderReferenceId)}`)
        } else if (data.paymentStatus === 'failed') {
          stopped = true
          setPaymentLinkGenerated(false)
          setIsProcessingPayment(false)
          const message = data.failureReason || 'The payment was not completed. You can try again.'
          setPaymentError(message)
          toast({ title: 'Payment not completed', description: message, variant: 'destructive', duration: 6000 })
        }
      } catch {
        // Keep waiting. The next check will try again.
      }
    }
    checkStatus()
    const timer = setInterval(checkStatus, 3000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [paymentLinkGenerated, orderReferenceId, orderTotal, router, toast])

  // Timeout for payment processing (increased to 60 seconds for slower networks)
  useEffect(() => {
    if (isProcessingPayment) {
      setHasTimedOut(false)
      const timeoutId = setTimeout(() => {
        setHasTimedOut(true)
        setIsProcessingPayment(false) // Clear processing state on timeout
      }, 60000) // Increased to 60 seconds timeout (was 30s)

      return () => clearTimeout(timeoutId)
    } else {
      setHasTimedOut(false)
    }
  }, [isProcessingPayment])

  // Retry payment function
  const handleRetryPayment = () => {
    setHasTimedOut(false)
    setIsProcessingPayment(false)
    setPaymentLinkGenerated(false)
    setCheckoutLinkUrl(null)
    setPaymentError(null)
    // Note: We keep orderId and orderReferenceId so we can reuse the existing order
    // Only create a new order if no order exists yet
  }
  
  const [isClient, setIsClient] = useState(false)

  // Fix hydration mismatch
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Track if form has been prefilled to prevent overwriting user edits
  const hasPrefilledRef = useRef(false)
  const deliveryAutoCalcRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-calculate delivery from structured address (region/district/ward/street) when enough is filled
  useEffect(() => {
    if (deliveryOption !== 'shipping') return
    const a = formData.shippingAddress
    const isTz = (a.country || 'Tanzania').toLowerCase().includes('tanzania')
    // Famous place (address2) used only for precision in geocode; if missing, no effect
    const parts = isTz
      ? [a.ward?.trim(), a.district?.trim(), a.region?.trim(), a.streetName?.trim(), a.address1?.trim(), a.address2?.trim(), a.country?.trim() || 'Tanzania'].filter(Boolean) as string[]
      : [a.streetName?.trim(), a.address1?.trim(), a.address2?.trim(), a.city?.trim(), a.state?.trim(), a.country?.trim() || 'Tanzania'].filter(Boolean) as string[]
    const hasEnough = isTz ? (a.region && (a.district || a.ward || (a.streetName?.trim()) || (a.address1?.trim()))) : parts.length >= 2
    if (!hasEnough || parts.length < 2) return
    if (deliveryAutoCalcRef.current) clearTimeout(deliveryAutoCalcRef.current)
    deliveryAutoCalcRef.current = setTimeout(async () => {
      deliveryAutoCalcRef.current = null
      const query = parts.reverse().join(', ')
      try {
        const res = await fetch(`/api/forward-geocode?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0 && data[0].lat != null && data[0].lon != null) {
          const lat = parseFloat(data[0].lat)
          const lon = parseFloat(data[0].lon)
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            setLocationCoords({ lat, lon })
            toast({ title: 'Delivery price updated', description: 'Fee is now based on your address.' })
          }
        }
      } catch {
        // keep previous coords or default
      }
    }, 800)
    return () => {
      if (deliveryAutoCalcRef.current) clearTimeout(deliveryAutoCalcRef.current)
    }
  }, [deliveryOption, formData.shippingAddress.region, formData.shippingAddress.district, formData.shippingAddress.ward, formData.shippingAddress.streetName, formData.shippingAddress.address1, formData.shippingAddress.address2, formData.shippingAddress.city, formData.shippingAddress.state, formData.shippingAddress.country])

  // Prefill form data for authenticated users (only once, and only if fields are empty)
  useEffect(() => {
    // Only prefill if:
    // 1. User is authenticated
    // 2. Form hasn't been prefilled yet
    // 3. Form fields are empty (not overwriting user edits)
    if (user && user.email && !hasPrefilledRef.current) {
      setFormData(prev => {
        // Check if form is empty (user hasn't edited anything)
        const isFormEmpty = 
          !prev.shippingAddress.email && 
          !prev.shippingAddress.fullName && 
          !prev.shippingAddress.phone

        // Only prefill if form is empty
        if (!isFormEmpty) {
          return prev // Don't overwrite if user has already entered data
        }

        // Mark as prefilled
        hasPrefilledRef.current = true

        return {
          ...prev,
          shippingAddress: {
            ...prev.shippingAddress,
            email: user.email || prev.shippingAddress.email,
            fullName: user.name || user.profile?.full_name || prev.shippingAddress.fullName,
            phone: user.profile?.phone || prev.shippingAddress.phone,
            // Prefill address if available in profile (only if empty)
            address1: prev.shippingAddress.address1 || user.profile?.address || "",
            city: prev.shippingAddress.city || user.profile?.city || "",
            state: prev.shippingAddress.state || user.profile?.state || "",
            postalCode: prev.shippingAddress.postalCode || user.profile?.postal_code || "",
          },
          billingAddress: {
            ...prev.billingAddress,
            email: user.email || prev.billingAddress.email,
            fullName: user.name || user.profile?.full_name || prev.billingAddress.fullName,
            phone: user.profile?.phone || prev.billingAddress.phone,
          },
        }
      })
    }

    // Reset prefilled flag if user logs out (for guest checkout)
    if (!user && hasPrefilledRef.current) {
      hasPrefilledRef.current = false
    }
  }, [user])

  const handleSameAsShipping = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      sameAsShipping: checked,
      billingAddress: checked ? prev.shippingAddress : {
        fullName: "",
        address1: "",
        address2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "Tanzania",
        phone: "",
        email: "",
        streetName: "",
        tin: "",
        region: "",
        district: "",
        ward: "",
      }
    }))
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    section: keyof FormData,
    field: string
  ) => {
    const value = e.target.value
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as Record<string, string>),
        [field]: value
      }
    }))
  }

  const handlePlaceOrder = async () => {
      if (!cart || cart.length === 0) {
        toast({
          title: t('checkout.toastEmptyCartTitle'),
          description: t('checkout.toastEmptyCartDesc'),
          variant: "destructive"
        })
        return
      }

    setIsProcessingPayment(true)
    setPaymentError(null)
    setPaymentLinkGenerated(false) // Reset payment link state
    setCheckoutLinkUrl(null)

    // Order is created first. Payment uses the saved server total.

    try {
      // For pickup orders, validate billing address; for shipping, validate shipping address
      const customerInfo = deliveryOption === 'pickup' ? formData.billingAddress : formData.shippingAddress

      // Validate phone number
      const phoneValidation = validateTanzaniaPhone(customerInfo.phone)
      if (!phoneValidation.valid) {
        setIsProcessingPayment(false)
        toast({
          title: t('checkout.toastInvalidPhoneTitle'),
          description: t('checkout.toastInvalidPhoneDesc'),
          variant: "destructive"
        })
        return
      }

      // Validate email
      const emailValidation = validateEmail(customerInfo.email)
      if (!emailValidation.valid) {
        setIsProcessingPayment(false)
        toast({
          title: t('checkout.toastInvalidEmailTitle'),
          description: t('checkout.toastInvalidEmailDesc'),
          variant: "destructive"
        })
        return
      }

      // Skip complex stock validation for better performance
      // Stock validation will be handled server-side during order processing
      // Get selected items for order
      let selectedIds: number[] = []
      try { 
        const raw = safeSessionStorage.getItem('selected_cart_items')
        if (raw) {
          const parsed = JSON.parse(raw)
          // Validate that parsed data is an array of numbers
          if (Array.isArray(parsed) && parsed.every((id: unknown) => typeof id === 'number' && id > 0)) {
            selectedIds = parsed
          }
        }
      } catch {}

      // Generate unique order ID
      const orderId = `ORD-${Date.now()}`
      
      // Prepare order data (reuse selectedIds from validation above)
      const selectedItems = selectedIds.length > 0 ? cart.filter(i => selectedIds.includes(i.productId)) : cart

      // Server-side estimate matches POST /api/orders (zones from address + optional lat/lon)
      const orderItems = selectedItems.flatMap(item =>
        item.variants.map(variant => ({
          productId: item.productId,
          variantId: variant.variantId ?? null,
          quantity: variant.quantity ?? 1,
        }))
      )
      let serverShippingFee = deliveryOption === 'pickup' ? 0 : (shippingEstimate?.shipping ?? SHIPPING_COST)
      let serverSubtotal = shippingEstimate?.subtotal ?? selectedItems.reduce((sum, item) => sum + item.totalPrice, 0)
      const hasFreshEstimate = deliveryOption === 'pickup' || (typeof shippingEstimate?.subtotal === 'number' && typeof shippingEstimate?.shipping === 'number')
      if (!hasFreshEstimate) try {
        const estimateRes = await fetch('/api/cart/shipping-estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: orderItems,
            deliveryOption,
            country: deliveryOption === 'shipping' ? formData.shippingAddress.country : undefined,
            region:
              deliveryOption === 'shipping' && formData.shippingAddress.country === 'Tanzania'
                ? formData.shippingAddress.region
                : undefined,
            district:
              deliveryOption === 'shipping' && formData.shippingAddress.country === 'Tanzania'
                ? formData.shippingAddress.district
                : undefined,
            ward:
              deliveryOption === 'shipping' && formData.shippingAddress.country === 'Tanzania'
                ? formData.shippingAddress.ward
                : undefined,
            city: deliveryOption === 'shipping' ? formData.shippingAddress.city : undefined,
            streetName:
              deliveryOption === 'shipping' && formData.shippingAddress.country === 'Tanzania'
                ? formData.shippingAddress.streetName
                : undefined,
            address1:
              deliveryOption === 'shipping' && formData.shippingAddress.country === 'Tanzania'
                ? formData.shippingAddress.address1
                : undefined,
            address2:
              deliveryOption === 'shipping' && formData.shippingAddress.country === 'Tanzania'
                ? formData.shippingAddress.address2
                : undefined,
          }),
        })
        const estimate = await estimateRes.json()
        if (!estimate.error && typeof estimate.subtotal === 'number' && typeof estimate.shipping === 'number') {
          serverSubtotal = estimate.subtotal
          serverShippingFee = estimate.shipping
        }
      } catch {
        // use fallbacks above
      }
      const serverTotalAmount = Math.round(serverSubtotal + serverShippingFee - promotionDiscount)

      const orderData = {
        orderNumber: orderId,
        userId: user?.id || null, // null for guest users
        // Extract customer information from the appropriate address based on delivery option
        customerName: customerInfo.fullName,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone,
        items: selectedItems.flatMap(item => 
          item.variants.map(variant => ({
            productId: item.productId,
            productName: item.product?.name || `Product ${item.productId}`,
            variantId: variant.variantId && variant.variantId !== 'default' && !isNaN(Number(variant.variantId)) ? parseInt(variant.variantId) : null, // Convert string to integer or null
            variantName: variant.variant_name || 'Default', // Use simplified variant_name from database
            variantAttributes: null, // No longer used in simplified variant system
            quantity: variant.quantity,
            unitPrice: variant.price, // unit price from database
            totalPrice: variant.price * variant.quantity, // total price for this variant
          name: item.product?.name || `Product ${item.productId}`,
          }))
        ),
        shippingAddress: {
          ...formData.shippingAddress,
          ...(deliveryOption === 'shipping' && locationCoords
            ? { lat: locationCoords.lat, lon: locationCoords.lon }
            : {}),
        },
        billingAddress: formData.sameAsShipping ? formData.shippingAddress : formData.billingAddress,
        deliveryOption,
        shippingFee: serverShippingFee,
        promotionCode: appliedPromotion?.code || null,
        promotionDiscount: promotionDiscount,
        totalAmount: serverTotalAmount,
        timestamp: new Date().toISOString(),
      }

      // Check if we already have an order (from previous failed payment link generation)
      // If order exists, reuse it instead of creating a new one
      let result
      
      try {
        if (orderReferenceId && orderId) {
          // Reuse existing order - don't create a new one
          
          // Fetch order details to get current payment status
          try {
            const orderResponse = await fetch(`/api/orders/${orderReferenceId}`)
            if (orderResponse.ok) {
              const orderData = await orderResponse.json()
              result = {
                success: true,
                order: {
                  id: orderId,
                  referenceId: orderReferenceId,
                  pickupId: orderPickupId,
                  paymentStatus: orderData.paymentStatus || 'pending',
                  status: orderData.status || 'pending'
                }
              }
            } else {
              // Order not found, create new one
              result = await submitOrder(orderData)
              setOrderId(result.order.id)
              setOrderReferenceId(result.order.referenceId)
              setOrderPickupId(result.order.pickupId)
              setPaymentStatus(result.order.paymentStatus)
            }
          } catch {
            // Error fetching order, create new one
            result = await submitOrder(orderData)
            setOrderId(result.order.id)
            setOrderReferenceId(result.order.referenceId)
            setOrderPickupId(result.order.pickupId)
            setPaymentStatus(result.order.paymentStatus)
          }
        } else {
          // No existing order, create new one
          result = await submitOrder(orderData)
          setOrderId(result.order.id)
          setOrderReferenceId(result.order.referenceId)
          setOrderPickupId(result.order.pickupId)
          setPaymentStatus(result.order.paymentStatus)
        }
      } catch (orderError: unknown) {
        // If order submission fails, clear loading state and throw error
        setIsProcessingPayment(false)
        throw orderError
      }
      
      // DON'T remove items from cart yet - wait until payment is confirmed
      // Items will be removed after successful payment via webhook or return page

      // Open a Snippe checkout for the total saved on the order.
      // Payment API validates amount against order in DB and uses DB total for the link (anti-tampering).
      const reference = result.order.referenceId || orderId
      const orderTotalAmount = result.order.totalAmount || orderData.totalAmount
      const checkoutIdempotencyKey = `checkout-link:${reference}:${String(orderTotalAmount)}`
      // Optimized: Use fetchWithRetry with faster retries (2 retries, shorter delays)
      // Retries on: network errors, 5xx server errors, 429 rate limits, 408 timeouts
      const response = await fetch('/api/payment/snippe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: String(orderTotalAmount),
          currency: 'TZS',
          orderId: reference,
          idempotencyKey: checkoutIdempotencyKey,
          customerDetails: {
            fullName: customerInfo.fullName,
            email: customerInfo.email,
            phone: customerInfo.phone,
            firstName: customerInfo.fullName.split(' ')[0] || '',
            lastName: customerInfo.fullName.split(' ').slice(1).join(' ') || '',
          },
        }),
      })

      // Optimized: Parse JSON directly instead of text() then parse
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed' }))
        throw new Error(getSecureErrorMessage(errorData.error || 'Failed', 'Unable to send the payment request. Please try again.'))
      }

      const data = await response.json()

      if (!data.success || !data.paymentReference) {
        throw new Error(getSecureErrorMessage(data.error || 'No payment request', 'Unable to send the payment request. Please try again.'))
      }

      safeSessionStorage.setItem('last_order_reference', reference)
      savePendingOrder({
        referenceId: reference,
        status: "pending",
        total: Number(orderTotalAmount) || 0,
        currency: "TZS",
        createdAt: new Date().toISOString(),
        customerName: customerInfo.fullName || "",
        phone: customerInfo.phone || "",
        email: customerInfo.email || "",
        items: (orderData.items || []).map((item: { name?: string; productName?: string; quantity?: number; totalPrice?: number }) => ({
          name: item.productName || item.name || "Item",
          quantity: Number(item.quantity) || 1,
          total: Number(item.totalPrice) || 0,
        })),
      })
      setCheckoutLinkUrl(null)
      setPaymentLinkGenerated(true)
      toast({
        title: 'Check your phone',
        description: 'A payment request was sent to your mobile money number. Enter your PIN on this page\'s phone prompt.',
        duration: 6000
      })
      
      // Clear processing state after redirect is initiated (keep message visible briefly)
      // Small delay to ensure redirect happens and user sees success message
      setTimeout(() => {
        setIsProcessingPayment(false)
      }, 500) // Brief delay to show success message

    } catch (error: unknown) {
      const paymentErrorRecord = error as { message?: string; stack?: string; name?: string }
      logger.error('Payment initiation error:', {
        error: error,
        message: paymentErrorRecord.message,
        stack: paymentErrorRecord.stack,
        name: paymentErrorRecord.name
      })
      
      // Always clear loading state on error
      setIsProcessingPayment(false)
      setPaymentLinkGenerated(false) // Reset on error
      setCheckoutLinkUrl(null)
      
      const errorMessage = getSecureErrorMessage(error, 'Something went wrong. Please try again.')
      setPaymentError(errorMessage)
      toast({
        title: 'Order Error',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000
      })
    } finally {
      // Ensure loading state is always cleared, even if something unexpected happens
      // This is a safety net to prevent stuck loading states
      setTimeout(() => {
        setIsProcessingPayment(false)
      }, 100)
    }
  }

  // Function to submit order
  const submitOrder = async (orderData: Record<string, unknown>) => {
    try {
      
      // Submit order to public API with retry logic
      const response = await fetchWithRetry(
        '/api/orders',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData),
        },
        2 // Max 2 retries with exponential backoff
      )

      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = getSecureErrorMessage(
          errorData.error || new Error('Order submission failed'),
          'Failed to submit order. Please try again.'
        )
        throw new Error(errorMessage)
      }

      const result = await response.json()
      
      // Store order IDs and payment URL for later use
      if (result.order.paymentUrl) {
        // You can store this in state or redirect to payment
      }
      
      return result
    } catch (error) {
      throw error
    }
  }

  // Validation functions
  const validateDeliveryOption = () => {
    if (!deliveryOption) {
      setValidationErrors({ deliveryOption: t('checkout.errSelectDeliveryOption') })
      return false
    }
    return true
  }

  const validateShippingAddress = () => {
    const errors: Record<string, string> = {}

      if (!formData.shippingAddress.fullName.trim()) {
      errors.shippingFullName = t('checkout.errFullNameRequired')
      }
      if (!formData.shippingAddress.phone.trim()) {
      errors.shippingPhone = t('checkout.errPhoneRequired')
      }
      if (!formData.shippingAddress.email.trim()) {
      errors.shippingEmail = t('checkout.errEmailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.shippingAddress.email)) {
      errors.shippingEmail = t('checkout.errEmailInvalid')
    }
    if (formData.shippingAddress.country === 'Tanzania') {
      if (!formData.shippingAddress.region?.trim()) errors.shippingRegion = t('checkout.errRegionRequired')
      if (!formData.shippingAddress.district?.trim()) errors.shippingDistrict = t('checkout.errDistrictRequired')
      if (!formData.shippingAddress.ward?.trim()) errors.shippingWard = t('checkout.errWardRequired')
    } else {
      if (!formData.shippingAddress.city.trim()) errors.shippingCity = t('checkout.errCityRequired')
    }
    if (!formData.shippingAddress.streetName?.trim()) {
      errors.shippingStreet = t('checkout.errStreetRequired')
    }
    if (!formData.shippingAddress.address1.trim()) {
      errors.shippingAddress1 = t('checkout.errHouseRequired')
    }
    // Landmark is optional — for precision only; if not found, no effect

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateBillingInformation = () => {
    // For pickup orders, we only need basic billing info (name, email, phone)
    if (deliveryOption === 'pickup') {
      const errors: Record<string, string> = {}
      
      if (!formData.billingAddress.fullName.trim()) {
        errors.billingFullName = t('checkout.errFullNameRequired')
      }
      if (!formData.billingAddress.phone.trim()) {
        errors.billingPhone = t('checkout.errPhoneRequired')
      } else {
        // Validate Tanzania phone number format
        const phoneValidation = validateTanzaniaPhone(formData.billingAddress.phone)
        if (!phoneValidation.valid) {
          errors.billingPhone = t('checkout.errInvalidPhoneFormat')
        }
      }
      if (!formData.billingAddress.email.trim()) {
        errors.billingEmail = t('checkout.errEmailRequired')
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.billingAddress.email)) {
        errors.billingEmail = t('checkout.errEmailInvalid')
      }

      setValidationErrors(errors)
      return Object.keys(errors).length === 0
    }

    // For shipping orders, validate all billing fields
    // If using same as shipping, no validation needed
    if (formData.sameAsShipping) {
      return true
    }

    const errors: Record<string, string> = {}
    
    if (!formData.billingAddress.fullName.trim()) {
      errors.billingFullName = t('checkout.errFullNameRequired')
    }
    if (!formData.billingAddress.phone.trim()) {
      errors.billingPhone = t('checkout.errPhoneRequired')
    } else {
      // Validate Tanzania phone number format
      const phoneValidation = validateTanzaniaPhone(formData.billingAddress.phone)
      if (!phoneValidation.valid) {
        errors.billingPhone = t('checkout.errInvalidPhoneFormat')
      }
    }
    if (!formData.billingAddress.email.trim()) {
      errors.billingEmail = t('checkout.errEmailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.billingAddress.email)) {
      errors.billingEmail = t('checkout.errEmailInvalid')
    }
    if (!formData.billingAddress.city.trim()) {
      errors.billingCity = t('checkout.errCityRequired')
    }
    if (!formData.billingAddress.streetName?.trim()) {
      errors.billingStreet = t('checkout.errStreetRequired')
    }
    if (!formData.billingAddress.address1.trim()) {
      errors.billingAddress1 = t('checkout.errBillingAddressRequired')
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return validateDeliveryOption()
      case 1:
        if ((deliveryOption as string) === 'shipping') {
          return validateShippingAddress()
            } else {
          return validateBillingInformation()
        }
      case 2:
        if ((deliveryOption as string) === 'shipping') {
          return validateBillingInformation()
        }
        return true // Order review step
            default:
        return true
    }
  }

  const handleNext = () => {
    // Validate current step before proceeding
    if (!validateCurrentStep()) {
      return
    }

    // Clear validation errors if validation passes
    setValidationErrors({})

    if (deliveryOption === 'pickup') {
      // For pickup: 0 (Delivery) -> 1 (Billing) -> 2 (Review) -> 3 (Confirmed)
      setCurrentStep(prev => Math.min(prev + 1, 3))
      } else {
      // For shipping: 0 (Delivery) -> 1 (Shipping) -> 2 (Billing) -> 3 (Review) -> 4 (Confirmed)
      setCurrentStep(prev => Math.min(prev + 1, 4))
    }
  }

  const handleBack = () => {
    if (currentStep === 0) {
      // If on delivery option step, go back to cart
      router.push('/cart')
    } else {
      // Otherwise, go to previous step
      setCurrentStep(prev => Math.max(prev - 1, 0))
    }
  }

  const paymentPhone = deliveryOption === 'pickup' ? formData.billingAddress.phone : formData.shippingAddress.phone
  const brandName = companyName || 'Honic Company Limited'

  const renderSecurePayment = () => (
    <Card className="overflow-hidden rounded-none border border-neutral-200 bg-white shadow-none">
      <div className="flex items-end justify-between gap-4 border-b border-neutral-200 px-6 py-5">
        <div>
          <p className="text-sm font-semibold text-neutral-500">Honic Company Limited</p>
          <h3 className="mt-2 text-xl font-bold text-neutral-950 sm:text-2xl">{paymentLinkGenerated ? 'Approve on your phone' : 'Sending a secure request'}</h3>
          <p className="mt-1 text-sm sm:text-base text-neutral-500">Mobile money stays on this page. Your PIN is never typed here.</p>
        </div>
        <p className="text-right text-lg font-bold tabular-nums text-neutral-950">{formatPrice(orderTotal)}</p>
      </div>
      <CardContent className="px-6 py-8">
        {!hasTimedOut ? (
          <div className="mx-auto max-w-md text-center">
            <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center bg-yellow-500 text-neutral-950">
              {paymentLinkGenerated ? <Smartphone className="h-7 w-7" /> : <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />}
            </div>
            <h3 className={cn("text-xl font-bold sm:text-2xl", themeClasses.mainText)}>
              {paymentLinkGenerated ? 'Enter your PIN' : 'Connecting to mobile money'}
            </h3>
            <p className={cn("mt-2 text-sm leading-relaxed sm:text-base", themeClasses.textNeutralSecondary)}>
              {paymentLinkGenerated
                ? `A payment request is on ${paymentPhone || 'your phone'}. Approve it with your mobile-money PIN. This page confirms the result.`
                : 'Honic is sending the request for the saved order total. The amount cannot be changed in the browser.'}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 text-left">
              {[
                { icon: Zap, label: 'Fast push' },
                { icon: Lock, label: 'Amount locked' },
                { icon: ShieldCheck, label: 'PIN private' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="border border-neutral-200 px-3 py-3 dark:border-neutral-800">
                  <Icon className="mb-2 h-4 w-4 text-yellow-600" />
                  <p className="text-sm font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-md text-center">
            <Clock className="mx-auto mb-4 h-10 w-10 text-yellow-600" />
            <h3 className={cn("text-xl font-bold sm:text-2xl", themeClasses.mainText)}>The request needs another try</h3>
            <p className={cn("mt-2 text-sm sm:text-base", themeClasses.textNeutralSecondary)}>Stay on this page. The same order total will be used.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={handleRetryPayment} className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600">Try again</Button>
              <Button variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const renderReviewItems = () => (
                <div className="space-y-0">
                  {selectedItems.length === 0 ? (
                    <div className="text-center py-8">
                      <p className={cn("text-gray-500", themeClasses.textNeutralSecondary)}>
                        {t('checkout.orderReviewEmptyCart')}
                      </p>
                    </div>
                  ) : (
                    selectedItems.flatMap((item, itemIndex) =>
                      (item.variants || []).map((variant, variantIndex: number) => {
                        const product = item.product
                        const variantPrice = variant.price || 0
                        const variantQuantity = variant.quantity || 1
                        const variantTotalPrice = variantPrice * variantQuantity
                        const discountPercentage = product?.originalPrice && product.originalPrice > variantPrice
                          ? ((product.originalPrice - variantPrice) / product.originalPrice) * 100
                          : 0
                        return (
                          <div
                            key={`${item.productId}-${variant.variantId || variantIndex}-${itemIndex}`}
                            className={cn(
                              "transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 group rounded-sm p-2 sm:p-3 border-b border-neutral-200 dark:border-gray-700 last:border-b-0",
                            )}
                          >
                            <div className="flex gap-1 sm:gap-2">
                              <div className="flex items-start gap-2">
                                <Link href={`/products/${item.productId}-${encodeURIComponent(product?.name || 'product')}?returnTo=${encodeURIComponent('/checkout')}`} className="flex-shrink-0">
                                  <div className="relative">
                                    {(variant.image || product?.image) ? (
                                      <img
                                        src={variant.image || product?.image}
                                        alt={product?.name || "Product"}
                                        className="h-12 w-12 rounded object-cover border border-neutral-200 bg-gray-50 sm:h-16 sm:w-16"
                                      />
                                    ) : (
                                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded object-cover border border-neutral-200 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                        <span className="text-gray-400 text-xs">No Image</span>
                                      </div>
                                    )}
                                    {discountPercentage > 0 && (
                                      <div className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[7px] sm:text-[10px] font-bold px-0.5 sm:px-1.5 py-0.5 rounded-full">
                                        -{discountPercentage.toFixed(0)}%
                                      </div>
                                    )}
                                  </div>
                                </Link>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-1">
                                  <div className="flex-1 min-w-0">
                                    <Link href={`/products/${item.productId}-${encodeURIComponent(product?.name || 'product')}?returnTo=${encodeURIComponent('/checkout')}`}>
                                      <h3 className={cn("font-semibold text-xs sm:text-base hover:underline line-clamp-2", themeClasses.mainText)}>
                                        {product?.name || `Product ${item.productId}`}
                                        {variant.variant_name && (
                                          <span className="font-normal text-blue-600 dark:text-blue-400">{" | "}{variant.variant_name}</span>
                                        )}
                                      </h3>
                                    </Link>
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
                                            {t('checkout.saveAmountPrefix')} {formatPrice(product.originalPrice - variantPrice)}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    {/* Mobile: qty below product details */}
                                    <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                                      <div className="flex items-center border rounded overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-600">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => updateItemQuantity(item.productId, Math.max(1, variantQuantity - 1), variant.variantId)} disabled={variantQuantity <= 1} className="rounded-none h-7 w-7 text-neutral-950 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-700">
                                          <Minus className="w-3.5 h-3.5" />
                                        </Button>
                                        <Input type="number" min={1} value={variantQuantity} onChange={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v) && v >= 1) updateItemQuantity(item.productId, v, variant.variantId); }} style={{ width: `${getDesktopQuantityInputWidth(variantQuantity)}rem`, minWidth: '2.5rem', maxWidth: '6rem' }} className="px-2 py-0.5 text-sm font-medium text-neutral-950 dark:text-gray-100 text-center border-0 rounded-none h-7 focus:ring-0 focus:border-0 transition-all duration-200 ease-in-out [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => updateItemQuantity(item.productId, variantQuantity + 1, variant.variantId)} className="rounded-none h-7 w-7 text-neutral-950 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700">
                                          <Plus className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5 sm:mt-2 pt-0.5 sm:pt-1 border-t border-neutral-200 dark:border-gray-600">
                                      <span className={cn("text-[10px] sm:text-sm", themeClasses.textNeutralSecondary)}>{t('checkout.itemTotalPriceLabel')}</span>
                                      <span className={cn("font-bold text-xs sm:text-base", themeClasses.mainText)}>{formatPrice(variantTotalPrice)}</span>
                                    </div>
                                  </div>
                                  {/* Desktop: qty on right side like cart */}
                                  <div className="hidden sm:flex flex-col items-center gap-1">
                                    <div className="flex items-center border rounded overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-600">
                                      <Button type="button" variant="ghost" size="icon" onClick={() => updateItemQuantity(item.productId, Math.max(1, variantQuantity - 1), variant.variantId)} disabled={variantQuantity <= 1} className="rounded-none h-7 w-7 text-neutral-950 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-700">
                                        <Minus className="w-3.5 h-3.5" />
                                      </Button>
                                      <Input type="number" min={1} value={variantQuantity} onChange={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v) && v >= 1) updateItemQuantity(item.productId, v, variant.variantId); }} style={{ width: `${getDesktopQuantityInputWidth(variantQuantity)}rem`, minWidth: '2.5rem', maxWidth: '6rem' }} className="px-2 py-0.5 text-sm font-medium text-neutral-950 dark:text-gray-100 text-center border-0 rounded-none h-7 focus:ring-0 focus:border-0 transition-all duration-200 ease-in-out [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                      <Button type="button" variant="ghost" size="icon" onClick={() => updateItemQuantity(item.productId, variantQuantity + 1, variant.variantId)} className="rounded-none h-7 w-7 text-neutral-950 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700">
                                        <Plus className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )
                  )}
                </div>
  )

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card className={cn("border border-neutral-200 bg-white text-neutral-900 shadow-none")}>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className={cn("text-xl font-bold sm:text-2xl", themeClasses.mainText)}>
                {t('checkout.deliveryOptionTitle')}
              </CardTitle>
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                {t('checkout.deliveryOptionSubtitle')}
              </p>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {/* Validation Error Display */}
              {validationErrors.deliveryOption && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
                  <p className="text-sm text-red-600 dark:text-red-400">{validationErrors.deliveryOption}</p>
              </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div 
                         className={cn(
                    "relative cursor-pointer rounded-xl border p-5 transition-all",
                    (deliveryOption as string) === 'shipping' 
                      ? "border-neutral-950 bg-white shadow-[inset_3px_0_0_#eab308]" 
                      : "border-neutral-200 bg-white hover:border-neutral-400"
                  )}
                  onClick={() => {
                    setDeliveryOption('shipping')
                    // Clear validation error when option is selected
                    if (validationErrors.deliveryOption) {
                      setValidationErrors(prev => {
                        const newErrors = { ...prev }
                        delete newErrors.deliveryOption
                        return newErrors
                      })
                    }
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <Truck className="w-5 h-5 text-blue-500 mt-1" />
                    <div className="flex-1">
                      <h3 className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>
                        {t('checkout.shippingDeliveryTitle')}
                      </h3>
                      <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                        {t('checkout.shippingDeliveryDesc')}
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center space-x-2">
                          <Package className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>{t('checkout.estDeliveryLabel')}</strong> {t('checkout.estDeliveryValue')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
               </div>

                <div 
                   className={cn(
                    "relative cursor-pointer rounded-xl border p-5 transition-all",
                    deliveryOption === 'pickup' 
                      ? "border-neutral-950 bg-white shadow-[inset_3px_0_0_#eab308]" 
                      : "border-neutral-200 bg-white hover:border-neutral-400"
                  )}
                  onClick={() => {
                    setDeliveryOption('pickup')
                    // Clear validation error when option is selected
                    if (validationErrors.deliveryOption) {
                      setValidationErrors(prev => {
                        const newErrors = { ...prev }
                        delete newErrors.deliveryOption
                        return newErrors
                      })
                    }
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-green-500 mt-1" />
                    <div className="flex-1">
                      <h3 className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>
                        {t('checkout.storePickupTitle')}
                      </h3>
                      <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                        {t('checkout.storePickupDesc')}
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>{t('checkout.pickupTimeLabel')}</strong> {t('checkout.pickupTimeValue')}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Gift className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>{t('checkout.pickupFeeLabel')}</strong> {t('checkout.pickupFeeValue')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 1:
        if ((deliveryOption as string) === 'shipping') {
          return (
            <Card className={cn("border border-neutral-200 bg-white text-neutral-900 shadow-none")}>
              <CardHeader className="p-3 sm:p-6 space-y-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className={cn("text-xl font-bold sm:text-2xl", themeClasses.mainText)}>
                      {t('checkout.shippingAddressTitle')}
                    </CardTitle>
                    <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                      {t('checkout.shippingAddressSubtitle')}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'shrink-0 rounded-lg border px-3 py-2 sm:px-4 sm:py-3 sm:min-w-[10rem] text-right',
                      themeClasses.cardBorder,
                      themeClasses.cardBg
                    )}
                  >
                    <p className={cn('text-xs font-semibold text-neutral-500 dark:text-neutral-400 sm:text-sm')}>
                      {t('checkout.totalShippingFee')}
                    </p>
                    <p
                      className={cn(
                        'text-lg sm:text-2xl font-bold tabular-nums mt-1 leading-tight',
                        themeClasses.mainText
                      )}
                    >
                      {shippingFeeLineLoading
                        ? '…'
                        : deferShippingFeeDisplay
                          ? formatPrice(0)
                          : shippingFee === 0
                            ? t('checkout.free')
                            : formatPrice(shippingFee)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:gap-4 p-3 sm:p-6">
                {/* Row 1: Contact — Full Name, Phone, Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-start">
                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingFullName" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                  {t('checkout.fullNameLabel')}
                </Label>
                <Input
                      id="shippingFullName"
                  value={formData.shippingAddress.fullName}
                      onChange={(e) => {
                        handleInputChange(e, "shippingAddress", "fullName")
                        // Clear validation error when user starts typing
                        if (validationErrors.shippingFullName) {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors.shippingFullName
                            return newErrors
                          })
                        }
                      }}
                      placeholder={t('checkout.phFullName')}
                  className={cn(
                    darkHeaderFooterClasses.inputBg,
                    darkHeaderFooterClasses.textNeutralPrimary,
                    darkHeaderFooterClasses.inputPlaceholder,
                        validationErrors.shippingFullName
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : darkHeaderFooterClasses.inputBorder
                  )}
                />
                    {validationErrors.shippingFullName && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingFullName}</p>
                )}
              </div>

                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingPhone" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                      {t('checkout.phoneLabel')}
                </Label>
                <Input
                      id="shippingPhone"
                      value={formData.shippingAddress.phone}
                      onChange={(e) => {
                        handleInputChange(e, "shippingAddress", "phone")
                        if (validationErrors.shippingPhone) {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors.shippingPhone
                            return newErrors
                          })
                        }
                      }}
                      placeholder={t('checkout.phPhone')}
                  className={cn(
                        darkHeaderFooterClasses.inputBg,
                        darkHeaderFooterClasses.textNeutralPrimary,
                        darkHeaderFooterClasses.inputPlaceholder,
                        validationErrors.shippingPhone
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : darkHeaderFooterClasses.inputBorder
                      )}
                    />
                    {validationErrors.shippingPhone && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingPhone}</p>
                    )}
              </div>

                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingEmail" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                      {t('checkout.emailLabel')}
                </Label>
                <Input
                      id="shippingEmail"
                      type="email"
                      value={formData.shippingAddress.email}
                      onChange={(e) => {
                        handleInputChange(e, "shippingAddress", "email")
                        if (validationErrors.shippingEmail) {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors.shippingEmail
                            return newErrors
                          })
                        }
                      }}
                      placeholder={t('checkout.phEmail')}
                  className={cn(
                        darkHeaderFooterClasses.inputBg,
                        darkHeaderFooterClasses.textNeutralPrimary,
                        darkHeaderFooterClasses.inputPlaceholder,
                        validationErrors.shippingEmail
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : darkHeaderFooterClasses.inputBorder
                      )}
                    />
                    {validationErrors.shippingEmail && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingEmail}</p>
                    )}
                  </div>
              </div>

                {/* Row 2: Location — Country, Region, District, Ward (Tanzania) or Country, Region/City, Street (other) */}
                {formData.shippingAddress.country === 'Tanzania' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-start">
                    <div className="grid gap-1 sm:gap-2">
                      <Label htmlFor="shippingCountry" className={cn("text-sm sm:text-base", themeClasses.mainText)}>{t('checkout.countryLabel')}</Label>
                      <select
                        id="shippingCountry"
                        value={formData.shippingAddress.country}
                        onChange={(e) => handleInputChange(e, "shippingAddress", "country")}
                        className={cn("w-full min-h-10 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.inputBorder, darkHeaderFooterClasses.textNeutralPrimary)}
                      >
                        <option value="Tanzania">Tanzania</option>
                        <option value="Kenya">Kenya</option>
                        <option value="Uganda">Uganda</option>
                        <option value="Rwanda">Rwanda</option>
                      </select>
                    </div>
                    <div className="grid gap-1 sm:gap-2">
                      <Label htmlFor="shippingRegion" className={cn("text-sm sm:text-base", themeClasses.mainText)}>{t('checkout.regionLabel')}</Label>
                      <select
                        id="shippingRegion"
                        value={formData.shippingAddress.region || ""}
                        onChange={(e) => {
                          const newRegion = e.target.value
                          handleInputChange(e, "shippingAddress", "region")
                          const districts = (newRegion && (DISTRICTS_BY_REGION[newRegion] ?? [])) || []
                          const onlyDistrict = districts.length === 1 ? districts[0] : ''
                          const wards = onlyDistrict ? getWardOptions(onlyDistrict) : []
                          const onlyWard = wards.length === 1 ? wards[0] : ''
                          setFormData(prev => ({
                            ...prev,
                            shippingAddress: {
                              ...prev.shippingAddress,
                              district: onlyDistrict,
                              ward: onlyWard,
                              city: newRegion || prev.shippingAddress.city
                            }
                          }))
                          setValidationErrors(prev => { const n = { ...prev }; delete n.shippingRegion; delete n.shippingDistrict; delete n.shippingWard; return n })
                        }}
                        className={cn("w-full min-h-10 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.inputBorder, darkHeaderFooterClasses.textNeutralPrimary, validationErrors.shippingRegion ? "border-red-500" : "")}
                      >
                        <option value="">{t('checkout.selectRegion')}</option>
                        {TANZANIA_REGIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {validationErrors.shippingRegion && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingRegion}</p>}
                    </div>
                    <div className="grid gap-1 sm:gap-2">
                      <Label htmlFor="shippingDistrict" className={cn("text-sm sm:text-base", themeClasses.mainText)}>{t('checkout.districtLabel')}</Label>
                      <select
                        id="shippingDistrict"
                        value={formData.shippingAddress.district || ""}
                        onChange={(e) => {
                          const newDistrict = e.target.value
                          handleInputChange(e, "shippingAddress", "district")
                          const wards = newDistrict ? getWardOptions(newDistrict) : []
                          const onlyWard = wards.length === 1 ? wards[0] : ''
                          setFormData(prev => ({
                            ...prev,
                            shippingAddress: { ...prev.shippingAddress, ward: onlyWard }
                          }))
                          setValidationErrors(prev => { const n = { ...prev }; delete n.shippingDistrict; delete n.shippingWard; return n })
                        }}
                        className={cn("w-full min-h-10 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.inputBorder, darkHeaderFooterClasses.textNeutralPrimary, validationErrors.shippingDistrict ? "border-red-500" : "")}
                      >
                        <option value="">{t('checkout.selectDistrict')}</option>
                        {(DISTRICTS_BY_REGION[formData.shippingAddress.region || ""] ?? []).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      {validationErrors.shippingDistrict && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingDistrict}</p>}
                    </div>
                    <div className="grid gap-1 sm:gap-2">
                      <Label htmlFor="shippingWard" className={cn("text-sm sm:text-base", themeClasses.mainText)}>{t('checkout.wardLabel')}</Label>
                      <select
                        id="shippingWard"
                        value={formData.shippingAddress.ward || ""}
                        onChange={(e) => {
                          handleInputChange(e, "shippingAddress", "ward")
                          setValidationErrors(prev => { const n = { ...prev }; delete n.shippingWard; return n })
                        }}
                        className={cn("w-full min-h-10 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.inputBorder, darkHeaderFooterClasses.textNeutralPrimary, validationErrors.shippingWard ? "border-red-500" : "")}
                      >
                        <option value="">{t('checkout.selectWard')}</option>
                        {getWardOptions(formData.shippingAddress.district || "").map((w) => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                      {validationErrors.shippingWard && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingWard}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-start">
                    <div className="grid gap-1 sm:gap-2">
                      <Label htmlFor="shippingCountry" className={cn("text-sm sm:text-base", themeClasses.mainText)}>{t('checkout.countryLabel')}</Label>
                      <select id="shippingCountry" value={formData.shippingAddress.country} onChange={(e) => handleInputChange(e, "shippingAddress", "country")} className={cn("w-full min-h-10 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.inputBorder, darkHeaderFooterClasses.textNeutralPrimary)}>
                        <option value="Tanzania">Tanzania</option>
                        <option value="Kenya">Kenya</option>
                        <option value="Uganda">Uganda</option>
                        <option value="Rwanda">Rwanda</option>
                      </select>
                    </div>
                    <div className="grid gap-1 sm:gap-2">
                      <Label htmlFor="shippingCity" className={cn("text-sm sm:text-base", themeClasses.mainText)}>{t('checkout.regionCityLabel')}</Label>
                      <Input id="shippingCity" value={formData.shippingAddress.city} onChange={(e) => { handleInputChange(e, "shippingAddress", "city"); if (validationErrors.shippingCity) setValidationErrors(prev => { const n = { ...prev }; delete n.shippingCity; return n }) }} placeholder={t('checkout.phRegionCityNonTz')} className={cn(darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.textNeutralPrimary, darkHeaderFooterClasses.inputPlaceholder, validationErrors.shippingCity ? "border-red-500" : darkHeaderFooterClasses.inputBorder)} />
                      {validationErrors.shippingCity && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingCity}</p>}
                    </div>
                  </div>
                )}

                {/* Row 3: Street address — Street Name, House/Building Number, Famous place (optional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-start">
                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingStreet" className={cn("text-sm sm:text-base", themeClasses.mainText)}>{t('checkout.streetNameLabel')}</Label>
                    <Input
                      id="shippingStreet"
                      value={formData.shippingAddress.streetName || ""}
                      onChange={(e) => {
                        handleInputChange(e, "shippingAddress", "streetName")
                        if (validationErrors.shippingStreet) setValidationErrors(prev => { const n = { ...prev }; delete n.shippingStreet; return n })
                      }}
                      placeholder={t('checkout.phStreet')}
                      className={cn(darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.textNeutralPrimary, darkHeaderFooterClasses.inputPlaceholder, validationErrors.shippingStreet ? "border-red-500 focus:border-red-500 focus:ring-red-500" : darkHeaderFooterClasses.inputBorder)}
                    />
                    {validationErrors.shippingStreet && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingStreet}</p>}
                  </div>
                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingHouseNumber" className={cn("text-sm sm:text-base", themeClasses.mainText)}>{t('checkout.houseNumberLabel')}</Label>
                    <Input
                      id="shippingHouseNumber"
                      value={formData.shippingAddress.address1}
                      onChange={(e) => {
                        handleInputChange(e, "shippingAddress", "address1")
                        if (validationErrors.shippingAddress1) {
                          setValidationErrors(prev => { const newErrors = { ...prev }; delete newErrors.shippingAddress1; return newErrors })
                        }
                      }}
                      placeholder={t('checkout.phHouse')}
                      className={cn(
                        darkHeaderFooterClasses.inputBg,
                        darkHeaderFooterClasses.textNeutralPrimary,
                        darkHeaderFooterClasses.inputPlaceholder,
                        validationErrors.shippingAddress1 ? "border-red-500 focus:border-red-500 focus:ring-red-500" : darkHeaderFooterClasses.inputBorder
                      )}
                    />
                    {validationErrors.shippingAddress1 && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingAddress1}</p>}
                  </div>
                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingLandmark" className={cn("text-sm sm:text-base", themeClasses.mainText)}>{t('checkout.famousPlaceLabel')}</Label>
                    <Input
                      id="shippingLandmark"
                      value={formData.shippingAddress.address2 || ""}
                      onChange={(e) => {
                        handleInputChange(e, "shippingAddress", "address2")
                        if (validationErrors.shippingLandmark) {
                          setValidationErrors(prev => { const newErrors = { ...prev }; delete newErrors.shippingLandmark; return newErrors })
                        }
                      }}
                      placeholder={t('checkout.phFamousPlace')}
                      className={cn(darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.textNeutralPrimary, darkHeaderFooterClasses.inputPlaceholder, darkHeaderFooterClasses.inputBorder)}
                    />
                    <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>{t('checkout.famousPlaceHint')}</p>
                  </div>
                </div>

                {/* Row 4: More details (optional) */}
                <div className="grid gap-1 sm:gap-2 w-full max-w-full">
                  <Label htmlFor="shippingMoreDetails" className={cn("text-sm sm:text-base", themeClasses.mainText)}>{t('checkout.moreDetailsLabel')}</Label>
                  <Input
                    id="shippingMoreDetails"
                    value={formData.shippingAddress.state || ""}
                    onChange={(e) => handleInputChange(e, "shippingAddress", "state")}
                    placeholder={t('checkout.phMoreDetails')}
                    className={cn(darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.inputBorder, darkHeaderFooterClasses.textNeutralPrimary, darkHeaderFooterClasses.inputPlaceholder)}
                  />
                </div>
            </CardContent>
          </Card>
        )
        } else {
          // For pickup, case 1 is billing information
        return (
          <Card className={cn("border border-neutral-200 bg-white text-neutral-900 shadow-none")}>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className={cn("text-xl font-bold sm:text-2xl", themeClasses.mainText)}>{t('checkout.contactInfoTitle')}</CardTitle>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  {t('checkout.contactInfoSubtitle')}
                </p>
            </CardHeader>
              <CardContent className="grid gap-3 sm:gap-4 p-3 sm:p-6">
                {/* Contact Form for Pickup */}
                <div className="space-y-4">
                    {/* Row 1: Full Name, Email, Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingFullNamePickup" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                      {t('checkout.fullNameLabel')}
                    </Label>
                    <Input
                          id="billingFullNamePickup"
                      value={formData.billingAddress.fullName}
                          onChange={(e) => {
                            handleInputChange(e, "billingAddress", "fullName")
                            if (validationErrors.billingFullName) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                delete newErrors.billingFullName
                                return newErrors
                              })
                            }
                          }}
                      placeholder={t('checkout.phFullName')}
                      className={cn(
                        darkHeaderFooterClasses.inputBg,
                        darkHeaderFooterClasses.textNeutralPrimary,
                        darkHeaderFooterClasses.inputPlaceholder,
                            validationErrors.billingFullName
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : darkHeaderFooterClasses.inputBorder
                      )}
                    />
                        {validationErrors.billingFullName && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.billingFullName}</p>
                    )}
                  </div>

                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingEmailPickup" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                          {t('checkout.emailLabel')}
                        </Label>
                        <Input
                          id="billingEmailPickup"
                          type="email"
                          value={formData.billingAddress.email}
                          onChange={(e) => {
                            handleInputChange(e, "billingAddress", "email")
                            if (validationErrors.billingEmail) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                delete newErrors.billingEmail
                                return newErrors
                              })
                            }
                          }}
                          placeholder={t('checkout.phEmail')}
                          className={cn(
                            darkHeaderFooterClasses.inputBg,
                            darkHeaderFooterClasses.textNeutralPrimary,
                            darkHeaderFooterClasses.inputPlaceholder,
                            validationErrors.billingEmail
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : darkHeaderFooterClasses.inputBorder
                          )}
                        />
                        {validationErrors.billingEmail && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.billingEmail}</p>
                    )}
                  </div>

                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingPhonePickup" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                          {t('checkout.phoneLabel')}
                        </Label>
                        <Input
                          id="billingPhonePickup"
                          value={formData.billingAddress.phone}
                          onChange={(e) => {
                            handleInputChange(e, "billingAddress", "phone")
                            if (validationErrors.billingPhone) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                delete newErrors.billingPhone
                                return newErrors
                              })
                            }
                          }}
                          placeholder={t('checkout.phPhone')}
                      className={cn(
                            darkHeaderFooterClasses.inputBg,
                            darkHeaderFooterClasses.textNeutralPrimary,
                            darkHeaderFooterClasses.inputPlaceholder,
                            validationErrors.billingPhone
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : darkHeaderFooterClasses.inputBorder
                          )}
                        />
                        {validationErrors.billingPhone && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.billingPhone}</p>
                        )}
                      </div>
                      </div>
                      </div>
              </CardContent>
            </Card>
          )
        }

      case 2:
        if ((deliveryOption as string) === 'shipping') {
          // For shipping, case 2 is billing information
          return (
            <Card className={cn("border border-neutral-200 bg-white text-neutral-900 shadow-none")}>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className={cn("text-xl font-bold sm:text-2xl", themeClasses.mainText)}>
                  {t('checkout.billingInformationTitle')}
                </CardTitle>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  {t('checkout.billingDetailsSubtitle')}
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 sm:gap-4 p-3 sm:p-6">
                {/* Same as Shipping Checkbox */}
                <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Checkbox
                    id="sameAsShippingShipping"
                    checked={formData.sameAsShipping}
                    onCheckedChange={(checked) => handleSameAsShipping(checked as boolean)}
                    className="border-blue-500 data-[state=checked]:bg-blue-500"
                  />
                  <Label htmlFor="sameAsShippingShipping" className={cn("text-sm font-medium cursor-pointer", themeClasses.mainText)}>
                    {t('checkout.sameAsShippingLabel')}
                  </Label>
                    </div>

                {/* Billing Form - Show only if not using same as shipping */}
                {!formData.sameAsShipping && (
                  <>
                    {/* Row 1: Full Name, Email, Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingFullNameShipping" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                          {t('checkout.fullNameLabel')}
                      </Label>
                      <Input
                          id="billingFullNameShipping"
                          value={formData.billingAddress.fullName}
                          onChange={(e) => {
                            handleInputChange(e, "billingAddress", "fullName")
                            if (validationErrors.billingFullName) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                delete newErrors.billingFullName
                                return newErrors
                              })
                            }
                          }}
                          placeholder={t('checkout.phFullName')}
                        className={cn(
                              darkHeaderFooterClasses.inputBg,
                              darkHeaderFooterClasses.textNeutralPrimary,
                              darkHeaderFooterClasses.inputPlaceholder,
                            validationErrors.billingFullName
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : darkHeaderFooterClasses.inputBorder
                        )}
                      />
                        {validationErrors.billingFullName && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.billingFullName}</p>
                      )}
                    </div>

                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingEmailShipping" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                          {t('checkout.emailLabel')}
                      </Label>
                      <Input
                          id="billingEmailShipping"
                          type="email"
                          value={formData.billingAddress.email}
                          onChange={(e) => {
                            handleInputChange(e, "billingAddress", "email")
                            if (validationErrors.billingEmail) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                delete newErrors.billingEmail
                                return newErrors
                              })
                            }
                          }}
                          placeholder={t('checkout.phEmail')}
                        className={cn(
                              darkHeaderFooterClasses.inputBg,
                              darkHeaderFooterClasses.textNeutralPrimary,
                              darkHeaderFooterClasses.inputPlaceholder,
                            validationErrors.billingEmail
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : darkHeaderFooterClasses.inputBorder
                        )}
                      />
                        {validationErrors.billingEmail && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.billingEmail}</p>
                      )}
                    </div>

                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingPhoneShipping" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                        {t('checkout.phoneLabel')}
                      </Label>
                      <Input
                          id="billingPhoneShipping"
                        value={formData.billingAddress.phone}
                          onChange={(e) => {
                            handleInputChange(e, "billingAddress", "phone")
                            if (validationErrors.billingPhone) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                delete newErrors.billingPhone
                                return newErrors
                              })
                            }
                          }}
                          placeholder={t('checkout.phPhone')}
                        className={cn(
                          darkHeaderFooterClasses.inputBg,
                          darkHeaderFooterClasses.textNeutralPrimary,
                          darkHeaderFooterClasses.inputPlaceholder,
                            validationErrors.billingPhone
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : darkHeaderFooterClasses.inputBorder
                          )}
                        />
                        {validationErrors.billingPhone && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.billingPhone}</p>
                      )}
                    </div>
                  </div>

                    {/* Row 2: Country, City, Street */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingCountryShipping" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                          {t('checkout.countryLabel')}
                      </Label>
                        <select
                          id="billingCountryShipping"
                          value={formData.billingAddress.country}
                          onChange={(e) => handleInputChange(e, "billingAddress", "country")}
                        className={cn(
                            "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                          darkHeaderFooterClasses.inputBg,
                          darkHeaderFooterClasses.inputBorder,
                          darkHeaderFooterClasses.textNeutralPrimary,
                          )}
                        >
                          <option value="Tanzania">Tanzania</option>
                          <option value="Kenya">Kenya</option>
                          <option value="Uganda">Uganda</option>
                          <option value="Rwanda">Rwanda</option>
                        </select>
              </div>

                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingCityShipping" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                          {t('checkout.regionCityLabel')}
                </Label>
                <Input
                          id="billingCityShipping"
                          value={formData.billingAddress.city}
                          onChange={(e) => {
                            handleInputChange(e, "billingAddress", "city")
                            if (validationErrors.billingCity) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                delete newErrors.billingCity
                                return newErrors
                              })
                            }
                          }}
                          placeholder={t('checkout.phRegionCityBilling')}
                  className={cn(
                          darkHeaderFooterClasses.inputBg,
                          darkHeaderFooterClasses.textNeutralPrimary,
                          darkHeaderFooterClasses.inputPlaceholder,
                            validationErrors.billingCity
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : darkHeaderFooterClasses.inputBorder
                          )}
                        />
                        {validationErrors.billingCity && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.billingCity}</p>
                      )}
                    </div>

                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingStreetShipping" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                          {t('checkout.streetNameLabel')}
                </Label>
                <Input
                          id="billingStreetShipping"
                          value={formData.billingAddress.streetName || ""}
                          onChange={(e) => {
                            handleInputChange(e, "billingAddress", "streetName")
                            if (validationErrors.billingStreet) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                delete newErrors.billingStreet
                                return newErrors
                              })
                            }
                          }}
                          placeholder={t('checkout.phStreet')}
                  className={cn(
                        darkHeaderFooterClasses.inputBg,
                        darkHeaderFooterClasses.textNeutralPrimary,
                        darkHeaderFooterClasses.inputPlaceholder,
                            validationErrors.billingStreet
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : darkHeaderFooterClasses.inputBorder
                  )}
                />
                        {validationErrors.billingStreet && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.billingStreet}</p>
                )}
              </div>
                    </div>

                    {/* Row 3: Address, Postal Code, TIN */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingAddressShipping" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                          {t('checkout.houseNumberLabel')}
                  </Label>
                  <Input
                          id="billingAddressShipping"
                          value={formData.billingAddress.address1}
                          onChange={(e) => {
                            handleInputChange(e, "billingAddress", "address1")
                            if (validationErrors.billingAddress1) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                delete newErrors.billingAddress1
                                return newErrors
                              })
                            }
                          }}
                          placeholder={t('checkout.phHouse')}
                    className={cn(
                          darkHeaderFooterClasses.inputBg,
                          darkHeaderFooterClasses.textNeutralPrimary,
                          darkHeaderFooterClasses.inputPlaceholder,
                            validationErrors.billingAddress1
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : darkHeaderFooterClasses.inputBorder
                    )}
                  />
                        {validationErrors.billingAddress1 && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.billingAddress1}</p>
                  )}
                </div>

                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingPostalCodeShipping" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                          {t('checkout.postalCodeOptionalLabel')}
                  </Label>
                  <Input
                          id="billingPostalCodeShipping"
                          value={formData.billingAddress.postalCode}
                          onChange={(e) => handleInputChange(e, "billingAddress", "postalCode")}
                          placeholder={t('checkout.phPostal')}
                    className={cn(
                          darkHeaderFooterClasses.inputBg,
                          darkHeaderFooterClasses.inputBorder,
                          darkHeaderFooterClasses.textNeutralPrimary,
                          darkHeaderFooterClasses.inputPlaceholder,
                    )}
                  />
                    </div>

                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingTinShipping" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                          {t('checkout.tinOptionalLabel')}
                    </Label>
                    <Input
                          id="billingTinShipping"
                          value={formData.billingAddress.tin || ""}
                          onChange={(e) => handleInputChange(e, "billingAddress", "tin")}
                          placeholder={t('checkout.phTin')}
                      className={cn(
                        darkHeaderFooterClasses.inputBg,
                        darkHeaderFooterClasses.inputBorder,
                        darkHeaderFooterClasses.textNeutralPrimary,
                        darkHeaderFooterClasses.inputPlaceholder,
                      )}
                    />
                      </div>
                  </div>
                </>
              )}
              
                {/* Show summary if using same as shipping */}
                {formData.sameAsShipping && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <p className={cn("text-sm font-medium", themeClasses.mainText)}>
                        {t('checkout.usingShippingForBillingLabel')}
                    </p>
                  </div>
                    <div className="text-sm space-y-1">
                      <p className={themeClasses.mainText}>{formData.shippingAddress.fullName}</p>
                      <p className={themeClasses.textNeutralSecondary}>{formData.shippingAddress.address1}</p>
                      <p className={themeClasses.textNeutralSecondary}>
                        {formData.shippingAddress.country === 'Tanzania'
                          ? [formData.shippingAddress.region, formData.shippingAddress.district, formData.shippingAddress.ward].filter(Boolean).join(', ') || formData.shippingAddress.city
                          : formData.shippingAddress.city}, {formData.shippingAddress.country}
                      </p>
                      <p className={themeClasses.textNeutralSecondary}>{formData.shippingAddress.phone}</p>
                </div>
              </div>
                )}
            </CardContent>
          </Card>
        )
        } else {
          // For pickup, case 2 is order review
          if (isProcessingPayment || paymentLinkGenerated) {
            return renderSecurePayment()
          }
          
        return (
          <>
            <Card className={cn("border border-neutral-200 bg-white text-neutral-900 shadow-none")}>
              <CardContent className="p-3 sm:p-4 md:p-6 space-y-6" style={{ contentVisibility: 'auto' }}>
                {renderReviewItems()}

                {/* Applied promotion - same style as cart page (read-only) */}
                {appliedPromotion && (
                  <div className="flex items-center justify-between p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Ticket className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-semibold text-green-800 dark:text-green-200">
                          {appliedPromotion.code}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-300">
                        {appliedPromotion.name || t('cart.promotionNameFallback')} • {formatPrice(appliedPromotion.discountAmount)} {t('cart.promoDiscountApplied')}
                      </p>
                    </div>
                  </div>
                )}

            </CardContent>
          </Card>
          </>
        )
          }

      case 3:
        if ((deliveryOption as string) === 'shipping') {
          // For shipping, case 3 is order review
          if (isProcessingPayment || paymentLinkGenerated) {
            return renderSecurePayment()
          }
          
        return (
          <>
            <Card className={cn("border border-neutral-200 bg-white text-neutral-900 shadow-none")}>
              <CardContent className="p-3 sm:p-4 md:p-6 space-y-6">
                {renderReviewItems()}

                {/* Applied promotion - same style as cart page (read-only) */}
                {appliedPromotion && (
                  <div className="flex items-center justify-between p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Ticket className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-semibold text-green-800 dark:text-green-200">
                          {appliedPromotion.code}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-300">
                        {appliedPromotion.name || t('cart.promotionNameFallback')} • {formatPrice(appliedPromotion.discountAmount)} {t('cart.promoDiscountApplied')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Shipping Address */}
                <div className="space-y-3 sm:space-y-4">
                  <h3 className={cn("text-xl font-bold sm:text-2xl", themeClasses.mainText)}>
                    {t('checkout.reviewShippingTitle')}
                  </h3>
                  <div className={cn(
                    "rounded-xl p-4 sm:p-5 space-y-3 sm:space-y-4",
                    "bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700",
                  )}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1">
                        <p className={cn("text-sm font-semibold", themeClasses.textNeutralSecondary)}>{t('checkout.reviewFullName')}</p>
                        <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.fullName || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className={cn("text-sm font-semibold", themeClasses.textNeutralSecondary)}>{t('checkout.reviewPhone')}</p>
                        <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.phone || '—'}</p>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <p className={cn("text-sm font-semibold", themeClasses.textNeutralSecondary)}>{t('checkout.reviewEmail')}</p>
                        <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.email || '—'}</p>
                      </div>
                      {formData.shippingAddress.streetName && (
                        <div className="space-y-1">
                          <p className={cn("text-sm font-semibold", themeClasses.textNeutralSecondary)}>{t('checkout.reviewStreet')}</p>
                          <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.streetName}</p>
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className={cn("text-sm font-semibold", themeClasses.textNeutralSecondary)}>{t('checkout.reviewHouseBuilding')}</p>
                        <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.address1 || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className={cn("text-sm font-semibold", themeClasses.textNeutralSecondary)}>{formData.shippingAddress.country === 'Tanzania' ? t('checkout.reviewRegionDistrictWard') : t('checkout.reviewCity')}</p>
                        <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>
                          {formData.shippingAddress.country === 'Tanzania'
                            ? [formData.shippingAddress.region, formData.shippingAddress.district, formData.shippingAddress.ward].filter(Boolean).join(', ') || '—'
                            : (formData.shippingAddress.city || '—')}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className={cn("text-sm font-semibold", themeClasses.textNeutralSecondary)}>{t('checkout.reviewCountry')}</p>
                        <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.country || '—'}</p>
                      </div>
                      {(formData.shippingAddress.postalCode || formData.shippingAddress.state) && (
                        <div className="space-y-1">
                          <p className={cn("text-sm font-semibold", themeClasses.textNeutralSecondary)}>{t('checkout.reviewMoreDetails')}</p>
                          <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>
                            {[formData.shippingAddress.postalCode, formData.shippingAddress.state].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      )}
                      {formData.shippingAddress.address2 && (
                        <div className="space-y-1 sm:col-span-2">
                          <p className={cn("text-sm font-semibold", themeClasses.textNeutralSecondary)}>{t('checkout.reviewFamousPlace')}</p>
                          <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.address2}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

            </CardContent>
          </Card>
          </>
        )
        } else {
          // For pickup, case 3 is order confirmation
          return (
            <Card className={cn("border border-neutral-200 bg-white text-neutral-900 shadow-none")}>
              <CardHeader className="text-center">
                <CardTitle className={cn("text-2xl text-green-600", themeClasses.mainText)}>
                  {t('checkout.orderConfirmedTitle')}
                </CardTitle>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  Thank you for your order. We will notify you when it is ready for pickup.
                </p>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg space-y-3">
              <div>
                    <p className={cn("font-medium text-lg", themeClasses.mainText)}>
                      Pickup ID: {orderPickupId || orderId}
                    </p>
                    <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                      Use this ID for pickup reference
                          </p>
                        </div>
                  {paymentStatus && (
                    <div className="pt-2 border-t border-green-200 dark:border-green-800">
                      <p className={cn("text-sm font-medium", themeClasses.mainText)}>
                        Payment Status: 
                        <span className={cn(
                          "ml-2 px-2 py-1 rounded text-xs",
                          paymentStatus === 'paid' 
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        )}>
                          {paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                        </span>
                          </p>
                        </div>
                  )}
              </div>
            </CardContent>
              <CardFooter className="justify-center">
                <Link href="/home">
                  <Button className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600">
                    Continue Shopping
              </Button>
                </Link>
            </CardFooter>
          </Card>
        )
        }

      case 4:
        // For shipping, case 4 is order confirmation
        return (
          <Card className={cn("border border-neutral-200 bg-white text-neutral-900 shadow-none")}>
            <CardHeader className="text-center">
              <CardTitle className={cn("text-2xl text-green-600", themeClasses.mainText)}>
                  {t('checkout.orderConfirmedTitle')}
                </CardTitle>
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                Thank you for your order. We will process it and send you tracking information.
              </p>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg space-y-3">
                <div>
                  <p className={cn("font-medium text-lg", themeClasses.mainText)}>
                    Order ID: {orderPickupId || orderId}
                  </p>
                  <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                    Please save this order ID for your records
                  </p>
                </div>
                {paymentStatus && (
                  <div className="pt-2 border-t border-green-200 dark:border-green-800">
                    <p className={cn("text-sm font-medium", themeClasses.mainText)}>
                      Payment Status: 
                      <span className={cn(
                        "ml-2 px-2 py-1 rounded text-xs",
                        paymentStatus === 'paid' 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                      )}>
                        {paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </p>
                  </div>
                )}
                </div>
            </CardContent>
            <CardFooter className="justify-center">
              <Link href="/">
                <Button className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600">
                  Continue Shopping
                </Button>
                </Link>
            </CardFooter>
          </Card>
        )

      default:
        return null
    }
  }

  const stepTitles = useMemo(
    () =>
      deliveryOption === 'pickup'
        ? [
            t('checkout.stepDelivery'),
            t('checkout.stepBilling'),
            t('checkout.stepReview'),
            t('checkout.stepConfirmed'),
          ]
        : [
            t('checkout.stepDelivery'),
            t('checkout.stepShipping'),
            t('checkout.stepBilling'),
            t('checkout.stepReview'),
            t('checkout.stepConfirmed'),
          ],
    [deliveryOption, t]
  )

  const maxSteps = deliveryOption === 'pickup' ? 4 : 5
  const onPayStep = (deliveryOption === 'pickup' && currentStep === 2) || (deliveryOption === 'shipping' && currentStep === 3)
  const phoneDigits = paymentPhone.replace(/\D/g, "")
  const networkPrefix = phoneDigits.startsWith("255") ? phoneDigits.slice(3, 5) : phoneDigits.startsWith("0") ? phoneDigits.slice(1, 3) : phoneDigits.slice(0, 2)
  const detectedNetwork =
    ["74", "75", "76"].includes(networkPrefix) ? "M-Pesa" :
    ["68", "69", "78"].includes(networkPrefix) ? "Airtel Money" :
    ["65", "67", "71"].includes(networkPrefix) ? "Mixx by Yas" :
    networkPrefix === "62" ? "Halotel" :
    null
  const mobileNetworks = ["Airtel Money", "M-Pesa", "Mixx by Yas", "Halotel"]

  const summaryItems = selectedItems.flatMap((item) =>
    (item.variants || []).map((variant: { variantId?: string | number; variant_name?: string; quantity?: number; price?: number; image?: string }) => ({
      key: `${item.productId}-${variant.variantId || variant.variant_name || "item"}`,
      name: item.product?.name || "Item",
      variant: variant.variant_name,
      quantity: variant.quantity || 1,
      total: (variant.price || 0) * (variant.quantity || 1),
      image: variant.image || item.product?.image || "",
    }))
  )

  return (
    <div className="honic-checkout min-h-screen bg-[#f3f4f6] text-neutral-950">
      {!isClient ? (
        <div className="mx-auto max-w-6xl px-4 py-8">
          <CheckoutPageSkeleton />
        </div>
      ) : (
    <>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/cart" className="flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-950">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('checkout.backToCart')}</span>
          </Link>
            <div className="flex items-center gap-2">
              <LazyImage src={displayLogo} alt={brandName} width={28} height={28} className="h-7 w-7 object-contain" />
              <p className="text-base font-bold tracking-tight sm:text-lg">Honic Company Limited</p>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium">
              {!user && (
                <button type="button" onClick={() => openAuthModal('login')} className="hidden font-semibold text-neutral-950 sm:inline">
                  Sign in
                </button>
              )}
              <span className="hidden items-center gap-1 text-neutral-500 sm:flex"><Lock className="h-3.5 w-3.5" /> Secure</span>
              <CheckoutLanguageToggle />
            </div>
          </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <ol className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {stepTitles.map((title, index) => {
            const done = index < currentStep
            const active = index === currentStep
            return (
              <li key={`${title}-${index}`} className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold sm:text-sm", active ? "border-neutral-950 bg-neutral-950 text-white" : done ? "border-yellow-300 bg-yellow-400 text-neutral-950" : "border-neutral-200 bg-white text-neutral-400")}>
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]", active ? "bg-yellow-400 text-neutral-950" : done ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-400")}>
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="truncate">{title}</span>
              </li>
            )
          })}
        </ol>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="order-2 min-w-0 space-y-4 lg:order-1">
            <div className="honic-checkout-form space-y-4 text-sm text-neutral-900 sm:text-base [&_input]:h-11 [&_input]:rounded-lg [&_input]:border-neutral-200 [&_input]:bg-white [&_input]:text-base [&_input]:md:text-sm [&_label]:text-sm [&_label]:font-medium [&_label]:text-neutral-700">
              {renderStepContent()}
            </div>

            {currentStep < maxSteps - 1 && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button onClick={handleBack} variant="ghost" className="h-12 rounded-lg text-sm font-semibold text-neutral-600 sm:text-base">
                  {currentStep === 0 ? t('checkout.backToCart') : t('checkout.backShort')}
                </Button>
                <div className="sm:w-64">
                  {onPayStep ? (
                    paymentLinkGenerated ? (
                      <Button disabled className="h-12 w-full rounded-lg bg-yellow-500 text-sm font-semibold text-neutral-950 sm:text-base">Waiting for your PIN</Button>
                    ) : (
                      <Button
                        onClick={handlePlaceOrder}
                        disabled={isProcessingPayment || paymentLinkGenerated}
                        className="h-12 w-full rounded-lg bg-yellow-500 text-sm font-semibold text-neutral-950 hover:bg-yellow-600 disabled:opacity-50 sm:text-base"
                      >
                        {isProcessingPayment ? 'Sending securely' : paymentError ? t('checkout.tryAgain') : `Pay ${formatPrice(orderTotal)}`}
                      </Button>
                    )
                  ) : (
                    <Button onClick={handleNext} className="h-12 w-full rounded-lg bg-yellow-500 text-sm font-semibold text-neutral-950 hover:bg-yellow-600 sm:text-base">
                      {t('checkout.continue')}
                    </Button>
                  )}
                  {paymentError && !isProcessingPayment && !paymentLinkGenerated && (
                    <p className="mt-2 text-sm text-red-600">{paymentError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="order-1 space-y-4 lg:sticky lg:top-6 lg:order-2">
            <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
                <h2 className="text-base font-bold">Your order</h2>
                <p className="text-sm font-medium text-neutral-500">{summaryItems.length} item{summaryItems.length === 1 ? "" : "s"}</p>
              </div>
              <div className="max-h-80 divide-y divide-neutral-100 overflow-y-auto px-5">
                {summaryItems.length === 0 ? (
                  <p className="py-6 text-sm text-neutral-500">Your cart is empty.</p>
                ) : summaryItems.map((item) => (
                  <div key={item.key} className="flex items-center gap-3 py-3">
                    <div className="relative h-16 w-16 shrink-0 rounded-lg bg-neutral-100">
                      {item.image ? (
                        <img src={item.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center text-neutral-300"><Package className="h-5 w-5" /></div>
                      )}
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-950 px-1 text-[11px] font-bold text-white">{item.quantity}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      {item.variant ? <p className="truncate text-xs text-neutral-500">{item.variant}</p> : null}
                    </div>
                    <p className="text-sm font-semibold tabular-nums">{formatPrice(item.total)}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t border-neutral-100 px-5 py-4 text-sm">
                <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span className="font-medium tabular-nums">{formatPrice(displaySubtotal)}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500">{deliveryOption === "pickup" ? "Store pickup" : "Delivery"}</span><span className="font-medium">{shippingFeeLineLoading && deliveryOption === "shipping" ? "…" : deliveryOption === "pickup" || shippingFee === 0 ? "Free" : formatPrice(shippingFee)}</span></div>
                {promotionDiscount > 0 && (
                  <div className="flex justify-between text-green-700"><span>Discount</span><span className="font-medium tabular-nums">-{formatPrice(promotionDiscount)}</span></div>
                )}
                <div className="flex items-end justify-between border-t border-neutral-100 pt-3">
                  <span className="font-semibold">Total due now</span>
                  <span className="text-xl font-bold tabular-nums">{formatPrice(orderTotal)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold">Payment</h2>
              <div className="mt-3 rounded-xl border-2 border-neutral-950 p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-400 text-neutral-950"><Smartphone className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Mobile money</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">The request goes to {paymentPhone || "your phone"}. Your PIN stays on the phone.</p>
                  </div>
                  <Check className="h-4 w-4 shrink-0 text-neutral-950" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {mobileNetworks.map((network) => (
                    <span key={network} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", detectedNetwork === network ? "bg-yellow-400 text-neutral-950" : "bg-neutral-100 text-neutral-600")}>{network}</span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-neutral-500">{detectedNetwork ? `This number is ${detectedNetwork}.` : "The network is read from the phone number."}</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
    )}
    </div>
  )
}
 