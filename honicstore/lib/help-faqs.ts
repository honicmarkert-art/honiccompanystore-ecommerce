/**
 * Help centre questions & answers. Every answer describes what the store really does today;
 * numbers come from lib/policies.ts and the delivery settings, so they can't drift.
 */
import { DAR_DELIVERY_ATTEMPTS, REFUND_BUSINESS_DAYS, RETURN_DAYS, UNPAID_ORDER_EXPIRY_MINUTES } from '@/lib/policies'
import { freeDeliveryThreshold } from '@/lib/shipping-pricing'

export type FaqCategory = 'orders' | 'delivery' | 'payments' | 'returns' | 'account' | 'technical'
export type Faq = { id: string; category: FaqCategory; question: string; answer: string; popular?: boolean; link?: { href: string; label: string } }

export const FAQ_CATEGORIES: { id: FaqCategory; name: string }[] = [
  { id: 'orders', name: 'Orders' },
  { id: 'delivery', name: 'Delivery' },
  { id: 'payments', name: 'Payments' },
  { id: 'returns', name: 'Returns & refunds' },
  { id: 'account', name: 'Account' },
  { id: 'technical', name: 'Website help' },
]

const tsh = (n: number) => `TSh ${n.toLocaleString('en-US')}`

export function getFaqs(): Faq[] {
  const free = freeDeliveryThreshold()
  return [
    // orders
    { id: 'track', category: 'orders', popular: true, question: 'How can I track my order?', answer: 'Use the order tracking page with your order number and the phone number or email you used at checkout. If you have an account, all your orders are also under "My orders".', link: { href: '/support/order-tracking', label: 'Track an order' } },
    { id: 'cancel', category: 'orders', popular: true, question: 'Can I change or cancel my order?', answer: `Unpaid orders cancel themselves after ${UNPAID_ORDER_EXPIRY_MINUTES} minutes. If you have paid and the order has not been sent yet, message us on WhatsApp and we will change or cancel it and refund you in full. Once it has been sent, you can return it instead.` },
    { id: 'guest', category: 'orders', question: 'Do I need an account to order?', answer: 'No. You can check out as a guest. An account lets you see all your orders in one place, save items and check out faster.' },
    { id: 'bulk', category: 'orders', question: 'Can I get a price for a large order?', answer: 'Yes. Use "Get a quote" on the marketplace page, or message us on WhatsApp with the items and quantities, and we will send you a price.' },
    { id: 'invoice', category: 'orders', question: 'How do I get an invoice?', answer: 'Open the order under "My orders" in your account and choose "Download invoice". For a guest order, message us with your order number.' },

    // delivery
    { id: 'cost', category: 'delivery', popular: true, question: 'How much is delivery?', answer: `It depends on your address and is shown at checkout before you pay: by bodaboda in Dar es Salaam, by bus or courier to other regions. It is free when your items add up to ${tsh(free)} or more, and store pickup is always free.`, link: { href: '/support/shipping-info', label: 'See all delivery prices' } },
    { id: 'time', category: 'delivery', question: 'How long does delivery take?', answer: 'Usually 1–2 days in Dar es Salaam and 2–6 days to other regions, depending on distance. Checkout shows the time for your address.' },
    { id: 'missed', category: 'delivery', question: 'What if I miss the delivery?', answer: `In Dar es Salaam our rider calls you before coming. If we can't reach you we try again the next working day; after ${DAR_DELIVERY_ATTEMPTS} tries the order waits at our store for pickup, or we can send it again for a new delivery fee. Outside Dar es Salaam, collect your parcel quickly from the bus or courier office, as they may charge for storage.` },
    { id: 'abroad', category: 'delivery', question: 'Do you deliver outside Tanzania?', answer: 'Not through checkout. For an order to another country, message us on WhatsApp and we will tell you if we can arrange it and what it costs.' },

    // payments
    { id: 'methods', category: 'payments', popular: true, question: 'How can I pay?', answer: 'With mobile money: M-Pesa, Airtel Money, Mixx by Yas or HaloPesa. You approve the payment on your phone at checkout. Card payments are not available yet.' },
    { id: 'safe', category: 'payments', question: 'Is paying safe?', answer: 'Yes. Payments go through our licensed mobile money partner and you confirm each one with your own PIN on your phone. We never see or store your PIN.' },
    { id: 'failed', category: 'payments', question: 'My payment failed or the money left but the order shows unpaid', answer: 'Check that your phone is on and has enough balance, then try again and approve the prompt quickly. If money left your account but the order still shows unpaid, do not pay again: message us on WhatsApp with your order number and we will sort it out.' },
    { id: 'currency', category: 'payments', question: 'Which currency are prices in?', answer: 'All prices are in Tanzanian shillings (TSh).' },

    // returns
    { id: 'policy', category: 'returns', popular: true, question: 'What is your return policy?', answer: `Wrong, damaged or faulty item: tell us within ${RETURN_DAYS} days and we replace it or refund you in full. Changed your mind: within ${RETURN_DAYS} days if the item is unused and unopened. Parts that have been soldered, wired or powered can't be returned for a change of mind.`, link: { href: '/support/returns-refunds', label: 'Returns & refunds' } },
    { id: 'how-return', category: 'returns', question: 'How do I return an item?', answer: 'Message us on WhatsApp or email with your order number, what is wrong, and a photo. We tell you how to send it back: drop it at our store, give it to our rider in Dar es Salaam, or send it by bus/courier from your town.' },
    { id: 'refund-time', category: 'returns', question: 'How long do refunds take?', answer: `We send refunds to the same mobile money number you paid with, within ${REFUND_BUSINESS_DAYS} business days after we receive and check the item (or approve your cancellation).` },
    { id: 'refund-amount', category: 'returns', question: 'How much will I get back?', answer: 'Wrong, damaged or faulty item: everything you paid, including delivery. Changed your mind: the item price (delivery is not refunded, and you pay the transport to send it back).' },

    // account
    { id: 'signup', category: 'account', question: 'How do I create an account?', answer: 'Choose "Sign in" at the top of the page, then "Create account". Fill in your details and confirm your email, or continue with Google.' },
    { id: 'password', category: 'account', question: 'I forgot my password', answer: 'On the sign-in page choose "Forgot password", enter your email, and follow the link we send you. Check your spam folder if it doesn\'t arrive within a few minutes.', link: { href: '/auth/forgot-password', label: 'Reset password' } },
    { id: 'profile', category: 'account', question: 'How do I update my details?', answer: 'Sign in and open "My account" to change your name, phone number and profile photo.' },
    { id: 'email-change', category: 'account', question: 'Can I change my email address?', answer: 'Not from the website yet. Message us from your current email address and we will change it for you.' },
    { id: 'delete', category: 'account', question: 'How do I delete my account?', answer: 'Message us from the email address on your account and we will delete it and your personal data. Records we must keep by law, such as invoices, are kept only as long as required.' },

    // technical
    { id: 'loading', category: 'technical', popular: true, question: 'The website is not loading properly', answer: 'Refresh the page, check your connection, or open the site in a private window. Ad blockers and old browsers can break pages; try Chrome, Safari or Firefox.', link: { href: '/support/technical-support', label: 'More quick fixes' } },
    { id: 'app', category: 'technical', question: 'Do you have a mobile app?', answer: 'Not yet. The website works well in your phone browser; add it to your home screen from the browser menu for one-tap access.' },
    { id: 'emails', category: 'technical', question: 'I\'m not receiving your emails', answer: 'Check your spam or promotions folder and add our address to your contacts. Make sure the email in your account is correct.' },
    { id: 'search', category: 'technical', question: 'I can\'t find a product', answer: 'Try a shorter name, search by photo, or switch to AI mode and describe what you need in English or Swahili. Still nothing? Use "Get a quote" and we will try to source it.' },
  ]
}
