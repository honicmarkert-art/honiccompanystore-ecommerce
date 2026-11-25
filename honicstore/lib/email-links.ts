/**
 * Signed links for emails: confirm a newsletter subscription, one-click unsubscribe, manage
 * preferences. Each link carries an HMAC of (purpose, email), so only the person who received the
 * email can use it, and no token table is needed. Server only.
 *
 * Secret: EMAIL_LINK_SECRET, or (fallback) a key derived from the service-role key.
 */
import { createHash, createHmac, timingSafeEqual } from 'crypto'

export type LinkPurpose = 'confirm' | 'prefs'

function secret(): string {
  const s = process.env.EMAIL_LINK_SECRET || (process.env.SUPABASE_SERVICE_ROLE_KEY ? createHash('sha256').update(`honic-email-links:${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest('hex') : '')
  if (!s) throw new Error('EMAIL_LINK_SECRET is not set')
  return s
}

export const normEmail = (email: string) => String(email || '').trim().toLowerCase()

export function emailToken(purpose: LinkPurpose, email: string): string {
  return createHmac('sha256', secret()).update(`${purpose}:${normEmail(email)}`).digest('base64url').slice(0, 32)
}

export function verifyEmailToken(purpose: LinkPurpose, email: string, token: string): boolean {
  if (!email || !token) return false
  const a = Buffer.from(emailToken(purpose, email))
  const b = Buffer.from(String(token))
  return a.length === b.length && timingSafeEqual(a, b)
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.honiccompanystore.com').replace(/\/$/, '')
}

const q = (email: string, purpose: LinkPurpose, extra = '') => `e=${encodeURIComponent(normEmail(email))}&t=${emailToken(purpose, email)}${extra}`

/** Page that confirms a newsletter subscription (double opt-in). */
export const confirmUrl = (email: string) => `${siteUrl()}/newsletter/confirm?${q(email, 'confirm')}`
/** Preference centre for this address (also where "unsubscribe" in the footer goes). */
export const preferencesUrl = (email: string, highlight?: string) => `${siteUrl()}/email-preferences?${q(email, 'prefs', highlight ? `&c=${highlight}` : '')}`
/** RFC 8058 one-click unsubscribe endpoint (mail apps POST to it). */
export const oneClickUrl = (email: string, category: string) => `${siteUrl()}/api/email/unsubscribe?${q(email, 'prefs', `&c=${category}`)}`
