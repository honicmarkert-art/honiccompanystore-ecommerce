import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { analyzeImage, extractSearchKeywords, extractKeywordsFromFilename } from '@/lib/image-recognition'
import { fuzzySearchProducts } from '@/lib/fuzzy-search'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export async function GET() {
  return NextResponse.json({ 
    message: 'Image search API is working',
    aiEnabled: !!process.env.GOOGLE_CLOUD_VISION_API_KEY,
    status: 'ready'
  })
}

export async function POST(request: NextRequest) {
  try {
    logger.log('Image search API called')
    
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    
    logger.log('Form data keys:', Array.from(formData.keys()))
    logger.log('Image file received:', {
      name: imageFile?.name,
      type: imageFile?.type,
      size: imageFile?.size,
      hasFile: !!imageFile
    })
    
    if (!imageFile || imageFile.size === 0) {
      logger.log('No valid image file provided')
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Validate file type
    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image file too large (max 10MB)' }, { status: 400 })
    }

    // Convert image to buffer for analysis
    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Analyze image using Google Cloud Vision API (or fallback to filename)
    const analysis = await analyzeImage(buffer)
    const keywords = extractSearchKeywords(analysis, imageFile.name)
    
    logger.log('Image analysis complete:', {
      keywords,
      confidence: analysis.confidence,
      hasText: analysis.text.length > 0,
      hasObjects: analysis.objects.length > 0,
      aiEnabled: !!process.env.GOOGLE_CLOUD_VISION_API_KEY
    })

    if (keywords.length === 0) {
      logger.log('No keywords extracted from image')
      return NextResponse.json({ 
        error: 'Could not extract keywords from image. Try uploading an image with visible text or product labels.' 
      }, { status: 400 })
    }

    // Fetch all products for fuzzy search (with reasonable limit)
    const { data: allProducts, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .limit(5000) // Fetch up to 5000 products for search
    
    if (fetchError) {
      console.error('Error fetching products:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    if (!allProducts || allProducts.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        keywords,
        searchType: 'image',
        totalCount: 0,
        message: 'No products found in database'
      })
    }

    // Convert to searchable format - include variant data
    const searchableProducts = allProducts.map((product: any) => {
      // Use product_variants (raw from database) or variants (if already transformed)
      const rawVariants = product.product_variants || product.variants || []
      
      // Collect all variant data for comprehensive search
      const variantSkus = rawVariants.map((v: any) => v.sku).filter(Boolean)
      const variantNames = rawVariants.map((v: any) => v.name).filter(Boolean)
      
      // Collect variant attributes (regular attributes object)
      const variantAttributes = rawVariants.flatMap((v: any) => 
        v.attributes ? Object.values(v.attributes) : []
      ).filter(Boolean)
      
      // Collect variant primaryValues (for primary-dependent variants)  
      const variantPrimaryValues = rawVariants.flatMap((v: any) => 
        (v.primary_values || v.primaryValues)?.map((pv: any) => pv.value) || []
      ).filter(Boolean)
      
      // Collect variant multiValues (for multi-select attributes)
      const variantMultiValues = rawVariants.flatMap((v: any) => 
        (v.multi_values || v.multiValues) ? Object.values(v.multi_values || v.multiValues).flat() : []
      ).filter(Boolean)
      
      // Combine all searchable text including all variant data
      const combinedText = [
        product.name || '',
        product.description || '',
        product.category || '',
        product.brand || '',
        product.sku || '',
        product.model || '',
        ...variantSkus,
        ...variantNames,
        ...variantAttributes,
        ...variantPrimaryValues,
        ...variantMultiValues
      ].join(' ')
      
      return {
        id: product.id,
        name: combinedText, // Use combined text for comprehensive search
        description: product.description || '',
        category: product.category || '',
        brand: product.brand || '',
        price: product.price || 0,
        sku: product.sku,
        model: product.model,
        tags: []
      }
    })

    // Use fuzzy search with all extracted keywords
    let searchResults: any[] = []
    
    // Search with each keyword and combine results
    for (const keyword of keywords.slice(0, 3)) { // Use top 3 keywords
      const results = fuzzySearchProducts(searchableProducts, keyword, {
        maxResults: 20,
        minScore: 0.4, // More lenient for image search
        useSynonyms: true
      })
      
      // Add results that aren't already in the list
      results.forEach(result => {
        if (!searchResults.find(r => r.id === result.id)) {
          searchResults.push(result)
        }
      })
    }

    // Limit to top 20 results
    searchResults = searchResults.slice(0, 20)

    // Map back to full product data
    const productIds = new Set(searchResults.map(r => r.id))
    const matchedProducts = allProducts.filter((p: any) => productIds.has(p.id))

    // Transform products to match expected format
    const transformedProducts = matchedProducts.map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      originalPrice: product.original_price,
      rating: product.rating,
      reviews: product.reviews,
      image: product.image,
      category: product.category,
      brand: product.brand,
      inStock: product.in_stock,
      freeDelivery: product.free_delivery,
      sameDayDelivery: product.same_day_delivery,
      variants: product.variants || [],
      variantConfig: product.variant_config || null,
      specifications: typeof product.specifications === 'string' 
        ? JSON.parse(product.specifications) 
        : product.specifications || {},
      gallery: product.gallery || [],
      sku: product.sku,
      model: product.model,
      views: product.views,
      video: product.video,
      view360: product.view360,
      stockQuantity: product.stock_quantity,
      variantImages: product.variant_images || []
    }))

    logger.log('Image search results:', { 
      keywordsCount: keywords.length, 
      resultsCount: transformedProducts.length,
      confidence: analysis.confidence 
    })

    return NextResponse.json({
      success: true,
      products: transformedProducts,
      keywords,
      searchType: 'image',
      totalCount: transformedProducts.length,
      analysis: {
        detectedText: analysis.text.slice(0, 5),
        detectedObjects: analysis.objects.slice(0, 5),
        confidence: analysis.confidence,
        aiEnabled: !!process.env.GOOGLE_CLOUD_VISION_API_KEY
      }
    })

  } catch (error) {
    console.error('Error in image search:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
