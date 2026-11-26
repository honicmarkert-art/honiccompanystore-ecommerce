/**
 * Import / refresh one 信德电子 Taobao item into Supabase products.
 * Usage: node scripts/import-xinde-taobao-item.mjs <taobaoItemId> [--json path]
 * Or pass JSON via stdin / file with { taobaoId, nameEn, nameCn, priceCny, category, imageUrls, specifications, variants, supplierId }
 *
 * Always creates a **new** product (duplicates OK). SKU `TAOBAO-<id>-<shortTs>` slug gets a unique suffix if needed.
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(import.meta.dirname, '..')
const envPath = path.join(ROOT, '.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const DEFAULT_SUPPLIER = 'feadf2ca-fddb-433c-98ca-95c0f8650596'
const CNY_TO_TZS = parseFloat(process.env.TAOBAO_CNY_TO_TZS || '380')
const MARKUP = parseFloat(process.env.TAOBAO_MARKUP || '2.8')

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function priceFromCny(cny) {
  const n = Math.max(0.01, parseFloat(cny) || 1)
  const raw = n * CNY_TO_TZS * MARKUP
  const rounded = Math.ceil(raw / 50) * 50
  return Math.max(200, Math.min(rounded, 99999999))
}

/** Higher score = better main product image (large, item_pic, not q50 thumb). */
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

function orderImagesBestFirst(urls) {
  const deduped = [...urls]
  return deduped.sort((a, b) => scoreImageUrl(b) - scoreImageUrl(a))
}

async function downloadBuffer(url) {
  const u = url.startsWith('//') ? `https:${url}` : url
  const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://item.taobao.com/' } })
  if (!res.ok) throw new Error(`Download failed ${res.status} ${u}`)
  const ct = res.headers.get('content-type') || 'image/jpeg'
  const buf = Buffer.from(await res.arrayBuffer())
  return { buf, contentType: ct.includes('webp') ? 'image/webp' : ct.includes('png') ? 'image/png' : 'image/jpeg', ext: ct.includes('webp') ? 'webp' : ct.includes('png') ? 'png' : 'jpg' }
}

