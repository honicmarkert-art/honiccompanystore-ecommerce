/**
 * Which images go through Next.js image optimization (resize + WebP, cached for a year).
 *
 * Optimized: local files ("/...") and Supabase public storage — i.e. our product photos.
 * Left as-is: SVGs (already tiny/vector), data:/blob: URLs, and any other host
 * (next/image throws for hosts that aren't in images.remotePatterns).
 *
 * Use as: <Image ... unoptimized={!canOptimizeImage(src)} />
 */
/**
 * Returns a src next/image accepts, or the placeholder. Some products have junk image values in the
 * database (e.g. just "supabase.co"), and next/image throws a runtime error for anything that isn't an
 * absolute http(s) URL, a "/path", or a data:/blob: URL.
 */
export function safeImageSrc(src?: string | null, fallback = '/placeholder.svg'): string {
  if (!src || typeof src !== 'string') return fallback
  const s = src.trim()
  if (s.startsWith('/') && !s.startsWith('//')) return s
  if (/^(data|blob):/i.test(s)) return s
  try {
    const u = new URL(s)
    return u.protocol === 'https:' || u.protocol === 'http:' ? s : fallback
  } catch {
    return fallback
  }
}

export function canOptimizeImage(src?: string | null): boolean {
  if (!src || typeof src !== 'string') return false
  if (/\.svg($|\?)/i.test(src)) return false
  if (src.startsWith('/') && !src.startsWith('//')) return true
  try {
    const u = new URL(src)
    return u.protocol === 'https:' && u.hostname.endsWith('.supabase.co') && u.pathname.startsWith('/storage/v1/object/public/')
  } catch {
    return false
  }
}

/** Widths the optimizer accepts (next.config.mjs images.deviceSizes + imageSizes). */
const OPTIMIZER_WIDTHS = [64, 128, 256, 384, 640, 828, 1080, 1440, 1920]

/**
 * For plain <img> tags: the same resized WebP that next/image would serve (via /_next/image),
 * instead of the full-size original from storage (product photos are often 200–400 KB).
 * `width` is the largest CSS width the image is shown at; it is doubled for sharp phone screens.
 * Anything that can't be optimized (SVG, data:, other hosts) is returned unchanged.
 */
export function optimizedImg(src: string | null | undefined, width: number, quality: 60 | 75 | 80 | 85 = 75): string {
  const safe = safeImageSrc(src)
  if (!canOptimizeImage(safe)) return safe
  const target = width * 2
  const w = OPTIMIZER_WIDTHS.find((x) => x >= target) ?? OPTIMIZER_WIDTHS[OPTIMIZER_WIDTHS.length - 1]
  return `/_next/image?url=${encodeURIComponent(safe)}&w=${w}&q=${quality}`
}
