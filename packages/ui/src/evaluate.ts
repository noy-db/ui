// AST evaluator (A5): compiles a query AST to a row predicate (AND/OR/NOT over typed leaves),
// applies it, then multi-key sorts (enum→ordinal, money/number→numeric, date→ISO, text→locale).
// Values are coerced HERE from the raw AST strings using the field type + synonyms + the NL date
// resolver, so the AST stays serializable. Grouping is Phase 4. Pure & framework-free — extends
// the role of shared/table-filter.ts to the full AST. See spec §3.4.
import type { Ast, CmpOp, Node, Predicate, RawValue } from './ast.js'
import { ordinalRank, resolveField, type EntitySchema, type FieldDef } from './schema.js'
import { normalizeTerm, resolveSynonym } from './synonyms.js'
import { resolveDate } from './dates.js'

export function evaluate<T extends Record<string, any>>(
  rows: readonly T[],
  ast: Ast,
  schema: EntitySchema,
  now: Date = new Date(),
): T[] {
  const pred = ast.where ? compile(ast.where, schema, now) : () => true
  const out = rows.filter(pred)
  return sortRows(out, ast, schema)
}

// ── filtering ──
function compile<T extends Record<string, any>>(node: Node, schema: EntitySchema, now: Date): (row: T) => boolean {
  switch (node.t) {
    case 'and': { const ps = node.nodes.map((n) => compile<T>(n, schema, now)); return (r) => ps.every((p) => p(r)) }
    case 'or': { const ps = node.nodes.map((n) => compile<T>(n, schema, now)); return (r) => ps.some((p) => p(r)) }
    case 'not': { const p = compile<T>(node.node, schema, now); return (r) => !p(r) }
    case 'text': return (r) => freeText(r, schema, node.value)
    case 'pred': return (r) => evalPred(r, schema, node, now)
  }
}

function freeText(row: Record<string, any>, schema: EntitySchema, term: string): boolean {
  const t = normalizeTerm(term)
  if (!t) return true
  return schema.textFields.some((f) => normalizeTerm(String(row[f] ?? '')).includes(t))
}

function evalPred(row: Record<string, any>, schema: EntitySchema, p: Predicate, now: Date): boolean {
  if (p.partial) return true // incomplete trailing predicate — ignore in filtering
  const field = resolveField(schema, p.field)
  if (!field) return freeText(row, schema, scalarText(p.value)) // unknown field → free text fallback
  const rowVal = row[field.rowKey ?? field.id]
  switch (field.type) {
    case 'money': case 'number': return evalNumber(Number(rowVal), p, field)
    case 'date': return evalDate(String(rowVal ?? ''), p, now)
    default: return evalCategorical(rowVal, p, field, schema)
  }
}

function evalCategorical(rowVal: unknown, p: Predicate, field: FieldDef, schema: EntitySchema): boolean {
  const rv = String(rowVal ?? '')
  const canon = (v: string) => (field.type === 'enum' ? resolveSynonym(schema.entity, field.id, v) : v)
  const eq = (v: string) =>
    field.type === 'text' ? normalizeTerm(rv).includes(normalizeTerm(v)) : normalizeTerm(rv) === normalizeTerm(canon(v))
  if (p.value.k === 'list') { const any = p.value.v.some((v) => eq(String(v))); return p.op === 'ne' ? !any : any }
  if (p.value.k === 'scalar') { const m = eq(p.value.v); return p.op === 'ne' ? !m : m }
  return true
}

function evalNumber(rowNum: number, p: Predicate, _field: FieldDef): boolean {
  if (Number.isNaN(rowNum)) return false
  if (p.value.k === 'range') {
    const from = p.value.from == null ? null : coerceNumber(p.value.from).n
    const to = p.value.to == null ? null : coerceNumber(p.value.to).n
    return (from == null || rowNum >= from) && (to == null || rowNum <= to)
  }
  if (p.value.k === 'list') return p.value.v.map((v) => coerceNumber(String(v)).n).includes(rowNum)
  const { n, bound } = coerceNumber(scalarText(p.value))
  const op: CmpOp = bound === 'gte' ? 'gte' : bound === 'lte' ? 'lte' : p.op
  switch (op) {
    case 'gt': return rowNum > n
    case 'gte': return rowNum >= n
    case 'lt': return rowNum < n
    case 'lte': return rowNum <= n
    case 'ne': return rowNum !== n
    default: return rowNum === n
  }
}

function evalDate(rowDate: string, p: Predicate, now: Date): boolean {
  if (!rowDate) return false
  if (p.value.k === 'range') {
    const from = p.value.from ? resolveDate(p.value.from, now)?.from ?? null : null
    const to = p.value.to ? resolveDate(p.value.to, now)?.to ?? null : null
    return (from == null || rowDate >= from) && (to == null || rowDate <= to)
  }
  const range = resolveDate(scalarText(p.value), now)
  if (!range) return false
  switch (p.op) {
    case 'lt': return rowDate < range.from
    case 'lte': return rowDate <= range.to
    case 'gt': return rowDate > range.to
    case 'gte': return rowDate >= range.from
    case 'ne': return !(rowDate >= range.from && rowDate <= range.to)
    default: return rowDate >= range.from && rowDate <= range.to
  }
}

// ── sorting ──
function sortRows<T extends Record<string, any>>(rows: T[], ast: Ast, schema: EntitySchema): T[] {
  if (!ast.sort.length) return rows
  const keys = ast.sort.map((s) => ({ s, field: resolveField(schema, s.field) }))
  return [...rows].sort((a, b) => {
    for (const { s, field } of keys) {
      const dir = s.dir === 'desc' ? -1 : 1
      const c = compareBy(a, b, field, s.field) * dir
      if (c !== 0) return c
    }
    return 0
  })
}

function compareBy(a: Record<string, any>, b: Record<string, any>, field: FieldDef | undefined, rawKey: string): number {
  const key = field?.rowKey ?? field?.id ?? rawKey
  const av = a[key]; const bv = b[key]
  if (field?.type === 'enum' && field.enumOrder) return ordinalRank(field.enumOrder, String(av ?? '')) - ordinalRank(field.enumOrder, String(bv ?? ''))
  if (field?.type === 'money' || field?.type === 'number') return (Number(av) || 0) - (Number(bv) || 0)
  return String(av ?? '').localeCompare(String(bv ?? ''))
}

// ── helpers ──
function scalarText(v: RawValue): string {
  if (v.k === 'scalar') return v.v
  if (v.k === 'list') return v.v[0] ?? ''
  return v.from ?? v.to ?? ''
}

/** Coerce a money/number string to a number, handling currency, EN/IT separators, +/- bound suffix. */
export function coerceNumber(input: string): { n: number; bound?: 'gte' | 'lte' } {
  let s = input.trim().replace(/[€$\s]/g, '')
  let bound: 'gte' | 'lte' | undefined
  if (s.endsWith('+')) { bound = 'gte'; s = s.slice(0, -1) }
  else if (s.endsWith('-')) { bound = 'lte'; s = s.slice(0, -1) }
  // decimal separator = the last '.' or ',' present; the other is a thousands sep
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ','
    const thou = dec === '.' ? ',' : '.'
    s = s.split(thou).join('').replace(dec, '.')
  } else if (lastComma >= 0) {
    // only commas: decimal if it looks like ,dd at the end, else thousands
    s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.split(',').join('')
  }
  const n = Number(s)
  return { n: Number.isNaN(n) ? 0 : n, ...(bound ? { bound } : {}) }
}
