import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.1-flash-lite-preview",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
].filter((model, index, all): model is string => Boolean(model) && all.indexOf(model) === index)

const limits = new Map<string, { count: number; reset: number }>()

function allow(request: NextRequest): boolean {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const now = Date.now()
  const entry = limits.get(ip)
  if (!entry || entry.reset <= now) {
    limits.set(ip, { count: 1, reset: now + 60_000 })
    return true
  }
  entry.count += 1
  return entry.count <= 12
}

function readImage(value: unknown): { mimeType: string; data: string } | null {
  if (!value || typeof value !== "object") return null
  const raw = value as { mimeType?: unknown; data?: unknown }
  let mimeType = String(raw.mimeType || "").toLowerCase()
  let data = String(raw.data || "").trim()
  const packed = data.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i)
  if (packed) {
    mimeType = packed[1].toLowerCase()
    data = packed[2]
  }
  data = data.replace(/\s/g, "")
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)) return null
  if (data.length < 80 || data.length > 6_000_000 || !/^[A-Za-z0-9+/=]+$/.test(data)) return null
  return { mimeType, data }
}

function cleanQuery(value: string): string {
  return value.replace(/[^A-Za-z0-9 .+/-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)
}

export async function POST(request: NextRequest) {
  try {
    if (!allow(request)) {
      return NextResponse.json({ error: "Too many photo searches. Wait a minute and try again." }, { status: 429 })
    }
    const key = process.env.GEMINI_API_KEY?.trim()
    if (!key) {
      return NextResponse.json({ error: "Photo search is not configured on the server." }, { status: 500 })
    }
    const body = await request.json().catch(() => null)
    const image = readImage(body?.image)
    if (!image) {
      return NextResponse.json({ error: "Drop a JPEG, PNG, or WebP photo." }, { status: 400 })
    }

    const prompt = [
      "Identify the product in this photo for an electronics store search.",
      "Read any printed label or part number.",
      "Reply with JSON only: {\"query\":\"short product name\"}.",
      "Use a few words a shopper would type, such as LDR, Arduino Uno, or DHT22 sensor.",
      "Do not include a price, a sentence, or a brand you cannot see.",
    ].join(" ")

    let lastMessage = "Could not read that photo"
    for (const model of MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: image.mimeType, data: image.data } },
              ],
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 120, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(30000),
        }
      )
      const payload = await response.json().catch(() => null) as {
        error?: { message?: string }
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      } | null
      if (!response.ok) {
        lastMessage = payload?.error?.message || lastMessage
        if (response.status !== 404 && response.status !== 400) break
        continue
      }
      const text = (payload?.candidates || []).flatMap((candidate) => candidate.content?.parts || []).map((part) => part.text || "").join("")
      const start = text.indexOf("{")
      const end = text.lastIndexOf("}")
      if (start < 0 || end <= start) continue
      let parsed: { query?: unknown }
      try {
        parsed = JSON.parse(text.slice(start, end + 1)) as { query?: unknown }
      } catch {
        continue
      }
      const query = cleanQuery(String(parsed.query || ""))
      if (query.length < 2) continue
      return NextResponse.json({ query })
    }
    return NextResponse.json({ error: lastMessage }, { status: 502 })
  } catch {
    return NextResponse.json({ error: "Could not read that photo." }, { status: 500 })
  }
}
