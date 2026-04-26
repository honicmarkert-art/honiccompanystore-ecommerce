import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { enhancedRateLimitDistributed, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { validateAuth, getUserAndRole } from '@/lib/auth-server'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
// Use service role key for admin operations (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await enhancedRateLimitDistributed(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/media/upload',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 })
    }

    const { user, error: authError } = await validateAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { role } = await getUserAndRole(user.id)
    
    logger.log('📤 Media upload API called (using service role key)')
    
    // Check for authentication header
    const authHeader = request.headers.get('authorization')
    logger.log('🔐 Auth header present:', !!authHeader)
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string
    const context = formData.get('context') as string || 'product'
    const productId = formData.get('productId') as string

    if (!productId && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: productId required for non-admin upload' }, { status: 403 })
    }
    if (productId) {
      const pid = Number.parseInt(productId, 10)
      if (Number.isNaN(pid)) {
        return NextResponse.json({ error: 'Invalid productId' }, { status: 400 })
      }
      if (role !== 'admin') {
        const { data: ownedProduct, error: ownErr } = await supabase
          .from('products')
          .select('id')
          .eq('id', pid)
          .or(`user_id.eq.${user.id},supplier_id.eq.${user.id}`)
          .maybeSingle()
        if (ownErr || !ownedProduct) {
          return NextResponse.json({ error: 'Forbidden: you do not own this product' }, { status: 403 })
        }
      }
    }

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

    // Validate file type
    if (!type || !['image', 'video', 'model3d'].includes(type)) {
      logger.log('❌ Invalid media type:', type)
      return NextResponse.json({ error: 'Invalid media type. Allowed types: image, video, model3d' }, { status: 400 })
    }

    // Validate file MIME type based on declared type
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    const allowedModelTypes = ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream']
    
    let allowedTypes: string[] = []
    if (type === 'image') {
      allowedTypes = allowedImageTypes
    } else if (type === 'video') {
      allowedTypes = allowedVideoTypes
    } else if (type === 'model3d') {
      allowedTypes = allowedModelTypes
    }

    if (!allowedTypes.includes(file.type)) {
      logger.log('❌ Invalid file MIME type:', file.type, 'for type:', type)
      return NextResponse.json({ 
        error: `Invalid file type. Expected ${type} file but got ${file.type}`,
        allowedTypes: allowedTypes
      }, { status: 400 })
    }

    // Validate file size based on type
    let maxSize: number
    if (type === 'image') {
      maxSize = 5 * 1024 * 1024 // 5MB for images
    } else if (type === 'video') {
      maxSize = 50 * 1024 * 1024 // 50MB for videos
    } else {
      maxSize = 10 * 1024 * 1024 // 10MB for 3D models
    }

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024))
      return NextResponse.json({ 
        error: `File too large. Maximum size for ${type} files is ${maxSizeMB}MB`,
        maxSize: maxSize,
        fileSize: file.size
      }, { status: 400 })
    }

    // Validate file extension matches MIME type
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const extensionMap: Record<string, string[]> = {
      'image': ['jpg', 'jpeg', 'jfif', 'png', 'gif', 'webp', 'svg'],
      'video': ['mp4', 'webm', 'ogg', 'mov'],
      'model3d': ['glb', 'gltf', 'obj']
    }
    
    // JFIF files are JPEG files, so accept them if MIME type is image/jpeg
    if (fileExtension === 'jfif' && file.type === 'image/jpeg') {
      // Allow JFIF files - they're JPEG format
      logger.log('✅ JFIF file detected (JPEG format):', file.name)
    } else if (fileExtension && extensionMap[type] && !extensionMap[type].includes(fileExtension)) {
      logger.log('❌ Invalid file extension:', fileExtension, 'for type:', type)
      return NextResponse.json({ 
        error: `Invalid file extension. Expected one of: ${extensionMap[type].join(', ')}`,
        receivedExtension: fileExtension
      }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExt = fileExtension || file.name.split('.').pop() || 'file'
    
    // Generate product-specific filename if productId is provided
    let fileName: string
    if (productId && (context === 'product' || context === 'variant' || context === 'specification')) {
      fileName = `product_${productId}_${type}_${timestamp}.${fileExt}`
    } else {
      fileName = `${type}_${timestamp}_${randomString}.${fileExt}`
    }
    
    logger.log('📝 Generated filename:', fileName)

    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(fileBuffer)

    // Determine bucket based on type and context
    const bucketName = getBucketName(type, context)
    logger.log('📦 Using bucket:', bucketName)

    // Check if bucket exists (for specification-images bucket)
    if (bucketName === 'specification-images') {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets()
      const bucketExists = buckets?.some(b => b.name === bucketName)
      if (!bucketExists) {
        logger.log('❌ Bucket does not exist:', bucketName)
        return NextResponse.json({ 
          error: `Storage bucket '${bucketName}' does not exist. Please create it in Supabase Dashboard.`,
          bucket: bucketName
        }, { status: 400 })
      }
    }

    // Upload to Supabase Storage
    logger.log('⬆️ Uploading to Supabase...')
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      return NextResponse.json({ 
        error: 'Upload failed', 
        details: error.message,
        bucket: bucketName,
        statusCode: error.statusCode
      }, { status: error.statusCode === 404 ? 400 : 500 })
    }

    logger.log('✅ Upload successful:', data)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    // If this is a product image upload, delete old image and update the product's image field
    if (productId && context === 'product' && type === 'image') {
      logger.log(`🔄 Updating product ${productId} image field...`)
      
      // First, get the old image URL from the product
      const { data: oldProduct } = await supabase
        .from('products')
        .select('image')
        .eq('id', parseInt(productId))
        .single()
      
      // Delete old image if it exists
      if (oldProduct?.image) {
        logger.log('🗑️ Deleting old product image:', oldProduct.image)
        
        // Extract filename from URL
        const oldFileName = oldProduct.image.split('/').pop()
        if (oldFileName) {
          const { error: deleteError } = await supabase.storage
            .from(bucketName)
            .remove([oldFileName])
          
          if (deleteError) {
            logger.log('⚠️ Failed to delete old image:', deleteError.message)
          } else {
            logger.log('✅ Old image deleted successfully')
          }
        }
      }
      
      // Update product with new image URL
      const { error: updateError } = await supabase
        .from('products')
        .update({ image: urlData.publicUrl })
        .eq('id', parseInt(productId))
        
      if (updateError) {
        // Don't fail the upload, just log the error
      } else {
        logger.log('✅ Product image field updated successfully')
      }
    }

    // If this is a variant image upload, append to products.variant_images immediately
    if (productId && context === 'variant' && type === 'image') {
      try {
        const pid = parseInt(productId)
        const { data: existing } = await supabase
          .from('products')
          .select('variant_images')
          .eq('id', pid)
          .single()

        const current: any[] = Array.isArray(existing?.variant_images) ? existing.variant_images : []
        // Normalize to array of objects: { imageUrl: string }
        const normalized: Array<{ imageUrl: string }> = current.map((it: any) =>
          typeof it === 'string' ? { imageUrl: it } : { imageUrl: String(it?.imageUrl || '') }
        ).filter(it => !!it.imageUrl)

        // Append if not already present
        const exists = normalized.some(it => it.imageUrl === urlData.publicUrl)
        const merged = exists ? normalized : [...normalized, { imageUrl: urlData.publicUrl }]

        const { error: updErr } = await supabase
          .from('products')
          .update({ variant_images: merged })
          .eq('id', pid)

        if (updErr) {
          } else {
          // Clear product cache to ensure immediate visibility
          const { clearCache, generateCacheKey } = await import('@/lib/database-optimization')
          // Clear all product-related caches
          clearCache() // Clear all cache to ensure product updates are visible immediately
        }
      } catch (e) {
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
      case 'specification':
        return 'specification-images'
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
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 })
    }
    
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
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 })
    }
    
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
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    })

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
