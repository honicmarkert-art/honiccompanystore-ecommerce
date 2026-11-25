import { NextRequest, NextResponse } from "next/server"
import { sendPaidOrderEmails } from "@/lib/customer-emails"
import { logger } from "@/lib/logger"
import { getSupabaseClient } from "@/lib/supabase-server"
import { logSecurityEvent } from "@/lib/enhanced-rate-limit"
import { clientIp } from "@/lib/client-ip"
import { createSnippeMobilePayment, getSnippePayment, isSnippeConfigured, normalizeOrderReference, resendSnippePush, snippePhoneDigits, tzsAmount } from "@/lib/snippe-api"
import { processPaidOrderStockAndCart } from "@/lib/paid-order"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const actionLimits = new Map<string, { count: number; reset: number; blockedUntil?: number }>()

function allowPaymentAction(request: NextRequest, kind: "push" | "status"): { allowed: boolean; retryAfter?: number } {
  const ip = clientIp(request) || "unknown"
  const key = `${kind}:${ip}`
  const now = Date.now()
  const windowMs = kind === "push" ? 2 * 60 * 1000 : 60 * 1000
  const max = kind === "push" ? 8 : 40
  const blockMs = kind === "push" ? 60 * 1000 : 0
  const entry = actionLimits.get(key)
  if (entry?.blockedUntil && entry.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) }
  }
  if (!entry || entry.reset <= now) {
    actionLimits.set(key, { count: 1, reset: now + windowMs })
    return { allowed: true }
  }
  entry.count += 1
  if (entry.count > max) {
    if (blockMs) entry.blockedUntil = now + blockMs
    return { allowed: false, retryAfter: Math.ceil((blockMs || windowMs) / 1000) }
  }
  return { allowed: true }
}

