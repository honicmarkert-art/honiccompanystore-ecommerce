import { MetadataRoute } from 'next'
import { getSupabaseClient } from '@/lib/supabase-server'

// Make sitemap dynamic to avoid memory issues during build
export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Revalidate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://www.honiccompanystore.com'
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    // Removed featured and discover pages as they redirect to /products
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]

  // Dynamic product pages - limit to reduce memory usage during build
  let productPages: MetadataRoute.Sitemap = []
  
  try {
    const supabase = getSupabaseClient()
    // Use is_hidden instead of status, and limit to 500 to reduce memory usage
    const { data: products, error } = await supabase
      .from('products')
      .select('id, slug, updated_at')
      .eq('is_hidden', false)
      .order('updated_at', { ascending: false })
      .limit(500) // Reduced from 1000 to 500 to save memory during build
    
    if (error) {
      // Silently fail - don't break build if sitemap generation fails
      return staticPages
    }
    
    if (products && products.length > 0) {
      productPages = products.map((product) => ({
        url: `${baseUrl}/products/${product.slug || product.id}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
    }
  } catch (error) {
    // Silently fail - return only static pages if product fetch fails
    return staticPages
  }

  return [...staticPages, ...productPages]
}

