import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'
import { ProductDetailErrorBoundary } from '@/components/product-detail-error-boundary'
import { ProductDetailFallback } from '@/app/products/[id]/_components/product-detail-client'
import { getProductDetail } from '@/lib/product-detail'
import { getFreightSettings } from '@/lib/import-freight-server'
import { whatsappLink } from '@/lib/contact'
import { ChinaProduct, type RelatedItem } from './china-product'

/**
 * Buy from China: product page for items imported to order. Its own page and look (not the regular
 * product page) with the same features (zoom gallery, video, options, reviews, save, share, sticky buy
 * bar) plus import ones (air / sea shipping, arrival dates, price per piece by quantity, the journey).
 * Cart and checkout are shared. A product that is not an import item opens its regular page.
 */
export const revalidate = 300

type Props = { params: Promise<{ id: string }> }
const parseId = (raw: string) => (decodeURIComponent(raw).match(/^\d{1,12}/) || [''])[0]
const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://honiccompanystore.com').replace(/\/$/, '')
/** importer bookkeeping (Taobao ids, source, listing language): never sent to the browser */
const internalKey = (k: string) => /^(taobao|source$|listing$|language$|import_|_)/i.test(k.trim())
const publicSpecs = (o: Record<string, unknown> | null | undefined) =>
  Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => !internalKey(k) && v != null && String(v).trim() !== '')) as Record<string, string>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const p = await getProductDetail(parseId(id)).catch(() => null)
  if (!p) return { title: 'Item not found | Honic Company Store' }
  return {
    title: `${p.name} | Buy from China | Honic`,
    description: (p.description || `${p.name}: imported to order from China, shipped by air or sea to Tanzania.`).replace(/\s+/g, ' ').slice(0, 160),
    alternates: { canonical: `/buy-from-china/${p.id}` },
    openGraph: { title: p.name, url: `${site}/buy-from-china/${p.id}`, images: p.image && /^https:\/\//.test(p.image) ? [{ url: p.image }] : undefined },
  }
}

export default async function ChinaProductPage({ params }: Props) {
  const { id } = await params
  const pid = parseId(id)
  if (!pid) notFound()
  const raw = await getProductDetail(pid)
  if (!raw) notFound()
  if (!raw.importChina) redirect(`/products/${pid}`)
  const product = {
    ...raw,
    specifications: publicSpecs(raw.specifications as Record<string, unknown>),
    variants: (raw.variants || []).map((v) => ({ ...v, specifications: publicSpecs(v.specifications) })),
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const [{ data: size }, settings, { data: others }] = await Promise.all([
    db.from('products').select('weight_kg, length_cm, width_cm, height_cm, sold_count').eq('id', pid).maybeSingle(),
    getFreightSettings(),
    db.from('products').select('id, name, price, original_price, image, category, sold_count').eq('import_china', true).or('is_hidden.is.null,is_hidden.eq.false').neq('id', pid).limit(60),
  ])
  // more from the import shelf: same category first, then the most bought
  const related: RelatedItem[] = (others || [])
    .map((o) => ({ id: Number(o.id), name: String(o.name || ''), price: Number(o.price) || 0, originalPrice: Number(o.original_price) > Number(o.price) ? Number(o.original_price) : null, image: typeof o.image === 'string' && o.image.startsWith('https://') ? o.image : null, sameCategory: !!raw.category && o.category === raw.category, sold: Number(o.sold_count) || 0 }))
    .sort((a, b) => Number(b.sameCategory) - Number(a.sameCategory) || b.sold - a.sold)
    .slice(0, 10)

  const url = `${site}/buy-from-china/${product.id}`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: product.name, url,
    image: product.image && /^https:\/\//.test(product.image) ? [product.image] : undefined,
    description: product.description?.slice(0, 500) || undefined, sku: product.sku || undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    aggregateRating: product.rating && product.reviews ? { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviews } : undefined,
    offers: { '@type': 'Offer', priceCurrency: 'TZS', price: product.price, url, availability: 'https://schema.org/PreOrder' },
  }

  // same layout as the regular product page (header, gallery, buy box, tabs, sticky bar), in China mode
  return (
    <ProductDetailErrorBoundary>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Suspense fallback={<ProductDetailFallback />}>
        <ChinaProduct
          product={product}
          size={{ weightKg: size?.weight_kg ?? null, lengthCm: size?.length_cm ?? null, widthCm: size?.width_cm ?? null, heightCm: size?.height_cm ?? null }}
          settings={settings}
          related={related}
          askLink={whatsappLink(`Hello Honic, about this China item: ${product.name} ${url} — what is the shipping price to Tanzania?`)}
        />
      </Suspense>
    </ProductDetailErrorBoundary>
  )
}
