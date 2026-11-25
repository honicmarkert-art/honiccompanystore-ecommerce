/**
 * Who may receive which email. Server only.
 *
 *   account / order  -> always (the shopper needs them; no opt-out)
 *   price_alerts, back_in_stock          -> sent because the shopper asked; one-click stop
 *   abandoned_cart, review_requests      -> account holders, on by default; one-click stop
 *   marketing (newsletter, offers, ads)  -> ONLY after subscribing and confirming by email
 *                                           (double opt-in); one-click unsubscribe in every email
 *
 * Opt-outs live in email_preferences (one row per address, guests too). Marketing consent lives in
 * newsletter_subscriptions (status 'active' + confirmed_at).
 */
import { getSupabaseClient } from '@/lib/supabase-server'
import { normEmail, oneClickUrl, preferencesUrl } from '@/lib/email-links'
import { logger } from '@/lib/logger'

export type OptionalCategory = 'price_alerts' | 'back_in_stock' | 'abandoned_cart' | 'review_requests' | 'marketing'
export const OPTIONAL_CATEGORIES: OptionalCategory[] = ['marketing', 'price_alerts', 'back_in_stock', 'abandoned_cart', 'review_requests']

export const CATEGORY_LABEL: Record<OptionalCategory, { title: string; text: string; why: string }> = {
  marketing: { title: 'Offers and news', text: 'Deals, new arrivals and coupons. At most a few emails a month.', why: 'you subscribed to Honic offers and news' },
  price_alerts: { title: 'Price drop alerts', text: 'When a product you set an alert for reaches your price.', why: 'you set a price alert' },
  back_in_stock: { title: 'Back in stock', text: 'When a product you asked about is available again.', why: 'you asked to be told when this is back in stock' },
  abandoned_cart: { title: 'Cart reminders', text: 'One reminder if you leave items in your cart.', why: 'you left items in your Honic cart' },
  review_requests: { title: 'Review requests', text: 'A short request to review what you bought.', why: 'you bought this on Honic' },
}

export type Preferences = Record<OptionalCategory, boolean>
const DEFAULTS: Omit<Preferences, 'marketing'> = { price_alerts: true, back_in_stock: true, abandoned_cart: true, review_requests: true }

export async function getPreferences(email: string): Promise<Preferences> {
  const e = normEmail(email)
  const supabase = getSupabaseClient()
  const [{ data: row }, { data: sub }] = await Promise.all([
    supabase.from('email_preferences').select('price_alerts, back_in_stock, abandoned_cart, review_requests').eq('email', e).maybeSingle(),
    supabase.from('newsletter_subscriptions').select('status, confirmed_at').eq('email', e).maybeSingle(),
  ])
  return {
    ...DEFAULTS,
    ...Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [k, v !== false])),
    marketing: sub?.status === 'active' && !!sub.confirmed_at,
  } as Preferences
}

/** Save opt-outs for alerts and reminders. Marketing is handled by subscribe / unsubscribe only. */
export async function setPreferences(email: string, prefs: Partial<Omit<Preferences, 'marketing'>>, userId?: string | null) {
  const e = normEmail(email)
  const supabase = getSupabaseClient()
  const patch: Record<string, unknown> = { email: e, updated_at: new Date().toISOString() }
  for (const k of ['price_alerts', 'back_in_stock', 'abandoned_cart', 'review_requests'] as const) if (typeof prefs[k] === 'boolean') patch[k] = prefs[k]
  if (userId) patch.user_id = userId
  const { error } = await supabase.from('email_preferences').upsert(patch, { onConflict: 'email' })
  if (error) throw new Error(error.message)
}

export async function unsubscribeMarketing(email: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('newsletter_subscriptions')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('email', normEmail(email))
  if (error) throw new Error(error.message)
}

/** Should this optional email go out? Fails closed for marketing, open for requested alerts. */
export async function mayEmail(email: string, category: OptionalCategory): Promise<boolean> {
  try {
    const p = await getPreferences(email)
    return p[category]
  } catch (error) {
    logger.error('Email preference check failed:', error)
    return category !== 'marketing'
  }
}

/** Headers + footer for an optional email: one-click unsubscribe (Gmail / Yahoo rules) and a reason line. */
export function optionalEmailExtras(email: string, category: OptionalCategory) {
  const oneClick = oneClickUrl(email, category)
  const prefs = preferencesUrl(email, category)
  const label = CATEGORY_LABEL[category]
  return {
    headers: {
      'List-Unsubscribe': `<${oneClick}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    footnote: `You are getting this because ${label.why}. <a href="${prefs}" style="color:#64748b;text-decoration:underline">${category === 'marketing' ? 'Unsubscribe' : `Stop ${label.title.toLowerCase()}`}</a> &middot; <a href="${prefs}" style="color:#64748b;text-decoration:underline">Email preferences</a>`,
    text: `You are getting this because ${label.why}. Unsubscribe or change email preferences: ${prefs}`,
  }
}
