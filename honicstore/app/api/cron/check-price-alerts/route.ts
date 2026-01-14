import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { sendPriceDropAlertEmail } from '@/lib/user-email-service'
import { buildUrl } from '@/lib/url-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/cron/check-price-alerts - Background job to check price alerts
// This should be called by a cron job or scheduled task
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminSupabaseClient()

    // Get all active price alerts that haven't been sent
    const { data: alerts, error: fetchError } = await supabase
      .from('price_alerts')
      .select(`
        *,
        products (
          id,
          name,
          image,
          price,
          slug
        ),
        profiles (
          id,
          email,
          full_name
        )
      `)
      .eq('is_active', true)
      .eq('email_sent', false)
      .limit(100) // Process in batches

    if (fetchError) {
      logger.error('Error fetching price alerts:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch price alerts' }, { status: 500 })
    }

    const results = []
    for (const alert of alerts || []) {
      try {
        const product = alert.products as any
        const profile = alert.profiles as any

        if (!product) {
          continue
        }

        // Get user email - Priority: auth user email, then profile email
        let userEmail: string | null = null
        
        if (alert.user_id) {
          try {
            const { data: { user: authUser } } = await supabase.auth.admin.getUserById(alert.user_id)
            if (authUser?.email) {
              userEmail = authUser.email
            }
          } catch (authError) {
            logger.warn(`Failed to get auth email for user ${alert.user_id}:`, authError)
          }
        }
        
        // Fallback to profile email
        if (!userEmail) {
          userEmail = profile?.email || null
        }

        if (!userEmail) {
          continue
        }

        const currentPrice = product.price
        const targetPrice = alert.target_price

        // Check if price dropped to or below target
        if (currentPrice <= targetPrice) {
          const originalPrice = alert.current_price || currentPrice
          const discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100)

          // Send email
          const emailResult = await sendPriceDropAlertEmail(userEmail, {
            name: product.name,
            image: product.image || '',
            originalPrice,
            newPrice: currentPrice,
            discountPercent,
            productUrl: buildUrl(`/products/${product.slug || product.id}`),
            targetPrice
          })

          if (emailResult.success) {
            // Update alert
            await supabase
              .from('price_alerts')
              .update({
                email_sent: true,
                sent_at: new Date().toISOString(),
                current_price: currentPrice
              })
              .eq('id', alert.id)

            // Log email
            await supabase
              .from('email_logs')
              .insert({
                user_id: alert.user_id,
                email: userEmail,
                email_type: 'price_alert',
                subject: `Price Drop Alert: ${product.name}`,
                status: 'sent',
                message_id: emailResult.messageId,
                metadata: { 
                  alert_id: alert.id,
                  product_id: product.id,
                  target_price: targetPrice,
                  current_price: currentPrice
                }
              })

            results.push({ alertId: alert.id, success: true })
          } else {
            results.push({ alertId: alert.id, success: false, error: emailResult.error })
          }
        } else {
          // Update current price even if alert not triggered
          await supabase
            .from('price_alerts')
            .update({ current_price: currentPrice })
            .eq('id', alert.id)
        }
      } catch (error: any) {
        logger.error(`Error processing price alert ${alert.id}:`, error)
        results.push({ alertId: alert.id, success: false, error: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      processed: alerts?.length || 0,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    })

  } catch (error: any) {
    logger.error('Error in check-price-alerts cron:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



