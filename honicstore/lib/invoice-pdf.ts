/**
 * Invoice / order PDF, built on the server with pdf-lib (pure JS, no browser needed).
 *
 * One builder for every place an invoice is downloaded:
 *   - signed-in shoppers:  /api/user/orders/[orderNumber]/invoice
 *   - guests (any device): /api/orders/invoice/[reference]  (the 32-character order reference is the key)
 *   - links in the paid-order email
 *
 * Paid orders get an "INVOICE". Unpaid or cancelled orders get an "ORDER SUMMARY" clearly marked
 * as not paid, so the document never claims a payment that did not happen.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { SupabaseClient } from '@supabase/supabase-js'
import { STORE_ADDRESS, STORE_WHATSAPP, phoneLabel } from '@/lib/contact'
import { RETURN_DAYS } from '@/lib/policies'

export const COMPANY_NAME = 'Honic Company Limited'
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@honiccompanystore.com'
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.honiccompanystore.com').replace(/\/$/, '')

export type InvoiceAddress = { fullName?: string; email?: string; phone?: string; address1?: string; address?: string; streetName?: string; ward?: string; district?: string; city?: string; region?: string; state?: string; country?: string }
export type InvoiceItem = { name: string; variant?: string | null; quantity: number; unitPrice: number; total: number }
export type InvoiceOrder = {
  orderNumber: string
  referenceId: string
  userId: string | null
  createdAt: string
  status: string
  paymentStatus: string
  paymentMethod: string | null
  paymentTimestamp: string | null
  deliveryOption: string | null
  pickupId: string | null
  currency: string
  total: number
  shipping: InvoiceAddress
  billing: InvoiceAddress
  items: InvoiceItem[]
}

/** "abc-123" / "ABC123..." -> lowercase 32-char hex, or null if it can't be a reference */
export function normalizeReference(raw: string): string | null {
  const ref = String(raw || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase()
  return /^[a-f0-9]{32}$/.test(ref) ? ref : null
}

/** Load an order with its items using the service client. Returns null when not found. */
export async function loadInvoiceOrder(supabase: SupabaseClient, by: { orderNumber: string } | { referenceId: string }): Promise<InvoiceOrder | null> {
  let q = supabase
    .from('orders')
    .select('id, user_id, order_number, reference_id, created_at, status, payment_status, payment_method, payment_timestamp, delivery_option, pickup_id, currency, total_amount, shipping_address, billing_address, order_items(product_name, variant_name, quantity, price, total_price)')
  q = 'orderNumber' in by ? q.eq('order_number', by.orderNumber) : q.eq('reference_id', by.referenceId)
  const { data: o, error } = await q.maybeSingle()
  if (error || !o) return null
  const obj = (v: unknown) => (v && typeof v === 'object' ? (v as InvoiceAddress) : {})
  const items = ((o.order_items as Array<Record<string, unknown>>) || []).map((i) => {
    const quantity = Number(i.quantity) || 1
    const unitPrice = Number(i.price) || 0
    return { name: String(i.product_name || 'Item'), variant: (i.variant_name as string) || null, quantity, unitPrice, total: Number(i.total_price) || unitPrice * quantity }
  })
  return {
    orderNumber: String(o.order_number || ''),
    referenceId: String(o.reference_id || ''),
    userId: (o.user_id as string) || null,
    createdAt: String(o.created_at),
    status: String(o.status || 'pending'),
    paymentStatus: String(o.payment_status || 'pending'),
    paymentMethod: (o.payment_method as string) || null,
    paymentTimestamp: (o.payment_timestamp as string) || null,
    deliveryOption: (o.delivery_option as string) || null,
    pickupId: (o.pickup_id as string) || null,
    currency: String(o.currency || 'TZS'),
    total: Number(o.total_amount) || 0,
    shipping: obj(o.shipping_address),
    billing: obj(o.billing_address),
    items,
  }
}

export const invoiceFileName = (o: Pick<InvoiceOrder, 'orderNumber' | 'paymentStatus'>) =>
  `Honic-${o.paymentStatus === 'paid' ? 'invoice' : 'order'}-${o.orderNumber.replace(/[^A-Za-z0-9-]/g, '')}.pdf`

/** standard PDF fonts only cover Latin-1: map common characters, replace the rest */
function safe(text: unknown): string {
  return String(text ?? '')
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/[–—−]/g, '-').replace(/…/g, '...').replace(/[•·]/g, '-')
    .replace(/×/g, 'x').replace(/\s+/g, ' ')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')
    .trim()
}

