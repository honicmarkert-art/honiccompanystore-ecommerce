import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'

// Service IDs mapping
const SERVICE_IDS = {
  'retail': 'retail-sales',
  'prototyping': 'project-prototyping', 
  'pcb': 'pcb-printing',
  'ai': 'ai-consultancy',
  'stem': 'stem-training-kits'
} as const

export async function GET(request: NextRequest) {
  try {
    // Validate admin access first
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    // Use service role key for admin operations
    const supabase = createAdminSupabaseClient()

    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')

    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'Service ID is required' },
        { status: 400 }
      )
    }

    // Get all images for the specific service
    const { data: files, error } = await supabase.storage
      .from('hero-images')
      .list(`service-${serviceId}`, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error('Error listing service images:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch service images' },
        { status: 500 }
      )
    }

    // Get public URLs for all images
    const images = files.map(file => {
      const { data: urlData } = supabase.storage
        .from('hero-images')
        .getPublicUrl(`service-${serviceId}/${file.name}`)
      
      return {
        name: file.name,
        url: urlData.publicUrl,
        size: file.metadata?.size,
        createdAt: file.created_at
      }
    })

    return NextResponse.json({
      success: true,
      serviceId,
      images
    })

  } catch (error) {
    console.error('Service images fetch error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Validate admin access first
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    // Use service role key for admin operations
    const supabase = createAdminSupabaseClient()

    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')
    const fileName = searchParams.get('fileName')

    if (!serviceId || !fileName) {
      return NextResponse.json(
        { success: false, error: 'Service ID and file name are required' },
        { status: 400 }
      )
    }

    // Delete the specific image
    const { error } = await supabase.storage
      .from('hero-images')
      .remove([`service-${serviceId}/${fileName}`])

    if (error) {
      console.error('Error deleting service image:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete image' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully'
    })

  } catch (error) {
    console.error('Service image delete error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}





