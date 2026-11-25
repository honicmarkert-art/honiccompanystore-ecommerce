import type { Metadata } from 'next'
import Link from 'next/link'
import { Home, PackageSearch, Search } from 'lucide-react'
import { StatusScreen, primaryBtn, secondaryBtn } from '@/components/status-screen'

export const metadata: Metadata = { title: 'Page not found | Honic Store', robots: { index: false, follow: true } }

/** Site-wide 404: search, popular places, help. */
export default function NotFound() {
  return (
    <StatusScreen
      code="404 · Page not found"
      icon={<PackageSearch className="h-8 w-8" />}
      title="We couldn't find that page"
      text="The link may be old or mistyped. Search for what you need, or start from the shop."
      footnote={<>Popular: <Link href="/products" className="font-semibold text-orange-600 hover:underline">All products</Link> · <Link href="/categories" className="font-semibold text-orange-600 hover:underline">Categories</Link> · <Link href="/support/order-tracking" className="font-semibold text-orange-600 hover:underline">Track an order</Link> · <Link href="/support" className="font-semibold text-orange-600 hover:underline">Help</Link></>}
    >
      <form action="/products" className="flex w-full gap-2">
        <label className="min-w-0 flex-1"><span className="sr-only">Search products</span>
          <input name="search" placeholder="Search products" className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-neutral-700 dark:bg-neutral-900" />
        </label>
        <button className={primaryBtn} aria-label="Search"><Search className="h-4 w-4" /><span className="hidden sm:inline">Search</span></button>
      </form>
      <Link href="/" className={secondaryBtn}><Home className="h-4 w-4" /> Home</Link>
    </StatusScreen>
  )
}
