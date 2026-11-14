export type LocalOrderItem = {
  name: string
  quantity: number
  total: number
}

export type LocalOrder = {
  referenceId: string
  status: string
  total: number
  currency: string
  createdAt: string
  customerName: string
  phone: string
  email: string
  items: LocalOrderItem[]
}

const STORAGE_KEY = "honic-local-orders"
const PENDING_KEY = "honic-pending-order"

function readList(raw: string | null): LocalOrder[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((order) => order && typeof order.referenceId === "string")
  } catch {
    return []
  }
}

export function readLocalOrders(): LocalOrder[] {
  if (typeof window === "undefined") return []
  return readList(localStorage.getItem(STORAGE_KEY))
}

export function getLocalOrder(referenceId: string): LocalOrder | null {
  const needle = referenceId.replace(/[^A-Za-z0-9]/g, "").toLowerCase()
  return readLocalOrders().find((order) => order.referenceId.replace(/[^A-Za-z0-9]/g, "").toLowerCase() === needle) || null
}

export function saveLocalOrder(order: LocalOrder) {
  if (typeof window === "undefined" || !order.referenceId) return
  const needle = order.referenceId.replace(/[^A-Za-z0-9]/g, "").toLowerCase()
  const next = [
    order,
    ...readLocalOrders().filter((existing) => existing.referenceId.replace(/[^A-Za-z0-9]/g, "").toLowerCase() !== needle),
  ].slice(0, 30)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function savePendingOrder(order: LocalOrder) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(order))
}

export function takePendingOrder(referenceId: string): LocalOrder | null {
  if (typeof window === "undefined") return null
  let pending: LocalOrder | null = null
  try {
    const parsed = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null")
    if (parsed && typeof parsed.referenceId === "string") pending = parsed
  } catch {
    pending = null
  }
  if (!pending) return getLocalOrder(referenceId)
  const needle = referenceId.replace(/[^A-Za-z0-9]/g, "").toLowerCase()
  if (pending.referenceId.replace(/[^A-Za-z0-9]/g, "").toLowerCase() !== needle) return getLocalOrder(referenceId)
  return pending
}

export function downloadOrderReceipt(order: LocalOrder) {
  const lines = [
    "Honic Company Limited",
    "Order receipt",
    "",
    `Order: ${order.referenceId}`,
    `Status: ${order.status}`,
    `Date: ${new Date(order.createdAt).toLocaleString("en-TZ")}`,
    `Name: ${order.customerName || "-"}`,
    `Phone: ${order.phone || "-"}`,
    `Email: ${order.email || "-"}`,
    "",
    "Items",
    ...(order.items.length
      ? order.items.map((item) => `${item.quantity} x ${item.name} — ${item.total} ${order.currency}`)
      : ["Details are on the order page"]),
    "",
    `Total: ${order.total} ${order.currency}`,
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `honic-order-${order.referenceId}.txt`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
