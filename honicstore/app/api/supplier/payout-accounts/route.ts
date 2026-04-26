import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseClient } from '@/lib/supabase-server'
import { encryptPayoutAccount, decryptPayoutAccount } from '@/lib/payout-encryption'
import { cookies } from 'next/headers'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData, CACHE_TTL, generateCacheKey, clearCache } from '@/lib/database-optimization'
import { createErrorResponse, logError } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/supplier/payout-accounts - Get all payout accounts for the supplier
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('supplier_payout_accounts_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = await enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/payout-accounts',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { success: false, error: rateLimitResult.reason },
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60', 'Content-Type': 'application/json' } }
        )
      }

    const headers = { 'Content-Type': 'application/json' }
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers }
      )
    }

    const adminSupabase = getSupabaseClient()

    // Verify user is a supplier
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('is_supplier')
      .eq('id', user.id)
      .single()

      if (!profile?.is_supplier) {
        logSecurityEvent('FORBIDDEN_ACCESS_ATTEMPT', user.id, {
          endpoint: '/api/supplier/payout-accounts',
          action: 'GET',
          reason: 'Not a supplier'
        })
        return NextResponse.json(
          { success: false, error: 'User is not a supplier' },
          { status: 403, headers }
        )
      }

      // Check cache
      const cacheKey = generateCacheKey('supplier_payout_accounts', { supplierId: user.id })
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData) {
        return NextResponse.json({
          success: true,
          accounts: cachedData.accounts || [],
          cached: true
        })
      }

      // Fetch payout accounts
      const { data: accounts, error: accountsError } = await adminSupabase
        .from('supplier_payout_accounts')
        .select('*')
        .eq('supplier_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (accountsError) {
        logError(accountsError, {
          context: 'supplier_payout_accounts_get',
          userId: user.id
        })
        return createErrorResponse(accountsError, 'Failed to fetch payout accounts', 500)
      }

      // Decrypt sensitive fields before returning to client
      const decryptedAccounts = (accounts || []).map(account => decryptPayoutAccount(account))

      const responseData = {
        accounts: decryptedAccounts
      }

      // Cache response (15 minutes TTL)
      setCachedData(cacheKey, responseData, CACHE_TTL.USER_PROFILE)

      return NextResponse.json({
        success: true,
        ...responseData
      })
    } catch (error: any) {
      logError(error, {
        context: 'supplier_payout_accounts_get'
      })
      return createErrorResponse(error, 'Internal server error', 500)
    }
  })
}

// POST /api/supplier/payout-accounts - Create a new payout account
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('supplier_payout_accounts_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = await enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/payout-accounts',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { success: false, error: rateLimitResult.reason },
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60', 'Content-Type': 'application/json' } }
        )
      }

    const headers = { 'Content-Type': 'application/json' }
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      account_type,
      account_name,
      account_number,
      bank_name,
      mobile_provider,
      mobile_number,
      paypal_email,
      is_default
    } = body

    // Validation
    if (!account_type || !['bank', 'mobile_money', 'paypal'].includes(account_type)) {
      return NextResponse.json(
        { error: 'Invalid account type' },
        { status: 400 }
      )
    }

    if (!account_name || !account_name.trim()) {
      return NextResponse.json(
        { error: 'Account name is required' },
        { status: 400 }
      )
    }

    if (account_type === 'bank' && (!account_number || !bank_name)) {
      return NextResponse.json(
        { error: 'Account number and bank name are required for bank accounts' },
        { status: 400 }
      )
    }

    if (account_type === 'mobile_money' && (!mobile_provider || !mobile_number)) {
      return NextResponse.json(
        { error: 'Mobile provider and mobile number are required for mobile money accounts' },
        { status: 400 }
      )
    }

    if (account_type === 'paypal' && !paypal_email) {
      return NextResponse.json(
        { error: 'PayPal email is required for PayPal accounts' },
        { status: 400 }
      )
    }

    const adminSupabase = getSupabaseClient()

    // Verify user is a supplier
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('is_supplier')
      .eq('id', user.id)
      .single()

      if (!profile?.is_supplier) {
        logSecurityEvent('FORBIDDEN_ACCESS_ATTEMPT', user.id, {
          endpoint: '/api/supplier/payout-accounts',
          action: 'POST',
          reason: 'Not a supplier'
        })
        return NextResponse.json(
          { error: 'User is not a supplier' },
          { status: 403 }
        )
      }

    // If setting as default, unset other default accounts
    if (is_default) {
      await adminSupabase
        .from('supplier_payout_accounts')
        .update({ is_default: false })
        .eq('supplier_id', user.id)
        .eq('is_default', true)
    }

    // Create the payout account - encrypt sensitive data before storing
    const accountData: any = {
      supplier_id: user.id,
      account_type,
      account_name: account_name.trim(),
      is_default: is_default || false,
      is_verified: false // Accounts need to be verified by admin
    }

    if (account_type === 'bank') {
      accountData.account_number = account_number.trim()
      accountData.bank_name = bank_name.trim()
    } else if (account_type === 'mobile_money') {
      accountData.mobile_provider = mobile_provider.trim()
      accountData.mobile_number = mobile_number.trim()
    } else if (account_type === 'paypal') {
      accountData.paypal_email = paypal_email.trim()
    }

    // Encrypt sensitive fields before storing
    const encryptedAccountData = encryptPayoutAccount(accountData)

    const { data: account, error: createError } = await adminSupabase
      .from('supplier_payout_accounts')
      .insert(encryptedAccountData)
      .select()
      .single()

      if (createError) {
        logError(createError, {
          context: 'supplier_payout_accounts_post',
          userId: user.id,
          accountType: account_type
        })
        return createErrorResponse(createError, 'Failed to create payout account', 500)
      }

      // Clear cache
      clearCache()

      // Decrypt sensitive fields before returning to client
      const decryptedAccount = decryptPayoutAccount(account)

      logSecurityEvent('SUPPLIER_PAYOUT_ACCOUNT_CREATED', user.id, {
        accountId: account.id,
        accountType: account_type,
        endpoint: '/api/supplier/payout-accounts'
      })

      return NextResponse.json({
        success: true,
        account: decryptedAccount
      })
    } catch (error: any) {
      logError(error, {
        context: 'supplier_payout_accounts_post'
      })
      return createErrorResponse(error, 'Internal server error', 500)
    }
  })
}

