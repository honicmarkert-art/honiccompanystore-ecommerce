import { NextRequest, NextResponse } from 'next/server'

const IMAGE_FETCH_TIMEOUT = 15000 // 15 seconds
const MAX_RETRIES = 2
const MAX_BYTES = 15 * 1024 * 1024

/** https + our Supabase host (or *.supabase.co) + public storage path only. */
function isAllowedImageUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false
  const ownHost = (() => {
    try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname } catch { return '' }
  })()
  const hostOk = (ownHost && u.hostname === ownHost) || u.hostname.endsWith('.supabase.co')
  return hostOk && u.pathname.startsWith('/storage/v1/object/public/')
}

async function fetchImageWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'error', // never follow a redirect to another host
      headers: {
        'Accept': 'image/*',
      },
    })
    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Image fetch timeout')
    }
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

    // Only our Supabase public storage. Parsed properly — the old substring check
    // ("contains supabase.co") let any URL through, e.g. https://evil.example/?x=supabase.co,
    // turning this route into an open proxy (SSRF + serving foreign HTML from our domain).
    if (!isAllowedImageUrl(imageUrl)) {
      return NextResponse.json(
        { error: 'Invalid image source' },
        { status: 403 }
      )
    }

    // Try fetching with retries
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetchImageWithTimeout(imageUrl, IMAGE_FETCH_TIMEOUT)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // Images only (never pass HTML/JS through), with a size cap
        const contentType = (response.headers.get('content-type') || '').toLowerCase()
        if (!contentType.startsWith('image/') || contentType.includes('svg')) {
          return NextResponse.json({ error: 'Not an image' }, { status: 415 })
        }
        const declared = Number(response.headers.get('content-length') || 0)
        if (declared > MAX_BYTES) {
          return NextResponse.json({ error: 'Image too large' }, { status: 413 })
        }
        const imageBuffer = await response.arrayBuffer()
        if (imageBuffer.byteLength > MAX_BYTES) {
          return NextResponse.json({ error: 'Image too large' }, { status: 413 })
        }

        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      } catch (error: any) {
        lastError = error
        // Wait before retry (exponential backoff)
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }
    }

    // All retries failed
    return NextResponse.json(
      { error: `Failed to fetch image: ${lastError?.message || 'Unknown error'}` },
      { status: 504 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



















