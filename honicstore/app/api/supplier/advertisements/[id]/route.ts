import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { clearCache } from '@/lib/database-optimization'
import { createErrorResponse, logError } from '@/lib/error-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// DELETE - Delete supplier's advertisement
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return performanceMonitor.measure('supplier_advertisements_delete_by_id', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/advertisements/[id]',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { success: false, error: rateLimitResult.reason },
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
        )
      }
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', undefined, {
          endpoint: '/api/supplier/advertisements/[id]',
          action: 'DELETE',
          advertisementId: params.id
        })
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const adId = params.id

      // Verify supplier owns this advertisement
      const { data: ad, error: adError } = await supabase
        .from('advertisements')
        .select('supplier_id, media_url')
        .eq('id', adId)
        .single()

      if (adError || !ad) {
        return NextResponse.json(
          { success: false, error: 'Advertisement not found' },
          { status: 404 }
        )
      }

      if (ad.supplier_id !== user.id) {
        logSecurityEvent('FORBIDDEN_ACCESS_ATTEMPT', user.id, {
          endpoint: '/api/supplier/advertisements/[id]',
          action: 'DELETE',
          advertisementId: adId,
          reason: 'Advertisement ownership mismatch'
        })
        return NextResponse.json(
          { success: false, error: 'Access denied. You can only delete your own advertisements.' },
          { status: 403 }
        )
      }

    // Use service role key for storage operations
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Delete media file from storage
    if (ad.media_url) {
      const urlParts = ad.media_url.split('/advertisements/')
      if (urlParts.length > 1) {
        const filePath = `advertisements/${urlParts[1]}`
        await supabaseService.storage
          .from('advertisements')
          .remove([filePath])
      }
    }

    // Delete from database
    const { error: deleteError } = await supabaseService
      .from('advertisements')
      .delete()
      .eq('id', adId)

      if (deleteError) {
        logError(deleteError, {
          context: 'supplier_advertisements_delete_by_id',
          userId: user.id,
          advertisementId: adId
        })
        return createErrorResponse(deleteError, 'Failed to delete advertisement', 500)
      }

      // Clear cache
      clearCache()

      logSecurityEvent('SUPPLIER_ADVERTISEMENT_DELETED', user.id, {
        advertisementId: adId,
        endpoint: '/api/supplier/advertisements/[id]'
      })

      return NextResponse.json({
        success: true,
        message: 'Advertisement deleted successfully'
      })

    } catch (error: any) {
      logError(error, {
        context: 'supplier_advertisements_delete_by_id'
      })
      return createErrorResponse(error, 'An unexpected error occurred', 500)
    }
  })
}




