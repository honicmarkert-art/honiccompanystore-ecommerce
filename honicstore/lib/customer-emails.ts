import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import {
  sendOrderCancellationEmail,
  sendPaymentReceivedEmail,
  sendSecurityAlertEmail,
  sendSupplierPremiumReceiptEmail,
} from '@/lib/user-email-service'
import { buildInvoicePdf, invoiceFileName, loadInvoiceOrder } from '@/lib/invoice-pdf'
import { TOP_UP_LABEL } from '@/lib/policies'

type Row = Record<string, unknown>

type Query = PromiseLike<{ data: Row[] | null }> & {
  eq: (column: string, value: string | number) => Query
  maybeSingle: () => Promise<{ data: Row | null }>
}

// The real client; the hand-written shape it replaced no longer matched supabase-js 2.119
type Supabase = SupabaseClient

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://honiccompanystore.com'
}

function readAddress(value: unknown) {
  if (!value) return {}
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return {} }
  }
  return value as Record<string, string>
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function key(value: unknown): string | number {
  return typeof value === 'string' || typeof value === 'number' ? value : ''
}

async function customerEmail(supabase: Supabase, userId: unknown, shipping: Record<string, string>, billing: Record<string, string>) {
    const accountId = text(userId)
    if (accountId) {
      try {
        const { data } = await supabase.auth.admin.getUserById(accountId)
      if (data.user?.email) return data.user.email
    } catch (error) {
      logger.error('Could not read account email:', error)
    }
  }
  return shipping.email || billing.email || ''
}

/**
 * The one email a shopper gets when payment is confirmed: summary, private order link and the
 * invoice PDF attached. Called by whichever request flips the order to paid (webhook or status check),
 * so it goes out once.
 */
