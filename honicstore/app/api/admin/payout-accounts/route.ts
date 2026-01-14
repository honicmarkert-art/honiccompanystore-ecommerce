import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { decryptPayoutAccount } from '@/lib/payout-encryption'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData } from '@/lib/database-optimization'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// GET /api/admin/payout-accounts - Fetch all payout accounts (decrypted) for admin view
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_payout_accounts_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/payout-accounts',
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

      // Get query parameters for filtering
      const { searchParams } = new URL(request.url)
      const supplierId = searchParams.get('supplier_id')
      const accountType = searchParams.get('account_type')

      // Generate cache key based on filters
      const cacheKey = `admin_payout_accounts_${supplierId || 'all'}_${accountType || 'all'}`
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'private, max-age=120' // 2 minutes cache
          }
        })
      }

      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_payout_accounts_get',
          endpoint: '/api/admin/payout-accounts'
        })
        return authError
      }

      const adminSupabase = createAdminSupabaseClient()

      // Build query
      let query = adminSupabase
        .from('supplier_payout_accounts')
        .select(`
          *,
          profiles!supplier_payout_accounts_supplier_id_fkey (
            id,
            full_name,
            company_name,
            email,
            phone,
            is_active
          )
        `)
        .order('created_at', { ascending: false })

      // Apply filters
      if (supplierId) {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(supplierId)) {
          return NextResponse.json({ error: 'Invalid supplier ID format' }, { status: 400 })
        }
        query = query.eq('supplier_id', supplierId)
      }
      if (accountType) {
        query = query.eq('account_type', accountType)
      }

      const { data: accounts, error: accountsError } = await query

      if (accountsError) {
        logError(accountsError, {
          userId: user.id,
          action: 'admin_payout_accounts_get',
          endpoint: '/api/admin/payout-accounts'
        })
        return createErrorResponse(accountsError, 500)
      }

      // Decrypt sensitive fields for admin view
      const decryptedAccounts = (accounts || []).map((account: any) => {
        const decrypted = decryptPayoutAccount(account)
        return {
          ...decrypted,
          supplier: account.profiles
        }
      })

      const responseData = {
        success: true,
        accounts: decryptedAccounts,
        count: decryptedAccounts.length
      }

      // Cache response (2 minutes TTL)
      setCachedData(cacheKey, responseData, 120000)

      return NextResponse.json(responseData, {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'private, max-age=120'
        }
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_payout_accounts_get',
        endpoint: '/api/admin/payout-accounts'
      })
      return createErrorResponse(error, 500)
    }
  })
}
