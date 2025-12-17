import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/admin-auth'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { sendAbandonedCartEmail } from '@/lib/user-email-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/emails/abandoned-carts - Get abandoned carts
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const recovered = searchParams.get('recovered') === 'true'

    let query = supabase
      .from('abandoned_carts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (recovered !== null) {
      query = query.eq('recovered', recovered)
    }

    const { data: carts, error, count } = await query

    if (error) {
      logger.error('Error fetching abandoned carts:', error)
      return NextResponse.json({ error: 'Failed to fetch abandoned carts' }, { status: 500 })
    }

    // Get user emails for carts with user_id
    const userIds = [...new Set((carts || []).map((c: any) => c.user_id).filter(Boolean))]
    const userEmails: Record<string, string> = {}

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)

      users?.forEach((u: any) => {
        userEmails[u.id] = u.email
      })
    }

    const enrichedCarts = (carts || []).map((cart: any) => ({
      ...cart,
      user_email: cart.user_id ? userEmails[cart.user_id] : null
    }))

    return NextResponse.json({
      carts: enrichedCarts,
      pagination: {
        limit,
        offset,
        total: count || 0
      }
    })

  } catch (error: any) {
    logger.error('Error in abandoned carts GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/emails/abandoned-carts/send - Send abandoned cart emails
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    const { cartId, cartIds } = body

    const cartIdsToProcess = cartId ? [cartId] : (cartIds || [])

    if (cartIdsToProcess.length === 0) {
      return NextResponse.json({ error: 'Cart ID(s) required' }, { status: 400 })
    }

    const { data: carts, error: fetchError } = await supabase
      .from('abandoned_carts')
      .select('*')
      .in('id', cartIdsToProcess)
      .eq('recovered', false)

    if (fetchError) {
      logger.error('Error fetching carts:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch carts' }, { status: 500 })
    }

    const results = []
    for (const cart of carts || []) {
      try {
        // Get user email - Priority: auth user email, then profile email
        let userEmail: string | null = null
        
        if (cart.user_id) {
          try {
            const { data: { user: authUser } } = await supabase.auth.admin.getUserById(cart.user_id)
            if (authUser?.email) {
              userEmail = authUser.email
            }
          } catch (authError) {
            logger.warn(`Failed to get auth email for user ${cart.user_id}:`, authError)
            // Fallback to profile email
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', cart.user_id)
              .single()
            userEmail = profile?.email || null
          }
        }

        if (!userEmail) {
          results.push({ cartId: cart.id, success: false, error: 'No user email found' })
          continue
        }

        // Parse cart data
        const cartData = typeof cart.cart_data === 'string' 
          ? JSON.parse(cart.cart_data) 
          : cart.cart_data

        const items = cartData.items || []
        const total = cart.total_amount || cartData.total || 0

        // Send email
        const emailResult = await sendAbandonedCartEmail(userEmail, {
          items: items.map((item: any) => ({
            name: item.product?.name || item.name || 'Product',
            quantity: item.quantity || 1,
            price: item.price || 0,
            image: item.product?.image || item.image
          })),
          total,
          cartUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://honiccompanystore.com'}/cart`
        })

        if (emailResult.success) {
          // Update cart record
          await supabase
            .from('abandoned_carts')
            .update({
              email_sent: true,
              emails_sent_count: (cart.emails_sent_count || 0) + 1,
              last_email_sent_at: new Date().toISOString()
            })
            .eq('id', cart.id)

          // Log email
          await supabase
            .from('email_logs')
            .insert({
              user_id: cart.user_id,
              email: userEmail,
              email_type: 'abandoned_cart',
              subject: "Don't Forget Your Cart!",
              status: 'sent',
              message_id: emailResult.messageId,
              metadata: { cart_id: cart.id }
            })

          results.push({ cartId: cart.id, success: true })
        } else {
          results.push({ cartId: cart.id, success: false, error: emailResult.error })
        }
      } catch (error: any) {
        logger.error(`Error processing cart ${cart.id}:`, error)
        results.push({ cartId: cart.id, success: false, error: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    })

  } catch (error: any) {
    logger.error('Error in abandoned carts send POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



