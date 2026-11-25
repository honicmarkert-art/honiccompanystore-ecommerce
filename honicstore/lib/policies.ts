/**
 * Store policies in one place: returns, refunds, cancellation and missed deliveries.
 * The returns page, help centre, terms and delivery page all read these numbers.
 *
 * Built on what the store really does today: refunds are sent by hand to the customer's
 * mobile money number, returns are arranged on WhatsApp/email, unpaid orders expire automatically,
 * Dar es Salaam deliveries go by bodaboda and upcountry parcels by bus/courier to the customer's town.
 */

/** Days after delivery/pickup to report a problem or return an item */
export const RETURN_DAYS = 7

/** Business days to send a refund after we receive and check the item (or approve the cancellation) */
export const REFUND_BUSINESS_DAYS = 5

/** Unpaid orders cancel themselves after this many minutes (lib/expire-awaiting-orders.ts) */
export const UNPAID_ORDER_EXPIRY_MINUTES = 15

/** Dar es Salaam: delivery attempts before the order waits at our store for pickup */
export const DAR_DELIVERY_ATTEMPTS = 2

/** Change-of-mind returns are not possible for these (faulty/wrong items are always covered) */
export const NON_RETURNABLE = [
  'Electronic parts that have been soldered, wired, powered on or cut',
  'Opened 3D printer filament, resin and other consumables',
  'Items damaged by wrong wiring, wrong voltage or misuse',
  'Software, licences and digital products',
]

/** Mobile money (Snippe) cannot take a payment under this amount, in TZS. */
export const MIN_PAYMENT_TZS = 500

/**
 * Orders that would cost less than MIN_PAYMENT_TZS are topped up to it, so the payment can go
 * through. Shown to the shopper as its own line ("Mobile money minimum"). Same rule on the
 * checkout page and in the orders API (which stores the final total).
 */
export const paymentTopUp = (total: number) => (total > 0 && total < MIN_PAYMENT_TZS ? Math.round(MIN_PAYMENT_TZS - total) : 0)

/** Label for that line everywhere it is shown (checkout, order pages, invoice, email). */
export const TOP_UP_LABEL = 'Mobile money minimum'
