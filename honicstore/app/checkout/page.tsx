"use client"

import { BuyerRouteGuard } from '@/components/buyer-route-guard'
import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { flushSync } from "react-dom"
import { Loader } from "@googlemaps/js-api-loader"
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
  RefreshCcw,
  Shield,
  CreditCard,
  Ticket,
  Plus,
  Minus,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { TANZANIA_REGIONS, DISTRICTS_BY_REGION, getWardOptions } from "@/lib/tanzania-address"
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
  region?: string
  district?: string
  ward?: string
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

function normalizeLocationName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(ward|kata|district|manispaa|municipal|city|suburb|area)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim()
}

function matchLocationName(options: readonly string[], candidates: string[]): string {
  const normalizedOptions = options
    .map((raw) => ({ raw, normalized: normalizeLocationName(raw) }))
    .filter((item) => item.normalized)

  const normalizedCandidates = candidates
    .map((candidate) => normalizeLocationName(candidate))
    .filter(Boolean)

  for (const candidate of normalizedCandidates) {
    const exact = normalizedOptions.find((option) => option.normalized === candidate)
    if (exact) return exact.raw
  }

  for (const candidate of normalizedCandidates) {
    const partial = normalizedOptions.find(
      (option) => option.normalized.includes(candidate) || candidate.includes(option.normalized)
    )
    if (partial) return partial.raw
  }

  return ""
}

function resolveTanzaniaAddressFromCandidates(candidates: string[]) {
  const cleanCandidates = Array.from(
    new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))
  )

  const districtToRegion = new Map<string, string>()
  for (const [region, districts] of Object.entries(DISTRICTS_BY_REGION)) {
    for (const district of districts) districtToRegion.set(district, region)
  }

  let region = matchLocationName(TANZANIA_REGIONS, cleanCandidates)

  let district = ""
  if (region) {
    district = matchLocationName(DISTRICTS_BY_REGION[region] || [], cleanCandidates)
  } else {
    const allDistricts = Object.values(DISTRICTS_BY_REGION).flat()
    district = matchLocationName(allDistricts, cleanCandidates)
    if (district) region = districtToRegion.get(district) || ""
  }

  let ward = ""
  if (district) {
    ward = matchLocationName(getWardOptions(district), cleanCandidates)
  }

  // If district is still unknown, infer it from a uniquely matched ward within the resolved region.
  if (!district && region) {
    const matchedDistricts = (DISTRICTS_BY_REGION[region] || [])
      .map((candidateDistrict) => {
        const matchedWard = matchLocationName(getWardOptions(candidateDistrict), cleanCandidates)
        return matchedWard ? { district: candidateDistrict, ward: matchedWard } : null
      })
      .filter((item): item is { district: string; ward: string } => Boolean(item))

    if (matchedDistricts.length === 1) {
      district = matchedDistricts[0].district
      ward = matchedDistricts[0].ward
    }
  }

  return { region, district, ward }
}

function looksLikeRouteCode(value: string): boolean {
  const trimmed = value.trim()
  return /^[A-Z]\d+[A-Z0-9-]*$/i.test(trimmed)
}

async function waitForNextPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function waitAtLeastMs(startedAt: number, minMs: number): Promise<void> {
  const elapsed = Date.now() - startedAt
  if (elapsed >= minMs) return
  await new Promise<void>((resolve) => setTimeout(resolve, minMs - elapsed))
}

async function waitUntil(predicate: () => boolean, timeoutMs: number, pollMs = 25): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise<void>((resolve) => setTimeout(resolve, pollMs))
  }
}

type ReverseGeocodeAddress = {
  house_number?: string
  road?: string
  suburb?: string
  neighbourhood?: string
  city?: string
  town?: string
  village?: string
  county?: string
  state_district?: string
  state?: string
  postcode?: string
  country?: string
}

type ReverseGeocodePayload = {
  display_name?: string
  address?: ReverseGeocodeAddress
  nearby_place?: {
    name?: string
    vicinity?: string
  } | null
}

function textMatchesCandidate(haystack: string, needle: string): boolean {
  const h = normalizeLocationName(haystack || '')
  const n = normalizeLocationName(needle || '')
  if (!h || !n) return false
  return h === n || h.includes(n) || n.includes(h)
}

function textMatchesAny(haystack: string, needles: string[]): boolean {
  const cleaned = needles.map((n) => n.trim()).filter(Boolean)
  if (!haystack.trim() || cleaned.length === 0) return false
  return cleaned.some((n) => textMatchesCandidate(haystack, n))
}

function validateTzHierarchySelections(region: string, district: string, ward: string): string | null {
  const r = region.trim()
  const d = district.trim()
  const w = ward.trim()
  if (!r) return 'Select a region.'
  if (!matchLocationName(TANZANIA_REGIONS, [r])) return 'Region is not recognized. Please pick a valid region.'
  if (!d) return 'Select a district.'
  if (!matchLocationName(DISTRICTS_BY_REGION[r] || [], [d])) return 'District does not match the selected region.'
  if (w) {
    const wardOk = matchLocationName(getWardOptions(d), [w])
    if (!wardOk) return 'Ward does not match the selected district.'
  }
  return null
}

function verifyTzShippingSelectionsAgainstReverseAddress(
  region: string,
  district: string,
  ward: string,
  address: ReverseGeocodeAddress
): string | null {
  const hierarchyErr = validateTzHierarchySelections(region, district, ward)
  if (hierarchyErr) return hierarchyErr

  const r = region.trim()
  const d = district.trim()
  const w = ward.trim()

  const regionCandidates = [address.state, address.country].filter(Boolean) as string[]
  if (regionCandidates.length > 0 && !textMatchesAny(r, regionCandidates)) {
    return 'Region does not match the mapped location for this address.'
  }

  const districtCandidates = [
    address.county,
    address.state_district,
    address.city,
    address.town,
    address.village,
    address.suburb,
  ].filter(Boolean) as string[]

  if (districtCandidates.length > 0 && !textMatchesAny(d, districtCandidates)) {
    return 'District does not match the mapped location for this address.'
  }

  if (w) {
    const wardCandidates = [
      address.suburb,
      address.neighbourhood,
      address.village,
      address.city,
      address.town,
      address.road,
    ].filter(Boolean) as string[]

    if (wardCandidates.length > 0 && !textMatchesAny(w, wardCandidates)) {
      return 'Ward does not match the mapped location for this address.'
    }
  }

  return null
}

