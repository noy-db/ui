// Grouping + rollups (Phase 4 / G). Partitions the (already filtered + sorted) rows by a field
// into ordered groups — enum groups follow their lifecycle ordinal, others by size desc then value
// — preserving the incoming row order within each group. columnRollup computes a per-column group
// aggregate: a SUM for summable columns, a DISTINCT count otherwise ("14 countries"). Single-level
// for now; multi-level is a follow-up. See docs/unified-search-and-data-cube-spec.md §2 (G).
import { ordinalRank, resolveField, type EntitySchema } from './schema.js'

export interface RowGroup<T> { value: string; rows: T[] }

/** A node in the multi-level group tree: a value at one level, its rows, and nested sub-groups. */
export interface GroupNode<T> { field: string; value: string; rows: T[]; children: GroupNode<T>[] }

/**
 * Recursively group `rows` by `fieldIds` in order (level 0 = fieldIds[0]). Each level reuses the
 * single-level ordering (enum→ordinal, else size desc then value). Leaf nodes (last field) carry
 * their rows with an empty `children`. Returns [] for no fields. See useAstTable for flattening.
 */
export function groupRowsMulti<T extends Record<string, any>>(
  rows: readonly T[], schema: EntitySchema, fieldIds: readonly string[],
): GroupNode<T>[] {
  if (!fieldIds.length) return []
  const [head, ...rest] = fieldIds
  return groupRows(rows, schema, head!).map((g) => ({
    field: head!,
    value: g.value,
    rows: g.rows,
    children: rest.length ? groupRowsMulti(g.rows, schema, rest) : [],
  }))
}

export function groupRows<T extends Record<string, any>>(
  rows: readonly T[], schema: EntitySchema, fieldId: string,
): RowGroup<T>[] {
  const field = resolveField(schema, fieldId)
  if (!field) return []
  const key = field.rowKey ?? field.id
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const v = r[key]
    const k = v == null || v === '' ? '—' : String(v)
    const bucket = map.get(k)
    if (bucket) bucket.push(r)
    else map.set(k, [r])
  }
  const groups = [...map.entries()].map(([value, rs]) => ({ value, rows: rs }))
  if (field.enumOrder) groups.sort((a, b) => ordinalRank(field.enumOrder, a.value) - ordinalRank(field.enumOrder, b.value))
  else groups.sort((a, b) => b.rows.length - a.rows.length || a.value.localeCompare(b.value))
  return groups
}

export interface ColumnRollupCol<T> { key: string; summable?: boolean; amountOf?: (r: T) => number; enumOf?: (r: T) => string | null | undefined }
export type Rollup = { kind: 'sum'; value: number } | { kind: 'distinct'; value: number }

export function columnRollup<T extends Record<string, any>>(rows: readonly T[], col: ColumnRollupCol<T>): Rollup {
  if (col.summable) {
    const get = col.amountOf ?? ((r: T) => Number(r[col.key]) || 0)
    let sum = 0
    for (const r of rows) sum += get(r)
    return { kind: 'sum', value: sum }
  }
  const get = col.enumOf ?? ((r: T) => r[col.key])
  const set = new Set<string>()
  for (const r of rows) { const v = get(r); if (v != null && v !== '') set.add(String(v)) }
  return { kind: 'distinct', value: set.size }
}
