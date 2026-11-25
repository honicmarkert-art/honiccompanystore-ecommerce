/**
 * Small helpers for the cart / checkout / info pages. All delivery prices live in
 * lib/shipping-pricing-config.ts and are calculated by lib/shipping-pricing.ts
 * (the same code runs in checkout and in the order API).
 *
 * (Replaced the old calculator: shipping-zones.json, geocoded distances and a flat TSh 5,000 rate.)
 */
import { freeDeliveryThreshold } from '@/lib/shipping-pricing'

/** Free-delivery amount for the cart bar and info pages */
export function getClientShippingPricing(): { freeThresholdTz: number } {
  return { freeThresholdTz: freeDeliveryThreshold() }
}

/**
 * Checkout: don't show a delivery fee until the shopper has picked their region
 * (delivery is Tanzania-only, priced by region / Dar es Salaam ward).
 */
export function shouldDeferShippingFeeDisplay(
  deliveryOption: 'pickup' | 'shipping',
  address: { country?: string; region?: string },
): boolean {
  if (deliveryOption === 'pickup') return false
  return !(address.region || '').trim()
}
