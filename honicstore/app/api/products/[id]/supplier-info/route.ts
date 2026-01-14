import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params

    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
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
    // Fetch product count for this supplier
    const { count: productCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .or(`supplier_id.eq.${supplierId},user_id.eq.${supplierId}`)
      .eq('is_hidden', false)

    // Fetch total views (sum of all product views)
    const { data: products, error: viewsError } = await supabase
      .from('products')
      .select('views')
      .or(`supplier_id.eq.${supplierId},user_id.eq.${supplierId}`)
      .eq('is_hidden', false)

    // Calculate total views
    const totalViews = products?.reduce((sum: number, p: any) => sum + (p.views || 0), 0) || 0

    return NextResponse.json({
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
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
