import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Sparkles } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { CategoryIcon } from '@/components/home/category-icon'
import { getCategoryTree } from '@/lib/home-data'

/**
 * All categories — the store's real category tree with live product counts.
 * (The old page showed made-up categories and counts.) Empty categories are listed as "coming soon".
 */
export const revalidate = 300

export const metadata: Metadata = {
  title: 'All categories | Honic Store',
  description: 'Browse sensors, microcontrollers, power, motors, tools, kits and more.',
}

const href = (slug: string) => `/products?category=${encodeURIComponent(slug)}`

export default async function CategoriesPage() {
  const tree = await getCategoryTree()
  const withProducts = tree.filter((c) => c.count > 0)
  const comingSoon = tree.filter((c) => c.count === 0)

  return (
    <div className="min-h-screen bg-[#f6f6f7] text-neutral-950">
      <SiteHeader returnTo="/" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-sm text-neutral-500 [&_a]:inline-block [&_a]:py-2">
          <Link href="/" className="hover:text-orange-600">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-neutral-900">Categories</span>
        </nav>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">All categories</h1>
            <p className="mt-1 text-neutral-500">Pick a category, or describe your project and let AI find the parts.</p>
          </div>
          <Link href="/products?mode=ai" className="inline-flex items-center gap-2 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800">
            <Sparkles className="h-4 w-4 text-orange-400" /> Ask AI instead
          </Link>
        </div>

        {withProducts.length === 0 && (
          <p className="rounded-3xl bg-white p-8 text-center text-neutral-500">Categories couldn&apos;t be loaded right now. <Link href="/products" className="font-semibold text-orange-600">Browse all products</Link>.</p>
        )}

        <div className="space-y-6">
          {withProducts.map((main) => (
            <section key={main.id} className="rounded-3xl border border-neutral-200/70 bg-white p-5 sm:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <Link href={href(main.slug)} className="group flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md shadow-orange-500/30">
                    <CategoryIcon slug={main.slug} className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-xl font-black tracking-tight group-hover:text-orange-600">{main.name}</span>
                    <span className="block text-sm text-neutral-500">{main.count} {main.count === 1 ? "product" : "products"}</span>
                  </span>
                </Link>
                <Link href={href(main.slug)} className="-my-2 flex items-center gap-1 py-2 text-sm font-bold text-orange-600 hover:text-orange-700">
                  Shop all <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              {main.children.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {main.children.map((sub) => {
                    const empty = sub.count === 0
                    return (
                      <Link
                        key={sub.id}
                        href={href(sub.slug)}
                        aria-disabled={empty}
                        className={`group flex items-center gap-3 rounded-2xl border p-3 transition ${empty ? 'pointer-events-none border-dashed border-neutral-200 opacity-50' : 'border-neutral-200/70 hover:border-orange-300 hover:bg-orange-50/40'}`}
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600 transition group-hover:bg-orange-500 group-hover:text-white">
                          <CategoryIcon slug={sub.slug} className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{sub.name}</span>
                          <span className="block text-xs text-neutral-500">{empty ? 'Coming soon' : `${sub.count} ${sub.count === 1 ? 'product' : 'products'}`}</span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          ))}
        </div>

        {comingSoon.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-bold">Coming soon</h2>
            <p className="mt-1 text-sm text-neutral-500">We&apos;re adding products to these categories.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {comingSoon.map((c) => (
                <span key={c.id} className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-neutral-500 ring-1 ring-neutral-200">
                  <CategoryIcon slug={c.slug} className="h-4 w-4" />{c.name}
                </span>
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
