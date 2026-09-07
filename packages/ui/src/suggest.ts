// Autocomplete engine (B2). Given the trailing draft text, the schema, and dataset facet values,
// it produces ranked token suggestions. Two-step disambiguation (D3): a bare word offers both a
// free-text fallback AND field/value chips; the user picks. A `field:partial` draft suggests
// values for that field. Each suggestion carries the `token` to splice into the query.
// See docs/unified-search-and-data-cube-spec.md §3 (B2).
import { resolveField, type EntitySchema, type FieldDef } from './schema.js'
import { normalizeTerm, resolveSynonym, synonymCanonicals } from './synonyms.js'
import { resolveDate, canonicalDateToken, dateLabel, DATE_PRESETS } from './dates'

export interface Suggestion {
  label: string
  hint?: string
  token: string
  /** Field-only suggestion: keep typing the value after committing (two-step). */
  caretAfter?: 'value'
}

/** Canonical value → display name (same resolver as pills/narrate). Labels only — tokens stay canonical. */
export type SuggestFmtValue = (field: string, value: string) => string | undefined

/** Host translator for the structural label words (Sort/Group by/Search/not). Omit → English. */
type T = (key: string, fallback?: string) => string
const EN: T = (_key, fallback) => fallback ?? _key

/** Minimal column shape for show:/hide: suggestions (so derived columns are offered too). */
export interface ColumnRef { key: string; label: string }

