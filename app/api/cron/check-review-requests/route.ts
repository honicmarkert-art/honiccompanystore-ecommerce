import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { sendReviewRequestEmail } from '@/lib/user-email-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/cron/check-review-requests - Background job to send review request emails
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminSupabaseClient()

    // Get orders delivered 7 days ago that haven't received review requests
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: deliveredOrders, error: ordersError } = await supabase
      .from('confirmed_orders')
      .select(`
        id,
        order_number,
        user_id,
        status,
        updated_at,
        profiles (
          id,
          email,
          full_name
        )
      `)
      .eq('status', 'delivered')
      .lt('updated_at', sevenDaysAgo)
      .limit(50)

    if (ordersError) {
      logger.error('Error fetching delivered orders:', ordersError)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    const results = []
    for (const order of deliveredOrders || []) {
      try {
        // Get user email - Priority: auth user email, then profile email
        let userEmail: string | null = null
        
        if (order.user_id) {
          try {
            const { data: { user: authUser } } = await supabase.auth.admin.getUserById(order.user_id)
            if (authUser?.email) {
              userEmail = authUser.email
            }
          } catch (authError) {
            logger.warn(`Failed to get auth email for user ${order.user_id}:`, authError)
          }
        }
        
        // Fallback to profile email
        if (!userEmail) {
          const profile = order.profiles as any
          userEmail = profile?.email || null
        }
        
        if (!userEmail) continue

        // Get order items
        const { data: orderItems } = await supabase
          .from('confirmed_order_items')
          .select(`
            product_id,
            product_name,
            products (
              id,
              name,
              image,
              slug
            )
          `)
          .eq('confirmed_order_id', order.id)

        // Send review request for each product
        for (const item of orderItems || []) {
          const product = item.products as any
          if (!product) continue

          // Check if review request already sent
          const { data: existing } = await supabase
            .from('review_requests')
            .select('id')
            .eq('order_id', order.id)
            .eq('product_id', product.id)
            .single()

          if (existing) continue

          // Create review request record
          const { data: reviewRequest } = await supabase
            .from('review_requests')
            .insert({
              user_id: order.user_id,
              order_id: order.id,
              order_number: order.order_number,
              product_id: product.id
            })
            .select()
            .single()

          // Send email
          const emailResult = await sendReviewRequestEmail(userEmail, {
            orderNumber: order.order_number,
            productName: product.name,
            productImage: product.image || '',
            productUrl: (() => {
              const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')
              return baseUrl ? `${baseUrl}/products/${product.slug || product.id}` : ''
            })(),
            reviewUrl: (() => {
              const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')
              return baseUrl ? `${baseUrl}/account/orders/${order.order_number}/review?product=${product.id}` : ''
            })()
          })

          if (emailResult.success && reviewRequest) {
            // Update review request
            await supabase
              .from('review_requests')
              .update({
                email_sent: true,
                sent_at: new Date().toISOString()
              })
              .eq('id', reviewRequest.id)

            // Log email
            await supabase
              .from('email_logs')
              .insert({
                user_id: order.user_id,
                email: userEmail,
                email_type: 'review_request',
                subject: `How Was Your Purchase? Review Order #${order.order_number}`,
                status: 'sent',
                message_id: emailResult.messageId,
                metadata: { 
                  review_request_id: reviewRequest.id,
                  order_id: order.id,
                  product_id: product.id
                }
              })

            results.push({ 
              orderId: order.id, 
              productId: product.id,
              success: true 
            })
          } else {
            results.push({ 
              orderId: order.id, 
              productId: product.id,
              success: false, 
              error: emailResult.error 
            })
          }
        }
      } catch (error: any) {
        logger.error(`Error processing order ${order.id}:`, error)
        results.push({ orderId: order.id, success: false, error: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      processed: deliveredOrders?.length || 0,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    })

  } catch (error: any) {
    logger.error('Error in check-review-requests cron:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



