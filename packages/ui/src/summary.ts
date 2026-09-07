// Summary counters (I4) — the pure tally behind the second-header subtotal row. Counts the visible
// rows by an enum field's value, ordered by the field's lifecycle ordinal (so it reads
// draft → … → cancelled, not alphabetically). AppTable renders the result in the enum column's
// second-header cell (e.g. Status → "109 draft · 108 to verify"); this just produces the tally.
import { resolveField, ordinalRank, type EntitySchema } from './schema'

export interface EnumCount { value: string; count: number; label?: string }

/** Ordered value→count tally for an enum field over `rows` (blank values skipped). */
export function enumBreakdown(
  rows: readonly Record<string, any>[],
  schema: EntitySchema,
  field: string,
): EnumCount[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const v = r[field]
    if (v == null || v === '') continue
    const key = String(v)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const order = resolveField(schema, field)?.enumOrder
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (ordinalRank(order, a.value) - ordinalRank(order, b.value)) || a.value.localeCompare(b.value))
}
