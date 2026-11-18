import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.1-flash-lite-preview",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
].filter((model, index, all): model is string => Boolean(model) && all.indexOf(model) === index)

function readImage(value: string): { mimeType: string; data: string } | null {
  const match = value.match(/^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i)
  if (!match) return null
  const data = match[2].replace(/\s/g, "")
  if (data.length < 80 || data.length > 5_500_000) return null
  const mimeType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase()
  return { mimeType, data }
}

function searchQuery(raw: string): string {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) return ""
  const parsed = JSON.parse(raw.slice(start, end + 1)) as { query?: unknown; terms?: unknown }
  const query = typeof parsed.query === "string" ? parsed.query.trim() : ""
  const terms = Array.isArray(parsed.terms) ? parsed.terms.filter((term): term is string => typeof term === "string") : []
  const phrase = [query, ...terms].map((part) => part.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim()).find((part) => part.length >= 3)
  return (phrase || "").slice(0, 80)
}

async function askGemini(model: string, key: string, image: { mimeType: string; data: string }, jsonMode: boolean) {
  const generationConfig: Record<string, unknown> = { temperature: 0.1, maxOutputTokens: 256 }
  if (jsonMode) generationConfig.responseMimeType = "application/json"
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: "Look at this photo and name the product a shopper would search for in an electronics and general store. Reply with JSON only: {\"query\":\"short product name\",\"terms\":[\"search word\"]}. Use English words such as resistor, arduino, or phone case. Do not include a price.",
            },
            { inline_data: { mime_type: image.mimeType, data: image.data } },
          ],
        }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(30000),
    }
  )
  const body = await response.json().catch(() => null) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null
  if (!response.ok) return ""
  return (body?.candidates || []).flatMap((candidate) => candidate.content?.parts || []).map((part) => part.text || "").join("").trim()
}

export async function POST(request: NextRequest) {
  try {
    const key = process.env.GEMINI_API_KEY?.trim()
    if (!key) return NextResponse.json({ error: "Product search by photo is not configured" }, { status: 500 })

    const body = await request.json().catch(() => null)
    const image = readImage(String(body?.image || ""))
    if (!image) return NextResponse.json({ error: "Add a JPG, PNG, WEBP, or GIF photo under 4 MB" }, { status: 400 })

    let query = ""
    for (const model of MODELS) {
      const text = await askGemini(model, key, image, true)
      query = text ? searchQuery(text) : ""
      if (!query) {
        const plain = await askGemini(model, key, image, false)
        query = plain ? searchQuery(plain) : ""
      }
      if (query) break
    }
    if (!query) return NextResponse.json({ error: "The photo could not be matched to a product name" }, { status: 422 })
    return NextResponse.json({ query })
  } catch {
    return NextResponse.json({ error: "Could not read that photo" }, { status: 500 })
  }
}
