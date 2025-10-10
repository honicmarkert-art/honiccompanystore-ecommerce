import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

export interface Product {
  id: number
  name: string
  description: string
  price: number
  originalPrice: number
  image: string
  gallery: string[]
  category: string
  brand: string
  rating: number
  reviews: number
  inStock: boolean
  freeDelivery?: boolean
  sameDayDelivery?: boolean
  specifications: Record<string, any>
  variants?: any[]
  variantImages?: any[]
  variantConfig?: any
  sku?: string
  model?: string
  views?: number
  video?: string
  view360?: string
}

export interface Category {
  id: number
  name: string
  slug: string
  description?: string
  image?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Server-side data fetching functions
 * These run on the server and can be used in getServerSideProps or getStaticProps
 */

export async function getServerSideProducts(limit = 20, offset = 0): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        price,
        original_price,
        image,
        gallery,
        category,
        brand,
        rating,
        reviews,
        in_stock,
        free_delivery,
        same_day_delivery,
        specifications,
        variants,
        variant_images,
        variant_config,
        sku,
        model,
        views,
        video,
        view_360
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching products:', error)
      return []
    }

    return data?.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      originalPrice: product.original_price,
      image: product.image,
      gallery: product.gallery || [],
      category: product.category,
      brand: product.brand,
      rating: product.rating || 0,
      reviews: product.reviews || 0,
      inStock: product.in_stock,
      freeDelivery: product.free_delivery,
      sameDayDelivery: product.same_day_delivery,
      specifications: product.specifications || {},
      variants: product.variants || [],
      variantImages: product.variant_images || [],
      variantConfig: product.variant_config,
      sku: product.sku,
      model: product.model,
      views: product.views || 0,
      video: product.video,
      view360: product.view_360
    })) || []
  } catch (error) {
    console.error('Error in getServerSideProducts:', error)
    return []
  }
}

export async function getServerSideCategories(): Promise<Category[]> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching categories:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getServerSideCategories:', error)
    return []
  }
}

export async function getServerSideProductById(id: number): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        price,
        original_price,
        image,
        gallery,
        category,
        brand,
        rating,
        reviews,
        in_stock,
        free_delivery,
        same_day_delivery,
        specifications,
        variants,
        variant_images,
        variant_config,
        sku,
        model,
        views,
        video,
        view_360
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('Error fetching product by ID:', error)
      return null
    }

    if (!data) return null

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      price: data.price,
      originalPrice: data.original_price,
      image: data.image,
      gallery: data.gallery || [],
      category: data.category,
      brand: data.brand,
      rating: data.rating || 0,
      reviews: data.reviews || 0,
      inStock: data.in_stock,
      freeDelivery: data.free_delivery,
      sameDayDelivery: data.same_day_delivery,
      specifications: data.specifications || {},
      variants: data.variants || [],
      variantImages: data.variant_images || [],
      variantConfig: data.variant_config,
      sku: data.sku,
      model: data.model,
      views: data.views || 0,
      video: data.video,
      view360: data.view_360
    }
  } catch (error) {
    console.error('Error in getServerSideProductById:', error)
    return null
  }
}




