import {
  DAR_ES_SALAAM_DISTRICT_TIER,
  DAR_ES_SALAAM_ETA,
  DAR_ES_SALAAM_FALLBACK_TIER,
  DAR_ES_SALAAM_TIERS,
  DAR_ES_SALAAM_WARD_TIER,
  DELIVERY_ZONES,
  ISLAND_DISTRICT_SURCHARGE,
  OUTSIDE_TOWN_SURCHARGE,
  SIZE_SURCHARGE,
  TOWN_DISTRICTS,
  UNKNOWN_REGION_ZONE,
  type ShippingSize,
} from '@/lib/shipping-pricing-config'

/**
 * Delivery fee for an order. Used by the checkout estimate (/api/cart/shipping-estimate) and,
 * authoritatively, by the order API, so both always agree. Rules: lib/shipping-pricing-config.ts.
 */

/**
 * Free delivery when the items add up to this (TSh). One setting for browser and server:
 * NEXT_PUBLIC_SHIPPING_FREE_THRESHOLD_TZS (written out literally so Next.js inlines it in the browser).
 */
export function freeDeliveryThreshold(): number {
  const n = Number.parseInt(process.env.NEXT_PUBLIC_SHIPPING_FREE_THRESHOLD_TZS || '', 10)
  return Number.isFinite(n) && n > 0 ? n : 100_000
}

const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '')

const SIZE_RANK: Record<ShippingSize, number> = { small: 0, medium: 1, large: 2 }

/** The biggest item decides the parcel size. Unknown/missing -> small. */
export function largestSize(sizes: Array<string | null | undefined>): ShippingSize {
  let best: ShippingSize = 'small'
  for (const s of sizes) {
    const v = (s === 'medium' || s === 'large' ? s : 'small') as ShippingSize
    if (SIZE_RANK[v] > SIZE_RANK[best]) best = v
  }
  return best
}

export type ShippingQuote = {
  shippingFee: number
  /** standard-parcel fee for the address, before free delivery / size */
  baseFee: number
  sizeSurcharge: number
  size: ShippingSize
  zone: string
  eta: string | null
  freeReason: 'pickup' | 'free_delivery_products' | 'threshold' | null
  /** kept for older callers */
  distanceKm: null
  regionBaseFee: number
  wardDistanceFee: number
}

/** Zone + standard fee + delivery time for a Tanzanian address */
export function deliveryZoneFor(region?: string, district?: string, ward?: string): { zone: string; fee: number; eta: string; dar: boolean } {
  const r = norm(region)
  if (r === 'dar es salaam') {
    const tier = DAR_ES_SALAAM_WARD_TIER[norm(ward)] ?? DAR_ES_SALAAM_DISTRICT_TIER[norm(district)] ?? DAR_ES_SALAAM_FALLBACK_TIER
    const t = DAR_ES_SALAAM_TIERS[tier]
    return { zone: `Dar es Salaam · ${t.name}`, fee: t.fee, eta: DAR_ES_SALAAM_ETA, dar: true }
  }
  const z = DELIVERY_ZONES.find((zone) => zone.regions.includes(r)) || UNKNOWN_REGION_ZONE
  // Parcels go to the regional town; other districts add onward transport, islands an extra boat.
  // No district picked yet -> town price (checkout asks for the district before payment).
  const d = norm(district)
  const island = ISLAND_DISTRICT_SURCHARGE[d]
  if (island) return { zone: `${z.name} · ${title(d)} (island)`, fee: z.fee + island, eta: z.eta, dar: false }
  if (d && !TOWN_DISTRICTS.has(d)) return { zone: `${z.name} · outside the regional town`, fee: z.fee + OUTSIDE_TOWN_SURCHARGE, eta: z.eta, dar: false }
  return { zone: z.name, fee: z.fee, eta: z.eta, dar: false }
}

const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

export function calculateShippingFee(params: {
  deliveryOption: string
  region?: string
  district?: string
  ward?: string
  /** ignored: fees come from the address only (a tampered location must not change the price) */
  lat?: number | null
  lon?: number | null
  /** Accepted for completeness; delivery is Tanzania-only */
  country?: string
  subtotal?: number
  allProductsHaveFreeDelivery?: boolean
  /** biggest item in the order (products.shipping_size); default small */
  size?: ShippingSize
}): ShippingQuote {
  const size = params.size || 'small'
  const legacy = { distanceKm: null as null, wardDistanceFee: 0 }

  if (params.deliveryOption === 'pickup') {
    return { shippingFee: 0, baseFee: 0, sizeSurcharge: 0, size, zone: 'Store pickup', eta: null, freeReason: 'pickup', regionBaseFee: 0, ...legacy }
  }

  const { zone, fee, eta, dar } = deliveryZoneFor(params.region, params.district, params.ward)
  const surcharge = dar ? SIZE_SURCHARGE[size].dar : SIZE_SURCHARGE[size].upcountry
  const base = { baseFee: fee, size, zone, eta, regionBaseFee: fee, ...legacy }

  // Products the seller ships for free: no standard fee (a large item still pays its handling surcharge)
  if (params.allProductsHaveFreeDelivery === true) {
    return { ...base, shippingFee: surcharge, sizeSurcharge: surcharge, freeReason: 'free_delivery_products' }
  }
  // Free delivery over the threshold (the cart and checkout promise this): covers the standard fee
  if (typeof params.subtotal === 'number' && params.subtotal >= freeDeliveryThreshold()) {
    return { ...base, shippingFee: surcharge, sizeSurcharge: surcharge, freeReason: 'threshold' }
  }
  return { ...base, shippingFee: fee + surcharge, sizeSurcharge: surcharge, freeReason: null }
}

export async function resolveShippingCoordinatesFromAddress(params: {
  lat?: number | null
  lon?: number | null
  ward?: string
  district?: string
  region?: string
  streetName?: string
  address1?: string
  city?: string
  state?: string
  country?: string
}): Promise<{ lat: number; lon: number } | null> {
  const existingLat = typeof params.lat === 'number' && !Number.isNaN(params.lat) ? params.lat : null
  const existingLon = typeof params.lon === 'number' && !Number.isNaN(params.lon) ? params.lon : null
  if (existingLat != null && existingLon != null) {
    return { lat: existingLat, lon: existingLon }
  }
  // Form-selection-only mode: do not geocode from maps services.
  return null
}

/**
 * Parcel size per product (products.shipping_size: small | medium | large).
 * Never fails: if the column isn't there yet (migration not run) every item counts as small.
 */
export async function getShippingSizes(
  supabase: { from: (t: string) => any },
  productIds: number[],
): Promise<Map<number, ShippingSize>> {
  const map = new Map<number, ShippingSize>()
  if (productIds.length === 0) return map
  try {
    const { data, error } = await supabase.from('products').select('id, shipping_size').in('id', productIds)
    if (error || !Array.isArray(data)) return map
    for (const row of data as { id: number; shipping_size?: string | null }[]) {
      map.set(Number(row.id), largestSize([row.shipping_size]))
    }
  } catch {
    /* column missing or DB hiccup: standard parcels */
  }
  return map
}

/** Value to store in products.shipping_size: 'medium' | 'large', or null for a standard parcel. */
export function shippingSizeOrNull(v: unknown): 'medium' | 'large' | null {
  return v === 'medium' || v === 'large' ? v : null
}
