/**
 * Tell the customer when their order moves: on the way, ready for pickup, delivered.
 * Called by /api/webhooks/order-status (database trigger, whichever app changed the status).
 * Each (order, step, channel) is sent once (order_notifications). Channels: SMS (Beem, when set up)
 * and email (when the customer gave one). Server only.
 */
import { getSupabaseClient } from '@/lib/supabase-server'
import { sendOrderStatusEmail } from '@/lib/user-email-service'
import { sendSms } from '@/lib/sms'
import { orderButton, sendUtility } from '@/lib/whatsapp'
import { tzPhone } from '@/lib/offers'
import { logger } from '@/lib/logger'

export type StatusKind = 'shipped' | 'ready_for_pickup' | 'delivered'
type Addr = Record<string, string | undefined>

const site = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://honiccompanystore.com').replace(/\/$/, '')

/** Which customer message (if any) a new status means, given delivery vs pickup. */
export function kindFor(status: string, pickup: boolean): StatusKind | null {
  if (status === 'ready_for_pickup') return 'ready_for_pickup'
  if (status === 'delivered') return pickup ? 'ready_for_pickup' : 'delivered' // pickup: delivered to our store
  if (status === 'shipped') return pickup ? null : 'shipped'
  return null
}

export function smsText(kind: StatusKind, o: { orderNumber: string; link: string; pickupId?: string | null; tracking?: string | null }) {
  if (kind === 'shipped') return `Honic: Oda ${o.orderNumber} imetumwa, iko njiani.${o.tracking ? ` Namba ya mzigo: ${o.tracking}.` : ''} Your order is on the way. ${o.link}`
  if (kind === 'ready_for_pickup') return `Honic: Oda ${o.orderNumber} iko tayari kuchukuliwa dukani.${o.pickupId ? ` Pickup ID: ${o.pickupId}.` : ''} Leta kitambulisho. Ready for pickup. ${o.link}`
  return `Honic: Oda ${o.orderNumber} imefika. Tafadhali thibitisha umeipokea. Delivered, please confirm: ${o.link}`
}

/** claim (order, kind, channel); false if it was already sent */
async function claim(orderNumber: string, kind: StatusKind, channel: 'sms' | 'email' | 'whatsapp') {
  const { error } = await getSupabaseClient().from('order_notifications').insert({ order_number: orderNumber, kind, channel })
  return !error
}
async function unclaim(orderNumber: string, kind: StatusKind, channel: 'sms' | 'email' | 'whatsapp') {
  await getSupabaseClient().from('order_notifications').delete().eq('order_number', orderNumber).eq('kind', kind).eq('channel', channel)
}

export async function notifyOrderStatus(input: { table: string; id: string | number; status: string }): Promise<{ sent: string[]; skipped?: string }> {
  const supabase = getSupabaseClient()
  let confirmedOrderId: string | null = null
  let tracking: string | null = null
  if (input.table === 'confirmed_order_items') {
    const { data: item } = await supabase.from('confirmed_order_items').select('confirmed_order_id, status, tracking_number').eq('id', input.id).maybeSingle()
    if (!item || item.status !== input.status) return { sent: [], skipped: 'item changed again or not found' }
    confirmedOrderId = item.confirmed_order_id
    tracking = item.tracking_number || null
  } else if (input.table === 'confirmed_orders') {
    confirmedOrderId = String(input.id)
  } else return { sent: [], skipped: 'unknown table' }

  const { data: o } = await supabase.from('confirmed_orders')
    .select('order_number, reference_id, delivery_option, pickup_id, user_id, shipping_address, billing_address')
    .eq('id', confirmedOrderId).maybeSingle()
  if (!o) return { sent: [], skipped: 'order not found' }

  const pickup = o.delivery_option === 'pickup'
  const kind = kindFor(input.status, pickup)
  if (!kind) return { sent: [], skipped: `no message for ${input.status}` }

  const ship = (o.shipping_address || {}) as Addr
  const bill = (o.billing_address || {}) as Addr
  const ref = String(o.reference_id || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase()
  const link = ref ? `${site()}/orders/${ref}` : `${site()}/support/order-tracking`
  const firstName = String(bill.fullName || ship.fullName || '').trim().split(/\s+/)[0] || ''
  const sent: string[] = []

  // WhatsApp first (if they opted in), SMS only when WhatsApp did not go
  const phone = tzPhone(ship.phone || bill.phone || '')
  let viaWhatsApp = false
  if (phone && (await claim(o.order_number, kind, 'whatsapp'))) {
    const name = firstName || 'Mteja'
    const wa = kind === 'shipped'
      ? await sendUtility('order_shipped', phone, { params: [name, o.order_number, tracking || '-'], button: orderButton(ref), ref: o.order_number })
      : kind === 'ready_for_pickup'
        ? await sendUtility('order_ready_pickup', phone, { params: [name, o.order_number], button: orderButton(ref), ref: o.order_number })
        : await sendUtility('order_delivered', phone, { params: [name, o.order_number], button: orderButton(ref), ref: o.order_number })
    viaWhatsApp = wa.ok
    if (wa.ok) sent.push('whatsapp'); else await unclaim(o.order_number, kind, 'whatsapp')
  }

  // SMS
  if (phone && !viaWhatsApp && (await claim(o.order_number, kind, 'sms'))) {
    const ok = await sendSms(phone, smsText(kind, { orderNumber: o.order_number, link, pickupId: o.pickup_id, tracking }))
    if (ok) sent.push('sms'); else await unclaim(o.order_number, kind, 'sms') // not set up / failed: allow a later try
  }

  // email (account email first, then the one given at checkout)
  let email = ''
  if (o.user_id) {
    try { const { data } = await supabase.auth.admin.getUserById(o.user_id); email = data.user?.email || '' } catch { /* fall back */ }
  }
  email = email || ship.email || bill.email || ''
  if (email && (await claim(o.order_number, kind, 'email'))) {
    const r = await sendOrderStatusEmail(email, { kind, orderNumber: o.order_number, orderUrl: link, firstName, pickupId: o.pickup_id, tracking })
    if (r.success) sent.push('email'); else await unclaim(o.order_number, kind, 'email')
  }
  if (!sent.length) logger.log(`Order ${o.order_number}: no ${kind} message sent (no channel, or already sent)`)
  return { sent }
}
