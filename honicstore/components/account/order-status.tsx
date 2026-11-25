/**
 * One place for how order statuses look and read across the account pages.
 * Takes the payment status into account: an unpaid "pending" order is "Awaiting payment".
 */
export type OrderStatusTone = 'neutral' | 'progress' | 'success' | 'danger'

export function orderStatus(status?: string, paymentStatus?: string): { label: string; tone: OrderStatusTone } {
  const paid = paymentStatus === 'paid'
  switch (status) {
    case 'pending': return paid ? { label: 'Being prepared', tone: 'progress' } : { label: 'Awaiting payment', tone: 'neutral' }
    case 'confirmed': return { label: 'Being prepared', tone: 'progress' }
    case 'shipped': return { label: 'On the way', tone: 'progress' }
    case 'ready_for_pickup': return { label: 'Ready for pickup', tone: 'progress' }
    case 'delivered': return { label: 'Delivered', tone: 'success' }
    case 'picked_up': return { label: 'Picked up', tone: 'success' }
    case 'cancelled': return { label: 'Cancelled', tone: 'danger' }
    default: return { label: status ? status.replace(/_/g, ' ') : 'Unknown', tone: 'neutral' }
  }
}

const TONE: Record<OrderStatusTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  progress: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
}

export function OrderStatusChip({ status, paymentStatus }: { status?: string; paymentStatus?: string }) {
  const s = orderStatus(status, paymentStatus)
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[s.tone]}`}>{s.label}</span>
}
