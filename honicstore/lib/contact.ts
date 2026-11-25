/**
 * Store WhatsApp number used by every "Ask on WhatsApp" button.
 * Set NEXT_PUBLIC_WHATSAPP_NUMBER (digits, international format) to change it without a code edit.
 */
export const STORE_WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '255786957939').replace(/\D/g, '')

/** wa.me link to the store, optionally with a prefilled message. */
export const whatsappLink = (text?: string) =>
  `https://wa.me/${STORE_WHATSAPP}${text ? `?text=${encodeURIComponent(text)}` : ''}`

/** Store address (shown in the footer, contact and support pages). */
export const STORE_ADDRESS = process.env.NEXT_PUBLIC_STORE_ADDRESS || '44 Bibi Titi Road, DIT CEIIT Tower, Dar es Salaam'

/** "255786957939" -> "+255 786 957 939" */
export const phoneLabel = (digits: string = STORE_WHATSAPP) =>
  `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`.trim()
