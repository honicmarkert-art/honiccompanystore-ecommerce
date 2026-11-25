import type { ProductDetail, ProductVariantDetail } from '@/lib/product-detail'

export type { ProductDetail, ProductVariantDetail }

export type Review = {
  id: string | number
  userName: string
  userAvatar?: string | null
  rating: number
  comment?: string | null
  images?: string[]
  date: string
  helpful?: number
}

export type SupplierInfo = {
  companyName: string | null
  companyLogo: string | null
  isVerified: boolean
  detailSentence: string | null
  rating: number | null
  reviewCount: number | null
  supplierId?: string | null
  productCount: number | null
  totalViews: number | null
  region: string | null
}

/** True for absolute URLs or root-relative paths — rejects junk like "supabase.co". */
export const isUsableImage = (src?: string | null): src is string =>
  !!src && (/^https?:\/\//i.test(src) || src.startsWith('/'))

export const isSupabaseImage = (src?: string | null) =>
  !!src && (src.includes('supabase.co') || src.includes('/storage/v1/object/public/'))

export const isDirectVideoFile = (url?: string | null) => !!url && /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url)
export const isYouTubeUrl = (url?: string | null) => !!url && (url.includes('youtube.com') || url.includes('youtu.be'))

export function toEmbedUrl(url?: string | null): string {
  if (!url) return ''
  if (url.includes('/embed/')) return url
  if (url.includes('youtube.com/watch')) {
    const videoId = url.split('v=')[1]?.split('&')[0]
    if (videoId) return `https://www.youtube.com/embed/${videoId}`
  }
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0]
    if (videoId) return `https://www.youtube.com/embed/${videoId}`
  }
  return url
}

export const variantStock = (v?: ProductVariantDetail | null) =>
  v ? Number(v.stock_quantity ?? v.stockQuantity ?? 0) || 0 : 0

/** Same rule as before: sum of variant stock, falling back to product stock. */
export function totalStock(p: ProductDetail): number {
  let total = 0
  if (p.variants?.length) total = p.variants.reduce((sum, v) => sum + variantStock(v), 0)
  if (total === 0 && p.stockQuantity) total = Number(p.stockQuantity) || 0
  return total
}

/** Real (non-padded, de-duplicated) gallery images, main image first. */
export function galleryImages(p: ProductDetail): string[] {
  const list: string[] = []
  const push = (s?: string | null) => {
    const v = s?.trim()
    if (isUsableImage(v) && !v.startsWith('/placeholder') && !list.includes(v)) list.push(v)
  }
  push(p.image)
  p.variantImages?.forEach((img) => push(img.imageUrl))
  p.variants?.forEach((v) => push(v.image))
  p.gallery?.forEach((g) => push(g))
  return list.slice(0, 10)
}

/**
 * Any quantity can be bought. (The old "min 5 under 500 TZS" rule is gone; the real limit is the
 * payment gateway's TSh 500 minimum per order, enforced on the order total at cart/checkout.)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const minQuantityFor = (_price: number) => 1

export const variantLabel = (v: ProductVariantDetail, index: number) => {
  if (v.variant_name) return v.variant_name
  const attrs = Object.entries(v.attributes || {})
    .map(([, val]) => (Array.isArray(val) ? val.join('/') : String(val)))
    .filter(Boolean)
  return attrs.length ? attrs.join(' · ') : `Option ${index + 1}`
}
