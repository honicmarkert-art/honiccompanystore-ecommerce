/**
 * Server-only geocoding for shipping (Nominatim). Do not use client lat/lon for charged amounts.
 */

export type GeocodeAddressInput = {
  country?: string | null
  region?: string | null
  district?: string | null
  ward?: string | null
  streetName?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
}

function isTanzaniaArea(country: string | null | undefined): boolean {
  const c = (country || 'Tanzania').trim().toLowerCase()
  return c.includes('tanzania') || c.includes('zanzibar')
}

/**
 * Ordered fallback queries (most specific first). Matches checkout forward-geocode part order:
 * ward → district → region → street → house → landmark → Tanzania, then reversed for Nominatim.
 */
export function buildTanzaniaGeocodeQueries(addr: GeocodeAddressInput): string[] {
  if (!isTanzaniaArea(addr.country)) return []
  const region = addr.region?.trim()
  if (!region) return []

  const parts = [
    addr.ward?.trim(),
    addr.district?.trim(),
    region,
    addr.streetName?.trim(),
    addr.address1?.trim(),
    addr.address2?.trim(),
    addr.city?.trim(),
    'Tanzania',
  ].filter(Boolean) as string[]

  const queries: string[] = []
  if (parts.length >= 2) {
    queries.push(parts.slice().reverse().join(', '))
  }

  const district = addr.district?.trim()
  if (district) {
    queries.push(`${district}, ${region}, Tanzania`)
  }

  queries.push(`${region}, Tanzania`)

  return [...new Set(queries)]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function nominatimFirstLatLon(query: string): Promise<{ lat: number; lon: number } | null> {
  const q = query.trim()
  if (!q) return null
  const ua = process.env.NOMINATIM_USER_AGENT?.trim() || 'HonicStore/1.0 (https://honiccompanystore.com; shipping quote)'
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=tz`
    const res = await fetch(url, {
      headers: { 'User-Agent': ua },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as unknown
    if (!Array.isArray(data) || data.length === 0) return null
    const row = data[0] as { lat?: string; lon?: string }
    const lat = parseFloat(String(row.lat ?? ''))
    const lon = parseFloat(String(row.lon ?? ''))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    return { lat, lon }
  } catch {
    return null
  }
}

/** Try queries in order; respects ~1 req/s Nominatim etiquette after the first attempt. */
export async function resolveTrustedDeliveryLatLon(
  addr: GeocodeAddressInput
): Promise<{ lat: number; lon: number } | null> {
  const queries = buildTanzaniaGeocodeQueries(addr)
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await sleep(1100)
    const c = await nominatimFirstLatLon(queries[i]!)
    if (c) return c
  }
  return null
}
