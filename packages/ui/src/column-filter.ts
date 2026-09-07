// AST ⇄ column-header bridge (E1–E4). The column-header popovers read their selection from, and
// write their changes into, the SAME query AST as the search box — one source of truth. This module
// reads/writes a column's top-level predicate and computes target-excluded faceted counts directly
// over the AST via evaluate(). Replaces the parallel TableFilters state in use-table-filters.
// See docs/unified-search-and-data-cube-spec.md §2 (E).
import type { Ast, Node, Predicate, SortKey } from './ast.js'
import { evaluate } from './evaluate.js'
import { ordinalRank, resolveField, type EntitySchema } from './schema.js'
import type { Facet, EntityFacets } from './table-filter'

export type { Facet, EntityFacets }
export interface DateBounds { from?: string; to?: string }

function topNodes(ast: Ast): Node[] {
  return ast.where ? (ast.where.t === 'and' ? ast.where.nodes : [ast.where]) : []
}
function withTop(ast: Ast, nodes: Node[]): Ast {
  const where: Node | null = nodes.length === 0 ? null : nodes.length === 1 ? nodes[0]! : { t: 'and', nodes }
  return { ...ast, where }
}

/** The positively-selected enum/entity values for a column (from its eq/in predicate). */
export function readColumnValues(ast: Ast, fieldId: string): string[] {
  const out: string[] = []
  for (const n of topNodes(ast)) {
    if (n.t !== 'pred' || n.field !== fieldId) continue
    if (n.op === 'eq' && n.value.k === 'scalar') out.push(n.value.v)
    else if (n.op === 'in' && n.value.k === 'list') out.push(...n.value.v)
  }
  return out
}

/** Set a column's enum/entity selection (eq for one, in for many, removed when empty). */
export function withColumnValues(ast: Ast, fieldId: string, values: string[]): Ast {
  const rest = topNodes(ast).filter(
    (n) => !(n.t === 'pred' && n.field === fieldId && (n.op === 'eq' || n.op === 'in')),
  )
  if (values.length) {
    const pred: Predicate = values.length === 1
      ? { t: 'pred', field: fieldId, op: 'eq', value: { k: 'scalar', v: values[0]! } }
      : { t: 'pred', field: fieldId, op: 'in', value: { k: 'list', v: values } }
    rest.push(pred)
  }
  return withTop(ast, rest)
}

/** The date bounds for a column (from its range/gte/lte predicate). */
export function readDateBounds(ast: Ast, fieldId: string): DateBounds {
  for (const n of topNodes(ast)) {
    if (n.t !== 'pred' || n.field !== fieldId) continue
    if (n.op === 'range' && n.value.k === 'range') return { from: n.value.from ?? undefined, to: n.value.to ?? undefined }
    if (n.op === 'gte' && n.value.k === 'scalar') return { from: n.value.v }
    if (n.op === 'lte' && n.value.k === 'scalar') return { to: n.value.v }
  }
  return {}
}

/** Set a column's date bounds (a range predicate; removed when both bounds are empty). */
export function withDateBounds(ast: Ast, fieldId: string, bounds: DateBounds): Ast {
  const rest = topNodes(ast).filter(
    (n) => !(n.t === 'pred' && n.field === fieldId && (n.op === 'range' || n.op === 'gte' || n.op === 'lte')),
  )
  if (bounds.from || bounds.to) {
    rest.push({ t: 'pred', field: fieldId, op: 'range', value: { k: 'range', from: bounds.from ?? null, to: bounds.to ?? null } })
  }
  return withTop(ast, rest)
}

/** Remove every top-level predicate for a field (used to exclude a column from its own facets). */
export function astWithoutField(ast: Ast, fieldId: string): Ast {
  return withTop(ast, topNodes(ast).filter((n) => !(n.t === 'pred' && n.field === fieldId)))
}

function countBy<T extends Record<string, any>>(rows: readonly T[], key: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) { const v = r[key]; if (v == null || v === '') continue; const k = String(v); m.set(k, (m.get(k) ?? 0) + 1) }
  return m
}

/** Faceted counts for a column: all OTHER predicates applied, this column's own ignored. */
export function facetsForColumn<T extends Record<string, any>>(
  rows: readonly T[], ast: Ast, schema: EntitySchema, fieldId: string, now?: Date,
): Facet[] {
  const field = resolveField(schema, fieldId)
  if (!field) return []
  const key = field.rowKey ?? field.id
  const base = evaluate(rows, { where: astWithoutField(ast, fieldId).where, sort: [], groupBy: [] }, schema, now)
  const selected = new Set(readColumnValues(ast, fieldId))
  const facets = [...countBy(base, key)].map(([value, count]) => ({ value, count, selected: selected.has(value) }))
  if (field.enumOrder) facets.sort((a, b) => ordinalRank(field.enumOrder, a.value) - ordinalRank(field.enumOrder, b.value))
  else facets.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
  return facets
}

/** Entity facets split into "in view" (present after ALL filters) vs "all others". */
export function entityFacetsForColumn<T extends Record<string, any>>(
  rows: readonly T[], ast: Ast, schema: EntitySchema, fieldId: string, visibleRows: readonly T[], now?: Date,
): EntityFacets {
  const field = resolveField(schema, fieldId)
  if (!field) return { inView: [], others: [] }
  const key = field.rowKey ?? field.id
  const inViewSet = new Set([...countBy(visibleRows, key).keys()])
  const universe = facetsForColumn(rows, ast, schema, fieldId, now)
  return { inView: universe.filter((f) => inViewSet.has(f.value)), others: universe.filter((f) => !inViewSet.has(f.value)) }
}

// ── multi-sort helpers (F) ──
/** Cycle a column's sort: absent → asc → desc → removed; or append when `additive` (shift-click). */
export function cycleSort(sort: SortKey[], field: string, additive: boolean): SortKey[] {
  const idx = sort.findIndex((s) => s.field === field)
  if (idx === -1) return additive ? [...sort, { field, dir: 'asc' }] : [{ field, dir: 'asc' }]
  const cur = sort[idx]!
  if (cur.dir === 'asc') { const next = [...sort]; next[idx] = { field, dir: 'desc' }; return additive ? next : [{ field, dir: 'desc' }] }
  // was desc → remove this key
  const without = sort.filter((s) => s.field !== field)
  return additive ? without : []
}

/** Set a column's sort to an absolute direction (date popover Asc/Desc; not a toggle). */
export function setSortDir(sort: SortKey[], field: string, dir: 'asc' | 'desc', additive: boolean): SortKey[] {
  const without = sort.filter((s) => s.field !== field)
  return additive ? [...without, { field, dir }] : [{ field, dir }]
}
