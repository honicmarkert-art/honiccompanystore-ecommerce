import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  if (!q || !q.trim()) return new Response(JSON.stringify({ error: 'Missing query q' }), { status: 400 })

  try {
    const googleKey = process.env.GOOGLE_GEOCODING_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!googleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing GOOGLE_GEOCODING_API_KEY (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)' }),
        { status: 500 }
      )
    }

    const googleUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    googleUrl.searchParams.set('address', q.trim())
    googleUrl.searchParams.set('key', googleKey)

    const res = await fetch(googleUrl.toString())
    const data = await res.json()

    if (!res.ok || data?.status !== 'OK' || !Array.isArray(data?.results)) {
      return new Response(
        JSON.stringify({
          error: 'Failed to search location',
          details: data?.error_message || `Google status: ${data?.status || 'UNKNOWN'}`,
          provider: 'google',
        }),
        { status: 502 }
      )
    }

    // Keep compatibility with existing client code expecting Nominatim-like fields.
    const mapped = data.results.slice(0, 5).map((result: any) => ({
      lat: String(result?.geometry?.location?.lat ?? ''),
      lon: String(result?.geometry?.location?.lng ?? ''),
      display_name: result?.formatted_address || '',
      place_id: result?.place_id || '',
      provider: 'google',
      raw: result,
    }))

    return new Response(JSON.stringify(mapped))
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: 'Failed to search location',
        details: e instanceof Error ? e.message : 'Unknown error',
        provider: 'google',
      }),
      { status: 500 }
    )
  }
}
