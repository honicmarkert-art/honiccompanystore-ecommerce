import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

export const runtime = 'nodejs'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/supplier/logo-upload',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }
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
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is a supplier
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_supplier')
      .eq('id', user.id)
      .single()

    if (!profile?.is_supplier) {
      return NextResponse.json(
        { error: 'Only suppliers can upload logos' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      )
    }

    // Create admin client for storage operations
    const adminSupabase = supabaseUrl && supabaseServiceKey 
      ? createClient(supabaseUrl, supabaseServiceKey) 
      : null

    if (!adminSupabase) {
      return NextResponse.json(
        { error: 'Storage service not configured' },
        { status: 500 }
      )
    }

    // Create a unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `supplier-logos/${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    // Delete old logo if exists
    const { data: oldProfile } = await adminSupabase
      .from('profiles')
      .select('company_logo')
      .eq('id', user.id)
      .single()

    if (oldProfile?.company_logo) {
      // Extract filename from URL - handle different URL formats
      const oldUrl = oldProfile.company_logo
      let oldFileName: string | null = null
      
      // Check if it's a Supabase storage URL (service-images bucket)
      if (oldUrl.includes('service-images')) {
        // Extract path after 'service-images/'
        const pathMatch = oldUrl.match(/service-images\/([^?]+)/)
        if (pathMatch && pathMatch[1]) {
          oldFileName = pathMatch[1]
        }
      } else if (oldUrl.includes('supplier-logos')) {
        // Handle direct path format: supplier-logos/user-id/filename
        const pathMatch = oldUrl.match(/supplier-logos\/[^/]+\/([^?]+)/)
        if (pathMatch && pathMatch[1]) {
          oldFileName = `supplier-logos/${user.id}/${pathMatch[1]}`
        }
      }
      
      // Delete old file from storage if we found a valid filename
        if (oldFileName) {
        try {
          const { error: deleteError } = await adminSupabase.storage
            .from('service-images')
            .remove([oldFileName])
          
          if (deleteError) {
            console.error('Error deleting old logo:', deleteError)
            // Continue with upload even if deletion fails (non-critical)
          }
        } catch (deleteErr) {
          console.error('Exception while deleting old logo:', deleteErr)
          // Continue with upload even if deletion fails (non-critical)
        }
      }
    }

    // Upload to Supabase Storage
    const { data, error } = await adminSupabase.storage
      .from('service-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      })

    if (error) {
      console.error('Storage upload error:', error)
      
      // Check if it's a bucket not found error
      if (error.message && error.message.includes('Bucket not found')) {
        return NextResponse.json(
          { 
            error: 'Storage bucket "service-images" not found. Please create it in Supabase Dashboard: Storage → New bucket → Name: "service-images" (public, 5MB limit)',
            details: error.message 
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to upload file to storage', details: error.message },
        { status: 500 }
      )
    }

    // Get the public URL
    const { data: urlData } = adminSupabase.storage
      .from('service-images')
      .getPublicUrl(fileName)

    // Update profile with logo URL
    const { error: updateError } = await adminSupabase
      .from('profiles')
      .update({ company_logo: urlData.publicUrl })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating profile:', updateError)
      // Try to delete uploaded file if profile update fails
      await adminSupabase.storage
        .from('service-images')
        .remove([fileName])
      
      return NextResponse.json(
        { error: 'Failed to update profile with logo URL', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName: fileName
    })

  } catch (error) {
    console.error('Error in supplier logo upload:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

