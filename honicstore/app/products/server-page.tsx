import { getServerSideProducts, getServerSideCategories } from '@/lib/server-data'
import { ProductsClientPage } from './client-page'

interface ProductsServerPageProps {
  searchParams: {
    category?: string
    brand?: string
    search?: string
    page?: string
  }
}

/**
 * Server-side rendered products page
 * 
 * Benefits:
 * - Initial data loaded on server (no client-side API calls)
 * - Better SEO and performance
 * - Reduced client-side JavaScript
 * - Faster initial page load
 */
export default async function ProductsServerPage({ searchParams }: ProductsServerPageProps) {
  const { category, brand, search, page = '1' } = searchParams
  const pageNumber = parseInt(page, 10) || 1
  const limit = 20
  const offset = (pageNumber - 1) * limit

  // Fetch initial data on the server
  const [initialProducts, initialCategories] = await Promise.all([
    getServerSideProducts(limit, offset),
    getServerSideCategories()
  ])

  return (
    <ProductsClientPage
      initialProducts={initialProducts}
      initialCategories={initialCategories}
      searchParams={searchParams}
    />
  )
}

// Enable static generation for better performance
export async function generateStaticParams() {
  // Generate static params for common category pages
  const categories = await getServerSideCategories()
  
  return categories.slice(0, 10).map((category) => ({
    category: category.slug,
  }))
}




