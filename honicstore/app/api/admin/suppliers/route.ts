import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/suppliers - Fetch all suppliers with their plan information
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const supabase = createAdminSupabaseClient()
    
    // Fetch all suppliers with complete details
    const { data: suppliers, error: suppliersError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        company_name,
        email,
        phone,
        location,
        office_number,
        business_registration_number,
        registration_type,
        tin_or_nida,
        region,
        nation,
        is_supplier,
        is_active,
        supplier_plan_id,
        is_verified,
        detail_sentence,
        supplier_rating,
        supplier_review_count,
        company_logo,
        business_tin_certificate_url,
        company_certificate_url,
        nida_card_front_url,
        nida_card_rear_url,
        self_picture_url,
        created_at,
        updated_at
      `)
      .eq('is_supplier', true)
      .order('created_at', { ascending: false })

    if (suppliersError) {
      console.error('[API][Admin][Suppliers] Database error:', suppliersError)
      return NextResponse.json(
        { error: 'Failed to fetch suppliers', details: suppliersError.message, code: suppliersError.code },
        { status: 500 }
      )
    }

    // Fetch all plans in one query
    const planIds = [...new Set((suppliers || []).map((s: any) => s.supplier_plan_id).filter(Boolean))]
    let plansMap: Record<string, any> = {}
    
    if (planIds.length > 0) {
      const { data: plans, error: plansError } = await supabase
        .from('supplier_plans')
        .select('id, name, slug, price, currency, term')
        .in('id', planIds)

      if (plansError) {
        console.error('[API][Admin][Suppliers] Plans fetch error:', plansError)
        // Don't fail the whole request if plans can't be fetched
      } else {
        plansMap = (plans || []).reduce((acc: Record<string, any>, plan: any) => {
          acc[plan.id] = plan
          return acc
        }, {})
      }
    }

    // Transform the data
    const transformedSuppliers = (suppliers || []).map((supplier: any) => {
      const plan = supplier.supplier_plan_id ? plansMap[supplier.supplier_plan_id] : null
      return {
        id: supplier.id,
        fullName: supplier.full_name,
        companyName: supplier.company_name,
        email: supplier.email,
        phone: supplier.phone,
        location: supplier.location,
        officeNumber: supplier.office_number,
        businessRegistrationNumber: supplier.business_registration_number || null,
        registrationType: supplier.registration_type || null,
        tinOrNida: supplier.tin_or_nida || null,
        region: supplier.region || null,
        nation: supplier.nation || null,
        isSupplier: supplier.is_supplier,
        isActive: supplier.is_active !== false, // Default to true if null
        planId: supplier.supplier_plan_id,
        plan: plan ? {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          price: plan.price,
          currency: plan.currency,
          term: plan.term
        } : null,
        isVerified: supplier.is_verified || false,
        detailSentence: supplier.detail_sentence || null,
        rating: supplier.supplier_rating || null,
        reviewCount: supplier.supplier_review_count || null,
        companyLogo: supplier.company_logo || null,
        businessTinCertificateUrl: supplier.business_tin_certificate_url || null,
        companyCertificateUrl: supplier.company_certificate_url || null,
        nidaCardFrontUrl: supplier.nida_card_front_url || null,
        nidaCardRearUrl: supplier.nida_card_rear_url || null,
        selfPictureUrl: supplier.self_picture_url || null,
        createdAt: supplier.created_at,
        updatedAt: supplier.updated_at
      }
    })

    return NextResponse.json({
      success: true,
      suppliers: transformedSuppliers,
      count: transformedSuppliers.length
    })

  } catch (error: any) {
    console.error('[API][Admin][Suppliers] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error', stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined },
      { status: 500 }
    )
  }
}


