import { NextRequest, NextResponse } from 'next/server'

const IMAGE_FETCH_TIMEOUT = 15000 // 15 seconds
const MAX_RETRIES = 2

async function fetchImageWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
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

    // Validate that the URL is from Supabase storage
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    if (!imageUrl.includes('supabase.co') && !imageUrl.includes(supabaseUrl.replace('https://', '').replace('http://', ''))) {
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

        const imageBuffer = await response.arrayBuffer()
        const contentType = response.headers.get('content-type') || 'image/jpeg'

        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
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
    console.error('Image proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}










