// Natural-language → query DSL (Phase 7 / N1, N3). Per the spec, the LLM is just another *emitter*
// of the one query representation: it returns a serialized DSL string, which flows through the
// existing parse → resolve → pills pipeline unchanged. This module is provider-agnostic and PURE —
// it builds the prompt from the entity schema and validates the model's output. The transport
// (which LLM, called from where) lives in a separate composable. See spec §N (LLM/MCP).
import type { EntitySchema } from './schema.js'
import { DATE_PRESETS } from './dates'
import type { Node } from './ast'
import { parse } from './parse'
import { resolve } from './resolve'
import { serialize } from './serialize'
import { resolveField } from './schema.js'

export interface NlMessages { system: string; user: string }
export interface DslValidation { dsl: string; unknownFields: string[] }

const FACET_CAP = 40

/** Compact, model-friendly description of one field: id, type, enum values, observed values from
 *  the data (for fields without a fixed enumOrder, so the model uses REAL values e.g. "DE" not
 *  "Germany"), and typable aliases. */
function describeField(f: EntitySchema['fields'][number], facets: Record<string, string[]>): string {
  const parts = [`${f.id} (${f.type})`]
  if (f.enumOrder?.length) parts.push(`values: ${f.enumOrder.join(', ')}`)
  else {
    const vals = facets[f.id]
    if (vals?.length && (f.type === 'enum' || f.type === 'entity')) {
      parts.push(`values: ${vals.slice(0, FACET_CAP).join(', ')}${vals.length > FACET_CAP ? ', …' : ''}`)
    }
  }
  if (f.aliases?.length) parts.push(`aka: ${f.aliases.join(', ')}`)
  return `- ${parts.join('  ·  ')}`
}

/** The DSL grammar + this entity's fields + date vocabulary, as a system prompt. `facets` (field id
 *  → observed values) lets the model use the data's real categorical values. */
export function describeSchemaForPrompt(schema: EntitySchema, now: Date = new Date(), facets: Record<string, string[]> = {}): string {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const fields = schema.fields.map((f) => describeField(f, facets)).join('\n')
  const presets = DATE_PRESETS.map((p) => p.token).join(', ')
  return [
    `You translate a natural-language request into a single-line query in this search DSL for the "${schema.entity}" list. Output ONLY the query — no markdown, no quotes around the whole line, no explanation.`,
    '',
    'GRAMMAR:',
    '- A filter is field:value (equality). Negate with field:!value.',
    '- Comparisons: field:>n  field:>=n  field:<n  field:<=n. Range: field:min..max.',
    '- Multiple values for one field (OR): field:[a,b,c].',
    '- Quote values with spaces: field:"ACME Srl".',
    '- Combine filters with a space (AND) or OR; group with parentheses; negate a term with a leading -.',
    '- Free text (matches names/codes): a bare word or a "quoted phrase".',
    '- Sort: sort:field or sort:field:desc. Group: group:field. Show/hide a column: show:field / hide:field.',
    '',
    `DATES: today is ${today}. Use ISO (2026-01-15, 2026-01, 2026), quarters (Q1/2026), or a rolling preset: ${presets}.`,
    '',
    'FIELDS (use the canonical id; values for enums must be exactly as listed):',
    fields,
    '',
    'Prefer the canonical enum value. If the request maps to no filter, return an empty line.',
  ].join('\n')
}

/** Build the {system, user} messages. `currentDsl` (N3) lets the model REFINE an existing query;
 *  `facets` supplies the data's real categorical values for fields without a fixed enumOrder. */
export function buildNlPrompt(schema: EntitySchema, nlQuery: string, opts: { currentDsl?: string; now?: Date; facets?: Record<string, string[]> } = {}): NlMessages {
  const system = describeSchemaForPrompt(schema, opts.now, opts.facets)
  const user = opts.currentDsl
    ? `Current query: ${opts.currentDsl}\nAdjust it to: ${nlQuery}`
    : nlQuery
  return { system, user }
}

/** Pull the DSL line out of a raw model response: strip code fences / a leading "Query:" label /
 *  wrapping quotes, and take the first non-empty line. */
export function extractDsl(text: string): string {
  let t = (text ?? '').trim()
  // strip a fenced block ```...```
  const fence = t.match(/```[a-z]*\n?([\s\S]*?)```/i)
  if (fence) t = fence[1]!.trim()
  // first non-empty line
  t = t.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? ''
  t = t.replace(/^(query|dsl|result)\s*[:=]\s*/i, '').trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('`') && t.endsWith('`'))) t = t.slice(1, -1).trim()
  return t
}

/** Field ids referenced by a where-node (predicates), recursively. */
function whereFields(n: Node | null, out: Set<string>): void {
  if (!n) return
  if (n.t === 'pred') out.add(n.field)
  else if (n.t === 'not') whereFields(n.node, out)
  else if (n.t === 'and' || n.t === 'or') n.nodes.forEach((c) => whereFields(c, out))
}

/**
 * Round-trip the model's DSL through parse → resolve → serialize to canonicalise it, and flag any
 * predicate / sort / group field that does NOT resolve to a schema field (a likely hallucination —
 * the caller can warn or drop). `show:`/`hide:` reference column keys, not schema fields, so they're
 * not validated here. Returns `{ dsl: '' }` for empty/whitespace input.
 */
export function validateDsl(rawDsl: string, schema: EntitySchema, now: Date = new Date()): DslValidation {
  const dsl = (rawDsl ?? '').trim()
  if (!dsl) return { dsl: '', unknownFields: [] }
  const ast = resolve(parse(dsl).ast, schema, now)
  const fields = new Set<string>()
  whereFields(ast.where, fields)
  ast.sort.forEach((s) => fields.add(s.field))
  ast.groupBy.forEach((g) => fields.add(g.field))
  const unknownFields = [...fields].filter((f) => !resolveField(schema, f))
  return { dsl: serialize(ast), unknownFields }
}
