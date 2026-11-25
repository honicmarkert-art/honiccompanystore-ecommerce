import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import sharp from 'sharp'
import {
  buildTerms, compactOf, scoreProduct, tokenize, toListItem,
  type ImageInput, type IndexedProduct, type MatchLevel, type PhotoAnalysis,
} from '@/lib/visual-search'

/**
 * Photo matching WITHOUT AI — tried before Gemini (see searchByPhoto).
 *
 *  1. Fingerprint: a 64-bit "difference hash" of every product image is kept in memory
 *     (and on disk, so restarts are instant). A shopper photo that is the same picture
 *     — screenshot, WhatsApp forward, resized/recompressed copy, supplier photo used by
 *     other shops — lands within a few bits of it.  ~50 ms.
 *  2. Printed text (OCR, Tesseract): part numbers such as 1N4007, HC-SR04, REX-C100 are
 *     read from the photo and looked up in names / SKUs / model numbers.  ~1-3 s.
 *
 * Each step only answers when it is confident; otherwise the caller falls back to Gemini.
 */

type Hash = { hi: number; lo: number }
type Found = { products: ReturnType<typeof toListItem>[]; analysis: PhotoAnalysis; query: string; detail: string }

// ---------------------------------------------------------------- fingerprints

const HASH_FILE = path.join(os.tmpdir(), 'honic-visual-hashes.json')
const hashes = new Map<string, string>() // image url → 16-char hex hash ('' = could not hash)
let loadedFromDisk = false
let building: Promise<void> | null = null

const isRealImage = (u: unknown): u is string =>
  typeof u === 'string' && /^https?:\/\//.test(u) && !u.includes('placeholder') && !/\/supabase\.co\/?$/.test(u)

function imagesOf(p: IndexedProduct): string[] {
  const r = p.row
  const list = [r.image, ...(Array.isArray(r.gallery) ? r.gallery : []), ...(r.product_variants || []).map((v: any) => v.image)]
  return [...new Set(list.filter(isRealImage))].slice(0, 6)
}

/** dHash: shrink to 9×8 grey, compare neighbours → 64 bits. Borders are trimmed first so screenshots with margins still match. */
async function dHash(input: Buffer | ReturnType<typeof sharp>): Promise<Hash> {
  const img = Buffer.isBuffer(input) ? sharp(input, { failOn: 'none' }) : input
  const px = await img.flatten({ background: '#ffffff' }).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer()
  let hi = 0, lo = 0
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const bit = px[y * 9 + x] > px[y * 9 + x + 1] ? 1 : 0
      const i = y * 8 + x
      if (i < 32) hi = ((hi << 1) | bit) >>> 0
      else lo = ((lo << 1) | bit) >>> 0
    }
  }
  return { hi, lo }
}

async function trimmed(buf: Buffer): Promise<Buffer> {
  try {
    return await sharp(buf, { failOn: 'none' }).rotate().flatten({ background: '#ffffff' }).trim({ threshold: 12 }).toBuffer()
  } catch {
    return buf // uniform image — nothing to trim
  }
}

const toHex = (h: Hash) => h.hi.toString(16).padStart(8, '0') + h.lo.toString(16).padStart(8, '0')
const fromHex = (s: string): Hash => ({ hi: parseInt(s.slice(0, 8), 16) >>> 0, lo: parseInt(s.slice(8), 16) >>> 0 })
const popcount = (n: number) => { n = n - ((n >>> 1) & 0x55555555); n = (n & 0x33333333) + ((n >>> 2) & 0x33333333); return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24 }
const distance = (a: Hash, b: Hash) => popcount((a.hi ^ b.hi) >>> 0) + popcount((a.lo ^ b.lo) >>> 0)

async function loadHashFile() {
  if (loadedFromDisk) return
  loadedFromDisk = true
  try {
    const data = JSON.parse(await fs.readFile(HASH_FILE, 'utf8')) as Record<string, string>
    for (const [k, v] of Object.entries(data)) if (!hashes.has(k)) hashes.set(k, v)
  } catch { /* first run */ }
}

