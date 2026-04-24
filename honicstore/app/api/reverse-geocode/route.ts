import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) return new Response(JSON.stringify({ error: 'Missing lat/lon' }), { status: 400 })

  try {
    const geocodingKey = process.env.GOOGLE_GEOCODING_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!geocodingKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing GOOGLE_GEOCODING_API_KEY (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)',
          provider: 'google',
        }),
        { status: 500 }
      )
    }

    const googleUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    googleUrl.searchParams.set('latlng', `${lat},${lon}`)
    googleUrl.searchParams.set('key', geocodingKey)

    const googleRes = await fetch(googleUrl.toString())
    const googleData = await googleRes.json()

    if (!googleRes.ok || googleData?.status !== 'OK' || !Array.isArray(googleData.results) || googleData.results.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch location name',
          details: googleData?.error_message || `Google status: ${googleData?.status || 'UNKNOWN'}`,
          provider: 'google',
        }),
        { status: 502 }
      )
    }

    const first = googleData.results[0]
    const components: Array<{ long_name?: string; types?: string[] }> = Array.isArray(first.address_components)
      ? first.address_components
      : []
    const byType = (type: string) => components.find((c) => c.types?.includes(type))?.long_name || ''
    const address = {
      house_number: byType('street_number'),
      road: byType('route'),
      suburb: byType('sublocality') || byType('sublocality_level_1') || byType('neighborhood'),
      neighbourhood: byType('neighborhood'),
      city: byType('locality'),
      town: byType('postal_town'),
      village: byType('administrative_area_level_3'),
      county: byType('administrative_area_level_2'),
      state_district: byType('administrative_area_level_2'),
      state: byType('administrative_area_level_1'),
      postcode: byType('postal_code'),
      country: byType('country'),
    }

    let nearbyPlace: {
      name: string
      vicinity: string
      lat: number
      lon: number
      types: string[]
      place_id: string
    } | null = null

    // Nearby known place for "Famous place" autofill (malls, lodges, bus stops, landmarks, etc.).
    // This improves UX when reverse geocoding doesn't include a clear landmark.
    try {
      const placesUrl = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
      placesUrl.searchParams.set('location', `${lat},${lon}`)
      placesUrl.searchParams.set('rankby', 'distance')
      const placesKey = process.env.GOOGLE_MAPS_PLACES_API_KEY || geocodingKey
      placesUrl.searchParams.set('key', placesKey)

      const placesRes = await fetch(placesUrl.toString())
      const placesData = await placesRes.json()

      if (
        placesRes.ok &&
        placesData?.status === 'OK' &&
        Array.isArray(placesData.results) &&
        placesData.results.length > 0
      ) {
        const nearest = placesData.results[0]
        nearbyPlace = {
          name: nearest?.name || '',
          vicinity: nearest?.vicinity || '',
          lat: nearest?.geometry?.location?.lat ?? 0,
          lon: nearest?.geometry?.location?.lng ?? 0,
          types: Array.isArray(nearest?.types) ? nearest.types : [],
          place_id: nearest?.place_id || '',
        }
      }
    } catch {
      // Don't fail the whole reverse geocoding if Places Nearby Search fails/disabled.
    }

    return new Response(
      JSON.stringify({
        display_name: first.formatted_address || '',
        address,
        provider: 'google',
        nearby_place: nearbyPlace,
        raw: googleData,
      })
    )
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch location name',
        details: e instanceof Error ? e.message : 'Unknown error',
      }),
      { status: 500 }
    )
  }
}
