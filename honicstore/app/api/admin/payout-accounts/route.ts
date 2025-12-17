import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { decryptPayoutAccount } from '@/lib/payout-encryption'

export const runtime = 'nodejs'

// GET /api/admin/payout-accounts - Fetch all payout accounts (decrypted) for admin view
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const adminSupabase = createAdminSupabaseClient()

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplier_id')
    const accountType = searchParams.get('account_type')

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
      query = query.eq('supplier_id', supplierId)
    }
    if (accountType) {
      query = query.eq('account_type', accountType)
    }

    const { data: accounts, error: accountsError } = await query

    if (accountsError) {
      console.error('[API][Admin][PayoutAccounts] Database error:', accountsError)
      return NextResponse.json(
        { error: 'Failed to fetch payout accounts', details: accountsError.message },
        { status: 500 }
      )
    }

    // Decrypt sensitive fields for admin view
    const decryptedAccounts = (accounts || []).map((account: any) => {
      const decrypted = decryptPayoutAccount(account)
      return {
        ...decrypted,
        supplier: account.profiles
      }
    })

    return NextResponse.json({
      success: true,
      accounts: decryptedAccounts,
      count: decryptedAccounts.length
    })

  } catch (error: any) {
    console.error('[API][Admin][PayoutAccounts] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}


