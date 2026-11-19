export type PricedItem = { sale_price: number; quantity: number }
export function calculateSubtotal(items: PricedItem[]): number
export function calculateDiscount(subtotal: number, rawDiscount: string | number): number
export function calculateTotal(subtotal: number, discount: number): number
