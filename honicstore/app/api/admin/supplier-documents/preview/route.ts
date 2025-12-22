import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/admin-auth'

export const runtime = 'nodejs'

// GET /api/admin/supplier-documents/preview?url=<encoded-storage-url>
// Proxies supplier document files so they can be embedded in an <iframe> without being blocked.
export async function GET(request: NextRequest) {
  try {
    // Ensure only admins can use this proxy
    const { error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json(
        { error: 'Missing "url" query parameter' },
        { status: 400 }
      )
    }

    // Fetch the upstream document (PDF/image) from Supabase Storage or other origin
    const upstreamResponse = await fetch(url)

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch document', status: upstreamResponse.status },
        { status: 502 }
      )
    }

    const contentType =
      upstreamResponse.headers.get('content-type') || 'application/octet-stream'

    const buffer = await upstreamResponse.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Inline so browser uses its PDF viewer inside the iframe
        'Content-Disposition': 'inline',
        // Do NOT set X-Frame-Options here so it can be embedded
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}








