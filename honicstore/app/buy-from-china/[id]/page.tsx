import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { getProductDetail } from '@/lib/product-detail'
import { getFreightSettings } from '@/lib/import-freight-server'
import { RETURN_DAYS } from '@/lib/policies'
import { whatsappLink } from '@/lib/contact'
import { ChinaProduct } from './china-product'

/**
 * Buy from China: product page for items imported to order. Its own page and look (not the regular
 * product page); cart and checkout are shared. Shows air / sea shipping for the chosen quantity.
 * A product that is not an import item opens its regular product page instead.
 */
export const revalidate = 300

type Props = { params: Promise<{ id: string }> }
const parseId = (raw: string) => (decodeURIComponent(raw).match(/^\d{1,12}/) || [''])[0]
const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://honiccompanystore.com'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const p = await getProductDetail(parseId(id)).catch(() => null)
  if (!p) return { title: 'Item not found | Honic Company Store' }
  return {
    title: `${p.name} | Buy from China | Honic`,
    description: (p.description || `${p.name}: imported to order from China, shipped by air or sea to Tanzania.`).replace(/\s+/g, ' ').slice(0, 160),
    alternates: { canonical: `/buy-from-china/${p.id}` },
    openGraph: { title: p.name, images: p.image && /^https:\/\//.test(p.image) ? [{ url: p.image }] : undefined },
  }
}

export default async function ChinaProductPage({ params }: Props) {
  const { id } = await params
  const pid = parseId(id)
  if (!pid) notFound()
  const product = await getProductDetail(pid)
  if (!product) notFound()
  if (!product.importChina) redirect(`/products/${pid}`)

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const [{ data: size }, settings] = await Promise.all([
    db.from('products').select('weight_kg, length_cm, width_cm, height_cm').eq('id', pid).maybeSingle(),
    getFreightSettings(),
  ])
  const url = `${site.replace(/\/$/, '')}/buy-from-china/${product.id}`

  return (
    <div className="min-h-screen bg-[#f7f1e8] text-[#1d1210]">
      <SiteHeader />
      <ChinaProduct
        product={product}
        size={{ weightKg: size?.weight_kg ?? null, lengthCm: size?.length_cm ?? null, widthCm: size?.width_cm ?? null, heightCm: size?.height_cm ?? null }}
        settings={settings}
        returnDays={RETURN_DAYS}
        askLink={whatsappLink(`Hello Honic, about this China item: ${product.name} ${url} — what is the shipping price to Tanzania?`)}
      />
      <SiteFooter />
    </div>
  )
}
