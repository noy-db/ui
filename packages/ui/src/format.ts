// Shared display formatters. One Intl instance so currency formatting is identical everywhere
// (header subtotal, group rollups, …) — Italian locale, € symbol.
const EUR = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const AMOUNT = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatEur(n: number): string {
  return EUR.format(Number.isFinite(n) ? n : 0)
}

/** Decimal amount WITHOUT the currency symbol — e.g. a subtotal under an "Amount €" column. */
export function formatAmount(n: number): string {
  return AMOUNT.format(Number.isFinite(n) ? n : 0)
}
