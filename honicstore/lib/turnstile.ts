/**
 * Cloudflare Turnstile (bot check) — server side.
 *
 * Switched on by setting both keys (Cloudflare dashboard → Turnstile → Add site):
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY   public, shown in the form
 *   TURNSTILE_SECRET_KEY             secret, server only
 * Without TURNSTILE_SECRET_KEY the check is skipped, so the site keeps working before the keys are added.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export const isTurnstileEnabled = () => !!process.env.TURNSTILE_SECRET_KEY

export type TurnstileResult = { ok: true; skipped?: boolean } | { ok: false; reason: string }

export async function verifyTurnstile(token: unknown, ip?: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { ok: true, skipped: true }
  if (typeof token !== 'string' || !token || token.length > 2048) return { ok: false, reason: 'missing-token' }

  const body = new URLSearchParams({ secret, response: token })
  if (ip && ip !== 'unknown') body.set('remoteip', ip)
  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(8000), cache: 'no-store' })
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    return data.success ? { ok: true } : { ok: false, reason: (data['error-codes'] || ['failed']).join(',') }
  } catch {
    // Cloudflare unreachable: fail closed (sign-up is the bot target), the user can simply retry
    return { ok: false, reason: 'verify-unavailable' }
  }
}
