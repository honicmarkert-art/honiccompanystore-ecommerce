import type { SupabaseClient } from "@supabase/supabase-js"
import { sendExpiredOrderEmails } from "@/lib/customer-emails"

import { UNPAID_ORDER_EXPIRY_MINUTES } from "@/lib/policies"

export const AWAITING_CONFIRMATION_MINUTES = UNPAID_ORDER_EXPIRY_MINUTES
export const EXPIRED_ORDER_REASON = `Expired. Not confirmed within ${UNPAID_ORDER_EXPIRY_MINUTES} minutes.`

type ExpiredOrder = {
  id: string
  order_number?: string
  user_id?: string | null
  total_amount?: number | string | null
  payment_status?: string | null
  shipping_address?: unknown
  billing_address?: unknown
}

export async function expireAwaitingConfirmationOrders(supabase: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - AWAITING_CONFIRMATION_MINUTES * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      failure_reason: EXPIRED_ORDER_REASON,
      updated_at: new Date().toISOString(),
    })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id, order_number, user_id, total_amount, payment_status, shipping_address, billing_address")

  if (error || !Array.isArray(data)) return 0
  void sendExpiredOrderEmails(supabase, data as ExpiredOrder[])
  return data.length
}
