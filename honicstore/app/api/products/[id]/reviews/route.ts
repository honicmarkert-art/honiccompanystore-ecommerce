import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSecureResponse, createErrorResponse } from '@/lib/secure-api'

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
    let userProfiles: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, avatar_url')
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
// POST - Create a new review
export async function POST(
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

    // Get authenticated user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return createErrorResponse('Unauthorized', 401)
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return createErrorResponse('Unauthorized', 401)
    }
    const body = await request.json()
    const { rating, comment, images } = body

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return createErrorResponse('Rating must be between 1 and 5', 400)
    }
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