function siteBaseUrl(): string | null {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "development" ? `http://localhost:${process.env.LOCALHOST_PORT || "3000"}` : null)
  )
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = allowPaymentAction(request, "push")
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many payment requests. Wait a minute and try again." },
        { status: 429, headers: { "Retry-After": rateLimitResult.retryAfter?.toString() || "60" } }
      )
    }

    if (!isSnippeConfigured()) {
      return NextResponse.json({ success: false, error: "Payment gateway is not configured. Add SNIPPE_API_KEY on the server." }, { status: 500 })
    }

    const body = await request.json().catch(() => null)
    const amount = body?.amount
    const orderId = String(body?.orderId || "").trim()
    const customerDetails = body?.customerDetails || {}
    if (!amount || !orderId || !customerDetails) {
      return NextResponse.json({ success: false, error: "Amount, order, and customer details are required" }, { status: 400 })
    }

    const numAmount = tzsAmount(amount)
    if (numAmount == null) {
      return NextResponse.json({ success: false, error: "Amount must be a whole number of at least 500 TZS" }, { status: 400 })
    }

    const baseUrl = siteBaseUrl()
    if (!baseUrl) {
      return NextResponse.json({ success: false, error: "Site URL is not configured" }, { status: 500 })
    }

    const normalizedOrderRef = normalizeOrderReference(orderId)
    const adminSupabase = getSupabaseClient()
    const { data: orders, error: orderError } = await adminSupabase
      .from("orders")
      .select("id, reference_id, status, total_amount, currency, payment_status, shipping_address, billing_address, clickpesa_transaction_id")
      .in("reference_id", [normalizedOrderRef, orderId])

    const order =
      orders?.find((row: { reference_id?: string }) => row.reference_id === normalizedOrderRef) ||
      orders?.find((row: { reference_id?: string }) => row.reference_id === orderId)

    if (!order) {
      logSecurityEvent("ORDER_NOT_FOUND", { endpoint: "/api/payment/snippe", orderId, error: orderError?.message }, request)
      return NextResponse.json({ success: false, error: "Order not found. Please create an order first." }, { status: 404 })
    }

    const orderTotal = tzsAmount(order.total_amount)
    if (orderTotal == null || numAmount !== orderTotal) {
      logSecurityEvent("AMOUNT_MISMATCH", { endpoint: "/api/payment/snippe", orderId: order.id, orderTotal, providedAmount: numAmount }, request)
      return NextResponse.json({ success: false, error: "Payment amount does not match the order total." }, { status: 400 })
    }
    if (order.payment_status === "paid" || order.payment_status === "success") {
      return NextResponse.json({ success: false, error: "This order has already been paid." }, { status: 400 })
    }
    if (order.status === "cancelled") {
      // expired or cancelled orders must never take a payment
      return NextResponse.json({ success: false, error: "This order has expired. Please place a new order from your cart." }, { status: 400 })
    }
    if (String(order.currency || "TZS").toUpperCase() !== "TZS") {
      return NextResponse.json({ success: false, error: "Snippe accepts Tanzanian shillings only." }, { status: 400 })
    }

    const webhookUrl = new URL("/api/webhooks/snippe", baseUrl)
    const localWebhook = webhookUrl.hostname === "localhost" || webhookUrl.hostname === "127.0.0.1"
    if (webhookUrl.protocol !== "https:" && !localWebhook) {
      return NextResponse.json({ success: false, error: "The payment callback must use HTTPS." }, { status: 500 })
    }

    const savedAddress = order.billing_address?.phone ? order.billing_address : order.shipping_address || {}
    const phone = snippePhoneDigits(String(savedAddress.phone || customerDetails.phone || ""))
    const email = String(savedAddress.email || customerDetails.email || "").trim()
    if (!phone) {
      return NextResponse.json({ success: false, error: "Enter the mobile money number that should receive the payment request." }, { status: 400 })
    }
    if (!email) {
      return NextResponse.json({ success: false, error: "An email address is required before payment." }, { status: 400 })
    }

    if (order.clickpesa_transaction_id && (order.payment_status === "pending" || order.payment_status === "reserved")) {
      await resendSnippePush(String(order.clickpesa_transaction_id))
      return NextResponse.json({
        success: true,
        orderReference: order.reference_id,
        paymentReference: order.clickpesa_transaction_id,
        status: "pending",
        amount: String(orderTotal),
        currency: "TZS",
      })
    }

    const fullName = String(savedAddress.fullName || customerDetails.fullName || `${customerDetails.firstName || ""} ${customerDetails.lastName || ""}`).trim() || "Customer"
    const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean)
    const payment = await createSnippeMobilePayment({
      amount: orderTotal,
      orderReference: String(order.reference_id),
      phone,
      firstName: firstName || "Customer",
      lastName: rest.join(" ") || "Customer",
      email,
      webhookUrl: webhookUrl.toString(),
      idempotencySeed: `${order.reference_id}:${order.clickpesa_transaction_id || "first"}`,
    })

    await adminSupabase
      .from("orders")
      .update({
        clickpesa_transaction_id: payment.reference,
        payment_method: "snippe",
        payment_status: "pending",
        failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .in("payment_status", ["pending", "failed", "reserved"])

    return NextResponse.json({
      success: true,
      orderReference: order.reference_id,
      paymentReference: payment.reference,
      status: payment.status || "pending",
      amount: String(orderTotal),
      currency: "TZS",
    })
  } catch (error) {
    logger.error("Snippe checkout error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ success: false, error: "Unable to send the payment request. Please try again." }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = allowPaymentAction(request, "status")
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ success: true, paymentStatus: "pending" }, { headers: { "Cache-Control": "no-store" } })
    }
    const orderReference = normalizeOrderReference(request.nextUrl.searchParams.get("orderReference") || "")
    if (!orderReference) {
      return NextResponse.json({ success: false, error: "Order reference is required" }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data: order } = await supabase
      .from("orders")
      .select("id, reference_id, total_amount, payment_status, failure_reason, clickpesa_transaction_id")
      .eq("reference_id", orderReference)
      .maybeSingle()
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404, headers: { "Cache-Control": "no-store" } })
    if (order.payment_status === "paid" || order.payment_status === "success") {
      return NextResponse.json({ success: true, paymentStatus: "paid" }, { headers: { "Cache-Control": "no-store" } })
    }

    const verified = order.clickpesa_transaction_id ? await getSnippePayment(String(order.clickpesa_transaction_id)) : null
    const verifiedReference = normalizeOrderReference(verified?.orderReference || "")
    const orderTotal = tzsAmount(order.total_amount)
    const confirmed = verified?.status === "completed" && verified.currency === "TZS" && verified.amount != null && verified.amount === orderTotal && (!verifiedReference || verifiedReference === orderReference)
    if (confirmed) {
      const { data: claimed } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          payment_method: "snippe",
          failure_reason: null,
          payment_timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .in("payment_status", ["pending", "failed", "reserved"])
        .select("id")
      if (claimed?.length) {
        try {
          await processPaidOrderStockAndCart(supabase, order)
        } catch (stockError) {
          logger.error("Paid order stock update failed:", stockError instanceof Error ? stockError.message : String(stockError))
        }
        // this check often confirms the payment before the webhook does: send the receipt here too
        // (only the request that flips the order to paid gets here, so it is sent once)
        void sendPaidOrderEmails(supabase, order)
      }
      return NextResponse.json({ success: true, paymentStatus: "paid" }, { headers: { "Cache-Control": "no-store" } })
    }

    const rejected = verified?.status === "failed" || verified?.status === "expired" || verified?.status === "voided" || verified?.status === "cancelled"
    if (rejected) {
      const fallback = verified?.status === "expired" ? "Payment expired" : verified?.status === "voided" ? "Payment voided" : verified?.status === "cancelled" ? "Payment cancelled" : "Payment failed"
      // Keep the network's own reason (e.g. insufficient balance) so the shopper knows what to fix.
      const reason = verified?.failureReason || fallback
      await supabase
        .from("orders")
        .update({ payment_status: "failed", failure_reason: reason, payment_method: "snippe", updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .in("payment_status", ["pending", "reserved"])
      return NextResponse.json({ success: true, paymentStatus: "failed", failureReason: reason, provider: verified?.provider || undefined }, { headers: { "Cache-Control": "no-store" } })
    }

    return NextResponse.json({
      success: true,
      paymentStatus: order.payment_status === "failed" ? "failed" : "pending",
      failureReason: order.failure_reason || undefined,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    logger.error("Snippe status error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ success: false, error: "Unable to check the payment." }, { status: 500 })
  }
}