export async function sendPaidOrderEmails(supabase: Supabase, partial: Row) {
  try {
    const { data: full } = await supabase.from('orders').select('*').eq('id', key(partial.id)).maybeSingle()
    const order: Row = (full as Row) || partial
    const shipping = readAddress(order.shipping_address)
    const billing = readAddress(order.billing_address)
    const email = await customerEmail(supabase, order.user_id || null, shipping, billing)
    if (!email) return

    const { data: rows } = await supabase
      .from('order_items')
      .select('product_name, quantity, price, total_price')
      .eq('order_id', key(order.id))
    const items = (rows || []).map((item) => ({
      name: text(item.product_name) || 'Item',
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      totalPrice: Number(item.total_price) || (Number(item.price) || 0) * (Number(item.quantity) || 1),
    }))
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
    const total = Number(order.total_amount) || subtotal
    const orderNumber = String(order.order_number || order.id)
    const ref = String(order.reference_id || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase()
    const base = siteUrl().replace(/\/$/, '')
    // private order link: works for guests and members on any device, no sign-in needed
    const orderUrl = ref ? `${base}/orders/${ref}` : `${base}/account/orders/${encodeURIComponent(orderNumber)}`
    const invoiceUrl = ref ? `${base}/api/orders/invoice/${ref}` : `${base}/api/user/orders/${encodeURIComponent(orderNumber)}/invoice`
    const pickup = order.delivery_option === 'pickup'
    const deliveryLine = pickup
      ? `Store pickup${order.pickup_id ? ` · pickup ID ${text(order.pickup_id)}` : ''}. Bring the pickup ID and a valid ID.`
      : `To ${[shipping.address1 || shipping.address, shipping.district, shipping.city, shipping.region].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'the address you gave at checkout'}`

    // invoice PDF attached (skip the attachment, not the email, if it cannot be built)
    let invoicePdf: { filename: string; content: Uint8Array; contentType: string } | undefined
    try {
      const inv = ref ? await loadInvoiceOrder(supabase, { referenceId: ref }) : null
      if (inv) invoicePdf = { filename: invoiceFileName(inv), content: await buildInvoicePdf(inv), contentType: 'application/pdf' }
    } catch (error) {
      logger.error('Invoice PDF for email failed:', error)
    }

    await sendPaymentReceivedEmail(email, {
      name: shipping.fullName || billing.fullName,
      orderNumber,
      orderDate: new Date(String(order.created_at || Date.now())).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' }),
      items,
      subtotal,
      shipping: Math.max(0, total - subtotal),
      extraLabel: pickup ? (total - subtotal > 0 ? TOP_UP_LABEL : 'Pickup') : 'Delivery',
      total,
      deliveryLine,
      orderUrl,
      invoiceUrl,
      invoicePdf,
    })
  } catch (error) {
    logger.error('Paid order email failed:', error)
  }
}

export async function sendSupplierPlanReceipt(supabase: Supabase, profileId: string) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company_name, email, payment_amount, payment_reference_id, pending_plan_id, supplier_plan_id')
      .eq('id', profileId)
      .maybeSingle()
    if (!profile) return
    const email = (await customerEmail(supabase, profileId, {}, {})) || text(profile.email)
    const amount = Number(profile.payment_amount)
    if (!email || !Number.isFinite(amount) || amount <= 0) return
    const planId = text(profile.pending_plan_id) || text(profile.supplier_plan_id)
    let planName = 'Supplier plan'
    let billingCycle: 'monthly' | 'yearly' = 'monthly'
    if (planId) {
      const { data: plan } = await supabase
        .from('supplier_plans')
        .select('name, yearly_price')
        .eq('id', planId)
        .maybeSingle()
      if (text(plan?.name)) planName = text(plan?.name)
      const paid = Number(profile.payment_amount)
      if (plan?.yearly_price != null && Number(plan.yearly_price) === paid) billingCycle = 'yearly'
    }
    await sendSupplierPremiumReceiptEmail(email, {
      companyName: text(profile.company_name) || text(profile.full_name) || email,
      planName,
      amount,
      currency: 'TZS',
      referenceId: text(profile.payment_reference_id) || profileId,
      billingCycle,
      paymentDate: new Date().toLocaleDateString('en-TZ', { timeZone: 'Africa/Dar_es_Salaam' }),
      dashboardUrl: `${siteUrl()}/supplier/dashboard`,
    })
  } catch (error) {
    logger.error('Supplier plan receipt email failed:', error)
  }
}

export async function sendPasswordChangedAlert(email: string, request: { headers: { get: (name: string) => string | null } }) {
  try {
    await sendSecurityAlertEmail(email, {
      alertType: 'Password changed',
      activity: 'The password on this account was changed.',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      timestamp: new Date().toLocaleString('en-TZ', { timeZone: 'Africa/Dar_es_Salaam' }),
      actionTaken: 'The new password is now active.',
      supportUrl: `${siteUrl()}/support`,
    })
  } catch (error) {
    logger.error('Password security email failed:', error)
  }
}

export async function sendExpiredOrderEmails(supabase: Supabase, orders: Array<{
  id?: unknown
  order_number?: unknown
  user_id?: unknown
  total_amount?: unknown
  payment_status?: unknown
  shipping_address?: unknown
  billing_address?: unknown
}>) {
  for (const order of orders) {
    try {
      const shipping = readAddress(order.shipping_address)
      const billing = readAddress(order.billing_address)
      const email = await customerEmail(supabase, order.user_id || null, shipping, billing)
      if (!email) continue
      const paid = order.payment_status === 'paid' || order.payment_status === 'success'
      await sendOrderCancellationEmail(email, {
        orderNumber: String(order.order_number || order.id),
        cancellationReason: 'Expired. Not confirmed within 15 minutes.',
        refundAmount: paid ? Number(order.total_amount) || undefined : undefined,
        refundMethod: paid ? 'Original payment method' : undefined,
      })
    } catch (error) {
      logger.error('Expired order email failed:', error)
    }
  }
}
