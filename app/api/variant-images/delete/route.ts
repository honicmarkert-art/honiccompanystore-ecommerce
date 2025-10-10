import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateServerSession } from '@/lib/security-server'
import { logger } from '@/lib/logger'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY'

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

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
      console.error('Error fetching product:', fetchError)
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
      console.error('Error updating product:', updateError)
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
        console.error('Error deleting file from storage:', deleteError)
        // Don't fail the request if storage deletion fails
        // The database update was successful
        logger.log('⚠️ File deletion from storage failed, but database was updated')
      } else {
        logger.log('✅ File deleted from storage successfully')
      }
    } catch (storageError) {
      console.error('Storage deletion error:', storageError)
      // Continue - database update was successful
    }

    logger.log('✅ Variant image deletion completed')

    return NextResponse.json({ 
      success: true, 
      message: 'Variant image deleted successfully',
      remainingImages: updatedVariantImages.length
    })

  } catch (error) {
    console.error('Error in variant image deletion:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

