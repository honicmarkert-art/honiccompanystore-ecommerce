"use client"

import { BuyerRouteGuard } from '@/components/buyer-route-guard'
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { LazyImage } from "@/components/lazy-image"
import { logger } from '@/lib/logger'
import {
  ChevronLeft,
  Truck,
  MapPin,
  Package,
  Clock,
  DollarSign,
  Navigation,
  Zap,
  Gift,
  MapPinIcon,
  Bell,
  Lightbulb,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useCart } from "@/hooks/use-cart"
import { useAuth } from "@/contexts/auth-context"
import { useCompanyContext } from "@/components/company-provider"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { useCurrency } from "@/contexts/currency-context"
import { useComingSoonModal } from "@/components/coming-soon-modal"
import { useToast } from "@/hooks/use-toast"
import { validateTanzaniaPhone, validateEmail } from "@/lib/phone-validation"
import { CheckoutPageSkeleton } from "@/components/ui/skeleton"
import { 
  getSiteUrl, 
  buildReturnUrl, 
  buildCancelUrl, 
  sessionStorage as safeSessionStorage,
  clearCheckoutSessionStorage,
  getSecureErrorMessage,
  fetchWithRetry
} from "@/lib/checkout-utils"

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
}

interface PaymentDetails {
  paymentMethod: 'clickpesa' | 'card' | 'mobile_money'
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
  const { backgroundColor, setBackgroundColor, themeClasses, darkHeaderFooterClasses } = useTheme()
  const { cart, cartTotalItems, cartSubtotal, clearCart, removeItem } = useCart()
  const { user } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const { companyName, companyColor, companyLogo, isLoaded: companyLoaded } = useCompanyContext()
  const { toast } = useToast()
  
  // Fallback logo system - use local logo if API is not loaded or logo is not available
  const fallbackLogo = "/android-chrome-512x512.png"
  const displayLogo = companyLoaded && companyLogo && companyLogo !== fallbackLogo && companyLogo !== "/placeholder-logo.png" ? companyLogo : fallbackLogo
  const { currency, setCurrency, formatPrice } = useCurrency()
  const { showComingSoon, ComingSoonModal } = useComingSoonModal()

