import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/admin-auth'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { sendBackInStockEmail } from '@/lib/user-email-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/emails/back-in-stock - Get back in stock notifications
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
    const productId = searchParams.get('productId')
    const sent = searchParams.get('sent')

    let query = supabase
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
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (productId) {
      query = query.eq('product_id', productId)
    }

    if (sent !== null) {
      query = query.eq('email_sent', sent === 'true')
    }

    const { data: notifications, error, count } = await query

    if (error) {
      logger.error('Error fetching back in stock notifications:', error)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    return NextResponse.json({
      notifications: notifications || [],
      pagination: {
        limit,
        offset,
        total: count || 0
      }
    })

  } catch (error: any) {
    logger.error('Error in admin back in stock GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/emails/back-in-stock/check - Check and send back in stock emails
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    const { productId } = body

    // Get pending notifications for products that are now in stock
    let query = supabase
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

    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data: notifications, error: fetchError } = await query

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

            results.push({ 
              notificationId: notification.id, 
              success: true,
              productName: product.name,
              userEmail: profile.email
            })
          } else {
            results.push({ 
              notificationId: notification.id, 
              success: false, 
              error: emailResult.error 
            })
          }
        }
      } catch (error: any) {
        logger.error(`Error processing notification ${notification.id}:`, error)
        results.push({ notificationId: notification.id, success: false, error: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    })

  } catch (error: any) {
    logger.error('Error in back in stock check POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



