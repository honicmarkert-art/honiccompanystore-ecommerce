import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET - Fetch all advertisements
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: advertisements, error } = await supabase
      .from('advertisements')
      .select('*')
      .order('display_order', { ascending: true })
    
    if (error) throw error
    
    return NextResponse.json({ advertisements })
  } catch (error) {
    console.error('Error fetching advertisements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch advertisements' },
      { status: 500 }
    )
  }
}

// POST - Create new advertisement
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const link_url = formData.get('link_url') as string
    const display_order = parseInt(formData.get('display_order') as string) || 1
    const placement = formData.get('placement') as string || 'products'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Determine media type
    const media_type = file.type.startsWith('video/') ? 'video' : 'image'
    
    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `advertisements/${fileName}`
    
    // Convert File to ArrayBuffer for Supabase
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('advertisements')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })
    
    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file: ' + uploadError.message },
        { status: 500 }
      )
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('advertisements')
      .getPublicUrl(filePath)
    
    // Insert advertisement record
    const { data: advertisement, error: insertError } = await supabase
      .from('advertisements')
      .insert({
        title,
        description,
        media_url: publicUrl,
        media_type,
        link_url,
        display_order,
        placement,
        is_active: true
      })
      .select()
      .single()
    
    if (insertError) throw insertError
    
    return NextResponse.json({ advertisement })
  } catch (error) {
    console.error('Error creating advertisement:', error)
    return NextResponse.json(
      { error: 'Failed to create advertisement' },
      { status: 500 }
    )
  }
}

// PUT - Update advertisement details
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await request.json()
    const { id, title, description, link_url, display_order, placement } = body
    
    if (!id) {
      return NextResponse.json({ error: 'Advertisement ID is required' }, { status: 400 })
    }
    
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    
    const updateData: any = {
      title,
      description,
      link_url,
      display_order,
      placement,
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('advertisements')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    return NextResponse.json({ advertisement: data })
  } catch (error) {
    console.error('Error updating advertisement:', error)
    return NextResponse.json(
      { error: 'Failed to update advertisement' },
      { status: 500 }
    )
  }
}

// PATCH - Update advertisement (toggle active status)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await request.json()
    const { id, is_active } = body
    
    if (!id) {
      return NextResponse.json({ error: 'Advertisement ID is required' }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from('advertisements')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    return NextResponse.json({ advertisement: data })
  } catch (error) {
    console.error('Error updating advertisement:', error)
    return NextResponse.json(
      { error: 'Failed to update advertisement' },
      { status: 500 }
    )
  }
}

// DELETE - Delete advertisement
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Advertisement ID is required' }, { status: 400 })
    }
    
    // Get advertisement to get media URL
    const { data: ad } = await supabase
      .from('advertisements')
      .select('media_url')
      .eq('id', id)
      .single()
    
    if (ad?.media_url) {
      // Extract file path from URL
      const urlParts = ad.media_url.split('/advertisements/')
      if (urlParts.length > 1) {
        const filePath = `advertisements/${urlParts[1]}`
        // Delete from storage
        await supabase.storage
          .from('advertisements')
          .remove([filePath])
      }
    }
    
    // Delete from database
    const { error } = await supabase
      .from('advertisements')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting advertisement:', error)
    return NextResponse.json(
      { error: 'Failed to delete advertisement' },
      { status: 500 }
    )
  }
}

