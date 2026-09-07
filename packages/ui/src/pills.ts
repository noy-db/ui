// AST → display pills (A7). Each top-level conjunct of the where-tree becomes one pill; sort and
// group keys become their own pills. The search box (Phase 2) renders these and maps clicks back
// to AST edits. Complex OR/grouped subtrees fall back to their serialized form as a single pill.
// See docs/unified-search-and-data-cube-spec.md §3.1.
import type { Ast, Node, Predicate, RawValue } from './ast.js'
import { resolveField, type EntitySchema } from './schema.js'
import { dateLabel } from './dates.js'

export interface Pill {
  /** Stable-ish key for v-for / removal. */
  id: string
  kind: 'filter' | 'text' | 'sort' | 'group' | 'view'
  field?: string
  label: string
  /** Split presentation: `head` = the field/kind prefix (rendered muted), `value` = the payload
   *  (rendered strong). `label` stays the joined form for flat consumers (menus). Absent for
   *  free-text and complex-subtree pills, which are all value. */
  head?: string
  value?: string
  negated?: boolean
  /** Which AST list this pill came from, and its index there — used by removePill. */
  source: 'where' | 'sort' | 'group' | 'show' | 'hide'
  index: number
}

const OP_LABEL: Partial<Record<Predicate['op'], string>> = { gt: '>', gte: '≥', lt: '<', lte: '≤', ne: '≠' }

/** Canonical value → display name (enum/entity labels), same resolver as narrate's. */
type FmtValue = (field: string, value: string) => string | undefined

/** Host translator, same contract as narrate's (`t('nui.q.not', 'not')`). Omit → English. */
type T = (key: string, fallback?: string) => string
const EN: T = (_key, fallback) => fallback ?? _key

function valueText(field: string, v: RawValue, fmt?: FmtValue): string {
  const f = (x: string) => fmt?.(field, x) ?? x
  if (v.k === 'scalar') return f(v.v)
  if (v.k === 'list') return v.v.map(f).join(', ')
  return `${v.from ? f(v.from) : ''}–${v.to ? f(v.to) : ''}`
}

function fieldLabel(schema: EntitySchema, id: string): string {
  return resolveField(schema, id)?.label ?? id
}

/** A predicate split into presentation parts: head = "Genre:" / "Year ≥", value = "Jazz" / "1990".
 *  Boolean fields collapse to the bare label as the value ("Favorite" / "not Favorite"), no head. */
function predParts(schema: EntitySchema, p: Predicate, fmt?: FmtValue, t: T = EN): { head: string; value: string } {
  const label = fieldLabel(schema, p.field)
  const field = resolveField(schema, p.field)
  if (field?.type === 'boolean') {
    const truthy = p.value.k === 'scalar' && /^(true|yes|1)$/i.test(p.value.v)
    const on = p.op === 'ne' ? !truthy : truthy
    return { head: '', value: on ? label : `${t('nui.q.not', 'not')} ${label}` }
  }
  const sym = OP_LABEL[p.op]
  if (sym) return { head: `${label} ${sym}`, value: valueText(p.field, p.value, fmt) }
  // Date fields: show the friendly rolling label ("Last 30 days") rather than the raw token.
  if (p.value.k === 'scalar' && field?.type === 'date') return { head: `${label}:`, value: dateLabel(p.value.v) }
  return { head: `${label}:`, value: valueText(p.field, p.value, fmt) } // eq / in / range
}
function predLabel(schema: EntitySchema, p: Predicate, fmt?: FmtValue, t: T = EN): string {
  const { head, value } = predParts(schema, p, fmt, t)
  return head ? `${head} ${value}` : value
}

/** Readable label for any node — used for the pill text and for and/or subtrees (joined by or/and),
 *  instead of dumping the raw serialized DSL. */
function nodeLabel(schema: EntitySchema, node: Node, fmt?: FmtValue, t: T = EN): string {
  switch (node.t) {
    case 'pred': return predLabel(schema, node, fmt, t)
    case 'text': return node.value
    case 'not': return `${t('nui.q.not', 'not')} ${nodeLabel(schema, node.node, fmt, t)}`
    case 'and': return node.nodes.map((n) => nodeLabel(schema, n, fmt, t)).join(` ${t('nui.q.and', 'and')} `)
    case 'or': return node.nodes.map((n) => nodeLabel(schema, n, fmt, t)).join(` ${t('nui.q.or', 'or')} `)
  }
}

