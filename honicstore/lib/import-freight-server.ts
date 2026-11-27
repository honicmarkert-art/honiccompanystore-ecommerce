/** Server side of Buy-from-China shipping: rates and cart pricing from the database (never the browser). */
import { createClient } from '@supabase/supabase-js'
import { getCachedData, setCachedData } from '@/lib/database-optimization'
import { quoteFreight, settingsFromRow, type FreightItem, type FreightMode, type FreightQuote, type FreightSettings } from '@/lib/import-freight'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })

export async function getFreightSettings(): Promise<FreightSettings | null> {
  const cached = getCachedData('import-freight:settings') as FreightSettings | null
  if (cached) return cached
  const { data } = await db().from('import_freight_settings').select('usd_tzs, air, sea').eq('id', 1).maybeSingle()
  const s = settingsFromRow(data)
  if (s) setCachedData('import-freight:settings', s, 60 * 1000) // rate changes in the admin show within a minute
  return s
}

export type CartLine = { productId: number; quantity: number }
export type CartFreight = {
  chinaItems: number
  air: FreightQuote | null
  sea: FreightQuote | null
  settings: FreightSettings | null
}

/** Shipping for the China items of a cart (quantities from the cart, sizes from the database). */
export async function freightForCart(lines: CartLine[]): Promise<CartFreight> {
  const ids = [...new Set(lines.map((l) => Number(l.productId)).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200)
  if (!ids.length) return { chinaItems: 0, air: null, sea: null, settings: null }
  const [{ data }, settings] = await Promise.all([
    db().from('products').select('id, import_china, weight_kg, length_cm, width_cm, height_cm').in('id', ids),
    getFreightSettings(),
  ])
  const byId = new Map((data || []).map((p) => [Number(p.id), p]))
  const items: FreightItem[] = []
  for (const l of lines) {
    const p = byId.get(Number(l.productId))
    if (!p?.import_china) continue
    const q = Math.max(0, Math.min(10_000, Math.floor(Number(l.quantity) || 0)))
    if (q) items.push({ quantity: q, weightKg: p.weight_kg, lengthCm: p.length_cm, widthCm: p.width_cm, heightCm: p.height_cm })
  }
  if (!items.length || !settings) return { chinaItems: items.length, air: null, sea: null, settings }
  return { chinaItems: items.length, air: quoteFreight(items, 'air', settings), sea: quoteFreight(items, 'sea', settings), settings }
}

export const isFreightMode = (v: unknown): v is FreightMode => v === 'air' || v === 'sea'
