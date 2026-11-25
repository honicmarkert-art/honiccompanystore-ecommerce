/**
 * Emails from Honic to shoppers and sellers. Server only.
 *
 * Every email uses the shared layout (lib/email-layout.ts). Kinds of email:
 *   - account / order / security  -> always sent (no opt-out)
 *   - alerts and reminders        -> only if the person has not switched them off (lib/email-consent.ts),
 *                                    with a one-click "stop" link + List-Unsubscribe headers
 *   - marketing (offers, news)    -> only to confirmed subscribers (double opt-in), with one-click unsubscribe
 * All values from users or the database are escaped (esc) before going into HTML.
 */
import { sendEmail } from './email-service'
import { getWelcomeUserTemplate, getWelcomeSupplierTemplate, type EmailTemplateOptions } from './email-templates'
import { BRAND, button, callout, codeBox, details, divider, esc, heading, itemTable, paragraph, productCard, renderEmail, safeUrl, steps, tzs } from './email-layout'
import { mayEmail, optionalEmailExtras, type OptionalCategory } from './email-consent'
import { confirmUrl, siteUrl } from './email-links'
import { RETURN_DAYS, REFUND_BUSINESS_DAYS } from './policies'
import { logger } from './logger'

type Result = { success: boolean; error?: string; messageId?: string; skipped?: boolean }
type Attachment = { filename: string; content: Uint8Array; contentType?: string }

const STORE = process.env.COMPANY_NAME || 'Honic'
const SUPPORT = process.env.SUPPORT_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@honiccompanystore.com'

async function getCompanySettings(): Promise<EmailTemplateOptions> {
  return {
    companyName: process.env.COMPANY_NAME || 'Honic Company Store',
    supportEmail: SUPPORT,
    contactEmail: process.env.CONTACT_EMAIL || 'contact@honiccompanystore.com',
    salesEmail: process.env.SALES_EMAIL || 'sales@honiccompanystore.com',
  }
}

/** Sender address (Resend SMTP authenticates as "resend", so use the configured sender address). */
function getSenderEmailForFrom(): string {
  const smtpUser = process.env.SMTP_USER
  const isResendSmtp = process.env.SMTP_HOST?.includes('resend.com') || smtpUser?.toLowerCase() === 'resend'
  if (isResendSmtp || !smtpUser || !smtpUser.includes('@')) {
    return process.env.SMTP_SENDER_EMAIL_NOREPLY || process.env.SMTP_SENDER_EMAIL_INFO || process.env.SMTP_SENDER_EMAIL_SUPPORT || process.env.NOREPLY_EMAIL || 'noreply@mail.honiccompanystore.com'
  }
  return smtpUser
}
const from = (name = 'Honic') => `${name} <${getSenderEmailForFrom()}>`