const LOCATION_OVERLAY_MIN_MS = 1200
const LOCATION_OVERLAY_ERROR_MIN_MS = 2200
const SHIPPING_ADDRESS_MISMATCH_MAX_TRIES = 3
const DEFAULT_MAP_CENTER = { lat: -6.7924, lon: 39.2083 }

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
  const { cart, cartTotalItems, cartSubtotal, clearCart, removeItem, updateItemQuantity } = useCart()
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
  const orderReviewItemCount = selectedItems.flatMap(i => i.variants || []).length || selectedItems.length

  // Same as cart page - for qty input width
  const getDesktopQuantityInputWidth = (qty: number) => {
    const n = String(qty).length
    return Math.min(6, Math.max(2.5, 2.5 + n * 0.8))
  }
  
  
  // Calculate shipping cost: 5,000 TZS if order is less than 100,000 TZS, otherwise free
  const FREE_SHIPPING_THRESHOLD = 100000
  const SHIPPING_COST = 5000
  const SHIPPING_CALCULATION_ENABLED = true
  const LOCATION_PICKER_ENABLED = false
  
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
  const [isFillingLocation, setIsFillingLocation] = useState(false)
  const [showLocationLoadingOverlay, setShowLocationLoadingOverlay] = useState(false)
  const [locationOverlayRoot, setLocationOverlayRoot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof document === "undefined") return
    setLocationOverlayRoot(document.body)
  }, [])

  useLayoutEffect(() => {
    setShowLocationLoadingOverlay(isFillingLocation)
  }, [isFillingLocation])

  // Location coords when user uses "Use my location" or structured address (for server-side shipping estimate)
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [shippingAddressMismatchCount, setShippingAddressMismatchCount] = useState(0)
  const [shippingPricingLocked, setShippingPricingLocked] = useState(false)
  // Server-side shipping estimate (from shipping address / location); used in Order Summary
  const [shippingEstimate, setShippingEstimate] = useState<{ subtotal: number; shipping: number; total: number } | null>(null)
  const [shippingEstimateLoading, setShippingEstimateLoading] = useState(false)
  const shippingEstimateLoadingRef = useRef(false)
  const skipNextShippingEstimateEffectRef = useRef(false)
  const [shippingCoordsSource, setShippingCoordsSource] = useState<'gps' | 'map' | 'address_geocode' | null>(null)
  const lastShippingMismatchKeyRef = useRef<string>("")

  useEffect(() => {
    if (deliveryOption === 'pickup') {
      setShippingAddressMismatchCount(0)
      setShippingPricingLocked(false)
      lastShippingMismatchKeyRef.current = ''
      setShippingCoordsSource(null)
      setLocationCoords(null)
    }
  }, [deliveryOption])

  useEffect(() => {
    shippingEstimateLoadingRef.current = shippingEstimateLoading
  }, [shippingEstimateLoading])

  // Fallback client-side shipping (when server estimate not yet available)
  const calculateShippingFee = () => {
    if (deliveryOption === 'pickup') return 0
    if (selectedSubtotal >= FREE_SHIPPING_THRESHOLD) return 0
    const allProductsHaveFreeDelivery = selectedItems.every(item => {
      return (item as any)?.free_delivery === true || (item as any)?.freeDelivery === true
    })
    return allProductsHaveFreeDelivery ? 0 : SHIPPING_COST
  }

  const fallbackShippingFee = calculateShippingFee()
  
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
  const [mapPickerCoords, setMapPickerCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [mapPickerDisplayName, setMapPickerDisplayName] = useState("")
  const [mapPickerLoading, setMapPickerLoading] = useState(false)
  const [mapPickerResolving, setMapPickerResolving] = useState(false)
  const mapPickerContainerRef = useRef<HTMLDivElement | null>(null)
  const mapPickerInstanceRef = useRef<google.maps.Map | null>(null)
  const mapPickerIdleListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const mapPickerMarkerRef = useRef<google.maps.Marker | null>(null)
  const mapPickerRequestSeqRef = useRef(0)
  const suppressStructuredResetRef = useRef(false)
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

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

  const hideShippingPrice =
    deliveryOption === 'shipping' &&
    shippingPricingLocked

  const displaySubtotal = shippingEstimate?.subtotal ?? selectedSubtotal

  const shippingFee =
    deliveryOption === 'pickup'
      ? 0
      : hideShippingPrice
        ? null
        : shippingEstimate?.shipping ?? fallbackShippingFee

  const orderTotal =
    deliveryOption === 'pickup'
      ? Math.max(0, displaySubtotal - promotionDiscount)
      : hideShippingPrice || shippingFee === null
        ? null
        : Math.max(0, displaySubtotal + shippingFee - promotionDiscount)

  // Track if form has been prefilled to prevent overwriting user edits
  const hasPrefilledRef = useRef(false)
  // Delay "permission denied" toast so we don't show it if the user is still answering the prompt and success runs next
  const locationDeniedToastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deliveryAutoCalcRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-calculate delivery from structured address (region/district/ward/street) when enough is filled
  useEffect(() => {
    if (!LOCATION_PICKER_ENABLED) return
    if (!SHIPPING_CALCULATION_ENABLED) return
    if (deliveryOption !== 'shipping') return
    if (locationCoords && (shippingCoordsSource === 'gps' || shippingCoordsSource === 'map')) return
    const a = formData.shippingAddress
    const isTz = (a.country || 'Tanzania').toLowerCase().includes('tanzania')
    // IMPORTANT: Do not include Famous place (address2) in pricing geocode.
    // Users often type landmarks for couriers; it should not move lat/lon used for shipping distance.
    const parts = isTz
      ? [a.ward?.trim(), a.district?.trim(), a.region?.trim(), a.streetName?.trim(), a.address1?.trim(), a.country?.trim() || 'Tanzania'].filter(Boolean) as string[]
      : [a.streetName?.trim(), a.address1?.trim(), a.city?.trim(), a.state?.trim(), a.country?.trim() || 'Tanzania'].filter(Boolean) as string[]
    const hasEnough = isTz ? (a.region && (a.district || a.ward || (a.streetName?.trim()) || (a.address1?.trim()))) : parts.length >= 2
    if (!hasEnough || parts.length < 2) return
    if (deliveryAutoCalcRef.current) clearTimeout(deliveryAutoCalcRef.current)
    deliveryAutoCalcRef.current = setTimeout(async () => {
      deliveryAutoCalcRef.current = null
      const query = parts.reverse().join(', ')
      try {
        if (isTz) {
          const hierarchyErr = validateTzHierarchySelections(
            formData.shippingAddress.region || '',
            formData.shippingAddress.district || '',
            formData.shippingAddress.ward || ''
          )
          if (hierarchyErr) {
            const key = `hierarchy|${hierarchyErr}|${formData.shippingAddress.region}|${formData.shippingAddress.district}|${formData.shippingAddress.ward}`
            if (lastShippingMismatchKeyRef.current !== key) {
              lastShippingMismatchKeyRef.current = key
              setShippingAddressMismatchCount((c) => {
                const next = Math.min(SHIPPING_ADDRESS_MISMATCH_MAX_TRIES, c + 1)
                if (next >= SHIPPING_ADDRESS_MISMATCH_MAX_TRIES) {
                  setShippingPricingLocked(true)
                  toast({
                    title: 'Shipping address not found',
                    description:
                      'Please continue with a known address. We will call you to verify the address before delivery.',
                  })
                } else {
                  toast({
                    title: 'Shipping address not found',
                    description: hierarchyErr,
                    variant: 'destructive',
                  })
                }
                return next
              })
            }

            skipNextShippingEstimateEffectRef.current = true
            setShippingEstimate(null)
            setLocationCoords(null)
            setShippingCoordsSource(null)
            return
          }
        }

        const res = await fetch(`/api/forward-geocode?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0 && data[0].lat != null && data[0].lon != null) {
          const lat = parseFloat(data[0].lat)
          const lon = parseFloat(data[0].lon)
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            if (isTz) {
              const rev = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`)
              const revData = await rev.json()
              if (!rev.ok || !revData?.address) {
                const key = `reverse_failed|${lat.toFixed(5)}|${lon.toFixed(5)}|${formData.shippingAddress.region}|${formData.shippingAddress.district}|${formData.shippingAddress.ward}`
                if (lastShippingMismatchKeyRef.current !== key) {
                  lastShippingMismatchKeyRef.current = key
                  setShippingAddressMismatchCount((c) => {
                    const next = Math.min(SHIPPING_ADDRESS_MISMATCH_MAX_TRIES, c + 1)
                    if (next >= SHIPPING_ADDRESS_MISMATCH_MAX_TRIES) {
                      setShippingPricingLocked(true)
                      toast({
                        title: 'Shipping address not found',
                        description:
                          'Please continue with a known address. We will call you to verify the address before delivery.',
                      })
                    } else {
                      toast({
                        title: 'Shipping address not found',
                        description: 'Please correct Region, District, or Ward so we can calculate delivery accurately.',
                        variant: 'destructive',
                      })
                    }
                    return next
                  })
                }

                skipNextShippingEstimateEffectRef.current = true
                setShippingEstimate(null)
                setLocationCoords(null)
                setShippingCoordsSource(null)
                return
              }

              const mismatchReason = verifyTzShippingSelectionsAgainstReverseAddress(
                formData.shippingAddress.region || '',
                formData.shippingAddress.district || '',
                formData.shippingAddress.ward || '',
                revData.address as ReverseGeocodeAddress
              )

              if (mismatchReason) {
                const key = `mismatch|${mismatchReason}|${lat.toFixed(5)}|${lon.toFixed(5)}|${formData.shippingAddress.region}|${formData.shippingAddress.district}|${formData.shippingAddress.ward}`
                if (lastShippingMismatchKeyRef.current !== key) {
                  lastShippingMismatchKeyRef.current = key
                  setShippingAddressMismatchCount((c) => {
                    const next = Math.min(SHIPPING_ADDRESS_MISMATCH_MAX_TRIES, c + 1)
                    if (next >= SHIPPING_ADDRESS_MISMATCH_MAX_TRIES) {
                      setShippingPricingLocked(true)
                      toast({
                        title: 'Shipping address not found',
                        description:
                          'Please continue with a known address. We will call you to verify the address before delivery.',
                      })
                    } else {
                      toast({
                        title: 'Shipping address not found',
                        description: mismatchReason,
                        variant: 'destructive',
                      })
                    }
                    return next
                  })
                }

                skipNextShippingEstimateEffectRef.current = true
                setShippingEstimate(null)
                setLocationCoords(null)
                setShippingCoordsSource(null)
                return
              }

              setShippingAddressMismatchCount(0)
              setShippingPricingLocked(false)
              lastShippingMismatchKeyRef.current = ''
            }

            setShippingCoordsSource('address_geocode')
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
  }, [LOCATION_PICKER_ENABLED, SHIPPING_CALCULATION_ENABLED, deliveryOption, locationCoords, shippingCoordsSource, formData.shippingAddress.region, formData.shippingAddress.district, formData.shippingAddress.ward, formData.shippingAddress.streetName, formData.shippingAddress.address1, formData.shippingAddress.city, formData.shippingAddress.state, formData.shippingAddress.country])

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

  const fetchShippingEstimateNow = useCallback(
    async (coords?: { lat: number; lon: number } | null) => {
      const items = getSelectedItems().flatMap((item) =>
        (item.variants || []).map((v: any) => ({
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

      setShippingEstimateLoading(true)
      try {
        const res = await fetch('/api/cart/shipping-estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            deliveryOption,
            lat: deliveryOption === 'shipping' && coords ? coords.lat : undefined,
            lon: deliveryOption === 'shipping' && coords ? coords.lon : undefined,
            region: formData.shippingAddress.region || formData.shippingAddress.state || undefined,
            ward: formData.shippingAddress.ward || undefined,
            district: formData.shippingAddress.district || undefined,
            streetName: formData.shippingAddress.streetName || undefined,
            address1: formData.shippingAddress.address1 || undefined,
            city: formData.shippingAddress.city || undefined,
            state: formData.shippingAddress.state || undefined,
            country: formData.shippingAddress.country || 'Tanzania',
          }),
        })
        const data = await res.json()
        if (data.error) {
          setShippingEstimate(null)
          return
        }
        setShippingEstimate({
          subtotal: Number(data.subtotal) || 0,
          shipping: Number(data.shipping) ?? 0,
          total: Number(data.total) ?? 0,
        })
      } catch {
        setShippingEstimate(null)
      } finally {
        setShippingEstimateLoading(false)
      }
    },
    [cart, deliveryOption, formData.shippingAddress.region, formData.shippingAddress.state, formData.shippingAddress.ward, formData.shippingAddress.district, formData.shippingAddress.streetName, formData.shippingAddress.address1, formData.shippingAddress.city, formData.shippingAddress.country]
  )

  // When Tanzania hierarchy changes, allow a fresh verification attempt.
  useEffect(() => {
    if (suppressStructuredResetRef.current) {
      suppressStructuredResetRef.current = false
      return
    }
    setShippingAddressMismatchCount(0)
    setShippingPricingLocked(false)
    lastShippingMismatchKeyRef.current = ''
    setShippingCoordsSource(null)
    setLocationCoords(null)
    setShippingEstimate(null)
  }, [formData.shippingAddress.region, formData.shippingAddress.district, formData.shippingAddress.ward])

  const selectedItemsSignature = getSelectedItems()
    .map((item) => {
      const variantPart = (item.variants || [])
        .map((v: any) => `${String(v.variantId ?? 'default')}:${Number(v.quantity ?? 1)}`)
        .join('|')
      return `${item.productId}:${variantPart}`
    })
    .join(';')

  // Fetch server-side shipping estimate when items, delivery option, or verified location change
  useEffect(() => {
    if (!SHIPPING_CALCULATION_ENABLED) return
    if (skipNextShippingEstimateEffectRef.current) {
      skipNextShippingEstimateEffectRef.current = false
      return
    }

    if (deliveryOption !== 'shipping') {
      void fetchShippingEstimateNow(null)
      return
    }

    const shouldUseCoords =
      LOCATION_PICKER_ENABLED &&
      Boolean(locationCoords) &&
      !shippingPricingLocked &&
      shippingCoordsSource !== null

    void fetchShippingEstimateNow(shouldUseCoords ? locationCoords : null)
  }, [
    LOCATION_PICKER_ENABLED,
    SHIPPING_CALCULATION_ENABLED,
    deliveryOption,
    selectedItemsSignature,
    locationCoords?.lat,
    locationCoords?.lon,
    shippingPricingLocked,
    shippingCoordsSource,
    formData.shippingAddress.country,
    formData.shippingAddress.region,
    formData.shippingAddress.district,
    formData.shippingAddress.ward,
    fetchShippingEstimateNow,
  ])

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
        ...(prev[section] as any),
        [field]: value
      }
    }))
  }

  const applyResolvedShippingAddress = useCallback((data: ReverseGeocodePayload) => {
    if (!data.address) return

    const a = data.address
    const city = a.city || a.town || a.village || a.county || a.suburb || ''
    const preferredRoad = looksLikeRouteCode(a.road || '') ? '' : (a.road || '')
    const streetParts = [preferredRoad, a.suburb, a.neighbourhood, a.village].filter(Boolean)
    const buildingPart = [a.house_number].filter(Boolean).join(' ').trim()
    const nearbyPlace = data.nearby_place
    const nearbyPlaceText = [nearbyPlace?.name, nearbyPlace?.vicinity].filter(Boolean).join(' - ').trim()
    const streetName = [...new Set(streetParts)].join(', ').trim()
    const resolvedStreetName =
      streetName ||
      preferredRoad ||
      (a.road || '').trim() ||
      (a.suburb || '').trim() ||
      (a.neighbourhood || '').trim() ||
      (nearbyPlace?.vicinity || '').trim() ||
      (nearbyPlace?.name || '').trim() ||
      city ||
      'Unknown street'

    const famousPlaceFallbackText = (
      nearbyPlaceText ||
      [a.neighbourhood, a.suburb, preferredRoad || a.road, a.city, a.town].filter(Boolean).join(' - ').trim()
    )

    const isTz = (a.country || '').toLowerCase().includes('tanzania')
    let region = ''
    let district = ''
    let ward = ''

    if (isTz) {
      const resolution = resolveTanzaniaAddressFromCandidates([
        a.state || '',
        a.state_district || '',
        a.county || '',
        a.city || '',
        a.town || '',
        a.village || '',
        a.suburb || '',
        a.neighbourhood || '',
        nearbyPlace?.vicinity || '',
        nearbyPlace?.name || '',
        city || '',
      ])
      region = resolution.region
      district = resolution.district
      ward = resolution.ward

      const wardNorm = normalizeLocationName(ward || '')
      const districtNorm = normalizeLocationName(district || '')
      if (districtNorm && wardNorm && wardNorm === districtNorm) {
        const refined = matchLocationName(
          getWardOptions(district),
          [
            a.suburb || '',
            a.neighbourhood || '',
            a.village || '',
            nearbyPlace?.vicinity || '',
            nearbyPlace?.name || '',
          ].filter((c) => Boolean(c) && normalizeLocationName(c) !== districtNorm)
        )
        if (refined) ward = refined
      }
    }

    flushSync(() => {
      setFormData(prev => ({
        ...prev,
        shippingAddress: {
          ...prev.shippingAddress,
          country: a.country || prev.shippingAddress.country,
          city: city || prev.shippingAddress.city,
          postalCode: a.postcode || prev.shippingAddress.postalCode,
          streetName: resolvedStreetName || prev.shippingAddress.streetName || '',
          address1: buildingPart || prev.shippingAddress.address1,
          address2: prev.shippingAddress.address2?.trim()
            ? prev.shippingAddress.address2
            : (famousPlaceFallbackText || prev.shippingAddress.address2),
          ...(isTz ? { region: region || prev.shippingAddress.region, district: district || prev.shippingAddress.district, ward: ward || prev.shippingAddress.ward } : {}),
        },
      }))
    })

    setValidationErrors(prev => {
      const next = { ...prev }
      const keys = ['shippingCity', 'shippingStreet', 'shippingAddress1', 'shippingLandmark', 'shippingRegion', 'shippingDistrict', 'shippingWard'] as const
      keys.forEach(k => { if (k in next) delete next[k] })
      return next
    })
  }, [])

  const reverseGeocodeCoords = useCallback(async (lat: number, lon: number) => {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`)
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.details || data?.error || 'Reverse geocoding failed')
    }
    return data as ReverseGeocodePayload
  }, [])

  // Autofill shipping address from device location (geolocation + reverse geocode)
  const handleFillFromLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Not supported', description: 'Geolocation is not supported in this browser.', variant: 'destructive' })
      return
    }
    if (locationDeniedToastRef.current) {
      clearTimeout(locationDeniedToastRef.current)
      locationDeniedToastRef.current = null
    }
    const locationRequestStartedAt = Date.now()
    setIsFillingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (locationDeniedToastRef.current) {
          clearTimeout(locationDeniedToastRef.current)
          locationDeniedToastRef.current = null
        }
        try {
          const lat = position.coords.latitude
          const lon = position.coords.longitude
          if (deliveryOption !== 'shipping') {
            setLocationCoords({ lat, lon })
          }
          const data = await reverseGeocodeCoords(lat, lon)
          if (data.address) {
            const nearbyPlaceText = [data?.nearby_place?.name, data?.nearby_place?.vicinity].filter(Boolean).join(' - ').trim()
            suppressStructuredResetRef.current = true
            applyResolvedShippingAddress(data)
            toast({
              title: 'Address filled',
              description: nearbyPlaceText
                ? `Shipping address updated using your location. Nearest place: ${nearbyPlaceText}`
                : 'Shipping address updated from your location using Google geocoding.'
            })
          } else {
            toast({ title: 'Address not found', description: 'Could not resolve address for this location.', variant: 'destructive' })
          }

          // Refresh shipping estimate using the freshly resolved coordinates (keeps spinner through fee update).
          if (deliveryOption === 'shipping') {
            flushSync(() => {
              setShippingAddressMismatchCount(0)
              setShippingPricingLocked(false)
              lastShippingMismatchKeyRef.current = ''
              setShippingCoordsSource('gps')
              setLocationCoords({ lat, lon })
            })
          }

          // Keep overlay until the UI has painted the updated form (prevents flicker).
          await waitForNextPaint()
          await waitForNextPaint()
          await waitAtLeastMs(locationRequestStartedAt, LOCATION_OVERLAY_MIN_MS)

          // Also wait until any in-flight shipping estimate refresh settles (prevents "flash then update").
          if (deliveryOption === 'shipping') {
            await waitUntil(() => !shippingEstimateLoadingRef.current, 8000)
            await waitForNextPaint()
          }
        } catch (error) {
          skipNextShippingEstimateEffectRef.current = false
          toast({
            title: 'Address failed',
            description: error instanceof Error ? error.message : 'Could not fetch address. Try again.',
            variant: 'destructive'
          })
          await waitForNextPaint()
          await waitAtLeastMs(locationRequestStartedAt, LOCATION_OVERLAY_ERROR_MIN_MS)
        }

        setIsFillingLocation(false)
      },
      async (err) => {
        let msg = 'Request timed out. Try again.'
        if (err.code === 1) {
          msg = 'Location access was denied. Enable location for this site in your browser or device settings and try again.'
        } else if (err.code === 2) {
          msg = 'Position unavailable. Check that location services are on.'
        }
        toast({ title: 'Location failed', description: msg, variant: 'destructive' })
        await waitForNextPaint()
        await waitAtLeastMs(locationRequestStartedAt, LOCATION_OVERLAY_ERROR_MIN_MS)
        setIsFillingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  useEffect(() => {
    if (!showMapContainer || !isClient) return

    const mapsKey = googleMapsApiKey
    if (!mapsKey) {
      toast({
        title: 'Map unavailable',
        description: 'Missing Google Maps browser key.',
        variant: 'destructive',
      })
      setShowMapContainer(false)
      return
    }

    const initialCenter = locationCoords ?? mapPickerCoords ?? DEFAULT_MAP_CENTER
    setMapPickerLoading(true)

    const loader = new Loader({
      apiKey: mapsKey,
      version: 'weekly',
    })

    loader.load().then(() => {
      if (!mapPickerContainerRef.current) return

      if (!mapPickerInstanceRef.current) {
        mapPickerInstanceRef.current = new google.maps.Map(mapPickerContainerRef.current, {
          center: { lat: initialCenter.lat, lng: initialCenter.lon },
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
        })

        mapPickerMarkerRef.current = new google.maps.Marker({
          map: mapPickerInstanceRef.current,
          clickable: false,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#111827',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
        })

        mapPickerIdleListenerRef.current = mapPickerInstanceRef.current.addListener('idle', () => {
          const center = mapPickerInstanceRef.current?.getCenter()
          if (!center) return
          const lat = center.lat()
          const lon = center.lng()
          setMapPickerCoords({ lat, lon })
          mapPickerMarkerRef.current?.setPosition({ lat, lng: lon })
        })
      } else {
        mapPickerInstanceRef.current.setCenter({ lat: initialCenter.lat, lng: initialCenter.lon })
      }

      setMapPickerCoords(initialCenter)
      mapPickerMarkerRef.current?.setPosition({ lat: initialCenter.lat, lng: initialCenter.lon })
    }).catch(() => {
      toast({
        title: 'Map unavailable',
        description: 'Google map could not be loaded right now.',
        variant: 'destructive',
      })
      setShowMapContainer(false)
    }).finally(() => {
      setMapPickerLoading(false)
    })
  }, [showMapContainer, isClient, locationCoords, mapPickerCoords, toast, googleMapsApiKey])

  useEffect(() => {
    if (!showMapContainer || !mapPickerCoords) return

    const seq = ++mapPickerRequestSeqRef.current
    setMapPickerResolving(true)
    const timeoutId = setTimeout(async () => {
      try {
        const data = await reverseGeocodeCoords(mapPickerCoords.lat, mapPickerCoords.lon)
        if (seq !== mapPickerRequestSeqRef.current) return
        setMapPickerDisplayName(
          data.display_name ||
            [data?.nearby_place?.name, data?.nearby_place?.vicinity].filter(Boolean).join(' - ') ||
            `${mapPickerCoords.lat.toFixed(6)}, ${mapPickerCoords.lon.toFixed(6)}`
        )
      } catch {
        if (seq !== mapPickerRequestSeqRef.current) return
        setMapPickerDisplayName(`${mapPickerCoords.lat.toFixed(6)}, ${mapPickerCoords.lon.toFixed(6)}`)
      } finally {
        if (seq === mapPickerRequestSeqRef.current) setMapPickerResolving(false)
      }
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [showMapContainer, mapPickerCoords, reverseGeocodeCoords])

  const handleConfirmMapLocation = async () => {
    if (!mapPickerCoords) return

    setMapPickerResolving(true)
    try {
      const data = await reverseGeocodeCoords(mapPickerCoords.lat, mapPickerCoords.lon)
      suppressStructuredResetRef.current = true
      applyResolvedShippingAddress(data)
      flushSync(() => {
        setShippingAddressMismatchCount(0)
        setShippingPricingLocked(false)
        lastShippingMismatchKeyRef.current = ''
        setShippingCoordsSource('map')
        setLocationCoords(mapPickerCoords)
      })
      setMapPickerDisplayName(data.display_name || mapPickerDisplayName)
      setShowMapContainer(false)
      toast({
        title: 'Map location selected',
        description: 'Delivery fee is now based on the point you selected on the map.',
      })
    } catch (error) {
      toast({
        title: 'Map selection failed',
        description: error instanceof Error ? error.message : 'Could not resolve the selected point.',
        variant: 'destructive',
      })
    } finally {
      setMapPickerResolving(false)
    }
  }

  const handleOpenGoogleMapPicker = () => {
    if (googleMapsApiKey) {
      setShowMapContainer(true)
      return
    }

    const fallbackCoords = locationCoords ?? DEFAULT_MAP_CENTER
    const query = `${fallbackCoords.lat},${fallbackCoords.lon}`
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer')
    toast({
      title: 'Opened Google Maps',
      description: 'Google Maps opened in a new tab because the embedded map key is not configured.',
    })
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

      // Align final amount with server shipping rules (region base + ward distance from store coordinates).
      let serverShippingFee = deliveryOption === 'pickup' ? 0 : 5000
      let serverSubtotal = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0)
      try {
        const estimateRes = await fetch('/api/cart/shipping-estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: selectedItems.flatMap(item =>
              item.variants.map(variant => ({
                productId: item.productId,
                variantId: variant.variantId ?? null,
                quantity: variant.quantity ?? 1,
              }))
            ),
            deliveryOption,
            region: formData.shippingAddress.region || formData.shippingAddress.state || undefined,
            ward: formData.shippingAddress.ward || undefined,
            district: formData.shippingAddress.district || undefined,
            streetName: formData.shippingAddress.streetName || undefined,
            address1: formData.shippingAddress.address1 || undefined,
            city: formData.shippingAddress.city || undefined,
            state: formData.shippingAddress.state || undefined,
            country: formData.shippingAddress.country || 'Tanzania',
          }),
        })
        const estimate = await estimateRes.json()
        if (!estimate.error && typeof estimate.subtotal === 'number' && typeof estimate.shipping === 'number') {
          serverSubtotal = estimate.subtotal
          serverShippingFee = estimate.shipping
        }
      } catch {
        // Keep fallback totals
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
        shippingAddress: formData.shippingAddress,
        billingAddress: formData.sameAsShipping ? formData.shippingAddress : formData.billingAddress,
        deliveryOption,
        shippingFee: serverShippingFee,
        shippingLocation: locationCoords ? { lat: locationCoords.lat, lon: locationCoords.lon } : null,
        promotionCode: appliedPromotion?.code || null,
        promotionDiscount: promotionDiscount,
        totalAmount: serverTotalAmount,
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

      // Generate ClickPesa checkout link: use total from server response (never trust client-only state).
      // Payment API validates amount against order in DB and uses DB total for the link (anti-tampering).
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
        throw new Error(getSecureErrorMessage(errorData.error || 'Failed', 'Unable to open payment page. Please try again.'))
      }

      const data = await response.json()

      if (!data.checkoutLink) {
        throw new Error(getSecureErrorMessage('No checkout link', 'Unable to open payment page. Please try again.'))
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
    if (formData.shippingAddress.country === 'Tanzania') {
      if (!formData.shippingAddress.region?.trim()) errors.shippingRegion = "Region is required"
      if (!formData.shippingAddress.district?.trim()) errors.shippingDistrict = "District is required"
      if (!formData.shippingAddress.ward?.trim()) errors.shippingWard = "Ward is required"
    } else {
      if (!formData.shippingAddress.city.trim()) errors.shippingCity = "City is required"
    }
    if (!formData.shippingAddress.streetName?.trim()) {
      errors.shippingStreet = "Street name is required"
    }
    if (!formData.shippingAddress.address1.trim()) {
      errors.shippingAddress1 = "House/building number is required"
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
                        We will deliver your order directly to the location you provide.
                        Enter your address manually to continue checkout.
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center space-x-2">
                          <Package className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Estimated delivery time:</strong> 1–3 business days
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
                        Pick up your order from our store location Honic Store, 44 Bibi titi road, DIT CEIIT Tower floor 03, Dar es Salaam
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Pickup Time:</strong> Monday - Saturday, 9:00 AM - 6:00 PM. Same day or next business day
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Gift className="w-3 h-3 text-transparent" />
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            <strong>Pickup Fee:</strong> FREE - No additional charges
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className={cn("text-lg sm:text-xl", themeClasses.mainText)}>Shipping Address</CardTitle>
                    <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                      Please make sure you enter the correct address to avoid package loss or delivery delays.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-lg border border-neutral-300 bg-white px-4 py-3 min-w-56 max-w-[16rem] sm:max-w-[18rem]">
                    <p className="text-sm font-bold text-black">Shipping Fee</p>
                    <p className="text-xs sm:text-sm font-extrabold text-black text-right leading-snug">
                      {shippingEstimateLoading
                        ? 'Calculating...'
                        : hideShippingPrice
                          ? shippingPricingLocked
                            ? 'Shipping address not found. Continue with a known address — we will call to verify.'
                            : 'Shipping address not found'
                          : shippingFee === 0
                            ? 'Free'
                            : formatPrice(shippingFee)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:gap-4 p-3 sm:p-6">
                {SHIPPING_CALCULATION_ENABLED && LOCATION_PICKER_ENABLED && <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFillFromLocation}
                    disabled={isFillingLocation}
                    className={cn(
                      "gap-2 shrink-0 border-sky-500 text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:border-sky-400 dark:text-sky-400 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
                    )}
                  >
                    <MapPin className="h-4 w-4 shrink-0" />
                    {isFillingLocation ? 'Getting location…' : 'Use my location (Google)'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenGoogleMapPicker}
                    className={cn(
                      "gap-2 shrink-0 border-neutral-400 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    )}
                  >
                    <Navigation className="h-4 w-4 shrink-0" />
                    Select on Google Maps
                  </Button>
                  <p className="text-xs text-sky-600 dark:text-sky-400">
                    Use your location or drop a pin like Bolt to calculate the delivery fee from the exact point.
                  </p>
                </div>}
                {/* Row 1: Contact — Full Name, Phone, Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-start">
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

                {/* Row 2: Location — Country, Region, District, Ward (Tanzania) or Country, Region/City, Street (other) */}
                {formData.shippingAddress.country === 'Tanzania' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-start">
                    <div className="grid gap-1 sm:gap-2">
                      <Label htmlFor="shippingCountry" className={cn("text-sm sm:text-base", themeClasses.mainText)}>Country *</Label>
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
                      <Label htmlFor="shippingRegion" className={cn("text-sm sm:text-base", themeClasses.mainText)}>Region *</Label>
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
                        <option value="">Select region</option>
                        {TANZANIA_REGIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {validationErrors.shippingRegion && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingRegion}</p>}
                    </div>
                    <div className="grid gap-1 sm:gap-2">
                      <Label htmlFor="shippingDistrict" className={cn("text-sm sm:text-base", themeClasses.mainText)}>District *</Label>
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
                        <option value="">Select district</option>
                        {(DISTRICTS_BY_REGION[formData.shippingAddress.region || ""] ?? []).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      {validationErrors.shippingDistrict && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingDistrict}</p>}
                    </div>
                    <div className="grid gap-1 sm:gap-2">
                      <Label htmlFor="shippingWard" className={cn("text-sm sm:text-base", themeClasses.mainText)}>Ward *</Label>
                      <select
                        id="shippingWard"
                        value={formData.shippingAddress.ward || ""}
                        onChange={(e) => {
                          handleInputChange(e, "shippingAddress", "ward")
                          setValidationErrors(prev => { const n = { ...prev }; delete n.shippingWard; return n })
                        }}
                        className={cn("w-full min-h-10 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.inputBorder, darkHeaderFooterClasses.textNeutralPrimary, validationErrors.shippingWard ? "border-red-500" : "")}
                      >
                        <option value="">Select ward</option>
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
                      <Label htmlFor="shippingCountry" className={cn("text-sm sm:text-base", themeClasses.mainText)}>Country *</Label>
                      <select id="shippingCountry" value={formData.shippingAddress.country} onChange={(e) => handleInputChange(e, "shippingAddress", "country")} className={cn("w-full min-h-10 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.inputBorder, darkHeaderFooterClasses.textNeutralPrimary)}>
                        <option value="Tanzania">Tanzania</option>
                        <option value="Kenya">Kenya</option>
                        <option value="Uganda">Uganda</option>
                        <option value="Rwanda">Rwanda</option>
                      </select>
                    </div>
                    <div className="grid gap-1 sm:gap-2">
                      <Label htmlFor="shippingCity" className={cn("text-sm sm:text-base", themeClasses.mainText)}>Region/City *</Label>
                      <Input id="shippingCity" value={formData.shippingAddress.city} onChange={(e) => { handleInputChange(e, "shippingAddress", "city"); if (validationErrors.shippingCity) setValidationErrors(prev => { const n = { ...prev }; delete n.shippingCity; return n }) }} placeholder="e.g., Nairobi, Kampala" className={cn(darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.textNeutralPrimary, darkHeaderFooterClasses.inputPlaceholder, validationErrors.shippingCity ? "border-red-500" : darkHeaderFooterClasses.inputBorder)} />
                      {validationErrors.shippingCity && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingCity}</p>}
                    </div>
                  </div>
                )}

                {/* Row 3: Street address — Street Name, House/Building Number, Famous place (optional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-start">
                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingStreet" className={cn("text-sm sm:text-base", themeClasses.mainText)}>Street Name *</Label>
                    <Input
                      id="shippingStreet"
                      value={formData.shippingAddress.streetName || ""}
                      onChange={(e) => {
                        handleInputChange(e, "shippingAddress", "streetName")
                        if (validationErrors.shippingStreet) setValidationErrors(prev => { const n = { ...prev }; delete n.shippingStreet; return n })
                      }}
                      placeholder="e.g., Samora Avenue, Nyerere Road"
                      className={cn(darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.textNeutralPrimary, darkHeaderFooterClasses.inputPlaceholder, validationErrors.shippingStreet ? "border-red-500 focus:border-red-500 focus:ring-red-500" : darkHeaderFooterClasses.inputBorder)}
                    />
                    {validationErrors.shippingStreet && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.shippingStreet}</p>}
                  </div>
                  <div className="grid gap-1 sm:gap-2">
                    <Label htmlFor="shippingHouseNumber" className={cn("text-sm sm:text-base", themeClasses.mainText)}>House/Building Number *</Label>
                    <Input
                      id="shippingHouseNumber"
                      value={formData.shippingAddress.address1}
                      onChange={(e) => {
                        handleInputChange(e, "shippingAddress", "address1")
                        if (validationErrors.shippingAddress1) {
                          setValidationErrors(prev => { const newErrors = { ...prev }; delete newErrors.shippingAddress1; return newErrors })
                        }
                      }}
                      placeholder="e.g., 123, Block A"
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
                    <Label htmlFor="shippingLandmark" className={cn("text-sm sm:text-base", themeClasses.mainText)}>Famous place (optional)</Label>
                    <Input
                      id="shippingLandmark"
                      value={formData.shippingAddress.address2 || ""}
                      onChange={(e) => {
                        handleInputChange(e, "shippingAddress", "address2")
                        if (validationErrors.shippingLandmark) {
                          setValidationErrors(prev => { const newErrors = { ...prev }; delete newErrors.shippingLandmark; return newErrors })
                        }
                      }}
                      placeholder="e.g. City Mall, Mlimani City"
                      className={cn(darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.textNeutralPrimary, darkHeaderFooterClasses.inputPlaceholder, darkHeaderFooterClasses.inputBorder)}
                    />
                    <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>For precision selection.</p>
                  </div>
                </div>

                {/* Row 4: More details (optional) */}
                <div className="grid gap-1 sm:gap-2 w-full max-w-full">
                  <Label htmlFor="shippingMoreDetails" className={cn("text-sm sm:text-base", themeClasses.mainText)}>More details (optional)</Label>
                  <Input
                    id="shippingMoreDetails"
                    value={formData.shippingAddress.state || ""}
                    onChange={(e) => handleInputChange(e, "shippingAddress", "state")}
                    placeholder="e.g. Near Agakan Hospital"
                    className={cn(darkHeaderFooterClasses.inputBg, darkHeaderFooterClasses.inputBorder, darkHeaderFooterClasses.textNeutralPrimary, darkHeaderFooterClasses.inputPlaceholder)}
                  />
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
          <>
            {/* Order Review - outside the box */}
            <h1 className={cn("text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6", themeClasses.mainText)}>Order Review</h1>
            {/* Cart-style header bar (no checkbox, no Clear All / Save for Later) */}
            <div className={cn(
              "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded-lg border mb-4",
              "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200",
              "dark:bg-gradient-to-r dark:from-gray-800 dark:to-gray-700 dark:border-gray-600",
            )}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 dark:text-yellow-400" />
                  <span className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>
                    Cart Items ({orderReviewItemCount})
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-sm">
                  <span className={cn(themeClasses.textNeutralSecondary)}>Total Items: {selectedItemsCount}</span>
                  <span className={cn(themeClasses.textNeutralSecondary)}>Subtotal: {formatPrice(displaySubtotal)}</span>
                </div>
              </div>
              <div className="flex sm:hidden items-center gap-2 text-xs">
                <span className={cn(themeClasses.textNeutralSecondary)}>Items: {selectedItemsCount}</span>
                <span className={cn(themeClasses.textNeutralSecondary)}>Total: {formatPrice(displaySubtotal)}</span>
              </div>
            </div>

            <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
              <CardContent className="p-3 sm:p-4 md:p-6 space-y-6" style={{ contentVisibility: 'auto' }}>
                {/* Items list - same layout as cart page with cart-style qty controls */}
                <div className="space-y-0">
                  {selectedItems.length === 0 ? (
                    <div className="text-center py-8">
                      <p className={cn("text-gray-500", themeClasses.textNeutralSecondary)}>
                        No items in cart. Please add items to your cart first.
                      </p>
                    </div>
                  ) : (
                    selectedItems.flatMap((item, itemIndex) =>
                      (item.variants || []).map((variant: any, variantIndex: number) => {
                        const product = item.product
                        const variantPrice = variant.price || 0
                        const variantQuantity = variant.quantity || 1
                        const variantTotalPrice = variantPrice * variantQuantity
                        const discountPercentage = (product as any)?.originalPrice && (product as any).originalPrice > variantPrice
                          ? (((product as any).originalPrice - variantPrice) / (product as any).originalPrice) * 100
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
                                    {product?.image ? (
                                      <LazyImage
                                        src={product.image}
                                        alt={product.name || "Product"}
                                        width={50}
                                        height={50}
                                        className="w-12 h-12 sm:w-16 sm:h-16 rounded object-cover border border-neutral-200 dark:border-gray-600 hover:border-yellow-500 transition-colors bg-gray-50"
                                        priority={false}
                                        quality={80}
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
                                      {(product as any)?.originalPrice && (product as any).originalPrice > variantPrice && (
                                        <>
                                          <span className={cn("text-[9px] sm:text-xs line-through", themeClasses.textNeutralSecondary)}>
                                            {formatPrice((product as any).originalPrice)}
                                          </span>
                                          <span className="text-[9px] sm:text-xs font-medium text-green-500 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-0.5 sm:px-1.5 py-0.5 rounded">
                                            Save {formatPrice((product as any).originalPrice - variantPrice)}
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
                                      <span className={cn("text-[10px] sm:text-sm", themeClasses.textNeutralSecondary)}>Item Total Price:</span>
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

                {/* Summary totals - new style with background */}
                <div className={cn(
                  "rounded-xl p-4 sm:p-5 space-y-3",
                  "bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700",
                )}>
                  <div className="flex justify-between items-baseline gap-2">
                    <span className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Subtotal ({orderReviewItemCount} items):</span>
                    <span className={cn("text-base font-semibold tabular-nums", themeClasses.mainText)}>{formatPrice(displaySubtotal)}</span>
                  </div>
                  {promotionDiscount > 0 && (
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Discount ({appliedPromotion?.code}):</span>
                      <span className="text-base font-semibold text-green-600 dark:text-green-400 tabular-nums">-{formatPrice(promotionDiscount)}</span>
                    </div>
                  )}
                  {(deliveryOption as string) === 'shipping' && (
                    <div className="flex justify-between items-baseline gap-2">
                      <span className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Shipping:</span>
                      <span
                        className={cn(
                          "text-sm sm:text-base font-semibold text-right max-w-[16rem] sm:max-w-[20rem] leading-snug tabular-nums",
                          !hideShippingPrice && shippingFee === 0 ? "text-green-600 dark:text-green-400" : themeClasses.mainText
                        )}
                      >
                        {shippingEstimateLoading
                          ? '...'
                          : hideShippingPrice
                            ? shippingPricingLocked
                              ? 'Not shown — continue with a known address; we will call to verify.'
                              : 'Shipping address not found'
                            : shippingFee === 0
                              ? 'Free'
                              : formatPrice(shippingFee as number)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-neutral-200 dark:border-neutral-600 pt-3 mt-1">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className={cn("text-base font-bold", themeClasses.mainText)}>Total:</span>
                      <span className={cn("text-lg font-bold tabular-nums", themeClasses.mainText)}>
                        {orderTotal === null ? '—' : formatPrice(orderTotal)}
                      </span>
                    </div>
                  </div>
                </div>

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
                        {(appliedPromotion as any).name || 'Promotion'} • {formatPrice(appliedPromotion.discountAmount)} discount applied
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
          <>
            {/* Order Review - outside the box */}
            <h1 className={cn("text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6", themeClasses.mainText)}>Order Review</h1>
            {/* Cart-style header bar (no checkbox, no Clear All / Save for Later) */}
            <div className={cn(
              "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded-lg border mb-4",
              "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200",
              "dark:bg-gradient-to-r dark:from-gray-800 dark:to-gray-700 dark:border-gray-600",
            )}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 dark:text-yellow-400" />
                  <span className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>
                    Cart Items ({orderReviewItemCount})
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-sm">
                  <span className={cn(themeClasses.textNeutralSecondary)}>Total Items: {selectedItemsCount}</span>
                  <span className={cn(themeClasses.textNeutralSecondary)}>Subtotal: {formatPrice(displaySubtotal)}</span>
                </div>
              </div>
              <div className="flex sm:hidden items-center gap-2 text-xs">
                <span className={cn(themeClasses.textNeutralSecondary)}>Items: {selectedItemsCount}</span>
                <span className={cn(themeClasses.textNeutralSecondary)}>Total: {formatPrice(displaySubtotal)}</span>
              </div>
            </div>

            <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
              <CardContent className="p-3 sm:p-4 md:p-6 space-y-6">
                {/* Items list - same layout as cart page with cart-style qty controls */}
                <div className="space-y-0">
                  {selectedItems.flatMap((item, itemIndex) =>
                    (item.variants || []).map((variant: any, variantIndex: number) => {
                      const product = item.product
                      const variantPrice = variant.price || 0
                      const variantQuantity = variant.quantity || 1
                      const variantTotalPrice = variantPrice * variantQuantity
                      const discountPercentage = (product as any)?.originalPrice && (product as any).originalPrice > variantPrice
                        ? (((product as any).originalPrice - variantPrice) / (product as any).originalPrice) * 100
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
                                  {product?.image ? (
                                    <LazyImage
                                      src={product.image}
                                      alt={product.name || "Product"}
                                      width={50}
                                      height={50}
                                      className="w-12 h-12 sm:w-16 sm:h-16 rounded object-cover border border-neutral-200 dark:border-gray-600 hover:border-yellow-500 transition-colors bg-gray-50"
                                      priority={false}
                                      quality={80}
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
                                    {(product as any)?.originalPrice && (product as any).originalPrice > variantPrice && (
                                      <>
                                        <span className={cn("text-[9px] sm:text-xs line-through", themeClasses.textNeutralSecondary)}>
                                          {formatPrice((product as any).originalPrice)}
                                        </span>
                                        <span className="text-[9px] sm:text-xs font-medium text-green-500 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-0.5 sm:px-1.5 py-0.5 rounded">
                                          Save {formatPrice((product as any).originalPrice - variantPrice)}
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
                                    <span className={cn("text-[10px] sm:text-sm", themeClasses.textNeutralSecondary)}>Item Total Price:</span>
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
                  )}
                </div>

                {/* Summary totals - new style with background */}
                <div className={cn(
                  "rounded-xl p-4 sm:p-5 space-y-3",
                  "bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700",
                )}>
                  <div className="flex justify-between items-baseline gap-2">
                    <span className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Subtotal ({orderReviewItemCount} items):</span>
                    <span className={cn("text-base font-semibold tabular-nums", themeClasses.mainText)}>{formatPrice(displaySubtotal)}</span>
                  </div>
                  {promotionDiscount > 0 && (
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Discount ({appliedPromotion?.code}):</span>
                      <span className="text-base font-semibold text-green-600 dark:text-green-400 tabular-nums">-{formatPrice(promotionDiscount)}</span>
                    </div>
                  )}
                  {(deliveryOption as string) === 'shipping' && (
                    <div className="flex justify-between items-baseline gap-2">
                      <span className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>Shipping:</span>
                      <span
                        className={cn(
                          "text-sm sm:text-base font-semibold text-right max-w-[16rem] sm:max-w-[20rem] leading-snug tabular-nums",
                          !hideShippingPrice && shippingFee === 0 ? "text-green-600 dark:text-green-400" : themeClasses.mainText
                        )}
                      >
                        {shippingEstimateLoading
                          ? '...'
                          : hideShippingPrice
                            ? shippingPricingLocked
                              ? 'Not shown — continue with a known address; we will call to verify.'
                              : 'Shipping address not found'
                            : shippingFee === 0
                              ? 'Free'
                              : formatPrice(shippingFee as number)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-neutral-200 dark:border-neutral-600 pt-3 mt-1">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className={cn("text-base font-bold", themeClasses.mainText)}>Total:</span>
                      <span className={cn("text-lg font-bold tabular-nums", themeClasses.mainText)}>
                        {orderTotal === null ? '—' : formatPrice(orderTotal)}
                      </span>
                    </div>
                  </div>
                </div>

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
                        {(appliedPromotion as any).name || 'Promotion'} • {formatPrice(appliedPromotion.discountAmount)} discount applied
                      </p>
                    </div>
                  </div>
                )}

                {/* Shipping Address */}
                <div className="space-y-3 sm:space-y-4">
                  <h3 className={cn("text-base sm:text-lg font-semibold", themeClasses.mainText)}>Shipping Address</h3>
                  <div className={cn(
                    "rounded-xl p-4 sm:p-5 space-y-3 sm:space-y-4",
                    "bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700",
                  )}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1">
                        <p className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>Full Name</p>
                        <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.fullName || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>Phone</p>
                        <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.phone || '—'}</p>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <p className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>Email</p>
                        <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.email || '—'}</p>
                      </div>
                      {formData.shippingAddress.streetName && (
                        <div className="space-y-1">
                          <p className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>Street</p>
                          <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.streetName}</p>
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>House / Building</p>
                        <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.address1 || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>{formData.shippingAddress.country === 'Tanzania' ? 'Region / District / Ward' : 'City'}</p>
                        <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>
                          {formData.shippingAddress.country === 'Tanzania'
                            ? [formData.shippingAddress.region, formData.shippingAddress.district, formData.shippingAddress.ward].filter(Boolean).join(', ') || '—'
                            : (formData.shippingAddress.city || '—')}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>Country</p>
                        <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>{formData.shippingAddress.country || '—'}</p>
                      </div>
                      {(formData.shippingAddress.postalCode || formData.shippingAddress.state) && (
                        <div className="space-y-1">
                          <p className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>More details</p>
                          <p className={cn("text-sm sm:text-base font-medium", themeClasses.mainText)}>
                            {[formData.shippingAddress.postalCode, formData.shippingAddress.state].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      )}
                      {formData.shippingAddress.address2 && (
                        <div className="space-y-1 sm:col-span-2">
                          <p className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>Famous place</p>
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

  return (
    <div className={cn("min-h-screen", themeClasses.mainBg)}>
      {!isClient ? (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <CheckoutPageSkeleton />
        </div>
      ) : (
    <>
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

      <div className="container mx-auto px-4 py-6 sm:py-8 pt-10 sm:pt-10">
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
                  {paymentLinkGenerated && checkoutLinkUrl ? (
                    <Button
                      onClick={() => {
                        if (checkoutLinkUrl) {
                          window.open(checkoutLinkUrl, '_blank', 'noopener,noreferrer')
                        }
                      }}
                      className="px-6 bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
                    >
                      <Navigation className="mr-2 h-4 w-4" />
                      Open Payment Page
                    </Button>
                  ) : (
                    <Button
                      onClick={handlePlaceOrder}
                      disabled={isProcessingPayment || paymentLinkGenerated}
                      className="px-6 bg-yellow-500 text-neutral-950 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessingPayment ? "Processing..." : paymentError ? "Try Again" : "Place Order"}
                    </Button>
                  )}
                  {paymentError && !isProcessingPayment && !paymentLinkGenerated && (
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

      {showLocationLoadingOverlay && locationOverlayRoot
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
              <div className="rounded-xl border border-white/30 bg-white/90 px-6 py-5 shadow-xl dark:border-gray-700/60 dark:bg-gray-900/90">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-400" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Fetching your location...
                  </p>
                </div>
              </div>
            </div>,
            locationOverlayRoot
          )
        : null}

      <Dialog open={showMapContainer} onOpenChange={setShowMapContainer}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Select delivery point (Google Maps)</DialogTitle>
            <DialogDescription>
              Move the map until the pin matches your exact drop-off point, like Bolt. The shipping fee will use that point.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pt-4">
            <div className="relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
              <div ref={mapPickerContainerRef} className="h-[50vh] min-h-[320px] w-full bg-neutral-100 dark:bg-neutral-900" />
              {mapPickerLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                  <div className="rounded-lg bg-white/90 px-4 py-2 text-sm font-medium text-black shadow dark:bg-gray-900/90 dark:text-white">
                    Loading map...
                  </div>
                </div>
              )}
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full">
                <div className="flex flex-col items-center">
                  <MapPin className="h-9 w-9 fill-yellow-400 text-black drop-shadow" />
                  <div className="-mt-1 h-2 w-2 rounded-full bg-black/60" />
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/60">
              <p className={cn("text-sm font-medium", themeClasses.mainText)}>
                {mapPickerResolving ? 'Resolving address...' : (mapPickerDisplayName || 'Move the map to choose a delivery point')}
              </p>
              {mapPickerCoords && (
                <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                  {mapPickerCoords.lat.toFixed(6)}, {mapPickerCoords.lon.toFixed(6)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowMapContainer(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmMapLocation}
              disabled={!mapPickerCoords || mapPickerLoading || mapPickerResolving}
              className="bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
            >
              Use this point for price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ComingSoonModal />
    </>
    )}
    </div>
  )
}
 