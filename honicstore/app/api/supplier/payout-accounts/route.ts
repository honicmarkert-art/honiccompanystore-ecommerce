import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseClient } from '@/lib/supabase-server'
import { encryptPayoutAccount, decryptPayoutAccount } from '@/lib/payout-encryption'
import { cookies } from 'next/headers'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/supplier/payout-accounts - Get all payout accounts for the supplier
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
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
      return NextResponse.json(
        { success: false, error: 'User is not a supplier' },
        { status: 403, headers }
      )
    }

    // Fetch payout accounts
    const { data: accounts, error: accountsError } = await adminSupabase
      .from('supplier_payout_accounts')
      .select('*')
      .eq('supplier_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (accountsError) {
      logger.error('Error fetching payout accounts:', accountsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payout accounts' },
        { status: 500, headers }
      )
    }

    // Decrypt sensitive fields before returning to client
    const decryptedAccounts = (accounts || []).map(account => decryptPayoutAccount(account))

    return NextResponse.json({
      success: true,
      accounts: decryptedAccounts
    })
  } catch (error: any) {
    logger.error('Error in GET /api/supplier/payout-accounts:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// POST /api/supplier/payout-accounts - Create a new payout account
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
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
      logger.error('Error creating payout account:', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create payout account' },
        { status: 500, headers }
      )
    }

    // Decrypt sensitive fields before returning to client
    const decryptedAccount = decryptPayoutAccount(account)

    return NextResponse.json({
      success: true,
      account: decryptedAccount
    })
  } catch (error: any) {
    logger.error('Error in POST /api/supplier/payout-accounts:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

