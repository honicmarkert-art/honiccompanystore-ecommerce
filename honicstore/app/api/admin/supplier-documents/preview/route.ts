import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { sanitizeString } from '@/lib/validation'

export const runtime = 'nodejs'

// GET /api/admin/supplier-documents/preview?url=<encoded-storage-url>
// Proxies supplier document files so they can be embedded in an <iframe> without being blocked.
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_supplier_documents_preview_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/supplier-documents/preview',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
            }
          }
        )
      }

      // Ensure only admins can use this proxy
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_supplier_documents_preview_get',
          endpoint: '/api/admin/supplier-documents/preview'
        })
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

      // Validate and sanitize URL
      const sanitizedUrl = sanitizeString(url)
      if (!sanitizedUrl.startsWith('http://') && !sanitizedUrl.startsWith('https://')) {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        )
      }

      // Only allow Supabase storage URLs for security
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      if (!sanitizedUrl.includes(supabaseUrl.replace('https://', '').replace('http://', ''))) {
        return NextResponse.json(
          { error: 'URL must be from Supabase storage' },
          { status: 403 }
        )
      }

      // Fetch the upstream document (PDF/image) from Supabase Storage or other origin
      const upstreamResponse = await fetch(sanitizedUrl)

      if (!upstreamResponse.ok) {
        logError(new Error(`Failed to fetch document: ${upstreamResponse.status}`), {
          userId: user.id,
          action: 'admin_supplier_documents_preview_get',
          endpoint: '/api/admin/supplier-documents/preview',
          metadata: { url: sanitizedUrl.substring(0, 50) + '...' }
        })
        return NextResponse.json(
          { error: 'Failed to fetch document', status: upstreamResponse.status },
          { status: 502 }
        )
      }

      const contentType =
        upstreamResponse.headers.get('content-type') || 'application/octet-stream'

      // Validate content type (only allow safe document types)
      const allowedTypes = ['application/pdf', 'image/', 'text/']
      const isAllowed = allowedTypes.some(type => contentType.includes(type))
      if (!isAllowed) {
        return NextResponse.json(
          { error: 'Unsupported content type' },
          { status: 400 }
        )
      }

      const buffer = await upstreamResponse.arrayBuffer()

      // Log access
      logSecurityEvent('SUPPLIER_DOCUMENT_VIEWED', user.id, {
        url: sanitizedUrl.substring(0, 50) + '...',
        contentType,
        endpoint: '/api/admin/supplier-documents/preview'
      })

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
      logError(error, {
        action: 'admin_supplier_documents_preview_get',
        endpoint: '/api/admin/supplier-documents/preview'
      })
      return createErrorResponse(error, 500)
    }
  })
}