async function uploadImage(productId, buf, ext, contentType) {
  const fileName = `product_${productId}_image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('product-images').upload(fileName, buf, { contentType, upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('product-images').getPublicUrl(fileName)
  return data.publicUrl
}

const PRESET = {
  5383206599: {
    taobaoId: '5383206599',
    nameCn: '船型 电源开关 KCD1-101 2脚2档 3A 250V 翘板开关 两脚',
    nameEn: 'KCD1-101 Rocker Boat Power Switch 2-Pin SPDT 3A 250V',
    priceCny: 0.22,
    category: 'DIY Electronic Components',
    categoryId: 'e91c053c-8814-48aa-9240-ceecaf1c5bbf',
    brand: 'Generic',
    model: 'KCD1-101',
    imageUrls: [
      'https://img.alicdn.com/imgextra/i4/132136629/O1CN01U0oqThpoy8E0F6aO_!!132136629.jpg_760x760q30.jpg_.webp',
      'https://img.alicdn.com/imgextra/i4/132136629/O1CN01aPHXbO1yq8Fv7pSt9_!!132136629.jpg_.webp',
      'https://img.alicdn.com/imgextra/i3/132136629/O1CN018wQ2Tn1yq8FnuDh3C_!!132136629.jpg_q50.jpg_.webp',
      'https://img.alicdn.com/imgextra/i2/132136629/O1CN01wdv7Dg1yq8Fu0sCzU_!!132136629.jpg_q50.jpg_.webp',
    ],
    specifications: {
      Type: 'Rocker boat power switch',
      Model: 'KCD1-101',
      Pins: '2-pin, 2-position (SPDT)',
      Rating: '3A 250V AC',
      ColorOptions: 'Black 21×15mm; Red 15×10mm; Red 20×15mm',
      'Source listing': 'Taobao item 5383206599 (信德电子, authorized detail images)',
    },
    description:
      'Panel-mount KCD1-101 rocker switch for DIY power control on Arduino/ESP32 projects, enclosures, and adapters. 2-pin, 2-position, rated 3A 250V. Choose black or red housing size at checkout when variants are enabled.\n\nImages and specs from supplier 信德电子 with permission. Compatible with general low-voltage hobby projects; verify rating for your load.',
    variants: [
      { variant_name: 'Black 21×15mm', price: null },
      { variant_name: 'Red 15×10mm', price: null },
      { variant_name: 'Red 20×15mm', price: null },
    ],
  },
}

async function importItem(data) {
  const ts = Date.now().toString(36)
  const sku = `TAOBAO-${data.taobaoId}-${ts}`
  let slug = slugify(`${data.nameEn}-taobao-${data.taobaoId}`)
  const price = priceFromCny(data.priceCny)
  const originalPrice = Math.ceil((price * 1.08) / 50) * 50

  const { data: inserted, error } = await supabase
    .from('products')
    .insert({
      name: data.nameEn,
      slug,
      description: data.description,
      category: data.category,
      category_id: data.categoryId || null,
      brand: data.brand || 'Generic',
      price,
      original_price: originalPrice,
      image: '',
      sku,
      model: data.model || null,
      in_stock: true,
      stock_quantity: 100,
      specifications: { ...(data.specifications || {}), taobao_item_id: String(data.taobaoId) },
      import_china: true,
      supplier_id: data.supplierId || DEFAULT_SUPPLIER,
      user_id: data.supplierId || DEFAULT_SUPPLIER,
      is_new: true,
      supplier_verified: true,
      variant_config: data.variants?.length ? { type: 'simple' } : { type: 'none' },
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) {
      slug = `${slug}-${ts}`
      const retry = await supabase
        .from('products')
        .insert({
          name: data.nameEn,
          slug,
          description: data.description,
          category: data.category,
          category_id: data.categoryId || null,
          brand: data.brand || 'Generic',
          price,
          original_price: originalPrice,
          image: '',
          sku: `${sku}-r`,
          model: data.model || null,
          in_stock: true,
          stock_quantity: 100,
          specifications: { ...(data.specifications || {}), taobao_item_id: String(data.taobaoId) },
          import_china: true,
          supplier_id: data.supplierId || DEFAULT_SUPPLIER,
          user_id: data.supplierId || DEFAULT_SUPPLIER,
          is_new: true,
          supplier_verified: true,
          variant_config: data.variants?.length ? { type: 'simple' } : { type: 'none' },
        })
        .select('id')
        .single()
      if (retry.error) throw retry.error
      var productId = retry.data.id
    } else throw error
  } else {
    var productId = inserted.id
  }
  console.log('Created product', productId, data.nameEn, 'sku', sku)

  const gallery = []
  const orderedUrls = orderImagesBestFirst(data.imageUrls || [])
  for (let i = 0; i < orderedUrls.length; i++) {
    try {
      const { buf, ext, contentType } = await downloadBuffer(orderedUrls[i])
      const url = await uploadImage(productId, buf, ext, contentType)
      gallery.push(url)
      if (i === 0) {
        await supabase.from('products').update({ image: url, gallery }).eq('id', productId)
      }
      console.log('  image', i + 1, url.slice(-40))
    } catch (e) {
      console.warn('  skip image', i + 1, e.message)
    }
  }
  if (gallery.length > 1) {
    await supabase.from('products').update({ gallery }).eq('id', productId)
  }

  if (data.variants?.length) {
    await supabase.from('product_variants').delete().eq('product_id', productId)
    const rows = data.variants.map((v) => ({
      product_id: productId,
      variant_name: v.variant_name,
      price: v.price ?? price,
      stock_quantity: 50,
      in_stock: true,
    }))
    await supabase.from('product_variants').insert(rows)
  }

  return { productId, slug, price, sku }
}

const id = process.argv[2] || '5383206599'
const preset = PRESET[id]
if (!preset) {
  console.error('No preset for', id, '— extend PRESET in script or pass JSON file')
  process.exit(1)
}

importItem(preset)
  .then((r) => {
    console.log('Done', JSON.stringify(r))
    console.log(`Site: ${process.env.NEXT_PUBLIC_SITE_URL}/products/${r.slug}`)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })