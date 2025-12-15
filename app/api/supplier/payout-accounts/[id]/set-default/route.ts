import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseClient } from '@/lib/supabase-server'
import { decryptPayoutAccount } from '@/lib/payout-encryption'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// POST /api/supplier/payout-accounts/[id]/set-default - Set a payout account as default
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await params
    const adminSupabase = getSupabaseClient()

    // Verify account belongs to user
    const { data: account, error: accountError } = await adminSupabase
      .from('supplier_payout_accounts')
      .select('*')
      .eq('id', id)
      .eq('supplier_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    // Unset all other default accounts
    await adminSupabase
      .from('supplier_payout_accounts')
      .update({ is_default: false })
      .eq('supplier_id', user.id)
      .eq('is_default', true)

    // Set this account as default
    const { data: updatedAccount, error: updateError } = await adminSupabase
      .from('supplier_payout_accounts')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error setting default account:', updateError)
      return NextResponse.json(
        { error: 'Failed to set default account', details: updateError.message },
        { status: 500 }
      )
    }

    // Decrypt sensitive fields before returning to client
    const decryptedAccount = decryptPayoutAccount(updatedAccount)

    return NextResponse.json({
      success: true,
      account: decryptedAccount
    })
  } catch (error: any) {
    console.error('Error in POST /api/supplier/payout-accounts/[id]/set-default:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