const money = (n: number, currency = 'TZS') => `${currency === 'TZS' ? 'TSh' : currency} ${Math.round(n).toLocaleString('en-US')}`
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Dar_es_Salaam' }) : '')
const methodLabel = (m?: string | null) => {
  const t = safe(m || 'mobile money').replace(/[_-]+/g, ' ').toLowerCase()
  return t === 'snippe' ? 'Mobile money' : t.charAt(0).toUpperCase() + t.slice(1)
}

const ORANGE = rgb(0.976, 0.451, 0.086) // #f97316
const INK = rgb(0.09, 0.09, 0.09)
const MUTED = rgb(0.42, 0.42, 0.42)
const LINE = rgb(0.9, 0.9, 0.9)
const SOFT = rgb(0.98, 0.976, 0.969)
const GREEN = rgb(0.016, 0.471, 0.341)
const RED = rgb(0.725, 0.11, 0.11)

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = safe(text).split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue }
    if (line) lines.push(line)
    // a single very long word: hard-break it
    let rest = w
    while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
      let cut = rest.length - 1
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--
      lines.push(rest.slice(0, cut)); rest = rest.slice(cut)
    }
    line = rest
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function addressLines(a: InvoiceAddress): string[] {
  const street = [a.address1 || a.address, a.streetName].filter(Boolean).join(', ')
  const area = [...new Set([a.ward, a.district, a.city, a.region || a.state].filter(Boolean))].join(', ')
  return [a.fullName, street, area, a.phone, a.email].map((s) => safe(s)).filter(Boolean)
}

