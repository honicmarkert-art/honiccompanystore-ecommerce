import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET - Fetch supplier's advertisements
export async function GET(request: NextRequest) {
  try {
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

    // Verify supplier status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_supplier, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_supplier && !profile?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Supplier account required.' },
        { status: 403 }
      )
    }

    const { data: advertisements, error } = await supabase
      .from('advertisements')
      .select('*')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching advertisements:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch advertisements' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      advertisements: advertisements || []
    })
  } catch (error: any) {
    console.error('Supplier advertisements GET error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// DELETE - Delete advertisement (handled via query param for compatibility)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Advertisement ID is required' },
        { status: 400 }
      )
    }

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

    // Verify supplier owns this advertisement
    const { data: ad, error: adError } = await supabase
      .from('advertisements')
      .select('supplier_id, media_url')
      .eq('id', id)
      .single()

    if (adError || !ad) {
      return NextResponse.json(
        { success: false, error: 'Advertisement not found' },
        { status: 404 }
      )
    }

    if (ad.supplier_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied. You can only delete your own advertisements.' },
        { status: 403 }
      )
    }

    // Use service role key for storage operations
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Delete media file from storage
    if (ad.media_url) {
      const urlParts = ad.media_url.split('/advertisements/')
      if (urlParts.length > 1) {
        const filePath = `advertisements/${urlParts[1]}`
        await supabaseService.storage
          .from('advertisements')
          .remove([filePath])
      }
    }

    // Delete from database
    const { error: deleteError } = await supabaseService
      .from('advertisements')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete advertisement' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Advertisement deleted successfully'
    })

  } catch (error: any) {
    console.error('Supplier advertisements GET error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST - Create new advertisement (inactive by default)
export async function POST(request: NextRequest) {
  try {
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

    // Verify supplier status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_supplier, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_supplier && !profile?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Supplier account required.' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const link_url = formData.get('link_url') as string
    const display_order = parseInt(formData.get('display_order') as string) || 1
    const placement = formData.get('placement') as string || 'products'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    // Use service role key for storage operations
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Determine media type
    const media_type = file.type.startsWith('video/') ? 'video' : 'image'

    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `advertisements/${fileName}`

    // Convert File to ArrayBuffer for Supabase
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from('advertisements')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload file: ' + uploadError.message },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseService.storage
      .from('advertisements')
      .getPublicUrl(filePath)

    // Insert advertisement record (inactive by default for suppliers)
    const { data: advertisement, error: insertError } = await supabaseService
      .from('advertisements')
      .insert({
        title,
        description,
        media_url: publicUrl,
        media_type,
        link_url,
        display_order,
        placement,
        supplier_id: user.id,
        is_active: false // Suppliers create inactive ads - admin must activate
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create advertisement: ' + insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      advertisement,
      message: 'Advertisement created successfully. It will be reviewed and activated by administration.'
    })

  } catch (error: any) {
    console.error('Supplier advertisement POST error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

