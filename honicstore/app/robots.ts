import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                  process.env.NEXT_PUBLIC_APP_URL || 
                  process.env.NEXT_PUBLIC_WEBSITE_URL || 
                  'https://www.honiccompanystore.com'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', '/siem-dashboard/', '/admin/', '/checkout/return'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
