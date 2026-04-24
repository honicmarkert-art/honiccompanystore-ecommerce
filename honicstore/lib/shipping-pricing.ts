import {
  DAR_ES_SALAAM_DISTANCE_TIERS,
  DAR_ES_SALAAM_FALLBACK_BASE_PRICE,
  DAR_ES_SALAAM_WARD_PRICE_MAP,
  DEFAULT_REGION_BASE_PRICE,
  REGION_BASE_PRICE_MAP,
} from '@/lib/shipping-pricing-config'

const STORE_LAT = -(6 + 48 / 60 + 56.4 / 3600)
const STORE_LON = 39 + 16 / 60 + 48.4 / 3600

const deg2rad = (deg: number) => deg * (Math.PI / 180)

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function normalizeRegion(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

function resolveRegionalBasePrice(region?: string): number {
  const normalizedRegion = normalizeRegion(region)
  if (!normalizedRegion) return DEFAULT_REGION_BASE_PRICE
  return REGION_BASE_PRICE_MAP[normalizedRegion] ?? DEFAULT_REGION_BASE_PRICE
}

function isDarEsSalaamRegion(region?: string): boolean {
  const normalized = normalizeRegion(region)
  return normalized === 'dar es salaam'
}

function normalizeWard(value?: string): string {
  if (!value || typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

function resolveDarWardFixedPrice(ward?: string): number | null {
  const normalizedWard = normalizeWard(ward)
  if (!normalizedWard) return null
  return DAR_ES_SALAAM_WARD_PRICE_MAP[normalizedWard] ?? null
}

/**
 * Dar es Salaam wards are priced by direct distance tiers from the store location.
 * The tier represents a full shipping fee (not surcharge on top of region base).
 */
function resolveDarWardDistancePrice(distanceKm: number): number {
  const tier = DAR_ES_SALAAM_DISTANCE_TIERS.find((entry) => distanceKm <= entry.maxKm)
  return tier?.price ?? DAR_ES_SALAAM_FALLBACK_BASE_PRICE
}

export function calculateShippingFee(params: {
  deliveryOption: string
  region?: string
  ward?: string
  lat?: number | null
  lon?: number | null
  subtotal?: number
  allProductsHaveFreeDelivery?: boolean
}): { shippingFee: number; distanceKm: number | null; regionBaseFee: number; wardDistanceFee: number } {
  if (params.deliveryOption === 'pickup') {
    return { shippingFee: 0, distanceKm: null, regionBaseFee: 0, wardDistanceFee: 0 }
  }

  if (params.allProductsHaveFreeDelivery === true) {
    return { shippingFee: 0, distanceKm: null, regionBaseFee: 0, wardDistanceFee: 0 }
  }

  const regionBaseFee = resolveRegionalBasePrice(params.region)
  const isDarEsSalaam = isDarEsSalaamRegion(params.region)
  const darWardFixedPrice = isDarEsSalaam ? resolveDarWardFixedPrice(params.ward) : null
  const lat = typeof params.lat === 'number' && !Number.isNaN(params.lat) ? params.lat : null
  const lon = typeof params.lon === 'number' && !Number.isNaN(params.lon) ? params.lon : null

  if (isDarEsSalaam && darWardFixedPrice != null) {
    return {
      shippingFee: darWardFixedPrice,
      distanceKm: lat == null || lon == null ? null : getDistanceKm(STORE_LAT, STORE_LON, lat, lon),
      regionBaseFee,
      wardDistanceFee: Math.max(0, darWardFixedPrice - regionBaseFee),
    }
  }

  if (lat == null || lon == null) {
    const fallbackFee = isDarEsSalaam ? DAR_ES_SALAAM_FALLBACK_BASE_PRICE : regionBaseFee
    return { shippingFee: fallbackFee, distanceKm: null, regionBaseFee, wardDistanceFee: 0 }
  }

  const distanceKm = getDistanceKm(STORE_LAT, STORE_LON, lat, lon)
  if (isDarEsSalaam) {
    const darWardDistancePrice = resolveDarWardDistancePrice(distanceKm)
    return {
      shippingFee: darWardDistancePrice,
      distanceKm,
      regionBaseFee,
      wardDistanceFee: Math.max(0, darWardDistancePrice - regionBaseFee),
    }
  }

  return {
    shippingFee: Math.max(0, regionBaseFee),
    distanceKm,
    regionBaseFee,
    wardDistanceFee: 0,
  }
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
