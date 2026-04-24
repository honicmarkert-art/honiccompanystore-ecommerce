"use client"

import { useMemo, useState } from "react"

type GeoCoords = {
  latitude: number
  longitude: number
  accuracy: number | null
  altitude: number | null
  altitudeAccuracy: number | null
  heading: number | null
  speed: number | null
  timestamp: number
}

type ReverseGeocodeResponse = {
  display_name?: string
  address?: Record<string, string>
  error?: string
  details?: string
  provider?: string
}

type NearbyPlace = {
  id: number
  name: string
  category: string
  road?: string
  suburb?: string
  distance_m: number
  lat: number
  lon: number
}

type NearbyPlacesResponse = {
  places?: NearbyPlace[]
  error?: string
  details?: string
}

function formatNullableNumber(value: number | null, decimals = 6): string {
  if (value === null || Number.isNaN(value)) return "N/A"
  return value.toFixed(decimals)
}

export default function LocationPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [coords, setCoords] = useState<GeoCoords | null>(null)
  const [address, setAddress] = useState<ReverseGeocodeResponse | null>(null)
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([])
  const [nearbyError, setNearbyError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openedAt = useMemo(() => new Date().toLocaleString(), [])
  const placeHierarchy = useMemo(() => {
    if (!address?.address) return []
    const a = address.address
    return [
      { label: "Region/State", value: a.state || a.region || a.county || "" },
      { label: "District/City", value: a.city || a.town || a.village || a.municipality || "" },
      { label: "Ward/Suburb", value: a.suburb || a.neighbourhood || a.city_district || "" },
      { label: "Road/Street", value: a.road || a.pedestrian || a.street || "" },
      { label: "House/Building", value: [a.house_number, a.house_name].filter(Boolean).join(" ") },
      { label: "Postcode", value: a.postcode || "" },
      { label: "Country", value: a.country || "" },
    ].filter((item) => item.value)
  }, [address])

  const fetchLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.")
      return
    }

    setError(null)
    setAddress(null)
    setNearbyPlaces([])
    setNearbyError(null)
    setIsLoading(true)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextCoords: GeoCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
          altitude: position.coords.altitude ?? null,
          altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
          heading: position.coords.heading ?? null,
          speed: position.coords.speed ?? null,
          timestamp: position.timestamp,
        }

        setCoords(nextCoords)

        try {
          const [reverseRes, nearbyRes] = await Promise.all([
            fetch(`/api/reverse-geocode?lat=${nextCoords.latitude}&lon=${nextCoords.longitude}`),
            fetch(`/api/nearby-places?lat=${nextCoords.latitude}&lon=${nextCoords.longitude}&radius=2000&limit=12`),
          ])

          const reverseData = (await reverseRes.json()) as ReverseGeocodeResponse
          if (!reverseRes.ok) {
            setAddress({
              error: reverseData.error || "Failed to resolve address.",
              details: reverseData.details || "The geocoding provider returned an error.",
              provider: reverseData.provider,
            })
          } else {
            setAddress(reverseData)
          }

          const nearbyData = (await nearbyRes.json()) as NearbyPlacesResponse
          if (!nearbyRes.ok) {
            setNearbyError(nearbyData.details || nearbyData.error || "Could not fetch nearby places.")
          } else {
            setNearbyPlaces(Array.isArray(nearbyData.places) ? nearbyData.places : [])
          }
        } catch {
          setAddress({ error: "Failed to reverse geocode this location." })
          setNearbyError("Failed to fetch nearby places.")
        } finally {
          setIsLoading(false)
        }
      },
      (geoError) => {
        setIsLoading(false)
        switch (geoError.code) {
          case 1:
            setError("Location permission denied. Allow access and try again.")
            break
          case 2:
            setError("Position unavailable. Check location services and try again.")
            break
          case 3:
            setError("Location request timed out. Try again.")
            break
          default:
            setError("Failed to fetch location.")
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">My Location Details</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Capture your current position and view full geolocation details.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Page opened: {openedAt}</p>

      <button
        type="button"
        onClick={fetchLocation}
        disabled={isLoading}
        className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
      >
        {isLoading ? "Fetching location..." : "Fetch my location"}
      </button>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {coords && (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="text-lg font-medium">GPS Coordinates</h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <strong>Latitude:</strong> {coords.latitude.toFixed(6)}
            </p>
            <p>
              <strong>Longitude:</strong> {coords.longitude.toFixed(6)}
            </p>
            <p>
              <strong>Accuracy (m):</strong> {formatNullableNumber(coords.accuracy, 2)}
            </p>
            <p>
              <strong>Altitude (m):</strong> {formatNullableNumber(coords.altitude, 2)}
            </p>
            <p>
              <strong>Altitude accuracy (m):</strong>{" "}
              {formatNullableNumber(coords.altitudeAccuracy, 2)}
            </p>
            <p>
              <strong>Heading:</strong> {formatNullableNumber(coords.heading, 2)}
            </p>
            <p>
              <strong>Speed (m/s):</strong> {formatNullableNumber(coords.speed, 2)}
            </p>
            <p>
              <strong>Captured at:</strong> {new Date(coords.timestamp).toLocaleString()}
            </p>
          </div>

          <a
            href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            Open this point in Google Maps
          </a>
        </section>
      )}

      {address && (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="text-lg font-medium">Resolved Address</h2>
          {address.error ? (
            <>
              <p className="mt-2 text-sm text-red-700">{address.error}</p>
              {address.details ? (
                <p className="mt-1 text-xs text-muted-foreground">{address.details}</p>
              ) : null}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm">
                <strong>Display name:</strong> {address.display_name || "N/A"}
              </p>
              {address.provider ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  <strong>Provider:</strong> {address.provider}
                </p>
              ) : null}
              {placeHierarchy.length > 0 ? (
                <div className="mt-3 rounded-md bg-muted/50 p-3">
                  <h3 className="text-sm font-medium">Place Hierarchy</h3>
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    {placeHierarchy.map((item) => (
                      <p key={item.label}>
                        <strong>{item.label}:</strong> {item.value}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {Object.entries(address.address || {}).map(([key, value]) => (
                  <p key={key}>
                    <strong>{key.replace(/_/g, " ")}:</strong> {value}
                  </p>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {(coords || nearbyError) && (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="text-lg font-medium">Nearby Places (Deep Names)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Examples: malls, bus stops, lodges, landmarks, shops, and other named places around you.
          </p>

          {nearbyError ? (
            <p className="mt-2 text-sm text-red-700">{nearbyError}</p>
          ) : null}

          {!nearbyError && nearbyPlaces.length === 0 && coords ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No named nearby places found in the current radius.
            </p>
          ) : null}

          {nearbyPlaces.length > 0 ? (
            <div className="mt-3 space-y-2">
              {nearbyPlaces.map((place) => (
                <div key={`${place.id}-${place.name}`} className="rounded-md bg-muted/40 p-3 text-sm">
                  <p>
                    <strong>{place.name}</strong> - {place.category.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Distance: {place.distance_m} m
                    {place.suburb ? ` | ${place.suburb}` : ""}
                    {place.road ? ` | ${place.road}` : ""}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${place.lat},${place.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                  >
                    Open place on map
                  </a>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {address && (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="text-lg font-medium">Raw API Response</h2>
          <pre className="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs">
            {JSON.stringify(address, null, 2)}
          </pre>
        </section>
      )}
    </main>
  )
}
