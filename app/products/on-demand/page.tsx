import { getServerSideProducts, getServerSideCategories } from '@/lib/server-data'
import { ProductsClientPage } from '../client-page'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

/**
 * On-demand products page with server-side rendering
 * 
 * This page demonstrates:
 * 1. Server-side data fetching (no client-side API calls on initial load)
 * 2. On-demand loading (user clicks "Load Products" button)
 * 3. SWR rate limiting (prevents duplicate requests)
 * 4. Graceful 429 error handling
 */
export default async function OnDemandProductsPage() {
  // Fetch initial data on the server (no client-side API calls)
  const [initialProducts, initialCategories] = await Promise.all([
    getServerSideProducts(20, 0), // 20 products, offset 0
    getServerSideCategories()
  ])

  return (
    <ProductsClientPage
      initialProducts={initialProducts}
      initialCategories={initialCategories}
      searchParams={{}}
    />
  )
}

// Enable static generation for better performance
export async function generateStaticParams() {
  return []
}

// Revalidate every 5 minutes for fresh data
export const revalidate = 300




