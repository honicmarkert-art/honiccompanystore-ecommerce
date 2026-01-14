import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateServerSession } from '@/lib/security-server'
import { logger } from '@/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function DELETE(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateServerSession(request)
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId, imageUrl } = await request.json()

    if (!productId || !imageUrl) {
      return NextResponse.json({ 
        error: 'Product ID and image URL are required' 
      }, { status: 400 })
    }

    logger.log('🗑️ Deleting variant image:', { productId, imageUrl })

    // Step 1: Get the current product data
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, name, variant_images')
      .eq('id', productId)
      .single()

    if (fetchError) {
      return NextResponse.json({ 
        error: 'Failed to fetch product' 
      }, { status: 500 })
    }

    if (!product) {
      return NextResponse.json({ 
        error: 'Product not found' 
      }, { status: 404 })
    }

    // Step 2: Remove the image from variant_images array
    const updatedVariantImages = (product.variant_images || []).filter(
      (variantImg: any) => variantImg.imageUrl !== imageUrl
    )

    logger.log('📊 Original variant images:', product.variant_images?.length || 0)
    logger.log('📊 Updated variant images:', updatedVariantImages.length)

    // Step 3: Update the product in database
    const { error: updateError } = await supabase
      .from('products')
      .update({ variant_images: updatedVariantImages })
      .eq('id', productId)

    if (updateError) {
      return NextResponse.json({ 
        error: 'Failed to update product' 
      }, { status: 500 })
    }

    // Step 4: Delete the file from storage
    try {
      // Extract filename from URL
      const urlParts = imageUrl.split('/')
      const filename = urlParts[urlParts.length - 1]
      
      logger.log('🗑️ Deleting file from storage:', filename)

      const { error: deleteError } = await supabase.storage
        .from('variant-images')
        .remove([filename])

      if (deleteError) {
        // Don't fail the request if storage deletion fails
        // The database update was successful
        logger.log('⚠️ File deletion from storage failed, but database was updated')
      } else {
        logger.log('✅ File deleted from storage successfully')
      }
    } catch (storageError) {
      // Continue - database update was successful
    }

    logger.log('✅ Variant image deletion completed')

    // Clear product cache to ensure immediate visibility
    const { clearCache } = await import('@/lib/database-optimization')
    clearCache()

    return NextResponse.json({
      success: true,
      message: 'Variant image deleted successfully',
      remainingImages: updatedVariantImages.length
    })

  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

