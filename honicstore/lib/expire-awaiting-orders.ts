export const AWAITING_CONFIRMATION_MINUTES = 15
export const EXPIRED_ORDER_REASON = "Expired. Not confirmed within 15 minutes."

export async function expireAwaitingConfirmationOrders(supabase: {
  from: (table: string) => any
}): Promise<number> {
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
    .select("id")

  if (error) return 0
  return Array.isArray(data) ? data.length : 0
}
