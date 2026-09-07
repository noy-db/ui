// AST → fluent text (title + subtitle). The THIRD rendering of a search, alongside `pills` (terse,
// interactive) and `serialize` (canonical DSL): human prose for the window/document title, the paper
// -report header, and recent/saved-search descriptions. Deterministic and framework-free — the
// operator/connector words arrive through an injected `t`, so packages/ui keeps no i18n dependency.
//
// Two budgets from one walk: `title` is compact and length-capped (drops trailing clauses as "+N");
// `subtitle` is the full grammatical sentence. When there are no filters, group/sort become the
// subject ("Records by Genre, Label"); with filters they trail the sentence.
import type { Ast, Node, Predicate, RawValue, SortKey, GroupKey } from './ast.js'
import type { EntitySchema } from './schema.js'
import { resolveField } from './resolve-field.js'
import { dateLabel, isRollingDate } from './dates.js'

/** i18n lookup: a `nui.q.*` key and an English fallback. Defaults to the fallback (unconfigured). */
type T = (key: string, fallback?: string) => string
const DEFAULT_T: T = (_k, fb) => fb ?? _k

/** Canonical value → display name (e.g. `jazz` → "Jazz", an FK id → an entity name). Same role as
 *  `useCollectionList`'s `formatGroupLabel`; the AST holds canonical keys, the host owns the labels. */
type FmtValue = (field: string, value: string) => string | undefined

export interface NarrateOptions {
  t?: T
  /** Display-label resolver for enum/entity values. Omit → canonical values are shown verbatim. */
  formatValue?: FmtValue
  /** Character budget for the compact title before trailing clauses collapse to "+N". Default 60. */
  maxTitle?: number
  /** "Now" for rolling-date phrasing (isRollingDate). */
  now?: Date
}

/** Threaded render context (avoids passing t/now/fmt through every helper). */
interface Ctx { schema: EntitySchema; t: T; now: Date; fmt: FmtValue }

export interface Narration {
  /** Compact, budget-capped — for the window title and report header. */
  title: string
  /** Full grammatical sentence — for the subtitle, tooltip, and recent/saved descriptions. */
  subtitle: string
}

/** A rendered criterion in both registers. */
interface Clause { title: string; sentence: string }

