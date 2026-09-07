// Resolve a syntactic AST into a canonical one (A4): field aliases → canonical ids, enum value
// synonyms → canonical values, and bare free-text terms UPGRADED to predicates when they
// unambiguously match the schema (a date phrase → the date field; a known enum value → its enum
// field). Ambiguous or unknown barewords stay free text — the search-box does two-step
// disambiguation in the UI. Quoted literals are never upgraded. See spec §3.1 / D3.
import type { Ast, Node, Predicate, RawValue } from './ast'
import { resolveDate } from './dates'
import { resolveField, type EntitySchema, type FieldDef } from './schema'
import { resolveSynonym } from './synonyms'

export function resolve(ast: Ast, schema: EntitySchema, now: Date = new Date()): Ast {
  // Resolve sort/group field aliases to canonical ids (e.g. sort:buyer → buyerName) so the header
  // highlight, pills, and URL all agree with what evaluate sorts on.
  const fieldId = (f: string) => resolveField(schema, f)?.id ?? f
  // Collapse duplicate sort/group/view keys (keep the FIRST occurrence — its position is the
  // priority/nesting level). A duplicate sort field can never affect ordering (equal on the first
  // key ⇒ equal on its duplicate) and a duplicate group field only nests singleton groups; typed
  // duplicates otherwise linger as identical pills.
  const dedupe = <T,>(arr: T[], key: (x: T) => string): T[] => {
    const seen = new Set<string>()
    return arr.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)))
  }
  return {
    where: ast.where ? resolveNode(ast.where, schema, now) : null,
    sort: dedupe(ast.sort.map((s) => ({ ...s, field: fieldId(s.field) })), (s) => s.field),
    groupBy: dedupe(ast.groupBy.map((g) => ({ ...g, field: fieldId(g.field) })), (g) => g.field),
    view: ast.view
      ? { show: dedupe(ast.view.show.map(fieldId), (f) => f), hide: dedupe(ast.view.hide.map(fieldId), (f) => f) }
      : { show: [], hide: [] },
  }
}

function resolveNode(n: Node, schema: EntitySchema, now: Date): Node {
  switch (n.t) {
    case 'and': { const m = mergeSameField(n.nodes.map((c) => resolveNode(c, schema, now))); return m.length === 1 ? m[0]! : { t: 'and', nodes: m } }
    case 'or': return { t: 'or', nodes: n.nodes.map((c) => resolveNode(c, schema, now)) }
    case 'not': return { t: 'not', node: resolveNode(n.node, schema, now) }
    case 'pred': return resolvePred(n, schema)
    case 'text': return n.literal ? n : (upgradeBare(n.value, schema, now) ?? n)
  }
}

/**
 * Faceted-search semantics: multiple equality filters on the SAME field are OR (Globex OR Umbrella),
 * not AND (which would always match nothing). Merge sibling eq/in predicates per field into one `in`
 * list; comparisons (>, <, range, ne) and other fields stay AND-ed. Order of first appearance kept.
 */
function mergeSameField(nodes: Node[]): Node[] {
  const isEqIn = (n: Node): n is Predicate =>
    n.t === 'pred' && (n.op === 'eq' || n.op === 'in') && (n.value.k === 'scalar' || n.value.k === 'list')
  const values = new Map<string, string[]>()
  for (const n of nodes) {
    if (!isEqIn(n)) continue
    const vs = n.value.k === 'list' ? n.value.v : [(n.value as { v: string }).v]
    values.set(n.field, [...(values.get(n.field) ?? []), ...vs])
  }
  const emitted = new Set<string>()
  const out: Node[] = []
  for (const n of nodes) {
    if (!isEqIn(n)) { out.push(n); continue }
    if (emitted.has(n.field)) continue
    emitted.add(n.field)
    const v = [...new Set(values.get(n.field)!)]
    out.push(v.length === 1
      ? { t: 'pred', field: n.field, op: 'eq', value: { k: 'scalar', v: v[0]! } }
      : { t: 'pred', field: n.field, op: 'in', value: { k: 'list', v } })
  }
  return out
}

function resolvePred(p: Predicate, schema: EntitySchema): Predicate {
  const field = resolveField(schema, p.field)
  if (!field) return p
  return { ...p, field: field.id, value: canonicalizeValue(p.value, field, schema) }
}

function canonicalizeValue(v: RawValue, field: FieldDef, schema: EntitySchema): RawValue {
  if (field.type !== 'enum') return v
  const map = (s: string) => resolveSynonym(schema.entity, field.id, s)
  if (v.k === 'scalar') return { k: 'scalar', v: map(v.v) }
  if (v.k === 'list') return { k: 'list', v: v.v.map(map) }
  return v
}

/** Try to turn a bare word into a predicate; returns null to keep it as free text. */
function upgradeBare(value: string, schema: EntitySchema, now: Date): Predicate | null {
  // 1) date phrase → the date field
  const dateField = schema.fields.find((f) => f.type === 'date')
  if (dateField && resolveDate(value, now)) {
    return { t: 'pred', field: dateField.id, op: 'eq', value: { k: 'scalar', v: value } }
  }
  // 2) a known enum value (synonym-resolved into the field's order) → that enum field
  for (const f of schema.fields) {
    if (f.type !== 'enum' || !f.enumOrder) continue
    const canon = resolveSynonym(schema.entity, f.id, value)
    if (f.enumOrder.includes(canon)) {
      return { t: 'pred', field: f.id, op: 'eq', value: { k: 'scalar', v: canon } }
    }
  }
  return null
}