const MAX = 8
const needsQuote = (s: string) => /[\s()[\],"]/.test(s)
const tok = (s: string) => (needsQuote(s) ? `"${s.replace(/"/g, '\\"')}"` : s)
/** Human token for a field prefix: the display label when it survives as one DSL word ("Artist:"),
 *  else the id. resolveField matches labels, so the labelled form round-trips. */
const fieldTok = (f: FieldDef) => (/^[\p{L}\p{N}_-]+$/u.test(f.label) ? f.label : f.id)

function valueSuggestionsFor(field: FieldDef, partial: string, schema: EntitySchema, facets: Record<string, string[]>, fmt?: SuggestFmtValue, t: T = EN): Suggestion[] {
  const p = normalizeTerm(partial)
  const disp = (v: string) => fmt?.(field.id, v) ?? v // display label; the TOKEN stays canonical
  const out: Suggestion[] = []
  if (field.type === 'boolean') {
    // On/off in the same language as the pills: "Favorite" / "not Favorite".
    for (const o of [{ v: 'true', l: field.label }, { v: 'false', l: `${t('nui.q.not', 'not')} ${field.label}` }]) {
      if (!p || normalizeTerm(o.l).includes(p) || normalizeTerm(o.v).includes(p)) out.push({ label: o.l, hint: 'filter', token: `${field.id}:${o.v}` })
    }
    return out
  }
  if (field.type === 'enum') {
    const values = field.enumOrder ? [...field.enumOrder] : (facets[field.id] ?? [])
    for (const v of values) if (!p || normalizeTerm(v).includes(p) || normalizeTerm(disp(v)).includes(p)) out.push({ label: `${field.label}: ${disp(v)}`, hint: 'filter', token: `${field.id}:${tok(v)}` })
  } else {
    for (const v of facets[field.id] ?? []) if (!p || normalizeTerm(v).includes(p)) out.push({ label: `${field.label}: ${disp(v)}`, hint: 'filter', token: `${field.id}:${tok(v)}` })
  }
  return out
}

/** Rolling-period suggestions for a date field, matching the partial by token or label. */
function datePresetSuggestions(field: FieldDef, partial: string): Suggestion[] {
  const p = normalizeTerm(partial)
  const pk = p.replace(/\s+/g, '-')
  return DATE_PRESETS
    .filter((preset) => !p || preset.token.includes(pk) || normalizeTerm(preset.label).includes(p))
    .map((preset) => ({ label: `${field.label}: ${preset.label}`, hint: 'date', token: `${field.id}:${preset.token}` }))
}

/** `sort:` / `sort-by:` → each matching field as an ascending AND a descending option. If the
 *  typed text already states a direction (field-up / field-down / -asc / -desc), the MATCHING
 *  direction is offered first so committing the highlighted suggestion honours what was typed. */
function sortSuggestions(schema: EntitySchema, partial: string, t: T = EN): Suggestion[] {
  const dirMatch = partial.match(/-(up|down|asc|desc)$/i)
  const wantDown = dirMatch ? /^(down|desc)$/i.test(dirMatch[1]!) : null
  const p = normalizeTerm(partial.replace(/-(up|down|asc|desc)$/i, ''))
  const head = t('nui.pill.sort', 'Sort:')
  const out: Suggestion[] = []
  for (const f of schema.fields) {
    const names = [f.id, f.label, ...(f.aliases ?? [])].map(normalizeTerm)
    if (p && !names.some((x) => x.includes(p))) continue
    const up: Suggestion = { label: `${head} ${f.label} ↑`, hint: 'a→z', token: `sort:${f.id}-up` }
    const down: Suggestion = { label: `${head} ${f.label} ↓`, hint: 'z→a', token: `sort:${f.id}-down` }
    out.push(...(wantDown === true ? [down, up] : wantDown === false ? [up, down] : [up, down]))
  }
  return out
}

/** `group:` / `group-by:` → each matching groupable field (enum/entity make the most sense). */
function groupSuggestions(schema: EntitySchema, partial: string, t: T = EN): Suggestion[] {
  const p = normalizeTerm(partial)
  const out: Suggestion[] = []
  for (const f of schema.fields) {
    if (f.type !== 'enum' && f.type !== 'entity') continue
    const names = [f.id, f.label, ...(f.aliases ?? [])].map(normalizeTerm)
    if (p && !names.some((x) => x.includes(p))) continue
    out.push({ label: `${t('nui.group.title', 'Group by')} ${f.label}`, hint: 'group', token: `group:${f.id}` })
  }
  return out
}

/** `show:` / `hide:` → force a column visible / hidden regardless of width (R5). Offers the actual
 *  COLUMNS when provided (so derived columns like `outstanding` are suggested), else schema fields. */
function viewSuggestions(schema: EntitySchema, columns: ColumnRef[], partial: string, kind: 'show' | 'hide', t: T = EN): Suggestion[] {
  const p = normalizeTerm(partial)
  const src = columns.length
    ? columns.map((c) => ({ id: c.key, label: c.label, names: [c.key, c.label] }))
    : schema.fields.map((f) => ({ id: f.id, label: f.label, names: [f.id, f.label, ...(f.aliases ?? [])] }))
  const word = kind === 'show' ? t('nui.sug.show', 'Show') : t('nui.sug.hide', 'Hide')
  const out: Suggestion[] = []
  for (const s of src) {
    if (p && !s.names.map(normalizeTerm).some((x) => x.includes(p))) continue
    out.push({ label: `${word} ${s.label}`, hint: kind, token: `${kind}:${s.id}` })
  }
  return out
}

export function buildSuggestions(
  draft: string,
  schema: EntitySchema,
  facets: Record<string, string[]> = {},
  now: Date = new Date(),
  columns: ColumnRef[] = [],
  fmt?: SuggestFmtValue,
  t: T = EN,
): Suggestion[] {
  const d = draft.trim()
  if (!d) return []
  const out: Suggestion[] = []

  // field:partial → value suggestions for that field
  const colon = d.indexOf(':')
  if (colon > 0) {
    const fieldName = d.slice(0, colon)
    const partial = d.slice(colon + 1)
    const cmd = normalizeTerm(fieldName)
    // sort: / sort-by: → field list × direction (up/down)
    if (cmd === 'sort' || cmd === 'sort-by' || cmd === 'sortby') {
      return sortSuggestions(schema, partial, t).slice(0, MAX)
    }
    // group: / group-by: → groupable field list
    if (cmd === 'group' || cmd === 'group-by' || cmd === 'groupby') {
      return groupSuggestions(schema, partial, t).slice(0, MAX)
    }
    // show: / hide: → force a column visible/hidden (R5)
    if (cmd === 'show' || cmd === 'hide') {
      return viewSuggestions(schema, columns, partial, cmd, t).slice(0, MAX)
    }
    const field = resolveField(schema, fieldName)
    if (field) {
      if (field.type === 'date') {
        out.push(...datePresetSuggestions(field, partial))
        if (partial && resolveDate(partial, now)) {
          const t = canonicalDateToken(partial)
          out.push({ label: `${field.label}: ${dateLabel(t)}`, hint: 'date', token: `${field.id}:${t}` })
        }
      } else {
        out.push(...valueSuggestionsFor(field, partial, schema, facets, fmt, t))
        // "As typed" pattern fallback (text-matching fields): keep the user's own partial
        // committable even when facet values also match — mirrors the bareword free-text fallback.
        // Only for a PLAIN single-value partial: quotes/brackets or a second `field:` mean the
        // draft is structured/multi-token — wrapping it whole would corrupt the query.
        const p = partial.trim()
        const plainValue = p !== '' && !/["()[\],]/.test(p) && !/\s\S+:/.test(p)
        if (plainValue && field.type === 'text' && !out.some((s) => normalizeTerm(s.label) === normalizeTerm(`${field.label}: ${p}`))) {
          out.push({ label: `${field.label}: ${p}`, hint: 'text', token: `${fieldTok(field)}:${tok(p)}` })
        }
      }
      const seen = new Set<string>()
      return out.filter((s) => (seen.has(s.token) ? false : (seen.add(s.token), true))).slice(0, MAX)
    }
  }

  const n = normalizeTerm(d)

  // field name matches → `field:` (two-step; the token shows the LABEL, not the internal id)
  for (const f of schema.fields) {
    const names = [f.id, f.label, ...(f.aliases ?? [])].map(normalizeTerm)
    if (names.some((x) => x.includes(n))) out.push({ label: `${f.label}:`, hint: 'field', token: `${fieldTok(f)}:`, caretAfter: 'value' })
  }

  // enum value matches (incl. synonyms) → field:value (display label, canonical token)
  for (const f of schema.fields) {
    if (f.type !== 'enum' || !f.enumOrder) continue
    const disp = (v: string) => fmt?.(f.id, v) ?? v
    const canon = resolveSynonym(schema.entity, f.id, d)
    const candidates = new Set<string>([...f.enumOrder, ...synonymCanonicals(schema.entity, f.id)])
    if (candidates.has(canon)) out.push({ label: `${f.label}: ${disp(canon)}`, hint: 'filter', token: `${f.id}:${tok(canon)}` })
    else for (const v of f.enumOrder) if (normalizeTerm(v).includes(n) || normalizeTerm(disp(v)).includes(n)) out.push({ label: `${f.label}: ${disp(v)}`, hint: 'filter', token: `${f.id}:${tok(v)}` })
  }

  // entity facet value matches → field:"value"
  for (const f of schema.fields) {
    if (f.type !== 'entity') continue
    for (const v of facets[f.id] ?? []) if (normalizeTerm(v).includes(n)) out.push({ label: `${f.label}: ${v}`, hint: 'filter', token: `${f.id}:${tok(v)}` })
  }

  // date phrase / rolling preset → dateField:canonical-token (friendly label, resolved at run time)
  const dateField = schema.fields.find((f) => f.type === 'date')
  if (dateField) {
    out.push(...datePresetSuggestions(dateField, d))
    if (resolveDate(d, now)) {
      const t = canonicalDateToken(d)
      out.push({ label: `${dateField.label}: ${dateLabel(t)}`, hint: 'date', token: `${dateField.id}:${t}` })
    }
  }

  // free-text fallback (always last)
  out.push({ label: `${t('nui.sug.search', 'Search')} “${d}”`, hint: 'text', token: tok(d) })

  // de-dupe by token, cap
  const seen = new Set<string>()
  return out.filter((s) => (seen.has(s.token) ? false : (seen.add(s.token), true))).slice(0, MAX)
}
