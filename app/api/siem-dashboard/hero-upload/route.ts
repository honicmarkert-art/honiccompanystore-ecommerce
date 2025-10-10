import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Use service role key for admin operations (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export async function POST(request: NextRequest) {
  try {
    logger.log('📤 Hero image upload API called')
    
    const formData = await request.formData()
    const file = formData.get('file') as File

    logger.log('📋 Upload details:', {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type
    })

    if (!file) {
      logger.log('❌ No file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      logger.log('❌ Invalid file type:', file.type)
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload a PNG, JPG, GIF, or WebP image.' 
      }, { status: 400 })
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      logger.log('❌ File too large:', file.size)
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 10MB.' 
      }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const fileName = `hero_${timestamp}_${randomString}.${fileExtension}`
    
    logger.log('📝 Generated filename:', fileName)

    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(fileBuffer)

    // Upload to Supabase Storage
    logger.log('⬆️ Uploading to hero-images bucket...')
    const { data, error } = await supabase.storage
      .from('hero-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      console.error('❌ Supabase upload error:', error)
      return NextResponse.json({ 
        error: 'Upload failed', 
        details: error.message
      }, { status: 500 })
    }

    logger.log('✅ Upload successful:', data)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('hero-images')
      .getPublicUrl(fileName)

    logger.log('✅ Public URL generated:', urlData.publicUrl)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName: fileName,
      fileSize: file.size,
      fileType: file.type
    })

  } catch (error) {
    console.error('❌ Hero upload error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    logger.log('🗑️ Hero image delete API called')
    
    const { fileName } = await request.json()

    if (!fileName) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 })
    }

    logger.log('🗑️ Deleting file:', fileName)

    // Delete from Supabase Storage
    const { error } = await supabase.storage
      .from('hero-images')
      .remove([fileName])

    if (error) {
      console.error('❌ Delete error:', error)
      return NextResponse.json({ 
        error: 'Delete failed', 
        details: error.message
      }, { status: 500 })
    }

    logger.log('✅ File deleted successfully')

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    })

  } catch (error) {
    console.error('❌ Hero delete error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    logger.log('📋 Hero images list API called')
    
    // List all files in hero-images bucket
    const { data, error } = await supabase.storage
      .from('hero-images')
      .list()

    if (error) {
      console.error('❌ List error:', error)
      return NextResponse.json({ 
        error: 'Failed to list files', 
        details: error.message
      }, { status: 500 })
    }

    // Get public URLs for all files
    const filesWithUrls = data.map(file => {
      const { data: urlData } = supabase.storage
        .from('hero-images')
        .getPublicUrl(file.name)
      
      return {
        name: file.name,
        url: urlData.publicUrl,
        size: file.metadata?.size || 0,
        lastModified: file.updated_at
      }
    })

    logger.log('✅ Listed files:', filesWithUrls.length)

    return NextResponse.json({
      success: true,
      files: filesWithUrls
    })

  } catch (error) {
    console.error('❌ Hero list error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

