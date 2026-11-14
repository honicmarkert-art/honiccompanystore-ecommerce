import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { getSnippePayment, normalizeOrderReference, tzsAmount, verifySnippeWebhook } from "@/lib/snippe-api"
import { processPaidOrderStockAndCart } from "@/lib/paid-order"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const seenEvents = new Map<string, number>()

function paymentOutcome(eventType: string, reportedStatus: string): { paid: boolean; reason: string } | null {
  const reason =
    reportedStatus === "expired" || eventType === "payment.expired" ? "Payment expired" :
    reportedStatus === "voided" || eventType === "payment.voided" ? "Payment voided" :
    reportedStatus === "cancelled" || reportedStatus === "canceled" || eventType === "payment.cancelled" || eventType === "payment.canceled" ? "Payment cancelled" :
    reportedStatus === "failed" || eventType === "payment.failed" ? "Payment failed" :
    null
  const completed = (eventType === "payment.completed" || reportedStatus === "completed") && !reason
  if (completed) return { paid: true, reason: "" }
  if (reason) return { paid: false, reason }
  return null
}

function rememberEvent(eventId: string): boolean {
  const now = Date.now()
  for (const [key, expires] of seenEvents) {
    if (expires <= now) seenEvents.delete(key)
  }
  if (!eventId || seenEvents.has(eventId)) return false
  seenEvents.set(eventId, now + 10 * 60 * 1000)
  return true
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get("x-webhook-signature") || ""
    const timestamp = request.headers.get("x-webhook-timestamp") || ""
    if (!verifySnippeWebhook(rawBody, signature, timestamp)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
    }

    const event = JSON.parse(rawBody) as { id?: string; type?: string; data?: Record<string, any> }
    const data = event.data || {}
    const eventType = String(event.type || request.headers.get("x-webhook-event") || "").toLowerCase()
    const reportedStatus = String(data.status || "").toLowerCase()
    const outcome = paymentOutcome(eventType, reportedStatus)
    if (!outcome) {
      return NextResponse.json({ success: true, ignored: true })
    }
    if (!rememberEvent(String(event.id || `${data.reference}:${eventType}:${timestamp}`))) {
      return NextResponse.json({ success: true, duplicate: true })
    }

    const claimedReference = normalizeOrderReference(String(data.metadata?.order_reference || data.metadata?.order_id || ""))
    const paymentReference = String(data.reference || "")
    if (!claimedReference || !paymentReference) {
      return NextResponse.json({ error: "Payment could not be matched" }, { status: 400 })
    }

    const verified = await getSnippePayment(paymentReference)
    const paid = outcome.paid
    if (!paid && verified?.status === "completed") {
      return NextResponse.json({ error: "Payment was confirmed as completed" }, { status: 409 })
    }
    if (paid) {
      const verifiedReference = normalizeOrderReference(verified?.orderReference || "")
      if (!verified || verified.status !== "completed" || verified.currency !== "TZS" || verified.amount == null) {
        return NextResponse.json({ error: "Payment was not confirmed by Snippe" }, { status: 401 })
      }
      if (verifiedReference && verifiedReference !== claimedReference) {
        return NextResponse.json({ error: "Payment does not belong to this order" }, { status: 401 })
      }
    }

    const supabase = await import("@/lib/supabase-server").then((mod) => mod.getSupabaseClient())
    if (paid) {
      const { data: reused } = await supabase
        .from("orders")
        .select("id")
        .eq("clickpesa_transaction_id", paymentReference)
        .limit(1)
      if (reused?.length) return NextResponse.json({ success: true, duplicate: true })
    }
    let orderResult = await supabase.from("orders").select("*").eq("reference_id", claimedReference).maybeSingle()
    const order = orderResult.data

    if (!order) {
      const profileResult = await supabase
        .from("profiles")
        .select("id, payment_amount, payment_status, payment_reference_id")
        .eq("payment_reference_id", claimedReference)
        .maybeSingle()
      const profile = profileResult.data
      if (!profile) return NextResponse.json({ error: "Payment was not matched to an order" }, { status: 404 })
      if (profile.payment_status === "paid") return NextResponse.json({ success: true, duplicate: true })
      if (paid && tzsAmount(profile.payment_amount) !== verified?.amount) {
        return NextResponse.json({ error: "Paid amount does not match the plan" }, { status: 400 })
      }
      const { data: updated } = await supabase
        .from("profiles")
        .update({
          payment_status: paid ? "paid" : "failed",
          payment_updated_at: new Date().toISOString(),
          payment_timestamp: paid ? new Date().toISOString() : null,
          payment_failure_reason: paid ? null : outcome.reason,
          clickpesa_transaction_id: paymentReference,
        })
        .eq("id", profile.id)
        .in("payment_status", ["pending", "failed"])
        .select("id")
      if (!updated?.length) return NextResponse.json({ success: true, duplicate: true })
      return NextResponse.json({ success: true })
    }

    if (order.payment_status === "paid" || order.payment_status === "success") {
      return NextResponse.json({ success: true, duplicate: true })
    }
    const orderTotal = tzsAmount(order.total_amount)
    if (paid && (orderTotal == null || verified?.amount !== orderTotal)) {
      logger.error("Snippe amount mismatch", { orderId: order.id })
      return NextResponse.json({ error: "Paid amount does not match the order" }, { status: 400 })
    }

    const { data: claimed, error: claimError } = await supabase
      .from("orders")
      .update({
        payment_status: paid ? "paid" : "failed",
        failure_reason: paid ? null : outcome.reason,
        clickpesa_transaction_id: paymentReference,
        payment_method: "snippe",
        payment_timestamp: paid ? new Date().toISOString() : order.payment_timestamp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .in("payment_status", ["pending", "failed", "reserved"])
      .select("id")
    if (claimError) return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
    if (!claimed?.length) return NextResponse.json({ success: true, duplicate: true })
    if (paid) await processPaidOrderStockAndCart(supabase, order)

    return NextResponse.json({ success: true, payment_status: paid ? "paid" : "failed" })
  } catch (error) {
    logger.error("Snippe webhook error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
