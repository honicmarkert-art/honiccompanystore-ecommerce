import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { ShortTtlCache } from '@/lib/short-ttl-cache'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supplierInfoCache = new ShortTtlCache<any>(15000)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const cacheKey = `supplier-info:${productId}`

    // Rate limiting
    const rateLimitResult = await enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: `/api/products/${productId}/supplier-info`,
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }
    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }
    const cached = supplierInfoCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache-Status': 'HIT' }
      })
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Fetch product to get supplier_id or user_id
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('supplier_id, user_id')
      .eq('id', productId)
      .single()

    if (productError || !productData) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }
    const supplierId = productData.supplier_id || productData.user_id

    if (!supplierId) {
      return NextResponse.json(
        {
          companyName: null,
          companyLogo: null,
          isVerified: false,
          detailSentence: null,
          rating: null,
          reviewCount: null,
          // SECURITY: Do NOT expose supplierId (UUID) to clients
          // supplierId: null, // REMOVED - UUIDs should never be exposed
          productCount: null,
          totalViews: null,
          region: null
        },
        { status: 200 }
      )
    }
    // Fetch supplier profile data
    const { data: supplierData, error: supplierError } = await supabase
      .from('profiles')
      .select('company_name, full_name, is_verified, detail_sentence, supplier_rating, supplier_review_count, company_logo, region')
      .eq('id', supplierId)
      .single()

    if (supplierError || !supplierData) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }
    const supplierProductsFilter = `supplier_id.eq.${supplierId},user_id.eq.${supplierId}`
    // Run independent aggregations in parallel to reduce endpoint latency.
    const [{ count: productCount }, { data: products }] = await Promise.all([
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .or(supplierProductsFilter)
        .eq('is_hidden', false),
      supabase
        .from('products')
        .select('views')
        .or(supplierProductsFilter)
        .eq('is_hidden', false),
    ])

    // Calculate total views
    const totalViews = products?.reduce((sum: number, p: any) => sum + (p.views || 0), 0) || 0

    const responsePayload = {
      companyName: supplierData.company_name || supplierData.full_name || null,
      companyLogo: supplierData.company_logo || null,
      isVerified: supplierData.is_verified || false,
      detailSentence: supplierData.detail_sentence || null,
      rating: supplierData.supplier_rating || null,
      reviewCount: supplierData.supplier_review_count || null,
      // SECURITY: Do NOT expose supplierId (UUID) to clients
      // supplierId: supplierId, // REMOVED - UUIDs should never be exposed
      productCount: productCount || null,
      totalViews: totalViews || null,
      region: supplierData.region || null
    }
    supplierInfoCache.set(cacheKey, responsePayload)
    return NextResponse.json(responsePayload, {
      headers: { 'X-Cache-Status': 'MISS' }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