  // Get selected items for display
  const getSelectedItems = () => {
    let selectedIds: number[] = []
    let buyNowMode: boolean = false
    let buyNowItemData: any = null
    
    try { 
      const raw = safeSessionStorage.getItem('selected_cart_items')
      if (raw) {
        const parsed = JSON.parse(raw)
        // Validate that parsed data is an array of numbers
        if (Array.isArray(parsed) && parsed.every((id: any) => typeof id === 'number' && id > 0)) {
          selectedIds = parsed
        }
      }
      
      const buyNowModeRaw = safeSessionStorage.getItem('buy_now_mode')
      if (buyNowModeRaw === 'true') buyNowMode = true
      
      const buyNowDataRaw = safeSessionStorage.getItem('buy_now_item_data')
      if (buyNowDataRaw) {
        const parsed = JSON.parse(buyNowDataRaw)
        // Validate buyNowItemData structure
        if (parsed && typeof parsed === 'object' && parsed.productId && typeof parsed.productId === 'number') {
          buyNowItemData = parsed
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
  const selectedItemsCount = selectedItems.reduce((sum, item) => sum + item.totalQuantity, 0)
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0)
  
  
  // Calculate shipping cost: 5,000 TZS if order is less than 100,000 TZS, otherwise free
  const FREE_SHIPPING_THRESHOLD = 100000
  const SHIPPING_COST = 5000
  
  const [currentStep, setCurrentStep] = useState(0)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [paymentLinkGenerated, setPaymentLinkGenerated] = useState(false)
  const [checkoutLinkUrl, setCheckoutLinkUrl] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string>("")
  const [orderReferenceId, setOrderReferenceId] = useState<string | null>(null)
  const [orderPickupId, setOrderPickupId] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [deliveryOption, setDeliveryOption] = useState<'shipping' | 'pickup'>('shipping')
  
  // Calculate shipping fee based on delivery option and order total
  const calculateShippingFee = () => {
    if (deliveryOption === 'pickup') return 0
    
    // If cart total >= 100,000 TZS: Free delivery for all
    if (selectedSubtotal >= FREE_SHIPPING_THRESHOLD) return 0
    
    // If cart total < 100,000 TZS: Check if ALL selected products have free delivery
    const allProductsHaveFreeDelivery = selectedItems.every(item => {
      return (item as any)?.free_delivery === true || (item as any)?.freeDelivery === true
    })
    
    // If ALL products have free delivery: Free delivery
    // If MIXED products (some free, some paid): Apply delivery fee
    return allProductsHaveFreeDelivery ? 0 : SHIPPING_COST
  }
  
  const shippingFee = calculateShippingFee()
  
  // Get applied promotion from sessionStorage
  const [appliedPromotion, setAppliedPromotion] = useState<{
    code: string
    discountAmount: number
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
          setAppliedPromotion(parsed)
        }
      }
    } catch {}
  }, [])
  
  const promotionDiscount = appliedPromotion ? appliedPromotion.discountAmount : 0
  const orderTotal = selectedSubtotal + shippingFee - promotionDiscount

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
  const [showMapContainer, setShowMapContainer] = useState(false)

  // Fix hydration mismatch
  useEffect(() => {
    setIsClient(true)
  }, [])

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
    },
    paymentDetails: {
      paymentMethod: 'clickpesa',
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

  // Track if form has been prefilled to prevent overwriting user edits
  const hasPrefilledRef = useRef(false)

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
        ...(prev[section] as any),
        [field]: value
      }
    }))
  }

  const handlePlaceOrder = async () => {
      if (!cart || cart.length === 0) {
        toast({
          title: "Empty Cart",
          description: "Your cart is empty. Please add items before placing an order.",
          variant: "destructive"
        })
        return
      }

    setIsProcessingPayment(true)
    setPaymentError(null)
    setPaymentLinkGenerated(false) // Reset payment link state
    setCheckoutLinkUrl(null)

    // Declare paymentFlowStartTime outside try block so it's accessible in catch block
    let paymentFlowStartTime: number | undefined
    let paymentFlowStartTimestamp: number | undefined

    try {
      // For pickup orders, validate billing address; for shipping, validate shipping address
      const customerInfo = deliveryOption === 'pickup' ? formData.billingAddress : formData.shippingAddress

      // Validate phone number
      const phoneValidation = validateTanzaniaPhone(customerInfo.phone)
      if (!phoneValidation.valid) {
        setIsProcessingPayment(false)
        toast({
          title: "Invalid Phone Number",
          description: phoneValidation.error,
          variant: "destructive"
        })
        return
      }

      // Validate email
      const emailValidation = validateEmail(customerInfo.email)
      if (!emailValidation.valid) {
        setIsProcessingPayment(false)
        toast({
          title: "Invalid Email Address",
          description: emailValidation.error,
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
          if (Array.isArray(parsed) && parsed.every((id: any) => typeof id === 'number' && id > 0)) {
            selectedIds = parsed
          }
        }
      } catch {}

      // Generate unique order ID
      const orderId = `ORD-${Date.now()}`
      
      // Prepare order data (reuse selectedIds from validation above)
      const selectedItems = selectedIds.length > 0 ? cart.filter(i => selectedIds.includes(i.productId)) : cart

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
        shippingAddress: formData.shippingAddress,
        billingAddress: formData.sameAsShipping ? formData.shippingAddress : formData.billingAddress,
        deliveryOption,
        shippingFee: shippingFee,
        promotionCode: appliedPromotion?.code || null,
        promotionDiscount: promotionDiscount,
        totalAmount: orderTotal,
        timestamp: new Date().toISOString(),
      }

      // Start payment flow timing after orderData is created
      paymentFlowStartTime = performance.now()
      paymentFlowStartTimestamp = Date.now()

      // Check if we already have an order (from previous failed payment link generation)
      // If order exists, reuse it instead of creating a new one
      let result
      let orderSubmissionDuration = 0
      
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
              const orderSubmissionStartTime = performance.now()
              result = await submitOrder(orderData)
              const orderSubmissionEndTime = performance.now()
              orderSubmissionDuration = orderSubmissionEndTime - orderSubmissionStartTime
              setOrderId(result.order.id)
              setOrderReferenceId(result.order.referenceId)
              setOrderPickupId(result.order.pickupId)
              setPaymentStatus(result.order.paymentStatus)
            }
          } catch (error) {
            // Error fetching order, create new one
            const orderSubmissionStartTime = performance.now()
            result = await submitOrder(orderData)
            const orderSubmissionEndTime = performance.now()
            orderSubmissionDuration = orderSubmissionEndTime - orderSubmissionStartTime
            setOrderId(result.order.id)
            setOrderReferenceId(result.order.referenceId)
            setOrderPickupId(result.order.pickupId)
            setPaymentStatus(result.order.paymentStatus)
          }
        } else {
          // No existing order, create new one
          const orderSubmissionStartTime = performance.now()
          result = await submitOrder(orderData)
          const orderSubmissionEndTime = performance.now()
          orderSubmissionDuration = orderSubmissionEndTime - orderSubmissionStartTime
          
          setOrderId(result.order.id)
          setOrderReferenceId(result.order.referenceId)
          setOrderPickupId(result.order.pickupId)
          setPaymentStatus(result.order.paymentStatus)
        }
      } catch (orderError: any) {
        // If order submission fails, clear loading state and throw error
        setIsProcessingPayment(false)
        throw orderError
      }
      
      // DON'T remove items from cart yet - wait until payment is confirmed
      // Items will be removed after successful payment via webhook or return page

      // Generate ClickPesa checkout link immediately using order data from response
      // No delay needed - order is already committed and we use the reference from response
      // Use the order's total amount (in case we're reusing an existing order)
      const reference = result.order.referenceId || orderId
      const orderTotalAmount = result.order.totalAmount || orderData.totalAmount
      const checkoutLinkStartTime = performance.now()
      const checkoutLinkStartTimestamp = Date.now()
      
      // Optimized: Use fetchWithRetry with faster retries (2 retries, shorter delays)
      // Retries on: network errors, 5xx server errors, 429 rate limits, 408 timeouts
      const response = await fetchWithRetry(
        '/api/payment/clickpesa',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create-checkout-link',
            amount: String(orderTotalAmount),
            currency: 'TZS',
            orderId: reference,
            returnUrl: buildReturnUrl(reference),
            cancelUrl: buildCancelUrl(reference),
            customerDetails: {
              fullName: formData.billingAddress.fullName || formData.shippingAddress.fullName,
              email: formData.billingAddress.email || formData.shippingAddress.email,
              phone: formData.billingAddress.phone || formData.shippingAddress.phone,
              firstName: (formData.billingAddress.fullName || formData.shippingAddress.fullName)?.split(' ')[0] || '',
              lastName: (formData.billingAddress.fullName || formData.shippingAddress.fullName)?.split(' ').slice(1).join(' ') || '',
              address: formData.billingAddress.address1 || formData.shippingAddress.address1 || '',
              city: formData.billingAddress.city || formData.shippingAddress.city || '',
              country: formData.billingAddress.country || formData.shippingAddress.country || 'Tanzania',
            },
          }),
        },
        1 // Reduced to 1 retry for fastest failure (handles network errors, 5xx, 429, 408)
      )

      // Optimized: Parse JSON directly instead of text() then parse
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed' }))
        throw new Error(errorData.error || 'Failed')
      }

      const data = await response.json()

      if (!data.checkoutLink) {
        throw new Error('Failed')
      }

      const checkoutLinkEndTime = performance.now()
      const checkoutLinkDuration = checkoutLinkEndTime - checkoutLinkStartTime
      const checkoutLinkEndTimestamp = Date.now()

      // Store reference for later use
      safeSessionStorage.setItem('last_order_reference', reference)

      // Store checkout link for fallback if popup is blocked
      setCheckoutLinkUrl(data.checkoutLink)
      
      // Mark payment link as generated (for UI message update)
      setPaymentLinkGenerated(true)
 // Reset popup blocked state

      // Track redirect timing
      const redirectStartTime = performance.now()
      const redirectStartTimestamp = Date.now()

      // Immediately open ClickPesa checkout in new window/tab
      // Since this is called from a user click event, window.open should work
      let popupOpened = false
      try {
        const popupWindow = window.open(data.checkoutLink, '_blank', 'noopener,noreferrer')
        
        // Check if popup was blocked (check immediately and after brief delay)
        if (popupWindow) {
          // Check immediately
          if (popupWindow.closed === false) {
            popupOpened = true
          } else {
            // Check again after a brief delay (popup might take time to open)
            setTimeout(() => {
              if (popupWindow && !popupWindow.closed) {
                popupOpened = true
              }
            }, 100)
          }
        }
      } catch (error) {
        // Popup failed to open
      }
      
      const redirectEndTime = performance.now()
      const redirectDuration = redirectEndTime - redirectStartTime
      const redirectCompleteTimestamp = Date.now()
      
      if (popupOpened) {
        // Successfully opened in new tab
        const totalFlowDuration = paymentFlowStartTime ? performance.now() - paymentFlowStartTime : 0
        
        toast({
          title: 'Payment Page Opened',
          description: 'Please complete your payment in the new window. You will be redirected back after payment.',
          duration: 5000
        })
      } else {
        // Popup was blocked or failed - show fallback button
        
        toast({
          title: 'Payment Link Ready',
          description: 'Click the button below to open the payment page in a new window.',
          duration: 5000
        })
      }
      
      // Clear processing state after redirect is initiated (keep message visible briefly)
      // Small delay to ensure redirect happens and user sees success message
      setTimeout(() => {
        setIsProcessingPayment(false)
      }, 500) // Brief delay to show success message

      // Log total payment flow duration
      const totalPaymentFlowDuration = paymentFlowStartTime ? performance.now() - paymentFlowStartTime : 0

    } catch (error: any) {
      const totalPaymentFlowDuration = paymentFlowStartTime ? performance.now() - paymentFlowStartTime : 0
      
      logger.error('Payment initiation error:', {
        error: error,
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      })
      
      // Always clear loading state on error
      setIsProcessingPayment(false)
      setPaymentLinkGenerated(false) // Reset on error
      setCheckoutLinkUrl(null)
      
      // Show user-friendly error message
      const errorMessage = error?.message || 'Failed to process order. Please try again.'
      
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
  const submitOrder = async (orderData: any) => {
    const apiCallStartTime = performance.now()
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
      const apiCallDuration = performance.now() - apiCallStartTime
      
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
      setValidationErrors({ deliveryOption: "Please select a delivery option" })
      return false
    }
    return true
  }

  const validateShippingAddress = () => {
    const errors: Record<string, string> = {}

      if (!formData.shippingAddress.fullName.trim()) {
      errors.shippingFullName = "Full name is required"
      }
      if (!formData.shippingAddress.phone.trim()) {
      errors.shippingPhone = "Phone number is required"
      }
      if (!formData.shippingAddress.email.trim()) {
      errors.shippingEmail = "Email address is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.shippingAddress.email)) {
      errors.shippingEmail = "Please enter a valid email address"
    }
    if (!formData.shippingAddress.city.trim()) {
      errors.shippingCity = "City is required"
    }
    if (!formData.shippingAddress.streetName?.trim()) {
      errors.shippingStreet = "Street name is required"
    }
    if (!formData.shippingAddress.address1.trim()) {
      errors.shippingAddress1 = "House/building number is required"
    }
    if (!formData.shippingAddress.address2?.trim()) {
      errors.shippingLandmark = "Nearby landmark is required"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateBillingInformation = () => {
    // For pickup orders, we only need basic billing info (name, email, phone)
    if (deliveryOption === 'pickup') {
      const errors: Record<string, string> = {}
      
      if (!formData.billingAddress.fullName.trim()) {
        errors.billingFullName = "Full name is required"
      }
      if (!formData.billingAddress.phone.trim()) {
        errors.billingPhone = "Phone number is required"
      } else {
        // Validate Tanzania phone number format
        const phoneValidation = validateTanzaniaPhone(formData.billingAddress.phone)
        if (!phoneValidation.valid) {
          errors.billingPhone = phoneValidation.error || "Invalid phone number"
        }
      }
      if (!formData.billingAddress.email.trim()) {
        errors.billingEmail = "Email address is required"
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.billingAddress.email)) {
        errors.billingEmail = "Please enter a valid email address"
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
      errors.billingFullName = "Full name is required"
    }
    if (!formData.billingAddress.phone.trim()) {
      errors.billingPhone = "Phone number is required"
    } else {
      // Validate Tanzania phone number format
      const phoneValidation = validateTanzaniaPhone(formData.billingAddress.phone)
      if (!phoneValidation.valid) {
        errors.billingPhone = phoneValidation.error || "Invalid phone number"
      }
    }
    if (!formData.billingAddress.email.trim()) {
      errors.billingEmail = "Email address is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.billingAddress.email)) {
      errors.billingEmail = "Please enter a valid email address"
    }
    if (!formData.billingAddress.city.trim()) {
      errors.billingCity = "City is required"
    }
    if (!formData.billingAddress.streetName?.trim()) {
      errors.billingStreet = "Street name is required"
    }
    if (!formData.billingAddress.address1.trim()) {
      errors.billingAddress1 = "Address is required"
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className={cn("text-lg sm:text-xl", themeClasses.mainText)}>Delivery Option</CardTitle>
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Choose how you'd like to receive your order</p>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {/* Validation Error Display */}
              {validationErrors.deliveryOption && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
                  <p className="text-sm text-red-600 dark:text-red-400">{validationErrors.deliveryOption}</p>
              </div>
              )}

              <div className="space-y-4">
                <div 
                         className={cn(
                    "border-2 rounded-lg p-4 cursor-pointer transition-all",
                    (deliveryOption as string) === 'shipping' 
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" 
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
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
                      <h3 className={cn("font-medium text-base", themeClasses.mainText)}>Shipping Delivery</h3>
                      <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                        We'll deliver your order directly to your doorstep
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center space-x-2">
                          <Package className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Delivery Time:</strong> 3-5 business days
                          </p>
                       </div>
                        <div className="flex items-center space-x-2">
                          <DollarSign className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Delivery Fee:</strong> TZS 5,000 (Free on orders over TZS 100,000)
                          </p>
                   </div>
                        <div className="flex items-center space-x-2">
                          <Navigation className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Coverage:</strong> Dar es Salaam, Arusha, Mwanza, Dodoma
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Delivery Hours:</strong> Monday - Saturday, 8:00 AM - 6:00 PM
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
               </div>

                <div 
                   className={cn(
                    "border-2 rounded-lg p-4 cursor-pointer transition-all",
                    deliveryOption === 'pickup' 
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" 
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
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
                      <h3 className={cn("font-medium text-base", themeClasses.mainText)}>Store Pickup</h3>
                      <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                        Pick up your order from our store location
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center space-x-2">
                          <Zap className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Ready Time:</strong> Same day or next business day
                          </p>
               </div>
                        <div className="flex items-center space-x-2">
                          <Gift className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Pickup Fee:</strong> FREE - No additional charges
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPinIcon className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Location:</strong> {companyName} Store, Dar es Salaam
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Pickup Hours:</strong> Monday - Saturday, 8:00 AM - 8:00 PM
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Bell className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Notification:</strong> SMS/Email when ready for pickup
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
            <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className={cn("text-lg sm:text-xl", themeClasses.mainText)}>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:gap-4 p-3 sm:p-6">
                {/* Row 1: Full Name, Phone, Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingFullName" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                  Full Name *
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
                      placeholder="Enter your full name"
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
                      Phone Number *
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
                      placeholder="e.g., +255 123 456 789"
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
                      Email Address *
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
                      placeholder="your.email@example.com"
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

                {/* Row 2: Country, Region/City, Street Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingCountry" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                      Country *
                  </Label>
                    <select
                      id="shippingCountry"
                      value={formData.shippingAddress.country}
                      onChange={(e) => handleInputChange(e, "shippingAddress", "country")}
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
                    <Label htmlFor="shippingCity" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                      Region/City *
                  </Label>
                  <Input
                          id="shippingCity"
                          value={formData.shippingAddress.city}
                          onChange={(e) => {
                            handleInputChange(e, "shippingAddress", "city")
                            if (validationErrors.shippingCity) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                delete newErrors.shippingCity
                                return newErrors
                              })
                            }
                          }}
                          placeholder="e.g., Dar es Salaam, Arusha, Mwanza"
                    className={cn(
                          darkHeaderFooterClasses.inputBg,
                          darkHeaderFooterClasses.textNeutralPrimary,
                          darkHeaderFooterClasses.inputPlaceholder,
                            validationErrors.shippingCity
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : darkHeaderFooterClasses.inputBorder
                    )}
                  />
                        {validationErrors.shippingCity && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingCity}</p>
                  )}
              </div>

                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingStreet" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                      Street Name *
                  </Label>
                  <Input
                          id="shippingStreet"
                          value={formData.shippingAddress.streetName || ""}
                          onChange={(e) => {
                            handleInputChange(e, "shippingAddress", "streetName")
                            if (validationErrors.shippingStreet) {
                              setValidationErrors(prev => {
                                const newErrors = { ...prev }
                                delete newErrors.shippingStreet
                                return newErrors
                              })
                            }
                          }}
                          placeholder="e.g., Samora Avenue, Nyerere Road"
                    className={cn(
                          darkHeaderFooterClasses.inputBg,
                          darkHeaderFooterClasses.textNeutralPrimary,
                          darkHeaderFooterClasses.inputPlaceholder,
                            validationErrors.shippingStreet
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : darkHeaderFooterClasses.inputBorder
                          )}
                        />
                        {validationErrors.shippingStreet && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingStreet}</p>
                        )}
                  </div>
                </div>

                {/* Row 3: House Number, Postal Code (Optional), Additional Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingHouseNumber" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                      House/Building Number *
                    </Label>
                    <Input
                      id="shippingHouseNumber"
                      value={formData.shippingAddress.address1}
                      onChange={(e) => {
                        handleInputChange(e, "shippingAddress", "address1")
                        if (validationErrors.shippingAddress1) {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors.shippingAddress1
                            return newErrors
                          })
                        }
                      }}
                      placeholder="e.g., 123, Block A"
                      className={cn(
                        darkHeaderFooterClasses.inputBg,
                        darkHeaderFooterClasses.textNeutralPrimary,
                        darkHeaderFooterClasses.inputPlaceholder,
                        validationErrors.shippingAddress1
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : darkHeaderFooterClasses.inputBorder
                  )}
                />
                    {validationErrors.shippingAddress1 && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingAddress1}</p>
                  )}
                </div>

                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingPostalCode" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                      Postal Code <span className="text-gray-500">(Optional)</span>
                  </Label>
                  <Input
                      id="shippingPostalCode"
                      value={formData.shippingAddress.postalCode}
                      onChange={(e) => handleInputChange(e, "shippingAddress", "postalCode")}
                      placeholder="e.g., 11101"
                    className={cn(
                        darkHeaderFooterClasses.inputBg,
                        darkHeaderFooterClasses.inputBorder,
                        darkHeaderFooterClasses.textNeutralPrimary,
                        darkHeaderFooterClasses.inputPlaceholder,
                  )}
                />
              </div>

                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingAdditional" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                      Additional Details <span className="text-gray-500">(Optional)</span>
                  </Label>
                  <Input
                      id="shippingAdditional"
                    value={formData.shippingAddress.state}
                    onChange={(e) => handleInputChange(e, "shippingAddress", "state")}
                      placeholder="e.g., Floor 2, Apartment 5"
                    className={cn(
                          darkHeaderFooterClasses.inputBg,
                          darkHeaderFooterClasses.inputBorder,
                          darkHeaderFooterClasses.textNeutralPrimary,
                          darkHeaderFooterClasses.inputPlaceholder,
                    )}
                  />
              </div>
                </div>

                {/* Row 4: Nearby Landmark (Full Width) */}
                <div className="grid gap-1 sm:gap-2">
                  <Label htmlFor="shippingLandmark" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                    Nearby Famous Place/Landmark *
                  </Label>
                  <Input
                    id="shippingLandmark"
                    value={formData.shippingAddress.address2 || ""}
                    onChange={(e) => {
                      handleInputChange(e, "shippingAddress", "address2")
                      if (validationErrors.shippingLandmark) {
                        setValidationErrors(prev => {
                          const newErrors = { ...prev }
                          delete newErrors.shippingLandmark
                          return newErrors
                        })
                      }
                    }}
                    placeholder="e.g., Near Shoprite, Opposite Post Office, Next to Bank of Tanzania"
                    className={cn(
                      darkHeaderFooterClasses.inputBg,
                      darkHeaderFooterClasses.textNeutralPrimary,
                      darkHeaderFooterClasses.inputPlaceholder,
                      validationErrors.shippingLandmark
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                        : darkHeaderFooterClasses.inputBorder
                    )}
                  />
                  {validationErrors.shippingLandmark && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingLandmark}</p>
                  )}
                  <div className="flex items-center space-x-2 mt-1">
                    <Lightbulb className="w-3 h-3 text-transparent" />
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Help us find you easily by mentioning a nearby landmark, shop, or building
                    </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
        } else {
          // For pickup, case 1 is billing information
        return (
          <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className={cn("text-lg sm:text-xl", themeClasses.mainText)}>Contact Information</CardTitle>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  Provide your contact details for order pickup
                </p>
            </CardHeader>
              <CardContent className="grid gap-3 sm:gap-4 p-3 sm:p-6">
                {/* Contact Form for Pickup */}
                <div className="space-y-4">
                    {/* Row 1: Full Name, Email, Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingFullNamePickup" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                      Full Name *
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
                      placeholder="Enter your full name"
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
                          Email Address *
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
                          placeholder="your.email@example.com"
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
                          Phone Number *
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
                          placeholder="e.g., +255 123 456 789"
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
            <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className={cn("text-lg sm:text-xl", themeClasses.mainText)}>Billing Information</CardTitle>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  Provide billing details for your order
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
                    Use the same information as shipping address
                  </Label>
                    </div>

                {/* Billing Form - Show only if not using same as shipping */}
                {!formData.sameAsShipping && (
                  <>
                    {/* Row 1: Full Name, Email, Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      <div className="grid gap-1 sm:gap-2">
                        <Label htmlFor="billingFullNameShipping" className={cn("text-sm sm:text-base", themeClasses.mainText)}>
                          Full Name *
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
                          placeholder="Enter your full name"
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
                          Email Address *
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
                          placeholder="your.email@example.com"
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
                        Phone Number *
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
                          placeholder="e.g., +255 123 456 789"
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
                          Country *
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
                          Region/City *
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
                          placeholder="e.g., Dar es Salaam, Arusha, Mwanza"
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
                          Street Name *
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
                          placeholder="e.g., Samora Avenue, Nyerere Road"
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
                          House/Building Number *
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
                          placeholder="e.g., 123, Block A"
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
                          Postal Code <span className="text-gray-500">(Optional)</span>
                  </Label>
                  <Input
                          id="billingPostalCodeShipping"
                          value={formData.billingAddress.postalCode}
                          onChange={(e) => handleInputChange(e, "billingAddress", "postalCode")}
                          placeholder="e.g., 11101"
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
                          TIN Number <span className="text-gray-500">(Optional)</span>
                    </Label>
                    <Input
                          id="billingTinShipping"
                          value={formData.billingAddress.tin || ""}
                          onChange={(e) => handleInputChange(e, "billingAddress", "tin")}
                          placeholder="e.g., 123456789"
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
                        Using shipping address for billing
                    </p>
                  </div>
                    <div className="text-sm space-y-1">
                      <p className={themeClasses.mainText}>{formData.shippingAddress.fullName}</p>
                      <p className={themeClasses.textNeutralSecondary}>{formData.shippingAddress.address1}</p>
                      <p className={themeClasses.textNeutralSecondary}>
                        {formData.shippingAddress.city}, {formData.shippingAddress.country}
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
            // Show loading message when order is placed or processing payment
            return (
              <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                <CardContent className="text-center py-12">
                  {!hasTimedOut ? (
                    <>
                      {paymentLinkGenerated ? (
                        <div className="mb-6">
                          <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mx-auto mb-6"></div>
                      )}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h3 className={cn("text-xl font-semibold", themeClasses.mainText)}>
                            {paymentLinkGenerated ? 'Payment link generated' : 'Generating payment link...'}
                          </h3>
                          <p className={cn("text-base", themeClasses.textNeutralSecondary)}>
                            {paymentLinkGenerated ? 'Waiting for payment completion...' : 'Please wait while we generate your payment link...'}
                          </p>
                        </div>
                        {paymentLinkGenerated && checkoutLinkUrl && (
                          <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <Button
                              onClick={() => {
                                if (checkoutLinkUrl) {
                                  window.open(checkoutLinkUrl, '_blank', 'noopener,noreferrer')
                                }
                              }}
                              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                              size="lg"
                            >
                              <Navigation className="mr-2 h-4 w-4" />
                              Open Payment Page
                            </Button>
                            <p className={cn("text-xs text-center", themeClasses.textNeutralSecondary)}>
                              Complete your payment in the new window. You will be redirected back after payment.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                        <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="space-y-4">
                        <h3 className={cn("text-xl font-semibold", themeClasses.mainText)}>
                          Payment Redirect Taking Too Long
                        </h3>
                        <p className={cn("text-base", themeClasses.textNeutralSecondary)}>
                          The payment redirect is taking longer than expected. You can try again or check if the payment page opened in a new tab.
                        </p>
                        {checkoutLinkUrl && (
                          <Button
                            onClick={() => window.open(checkoutLinkUrl, '_blank', 'noopener,noreferrer')}
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                            size="lg"
                          >
                            <Navigation className="mr-2 h-4 w-4" />
                            Open Payment Page
                          </Button>
                        )}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                          <Button
                            onClick={handleRetryPayment}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white"
                          >
                            Try Again
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => window.location.reload()}
                            className={cn(themeClasses.borderNeutralSecondary)}
                          >
                            Refresh Page
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          }
          
        return (
          <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardHeader>
              <CardTitle className={themeClasses.mainText}>Order Review</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:gap-4 md:gap-6 p-3 sm:p-4 md:p-6" style={{ contentVisibility: 'auto' }}>
              {/* Order Summary */}
                <div className="space-y-3 sm:space-y-4">
                <h3 className={cn("text-base sm:text-lg font-semibold", themeClasses.mainText)}>Order Summary</h3>
                <div className="space-y-3 sm:space-y-4">
                  {selectedItems.length === 0 ? (
                    <div className="text-center py-8">
                      <p className={cn("text-gray-500", themeClasses.textNeutralSecondary)}>
                        No items in cart. Please add items to your cart first.
                      </p>
                    </div>
                  ) : (
                    selectedItems.flatMap((item, itemIndex) => 
                      (item.variants || []).map((variant: any, variantIndex: number) => (
                    <div key={`${item.productId}-${variant.variantId || variantIndex}-${itemIndex}`} className="flex flex-row items-start gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 md:p-4 rounded-lg border border-gray-200 dark:border-gray-700 w-full">
                      <div className="flex-shrink-0 self-start">
                          {item.product?.image ? (
                            <Link 
                              href={`/products/${item.productId}-${encodeURIComponent(item.product?.name || 'product')}?returnTo=${encodeURIComponent('/checkout')}`}
                              className="block"
                            >
                              <LazyImage
                                src={item.product.image}
                                alt={item.product.name || "Product image"}
                                width={64}
                                height={64}
                                className="rounded-md object-contain w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-gray-50 hover:opacity-80 transition-opacity"
                                priority={false} // Not priority since it's in a list
                                quality={80}
                              />
                            </Link>
                          ) : (
                            <Link 
                              href={`/products/${item.productId}-${encodeURIComponent(item.product?.name || 'product')}?returnTo=${encodeURIComponent('/checkout')}`}
                              className="block"
                            >
                              <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center hover:opacity-80 transition-opacity">
                                <span className="text-gray-400 text-xs">No Image</span>
                              </div>
                            </Link>
                          )}
                      </div>
                      <div className="flex-1 min-w-0">
                          <Link 
                            href={`/products/${item.productId}-${encodeURIComponent(item.product?.name || 'product')}?returnTo=${encodeURIComponent('/checkout')}`}
                            className="hover:underline"
                          >
                            <h4 className={cn("font-medium text-xs sm:text-sm md:text-base break-words", themeClasses.mainText)}>
                              {item.product?.name || `Product ${item.productId}`}
                              {variant.variant_name && (
                                <span className={cn("font-normal text-blue-600 dark:text-blue-400 block sm:inline")}>
                                  <span className="hidden sm:inline">{" | "}</span>
                                  <span className="sm:hidden"> - </span>
                                  {variant.variant_name}
                                </span>
                              )}
                            </h4>
                          </Link>
                          <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between mt-1 sm:mt-0 gap-1 sm:gap-2")}>
                            <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                              Unit Price: {formatPrice(variant.price || 0)}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                                Qty: {variant.quantity || 1}
                              </span>
                              <span className={cn("text-xs sm:text-sm md:text-base font-medium", themeClasses.mainText)}>
                                {formatPrice((variant.price || 0) * (variant.quantity || 1))}
                              </span>
                            </div>
                          </div>
              </div>
                    </div>
                      ))
                    )
                  )}
                          </div>
                    </div>

                {/* Order Total */}
                  <div className="border-t pt-3 sm:pt-4 space-y-2">
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className={themeClasses.textNeutralSecondary}>Subtotal</span>
                      <span className={themeClasses.mainText}>{formatPrice(selectedSubtotal)}</span>
                    </div>
                    {promotionDiscount > 0 && (
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="text-green-600 dark:text-green-400">Discount ({appliedPromotion?.code})</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          -{formatPrice(promotionDiscount)}
                        </span>
                      </div>
                    )}
                    {(deliveryOption as string) === 'shipping' && (
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className={themeClasses.textNeutralSecondary}>Shipping Fee</span>
                        <span className={cn(themeClasses.mainText, shippingFee === 0 && "text-green-600")}>
                          {shippingFee === 0 ? 'Free' : formatPrice(shippingFee)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t">
                    <span className={cn("text-base sm:text-lg font-semibold", themeClasses.mainText)}>Total</span>
                    <span className={cn("text-base sm:text-lg font-semibold", themeClasses.mainText)}>
                        {formatPrice(orderTotal)}
                    </span>
                      </div>
                      </div>
            </CardContent>
          </Card>
        )
        }

      case 3:
        if ((deliveryOption as string) === 'shipping') {
          // For shipping, case 3 is order review
          if (isProcessingPayment || paymentLinkGenerated) {
            // Show loading message when order is placed or processing payment
            return (
              <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                <CardContent className="text-center py-12">
                  {!hasTimedOut ? (
                    <>
                      {paymentLinkGenerated ? (
                        <div className="mb-6">
                          <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mx-auto mb-6"></div>
                      )}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h3 className={cn("text-xl font-semibold", themeClasses.mainText)}>
                            {paymentLinkGenerated ? 'Payment link generated' : 'Generating payment link...'}
                          </h3>
                          <p className={cn("text-base", themeClasses.textNeutralSecondary)}>
                            {paymentLinkGenerated ? 'Waiting for payment completion...' : 'Please wait while we generate your payment link...'}
                          </p>
                        </div>
                        {paymentLinkGenerated && checkoutLinkUrl && (
                          <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <Button
                              onClick={() => {
                                if (checkoutLinkUrl) {
                                  window.open(checkoutLinkUrl, '_blank', 'noopener,noreferrer')
                                }
                              }}
                              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                              size="lg"
                            >
                              <Navigation className="mr-2 h-4 w-4" />
                              Open Payment Page
                            </Button>
                            <p className={cn("text-xs text-center", themeClasses.textNeutralSecondary)}>
                              Complete your payment in the new window. You will be redirected back after payment.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                        <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="space-y-4">
                        <h3 className={cn("text-xl font-semibold", themeClasses.mainText)}>
                          Payment Redirect Taking Too Long
                        </h3>
                        <p className={cn("text-base", themeClasses.textNeutralSecondary)}>
                          The payment redirect is taking longer than expected. You can try again or check if the payment page opened in a new tab.
                        </p>
                        {checkoutLinkUrl && (
                          <Button
                            onClick={() => window.open(checkoutLinkUrl, '_blank', 'noopener,noreferrer')}
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                            size="lg"
                          >
                            <Navigation className="mr-2 h-4 w-4" />
                            Open Payment Page
                          </Button>
                        )}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                          <Button
                            onClick={handleRetryPayment}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white"
                          >
                            Try Again
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => window.location.reload()}
                            className={cn(themeClasses.borderNeutralSecondary)}
                          >
                            Refresh Page
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          }
          
        return (
          <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardHeader>
              <CardTitle className={themeClasses.mainText}>Order Review</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:gap-4 md:gap-6 p-3 sm:p-4 md:p-6">
              {/* Order Summary */}
                <div className="space-y-3 sm:space-y-4">
                <h3 className={cn("text-base sm:text-lg font-semibold", themeClasses.mainText)}>Order Summary</h3>
                <div className="space-y-3 sm:space-y-4">
                  {selectedItems.map((item, index) => (
                    <div key={index} className="flex flex-row items-start gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 md:p-4 rounded-lg border border-gray-200 dark:border-gray-700 w-full">
                      <div className="flex-shrink-0 self-start">
                          {item.product?.image ? (
                            <Link 
                              href={`/products/${item.productId}-${encodeURIComponent(item.product?.name || 'product')}?returnTo=${encodeURIComponent('/checkout')}`}
                              className="block"
                            >
                              <LazyImage
                                src={item.product.image}
                                alt={item.product.name || "Product image"}
                                width={80}
                                height={80}
                                className="rounded-md object-cover w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 hover:opacity-80 transition-opacity"
                                priority={false} // Not priority since it's in a list
                                quality={80}
                              />
                            </Link>
                          ) : (
                            <Link 
                              href={`/products/${item.productId}-${encodeURIComponent(item.product?.name || 'product')}?returnTo=${encodeURIComponent('/checkout')}`}
                              className="block"
                            >
                              <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center hover:opacity-80 transition-opacity">
                                <span className="text-gray-400 text-xs">No Image</span>
                              </div>
                            </Link>
                          )}
                      </div>
                        <div className="flex-1 min-w-0">
                          <Link 
                            href={`/products/${item.productId}-${encodeURIComponent(item.product?.name || 'product')}?returnTo=${encodeURIComponent('/checkout')}`}
                            className="hover:underline"
                          >
                            <h4 className={cn("font-medium text-xs sm:text-sm md:text-base break-words", themeClasses.mainText)}>
                              {item.product?.name || "Product"}
                            </h4>
                          </Link>
                          <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between mt-1 sm:mt-0 gap-1 sm:gap-2")}>
                            <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                              Unit Price: {formatPrice(item.totalPrice / (item.totalQuantity || 1))}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                                Qty: {item.totalQuantity}
                              </span>
                              <span className={cn("text-xs sm:text-sm md:text-base font-medium", themeClasses.mainText)}>
                                {formatPrice(item.totalPrice)}
                              </span>
                            </div>
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

                {/* Shipping Address */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className={cn("text-base sm:text-lg font-semibold", themeClasses.mainText)}>Shipping Address</h3>
                <div className={cn("p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700", themeClasses.cardBg)}>
                    <p className={themeClasses.mainText}>{formData.shippingAddress.fullName}</p>
                    <p className={themeClasses.textNeutralSecondary}>{formData.shippingAddress.address1}</p>
                    <p className={themeClasses.textNeutralSecondary}>
                      {formData.shippingAddress.city}, {formData.shippingAddress.country}
                    </p>
                    <p className={themeClasses.textNeutralSecondary}>{formData.shippingAddress.phone}</p>
                </div>
              </div>

              {/* Order Total */}
                  <div className="border-t pt-3 sm:pt-4 space-y-2">
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className={themeClasses.textNeutralSecondary}>Subtotal</span>
                      <span className={themeClasses.mainText}>{formatPrice(selectedSubtotal)}</span>
                    </div>
                    {promotionDiscount > 0 && (
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="text-green-600 dark:text-green-400">Discount ({appliedPromotion?.code})</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          -{formatPrice(promotionDiscount)}
                        </span>
                      </div>
                    )}
                    {(deliveryOption as string) === 'shipping' && (
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className={themeClasses.textNeutralSecondary}>Shipping Fee</span>
                        <span className={cn(themeClasses.mainText, shippingFee === 0 && "text-green-600")}>
                          {shippingFee === 0 ? 'Free' : formatPrice(shippingFee)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t">
                  <span className={cn("text-base sm:text-lg font-semibold", themeClasses.mainText)}>Total</span>
                    <span className={cn("text-base sm:text-lg font-semibold", themeClasses.mainText)}>
                          {formatPrice(orderTotal)}
                    </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
        } else {
          // For pickup, case 3 is order confirmation
          return (
            <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
              <CardHeader className="text-center">
                <CardTitle className={cn("text-2xl text-green-600", themeClasses.mainText)}>Order Confirmed!</CardTitle>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  Thank you for your order. We'll notify you when it's ready for pickup.
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
          <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardHeader className="text-center">
              <CardTitle className={cn("text-2xl text-green-600", themeClasses.mainText)}>Order Confirmed!</CardTitle>
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                Thank you for your order. We'll process it and send you tracking information.
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

  const stepTitles = deliveryOption === 'pickup' 
    ? ["Delivery Option", "Billing Information", "Order Review", "Order Confirmed"]
    : ["Delivery Option", "Shipping Address", "Billing Information", "Order Review", "Order Confirmed"]

  const maxSteps = deliveryOption === 'pickup' ? 4 : 5

  if (!isClient) {
    return (
      <div className={cn("min-h-screen", themeClasses.mainBg)}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <CheckoutPageSkeleton />
        </div>
      </div>
    )
  }

    return (
    <div className={cn("min-h-screen", themeClasses.mainBg)}>
      {/* Welcome Message Bar - Mobile Only */}
      <div className="fixed top-0 z-50 w-full bg-stone-100/90 dark:bg-gray-900/95 backdrop-blur-sm border-b border-stone-200 dark:border-gray-700 sm:hidden">
        <div className="flex items-center justify-center h-8 px-4">
          {user ? (
            <div className="text-xs text-green-600 dark:text-green-400 font-medium">
              Hi! {(user as any)?.user_metadata?.full_name || user.email?.split('@')[0] || 'User'} - Welcome again <span className="text-blue-600 dark:text-blue-400">{companyName || 'Honic Co.'}</span>
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

          {/* Header */}
      <header className={cn("border-b pt-8 sm:pt-0", darkHeaderFooterClasses.headerBorder, darkHeaderFooterClasses.headerBg)}>
        <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
            <Link href="/cart" className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100">
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back to Cart</span>
            <span className="sm:hidden">Back</span>
          </Link>
            <h1 className={cn("text-lg sm:text-xl font-semibold", darkHeaderFooterClasses.textNeutralPrimary)}>
              Checkout
            </h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 sm:py-8 pt-8 sm:pt-8">
        <div className="max-w-4xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-6 sm:mb-8">
            {/* Mobile: Stacked layout */}
            <div className="block sm:hidden">
            <div className="flex items-center justify-between">
              {stepTitles.map((title, index) => (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1",
                  index <= currentStep
                    ? "bg-yellow-500 text-neutral-950"
                        : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                    )}>
                {index + 1}
              </div>
                    <span className={cn(
                      "text-xs text-center leading-tight px-1",
                      index <= currentStep
                        ? themeClasses.mainText
                        : themeClasses.textNeutralSecondary
                    )}>
                      {title}
                    </span>
                </div>
              ))}
            </div>
              {/* Mobile progress line */}
              <div className="relative mt-2">
                <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div 
                  className="absolute top-0 left-0 h-1 bg-yellow-500 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(currentStep / (maxSteps - 1)) * 100}%` 
                  }}
                ></div>
              </div>
            </div>

            {/* Desktop: Horizontal layout */}
            <div className="hidden sm:block">
              <div className="flex items-start justify-center gap-4">
              {stepTitles.map((title, index) => (
                  <div key={index} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mb-2",
                        index <= currentStep
                          ? "bg-yellow-500 text-neutral-950"
                          : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                      )}>
                        {index + 1}
                      </div>
                      <span className={cn(
                        "text-sm text-center max-w-24",
                        index <= currentStep
                          ? themeClasses.mainText
                          : themeClasses.textNeutralSecondary
                      )}>
                {title}
              </span>
                    </div>
                    {index < stepTitles.length - 1 && (
                      <div className={cn(
                        "w-16 h-px mx-2 mt-4",
                        index < currentStep
                          ? "bg-yellow-500"
                          : "bg-gray-200 dark:bg-gray-700"
                      )} />
                    )}
                  </div>
                ))}
              </div>
            </div>
        </div>

        {/* Step Content */}
          <div className="mb-6">
            {renderStepContent()}
          </div>

          {/* Navigation Buttons */}
          {currentStep < maxSteps - 1 && (
            <div className="flex justify-between">
              <Button
                onClick={handleBack}
                variant="outline"
                className={cn(
                  "px-6 border border-neutral-300 text-neutral-700 hover:bg-neutral-100",
                  darkHeaderFooterClasses.inputBorder,
                  darkHeaderFooterClasses.textNeutralPrimary,
                  darkHeaderFooterClasses.buttonGhostHoverBg
                )}
              >
                {currentStep === 0 ? 'Back to Cart' : 'Back'}
              </Button>
              
              {/* Show Place Order button on order review step, Continue button on other steps */}
              {((deliveryOption === 'pickup' && currentStep === 2) || ((deliveryOption as string) === 'shipping' && currentStep === 3)) ? (
                <div className="flex flex-col items-end">
                  <Button
                    onClick={handlePlaceOrder}
                    disabled={isProcessingPayment}
                    className="px-6 bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
                  >
                    {isProcessingPayment ? "Processing..." : paymentError ? "Try Again" : "Place Order"}
                  </Button>
                  {paymentError && !isProcessingPayment && (
                    <p className="mt-3 text-sm text-red-600 dark:text-red-400 text-right max-w-md">
                      {paymentError}
                    </p>
                  )}
                </div>
              ) : (
              <Button
                onClick={handleNext}
                  className="px-6 bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
              >
                  Continue
              </Button>
              )}
          </div>
        )}
        </div>
      </div>

      <ComingSoonModal />
    </div>
  )
}
 