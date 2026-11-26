/**
 * Batch create 10 信德电子 products with TZ retail prices and 5+ images.
 * Run after filling xinde-batch-10-data.json (from browser scrape).
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(import.meta.dirname, '..')
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const DEFAULT_SUPPLIER = 'feadf2ca-fddb-433c-98ca-95c0f8650596'

const CATEGORIES = {
  cables: { name: 'Connectors & Cables', id: 'e3cb6055-d297-41d2-8f1f-1d810fe66dc5' },
  accessories: { name: 'Accessories', id: 'c8654729-d7aa-4231-a426-f8184521c3fb' },
  sensors: { name: 'Sensors', id: 'f516cea0-b890-497f-b76b-033bffc0966a' },
  motors: { name: 'Motors & Actuators', id: 'd5021bd5-1b2f-43a0-a3a7-d56c496caa06' },
  power: { name: 'Power Supply', id: 'c10e90e1-522f-4b69-af59-644eb85d457a' },
}

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

async function downloadBuffer(url) {
  const u = url.startsWith('//') ? `https:${url}` : url
  const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://item.taobao.com/' } })
  if (!res.ok) throw new Error(`Download ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  const buf = Buffer.from(await res.arrayBuffer())
  const ext = ct.includes('webp') || url.includes('.webp') ? 'webp' : 'jpg'
  const contentType = ext === 'webp' ? 'image/webp' : 'image/jpeg'
  return { buf, ext, contentType }
}

async function uploadImage(productId, buf, ext, contentType) {
  const fileName = `product_${productId}_image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('product-images').upload(fileName, buf, { contentType })
  if (error) throw error
  return supabase.storage.from('product-images').getPublicUrl(fileName).data.publicUrl
}

function scoreImageUrl(url) {
  let s = 0
  const u = url.toLowerCase()
  if (u.includes('760x760') || u.includes('800x800') || u.includes('item_pic')) s += 100
  if (u.includes('_q50') || u.includes('q30')) s -= 40
  if (u.includes('.jpg') && !u.includes('_.webp')) s += 30
  if (u.includes('imgextra')) s += 10
  if (u.includes('tps-') || u.includes('s.gif')) s -= 200
  return s
}

function dedupeUrls(urls) {
  const seen = new Set()
  const out = urls.filter((u) => {
    const key = u.replace(/_\d+x\d+[^/]*/g, '').replace(/\?.*$/, '')
    if (seen.has(key)) return false
    seen.add(key)
    return u.includes('imgextra') && !u.includes('s.gif') && !u.includes('tps-') && !u.includes('O1CN01ie9ezx')
  })
  return out.sort((a, b) => scoreImageUrl(b) - scoreImageUrl(a))
}

async function importOne(item) {
  const ts = Date.now().toString(36)
  const sku = `TAOBAO-${item.taobaoId}-${ts}`
  const slug = slugify(`${item.nameEn}-taobao-${item.taobaoId}`)
  const price = item.priceTzs
  const originalPrice = Math.ceil((price * 1.1) / 50) * 50
  const cat = CATEGORIES[item.categoryKey] || CATEGORIES.accessories

  let imageUrls = dedupeUrls(item.imageUrls || [])
  if (imageUrls.length < 5) {
    console.warn(item.taobaoId, 'only', imageUrls.length, 'images')
  }

  const { data: inserted, error } = await supabase
    .from('products')
    .insert({
      name: item.nameEn,
      slug,
      description: item.description,
      category: cat.name,
      category_id: cat.id,
      brand: 'Generic',
      price,
      original_price: originalPrice,
      image: '',
      sku,
      model: item.model || null,
      in_stock: true,
      stock_quantity: 80,
      specifications: { ...item.specifications, taobao_item_id: String(item.taobaoId), source: '信德电子 Taobao (authorized images)' },
      import_china: true,
      supplier_id: DEFAULT_SUPPLIER,
      user_id: DEFAULT_SUPPLIER,
      is_new: true,
      supplier_verified: true,
      variant_config: { type: 'none' },
    })
    .select('id')
    .single()
  if (error) throw error
  const productId = inserted.id

  const gallery = []
  // Best-scored URL is always uploaded first → becomes main `image` + gallery[0]
  const toFetch = imageUrls.slice(0, Math.max(5, Math.min(imageUrls.length, 8)))
  for (let i = 0; i < toFetch.length; i++) {
    try {
      const { buf, ext, contentType } = await downloadBuffer(toFetch[i])
      const url = await uploadImage(productId, buf, ext, contentType)
      gallery.push(url)
      if (i === 0) await supabase.from('products').update({ image: url, gallery: [url] }).eq('id', productId)
    } catch (e) {
      console.warn('  img fail', i + 1, e.message)
    }
  }
  if (gallery.length) await supabase.from('products').update({ gallery }).eq('id', productId)

  return { productId, slug, price, images: gallery.length }
}

const dataPath = path.join(import.meta.dirname, 'xinde-batch-10-data.json')
const items = JSON.parse(fs.readFileSync(dataPath, 'utf8'))

;(async () => {
  const results = []
  for (const item of items) {
    try {
      const r = await importOne(item)
      console.log('OK', item.taobaoId, r)
      results.push(r)
    } catch (e) {
      console.error('FAIL', item.taobaoId, e.message)
    }
  }
  console.log('Summary', results.length, '/', items.length)
})()