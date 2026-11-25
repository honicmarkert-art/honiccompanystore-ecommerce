import crypto from "crypto"

const SNIPPE_API_URL = (process.env.SNIPPE_API_URL || "https://api.snippe.sh").replace(/\/$/, "")

export function isSnippeConfigured(): boolean {
  return Boolean(process.env.SNIPPE_API_KEY?.trim())
}

export function normalizeOrderReference(value: string): string {
  return String(value || "").replace(/[^A-Za-z0-9]/g, "")
}

export function formatPhoneForSnippe(phone: string): string {
  const digits = snippePhoneDigits(phone)
  return digits ? `+${digits}` : ""
}

export function snippePhoneDigits(phone: string): string | null {
  const digits = String(phone || "").replace(/\D/g, "")
  const local = digits.startsWith("255") ? digits : digits.startsWith("0") ? `255${digits.slice(1)}` : digits.length === 9 ? `255${digits}` : digits
  return /^255[67]\d{8}$/.test(local) ? local : null
}

function authHeaders(idempotencyKey?: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.SNIPPE_API_KEY}`,
    "Content-Type": "application/json",
  }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 30)
  return headers
}

export function tzsAmount(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""))
  if (!Number.isFinite(amount) || amount < 500) return null
  const whole = Math.round(amount)
  if (Math.abs(amount - whole) > 0.001) return null
  return whole
}

export function isAllowedReturnUrl(candidate: string, baseUrl: string): boolean {
  try {
    const target = new URL(candidate)
    const base = new URL(baseUrl)
    const local = base.hostname === "localhost" || base.hostname === "127.0.0.1"
    if (target.origin !== base.origin) return false
    if (target.protocol !== "https:" && !local) return false
    return true
  } catch {
    return false
  }
}

export function isSnippeCheckoutUrl(candidate: string): boolean {
  try {
    const target = new URL(candidate)
    const host = target.hostname.toLowerCase()
    return target.protocol === "https:" && (host === "snippe.me" || host === "snippe.sh" || host.endsWith(".snippe.sh"))
  } catch {
    return false
  }
}

export async function createSnippeCheckout(input: {
  amount: number
  orderReference: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  redirectUrl: string
  webhookUrl: string
  description: string
}): Promise<{ checkoutLink: string; reference: string }> {
  if (!isSnippeConfigured()) throw new Error("Snippe is not configured")
  const amount = tzsAmount(input.amount)
  if (amount == null) throw new Error("Snippe payments must be a whole amount of at least 500 TZS")

  const phone = input.customerPhone ? formatPhoneForSnippe(input.customerPhone) : undefined
  const idempotencyKey = crypto.createHash("sha256").update(`${input.orderReference}:${amount}`).digest("hex").slice(0, 30)
  const response = await fetch(`${SNIPPE_API_URL}/api/v1/sessions`, {
    method: "POST",
    headers: authHeaders(idempotencyKey),
    body: JSON.stringify({
      amount,
      currency: "TZS",
      allowed_methods: ["mobile_money", "card"],
      customer: {
        name: input.customerName || "Customer",
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
        ...(phone ? { phone } : {}),
      },
      redirect_url: input.redirectUrl,
      webhook_url: input.webhookUrl,
      description: input.description.slice(0, 500),
      metadata: { order_reference: input.orderReference },
      expires_in: 3600,
    }),
    signal: AbortSignal.timeout(20000),
  })
  const body = await response.json().catch(() => null)
  const checkoutLink = String(body?.data?.checkout_url || body?.data?.payment_link_url || "")
  const returnedAmount = tzsAmount(body?.data?.amount)
  if (!response.ok || !isSnippeCheckoutUrl(checkoutLink) || (body?.data?.amount != null && returnedAmount !== amount)) {
    throw new Error("Snippe did not return a valid checkout link")
  }
  return { checkoutLink, reference: String(body?.data?.reference || "") }
}

export async function createSnippeMobilePayment(input: {
  amount: number
  orderReference: string
  phone: string
  firstName: string
  lastName: string
  email: string
  webhookUrl: string
  idempotencySeed: string
}): Promise<{ reference: string; status: string }> {
  if (!isSnippeConfigured()) throw new Error("Snippe is not configured")
  const amount = tzsAmount(input.amount)
  const phone = snippePhoneDigits(input.phone)
  if (amount == null || !phone) throw new Error("A valid Tanzanian mobile number and amount are required")
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("A customer email is required")

  const idempotencyKey = crypto.createHash("sha256").update(`${input.idempotencySeed}:${amount}:${phone}`).digest("hex").slice(0, 30)
  const response = await fetch(`${SNIPPE_API_URL}/v1/payments`, {
    method: "POST",
    headers: authHeaders(idempotencyKey),
    body: JSON.stringify({
      payment_type: "mobile",
      details: { amount, currency: "TZS" },
      phone_number: phone,
      customer: {
        firstname: input.firstName.slice(0, 60) || "Customer",
        lastname: input.lastName.slice(0, 60) || "Customer",
        email: input.email.slice(0, 120),
      },
      webhook_url: input.webhookUrl,
      metadata: { order_reference: input.orderReference },
    }),
    signal: AbortSignal.timeout(20000),
  })
  const body = await response.json().catch(() => null)
  const reference = String(body?.data?.reference || "")
  const status = String(body?.data?.status || "").toLowerCase()
  const returnedAmount = tzsAmount(body?.data?.amount?.value ?? body?.data?.amount)
  if (!response.ok || !/^[A-Za-z0-9_-]{6,80}$/.test(reference) || (body?.data?.amount != null && returnedAmount !== amount)) {
    throw new Error("Snippe did not send the payment request")
  }
  return { reference, status: status || "pending" }
}

export async function resendSnippePush(reference: string): Promise<void> {
  if (!isSnippeConfigured() || !/^[A-Za-z0-9_-]{6,80}$/.test(reference)) return
  await fetch(`${SNIPPE_API_URL}/v1/payments/${encodeURIComponent(reference)}/push`, {
    method: "POST",
    headers: authHeaders(),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null)
}

export type SnippePaymentRecord = {
  status: string
  amount: number | null
  currency: string
  orderReference: string
  /** Reason given by the network, e.g. "Insufficient balance on customer's account." */
  failureReason: string
  /** Network Snippe detected from the number, e.g. "halopesa", "mpesa", "airtel", "tigo". */
  provider: string
}

export async function getSnippePayment(reference: string): Promise<SnippePaymentRecord | null> {
  if (!isSnippeConfigured() || !reference || !/^[A-Za-z0-9_-]{6,80}$/.test(reference)) return null
  const response = await fetch(`${SNIPPE_API_URL}/v1/payments/${encodeURIComponent(reference)}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) return null
  const body = await response.json().catch(() => null)
  const data = body?.data
  if (!data) return null
  const rawAmount = data.amount?.value ?? data.amount
  return {
    status: String(data.status || "").toLowerCase(),
    amount: tzsAmount(rawAmount),
    currency: String(data.amount?.currency || data.currency || "TZS").toUpperCase(),
    orderReference: String(data.metadata?.order_reference || data.metadata?.order_id || ""),
    failureReason: String(data.failure_reason || "").replace(/[<>]/g, "").slice(0, 200),
    provider: String(data.channel?.provider || "").toLowerCase(),
  }
}

export function verifySnippeWebhook(rawBody: string, signature: string, timestamp: string): boolean {
  const secret = process.env.SNIPPE_WEBHOOK_SECRET?.trim()
  if (!secret || !signature || !timestamp) return false
  const sentAt = Number(timestamp)
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > 5 * 60) return false
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")
  const received = signature.trim().replace(/^sha256=/i, "").toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(received)) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}
