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
    logger.log('📤 Media upload API called (using service role key)')
    
    // Check for authentication header
    const authHeader = request.headers.get('authorization')
    logger.log('🔐 Auth header present:', !!authHeader)
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string
    const context = formData.get('context') as string || 'product'
    const productId = formData.get('productId') as string

    logger.log('📋 Upload details:', {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      mediaType: type,
      context: context,
      productId: productId
    })

    if (!file) {
      logger.log('❌ No file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!type || !['image', 'video', 'model3d'].includes(type)) {
      logger.log('❌ Invalid media type:', type)
      return NextResponse.json({ error: 'Invalid media type' }, { status: 400 })
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    
    // Generate product-specific filename if productId is provided
    let fileName: string
    if (productId && (context === 'product' || context === 'variant')) {
      fileName = `product_${productId}_${type}_${timestamp}.${fileExtension}`
    } else {
      fileName = `${type}_${timestamp}_${randomString}.${fileExtension}`
    }
    
    logger.log('📝 Generated filename:', fileName)

    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(fileBuffer)

    // Determine bucket based on type and context
    const bucketName = getBucketName(type, context)
    logger.log('📦 Using bucket:', bucketName)

    // Upload to Supabase Storage
    logger.log('⬆️ Uploading to Supabase...')
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      console.error('❌ Supabase upload error:', error)
      console.error('Error details:', {
        message: error.message
      })
      return NextResponse.json({ 
        error: 'Upload failed', 
        details: error.message,
        bucket: bucketName
      }, { status: 500 })
    }

    logger.log('✅ Upload successful:', data)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    // If this is a product image upload, update the product's image field
    if (productId && context === 'product' && type === 'image') {
      logger.log(`🔄 Updating product ${productId} image field...`)
      
      const { error: updateError } = await supabase
        .from('products')
        .update({ image: urlData.publicUrl })
        .eq('id', parseInt(productId))
        
      if (updateError) {
        console.error('❌ Error updating product image:', updateError)
        // Don't fail the upload, just log the error
      } else {
        logger.log('✅ Product image field updated successfully')
      }
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName: fileName,
      size: file.size,
      type: file.type
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('❌ Upload error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function getBucketName(type: string, context: string = 'product'): string {
  // For images, use different buckets based on context
  if (type === 'image') {
    switch (context) {
      case 'category':
        return 'category-images'
      case 'variant':
        return 'variant-images'
      case 'product':
      default:
        return 'product-images'
    }
  }
  
  // For videos and 3D models, always use product buckets
  switch (type) {
    case 'video':
      return 'product-videos'
    case 'model3d':
      return 'product-models'
    default:
      return 'media'
  }
}

// GET endpoint to list media files
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const bucket = searchParams.get('bucket')
    const context = searchParams.get('context') || 'product'
    const productId = searchParams.get('productId')

    if (!type && !bucket) {
      return NextResponse.json({ error: 'Type or bucket required' }, { status: 400 })
    }

    const bucketName = bucket || getBucketName(type || 'image', context)

    const { data, error } = await supabase.storage
      .from(bucketName)
      .list('', {
        limit: 100,
        offset: 0
      })

    if (error) {
      console.error('Supabase list error:', error)
      return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
    }

    // Get public URLs for each file
    let filesWithUrls = data.map(file => {
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(file.name)

      return {
        name: file.name,
        size: file.metadata?.size,
        lastModified: file.updated_at,
        url: urlData.publicUrl,
        productId: extractProductIdFromFilename(file.name)
      }
    })

    // Filter by productId if provided
    if (productId) {
      filesWithUrls = filesWithUrls.filter(file => 
        file.productId === productId || file.name.startsWith(`product_${productId}_`)
      )
    }

    return NextResponse.json({
      success: true,
      files: filesWithUrls
    })

  } catch (error) {
    console.error('List error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to extract product ID from filename
function extractProductIdFromFilename(filename: string): string | null {
  const match = filename.match(/^product_(\d+)_/)
  return match ? match[1] : null
}

// DELETE endpoint to remove media files
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('fileName')
    const type = searchParams.get('type')
    const context = searchParams.get('context') || 'product'

    if (!fileName) {
      return NextResponse.json({ error: 'File name required' }, { status: 400 })
    }

    const bucketName = getBucketName(type || 'image', context)

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName])

    if (error) {
      console.error('Supabase delete error:', error)
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    })

  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