// ── joiners ──────────────────────────────────────────────────────────────────
/** Title list: "A & B", capped at 2 then "+N". */
function joinAmp(vals: string[]): string {
  return vals.length <= 2 ? vals.join(' & ') : `${vals.slice(0, 2).join(' & ')} +${vals.length - 2}`
}
/** Sentence list: "A, B or C". */
function joinOr(vals: string[], t: T): string {
  if (vals.length <= 1) return vals[0] ?? ''
  return `${vals.slice(0, -1).join(', ')} ${t('nui.q.or', 'or')} ${vals[vals.length - 1]}`
}
/** Sentence clauses: "A, B and C". */
function joinAnd(parts: string[], t: T): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} ${t('nui.q.and', 'and')} ${parts[parts.length - 1]}`
}

const label = (schema: EntitySchema, id: string) => resolveField(schema, id)?.label ?? id
const rawValues = (v: RawValue): string[] => (v.k === 'scalar' ? [v.v] : v.k === 'list' ? v.v : [])
/** Value list mapped through the host's display-label resolver (enum/entity display names). */
const values = (c: Ctx, field: string, v: RawValue): string[] =>
  rawValues(v).map((x) => c.fmt(field, x) ?? x)

// ── per-type phrasing ────────────────────────────────────────────────────────
function numPhrase(op: Predicate['op'], v: string, t: T): Clause {
  switch (op) {
    case 'gt':  return { title: `>${v}`,  sentence: `${t('nui.q.over', 'over')} ${v}` }
    case 'gte': return { title: `≥${v}`,  sentence: `${t('nui.q.atLeast', 'at least')} ${v}` }
    case 'lt':  return { title: `<${v}`,  sentence: `${t('nui.q.under', 'under')} ${v}` }
    case 'lte': return { title: `≤${v}`,  sentence: `${t('nui.q.atMost', 'at most')} ${v}` }
    case 'ne':  return { title: `≠${v}`,  sentence: `${t('nui.q.not', 'not')} ${v}` }
    default:    return { title: v, sentence: v }
  }
}

function datePhrase(op: Predicate['op'], token: string, t: T, now: Date): Clause {
  const lbl = dateLabel(token)
  switch (op) {
    case 'gt': case 'gte': return { title: `${t('nui.q.since', 'since')} ${lbl}`, sentence: `${t('nui.q.since', 'since')} ${lbl}` }
    case 'lt': case 'lte': return { title: `${t('nui.q.before', 'before')} ${lbl}`, sentence: `${t('nui.q.before', 'before')} ${lbl}` }
    default:
      // eq: rolling reads as its own phrase ("Last 30 days"); absolute needs "in" ("in 1990").
      return isRollingDate(token, now) ? { title: lbl, sentence: lbl } : { title: lbl, sentence: `${t('nui.q.in', 'in')} ${lbl}` }
  }
}

function predClause(c: Ctx, p: Predicate): Clause {
  const { t } = c
  const lab = label(c.schema, p.field)
  const type = resolveField(c.schema, p.field)?.type
  const v = p.value

  // Money/number values also route through the host's formatter (e.g. price "50" → "$50").
  const fv = (x: string) => c.fmt(p.field, x) ?? x

  if (v.k === 'range') {
    const from = v.from ? fv(v.from) : null
    const to = v.to ? fv(v.to) : null
    const sentence = from && to ? `${t('nui.q.between', 'between')} ${from} ${t('nui.q.and', 'and')} ${to}`
      : from ? `${t('nui.q.from', 'from')} ${from}` : `${t('nui.q.upTo', 'up to')} ${to}`
    const title = from && to ? `${from}–${to}` : from ? `≥${from}` : `≤${to}`
    return { title: `${lab} ${title}`, sentence: `${lab} ${sentence}` }
  }

  if (type === 'date') {
    const ph = datePhrase(p.op, v.k === 'scalar' ? v.v : '', t, c.now)
    return { title: ph.title, sentence: `${lab} ${ph.sentence}` }
  }

  if (type === 'money' || type === 'number') {
    if (v.k === 'list') { const xs = v.v.map(fv); return { title: `${lab} ${joinAmp(xs)}`, sentence: `${lab} ${joinOr(xs, t)}` } }
    const ph = numPhrase(p.op, v.k === 'scalar' ? fv(v.v) : '', t)
    return { title: `${lab} ${ph.title}`, sentence: `${lab} ${ph.sentence}` }
  }

  // Boolean reads as the bare label — 'Favorite', not the robotic 'Favorite “true”'.
  if (type === 'boolean') {
    const truthy = v.k === 'scalar' && /^(true|yes|1)$/i.test(v.v)
    const on = p.op === 'ne' ? !truthy : truthy
    const phrase = on ? lab : `${t('nui.q.not', 'not')} ${lab}`
    return { title: phrase, sentence: phrase }
  }

  // categorical: enum / entity / text
  if (type === 'text') {
    // Field-scoped text search keeps its field name ('Artist “No”') — bare 'matching' is only for
    // free-text terms (TextNode). Losing the label here made `artist_name:No` read as just “No”.
    const term = rawValues(v).join(' ')
    return { title: `${lab} “${term}”`, sentence: `${lab} ${t('nui.q.matching', 'matching')} “${term}”` }
  }
  const vals = values(c, p.field, v)
  if (p.op === 'ne') {
    return { title: `${t('nui.q.not', 'not')} ${joinAmp(vals)}`, sentence: `${lab} ${t('nui.q.notColon', 'not')} ${joinOr(vals, t)}` }
  }
  // eq/in: value-forward title ("Jazz & Funk"); labelled sentence ("Genre Jazz or Funk").
  return { title: joinAmp(vals), sentence: `${lab} ${joinOr(vals, t)}` }
}

function nodeClause(c: Ctx, n: Node): Clause {
  const { t } = c
  switch (n.t) {
    case 'pred': return predClause(c, n)
    case 'text': return { title: `“${n.value}”`, sentence: `${t('nui.q.matching', 'matching')} “${n.value}”` }
    case 'not': {
      const inner = nodeClause(c, n.node)
      return { title: `${t('nui.q.not', 'not')} ${inner.title}`, sentence: `${t('nui.q.not', 'not')} ${inner.sentence}` }
    }
    case 'and': {
      const cs = n.nodes.map((x) => nodeClause(c, x))
      return { title: cs.map((x) => x.title).join(' · '), sentence: joinAnd(cs.map((x) => x.sentence), t) }
    }
    case 'or': {
      const cs = n.nodes.map((x) => nodeClause(c, x))
      const or = ` ${t('nui.q.or', 'or')} `
      return { title: cs.map((x) => x.title).join(or), sentence: `${t('nui.q.either', 'either')} ${cs.map((x) => x.sentence).join(or)}` }
    }
  }
}

/** Top-level where → a clause LIST (an AND's conjuncts split, so the title can drop trailing ones). */
function whereClauses(c: Ctx, where: Node | null): Clause[] {
  if (!where) return []
  return where.t === 'and' ? where.nodes.map((x) => nodeClause(c, x)) : [nodeClause(c, where)]
}

function sortPhrase(c: Ctx, sort: readonly SortKey[]): Clause | null {
  if (!sort.length) return null
  const { t } = c
  const parts = sort.map((s) => {
    const lab = label(c.schema, s.field)
    return {
      title: `${lab} ${s.dir === 'desc' ? '↓' : '↑'}`,
      sentence: `${lab} (${s.dir === 'desc' ? t('nui.q.descending', 'descending') : t('nui.q.ascending', 'ascending')})`,
    }
  })
  return {
    title: parts.map((p) => p.title).join(', '),
    sentence: `${t('nui.q.sortedBy', 'sorted by')} ${joinAnd(parts.map((p) => p.sentence), t)}`,
  }
}

function groupPhrase(c: Ctx, groupBy: readonly GroupKey[]): Clause | null {
  if (!groupBy.length) return null
  // Dedupe identical labels: two field ids can name one dimension (labelId + label_name → "Label"),
  // and "by Label, Label" is never useful text.
  const labels = [...new Set(groupBy.map((g) => label(c.schema, g.field)))]
  return { title: labels.join(', '), sentence: `${c.t('nui.q.groupedBy', 'grouped by')} ${joinAnd(labels, c.t)}` }
}

/** The collection's display noun. Host localizes via `nui.q.noun.<entity>`; fallback title-cases it. */
function noun(schema: EntitySchema, t: T): string {
  const e = schema.entity || 'records'
  return t(`nui.q.noun.${e}`, e.charAt(0).toUpperCase() + e.slice(1))
}

/** The empty-search title. Host localizes per entity (`nui.q.all.<entity>`, e.g. "แผ่นเสียงทั้งหมด")
 *  or generically (`nui.q.all`); fallback composes English from the noun. */
function allTitle(schema: EntitySchema, t: T, N: string): string {
  const e = schema.entity || 'records'
  return t(`nui.q.all.${e}`, t('nui.q.all', `All ${N.toLowerCase()}`))
}

/** Join title parts, dropping trailing ones past the budget as "+N". */
function budgetJoin(parts: string[], max: number, sep: string): string {
  if (parts.join(sep).length <= max) return parts.join(sep)
  const kept: string[] = []
  for (const s of parts) {
    if (kept.length && [...kept, s].join(sep).length > max) break
    kept.push(s)
  }
  const dropped = parts.length - kept.length
  return dropped > 0 ? `${kept.join(sep)} +${dropped}` : kept.join(sep)
}

/**
 * Render a resolved search as a compact `title` and a full `subtitle` sentence.
 * `ast` is the resolved AST (from `resolve(parse(query).ast, schema)`, e.g. `useCollectionList().ast`).
 */
export function narrate(ast: Ast, schema: EntitySchema, opts: NarrateOptions = {}): Narration {
  const t = opts.t ?? DEFAULT_T
  const c: Ctx = { schema, t, now: opts.now ?? new Date(), fmt: opts.formatValue ?? (() => undefined) }
  const max = opts.maxTitle ?? 60

  const N = noun(schema, t)
  const clauses = whereClauses(c, ast.where)
  const group = groupPhrase(c, ast.groupBy)
  const sort = sortPhrase(c, ast.sort)
  // Pure free-text filters read as "Records with «term»"; any structured predicate keeps the neutral
  // "Records: …" colon (a global "with" would break clauses like "since 2020" / "Year ≥1990").
  const topNodes = ast.where ? (ast.where.t === 'and' ? ast.where.nodes : [ast.where]) : []
  const allText = topNodes.length > 0 && topNodes.every((n) => n.t === 'text')

  // ── title ──
  // Filters, group and sort all survive. Group/sort get a preposition ("by Genre", "sorted by Year
  // ↓"). When a filter is combined with a group/sort, the noun leads ("Records: Jazz, by Genre") so
  // the parts don't run together; a bare filter stays compact ("Jazz & Funk"); group/sort alone lead
  // with the noun as the subject ("Records by Genre").
  const filterTitles = clauses.map((cl) => cl.title)
  const tail: string[] = []
  if (group) tail.push(`${t('nui.q.by', 'by')} ${group.title}`)
  if (sort) tail.push(`${t('nui.q.sortedBy', 'sorted by')} ${sort.title}`)

  let title: string
  if (filterTitles.length) {
    const lead = allText ? `${N} ${t('nui.q.with', 'with')} ` : `${N}: `
    title = `${lead}${budgetJoin([...filterTitles, ...tail], max - lead.length, ', ')}`
  } else if (tail.length) title = `${N} ${tail.join(', ')}`
  else title = allTitle(schema, t, N)

  // ── subtitle ──
  const segs: string[] = []
  if (clauses.length) segs.push(joinAnd(clauses.map((c) => c.sentence), t))
  if (group) segs.push(group.sentence)
  if (sort) segs.push(sort.sentence)
  let subtitle: string
  if (!segs.length) subtitle = allTitle(schema, t, N)
  else if (clauses.length) subtitle = `${N}: ${segs.join('; ')}`
  else subtitle = `${N} ${segs.join('; ')}` // group/sort-lead

  return { title, subtitle }
}
