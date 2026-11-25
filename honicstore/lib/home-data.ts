import { createClient } from '@supabase/supabase-js'
import { getCategories, searchProducts } from '@/lib/product-search'

/**
 * Data for the home and categories pages, loaded on the server (fast first paint, SEO).
 * Every part fails soft: a database hiccup shows an emptier page, never an error page.
 */

export type HomeProduct = {
  id: number
  name: string
  slug?: string | null
  price: number
  originalPrice?: number | null
  image?: string | null
  rating?: number | null
  inStock?: boolean | null
  category?: string | null
}

export type CategoryWithCount = {
  id: string
  name: string
  slug: string
  parent_id: string | null
  count: number
  /** subcategories (main categories only) */
  children: CategoryWithCount[]
}

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const slim = (p: Record<string, unknown>): HomeProduct => ({
  id: Number(p.id),
  name: String(p.name || ''),
  slug: (p.slug as string) || null,
  price: Number(p.price) || 0,
  originalPrice: p.originalPrice != null ? Number(p.originalPrice) || null : null,
  image: (p.image as string) || null,
  rating: p.rating != null ? Number(p.rating) : null,
  inStock: p.inStock as boolean | null,
  category: (p.category as string) || null,
})

async function list(sort: 'popular' | 'newest', limit: number): Promise<HomeProduct[]> {
  try {
    const r = await searchProducts({ sort, limit })
    return (r.products as Record<string, unknown>[]).map(slim)
  } catch {
    return []
  }
}

/** Categories as a tree, each with its product count (a main category counts its subcategories too). */
export async function getCategoryTree(): Promise<CategoryWithCount[]> {
  const [cats, countsRes] = await Promise.all([
    getCategories().catch(() => []),
    db().from('products').select('category_id').then((r) => r, () => ({ data: null })),
  ])
  const counts = new Map<string, number>()
  for (const row of (countsRes.data || []) as { category_id: string | null }[]) {
    if (row.category_id) counts.set(row.category_id, (counts.get(row.category_id) || 0) + 1)
  }
  const nodes = cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug, parent_id: c.parent_id ?? null, count: counts.get(c.id) || 0, children: [] as CategoryWithCount[] }))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const roots: CategoryWithCount[] = []
  for (const n of nodes) {
    const parent = n.parent_id ? byId.get(n.parent_id) : null
    if (parent) parent.children.push(n)
    else roots.push(n)
  }
  for (const r of roots) {
    r.children.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    r.count += r.children.reduce((s, c) => s + c.count, 0)
  }
  return roots.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** A top-level department (Electronics, Home, Fashion…) with its picture and product count. */
export type Department = { id: string; name: string; slug: string; image: string | null; count: number }

/** Departments with pictures, in the admin's display order; departments that have products come first. */
async function getDepartments(tree: CategoryWithCount[]): Promise<Department[]> {
  const { data } = await db()
    .from('categories')
    .select('id, image_url, display_order, is_active')
    .is('parent_id', null)
    .then((r) => r, () => ({ data: null }))
  const meta = new Map(((data || []) as { id: string; image_url: string | null; display_order: number | null; is_active: boolean | null }[]).map((c) => [c.id, c]))
  return tree
    .filter((r) => meta.get(r.id)?.is_active !== false)
    .map((r) => ({ id: r.id, name: r.name, slug: r.slug, image: meta.get(r.id)?.image_url || null, count: r.count, order: meta.get(r.id)?.display_order ?? 999 }))
    .sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || a.order - b.order || b.count - a.count)
    .map((d) => ({ id: d.id, name: d.name, slug: d.slug, image: d.image, count: d.count }))
}

export async function getHomeData() {
  const [popular, newest, tree] = await Promise.all([list('popular', 18), list('newest', 12), getCategoryTree()])
  const departments = await getDepartments(tree)
  // Honic's own store is the main seller of electronics: its biggest department is featured on its own
  const official = tree.find((r) => /electronic|component/i.test(r.name) && r.count > 0) || tree[0] || null
  const deals = [...popular, ...newest]
    .filter((p, i, all) => p.originalPrice && p.originalPrice > p.price && all.findIndex((x) => x.id === p.id) === i)
    .sort((a, b) => (b.originalPrice! - b.price) / b.originalPrice! - (a.originalPrice! - a.price) / a.originalPrice!)
    .slice(0, 6)
  const totalProducts = tree.reduce((s, r) => s + r.count, 0)
  // categories inside the official electronics store, biggest first
  const officialCats = (official?.children || []).filter((c) => c.count > 0).sort((a, b) => b.count - a.count)
  return { popular, newest, deals, totalProducts, departments, official, officialCats }
}
