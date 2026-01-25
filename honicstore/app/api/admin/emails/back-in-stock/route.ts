import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/admin-auth'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { sendBackInStockEmail } from '@/lib/user-email-service'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData } from '@/lib/database-optimization'
import { logError, createErrorResponse } from '@/lib/error-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/emails/back-in-stock - Get back in stock notifications
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_emails_back_in_stock_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/emails/back-in-stock',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
            }
          }
        )
      }

      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '50')
      const offset = parseInt(searchParams.get('offset') || '0')
      const productId = searchParams.get('productId')
      const sent = searchParams.get('sent')

      // Generate cache key
      const cacheKey = `admin_back_in_stock_${limit}_${offset}_${productId || 'all'}_${sent || 'all'}`
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'private, max-age=60' // 1 minute cache
          }
        })
      }

      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_emails_back_in_stock_get',
          metadata: {
            endpoint: '/api/admin/emails/back-in-stock'
          }
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()

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

      if (sent === 'true') {
        query = query.eq('email_sent', true)
      } else if (sent === 'false') {
        query = query.eq('email_sent', false)
      }

      const { data: notifications, error, count } = await query

      if (error) {
        logError(error, {
          userId: user?.id,
          action: 'admin_emails_back_in_stock_get',
          metadata: {
            endpoint: '/api/admin/emails/back-in-stock'
          }
        })
        return createErrorResponse(error, 500)
      }

      const responseData = {
        notifications: notifications || [],
        pagination: {
          limit,
          offset,
          total: count || 0
        }
      }

      // Cache response (1 minute TTL)
      setCachedData(cacheKey, responseData, 60000)

      return NextResponse.json(responseData, {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'private, max-age=60'
        }
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_emails_back_in_stock_get',
        metadata: {
          endpoint: '/api/admin/emails/back-in-stock'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}

// POST /api/admin/emails/back-in-stock/send - Send back in stock emails
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_emails_back_in_stock_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/emails/back-in-stock',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
            }
          }
        )
      }

      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_emails_back_in_stock_post',
          metadata: {
            endpoint: '/api/admin/emails/back-in-stock'
          }
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()
      const body = await request.json()
      const { productId, notificationIds } = body

      if (!productId && (!notificationIds || notificationIds.length === 0)) {
        return NextResponse.json(
          { error: 'Product ID or notification IDs are required' },
          { status: 400 }
        )
      }

      // Build query
      let query = supabase
        .from('back_in_stock_notifications')
        .select(`
          *,
          products (
            id,
            name,
            image,
            price,
            slug,
            in_stock,
            stock_quantity
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

      if (notificationIds && notificationIds.length > 0) {
        query = query.in('id', notificationIds)
      }

      const { data: notifications, error: fetchError } = await query

      if (fetchError) {
        logError(fetchError, {
          userId: user?.id,
          action: 'admin_emails_back_in_stock_post',
          metadata: {
            endpoint: '/api/admin/emails/back-in-stock'
          }
        })
        return createErrorResponse(fetchError, 500)
      }

      if (!notifications || notifications.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No notifications to send',
          sent: 0,
          failed: 0
        })
      }

      const { buildUrl } = await import('@/lib/url-utils')
      const results = []

      for (const notification of notifications) {
        try {
          const product = notification.products
          const profile = notification.profiles

          if (!product || !profile?.email) {
            results.push({
              notificationId: notification.id,
              success: false,
              error: 'Missing product or user email'
            })
            continue
          }

          // Check if product is actually in stock
          if (!product.in_stock || (product.stock_quantity !== null && product.stock_quantity <= 0)) {
            results.push({
              notificationId: notification.id,
              success: false,
              error: 'Product is not in stock'
            })
            continue
          }

          // Send email
          const emailResult = await sendBackInStockEmail(profile.email, {
            productName: product.name,
            productImage: product.image,
            productPrice: product.price,
            productUrl: buildUrl(`/products/${product.slug || product.id}`)
          })

          if (emailResult.success) {
            // Update notification
            await supabase
              .from('back_in_stock_notifications')
              .update({
                email_sent: true,
                email_sent_at: new Date().toISOString()
              })
              .eq('id', notification.id)

            // Log email
            await supabase
              .from('email_logs')
              .insert({
                user_id: profile.id,
                email: profile.email,
                email_type: 'back_in_stock',
                subject: `${product.name} is back in stock!`,
                status: 'sent',
                message_id: emailResult.messageId,
                metadata: {
                  notification_id: notification.id,
                  product_id: product.id
                }
              })

            results.push({ notificationId: notification.id, success: true })
          } else {
            results.push({
              notificationId: notification.id,
              success: false,
              error: emailResult.error
            })
          }
        } catch (error: any) {
          logger.error(`Error processing notification ${notification.id}:`, error)
          results.push({
            notificationId: notification.id,
            success: false,
            error: error.message
          })
        }
      }

      // Log admin action
      logSecurityEvent('BACK_IN_STOCK_EMAILS_SENT', {
        userId: user?.id,
        notificationCount: notifications.length,
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        endpoint: '/api/admin/emails/back-in-stock'
      }, request)

      // Clear cache
      setCachedData(`admin_back_in_stock_*`, null, 0) // Invalidate all back-in-stock caches

      return NextResponse.json({
        success: true,
        results,
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_emails_back_in_stock_post',
        metadata: {
          endpoint: '/api/admin/emails/back-in-stock'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}