async function saveHashFile() {
  try { await fs.writeFile(HASH_FILE, JSON.stringify(Object.fromEntries(hashes))) } catch { /* read-only fs: memory only */ }
}

async function hashUrl(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(String(res.status))
    const buf = Buffer.from(await res.arrayBuffer())
    hashes.set(url, toHex(await dHash(await trimmed(buf))))
  } catch {
    hashes.set(url, '') // don't retry broken images on every search
  }
}

/** Hash any product images not seen yet. Runs in the background; searches use whatever is ready. */
export function ensureFingerprints(catalog: IndexedProduct[]): Promise<void> {
  if (building) return building
  building = (async () => {
    await loadHashFile()
    const todo = [...new Set(catalog.flatMap(imagesOf))].filter((u) => !hashes.has(u))
    let i = 0
    const worker = async () => { while (i < todo.length) await hashUrl(todo[i++]) }
    await Promise.all(Array.from({ length: 6 }, worker))
    if (todo.length) await saveHashFile()
  })().finally(() => { building = null })
  return building
}

export function fingerprintCoverage(catalog: IndexedProduct[]) {
  const urls = [...new Set(catalog.flatMap(imagesOf))]
  return { images: urls.length, hashed: urls.filter((u) => hashes.get(u)).length }
}

/**
 * Query variants: whole photo (trimmed) + a grid of crops at several sizes/positions, so a
 * product picture sitting anywhere inside a screenshot (page header, margins, text) is still found.
 * Crops are taken from a 320px copy, so ~30 hashes cost only a few milliseconds.
 */
async function queryHashes(buf: Buffer): Promise<Hash[]> {
  const base = await trimmed(buf)
  const out: Hash[] = [await dHash(base)]
  try {
    // One small greyscale copy; every crop is hashed in plain JS from these pixels (no extra image decoding)
    const { data: g, info } = await sharp(base)
      .resize({ width: 320, height: 320, fit: 'inside' }).flatten({ background: '#ffffff' }).grayscale()
      .raw().toBuffer({ resolveWithObject: true })
    const W = info.width, H = info.height
    for (const f of [0.9, 0.75, 0.6, 0.45]) {
      const w = Math.round(W * f), h = Math.round(H * f)
      if (w < 40 || h < 40) continue
      for (const x of [0, (W - w) / 2, W - w]) for (const y of [0, (H - h) / 2, H - h]) {
        const box = trimBox(g, W, Math.round(x), Math.round(y), w, h)
        if (box) out.push(cropHash(g, W, box.x, box.y, box.w, box.h))
      }
    }
  } catch { /* keep the whole-image hash */ }
  return out
}

/** Same idea as sharp's trim(): shrink a crop to the area that differs from its corner (background) colour. */
function trimBox(g: Buffer, W: number, x0: number, y0: number, w: number, h: number) {
  const bg = g[y0 * W + x0]
  let minX = x0 + w, minY = y0 + h, maxX = -1, maxY = -1
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (Math.abs(g[y * W + x] - bg) > 12) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const bw = maxX - minX + 1, bh = maxY - minY + 1
  return bw >= 24 && bh >= 24 ? { x: minX, y: minY, w: bw, h: bh } : null
}

/** dHash of a crop of a greyscale pixel buffer: box-average into 9×8 cells, compare neighbours. */
function cropHash(g: Buffer, W: number, x0: number, y0: number, w: number, h: number): Hash {
  const cells = new Float64Array(72)
  for (let cy = 0; cy < 8; cy++) {
    const ya = y0 + Math.floor((cy * h) / 8), yb = y0 + Math.max(Math.floor(((cy + 1) * h) / 8), Math.floor((cy * h) / 8) + 1)
    for (let cx = 0; cx < 9; cx++) {
      const xa = x0 + Math.floor((cx * w) / 9), xb = x0 + Math.max(Math.floor(((cx + 1) * w) / 9), Math.floor((cx * w) / 9) + 1)
      let sum = 0
      for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) sum += g[y * W + x]
      cells[cy * 9 + cx] = sum / ((yb - ya) * (xb - xa))
    }
  }
  let hi = 0, lo = 0
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const bit = cells[y * 9 + x] > cells[y * 9 + x + 1] ? 1 : 0
    const i = y * 8 + x
    if (i < 32) hi = ((hi << 1) | bit) >>> 0
    else lo = ((lo << 1) | bit) >>> 0
  }
  return { hi, lo }
}

