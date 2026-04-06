/**
 * Fast client-side match for instant search preview (subset of server full-text search).
 * All tokens must appear somewhere in the product text blob (order-free).
 */
export function filterProductsBySearchQuery(products: any[], rawQuery: string): any[] {
  const q = rawQuery.trim().toLowerCase()
  if (q.length < 3) return []
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const seen = new Set<number>()
  return products.filter((p) => {
    if (!p || typeof p.id !== 'number' || p.id <= 0) return false
    if (seen.has(p.id)) return false

    const parts: string[] = []
    const push = (v: unknown) => {
      if (v == null) return
      if (typeof v === 'string' && v.trim()) parts.push(v.toLowerCase())
      else if (typeof v === 'number') parts.push(String(v))
    }
    push(p.name)
    push(p.description)
    push(p.short_description)
    push(p.brand)
    push(p.category)
    if (Array.isArray(p.product_variants)) {
      for (const v of p.product_variants) {
        push(v?.name)
        push(v?.variant_name)
      }
    }

    const blob = parts.join(' ')
    const ok = tokens.every((t) => blob.includes(t))
    if (ok) seen.add(p.id)
    return ok
  })
}
