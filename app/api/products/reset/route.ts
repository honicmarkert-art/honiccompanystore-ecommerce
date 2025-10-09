import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST /api/products/reset - Reset to default products
export async function POST(request: NextRequest) {
  try {
    // Import the default products
    const { allProducts } = await import('@/data/products')
    
    // Clear existing products
    await supabase.from('product_variants').delete().neq('id', 0)
    await supabase.from('products').delete().neq('id', 0)
    
    // Insert default products
    for (const product of allProducts) {
      const supabaseProduct = {
        name: product.name,
        original_price: product.originalPrice,
        price: product.price,
        rating: product.rating,
        reviews: product.reviews,
        image: product.image,
        category: product.category,
        brand: product.brand,
        description: product.description,
        specifications: product.specifications || {},
        gallery: product.gallery || [],
        sku: product.sku,
        model: product.model,
        views: product.views,
        video: product.video,
        view360: product.view360,
        in_stock: product.inStock !== undefined ? product.inStock : true,
        stock_quantity: product.stockQuantity,
        free_delivery: product.freeDelivery || false,
        same_day_delivery: product.sameDayDelivery || false,
        variant_config: product.variantConfig
      }

      const { data: newProduct, error } = await supabase
        .from('products')
        .insert(supabaseProduct)
        .select()
        .single()

      if (error) {
        console.error('Error inserting default product:', error)
        continue
      }

      // Add variants if they exist
      if (product.variants && product.variants.length > 0) {
        const variants = product.variants.map((variant: any) => ({
          product_id: newProduct.id,
          price: variant.price,
          image: variant.image,
          sku: variant.sku,
          model: variant.model,
          variant_type: variant.variantType,
          attributes: variant.attributes || {},
          primary_attribute: variant.primaryAttribute,
          dependencies: variant.dependencies || {},
          primary_values: variant.primaryValues || [],
          multi_values: variant.multiValues || {}
        }))

        await supabase.from('product_variants').insert(variants)
      }
    }
    
    return NextResponse.json({ success: true, message: 'Database populated with default products' })
  } catch (error) {
    console.error('Error resetting products:', error)
    return NextResponse.json({ error: 'Failed to reset products' }, { status: 500 })
  }
}