function validateEmail(email: string): boolean {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
const firstName = (name?: string) => String(name || '').trim().split(/\s+/)[0] || ''

/** Build and send one email. Optional categories are checked against the person's preferences first. */
async function deliver(o: {
  to: string
  subject: string
  preheader: string
  eyebrow: string
  title: string
  body: string
  text: string
  category?: OptionalCategory
  footnote?: string
  fromName?: string
  attachments?: Attachment[]
  replyTo?: string
}): Promise<Result> {
  try {
    if (!validateEmail(o.to)) return { success: false, error: 'Invalid email address' }
    if (o.category && !(await mayEmail(o.to, o.category))) {
      logger.log(`Email skipped (${o.category} switched off)`)
      return { success: true, skipped: true }
    }
    const extras = o.category ? optionalEmailExtras(o.to, o.category) : null
    const html = renderEmail({
      preheader: o.preheader, eyebrow: o.eyebrow, title: o.title, body: o.body,
      footnote: extras?.footnote || o.footnote,
      siteUrl: siteUrl(), supportEmail: SUPPORT, companyName: STORE,
    })
    const text = `${o.text.trim()}\n\n${extras ? extras.text : `Questions? ${SUPPORT}`}\n${STORE} · ${siteUrl()}`
    return await sendEmail({
      to: o.to, subject: o.subject, html, text, from: from(o.fromName), replyTo: o.replyTo || SUPPORT,
      headers: extras?.headers, attachments: o.attachments,
    })
  } catch (error) {
    logger.error(`Email failed (${o.subject}):`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Email failed' }
  }
}

const orderNote = 'You are getting this email about your order on Honic.'

// ============================================================ orders

/** One email when payment is confirmed: summary, order link, invoice PDF attached. */
export async function sendPaymentReceivedEmail(userEmail: string, o: {
  name?: string
  orderNumber: string
  orderDate: string
  items: Array<{ name: string; quantity: number; price: number; totalPrice?: number }>
  subtotal: number
  shipping: number
  total: number
  deliveryLine: string
  orderUrl: string
  invoiceUrl: string
  invoicePdf?: Attachment
}): Promise<Result> {
  const first = firstName(o.name)
  return deliver({
    to: userEmail,
    subject: `Payment received – order ${o.orderNumber}`,
    preheader: `We received ${tzs(o.total)} for order ${o.orderNumber}. We are preparing it now.`,
    eyebrow: 'Payment received',
    title: `Thank you${first ? `, ${esc(first)}` : ''}! Your order is confirmed.`,
    body: `
      ${paragraph(`We received <strong style="color:${BRAND.ink}">${esc(tzs(o.total))}</strong> for order <strong style="color:${BRAND.ink}">${esc(o.orderNumber)}</strong>. We are preparing it now.`)}
      ${itemTable(o.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.totalPrice ?? i.price * i.quantity })), [
        ['Items', tzs(o.subtotal)],
        ['Delivery', o.shipping > 0 ? tzs(o.shipping) : 'Free'],
        ['Total paid', tzs(o.total), true],
      ])}
      ${callout('Delivery', esc(o.deliveryLine), 'slate')}
      ${button('Follow your order', o.orderUrl)}
      <p style="margin:6px 0 0;font-size:14px;color:${BRAND.muted};font-family:Arial,sans-serif">${o.invoicePdf ? 'Your invoice is attached as a PDF. ' : ''}<a href="${safeUrl(o.invoiceUrl)}" style="color:${BRAND.orange}">Download the invoice (PDF)</a></p>
      ${divider}
      ${heading('What happens next')}
      ${steps([
        { title: 'We prepare your order', text: 'The seller packs your items.' },
        { title: 'On the way', text: 'Follow every step with the button above. No sign-in needed.' },
        { title: 'It arrives', text: `Something wrong? You can ask for a return within ${RETURN_DAYS} days of delivery.` },
      ])}
    `,
    text: `Thank you${first ? `, ${first}` : ''}! We received ${tzs(o.total)} for order ${o.orderNumber}.

${o.items.map((i) => `- ${i.quantity} x ${i.name}: ${tzs(i.totalPrice ?? i.price * i.quantity)}`).join('\n')}
Items: ${tzs(o.subtotal)}
Delivery: ${o.shipping > 0 ? tzs(o.shipping) : 'Free'}
Total paid: ${tzs(o.total)}

${o.deliveryLine}

Follow your order: ${o.orderUrl}
Invoice (PDF): ${o.invoiceUrl}`,
    footnote: orderNote,
    attachments: o.invoicePdf ? [o.invoicePdf] : undefined,
  })
}

/** Kept for older callers: same email as payment received, without the attachment. */
export async function sendOrderConfirmationEmail(userEmail: string, orderData: {
  orderNumber: string
  orderDate: string
  items: Array<{ name: string; quantity: number; price: number; image?: string; totalPrice?: number }>
  subtotal: number
  shipping: number
  tax: number
  total: number
  shippingAddress: { fullName?: string; city?: string; region?: string } | null | undefined
  billingAddress?: unknown
  paymentMethod: string
  trackingUrl?: string
  invoiceUrl?: string
}): Promise<Result> {
  const a = orderData.shippingAddress || {}
  return sendPaymentReceivedEmail(userEmail, {
    name: a.fullName, orderNumber: orderData.orderNumber, orderDate: orderData.orderDate, items: orderData.items,
    subtotal: orderData.subtotal, shipping: orderData.shipping, total: orderData.total,
    deliveryLine: [a.city, a.region].filter(Boolean).join(', ') || 'To the address you gave at checkout',
    orderUrl: orderData.trackingUrl || `${siteUrl()}/support/order-tracking`, invoiceUrl: orderData.invoiceUrl || `${siteUrl()}/support/order-tracking`,
  })
}

export async function sendOrderPlacedWelcomeEmail(userEmail: string, o: { orderNumber: string; orderDate: string; totalAmount: number; itemsCount: number; orderUrl: string }): Promise<Result> {
  return deliver({
    to: userEmail,
    subject: `We received order ${o.orderNumber}`,
    preheader: `Complete the payment on your phone to confirm order ${o.orderNumber}.`,
    eyebrow: 'Order received',
    title: `We received order ${esc(o.orderNumber)}`,
    body: `${paragraph('Approve the mobile money request on your phone to confirm it. Unpaid orders are cancelled automatically.')}
      ${details([['Order', o.orderNumber], ['Date', o.orderDate], ['Items', String(o.itemsCount)], ['Total', tzs(o.totalAmount)]])}
      ${button('View your order', o.orderUrl)}`,
    text: `We received order ${o.orderNumber} (${tzs(o.totalAmount)}). Approve the payment request on your phone to confirm it.\n${o.orderUrl}`,
    footnote: orderNote,
  })
}

export async function sendInvoiceEmail(userEmail: string, inv: {
  invoiceNumber: string
  invoiceDate: string
  orderNumber: string
  items: Array<{ name: string; quantity: number; price: number; totalPrice?: number }>
  subtotal: number
  tax: number
  total: number
  billingAddress: unknown
  invoiceUrl: string
}): Promise<Result> {
  return deliver({
    to: userEmail,
    subject: `Your invoice for order ${inv.orderNumber}`,
    preheader: `Invoice ${inv.invoiceNumber} · ${tzs(inv.total)}`,
    eyebrow: 'Invoice',
    title: `Your invoice for order ${esc(inv.orderNumber)}`,
    body: `${details([['Invoice', inv.invoiceNumber], ['Date', inv.invoiceDate], ['Total', tzs(inv.total)]])}
      ${button('Download invoice (PDF)', inv.invoiceUrl)}`,
    text: `Invoice ${inv.invoiceNumber} for order ${inv.orderNumber}: ${tzs(inv.total)}.\nDownload (PDF): ${inv.invoiceUrl}`,
    footnote: orderNote,
  })
}

export async function sendDeliveryConfirmationEmail(userEmail: string, o: { orderNumber: string; deliveryDate: string; items: Array<{ name: string; quantity: number; image?: string }>; reviewUrl?: string }): Promise<Result> {
  return deliver({
    to: userEmail,
    subject: `Delivered: order ${o.orderNumber}`,
    preheader: 'Thank you for shopping with Honic. Tell others what you think.',
    eyebrow: 'Delivered',
    title: 'Enjoy your order!',
    body: `${paragraph(`Order <strong style="color:${BRAND.ink}">${esc(o.orderNumber)}</strong> is complete. Thank you for shopping with Honic.`)}
      ${itemTable(o.items.map((i) => ({ name: i.name, quantity: i.quantity })))}
      ${o.reviewUrl ? button('Review your purchase', o.reviewUrl) : ''}
      ${callout('Something not right?', `You can ask for a return within ${RETURN_DAYS} days of delivery. <a href="${safeUrl(`${siteUrl()}/support/returns-refunds`)}" style="color:${BRAND.orange}">How returns work</a>`, 'slate')}`,
    text: `Order ${o.orderNumber} is complete. Thank you for shopping with Honic.${o.reviewUrl ? `\nReview your purchase: ${o.reviewUrl}` : ''}\nReturns within ${RETURN_DAYS} days: ${siteUrl()}/support/returns-refunds`,
    footnote: orderNote,
  })
}

export async function sendOrderCancellationEmail(userEmail: string, o: { orderNumber: string; cancellationReason: string; refundAmount?: number; refundMethod?: string; refundTimeline?: string }): Promise<Result> {
  const refund = o.refundAmount && o.refundAmount > 0
  const timeline = o.refundTimeline || `${REFUND_BUSINESS_DAYS} business days`
  return deliver({
    to: userEmail,
    subject: `Order ${o.orderNumber} was cancelled`,
    preheader: refund ? `Your refund of ${tzs(o.refundAmount!)} is on its way.` : 'No money was taken.',
    eyebrow: 'Order cancelled',
    title: `Order ${esc(o.orderNumber)} was cancelled`,
    body: `${paragraph(esc(o.cancellationReason))}
      ${refund
        ? callout('Your refund', `We are sending ${esc(tzs(o.refundAmount!))} back to ${esc(o.refundMethod || 'the same payment method')}. It usually arrives within ${esc(timeline)}.`, 'green')
        : callout('No money was taken', 'You were not charged for this order. Your items are still waiting in your cart if you want to order again.', 'slate')}
      ${button('Go to your cart', `${siteUrl()}/cart`)}`,
    text: `Order ${o.orderNumber} was cancelled. ${o.cancellationReason}\n${refund ? `Refund: ${tzs(o.refundAmount!)} to ${o.refundMethod || 'the same payment method'}, within ${timeline}.` : 'No money was taken.'}\nYour cart: ${siteUrl()}/cart`,
    footnote: orderNote,
  })
}

// ============================================================ sellers

export async function sendSupplierPremiumReceiptEmail(userEmail: string, d: {
  companyName: string; planName: string; amount: number; currency: string; referenceId: string; transactionId?: string
  billingCycle: 'monthly' | 'yearly'; paymentDate: string; dashboardUrl: string
}): Promise<Result> {
  return deliver({
    to: userEmail,
    subject: `Payment received – ${d.planName} plan`,
    preheader: `Your ${d.planName} seller plan is active.`,
    eyebrow: 'Payment received',
    title: `Your ${esc(d.planName)} plan is active`,
    body: `${paragraph(`Thank you, ${esc(d.companyName)}. Your seller plan is now active.`)}
      ${details([['Plan', d.planName], ['Billing', d.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'], ['Amount', d.currency === 'TZS' ? tzs(d.amount) : `${d.currency} ${d.amount}`], ['Date', d.paymentDate], ['Reference', d.referenceId], ['Transaction', d.transactionId || '']])}
      ${button('Open your dashboard', d.dashboardUrl)}`,
    text: `Your ${d.planName} plan is active. Amount: ${d.currency} ${d.amount}. Reference: ${d.referenceId}.\nDashboard: ${d.dashboardUrl}`,
    footnote: 'You are getting this email about your Honic seller account.',
    fromName: 'Honic Sellers',
  })
}

export async function sendWelcomeUserEmail(userEmail: string, userData: { name: string; accountUrl: string }): Promise<Result> {
  try {
    if (!validateEmail(userEmail)) return { success: false, error: 'Invalid email address' }
    const options = await getCompanySettings()
    const { html, text } = getWelcomeUserTemplate(userData, options)
    return await sendEmail({ to: userEmail, subject: `Welcome to ${STORE}!`, html, text, from: from('Honic'), replyTo: SUPPORT })
  } catch (error) {
    logger.error('Error sending welcome email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Email failed' }
  }
}

export async function sendWelcomeSupplierEmail(supplierEmail: string, supplierData: { name: string; companyName: string; dashboardUrl: string; commissionRate: string }): Promise<Result> {
  try {
    if (!validateEmail(supplierEmail)) return { success: false, error: 'Invalid email address' }
    const options = await getCompanySettings()
    const { html, text } = getWelcomeSupplierTemplate(supplierData, options)
    return await sendEmail({ to: supplierEmail, subject: `Welcome to ${STORE} – your seller account`, html, text, from: from('Honic Sellers'), replyTo: SUPPORT })
  } catch (error) {
    logger.error('Error sending welcome supplier email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Email failed' }
  }
}

// ============================================================ security

export async function sendPasswordChangeOTPEmail(userEmail: string, otpCode: string, expiresInMinutes: number = 15): Promise<Result> {
  return deliver({
    to: userEmail,
    subject: `${otpCode} is your Honic code`,
    preheader: `Use this code to change your password. It expires in ${expiresInMinutes} minutes.`,
    eyebrow: 'Security',
    title: 'Your code to change your password',
    body: `${paragraph('Enter this code to confirm it is you:')}
      ${codeBox(otpCode)}
      ${paragraph(`It expires in ${expiresInMinutes} minutes. Never share it: Honic staff will never ask for it.`)}
      ${callout('Did not ask for this?', 'Ignore this email. Your password stays the same. If you keep getting codes, change your password and tell us.', 'orange')}`,
    text: `Your Honic code: ${otpCode}\nIt expires in ${expiresInMinutes} minutes. Never share it. If you did not ask for it, ignore this email.`,
    footnote: 'You are getting this security email because someone asked to change the password on your Honic account.',
    fromName: 'Honic Security',
  })
}

export async function sendSecurityAlertEmail(userEmail: string, a: { alertType: string; activity: string; location?: string; ipAddress?: string; timestamp: string; actionTaken: string; supportUrl: string }): Promise<Result> {
  return deliver({
    to: userEmail,
    subject: `Security alert: ${a.alertType}`,
    preheader: a.activity,
    eyebrow: 'Security alert',
    title: esc(a.alertType),
    body: `${paragraph(esc(a.activity))}
      ${details([['When', a.timestamp], ['Location', a.location || ''], ['IP address', a.ipAddress || '']])}
      ${callout('Was this you?', `${esc(a.actionTaken)}`, 'orange')}
      ${button('Get help', a.supportUrl)}`,
    text: `${a.alertType}\n${a.activity}\nWhen: ${a.timestamp}${a.location ? `\nLocation: ${a.location}` : ''}\n${a.actionTaken}\nHelp: ${a.supportUrl}`,
    footnote: 'You are getting this security email about your Honic account. We send these even if you turned off other emails.',
    fromName: 'Honic Security',
  })
}

// ============================================================ alerts the shopper asked for

export async function sendPriceDropAlertEmail(userEmail: string, p: { name: string; image: string; originalPrice: number; newPrice: number; discountPercent: number; productUrl: string; targetPrice?: number }): Promise<Result> {
  return deliver({
    to: userEmail,
    category: 'price_alerts',
    subject: `Price drop: ${p.name} is now ${tzs(p.newPrice)}`,
    preheader: p.targetPrice ? `It reached your target of ${tzs(p.targetPrice)}.` : `Now ${p.discountPercent}% lower.`,
    eyebrow: 'Price drop alert',
    title: `Good news: the price dropped`,
    body: `${productCard({ name: p.name, image: p.image, url: p.productUrl, priceHtml: `<strong style="font-size:18px;color:${BRAND.orange}">${esc(tzs(p.newPrice))}</strong>${p.originalPrice > p.newPrice ? ` <span style="color:${BRAND.muted};text-decoration:line-through">${esc(tzs(p.originalPrice))}</span>` : ''}${p.targetPrice ? `<br><span style="font-size:13px;color:${BRAND.muted}">Your target: ${esc(tzs(p.targetPrice))}</span>` : ''}` })}
      ${paragraph('Prices and stock can change at any time.')}
      ${button('View product', p.productUrl)}`,
    text: `${p.name} is now ${tzs(p.newPrice)}${p.originalPrice > p.newPrice ? ` (was ${tzs(p.originalPrice)})` : ''}.\n${p.productUrl}`,
    fromName: 'Honic Alerts',
  })
}

export async function sendBackInStockEmail(userEmail: string, p: { name: string; image: string; price: number; productUrl: string; stockQuantity?: number }): Promise<Result> {
  const few = p.stockQuantity != null && p.stockQuantity > 0 && p.stockQuantity <= 5
  return deliver({
    to: userEmail,
    category: 'back_in_stock',
    subject: `Back in stock: ${p.name}`,
    preheader: few ? `Only ${p.stockQuantity} available.` : 'Available again on Honic.',
    eyebrow: 'Back in stock',
    title: 'It is back in stock',
    body: `${productCard({ name: p.name, image: p.image, url: p.productUrl, priceHtml: `<strong style="font-size:18px;color:${BRAND.ink}">${esc(tzs(p.price))}</strong>${few ? `<br><span style="font-size:13px;color:${BRAND.orange};font-weight:700">Only ${esc(p.stockQuantity)} available</span>` : ''}` })}
      ${button('View product', p.productUrl)}`,
    text: `${p.name} is back in stock at ${tzs(p.price)}.\n${p.productUrl}`,
    fromName: 'Honic Alerts',
  })
}

// ============================================================ reminders (on by default for account holders, one-click off)

export async function sendAbandonedCartEmail(userEmail: string, c: { items: Array<{ name: string; quantity: number; price: number; image?: string }>; total: number; cartUrl: string; discountCode?: string }): Promise<Result> {
  return deliver({
    to: userEmail,
    category: 'abandoned_cart',
    subject: 'You left something in your cart',
    preheader: `${c.items.length} item${c.items.length === 1 ? '' : 's'} waiting · ${tzs(c.total)}`,
    eyebrow: 'Your cart',
    title: 'Still thinking it over?',
    body: `${paragraph('Your items are saved. Prices and stock can change, so finish when you are ready.')}
      ${itemTable(c.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.price * i.quantity })), [['Total', tzs(c.total), true]])}
      ${c.discountCode ? callout('A code for you', `Use <strong>${esc(c.discountCode)}</strong> in your cart.`, 'orange') : ''}
      ${button('Return to your cart', c.cartUrl)}`,
    text: `Your cart is saved:\n${c.items.map((i) => `- ${i.quantity} x ${i.name}`).join('\n')}\nTotal: ${tzs(c.total)}\n${c.cartUrl}`,
    fromName: 'Honic',
  })
}

export async function sendReviewRequestEmail(userEmail: string, o: { orderNumber: string; productName: string; productImage: string; productUrl: string; reviewUrl: string }): Promise<Result> {
  return deliver({
    to: userEmail,
    category: 'review_requests',
    subject: `How is your ${o.productName}?`,
    preheader: 'A short review helps other shoppers in Tanzania choose well.',
    eyebrow: 'How was it?',
    title: `How is your ${esc(o.productName)}?`,
    body: `${productCard({ name: o.productName, image: o.productImage, url: o.productUrl, priceHtml: `<span style="color:${BRAND.muted};font-size:13px">Order ${esc(o.orderNumber)}</span>` })}
      ${paragraph('Your honest review takes a minute and helps other shoppers choose well. Only verified buyers can review.')}
      ${button('Write a review', o.reviewUrl)}`,
    text: `How is your ${o.productName}? Write a review: ${o.reviewUrl}`,
    fromName: 'Honic',
  })
}

// ============================================================ newsletter / marketing (double opt-in)

/** Step 1 of double opt-in: "confirm your subscription". Not marketing itself, so no unsubscribe needed. */
export async function sendNewsletterConfirmEmail(userEmail: string): Promise<Result> {
  const url = confirmUrl(userEmail)
  return deliver({
    to: userEmail,
    subject: 'Confirm your Honic subscription',
    preheader: 'One click and you will get our offers and news.',
    eyebrow: 'Confirm your subscription',
    title: 'One click to confirm',
    body: `${paragraph('You asked to get offers, coupons and new arrivals from Honic. Please confirm it is you:')}
      ${button('Yes, subscribe me', url)}
      ${paragraph(`<span style="font-size:14px;color:${BRAND.muted}">Did not ask for this? Ignore this email and you will not be subscribed.</span>`)}`,
    text: `Confirm your Honic subscription: ${url}\nDid not ask for this? Ignore this email and you will not be subscribed.`,
    footnote: 'You are getting this one email because someone entered this address to subscribe on Honic.',
  })
}

/** Step 2: welcome after confirming (first marketing email, with unsubscribe). */
export async function sendNewsletterWelcomeEmail(userEmail: string, _unsubscribeUrl?: string): Promise<Result> {
  void _unsubscribeUrl
  return deliver({
    to: userEmail,
    category: 'marketing',
    subject: 'You are subscribed to Honic offers',
    preheader: 'Deals, coupons and new arrivals, a few times a month.',
    eyebrow: 'You are subscribed',
    title: 'Karibu! You will hear from us soon.',
    body: `${paragraph('Thanks for subscribing. Here is what to expect:')}
      ${steps([
        { title: 'Offers and coupons', text: 'Codes you can use in your cart.' },
        { title: 'New arrivals', text: 'Machines, tools, electronics and more from the official store and trusted sellers.' },
        { title: 'Not too often', text: 'A few emails a month. Unsubscribe in one click at any time.' },
      ])}
      ${button('Shop now', `${siteUrl()}/products`)}`,
    text: `You are subscribed to Honic offers and news. A few emails a month; unsubscribe at any time.\nShop: ${siteUrl()}/products`,
    fromName: 'Honic Offers',
  })
}

/** A promotional email (offer / ad / news). Sent ONLY to confirmed subscribers; adds one-click unsubscribe. */
export async function sendMarketingEmail(userEmail: string, m: { subject: string; preheader: string; title: string; bodyHtml: string; text: string; ctaLabel?: string; ctaUrl?: string }): Promise<Result> {
  return deliver({
    to: userEmail,
    category: 'marketing',
    subject: m.subject,
    preheader: m.preheader,
    eyebrow: 'Honic offers',
    title: esc(m.title),
    body: `${m.bodyHtml}${m.ctaLabel && m.ctaUrl ? button(m.ctaLabel, m.ctaUrl) : ''}`,
    text: `${m.text}${m.ctaUrl ? `\n${m.ctaUrl}` : ''}`,
    fromName: 'Honic Offers',
  })
}

// ============================================================ team notices

export function getAdminNoticeEmails(): string[] {
  const raw = [...(process.env.ADMIN_EMAILS || '').split(','), process.env.NEXT_PUBLIC_ORDER_EMAIL || '']
  const seen = new Set<string>()
  const emails: string[] = []
  for (const item of raw) {
    const email = item.trim().toLowerCase()
    if (!validateEmail(email) || seen.has(email)) continue
    seen.add(email)
    emails.push(email)
  }
  return emails
}

export async function sendAccountCreatedNotice(input: { userEmail: string; name: string; isSupplier?: boolean }): Promise<{ userSent: boolean }> {
  const userEmail = input.userEmail.trim()
  const name = input.name.trim() || userEmail.split('@')[0]
  const appUrl = siteUrl()
  const kind = input.isSupplier ? 'supplier' : 'customer'
  let userSent = false

  if (validateEmail(userEmail)) {
    try {
      const welcome = input.isSupplier
        ? await sendWelcomeSupplierEmail(userEmail, { name, companyName: name, dashboardUrl: `${appUrl}/supplier/dashboard`, commissionRate: '' })
        : await sendWelcomeUserEmail(userEmail, { name, accountUrl: `${appUrl}/account` })
      userSent = welcome.success
      if (!welcome.success) logger.error('Account welcome email failed:', welcome.error)
    } catch (error) {
      logger.error('Account welcome email failed:', error)
    }
  }

  const admins = getAdminNoticeEmails().filter((email) => email !== userEmail.toLowerCase())
  if (admins.length > 0) {
    try {
      const notice = await sendEmail({
        to: admins,
        subject: `New ${kind} account: ${userEmail}`,
        text: `A new ${kind} account was created.\n\nName: ${name}\nEmail: ${userEmail}`,
        html: `<p>A new ${kind} account was created.</p><p><strong>Name:</strong> ${esc(name)}<br><strong>Email:</strong> ${esc(userEmail)}</p>`,
        from: from('Honic Accounts'),
        replyTo: validateEmail(userEmail) ? userEmail : undefined,
      })
      if (!notice.success) logger.error('Admin account notice failed:', notice.error)
    } catch (error) {
      logger.error('Admin account notice failed:', error)
    }
  }
  return { userSent }
}
