import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseClient } from '@/lib/supabase-server'
import { createNotification, notifyAllAdmins } from '@/lib/notification-helpers'
import { sendWelcomeSupplierEmail } from '@/lib/user-email-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client with proper cookie handling for auth
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Cookies will be set by the response
          },
          remove(name: string, options: any) {
            // Cookies will be removed by the response
          },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      companyName, 
      location, 
      officeNumber, 
      registrationType,
      businessRegistrationNumber, 
      tinOrNida, 
      fullLegalName,
      region, 
      nation, 
      detailSentence,
      businessTinCertificateUrl,
      companyCertificateUrl,
      nidaCardFrontUrl,
      nidaCardRearUrl,
      selfPictureUrl
    } = body

    if (!companyName || !officeNumber) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Company name and office number are required'
        },
        { status: 400 }
      )
    }

    // Validate nation - only Tanzania allowed for now
    if (nation && nation.trim() !== 'Tanzania') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Only Tanzania is supported at this time'
        },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS for profile updates
    // This is safe because we've already verified the user is authenticated
    const adminSupabase = getSupabaseClient()
    
    // Check if user has Winga plan - if so, require tinOrNida and region
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('supplier_plan_id')
      .eq('id', user.id)
      .single()
    
    let isWingaPlan = false
    if (profile?.supplier_plan_id) {
      const { data: plan } = await adminSupabase
        .from('supplier_plans')
        .select('slug')
        .eq('id', profile.supplier_plan_id)
        .single()
      isWingaPlan = plan?.slug === 'winga'
    }
    
    // Region is required for all users
    if (!region || !region.trim()) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Region is required'
        },
        { status: 400 }
      )
    }

    // For Winga users, require tinOrNida (location is optional)
    if (isWingaPlan) {
      if (!tinOrNida || !tinOrNida.trim()) {
        return NextResponse.json(
          { 
            success: false,
            error: 'TIN No or NIDA No is required for Winga plan users'
          },
          { status: 400 }
        )
      }
      // Location is optional for Winga users, business_registration_number is not required
    } else {
      // For non-Winga users, location and business_registration_number are required
      if (!location || !location.trim()) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Location is required'
          },
          { status: 400 }
        )
      }
      // For non-Winga users, require registration type and number
      if (!registrationType || !registrationType.trim()) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Registration type is required'
          },
          { status: 400 }
        )
      }
      if (!businessRegistrationNumber || !businessRegistrationNumber.trim()) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Registration number is required'
          },
          { status: 400 }
        )
      }
    }
    
    // Prepare update data
    const updateData: any = {
      company_name: companyName.trim(),
      office_number: officeNumber.trim(),
      is_active: false, // Set account to inactive for review
      is_supplier: true, // Set supplier flag when completing company info
      updated_at: new Date().toISOString()
    }

    // Location: required for non-Winga, optional for Winga
    if (location && location.trim()) {
      updateData.location = location.trim()
    }

    // Business registration number: required for non-Winga, optional for Winga
    if (businessRegistrationNumber && businessRegistrationNumber.trim()) {
      updateData.business_registration_number = businessRegistrationNumber.trim()
    }

    // Add registration type if provided (map form values to database values)
    if (registrationType && registrationType.trim()) {
      const registrationTypeMap: Record<string, string> = {
        'business': 'business_registration',
        'company': 'company_registration',
        'tin': 'tin'
      }
      updateData.registration_type = registrationTypeMap[registrationType.trim()] || registrationType.trim()
    }

    // Add TIN/NIDA if provided
    if (tinOrNida && tinOrNida.trim()) {
      updateData.tin_or_nida = tinOrNida.trim()
    }

    // Add full legal name (NIDA name) if provided
    if (fullLegalName && fullLegalName.trim()) {
      updateData.full_legal_name = fullLegalName.trim()
    }

    // Add region (required for all users - already validated above)
    updateData.region = region.trim()

    // Add nation (default to Tanzania)
    updateData.nation = (nation && nation.trim()) || 'Tanzania'
    
    // Add detail sentence (optional - appears after rating on all products)
    if (detailSentence !== undefined) {
      updateData.detail_sentence = detailSentence.trim() === '' ? null : detailSentence.trim()
    }
    
    // Add document URLs if provided
    if (businessTinCertificateUrl) {
      updateData.business_tin_certificate_url = businessTinCertificateUrl
    }
    if (companyCertificateUrl) {
      updateData.company_certificate_url = companyCertificateUrl
    }
    if (nidaCardFrontUrl) {
      updateData.nida_card_front_url = nidaCardFrontUrl
    }
    if (nidaCardRearUrl) {
      updateData.nida_card_rear_url = nidaCardRearUrl
    }
    if (selfPictureUrl) {
      updateData.self_picture_url = selfPictureUrl
    }
    
    // Check if this is first-time company info submission (for welcome email)
    const { data: previousProfile } = await adminSupabase
      .from('profiles')
      .select('company_name')
      .eq('id', user.id)
      .single()
    
    const isFirstTimeSubmission = !previousProfile?.company_name || previousProfile.company_name.trim() === ''
    
    // Update profile with company information and set account to inactive for review
    // Also set is_supplier to true if coming from become-supplier registration flow
    const { data, error } = await adminSupabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating company info:', error)
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to update company information'
        },
        { status: 500 }
      )
    }

    // Create "waiting for review" notification for supplier
    try {
      await createNotification(
        user.id,
        'waiting_for_review',
        'Account Under Review ⏳',
        `Your company information has been submitted successfully. Your account "${companyName.trim()}" is now under review by our administration team. You will be notified once your account is activated.`,
        {
          company_name: companyName.trim(),
          action_url: '/supplier/dashboard'
        }
      )
    } catch (notifError) {
      console.error('Error creating waiting for review notification:', notifError)
      // Don't fail the request if notification fails
    }

    // Notify all admins about company info submission
    try {
      await notifyAllAdmins(
        'company_info_submitted',
        'Company Information Submitted for Review',
        `${companyName.trim()} has submitted company information for review. Account pending activation.`,
        {
          supplier_id: user.id,
          company_name: companyName.trim(),
          email: user.email || '',
          action_url: `/siem-dashboard/suppliers?highlight=${user.id}`
        }
      )
    } catch (adminNotifError) {
      console.error('Error notifying admins:', adminNotifError)
      // Don't fail the request if admin notification fails
    }

    // Check if user has pending premium plan
    let pendingPremiumPlan = null
    if (data?.pending_plan_id) {
      const { data: pendingPlan } = await adminSupabase
        .from('supplier_plans')
        .select('id, name, slug, price, currency, commission_rate')
        .eq('id', data.pending_plan_id)
        .eq('is_active', true)
        .single()
      
      if (pendingPlan) {
        // Verify it's a premium/paid plan
        const isPremiumPlan = pendingPlan.slug === 'premium' || pendingPlan.price > 0
        if (isPremiumPlan) {
          pendingPremiumPlan = pendingPlan
        }
      }
    }

    // Send welcome email to supplier after company info is submitted
    // Only send if this is the first time submitting company info
    try {
      const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                     process.env.NEXT_PUBLIC_APP_URL ||
                     (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://honiccompanystore.com')
      
      // Only send welcome email on first-time company info submission
      if (isFirstTimeSubmission && appUrl && user.email && data?.is_supplier) {
        // Get supplier plan for commission rate
        let commissionRate = '15%' // Default
        if (data?.supplier_plan_id) {
          const { data: plan } = await adminSupabase
            .from('supplier_plans')
            .select('commission_rate')
            .eq('id', data.supplier_plan_id)
            .single()
          if (plan?.commission_rate !== null) {
            commissionRate = `${plan.commission_rate}%`
          }
        } else if (pendingPremiumPlan?.commission_rate !== null && pendingPremiumPlan?.commission_rate !== undefined) {
          commissionRate = `${pendingPremiumPlan.commission_rate}%`
        }
        
        // Send welcome email with account notice
        const welcomeResult = await sendWelcomeSupplierEmail(user.email, {
          name: data?.full_name || user.email.split('@')[0],
          companyName: companyName.trim(),
          dashboardUrl: `${appUrl}/supplier/dashboard`,
          commissionRate: commissionRate
        })
        
        if (welcomeResult.success) {
          console.log('✅ Supplier welcome email sent after company info submission')
        } else {
          console.error('⚠️ Failed to send supplier welcome email:', welcomeResult.error)
          // Don't fail the request if email fails
        }
      }
    } catch (emailError) {
      console.error('⚠️ Error sending supplier welcome email:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Company information updated successfully',
      data,
      pendingPremiumPlan // Include pending premium plan info if exists
    })

  } catch (error) {
    console.error('Update company info error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'An unexpected error occurred. Please try again later.'
      },
      { status: 500 }
    )
  }
}

