/**
 * The visitor's real IP address, for rate limits, bot checks and security logs.
 *
 * Only headers our host sets can be trusted. On Vercel, `x-real-ip` / `x-forwarded-for` are
 * overwritten with the real client address, so a visitor cannot fake them. `cf-connecting-ip`
 * is only trustworthy when the site is proxied through Cloudflare; otherwise anyone can send it
 * (a new fake IP per request = no rate limit at all). Set TRUST_CLOUDFLARE_IP=1 only if the
 * domain is proxied by Cloudflare (orange cloud) in front of Vercel.
 */
export function clientIp(request: { headers: Headers }): string | null {
  const h = request.headers
  if (process.env.TRUST_CLOUDFLARE_IP === '1') {
    const cf = h.get('cf-connecting-ip')?.trim()
    if (cf) return cf
  }
  const vercel = h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  if (vercel) return vercel
  const real = h.get('x-real-ip')?.trim()
  if (real) return real
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  return fwd || null
}
