/**
 * Shipping (TZS): zone base fee (JSON) + distance add-on from each zone hub (bus-station coords in JSON).
 * Delivery coordinates for the add-on come from server geocoding only — never from client GPS for pricing.
 *
 * Env:
 *   SHIPPING_FREE_THRESHOLD_TZS, SHIPPING_FLAT_RATE_TZS
 *   SHIPPING_USE_ZONES=false → after free rules, flat rate only (no zone table / no geocode)
 *   NOMINATIM_USER_AGENT — set to your contact URL (Nominatim policy)
 *
 * Config: `lib/shipping-zones.json` — rules[].feeTz (base), originLat/originLon (hub), distanceFromZoneOrigin.
 */

import shippingZonesJson from './shipping-zones.json'
import type { GeocodeAddressInput } from './server-geocode'
import { resolveTrustedDeliveryLatLon } from './server-geocode'

export const SHIPPING_DEFAULTS = {
  freeThresholdTz: 100_000,
  flatRateTz: 5_000,
  distanceIncludedKm: 2,
  distancePerKmTz: 500,
} as const

export type ZoneRule = {
  region?: string
  district?: string
  ward?: string
  /** Zone base (hub) fee before last-mile distance */
  feeTz: number
  /** Regional hub — bus station / terminal (decimal degrees) */
  originLat?: number
  originLon?: number
}

type ZonesFile = {
  version: number
  distanceFromZoneOrigin?: {
    includedKm?: number
    perKmTz?: number
    maxKmFromOrigin?: number
    /** Floor distance used for tier pricing when geocode lands near hub (avoids 0 add-on). 0 = off */
    minBillableKmFromHub?: number
  }
  rules: ZoneRule[]
}

const zonesFile = shippingZonesJson as ZonesFile

function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export type ShippingRuntimeConfig = {
  freeThresholdTz: number
  flatRateTz: number
  useZones: boolean
}

export function getShippingConfig(): ShippingRuntimeConfig {
  return {
    freeThresholdTz: parseEnvInt(
      'SHIPPING_FREE_THRESHOLD_TZS',
      parseEnvInt('NEXT_PUBLIC_SHIPPING_FREE_THRESHOLD_TZS', SHIPPING_DEFAULTS.freeThresholdTz)
    ),
    flatRateTz: parseEnvInt(
      'SHIPPING_FLAT_RATE_TZS',
      parseEnvInt('NEXT_PUBLIC_SHIPPING_FLAT_RATE_TZS', SHIPPING_DEFAULTS.flatRateTz)
    ),
    useZones: process.env.SHIPPING_USE_ZONES !== 'false',
  }
}

export function getClientShippingPricing(): { freeThresholdTz: number; flatRateTz: number } {
  return {
    freeThresholdTz: parseEnvInt('NEXT_PUBLIC_SHIPPING_FREE_THRESHOLD_TZS', SHIPPING_DEFAULTS.freeThresholdTz),
    flatRateTz: parseEnvInt('NEXT_PUBLIC_SHIPPING_FLAT_RATE_TZS', SHIPPING_DEFAULTS.flatRateTz),
  }
}

