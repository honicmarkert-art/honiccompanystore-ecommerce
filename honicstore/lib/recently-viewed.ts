/**
 * "Recently viewed" products, kept per visitor in localStorage (a convenience only — never
 * relied on). Shared by the Marketplace and the product page.
 * Old history saved under the first Marketplace's key is moved to the new key once, so nobody loses it.
 */
export type ViewedProduct = {
  id: number
  name: string
  slug?: string
  price: number
  image?: string | null
  category?: string | null
}

const KEY = 'honic_recently_viewed'
const OLD_KEY = 'honic_demo_history'
const MAX = 12

export function readRecentlyViewed(): ViewedProduct[] {
  try {
    const old = localStorage.getItem(OLD_KEY)
    if (old !== null) {
      if (localStorage.getItem(KEY) === null) localStorage.setItem(KEY, old)
      localStorage.removeItem(OLD_KEY)
    }
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((p) => p && typeof p.id === 'number' && typeof p.name === 'string') : []
  } catch {
    return []
  }
}

export function recordView(p: ViewedProduct) {
  try {
    const slim: ViewedProduct = { id: p.id, name: p.name, slug: p.slug, price: Number(p.price) || 0, image: p.image ?? null, category: p.category ?? null }
    const next = [slim, ...readRecentlyViewed().filter((h) => h.id !== p.id)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage blocked (private mode etc.) — history is optional
  }
}
