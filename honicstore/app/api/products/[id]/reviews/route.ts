import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSecureResponse, createErrorResponse } from '@/lib/secure-api'
import { getSupabaseClient } from '@/lib/supabase-server'
import { validateAuth } from '@/lib/auth-server'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'

// GET - Fetch reviews for a product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params

    if (!productId || isNaN(Number(productId))) {
      return createErrorResponse('Invalid product ID', 400)
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Fetch reviews
    const { data: reviews, error } = await supabase
      .from('product_reviews')
      .select(`
        id,
        product_id,
        user_id,
        rating,
        comment,
        helpful_count,
        images,
        created_at,
        updated_at
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (error) {
      return createErrorResponse('Failed to fetch reviews', 500)
    }
    // Fetch user profiles separately to avoid foreign key relationship issues
    const userIds = [...new Set((reviews || []).map((r: any) => r.user_id).filter(Boolean))]
    const userProfiles: Record<string, any> = {}
    if (userIds.length > 0) {
      // Admin client: `profiles` is private (RLS: own row only). Select display names only — never
      // email/phone/ID fields. (avatar_url was requested before but isn't a column, so the whole
      // query failed and reviewer names never showed.)
      const { data: profiles, error: profilesError } = await getSupabaseClient()
        .from('profiles')
        .select('id, full_name, company_name')
        .in('id', userIds)

      if (!profilesError && profiles) {
        profiles.forEach((profile: any) => {
          userProfiles[profile.id] = profile
        })
      }
    }
    // Transform reviews to include user name
    const transformedReviews = (reviews || []).map((review: any) => {
      const profile = userProfiles[review.user_id] || null
      return {
        id: review.id,
        productId: review.product_id,
        userId: review.user_id,
        userName: profile?.full_name || profile?.company_name || 'Anonymous',
        userAvatar: profile?.avatar_url || null,
        rating: review.rating,
        comment: review.comment,
        helpful: review.helpful_count || 0,
        images: review.images || [],
        date: review.created_at,
        updatedAt: review.updated_at
      }
    })

    return createSecureResponse({
      reviews: transformedReviews,
      total: transformedReviews.length
    }, {
      cacheControl: 'public, s-maxage=300, stale-while-revalidate=600'
    })
  } catch (error: any) {
    return createErrorResponse('Internal server error', 500)
  }
}
/** Orders that count as "bought and received" for a verified review */
const PAID = ['paid', 'completed', 'success']
const RECEIVED = ['delivered', 'picked_up', 'completed']

// POST - Create or update the signed-in shopper's review.
// SECURITY: verified buyers only: the shopper must have a paid order for this product that was
// delivered or picked up. Stops fake reviews; the rating/review count on the product updates via the
// update_product_review_stats trigger.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limit = await enhancedRateLimit(request)
    if (!limit.allowed) return createErrorResponse('Too many requests. Please try again later.', 429)

    const { id: productId } = await params
    if (!productId || isNaN(Number(productId))) {
      return createErrorResponse('Invalid product ID', 400)
    }

    // Signed-in user (cookie session or bearer token, verified with Supabase)
    const { user } = await validateAuth(request)
    if (!user) return createErrorResponse('Please sign in to write a review.', 401)

    const body = await request.json().catch(() => null)
    const rating = Number(body?.rating)
    const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 2000) : ''
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return createErrorResponse('Rating must be between 1 and 5', 400)
    }

    const supabase = getSupabaseClient()

    // Verified purchase?
    const { data: bought } = await supabase
      .from('order_items')
      .select('id, orders!inner(user_id, payment_status, status)')
      .eq('product_id', Number(productId))
      .eq('orders.user_id', user.id)
      .in('orders.payment_status', PAID)
      .in('orders.status', RECEIVED)
      .limit(1)
    if (!bought || bought.length === 0) {
      return createErrorResponse('You can review products after you have bought and received them.', 403)
    }
    const images: string[] = []
    // Check if user already reviewed this product
    const { data: existingReview } = await supabase
      .from('product_reviews')
      .select('id')
      .eq('product_id', productId)
      .eq('user_id', user.id)
      .single()

    if (existingReview) {
      // Update existing review
      const { data: updatedReview, error: updateError } = await supabase
        .from('product_reviews')
        .update({
          rating,
          comment: comment || null,
          images: images || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', existingReview.id)
        .select()
        .single()

      if (updateError) {
        return createErrorResponse('Failed to update review', 500)
      }
      return createSecureResponse({
        review: updatedReview,
        message: 'Review updated successfully'
      })
    } else {
      // Create new review
      const { data: newReview, error: insertError } = await supabase
        .from('product_reviews')
        .insert({
          product_id: Number(productId),
          user_id: user.id,
          rating,
          comment: comment || null,
          images: images || []
        })
        .select()
        .single()

      if (insertError) {
        return createErrorResponse('Failed to create review', 500)
      }
      return createSecureResponse({
        review: newReview,
        message: 'Review created successfully'
      }, {
        status: 201
      })
    }
  } catch (error: any) {
    return createErrorResponse('Internal server error', 500)
  }
}
