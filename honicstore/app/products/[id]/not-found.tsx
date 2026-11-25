import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'

/** Shown (with HTTP 404 / noindex) when a product doesn't exist or has been hidden. */
export default function ProductNotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <SiteHeader />
      <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-500/10">
          <SearchX className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-2xl font-black">Product not found</h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          This product may have been removed or is no longer available.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/products" className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-600">
            Browse products
          </Link>
          <Link href="/" className="rounded-2xl px-6 py-3 text-sm font-bold text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50 dark:text-neutral-200 dark:ring-neutral-800">
            Go home
          </Link>
        </div>
      </main>
    </div>
  )
}
