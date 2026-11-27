/**
 * WhatsApp Business Cloud API (Meta). Server only. Switched off until WHATSAPP_ACCESS_TOKEN and
 * WHATSAPP_PHONE_NUMBER_ID are set.
 *
 * Rules (WhatsApp policy):
 *  - Messages we start must use APPROVED templates (see docs/WHATSAPP_TEMPLATES.md).
 *  - Order updates (utility) only to customers who ticked "order updates on WhatsApp".
 *  - Offers / ads (marketing) only to customers who opted in to offers; "STOP" opts them out.
 *  - Free text is only allowed within 24 h after the customer last wrote to us.
 * Every send is logged in whatsapp_messages (status updated by /api/webhooks/whatsapp).
 */
import { getSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

const VERSION = () => process.env.WHATSAPP_API_VERSION || 'v21.0'
export const whatsappEnabled = () => !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
const LANG = () => process.env.WHATSAPP_TEMPLATE_LANG || 'en'

/** Template names the store uses (create them in WhatsApp Manager with exactly these names). */
export const WA_TEMPLATES = {
  order_paid: 'honic_order_paid',
  order_shipped: 'honic_order_shipped',
  order_ready_pickup: 'honic_order_ready_pickup',
  order_delivered: 'honic_order_delivered',
  order_expired: 'honic_order_expired',
  offer_reply: 'honic_offer_reply',
  import_shipping_price: 'honic_import_shipping_price',
} as const
export type UtilityKind = keyof typeof WA_TEMPLATES

/** Tanzanian phone -> 255XXXXXXXXX (or null) */
export function waPhone(raw: string | null | undefined): string | null {
  const d = String(raw || '').replace(/\D/g, '')
  const local = d.startsWith('255') ? d.slice(3) : d.startsWith('0') ? d.slice(1) : d
  return /^[67]\d{8}$/.test(local) ? `255${local}` : null
}

type Component = Record<string, unknown>
const text = (t: string) => ({ type: 'text', text: String(t ?? '').slice(0, 1000) || '-' })

async function post(payload: Record<string, unknown>): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!whatsappEnabled()) return { ok: false, error: 'WhatsApp is not set up' }
  try {
    const res = await fetch(`https://graph.facebook.com/${VERSION()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data?.error?.message || `HTTP ${res.status}` }
    return { ok: true, id: data?.messages?.[0]?.id }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'request failed' }
  }
}

async function log(phone: string, kind: string, template: string | null, ref: string | null, r: { ok: boolean; id?: string; error?: string }) {
  try {
    await getSupabaseClient().from('whatsapp_messages').insert({ wa_message_id: r.id || null, phone, kind, template, ref, status: r.ok ? 'sent' : 'failed', error: r.ok ? null : (r.error || '').slice(0, 300) })
  } catch { /* logging must never break sending */ }
}

/** Send an approved template. `components` follow the Cloud API format. */
export async function sendTemplate(phone: string, template: string, components: Component[], meta: { kind: string; ref?: string | null }) {
  const r = await post({ to: phone, type: 'template', template: { name: template, language: { code: LANG() }, components } })
  if (!r.ok) logger.error(`WhatsApp template ${template} failed`, new Error(r.error || 'failed'))
  await log(phone, meta.kind, template, meta.ref || null, r)
  return r
}

/** Free text: only inside the 24 h window after the customer wrote to us. */
export async function sendTextIfWindowOpen(phone: string, body: string, meta: { kind: string; ref?: string | null }) {
  const { data } = await getSupabaseClient().from('whatsapp_contacts').select('last_inbound_at').eq('phone', phone).maybeSingle()
  const open = data?.last_inbound_at && Date.now() - new Date(data.last_inbound_at).getTime() < 23.5 * 3600_000
  if (!open) return { ok: false, error: 'outside the 24 h window' }
  const r = await post({ to: phone, type: 'text', text: { preview_url: true, body: body.slice(0, 4000) } })
  await log(phone, meta.kind, null, meta.ref || null, r)
  return r
}

/** Consent lookup. */
export async function waConsent(phone: string): Promise<{ updates: boolean; marketing: boolean }> {
  const { data } = await getSupabaseClient().from('whatsapp_contacts').select('updates_opt_in, marketing_opt_in, opted_out_at').eq('phone', phone).maybeSingle()
  return { updates: !!data?.updates_opt_in, marketing: !!data?.marketing_opt_in }
}

/** Record consent from checkout / forms (never switches anything OFF here). */
export async function recordWaConsent(input: { phone: string; name?: string | null; userId?: string | null; updates?: boolean; marketing?: boolean; source: string }) {
  const phone = waPhone(input.phone)
  if (!phone || (!input.updates && !input.marketing)) return
  const now = new Date().toISOString()
  const supabase = getSupabaseClient()
  const { data: existing } = await supabase.from('whatsapp_contacts').select('phone').eq('phone', phone).maybeSingle()
  const patch: Record<string, unknown> = { phone, updated_at: now, source: input.source }
  if (input.name) patch.name = input.name
  if (input.userId) patch.user_id = input.userId
  if (input.updates) { patch.updates_opt_in = true; patch.updates_opted_in_at = now }
  if (input.marketing) { patch.marketing_opt_in = true; patch.marketing_opted_in_at = now; patch.opted_out_at = null }
  await (existing ? supabase.from('whatsapp_contacts').update(patch).eq('phone', phone) : supabase.from('whatsapp_contacts').insert(patch))
}

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://honiccompanystore.com').replace(/\/$/, '')

/**
 * Order / offer messages (utility templates). Only to customers who opted in to order updates.
 * `button` is the dynamic part of the template's URL button (order reference or product path).
 */
export async function sendUtility(kind: UtilityKind, rawPhone: string | null | undefined, o: { params: string[]; button?: string; documentUrl?: string; documentName?: string; ref?: string | null; requireConsent?: boolean }) {
  if (!whatsappEnabled()) return { ok: false, error: 'WhatsApp is not set up' }
  const phone = waPhone(rawPhone)
  if (!phone) return { ok: false, error: 'no valid phone' }
  if (o.requireConsent !== false && !(await waConsent(phone)).updates) return { ok: false, error: 'no WhatsApp opt-in' }
  const components: Component[] = []
  if (o.documentUrl) components.push({ type: 'header', parameters: [{ type: 'document', document: { link: o.documentUrl, filename: o.documentName || 'Honic-invoice.pdf' } }] })
  components.push({ type: 'body', parameters: o.params.map(text) })
  if (o.button) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [text(o.button)] })
  return sendTemplate(phone, WA_TEMPLATES[kind], components, { kind, ref: o.ref })
}

export const orderButton = (reference: string) => String(reference || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase()
export const invoiceUrl = (reference: string) => `${siteUrl()}/api/orders/invoice/${orderButton(reference)}`

/** Approved templates from WhatsApp Manager (needs WHATSAPP_BUSINESS_ACCOUNT_ID). */
export async function listTemplates(): Promise<{ ok: boolean; templates: WaTemplate[]; error?: string }> {
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  if (!whatsappEnabled() || !waba) return { ok: false, templates: [], error: 'Add WHATSAPP_BUSINESS_ACCOUNT_ID to list templates' }
  try {
    const res = await fetch(`https://graph.facebook.com/${VERSION()}/${waba}/message_templates?limit=100&fields=name,status,category,language,components`, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, templates: [], error: data?.error?.message || `HTTP ${res.status}` }
    return { ok: true, templates: data.data || [] }
  } catch (error) {
    return { ok: false, templates: [], error: error instanceof Error ? error.message : 'request failed' }
  }
}
export type WaTemplate = { name: string; status: string; category: string; language: string; components: { type: string; format?: string; text?: string; buttons?: { type: string; text: string; url?: string }[] }[] }

/** Count {{n}} placeholders in a template text. */
export const placeholderCount = (t?: string) => (t ? new Set([...t.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size : 0)
