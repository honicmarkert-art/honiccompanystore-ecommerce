import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/supplier/assign-plan - Assign a plan to the authenticated supplier
export async function POST(request: NextRequest) {
  try {
    // Use regular client for authentication check
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { planId, registrationNumber } = body

    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS
    const adminSupabase = getSupabaseClient()

    // Get current supplier plan
    const { data: currentProfile } = await adminSupabase
      .from('profiles')
      .select('supplier_plan_id')
      .eq('id', user.id)
      .single()

    let currentPlanSlug = null
    if (currentProfile?.supplier_plan_id) {
      const { data: currentPlan } = await adminSupabase
        .from('supplier_plans')
        .select('slug')
        .eq('id', currentProfile.supplier_plan_id)
        .single()
      currentPlanSlug = currentPlan?.slug || null
    }

    // Verify plan exists and is active
    const { data: plan, error: planError } = await adminSupabase
      .from('supplier_plans')
      .select('id, name, slug, price')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      logger.error('Invalid plan selected:', planError)
      return NextResponse.json(
        { success: false, error: 'Invalid plan selected' },
        { status: 400 }
      )
    }

    // Check if user is a supplier
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, is_supplier')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      logger.error('Error fetching profile:', profileError)
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Ensure user is marked as supplier
    if (!profile.is_supplier) {
      await adminSupabase
        .from('profiles')
        .update({ is_supplier: true })
        .eq('id', user.id)
    }

    // Winga → Free or Winga → Premium requires registration number
    if (currentPlanSlug === 'winga') {
      if (!registrationNumber || !registrationNumber.trim()) {
        return NextResponse.json(
          { success: false, error: 'Registration number (TIN No or NIDA No) is required to change from Winga Plan.' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {
      supplier_plan_id: planId,
      updated_at: new Date().toISOString()
    }

    // Set payment_status based on plan type
    // Free and Winga plans use null, Premium uses 'pending'
    if (plan.slug === 'free' || plan.slug === 'winga' || plan.price === 0) {
      updateData.payment_status = null // Free/Winga plans use null to differentiate from premium
    }
    // Note: Premium plans will have payment_status set to 'pending' in upgrade/initiate route

    // Update registration number if provided (for Winga plan changes)
    if (registrationNumber && registrationNumber.trim()) {
      updateData.tin_or_nida = registrationNumber.trim()
    }

    // Assign plan to supplier
    const { data: updatedProfile, error: updateError } = await adminSupabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      logger.error('Error assigning plan:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to assign plan' },
        { status: 500 }
      )
    }

    logger.log('Plan assigned successfully:', {
      userId: user.id,
      planId: planId,
      planName: plan.name,
      planSlug: plan.slug
    })

    return NextResponse.json({
      success: true,
      message: 'Plan assigned successfully',
      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug
      }
    })

  } catch (error: any) {
    logger.error('Error in assign-plan route:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}