/** Strong = clearly the same picture. Thresholds tuned so different products on white backgrounds don't collide. */
const STRONG = 6
const LIKELY = 10
const GAP = 5

export async function matchFingerprint(image: ImageInput, catalog: IndexedProduct[], limit = 24): Promise<Found | null> {
  await loadHashFile()
  void ensureFingerprints(catalog) // keep the index growing in the background

  const q = await queryHashes(Buffer.from(image.data, 'base64'))
  const best = new Map<IndexedProduct, number>()
  for (const p of catalog) {
    let d = 64
    for (const u of imagesOf(p)) {
      const hex = hashes.get(u)
      if (!hex) continue
      const h = fromHex(hex)
      for (const qh of q) d = Math.min(d, distance(qh, h))
    }
    if (d < 64) best.set(p, d)
  }
  const ranked = [...best].sort((a, b) => a[1] - b[1])
  if (!ranked.length) return null
  const [top, d1] = ranked[0]
  const runnerUp = ranked.find(([p, d]) => d > d1 && p.row.name !== top.row.name)?.[1] ?? 64
  const confident = d1 <= STRONG || (d1 <= LIKELY && runnerUp - d1 >= GAP)
  if (!confident) return null

  // Same picture can belong to several listings (e.g. variants listed separately)
  const exact = ranked.filter(([, d]) => d <= Math.max(d1, STRONG)).map(([p]) => p)
  const analysis: PhotoAnalysis = {
    isProduct: true,
    name: String(top.row.name || ''),
    brand: String(top.row.brand || ''),
    category: String(top.row.category || ''),
    modelNumbers: [top.row.model, top.row.sku].filter((x) => typeof x === 'string' && x.length >= 3),
    visibleText: [],
    keywords: tokenize(String(top.row.name || '')).slice(0, 6),
    alternatives: [],
    description: 'Matched to the same picture in our catalog.',
  }
  return {
    analysis,
    query: analysis.name,
    detail: `fingerprint d=${d1} (next ${runnerUp})`,
    products: withNeighbours(exact, analysis, catalog, limit),
  }
}

/** Exact hits first, then text-similar products (same kind / category) as similar/related — no AI needed. */
function withNeighbours(exact: IndexedProduct[], analysis: PhotoAnalysis, catalog: IndexedProduct[], limit: number) {
  const ids = new Set(exact.map((p) => p.row.id))
  const { terms, models } = buildTerms({ ...analysis, modelNumbers: [] }) // model numbers would just re-find the exact item
  const scored = catalog
    .filter((p) => !ids.has(p.row.id))
    .map((p) => ({ p, s: scoreProduct(p, terms, models, analysis) }))
    .filter((x) => x.s >= 3)
    .sort((a, b) => b.s - a.s)
  const bestS = scored[0]?.s || 1
  return [
    ...exact.map((p) => toListItem(p.row, 'exact' as MatchLevel)),
    ...scored.map(({ p, s }) => toListItem(p.row, (s >= bestS * 0.6 ? 'similar' : 'related') as MatchLevel)),
  ].slice(0, limit)
}

// ---------------------------------------------------------------- printed text (OCR)

type TessWorker = { recognize: (img: Buffer) => Promise<{ data: { text: string; words?: Array<{ text: string; confidence: number }> } }>; setParameters: (p: Record<string, string>) => Promise<unknown> }
let workerPromise: Promise<TessWorker> | null = null
let ocrBusy = false