function pillFor(schema: EntitySchema, node: Node, i: number, fmt?: FmtValue, t: T = EN): Pill {
  if (node.t === 'not') {
    const inner = pillFor(schema, node.node, i, fmt, t)
    const not = t('nui.q.not', 'not')
    return { ...inner, id: `n${i}`, negated: true, label: `${not} ${inner.label}`, head: `${not} ${inner.head ?? ''}`.trim() || undefined, value: inner.value ?? inner.label }
  }
  if (node.t === 'pred') {
    const { head, value } = predParts(schema, node, fmt, t)
    return { id: `f${i}`, kind: 'filter', field: node.field, label: head ? `${head} ${value}` : value, head: head || undefined, value, source: 'where', index: i }
  }
  if (node.t === 'text') return { id: `t${i}`, kind: 'text', label: node.value, value: node.value, source: 'where', index: i }
  // and/or subtree → one pill with a readable joined label (was: raw serialized DSL)
  const joined = nodeLabel(schema, node, fmt, t)
  return { id: `g${i}`, kind: 'filter', label: joined, value: joined, source: 'where', index: i }
}

/** `fmt` maps canonical enum/entity values to display names, so pills read "Genre: Jazz" not "jazz".
 *  `t` localizes the structural words (not/and/or) and the sort/group/show/hide heads. */
export function astToPills(ast: Ast, schema: EntitySchema, fmt?: FmtValue, t: T = EN): Pill[] {
  const pills: Pill[] = []
  const top: Node[] = ast.where ? (ast.where.t === 'and' ? ast.where.nodes : [ast.where]) : []
  top.forEach((n, i) => pills.push(pillFor(schema, n, i, fmt, t)))
  ast.sort.forEach((s, i) => {
    const v = `${fieldLabel(schema, s.field)} ${s.dir === 'desc' ? '↓' : '↑'}`
    const head = t('nui.pill.sort', 'Sort:')
    pills.push({ id: `s${i}`, kind: 'sort', field: s.field, label: `${head} ${v}`, head, value: v, source: 'sort', index: i })
  })
  ast.groupBy.forEach((g, i) => {
    const v = fieldLabel(schema, g.field)
    const head = t('nui.pill.group', 'Group:')
    pills.push({ id: `gr${i}`, kind: 'group', field: g.field, label: `${head} ${v}`, head, value: v, source: 'group', index: i })
  })
  ast.view?.show.forEach((f, i) => {
    const v = fieldLabel(schema, f)
    const head = t('nui.pill.show', 'Show:')
    pills.push({ id: `sh${i}`, kind: 'view', field: f, label: `${head} ${v}`, head, value: v, source: 'show', index: i })
  })
  ast.view?.hide.forEach((f, i) => {
    const v = fieldLabel(schema, f)
    const head = t('nui.pill.hide', 'Hide:')
    pills.push({ id: `hd${i}`, kind: 'view', field: f, label: `${head} ${v}`, head, value: v, source: 'hide', index: i })
  })
  return pills
}

/** Return a new AST with the pill MOVED to `toIndex` within its OWN list (where conjuncts, sort
 *  keys, group keys, show/hide). Order carries meaning for sort (priority) and group (nesting);
 *  for filters it is presentation only (AND commutes). `toIndex` counts positions in the list
 *  WITHOUT the dragged item (i.e. the insertion slot after removal). */
export function movePill(ast: Ast, pill: Pick<Pill, 'source' | 'index'>, toIndex: number): Ast {
  const move = <T,>(arr: readonly T[]): T[] => {
    const a = [...arr]
    const [it] = a.splice(pill.index, 1)
    if (it === undefined) return [...arr]
    a.splice(Math.max(0, Math.min(toIndex, a.length)), 0, it)
    return a
  }
  if (pill.source === 'sort') return { ...ast, sort: move(ast.sort) }
  if (pill.source === 'group') return { ...ast, groupBy: move(ast.groupBy) }
  if (pill.source === 'show' || pill.source === 'hide') {
    const view = ast.view ?? { show: [], hide: [] }
    return { ...ast, view: { ...view, [pill.source]: move(view[pill.source]) } }
  }
  const top: Node[] = ast.where ? (ast.where.t === 'and' ? ast.where.nodes : [ast.where]) : []
  const kept = move(top)
  const where: Node | null = kept.length === 0 ? null : kept.length === 1 ? kept[0]! : { t: 'and', nodes: kept }
  return { ...ast, where }
}

/** Return a new AST with the given pill removed (top-level where conjunct, or a sort/group key). */
export function removePill(ast: Ast, pill: Pick<Pill, 'source' | 'index'>): Ast {
  if (pill.source === 'sort') return { ...ast, sort: ast.sort.filter((_, i) => i !== pill.index) }
  if (pill.source === 'group') return { ...ast, groupBy: ast.groupBy.filter((_, i) => i !== pill.index) }
  if (pill.source === 'show' || pill.source === 'hide') {
    const view = ast.view ?? { show: [], hide: [] }
    const key = pill.source
    return { ...ast, view: { ...view, [key]: view[key].filter((_, i) => i !== pill.index) } }
  }
  const top: Node[] = ast.where ? (ast.where.t === 'and' ? ast.where.nodes : [ast.where]) : []
  const kept = top.filter((_, i) => i !== pill.index)
  const where: Node | null = kept.length === 0 ? null : kept.length === 1 ? kept[0]! : { t: 'and', nodes: kept }
  return { ...ast, where }
}
