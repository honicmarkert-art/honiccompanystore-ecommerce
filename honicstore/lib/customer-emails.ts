import { logger } from '@/lib/logger'
import {
  sendInvoiceEmail,
  sendOrderCancellationEmail,
  sendOrderConfirmationEmail,
  sendSecurityAlertEmail,
  sendSupplierPremiumReceiptEmail,
} from '@/lib/user-email-service'

type Row = Record<string, unknown>

type Query = PromiseLike<{ data: Row[] | null }> & {
  eq: (column: string, value: string | number) => Query
  maybeSingle: () => Promise<{ data: Row | null }>
}

type Supabase = {
  from: (table: string) => { select: (columns: string) => Query }
  auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string } | null } }> } }
}

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

export async function sendPaidOrderEmails(supabase: Supabase, order: Row) {
  try {
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
      totalPrice: Number(item.total_price) || 0,
    }))
    const subtotal = items.reduce((sum: number, item: { totalPrice: number; price: number; quantity: number }) => sum + (item.totalPrice || item.price * item.quantity), 0)
    const shippingFee = Number(order.shipping_fee || order.shipping_cost || 0)
    const tax = Number(order.tax_amount || 0)
    const total = Number(order.total_amount) || subtotal + shippingFee + tax
    const orderNumber = String(order.order_number || order.id)
    const created = order.created_at
    const orderUrl = `${siteUrl()}/account/orders/${encodeURIComponent(orderNumber)}`
    const invoiceUrl = `${siteUrl()}/api/user/orders/${encodeURIComponent(orderNumber)}/invoice`

    await sendOrderConfirmationEmail(email, {
      orderNumber,
      orderDate: new Date(typeof created === 'string' || typeof created === 'number' ? created : Date.now()).toLocaleString('en-TZ', { timeZone: 'Africa/Dar_es_Salaam' }),
      items,
      subtotal,
      shipping: shippingFee,
      tax,
      total,
      shippingAddress: shipping,
      billingAddress: billing,
      paymentMethod: text(order.payment_method) || 'Mobile money',
      trackingUrl: orderUrl,
      invoiceUrl,
    })
    await sendInvoiceEmail(email, {
      invoiceNumber: orderNumber,
      invoiceDate: new Date().toLocaleDateString('en-TZ', { timeZone: 'Africa/Dar_es_Salaam' }),
      orderNumber,
      items,
      subtotal,
      tax,
      total,
      billingAddress: Object.keys(billing).length ? billing : shipping,
      invoiceUrl,
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
        refundTimeline: paid ? '5-7 business days' : undefined,
      })
    } catch (error) {
      logger.error('Expired order email failed:', error)
    }
  }
}
