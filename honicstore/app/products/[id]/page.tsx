import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductDetailErrorBoundary } from '@/components/product-detail-error-boundary'
import { getProductDetail } from '@/lib/product-detail'
import { getCategories } from '@/lib/product-search'
import { ProductDetailClient, ProductDetailFallback } from './_components/product-detail-client'

/**
 * Product detail page.
 *
 * The product is loaded on the server (shared loader + in-memory cache), so the
 * HTML arrives with the product already rendered: no blank spinner, faster first
 * paint, and proper SEO / link-preview metadata. Reviews, supplier info, sold
 * count and related products load in the browser afterwards without blocking.
 */

type Params = { params: Promise<{ id: string }> }
type PageProps = Params & { searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

// /products/2-some-slug → "2"
const parseId = (raw: string) => (decodeURIComponent(raw).match(/^\d+/) || [''])[0]

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.honiccompanystore.com'

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const product = await getProductDetail(parseId(id)).catch(() => null)
  if (!product) return { title: 'Product not found | Honic Company Store' }

  const description = (product.description || `${product.name} — buy online at Honic Company Store, delivered across Tanzania.`)
    .replace(/\s+/g, ' ')
    .slice(0, 160)
  const image = product.image && /^https?:\/\//.test(product.image) ? product.image : undefined
  const url = `${siteUrl}/products/${product.id}-${encodeURIComponent(product.name)}`

            return {
    title: `${product.name} | Honic Company Store`,
    description,
    alternates: { canonical: url },
    openGraph: { title: product.name, description, url, type: 'website', images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: product.name, description, images: image ? [image] : undefined },
  }
}

export default async function ProductDetailPage({ params, searchParams }: PageProps) {
  // Query values are read here and passed down: useSearchParams() in the client
  // would make Next skip server rendering of the whole product section.
  const [{ id }, query] = await Promise.all([params, searchParams])
  const productId = parseId(id)
  // A missing product is a 404 (not-found.tsx); a database error is NOT, so it goes to the error page instead
  const product = productId ? await getProductDetail(productId) : null
  if (!product) notFound()
  // Category slug for the breadcrumb / related products. Matched by the category NAME the shopper sees:
  // ~30% of products have a category_id that contradicts their category name (data issue), so the id
  // alone could link to the wrong category. The id is only used when its name agrees.
  let categorySlug: string | null = null
  if (product?.category) {
    const cats = await getCategories().catch(() => [])
    const text = product.category.trim().toLowerCase()
    const byName = cats.find((c) => c.name.trim().toLowerCase() === text)
    const byId = cats.find((c) => c.id === product.category_id)
    categorySlug = byName?.slug || (byId && byId.name.trim().toLowerCase() === text ? byId.slug : null)
  }

  // Structured data for search results (price, availability, rating)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image && /^https?:\/\//.test(product.image) ? [product.image] : undefined,
    description: product.description?.slice(0, 500) || undefined,
    sku: product.sku || undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    aggregateRating: product.rating && product.reviews ? { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviews } : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'TZS',
      price: product.price,
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  }
                
                return (
      <ProductDetailErrorBoundary>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Suspense fallback={<ProductDetailFallback />}>
        <ProductDetailClient key={product.id} initialProduct={product} categorySlug={categorySlug} returnTo={first(query.returnTo)} from={first(query.from)} />
      </Suspense>
      </ProductDetailErrorBoundary>
  )
}
