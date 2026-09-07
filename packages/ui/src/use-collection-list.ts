// Single-state table composable (Phase 3). The query STRING is the one source of truth: the
// search box edits it as pills, and the column headers read their selection from / write their
// changes into the SAME AST (via column-filter.ts). Derives visible rows (evaluate = filter +
// multi-sort), per-column faceted options (target-excluded), the current selection per column
// (for the active-dot/popover), summable subtotals, and the multi-sort list. Retires the parallel
// TableFilters state of use-table-filters.ts. See docs/unified-search-and-data-cube-spec.md §2 (E/F).
import { computed, ref, watch, type Ref } from 'vue'
import type { AppColumn } from './column'
import type { Ast, Node, SortKey } from './ast'
import type { ColumnFilterValue, EntityFacets, Facet } from './table-filter'
import { columnRollup, groupRowsMulti, type GroupNode } from './group'
import { entityFacetsForColumn, facetsForColumn, readColumnValues, readDateBounds, withColumnValues, withDateBounds } from './column-filter'
import { evaluate } from './evaluate'
import { parse } from './parse'
import { resolve } from './resolve'
import { serialize } from './serialize'
import { columnAggregate } from './aggregate'
import { formatEur } from './format'
import { useColumnPrefs } from './use-column-prefs'
import { resolveField, type EntitySchema } from './schema'

/** A group banner line: a value at one nesting level, with per-column rollup cells. */
export interface GroupLine {
  kind: 'group'; id: string; level: number; field: string; value: string
  label: string; count: number; cells: Record<string, string>; collapsed: boolean
  /** 1-based serial WITHIN the parent (resets per level), shown indented before the group label. */
  serial?: number
}
/** A data-row line: one record, with its serial within its leaf group. */
export interface RowLine<T> { kind: 'row'; level: number; row: T; serial: number }
/** The flattened, collapse-aware display sequence the table renders when grouped. */
export type DisplayLine<T> = GroupLine | RowLine<T>