export async function buildInvoicePdf(o: InvoiceOrder): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const paid = o.paymentStatus === 'paid'
  const cancelled = o.status === 'cancelled'
  pdf.setTitle(`${paid ? 'Invoice' : 'Order summary'} ${o.orderNumber}`)
  pdf.setAuthor(COMPANY_NAME)
  pdf.setCreator('Honic Store')
  pdf.setCreationDate(new Date())

  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 595.28, H = 841.89, M = 44
  const pages: PDFPage[] = []
  let page = pdf.addPage([W, H]); pages.push(page)
  let y = H - M

  const text = (s: string, x: number, yy: number, size = 9.5, f: PDFFont = font, color = INK) => page.drawText(safe(s), { x, y: yy, size, font: f, color })
  const right = (s: string, xr: number, yy: number, size = 9.5, f: PDFFont = font, color = INK) => text(s, xr - f.widthOfTextAtSize(safe(s), size), yy, size, f, color)

  // ---------- header ----------
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: ORANGE })
  page.drawRectangle({ x: M, y: y - 34, width: 34, height: 34, color: ORANGE })
  page.drawText('H', { x: M + 9.5, y: y - 26, size: 22, font: bold, color: rgb(1, 1, 1) })
  text('Honic', M + 44, y - 15, 17, bold)
  text('STORE', M + 44, y - 28, 7.5, bold, ORANGE)

  const title = paid ? 'INVOICE' : 'ORDER SUMMARY'
  right(title, W - M, y - 18, 20, bold)
  const pill = cancelled ? 'CANCELLED' : paid ? 'PAID' : 'NOT PAID'
  const pillColor = cancelled ? RED : paid ? GREEN : MUTED
  const pw = bold.widthOfTextAtSize(pill, 8) + 14
  page.drawRectangle({ x: W - M - pw, y: y - 40, width: pw, height: 15, color: pillColor, opacity: 0.12, borderColor: pillColor, borderWidth: 0.6, borderOpacity: 0.5 })
  right(pill, W - M - 7, y - 35.5, 8, bold, pillColor)
  y -= 58

  // company + document facts
  const company = [COMPANY_NAME, STORE_ADDRESS, `${SUPPORT_EMAIL}  ·  WhatsApp ${phoneLabel(STORE_WHATSAPP)}`, SITE.replace(/^https?:\/\//, '')]
  company.forEach((l, i) => text(l, M, y - i * 12.5, i === 0 ? 9.5 : 8.5, i === 0 ? bold : font, i === 0 ? INK : MUTED))
  const facts: [string, string][] = [
    [paid ? 'Invoice no.' : 'Order no.', o.orderNumber],
    ['Order date', day(o.createdAt)],
    ...(paid && o.paymentTimestamp ? [['Paid on', day(o.paymentTimestamp)] as [string, string]] : []),
    ['Payment', methodLabel(o.paymentMethod)],
  ]
  facts.forEach(([k, v], i) => { right(v, W - M, y - i * 12.5, 9, bold); right(k, W - M - 128, y - i * 12.5, 8.5, font, MUTED) })
  y -= Math.max(company.length, facts.length) * 12.5 + 14

  // ---------- addresses ----------
  // no separate billing address: bill to the buyer (name and contacts), the address is under 'deliver to'
  const hasBilling = !!(o.billing && (o.billing.address1 || o.billing.address || o.billing.city))
  const bill = hasBilling ? addressLines({ ...o.shipping, ...o.billing }) : addressLines({ fullName: o.billing?.fullName || o.shipping.fullName, phone: o.billing?.phone || o.shipping.phone, email: o.billing?.email || o.shipping.email })
  const pickup = o.deliveryOption === 'pickup'
  const ship = pickup ? ['Store pickup', o.pickupId ? `Pickup ID: ${o.pickupId}` : '', STORE_ADDRESS].filter(Boolean) : addressLines(o.shipping)
  const colW = (W - 2 * M - 16) / 2
  const boxH = 22 + Math.max(bill.length, ship.length, 1) * 12.5 + 8
  ;[['BILL TO', bill], [pickup ? 'COLLECT FROM' : 'DELIVER TO', ship]].forEach(([label, lines], idx) => {
    const x = M + idx * (colW + 16)
    page.drawRectangle({ x, y: y - boxH, width: colW, height: boxH, color: SOFT, borderColor: LINE, borderWidth: 0.6 })
    text(label as string, x + 12, y - 16, 7.5, bold, ORANGE)
    ;(lines as string[]).forEach((l, i) => text(wrap(l, font, 9, colW - 24)[0], x + 12, y - 30 - i * 12.5, 9, i === 0 ? bold : font, i === 0 ? INK : MUTED))
  })
  y -= boxH + 22

  // ---------- items ----------
  // right edges for the number columns, centre for quantity
  const cols = { n: M + 8, item: M + 30, qty: W - M - 205, unit: W - M - 100, amt: W - M - 8 }
  const itemW = cols.qty - cols.item - 22
  const centre = (s: string, cx: number, yy: number, size: number, f: PDFFont, color = INK) => text(s, cx - f.widthOfTextAtSize(safe(s), size) / 2, yy, size, f, color)
  const tableHeader = () => {
    page.drawRectangle({ x: M, y: y - 22, width: W - 2 * M, height: 22, color: INK })
    const white = rgb(1, 1, 1)
    text('#', cols.n, y - 15, 8, bold, white)
    text('ITEM', cols.item, y - 15, 8, bold, white)
    centre('QTY', cols.qty, y - 15, 8, bold, white)
    right('UNIT PRICE', cols.unit, y - 15, 8, bold, white)
    right('AMOUNT', cols.amt, y - 15, 8, bold, white)
    y -= 22
  }
  const newPage = () => {
    page = pdf.addPage([W, H]); pages.push(page)
    page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: ORANGE })
    y = H - M
    text(`${title} ${o.orderNumber} (continued)`, M, y - 4, 9, bold, MUTED)
    y -= 22
  }
  tableHeader()
  o.items.forEach((it, i) => {
    const nameLines = wrap(it.name, font, 9.5, itemW)
    const varLines = it.variant ? wrap(it.variant, font, 8, itemW) : []
    const rowH = 10 + nameLines.length * 12 + varLines.length * 10.5 + 4
    if (y - rowH < 150) { newPage(); tableHeader() }
    if (i % 2 === 1) page.drawRectangle({ x: M, y: y - rowH, width: W - 2 * M, height: rowH, color: SOFT })
    text(String(i + 1), cols.n, y - 16, 9, font, MUTED)
    nameLines.forEach((l, k) => text(l, cols.item, y - 16 - k * 12, 9.5, k === 0 ? bold : font))
    varLines.forEach((l, k) => text(l, cols.item, y - 16 - nameLines.length * 12 - k * 10.5, 8, font, MUTED))
    centre(String(it.quantity), cols.qty, y - 16, 9.5, font)
    right(money(it.unitPrice, o.currency), cols.unit, y - 16, 9.5, font, MUTED)
    right(money(it.total, o.currency), cols.amt, y - 16, 9.5, bold)
    y -= rowH
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINE })
  })

  // ---------- totals ----------
  if (y < 190) newPage()
  const subtotal = o.items.reduce((s, i) => s + i.total, 0)
  const delivery = Math.max(0, o.total - subtotal)
  y -= 18
  const tx = W - M - 230
  const totalRow = (k: string, v: string, strong = false) => {
    text(k, tx, y, strong ? 11 : 9.5, strong ? bold : font, strong ? INK : MUTED)
    right(v, W - M, y, strong ? 12 : 9.5, bold, strong ? INK : INK)
    y -= strong ? 20 : 16
  }
  totalRow('Items', money(subtotal, o.currency))
  totalRow(pickup ? 'Pickup' : 'Delivery', delivery > 0 ? money(delivery, o.currency) : 'Free')
  page.drawLine({ start: { x: tx, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.8, color: INK })
  y -= 4
  page.drawRectangle({ x: tx - 10, y: y - 8, width: W - M - tx + 10, height: 26, color: ORANGE, opacity: 0.1 })
  totalRow(paid ? 'Total paid' : 'Total', money(o.total, o.currency), true)
  y -= 16

  // ---------- note ----------
  const note = cancelled
    ? 'This order was cancelled. If you were charged, the refund goes back to the same payment method.'
    : paid
      ? `Thank you for shopping with Honic. Wrong or faulty item? You can ask for a return within ${RETURN_DAYS} days of delivery.`
      : 'This order has not been paid. It is a summary only and not a receipt.'
  const noteLines = wrap(note, font, 9, W - 2 * M - 24)
  const noteH = 14 + noteLines.length * 12
  if (y - noteH < 70) newPage()
  page.drawRectangle({ x: M, y: y - noteH, width: W - 2 * M, height: noteH, color: cancelled ? rgb(1, 0.95, 0.95) : paid ? rgb(0.94, 0.99, 0.96) : SOFT })
  noteLines.forEach((l, i) => text(l, M + 12, y - 16 - i * 12, 9, font, cancelled ? RED : paid ? GREEN : MUTED))

  // ---------- footer on every page ----------
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 52 }, end: { x: W - M, y: 52 }, thickness: 0.5, color: LINE })
    p.drawText(safe(`${COMPANY_NAME}  ·  ${SITE.replace(/^https?:\/\//, '')}  ·  Order reference ${o.referenceId}`), { x: M, y: 38, size: 7.5, font, color: MUTED })
    const pg = `Page ${i + 1} of ${pages.length}`
    p.drawText(pg, { x: W - M - font.widthOfTextAtSize(pg, 7.5), y: 38, size: 7.5, font, color: MUTED })
  })

  return pdf.save()
}

/** Response helper: PDF bytes as a download (or inline when asked). */
export function pdfResponse(bytes: Uint8Array, filename: string, inline = false): Response {
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
