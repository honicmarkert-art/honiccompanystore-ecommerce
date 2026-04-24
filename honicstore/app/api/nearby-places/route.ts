import type { NextRequest } from "next/server"

type OverpassElement = {
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6371000
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

function getCategory(tags: Record<string, string>): string {
  return (
    tags.shop ||
    tags.amenity ||
    tags.tourism ||
    tags.leisure ||
    tags.public_transport ||
    tags.highway ||
    "place"
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = Number.parseFloat(searchParams.get("lat") || "")
  const lon = Number.parseFloat(searchParams.get("lon") || "")
  const radius = Number.parseInt(searchParams.get("radius") || "1500", 10)
  const limit = Number.parseInt(searchParams.get("limit") || "15", 10)

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return new Response(JSON.stringify({ error: "Missing or invalid lat/lon" }), { status: 400 })
  }

  const safeRadius = Math.min(Math.max(radius, 100), 5000)
  const safeLimit = Math.min(Math.max(limit, 1), 25)

  const query = `
[out:json][timeout:20];
(
  node(around:${safeRadius},${lat},${lon})["name"]["amenity"];
  way(around:${safeRadius},${lat},${lon})["name"]["amenity"];
  relation(around:${safeRadius},${lat},${lon})["name"]["amenity"];

  node(around:${safeRadius},${lat},${lon})["name"]["shop"];
  way(around:${safeRadius},${lat},${lon})["name"]["shop"];
  relation(around:${safeRadius},${lat},${lon})["name"]["shop"];

  node(around:${safeRadius},${lat},${lon})["name"]["tourism"];
  way(around:${safeRadius},${lat},${lon})["name"]["tourism"];
  relation(around:${safeRadius},${lat},${lon})["name"]["tourism"];

  node(around:${safeRadius},${lat},${lon})["name"]["leisure"];
  way(around:${safeRadius},${lat},${lon})["name"]["leisure"];
  relation(around:${safeRadius},${lat},${lon})["name"]["leisure"];

  node(around:${safeRadius},${lat},${lon})["name"]["public_transport"];
  node(around:${safeRadius},${lat},${lon})["name"]["highway"="bus_stop"];
);
out center;
`

  try {
    const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Accept: "application/json",
      },
      body: query.trim(),
    })

    if (!overpassRes.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch nearby places",
          details: `Overpass status ${overpassRes.status}`,
        }),
        { status: 502 }
      )
    }

    const payload = (await overpassRes.json()) as { elements?: OverpassElement[] }
    const elements = Array.isArray(payload.elements) ? payload.elements : []

    const places = elements
      .map((element) => {
        const tags = element.tags || {}
        const name = tags.name?.trim()
        const point = element.center || (element.lat != null && element.lon != null ? { lat: element.lat, lon: element.lon } : null)
        if (!name || !point) return null
        const distance = distanceMeters(lat, lon, point.lat, point.lon)
        return {
          id: element.id,
          name,
          category: getCategory(tags),
          road: tags["addr:street"] || tags.street || "",
          suburb: tags["addr:suburb"] || tags.suburb || "",
          distance_m: Math.round(distance),
          lat: point.lat,
          lon: point.lon,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.distance_m - b.distance_m)

    const uniqueByName = new Map<string, (typeof places)[number]>()
    for (const place of places) {
      const key = `${place.name.toLowerCase()}|${place.category.toLowerCase()}`
      if (!uniqueByName.has(key)) uniqueByName.set(key, place)
    }

    return new Response(
      JSON.stringify({
        places: Array.from(uniqueByName.values()).slice(0, safeLimit),
        radius_m: safeRadius,
        provider: "openstreetmap-overpass",
      })
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch nearby places",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    )
  }
}
