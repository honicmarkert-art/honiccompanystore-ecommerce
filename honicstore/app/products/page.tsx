import type { Metadata } from 'next'
import { getCategoryTree } from '@/lib/home-data'
import MarketplacePage from './_components/marketplace'

/**
 * /products — the Marketplace. The page itself is a client component (search, filters, cart);
 * this server wrapper only gives each view its own title, description and canonical URL, so
 * category pages can rank in Google and search-result pages stay out of the index.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || ''

const STORE = 'Honic Company Store'
const SORT_TITLES: Record<string, string> = { popular: 'Best sellers', newest: 'New arrivals', rating: 'Top rated' }

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams
  const q = one(sp.search) || one(sp.q)
  const sub = one(sp.subCategory)
  const main = one(sp.mainCategory) || one(sp.category)
  const sort = one(sp.sort)

  // Search results: useful to visitors, thin for Google
  if (q) {
    return {
      title: `${q.slice(0, 60)}: search results | ${STORE}`,
      robots: { index: false, follow: true },
      alternates: { canonical: '/products' },
    }
  }

  if (sub || main) {
    const tree = await getCategoryTree().catch(() => [])
    const cat = tree.flatMap((c) => [c, ...c.children]).find((c) => c.slug === (sub || main))
    if (!cat) return { title: `Marketplace | ${STORE}`, robots: { index: false, follow: true }, alternates: { canonical: '/products' } }
    const canonical = sub ? `/products?mainCategory=${encodeURIComponent(main)}&subCategory=${encodeURIComponent(sub)}` : `/products?mainCategory=${encodeURIComponent(main)}`
    return {
      title: `${cat.name} | ${STORE}`,
      description: `Shop ${cat.name} on ${STORE}, Tanzania's online marketplace. Official Honic store and trusted sellers, mobile money payments and delivery across Tanzania.`,
      alternates: { canonical },
      // empty departments stay out of Google until sellers list products there
      ...(cat.count === 0 ? { robots: { index: false, follow: true } } : {}),
    }
  }

  if (SORT_TITLES[sort]) {
    return { title: `${SORT_TITLES[sort]} | ${STORE}`, alternates: { canonical: `/products?sort=${sort}` } }
  }

  return {
    title: `Marketplace | ${STORE}`,
    description: 'Shop the official Honic store and trusted sellers in one place: electronics, tools, home and school items and more. Pay with mobile money, delivered across Tanzania.',
    alternates: { canonical: '/products' },
  }
}

export default function Page() {
  return <MarketplacePage />
}
