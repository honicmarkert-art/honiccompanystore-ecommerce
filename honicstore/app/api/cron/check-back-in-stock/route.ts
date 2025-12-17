import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { sendBackInStockEmail } from '@/lib/user-email-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/cron/check-back-in-stock - Background job to check back in stock notifications
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminSupabaseClient()

    // Get pending notifications for products that are now in stock
    const { data: notifications, error: fetchError } = await supabase
      .from('back_in_stock_notifications')
      .select(`
        *,
        products (
          id,
          name,
          image,
          price,
          in_stock,
          stock_quantity,
          slug
        ),
        profiles (
          id,
          email,
          full_name
        )
      `)
      .eq('email_sent', false)
      .limit(100) // Process in batches

    if (fetchError) {
      logger.error('Error fetching notifications:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    const results = []
    for (const notification of notifications || []) {
      try {
        const product = notification.products as any
        const profile = notification.profiles as any

        if (!product) {
          continue
        }

        // Get user email - Priority: auth user email, then profile email
        let userEmail: string | null = null
        
        if (notification.user_id) {
          try {
            const { data: { user: authUser } } = await supabase.auth.admin.getUserById(notification.user_id)
            if (authUser?.email) {
              userEmail = authUser.email
            }
          } catch (authError) {
            logger.warn(`Failed to get auth email for user ${notification.user_id}:`, authError)
          }
        }
        
        // Fallback to profile email
        if (!userEmail) {
          userEmail = profile?.email || null
        }

        if (!userEmail) {
          continue
        }

        // Check if product is now in stock
        if (product.in_stock && (product.stock_quantity || 0) > 0) {
          // Send email
          const emailResult = await sendBackInStockEmail(userEmail, {
            name: product.name,
            image: product.image || '',
            price: product.price,
            productUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://honiccompanystore.com'}/products/${product.slug || product.id}`,
            stockQuantity: product.stock_quantity
          })

          if (emailResult.success) {
            // Update notification
            await supabase
              .from('back_in_stock_notifications')
              .update({
                email_sent: true,
                sent_at: new Date().toISOString()
              })
              .eq('id', notification.id)

            // Log email
            await supabase
              .from('email_logs')
              .insert({
                user_id: notification.user_id,
                email: userEmail,
                email_type: 'back_in_stock',
                subject: `Back in Stock: ${product.name}`,
                status: 'sent',
                message_id: emailResult.messageId,
                metadata: { 
                  notification_id: notification.id,
                  product_id: product.id,
                  stock_quantity: product.stock_quantity
                }
              })

            results.push({ notificationId: notification.id, success: true })
          } else {
            results.push({ notificationId: notification.id, success: false, error: emailResult.error })
          }
        }
      } catch (error: any) {
        logger.error(`Error processing notification ${notification.id}:`, error)
        results.push({ notificationId: notification.id, success: false, error: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      processed: notifications?.length || 0,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    })

  } catch (error: any) {
    logger.error('Error in check-back-in-stock cron:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



