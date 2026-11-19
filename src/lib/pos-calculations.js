export function calculateSubtotal(items) {
  const cents = items.reduce((sum, item) => sum + Math.round(Math.round(Number(item.sale_price) * 100) * Number(item.quantity)), 0)
  return cents / 100
}
export function calculateDiscount(subtotal, rawDiscount) {
  const parsed = Number(rawDiscount)
  const requested = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
  return Math.min(Math.round(requested * 100) / 100, Math.max(0, subtotal))
}
export function calculateTotal(subtotal, discount) {
  return Math.round((Math.max(0, subtotal - discount) + Number.EPSILON) * 100) / 100
}
