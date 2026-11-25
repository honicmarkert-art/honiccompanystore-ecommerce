import { createClient } from '@supabase/supabase-js'
import { getCachedData, setCachedData, CACHE_TTL } from '@/lib/database-optimization'

/**
 * Loads one visible product with its variants and shapes it for the product
 * detail page. Shared by GET /api/products/[id] and the server-rendered
 * product page so both return exactly the same data (and share the cache).
 *
 * Returns null when the product does not exist or is hidden. Throws on a database error,
 * so callers can tell "not found" (404) apart from "couldn’t load" (error page / 500).
 */
export async function getProductDetail(productId: string | number): Promise<ProductDetail | null> {
  const id = String(productId)
  if (!/^\d+$/.test(id)) return null

  const cacheKey = `product:${id}`
  const cached = getCachedData(cacheKey)
  if (cached) return cached as ProductDetail

  const publicClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data: product, error } = await publicClient
    .from('products')
    .select(`
      *,
      product_variants (*)
    `)
    .eq('id', id)
    .eq('is_hidden', false)
    .maybeSingle()

  if (error) throw new Error(`Product ${id} could not be loaded: ${error.message}`)
  if (!product) return null

  const transformed = transformProduct(product)
  setCachedData(cacheKey, transformed, CACHE_TTL.PRODUCT_DETAIL)
  return transformed
}

export type ProductDetail = ReturnType<typeof transformProduct>

function transformProduct(product: any) {
  let parsedSpecifications: Record<string, unknown> = {}
  if (product.specifications) {
    if (typeof product.specifications === 'string') {
      try {
        parsedSpecifications = JSON.parse(product.specifications)
      } catch {
        parsedSpecifications = {}
      }
    } else if (typeof product.specifications === 'object' && product.specifications !== null) {
      parsedSpecifications = product.specifications
    }
  }

  return {
    id: product.id as number,
    name: product.name as string,
    originalPrice: product.original_price as number,
    price: product.price as number,
    rating: product.rating as number,
    reviews: product.reviews as number,
    image: product.image as string | null,
    category_id: product.category_id as string | null,
    category: product.category as string | null,
    brand: product.brand as string | null,
    description: product.description as string | null,
    specifications: parsedSpecifications,
    gallery: (product.gallery || []) as string[],
    sku: product.sku as string | null,
    model: product.model as string | null,
    views: product.views as number,
    video: product.video as string | null,
    view360: product.view360 as string | null,
    inStock: product.in_stock as boolean,
    stockQuantity: product.stock_quantity as number,
    freeDelivery: product.free_delivery as boolean,
    /** parcel size for delivery fees: small | medium | large (empty = standard) */
    shippingSize: (product.shipping_size as string | null) ?? null,
    sameDayDelivery: product.same_day_delivery as boolean,
    importChina: !!product.import_china,
    return_time_type: product.return_time_type as string | undefined,
    return_time_value: product.return_time_value as number | undefined,
    variants: (product.product_variants?.map((variant: any) => {
      const attributes = variant.attributes || {}
      const quantities = variant.stock_quantities || {}

      // Remove technical *_quantity fields from attributes
      const cleanAttributes = { ...attributes }
      Object.keys(cleanAttributes).forEach((key) => {
        if (key.endsWith('_quantity') || key === '_quantities') {
          delete cleanAttributes[key]
        }
      })

      let primaryValues = variant.primary_values || variant.primaryValues || []
      if (typeof primaryValues === 'string') {
        try {
          primaryValues = JSON.parse(primaryValues)
        } catch {
          primaryValues = []
        }
      }
      if (!Array.isArray(primaryValues)) primaryValues = []

      const hasStockNumber = typeof variant.stock_quantity === 'number'
      return {
        id: variant.id,
        price: variant.price,
        image: variant.image,
        sku: variant.sku,
        model: variant.model,
        variantType: variant.variant_type,
        attributes: cleanAttributes,
        quantities,
        primaryAttribute: variant.primary_attribute,
        dependencies: variant.dependencies || {},
        primaryValues,
        primary_values: primaryValues,
        stockQuantity: hasStockNumber ? variant.stock_quantity : undefined,
        stock_quantity: hasStockNumber ? variant.stock_quantity : undefined,
        inStock: hasStockNumber ? variant.stock_quantity > 0 : true,
        in_stock: hasStockNumber ? variant.stock_quantity > 0 : true,
        variant_name: variant.variant_name || null,
      }
    }) || []) as ProductVariantDetail[],
    variantConfig: (() => {
      const config = product.variant_config || {}
      const isTechnical = (attr: string) =>
        attr.endsWith('_quantity') || attr === '_quantities' || attr === 'quantities' || attr.startsWith('_')
      if (config.attributeOrder) config.attributeOrder = config.attributeOrder.filter((a: string) => !isTechnical(a))
      if (config.primaryAttributes) config.primaryAttributes = config.primaryAttributes.filter((a: string) => !isTechnical(a))
      return config
    })(),
    variantImages: ((product.variant_images || []) as any[])
      .map((img: any): { imageUrl: string } => {
        if (typeof img === 'string') return { imageUrl: img }
        if (img && typeof img === 'object' && img.imageUrl) return { imageUrl: img.imageUrl }
        return { imageUrl: String(img || '') }
      })
      .filter((img) => img.imageUrl),
    specificationImages: (() => {
      const images = product.specification_images || []
      if (typeof images === 'string') {
        try {
          return JSON.parse(images)
        } catch {
          return []
        }
      }
      return Array.isArray(images) ? images : []
    })() as any[],
  }
}

export type ProductVariantDetail = {
  id: number
  price: number
  image: string | null
  sku: string | null
  model?: string | null
  variantType?: string
  attributes: Record<string, unknown>
  quantities: Record<string, unknown>
  primaryAttribute?: string
  dependencies: Record<string, unknown>
  primaryValues: unknown[]
  primary_values: unknown[]
  stockQuantity?: number
  stock_quantity?: number
  inStock: boolean
  in_stock: boolean
  variant_name: string | null
  originalPrice?: number
}
