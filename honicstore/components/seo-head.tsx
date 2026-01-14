'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface SEOHeadProps {
  title?: string
  description?: string
  image?: string
  product?: {
    name: string
    price: string
    category: string
    image: string
  }
}

export function SEOHead({ title, description, image, product }: SEOHeadProps) {
  const pathname = usePathname()

  useEffect(() => {
    // Update meta tags for SEO
    if (title) {
      document.title = title
      
      // Update meta description
      let metaDescription = document.querySelector('meta[name="description"]')
      if (!metaDescription) {
        metaDescription = document.createElement('meta')
        metaDescription.setAttribute('name', 'description')
        document.head.appendChild(metaDescription)
      }
      metaDescription.setAttribute('content', description || title)

      // Update Open Graph tags
      const ogTitle = document.querySelector('meta[property="og:title"]')
      if (ogTitle) ogTitle.setAttribute('content', title)
      
      const ogDescription = document.querySelector('meta[property="og:description"]')
      if (ogDescription && description) ogDescription.setAttribute('content', description)
      
      const ogUrl = document.querySelector('meta[property="og:url"]')
      if (ogUrl) {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://www.honiccompanystore.com'
        ogUrl.setAttribute('content', `${baseUrl}${pathname}`)
      }

      // Update Twitter Card tags
      const twitterTitle = document.querySelector('meta[name="twitter:title"]')
      if (twitterTitle) twitterTitle.setAttribute('content', title)
      
      const twitterDescription = document.querySelector('meta[name="twitter:description"]')
      if (twitterDescription && description) twitterDescription.setAttribute('content', description)
    }

    // Product-specific SEO
    if (product) {
      const ogImage = document.querySelector('meta[property="og:image"]')
      if (ogImage) ogImage.setAttribute('content', product.image)
      
      const twitterImage = document.querySelector('meta[name="twitter:image"]')
      if (twitterImage) twitterImage.setAttribute('content', product.image)

      // Add structured data for products
      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: description,
        image: product.image,
        category: product.category,
        offers: {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: 'TZS',
          availability: 'https://schema.org/InStock'
        }
      }

      let scriptTag = document.querySelector('script[type="application/ld+json"][data-product]')
      if (scriptTag) {
        scriptTag.textContent = JSON.stringify(structuredData)
      } else {
        scriptTag = document.createElement('script')
        scriptTag.setAttribute('type', 'application/ld+json')
        scriptTag.setAttribute('data-product', 'true')
        scriptTag.textContent = JSON.stringify(structuredData)
        document.head.appendChild(scriptTag)
      }
    }
  }, [title, description, image, product, pathname])

  return null
}

