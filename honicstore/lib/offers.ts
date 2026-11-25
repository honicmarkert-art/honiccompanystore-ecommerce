/**
 * "Make an offer" (bargaining) helpers, shared by the product page, the offers API and the team page.
 *
 * Flow: shopper sends an offer (saved + opens WhatsApp with a ready message) -> team accepts or
 * counters on /team/offers -> a ONE-TIME coupon for that product and quantity is created -> team
 * sends the code on WhatsApp -> shopper pays the agreed price through normal checkout.
 */
import { randomBytes } from 'crypto'

export const OFFER_COUPON_PREFIX = 'OFR-'
export const OFFER_COUPON_HOURS = 48

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L: easy to read out on the phone
export function newCode(prefix = OFFER_COUPON_PREFIX, len = 6) {
  const bytes = randomBytes(len)
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length]
  return prefix + s
}

export const tsh = (n: number) => `TSh ${Math.round(Number(n) || 0).toLocaleString('en-US')}`

/** Message the SHOPPER sends to the store (Swahili first, then English). */
export function offerMessage(o: { ref?: string | null; productName: string; productUrl: string; quantity: number; listPrice: number; offerPrice: number; region?: string; name?: string; note?: string }) {
  const lines = [
    `Habari Honic, naomba punguzo 🙏`,
    `Hello Honic, I would like a better price.`,
    ``,
    `🛒 ${o.productName}`,
    `Idadi / Qty: ${o.quantity}`,
    `Bei ya sasa / Price: ${tsh(o.listPrice)} each`,
    `Ofa yangu / My offer: ${tsh(o.offerPrice)} each (${tsh(o.offerPrice * o.quantity)} total)`,
    o.region ? `Mkoa / Region: ${o.region}` : '',
    o.note ? `Maelezo / Note: ${o.note}` : '',
    o.name ? `Jina / Name: ${o.name}` : '',
    ``,
    o.productUrl,
    o.ref ? `Ref: ${o.ref}` : '',
  ]
  return lines.filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i < a.length - 1)).join('\n').trim()
}

/** Reply the TEAM sends back with the code. */
export function offerReply(o: { name?: string | null; productName: string; productUrl: string; quantity: number; agreedPrice: number; code: string; counter: boolean }) {
  const hi = o.name ? `Habari ${o.name.split(/\s+/)[0]}` : 'Habari'
  return [
    `${hi} 👋`,
    o.counter
      ? `Bei nzuri tunayoweza: ${tsh(o.agreedPrice)} kwa kila moja. / Our best price: ${tsh(o.agreedPrice)} each.`
      : `Ofa yako imekubaliwa! / Your offer is accepted: ${tsh(o.agreedPrice)} each.`,
    ``,
    `🛒 ${o.productName} × ${o.quantity}`,
    `Kodi / Code: *${o.code}*`,
    ``,
    `Weka bidhaa kwenye kikapu (idadi ${o.quantity}), weka kodi hii kwenye kikapu, kisha lipa kwa mobile money.`,
    `Add it to your cart (qty ${o.quantity}), enter this code in the cart, then pay with mobile money.`,
    `Inafanya kazi mara moja ndani ya saa ${OFFER_COUPON_HOURS}. / Valid once, for ${OFFER_COUPON_HOURS} hours.`,
    ``,
    o.productUrl,
  ].join('\n')
}

/** Tanzanian phone to 255XXXXXXXXX (or null). */
export function tzPhone(raw: string): string | null {
  const d = String(raw || '').replace(/\D/g, '')
  const local = d.startsWith('255') ? d.slice(3) : d.startsWith('0') ? d.slice(1) : d
  return /^[67]\d{8}$/.test(local) ? `255${local}` : null
}
