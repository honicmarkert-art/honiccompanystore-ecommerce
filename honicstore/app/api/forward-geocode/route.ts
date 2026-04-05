import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  if (!q || !q.trim()) return new Response(JSON.stringify({ error: 'Missing query q' }), { status: 400 })

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q.trim())}&format=json&addressdetails=1&limit=5`,
      { headers: { 'User-Agent': 'HonicStore/1.0' } }
    )
    const data = await res.json()
    return new Response(JSON.stringify(Array.isArray(data) ? data : []))
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to search location' }), { status: 500 })
  }
}
