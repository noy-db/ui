// Related-list helpers — the Item-family reverse-lookup surface (Item Release P6).
//
// A record detail can show a "related" list of another collection's rows that point back to it
// (e.g. a label's records via `records.query().where('labelId','==',id)`), headed by a derived
// summary (count / total / average) from the SAME query's `aggregate()`. The reverse-lookup and
// aggregate run host-side against the hub; these pure helpers shape the result for the view: a
// column subset for the compact embedded list, and aggregate values formatted into summary cards.
import type { AppColumn } from './column'

/**
 * Pick and order a column subset for a compact embedded list. Keys are taken in the order given;
 * an unknown key is skipped (so a caller can list a superset without guarding).
 */
export function relatedColumns(columns: readonly AppColumn[], keys: readonly string[]): AppColumn[] {
  const byKey = new Map(columns.map((c) => [c.key, c]))
  return keys.map((k) => byKey.get(k)).filter((c): c is AppColumn => c !== undefined)
}

export interface SummaryFieldSpec {
  /** The key in the `aggregate()` result object. */
  key: string
  label: string
  /** Optional icon (e.g. `i-lucide-disc`) + badge color for the StatCard. */
  icon?: string
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info'
  /**
   * Format the raw aggregate number → display string. Receives `null` when the set is empty
   * (an `avg` over zero rows is `null`). Defaults to `String`, with `null`/`undefined` → `—`.
   */
  format?: (v: number | null) => string
}

export interface SummaryCard {
  label: string
  value: string
  icon?: string
  color?: SummaryFieldSpec['color']
}

/**
 * Turn an `aggregate().run()` result into StatCard-ready cards. An absent/`null` value (empty set)
 * renders as `—` unless the spec's `format` chooses otherwise.
 */
export function summaryCards(
  agg: Record<string, number | null | undefined>,
  spec: readonly SummaryFieldSpec[],
): SummaryCard[] {
  return spec.map((s) => {
    const raw = agg[s.key]
    const norm = raw == null ? null : raw
    return {
      label: s.label,
      value: s.format ? s.format(norm) : norm == null ? '—' : String(norm),
      ...(s.icon ? { icon: s.icon } : {}),
      ...(s.color ? { color: s.color } : {}),
    }
  })
}