export function normalizeLocationKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function normalizeLocationSegment(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function ruleSpecificity(rule: ZoneRule): number {
  let n = 0
  if (rule.ward?.trim()) n++
  if (rule.district?.trim()) n++
  if (rule.region?.trim()) n++
  return n
}

function ruleMatches(rule: ZoneRule, region: string, district: string | null, ward: string | null): boolean {
  const rR = rule.region?.trim()
  if (rR && normalizeLocationKey(rR) !== normalizeLocationKey(region)) return false
  const rD = rule.district?.trim()
  if (rD) {
    if (!district) return false
    if (normalizeLocationKey(rD) !== normalizeLocationKey(district)) return false
  }
  const rW = rule.ward?.trim()
  if (rW) {
    if (!ward) return false
    if (normalizeLocationKey(rW) !== normalizeLocationKey(ward)) return false
  }
  return true
}

export function resolveMatchedZoneRule(
  rules: ZoneRule[],
  region: string,
  district: string | null,
  ward: string | null
): ZoneRule | null {
  const r = region.trim()
  if (!r) return null
  let best: ZoneRule | null = null
  let bestScore = -1
  for (const rule of rules) {
    if (!ruleMatches(rule, r, district, ward)) continue
    const score = ruleSpecificity(rule)
    if (score > bestScore) {
      bestScore = score
      best = rule
    }
  }
  return best
}

/** @deprecated use resolveMatchedZoneRule */
export function resolveZoneFee(
  rules: ZoneRule[],
  region: string,
  district: string | null,
  ward: string | null,
  fallbackTz: number
): number {
  return resolveMatchedZoneRule(rules, region, district, ward)?.feeTz ?? fallbackTz
}

export function getBundledZoneRules(): ZoneRule[] {
  return zonesFile.rules
}

function getZoneDistancePricing(): {
  includedKm: number
  perKmTz: number
  maxKmFromOrigin: number
  minBillableKmFromHub: number
} {
  const raw = zonesFile.distanceFromZoneOrigin
  return {
    includedKm: raw?.includedKm ?? SHIPPING_DEFAULTS.distanceIncludedKm,
    perKmTz: raw?.perKmTz ?? SHIPPING_DEFAULTS.distancePerKmTz,
    maxKmFromOrigin: raw?.maxKmFromOrigin ?? 200,
    minBillableKmFromHub: raw?.minBillableKmFromHub ?? 0,
  }
}

const deg2rad = (deg: number) => deg * (Math.PI / 180)

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function zoneOriginDistanceAddon(km: number, d: { includedKm: number; perKmTz: number }): number {
  if (km <= d.includedKm) return 0
  return Math.ceil(km - d.includedKm) * d.perKmTz
}

export function isPlausibleTzDeliveryCoordinate(lat: number, lon: number): boolean {
  return lat >= -12 && lat <= 0 && lon >= 29 && lon <= 41
}

export type ShippingCalculationInput = {
  deliveryOption: string
  subtotal: number
  allProductsFreeDelivery: boolean
  region?: string | null
  district?: string | null
  ward?: string | null
  /** Server-resolved delivery point only (from geocode). */
  deliveryLat?: number | null
  deliveryLon?: number | null
}

export type ShippingBreakdown = {
  totalTz: number
  baseTz: number
  distanceAddonTz: number
  /** Raw great-circle km hub → delivery (when geocoded) */
  distanceKm?: number
  geocoded: boolean
}

const ZERO_BREAKDOWN: ShippingBreakdown = {
  totalTz: 0,
  baseTz: 0,
  distanceAddonTz: 0,
  geocoded: false,
}

/**
 * Zone base + distance from zone hub to server-resolved delivery coords.
 * minBillableKmFromHub (JSON) avoids 0 add-on when OSM centroid matches hub coordinates.
 */
export function computeShippingBreakdownSync(
  input: ShippingCalculationInput,
  cfg?: ShippingRuntimeConfig
): ShippingBreakdown {
  const c = cfg ?? getShippingConfig()
  if (input.deliveryOption === 'pickup') return ZERO_BREAKDOWN
  if (input.subtotal >= c.freeThresholdTz) return ZERO_BREAKDOWN
  if (input.allProductsFreeDelivery) return ZERO_BREAKDOWN

  const region = normalizeLocationSegment(input.region)
  const district = normalizeLocationSegment(input.district)
  const ward = normalizeLocationSegment(input.ward)

  if (!c.useZones || !region) {
    const flat = c.flatRateTz
    return { totalTz: flat, baseTz: flat, distanceAddonTz: 0, geocoded: false }
  }

  const rule = resolveMatchedZoneRule(getBundledZoneRules(), region, district, ward)
  const base = rule ? rule.feeTz : c.flatRateTz
  const dcfg = getZoneDistancePricing()

  const oLat = rule?.originLat
  const oLon = rule?.originLon
  const dLat = input.deliveryLat
  const dLon = input.deliveryLon

  if (
    !rule ||
    typeof oLat !== 'number' ||
    typeof oLon !== 'number' ||
    !Number.isFinite(oLat) ||
    !Number.isFinite(oLon) ||
    typeof dLat !== 'number' ||
    typeof dLon !== 'number' ||
    !Number.isFinite(dLat) ||
    !Number.isFinite(dLon) ||
    !isPlausibleTzDeliveryCoordinate(dLat, dLon)
  ) {
    return { totalTz: base, baseTz: base, distanceAddonTz: 0, geocoded: false }
  }

  const km = haversineDistanceKm(oLat, oLon, dLat, dLon)
  if (km > dcfg.maxKmFromOrigin) {
    return { totalTz: base, baseTz: base, distanceAddonTz: 0, distanceKm: km, geocoded: true }
  }

  const minB = dcfg.minBillableKmFromHub
  const kmForAddon = minB > 0 ? Math.max(km, minB) : km
  const distanceAddonTz = zoneOriginDistanceAddon(kmForAddon, dcfg)
  return {
    totalTz: base + distanceAddonTz,
    baseTz: base,
    distanceAddonTz,
    distanceKm: km,
    geocoded: true,
  }
}

export function calculateShippingFeeSync(input: ShippingCalculationInput, cfg?: ShippingRuntimeConfig): number {
  return computeShippingBreakdownSync(input, cfg).totalTz
}

export type TrustedShippingInput = Omit<ShippingCalculationInput, 'deliveryLat' | 'deliveryLon'> & {
  /** Structured address used for server geocoding (TZ). Client lat/lon is ignored. */
  addressForGeocode?: GeocodeAddressInput | null
}

export async function calculateShippingBreakdownTrusted(
  input: TrustedShippingInput,
  cfg?: ShippingRuntimeConfig
): Promise<ShippingBreakdown> {
  const c = cfg ?? getShippingConfig()
  if (input.deliveryOption === 'pickup') return ZERO_BREAKDOWN
  if (input.subtotal >= c.freeThresholdTz) return ZERO_BREAKDOWN
  if (input.allProductsFreeDelivery) return ZERO_BREAKDOWN

  const { addressForGeocode, ...rest } = input

  let deliveryLat: number | null = null
  let deliveryLon: number | null = null

  if (c.useZones && addressForGeocode) {
    const coords = await resolveTrustedDeliveryLatLon(addressForGeocode)
    if (coords && isPlausibleTzDeliveryCoordinate(coords.lat, coords.lon)) {
      deliveryLat = coords.lat
      deliveryLon = coords.lon
    }
  }

  return computeShippingBreakdownSync(
    {
      ...rest,
      deliveryLat,
      deliveryLon,
    },
    c
  )
}

export async function calculateShippingFeeTrusted(
  input: TrustedShippingInput,
  cfg?: ShippingRuntimeConfig
): Promise<number> {
  return (await calculateShippingBreakdownTrusted(input, cfg)).totalTz
}

function toFiniteNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

export function extractDeliveryCoordinates(orderData: {
  shippingAddress?: Record<string, unknown> | null
  deliveryLat?: unknown
  deliveryLon?: unknown
  deliveryLatitude?: unknown
  deliveryLongitude?: unknown
}): { lat: number | null; lon: number | null } {
  const a = orderData.shippingAddress
  const lat =
    toFiniteNumber(a?.lat) ??
    toFiniteNumber(a?.latitude) ??
    toFiniteNumber(orderData.deliveryLat) ??
    toFiniteNumber(orderData.deliveryLatitude)
  const lon =
    toFiniteNumber(a?.lon) ??
    toFiniteNumber(a?.longitude) ??
    toFiniteNumber(orderData.deliveryLon) ??
    toFiniteNumber(orderData.deliveryLongitude)
  return { lat, lon }
}

export function extractDeliveryLocationFields(orderData: {
  shippingAddress?: Record<string, unknown> | null
}): { region: string | null; district: string | null; ward: string | null } {
  const a = orderData.shippingAddress
  return {
    region: normalizeLocationSegment(a?.region),
    district: normalizeLocationSegment(a?.district),
    ward: normalizeLocationSegment(a?.ward),
  }
}

export function shippingAddressToGeocodeInput(
  shippingAddress: Record<string, unknown> | null | undefined
): GeocodeAddressInput {
  if (!shippingAddress) return {}
  return {
    country: normalizeLocationSegment(shippingAddress.country) ?? undefined,
    region: normalizeLocationSegment(shippingAddress.region) ?? undefined,
    district: normalizeLocationSegment(shippingAddress.district) ?? undefined,
    ward: normalizeLocationSegment(shippingAddress.ward) ?? undefined,
    streetName: normalizeLocationSegment(shippingAddress.streetName) ?? undefined,
    address1: normalizeLocationSegment(shippingAddress.address1) ?? undefined,
    address2: normalizeLocationSegment(shippingAddress.address2) ?? undefined,
    city: normalizeLocationSegment(shippingAddress.city) ?? undefined,
  }
}