export function useCollectionList<T extends Record<string, any>>(o: {
  baseRows: Ref<readonly T[]>
  query: Ref<string>
  /** Collection name — an opaque string used to scope column prefs + collapse state in storage. */
  entity: string
  columns: AppColumn[]
  defaultSort: SortKey[]
  /** The engine schema for this collection — typically `schemaFromDescribe(collection.describe())`,
   *  or a hand-authored `EntitySchema`. Required: the package is domain-agnostic and ships no registry.
   *  Pass a GETTER when the schema is reactive (e.g. localized field labels that change with the
   *  active locale) — every derived computed re-reads it. */
  schema: EntitySchema | (() => EntitySchema)
  /** Optional: translate a canonical enum value to a display label for group banners.
   *  Return `undefined` to fall back to the default capitalization. */
  formatGroupLabel?: (field: string, value: string) => string | undefined
}) {
  const schemaOf = (): EntitySchema => (typeof o.schema === 'function' ? o.schema() : o.schema)
  const ast = computed<Ast>(() => resolve(parse(o.query.value).ast, schemaOf()))
  const effectiveSort = computed<SortKey[]>(() => (ast.value.sort.length ? ast.value.sort : o.defaultSort))
  const visibleRows = computed<T[]>(() =>
    evaluate(o.baseRows.value, { where: ast.value.where, sort: effectiveSort.value, groupBy: [] }, schemaOf()))

  const setQuery = (a: Ast) => { o.query.value = serialize(a) }

  const columnFilters = computed<Record<string, ColumnFilterValue>>(() => {
    const out: Record<string, ColumnFilterValue> = {}
    for (const c of o.columns) {
      if (c.filter === 'enum' || c.filter === 'entity') {
        const sel = readColumnValues(ast.value, c.key)
        if (sel.length) out[c.key] = { kind: c.filter, selected: sel }
      } else if (c.filter === 'date') {
        const b = readDateBounds(ast.value, c.key)
        if (b.from || b.to) out[c.key] = { kind: 'date', from: b.from, to: b.to }
      }
    }
    return out
  })

  const enumFacets = computed<Record<string, Facet[]>>(() => {
    const out: Record<string, Facet[]> = {}
    for (const c of o.columns) if (c.filter === 'enum') {
      const facets = facetsForColumn(o.baseRows.value, ast.value, schemaOf(), c.key)
      // Attach the host's display label (dict/locale) so the filter popover shows "Rock", not "rock".
      // `value` stays canonical for filtering; `label` is display-only.
      out[c.key] = o.formatGroupLabel
        ? facets.map((f) => ({ ...f, label: o.formatGroupLabel!(c.key, f.value) ?? f.value }))
        : facets
    }
    return out
  })
  const entityFacets = computed<Record<string, EntityFacets>>(() => {
    const out: Record<string, EntityFacets> = {}
    for (const c of o.columns) if (c.filter === 'entity') out[c.key] = entityFacetsForColumn(o.baseRows.value, ast.value, schemaOf(), c.key, visibleRows.value)
    return out
  })
  const subtotals = computed<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const c of o.columns) {
      if (!c.summable) continue
      const get = c.amountOf ?? ((r: Record<string, any>) => Number(r[c.key]) || 0)
      let t = 0
      for (const r of visibleRows.value) t += get(r)
      out[c.key] = t
    }
    return out
  })

  // Grouping (multi-level): build the group tree, then flatten it to a collapse-aware line list.
  //
  // One logical DIMENSION can be reachable via two field ids: the FK schema field (labelId) and the
  // joined display column keyed by it (label_name, whose AppColumn declares field: 'labelId').
  // Canonicalize every group field through the column link to its dimension id and dedupe, so
  // `group:label_name` (typed) and toggling "Label" in the panel are the SAME group level — never
  // two nested copies of one dimension.
  const canonId = (id: string): string => resolveField(schemaOf(), id)?.id ?? id
  const dimensionOf = (id: string): string => {
    const canon = canonId(id)
    const col = o.columns.find((c) => c.key === canon || canonId(c.field ?? c.key) === canon)
    return col ? canonId(col.field ?? col.key) : canon
  }
  const groupFields = computed<string[]>(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const g of ast.value.groupBy) {
      const dim = dimensionOf(g.field)
      if (!seen.has(dim)) { seen.add(dim); out.push(dim) }
    }
    return out
  })
  const isGrouped = computed(() => groupFields.value.length > 0)
  const groupTree = computed<GroupNode<T>[]>(() => groupRowsMulti(visibleRows.value, schemaOf(), groupFields.value))

  // Collapsed group ids — persisted per entity in localStorage (G4a) so the expand/collapse state
  // survives a reload. Group ids embed field=value, so stale ids from a different group config are
  // simply never matched (harmless). Kept out of the URL (it would be verbose and noisy to share).
  const collapsedKey = `nui.collapsed.${o.entity}`
  const loadCollapsed = (): Set<string> => {
    try { const raw = globalThis.localStorage?.getItem(collapsedKey); return raw ? new Set(JSON.parse(raw) as string[]) : new Set() } catch { return new Set() }
  }
  const collapsed = ref<Set<string>>(loadCollapsed())
  watch(collapsed, (s) => { try { globalThis.localStorage?.setItem(collapsedKey, JSON.stringify([...s])) } catch { /* ignore quota/availability */ } })
  function toggleGroup(id: string): void {
    const next = new Set(collapsed.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    collapsed.value = next
  }

  // Enumerate every group id by depth from the FULL tree (independent of the current collapse state),
  // so "expand/collapse to level N" is deterministic. Id derivation mirrors the groupLines walk.
  const groupIdsByLevel = computed<string[][]>(() => {
    const byLevel: string[][] = []
    const walk = (nodes: GroupNode<T>[], level: number, parentId: string): void => {
      for (const n of nodes) {
        const id = parentId ? `${parentId}|${n.field}=${n.value}` : `${n.field}=${n.value}`
        ;(byLevel[level] ??= []).push(id)
        if (n.children.length) walk(n.children, level + 1, id)
      }
    }
    walk(groupTree.value, 0, '')
    return byLevel
  })
  const maxGroupDepth = computed(() => groupFields.value.length)
  /** Expand everything (banners + rows all open). */
  function expandAll(): void { collapsed.value = new Set() }
  /** Collapse so the deepest visible banners are at `level`: collapse every group AT that depth
   *  (which hides everything below), leaving shallower levels open. level 0 = only the main groups. */
  function collapseToLevel(level: number): void { collapsed.value = new Set(groupIdsByLevel.value[level] ?? []) }
  /** True when every main (level-0) group is collapsed → the table shows just the main-group list. */
  const allTopCollapsed = computed(() => {
    const top = groupIdsByLevel.value[0] ?? []
    return top.length > 0 && top.every((id) => collapsed.value.has(id))
  })
  /** Master toggle behind the header arrow: collapse all to the main-group list, or re-expand. */
  function toggleCollapseAll(): void { if (allTopCollapsed.value) expandAll(); else collapseToLevel(0) }

  // ── Group-by interface (the dropdown control + the `group:`/`group-by:` token both write here) ──
  // Only categorical fields (enum/entity) are offered — grouping a numeric/date column rarely helps.
  const groupableFields = computed<{ id: string; label: string }[]>(() =>
    schemaOf().fields.filter((f) => f.type === 'enum' || f.type === 'entity').map((f) => ({ id: f.id, label: f.label })))

  const setGroupBy = (fieldIds: string[]) => setQuery({ ...ast.value, groupBy: fieldIds.map((field) => ({ field })) })
  /** Toggle one DIMENSION in the group-by chain; preserves the order of the others. Matching by
   *  dimension means toggling "Label" also removes a typed `group:label_name` (same dimension). */
  function toggleGroupField(id: string): void {
    const dim = dimensionOf(id)
    const cur = groupFields.value // already dimension-canonical + deduped
    setGroupBy(cur.includes(dim) ? cur.filter((f) => f !== dim) : [...cur, dim])
  }
  function clearGroups(): void { setGroupBy([]) }

  // Column keys to HIDE in the table once grouped: the group field's value is already in the banner,
  // so its own column is redundant. Maps each group field to its matching column via canonical id.
  const groupedColumnKeys = computed<string[]>(() => {
    const keys: string[] = []
    for (const g of groupFields.value) {
      const canon = resolveField(schemaOf(), g)?.id ?? g
      const col = o.columns.find((c) => (resolveField(schemaOf(), c.field ?? c.key)?.id ?? c.field ?? c.key) === canon)
      if (col) keys.push(col.key)
    }
    return keys
  })

  // Focus columns (R4): a normally-hidden column is force-shown while the query references its field
  // (a filter predicate or a sort key) so the user can always SEE what they filtered/sorted by.
  // Grouped fields are excluded — their value lives in the banner, so the column stays hidden.
  const focusColumnKeys = computed<string[]>(() => {
    const fields = new Set<string>()
    const walkNode = (n: Node | null): void => {
      if (!n) return
      if (n.t === 'pred') fields.add(n.field)
      else if (n.t === 'not') walkNode(n.node)
      else if (n.t === 'and' || n.t === 'or') n.nodes.forEach(walkNode)
    }
    walkNode(ast.value.where)
    for (const s of ast.value.sort) fields.add(s.field)
    const grouped = new Set(groupedColumnKeys.value)
    const keys: string[] = []
    for (const f of fields) {
      const col = colForField(f)
      if (col && !grouped.has(col.key)) keys.push(col.key)
    }
    return keys
  })

  // Map a (possibly aliased) field id to its column, by canonical id. Shared by focus + view (R5).
  const colForField = (f: string) => {
    const canon = resolveField(schemaOf(), f)?.id ?? f
    return o.columns.find((c) => (resolveField(schemaOf(), c.field ?? c.key)?.id ?? c.field ?? c.key) === canon)
  }
  const showColumnKeys = computed<string[]>(() =>
    (ast.value.view?.show ?? []).map((f) => colForField(f)?.key).filter((k): k is string => !!k))
  // Per-user persistent column preferences (R9) layer onto the per-query directives.
  const colPrefs = useColumnPrefs(o.entity)
  // Force-show = the query's focus columns ∪ explicit show: ∪ the user's pinned columns (show wins).
  const forceShowColumnKeys = computed<string[]>(() =>
    [...new Set([...focusColumnKeys.value, ...showColumnKeys.value, ...colPrefs.prefShow.value])])
  // hide = query hide: ∪ the user's always-hidden columns, minus anything force-shown.
  const hideColumnKeys = computed<string[]>(() => {
    const shown = new Set(forceShowColumnKeys.value)
    const fromAst = (ast.value.view?.hide ?? []).map((f) => colForField(f)?.key).filter((k): k is string => !!k)
    return [...new Set([...fromAst, ...colPrefs.prefHide.value])].filter((k) => !shown.has(k))
  })

  function rollupCells(node: GroupNode<T>): Record<string, string> {
    const groupCanon = resolveField(schemaOf(), node.field)?.id ?? node.field
    const cells: Record<string, string> = {}
    for (const c of o.columns) {
      if ((resolveField(schemaOf(), c.key)?.id ?? c.key) === groupCanon) { cells[c.key] = `${node.value} (${node.rows.length})`; continue }
      // Same per-column aggregate as the second header (sum no-€, distinct, days, count).
      const a = columnAggregate(node.rows, c)
      if (a) { cells[c.key] = a.text; continue }
      // Fallback for columns without an explicit aggregate (e.g. Status → distinct count).
      const r = columnRollup(node.rows, c)
      cells[c.key] = r.kind === 'sum' ? (c.formatSum?.(r.value) ?? formatEur(r.value)) : (r.value > 1 ? `${r.value}` : '')
    }
    return cells
  }

  // When a summable column is the active sort, order the groups by that column's rollup (so sorting
  // by Amount orders the groups by their amount subtotal); rows within a group are already in the
  // evaluated sort order. Other sorts keep the default group ordering (ordinal / size).
  function orderGroups(nodes: GroupNode<T>[]): GroupNode<T>[] {
    const primary = effectiveSort.value[0]
    if (!primary) return nodes
    const col = o.columns.find((c) => c.key === primary.field || c.sortFields?.includes(primary.field))
    if (!col?.summable) return nodes
    const get = col.amountOf ?? ((r: Record<string, any>) => Number(r[col.key]) || 0)
    const total = (n: GroupNode<T>) => n.rows.reduce((s, r) => s + get(r), 0)
    const dir = primary.dir === 'desc' ? -1 : 1
    return [...nodes].sort((a, b) => (total(a) - total(b)) * dir)
  }

  const groupLines = computed<DisplayLine<T>[]>(() => {
    const lines: DisplayLine<T>[] = []
    const walk = (nodes: GroupNode<T>[], level: number, parentId: string): void => {
      let serial = 0 // 1-based index of groups WITHIN this parent (resets per level/parent)
      for (const n of orderGroups(nodes)) {
        serial++
        const id = parentId ? `${parentId}|${n.field}=${n.value}` : `${n.field}=${n.value}`
        const isCollapsed = collapsed.value.has(id)
        // Banner shows the VALUE only — the grouped field is named by the group-by chips above, so a
        // "Field:" prefix on every banner is redundant (and crowds out the value on a narrow screen).
        const displayValue = o.formatGroupLabel?.(n.field, n.value) ?? n.value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        lines.push({ kind: 'group', id, level, field: n.field, value: n.value, label: displayValue, count: n.rows.length, cells: rollupCells(n), collapsed: isCollapsed, serial })
        if (isCollapsed) continue
        if (n.children.length) walk(n.children, level + 1, id)
        else n.rows.forEach((row, i) => lines.push({ kind: 'row', level: level + 1, row, serial: i + 1 }))
      }
    }
    walk(groupTree.value, 0, '')
    return lines
  })

  // Secondary fields of any composite-sort column (e.g. Reg sorts ['year','numberT'] — 'year' is
  // secondary). Hidden from the badge display so a composite reads as ONE sorted column. Use the
  // EFFECTIVE sort (incl. the default) so the active column always shows its arrow, even at rest.
  const compositeSecondary = new Set<string>()
  for (const c of o.columns) if (c.sortFields) for (const f of c.sortFields) if (f !== c.key) compositeSecondary.add(f)
  const sortKeys = computed<SortKey[]>(() => effectiveSort.value.filter((s) => !compositeSecondary.has(s.field)))
  const sortKey = computed<string | null>(() => effectiveSort.value[0]?.field ?? null)
  const sortDir = computed<'asc' | 'desc'>(() => (effectiveSort.value[0]?.dir === 'desc' ? 'desc' : 'asc'))

  function setColumnFilter(key: string, value: ColumnFilterValue | null): void {
    const col = o.columns.find((c) => c.key === key)
    if (!col) return
    if (!value) {
      setQuery(col.filter === 'date' ? withDateBounds(ast.value, key, {}) : withColumnValues(ast.value, key, []))
      return
    }
    if (value.kind === 'date') setQuery(withDateBounds(ast.value, key, { from: value.from, to: value.to }))
    else setQuery(withColumnValues(ast.value, key, value.selected))
  }
  // Multi-sort with double-click "lock". Single click = a transient single-column sort (no number).
  // Double-click (or shift-click) LOCKS the column into a numbered chain; once locked, a single
  // click on another column extends the chain. `locked` is in-memory; a 2+ key sort restored from
  // the URL still shows numbers via the length check below.
  const locked = ref(false)
  const sortLocked = computed(() => locked.value || sortKeys.value.length > 1)

  const fieldsFor = (key: string) => o.columns.find((c) => c.key === key)?.sortFields ?? [key]
  const dirOf = (sort: SortKey[], fields: string[]) => sort.find((s) => s.field === fields[0])?.dir ?? null
  const without = (sort: SortKey[], fields: string[]) => { const set = new Set(fields); return sort.filter((s) => !set.has(s.field)) }
  const append = (sort: SortKey[], fields: string[], dir: 'asc' | 'desc') => [...without(sort, fields), ...fields.map((f) => ({ field: f, dir }))]
  const setDir = (sort: SortKey[], fields: string[], dir: 'asc' | 'desc') => { const set = new Set(fields); return sort.map((s) => (set.has(s.field) ? { field: s.field, dir } : s)) }

  function commitSort(sort: SortKey[]): void {
    if (sort.length === 0) locked.value = false
    setQuery({ ...ast.value, sort })
  }
  /** Single click: transient single sort (cycle asc→desc→off), or extend the chain when locked. */
  function onSort(p: { key: string; additive?: boolean }): void {
    const fields = fieldsFor(p.key)
    const d = dirOf(ast.value.sort, fields)
    if (locked.value || p.additive) {
      locked.value = true
      commitSort(d === null ? append(ast.value.sort, fields, 'asc') : d === 'asc' ? setDir(ast.value.sort, fields, 'desc') : without(ast.value.sort, fields))
      return
    }
    commitSort(d === null ? fields.map((f) => ({ field: f, dir: 'asc' as const })) : d === 'asc' ? fields.map((f) => ({ field: f, dir: 'desc' as const })) : [])
  }
  /**
   * Double click toggles multi-sort mode:
   * - NOT locked → enter multi-sort, locking this column (keep its direction, append asc if new).
   * - ALREADY locked → release the multi-sort and reset ALL sort keys (any column does this).
   * Direction is changed by single-clicking, never by locking.
   */
  function onLockSort(p: { key: string }): void {
    if (locked.value) { locked.value = false; commitSort([]); return }
    const fields = fieldsFor(p.key)
    locked.value = true
    if (dirOf(ast.value.sort, fields) === null) commitSort(append(ast.value.sort, fields, 'asc'))
  }
  function clearAll(): void { locked.value = false; o.query.value = '' }

  return {
    ast, visibleRows, columnFilters, enumFacets, entityFacets, subtotals,
    sortKeys, sortKey, sortDir, sortLocked, isGrouped, groupLines, toggleGroup, setColumnFilter, onSort, onLockSort, clearAll,
    groupFields, groupableFields, groupedColumnKeys, toggleGroupField, clearGroups,
    maxGroupDepth, expandAll, collapseToLevel, allTopCollapsed, toggleCollapseAll,
    focusColumnKeys, forceShowColumnKeys, hideColumnKeys,
    columnPrefShow: colPrefs.prefShow, columnPrefHide: colPrefs.prefHide,
    cycleColumnPref: colPrefs.cycle, resetColumnPrefs: colPrefs.reset,
  }
}
