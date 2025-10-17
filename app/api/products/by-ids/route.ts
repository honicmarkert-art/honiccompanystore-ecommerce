import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

function getClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value },
        set() {},
        remove() {},
      },
    },
  )
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const idsParam = url.searchParams.get('ids')
    
    if (!idsParam) {
      return NextResponse.json({ products: [] })
    }

    const ids = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    
    if (ids.length === 0) {
      return NextResponse.json({ products: [] })
    }

    const supabase = getClient(req)
    
    // Try to fetch from Supabase first
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false })

      if (!error && data) {
        const products = data.map(product => ({
          id: product.id,
          name: product.name || 'Unnamed Product',
          description: product.description || '',
          price: product.price || 0,
          originalPrice: product.original_price || product.price || 0,
          image: product.image || product.thumbnail_url || '/placeholder.jpg',
          gallery: product.gallery || [],
          category: product.category || 'General',
          brand: product.brand || '',
          rating: product.rating || 0,
          reviews: product.reviews || 0,
          inStock: product.in_stock !== false,
          freeDelivery: product.free_delivery || false,
          sameDayDelivery: product.same_day_delivery || false,
          specifications: product.specifications || {},
          variants: product.variants || [],
          variantImages: product.variant_images || [],
          variantConfig: product.variant_config || null,
          sku: product.sku || '',
          model: product.model || '',
          views: product.views || 0,
          video: product.video || '',
          view360: product.view360 || ''
        }))

        return NextResponse.json({ products })
      }
    } catch (supabaseError) {
      console.log('Supabase error, falling back to static data:', supabaseError)
    }

    // Fallback to static data
    const staticProducts = [
      {
        id: 1,
        name: 'Arduino Uno R3 Development Board',
        description: 'The Arduino Uno is a microcontroller board based on the ATmega328P.',
        price: 89.99,
        originalPrice: 99.99,
        image: '/placeholder.jpg',
        gallery: ['/placeholder.jpg'],
        category: 'Electronics',
        brand: 'Arduino',
        rating: 4.8,
        reviews: 1250,
        inStock: true,
        freeDelivery: true,
        sameDayDelivery: false,
        specifications: {},
        variants: [],
        variantImages: [],
        variantConfig: null,
        sku: 'ARDUINO-UNO',
        model: 'R3',
        views: 0,
        video: '',
        view360: ''
      },
      {
        id: 2,
        name: 'DHT22 Digital Temperature and Humidity Sensor',
        description: 'High precision temperature and humidity sensor module.',
        price: 34.50,
        originalPrice: 34.50,
        image: '/placeholder.jpg',
        gallery: ['/placeholder.jpg'],
        category: 'Sensors',
        brand: 'Generic',
        rating: 4.6,
        reviews: 890,
        inStock: true,
        freeDelivery: true,
        sameDayDelivery: false,
        specifications: {},
        variants: [],
        variantImages: [],
        variantConfig: null,
        sku: 'DHT22-SENSOR',
        model: 'DHT22',
        views: 0,
        video: '',
        view360: ''
      }
    ]

    const filteredProducts = staticProducts.filter(product => ids.includes(product.id))
    return NextResponse.json({ products: filteredProducts })

  } catch (error) {
    console.error('Error fetching products by IDs:', error)
    return NextResponse.json({ products: [] })
  }
}
