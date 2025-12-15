import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { sendAbandonedCartEmail } from '@/lib/user-email-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/cron/check-abandoned-carts - Background job to check and send abandoned cart emails
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminSupabaseClient()

    // Get abandoned carts older than 24 hours that haven't been sent
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: carts, error: fetchError } = await supabase
      .from('abandoned_carts')
      .select('*')
      .eq('recovered', false)
      .eq('email_sent', false)
      .lt('created_at', twentyFourHoursAgo)
      .limit(50) // Process in batches

    if (fetchError) {
      logger.error('Error fetching abandoned carts:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch abandoned carts' }, { status: 500 })
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
          cartUrl: (() => {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')
            return baseUrl ? `${baseUrl}/cart` : ''
          })()
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
      processed: carts?.length || 0,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    })

  } catch (error: any) {
    logger.error('Error in check-abandoned-carts cron:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



