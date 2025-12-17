type FetchCacheOptions = {
  method?: string
  headers?: Record<string, string>
  body?: BodyInit | null
  credentials?: RequestCredentials
  signal?: AbortSignal
  ttlMs?: number               // hard TTL for cache validity
  swrMs?: number               // serve stale immediately, revalidate in bg
}

const inMemory = new Map<string, { ts: number; data: any }>()
const inFlight = new Map<string, Promise<any>>()
const STORAGE_PREFIX = 'fc_'

function buildKey(url: string, opts: Partial<FetchCacheOptions>) {
  const { method = 'GET', headers, body } = opts
  
  // Use stable key generation for headers (prevents fragmentation)
  const { generateStableCacheKey } = require('./cache-key-generator')
  const hdr = headers ? generateStableCacheKey('', headers as Record<string, any>) : ''
  const bod = body && typeof body !== 'string' ? '' : (body as string) || ''
  
  return `${method}:${url}:${hdr}:${bod}`
}

function readStorage(key: string) {
  try {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as { ts: number; data: any }
  } catch { return null }
}

function writeStorage(key: string, value: { ts: number; data: any }) {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {}
}

async function networkFetch(url: string, opts: FetchCacheOptions) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: opts.headers,
    body: opts.body || null,
    credentials: opts.credentials ?? 'include',
    signal: opts.signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  try { return text ? JSON.parse(text) : null } catch { return text }
}

export async function fetchWithCache(url: string, opts: FetchCacheOptions = {}) {
  const ttlMs = opts.ttlMs ?? 60_000
  const swrMs = opts.swrMs ?? 300_000
  const key = buildKey(url, opts)

  // Deduplicate identical in-flight requests
  if (inFlight.has(key)) return inFlight.get(key)!

  const now = Date.now()
  const mem = inMemory.get(key)
  const stor = readStorage(key)
  const best = mem || stor

  const isFresh = best && now - best.ts <= ttlMs
  const isStaleButValid = best && now - best.ts <= (ttlMs + swrMs)

  if (isFresh) return best!.data

  if (isStaleButValid) {
    void (async () => {
      try {
        const p = networkFetch(url, opts)
        inFlight.set(key, p)
        const data = await p
        const entry = { ts: Date.now(), data }
        inMemory.set(key, entry)
        writeStorage(key, entry)
      } catch {} finally { inFlight.delete(key) }
    })()
    return best!.data
  }

  const p = (async () => {
    try {
      const data = await networkFetch(url, opts)
      const entry = { ts: Date.now(), data }
      inMemory.set(key, entry)
      writeStorage(key, entry)
      return data
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, p)
  return p
}

export function clearCache(prefixUrl?: string) {
  if (!prefixUrl) { inMemory.clear(); return }
  for (const k of inMemory.keys()) if (k.includes(prefixUrl)) inMemory.delete(k)
}






