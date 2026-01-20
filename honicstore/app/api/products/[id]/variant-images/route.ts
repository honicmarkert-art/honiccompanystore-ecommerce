import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
}
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Simple in-memory rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10 // Max 10 requests per minute per IP
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const key = ip
  const current = requestCounts.get(key)

  if (!current || now > current.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  if (current.count >= RATE_LIMIT) {
    return false
  }
  current.count++
  return true
}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting check
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({
        error: 'Too many requests. Please try again later.'
      }, {
        status: 429,
        headers: {
          'Retry-After': '60'
        }
      })
    }
    const { id } = await params
    const productId = id
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5')
    const cacheBust = searchParams.get('cb') // Cache busting parameter

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }
    logger.log(`🔍 Fetching variant images for product ${productId}, limit: ${limit}`)

    // Fetch variant images from the product's variant_images field
    const { data: product, error } = await supabase
      .from('products')
      .select('variant_images')
      .eq('id', productId)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch variant images' }, { status: 500 })
    }
    const allVariantImages = product?.variant_images || []

    // Normalize variant images to ensure consistent format
    // Handle both string arrays and object arrays from database
    const normalizedVariantImages = allVariantImages.map((img: any, index: number) => {
      if (typeof img === 'string') {
        return { imageUrl: img }
      } else if (img && typeof img === 'object') {
        return {
          imageUrl: img.imageUrl || img.image || img.url || String(img),
          variantId: img.variantId || img.variant_id,
          attribute: img.attribute,
          attributes: img.attributes
        }
      }
      return { imageUrl: String(img || '') }
    }).filter((img: any) => img.imageUrl && img.imageUrl.trim() !== '')

    // Limit to first N images for better performance
    const variantImages = normalizedVariantImages.slice(0, limit)

    logger.log(`📊 Found ${allVariantImages.length} total variant images, normalized to ${normalizedVariantImages.length}, returning first ${variantImages.length}`)

    // Set appropriate cache headers
    const cacheHeaders = cacheBust ? {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    } : {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
    }
    return NextResponse.json({
      success: true,
      variantImages,
      total: normalizedVariantImages.length,
      returned: variantImages.length
    }, {
      headers: cacheHeaders
    })

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
