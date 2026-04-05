import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) return new Response(JSON.stringify({ error: 'Missing lat/lon' }), { status: 400 })

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      { headers: { 'User-Agent': 'HonicStore/1.0' } }
    )
    const data = await res.json()
    return new Response(JSON.stringify(data))
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch location name' }), { status: 500 })
  }
}