function getWorker(): Promise<TessWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      // English OCR data ships with the app (data/tessdata/eng.traineddata.gz, Apache-2.0, from tesseract.js-data),
      // so nothing is downloaded from a CDN at runtime and cold starts don't wait on the network.
      const langPath = path.join(process.cwd(), 'data', 'tessdata')
      const w = (await createWorker('eng', 1, { langPath, gzip: true, cacheMethod: 'none' })) as unknown as TessWorker
      await w.setParameters({ tessedit_pageseg_mode: '11' }) // sparse text: labels scattered on a product
      return w
    })().catch((e) => { workerPromise = null; throw e })
  }
  return workerPromise
}

/** Start the OCR engine early (loads its bundled English data). */
export function warmOcr() { getWorker().catch(() => {}) }

// Part-number-like: has letters AND digits, e.g. 1N4007, HC-SR04, REX-C100, ESP32-WROOM-32, LM7805
const CODE = /^(?=.*[a-z])(?=.*\d)[a-z0-9]{4,20}$/

export async function matchPrintedText(image: ImageInput, catalog: IndexedProduct[], { limit = 24, timeoutMs = 3500 } = {}): Promise<Found | null> {
  if (ocrBusy) return null // one OCR at a time; others go straight to the next step
  ocrBusy = true
  try {
    const run = (async () => {
      const worker = await getWorker()
      const prepared = await sharp(Buffer.from(image.data, 'base64'), { failOn: 'none' })
        .rotate().flatten({ background: '#ffffff' }).grayscale()
        .resize({ width: 1400, withoutEnlargement: false }).normalize().sharpen().png().toBuffer()
      return worker.recognize(prepared)
    })()
    const result = await Promise.race([run, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))])
    if (!result) return null

    const words = (result.data.words || []).filter((w) => w.confidence >= 55).map((w) => w.text)
    const text = words.length ? words.join(' ') : result.data.text
    const codes = [...new Set(text.split(/[\s,;:()[\]{}|/\\]+/).map(compactOf).filter((c) => CODE.test(c)))]
    if (!codes.length) return null

    // A code is useful only if it points at a small set of products
    let bestCode = ''
    let hits: IndexedProduct[] = []
    for (const c of codes.sort((a, b) => b.length - a.length)) {
      const found = catalog.filter((p) => p.compact.includes(c))
      if (found.length >= 1 && found.length <= 6 && (!hits.length || found.length < hits.length)) { bestCode = c; hits = found }
    }
    if (!hits.length) return null

    const label = text.split(/\s+/).find((w) => compactOf(w) === bestCode) || bestCode.toUpperCase()
    const analysis: PhotoAnalysis = {
      isProduct: true,
      name: label,
      brand: '',
      category: String(hits[0].row.category || ''),
      modelNumbers: codes.slice(0, 4),
      visibleText: words.slice(0, 8),
      keywords: [label],
      alternatives: [],
      description: `Read “${label}” printed on the item.`,
    }
    // Rank the hits: name containing the code first, then single items over kits/bundles
    const ranked = hits
      .map((p) => ({ p, s: (tokenize(p.row.name || '').some((t) => compactOf(t) === bestCode) ? 2 : 0) + (/\bkit|assort|set\b/i.test(p.row.name || '') ? 0 : 1) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p)
    const exact = ranked.slice(0, 1)
    const similar = ranked.slice(1)
    const rest = withNeighbours([...exact, ...similar], { ...analysis, name: String(exact[0].row.name || label) }, catalog, limit)
      .filter((x) => !similar.some((p) => p.row.id === x.id))
    return {
      analysis: { ...analysis, name: String(exact[0].row.name || label) },
      query: label,
      detail: `ocr code=${bestCode} hits=${hits.length}`,
      products: [rest[0], ...similar.map((p) => toListItem(p.row, 'similar')), ...rest.slice(1)].slice(0, limit),
    }
  } catch {
    return null
  } finally {
    ocrBusy = false
  }
}
