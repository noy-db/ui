// Natural-language date resolver (C2), EN+IT. Hand-rolled (no chrono-node: 18 KB, only partial
// Italian, no business periods). Returns an inclusive ISO {from,to} range or null when the input
// is not a date phrase. evaluate.ts applies the range per comparison op (eq=within, lt=<from,
// gt=>to, …). All math uses local Y/M/D so a fixed `now` makes it deterministic in tests.
import { normalizeTerm } from './synonyms.js'

interface DateRange { from: string; to: string }

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m1: number, d: number) => `${y}-${pad(m1)}-${pad(d)}`
const lastDayOfMonth = (y: number, m1: number) => new Date(y, m1, 0).getDate() // m1 = 1-based
const monthRange = (y: number, m1: number): DateRange => ({ from: iso(y, m1, 1), to: iso(y, m1, lastDayOfMonth(y, m1)) })
const yearRange = (y: number): DateRange => ({ from: iso(y, 1, 1), to: iso(y, 12, 31) })
const quarterRange = (y: number, q: number): DateRange => ({ from: iso(y, (q - 1) * 3 + 1, 1), to: iso(y, q * 3, lastDayOfMonth(y, q * 3)) })
const halfRange = (y: number, h: number): DateRange => (h === 1 ? { from: iso(y, 1, 1), to: iso(y, 6, 30) } : { from: iso(y, 7, 1), to: iso(y, 12, 31) })

function fromDate(d: Date): string { return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()) }
function shiftDays(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n) }

export function resolveDate(input: string, now: Date = new Date()): DateRange | null {
  const raw = input.trim()
  const y = now.getFullYear()
  const m1 = now.getMonth() + 1 // 1-based
  const curQ = Math.floor((m1 - 1) / 3) + 1

  // explicit ISO forms first
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { from: raw, to: raw }
  if (/^\d{4}-\d{2}$/.test(raw)) { const [yy, mm] = raw.split('-').map(Number); return monthRange(yy!, mm!) }
  if (/^\d{4}$/.test(raw)) { const yy = Number(raw); if (yy >= 1900 && yy <= 2099) return yearRange(yy) }

  // quarter / half (optional /year)
  const q = raw.match(/^Q([1-4])(?:\/(\d{4}))?$/i)
  if (q) return quarterRange(q[2] ? Number(q[2]) : y, Number(q[1]))
  const h = raw.match(/^H([1-2])(?:\/(\d{4}))?$/i)
  if (h) return halfRange(h[2] ? Number(h[2]) : y, Number(h[1]))

  // Canonical rolling tokens are hyphenated (last-30-days, this-year) so they survive as ONE token
  // through the tokenizer and the path-based URL; normalize hyphens to spaces for keyword matching.
  // (ISO dates were already handled above on `raw`, so their hyphens are untouched.)
  const n = normalizeTerm(raw).replace(/-/g, ' ').replace(/\s+/g, ' ').trim()

  // last N days / ultimi N giorni  (also "N days", "N giorni")
  const days = n.match(/(?:last|ultimi|ultime)?\s*(\d+)\s*(?:days?|giorni|gg)$/)
  if (days) { const k = Number(days[1]); return { from: fromDate(shiftDays(now, -k)), to: fromDate(now) } }
  if (n === 'week' || n === 'settimana') return { from: fromDate(shiftDays(now, -7)), to: fromDate(now) }

  switch (n) {
    // "recent" — a 3-whole-month rolling window: from the 1st of the month three months back,
    // through today (e.g. on 2026-06-16 → 2026-03-01 … 2026-06-16). The default view scope.
    case 'recent': case 'recente': case 'recenti': {
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      return { from: fromDate(start), to: fromDate(now) }
    }
    case 'today': case 'oggi': return { from: fromDate(now), to: fromDate(now) }
    case 'yesterday': case 'ieri': { const d = shiftDays(now, -1); return { from: fromDate(d), to: fromDate(d) } }
    case 'this month': case 'questo mese': case 'mese corrente': return monthRange(y, m1)
    case 'last month': case 'mese scorso': case 'scorso mese': return m1 === 1 ? monthRange(y - 1, 12) : monthRange(y, m1 - 1)
    case 'this year': case "quest'anno": case 'questo anno': case 'anno corrente': return yearRange(y)
    case 'last year': case 'anno scorso': case 'scorso anno': return yearRange(y - 1)
    case 'this quarter': case 'questo trimestre': case 'trimestre corrente': return quarterRange(y, curQ)
    case 'last quarter': case 'trimestre scorso': case 'scorso trimestre':
      return curQ === 1 ? quarterRange(y - 1, 4) : quarterRange(y, curQ - 1)
    default: return null
  }
}

// ── Rolling date presets (B5 / rolling pills) ───────────────────────────────────────────────────
// Canonical, hyphenated, single-token identifiers for the relative periods offered in autocomplete.
// Stored verbatim in the AST/URL; rendered with a human label in pills; re-resolved to a concrete
// range by resolveDate at execution time (so a bookmark stays "rolling").
export interface DatePreset { token: string; label: string }
export const DATE_PRESETS: readonly DatePreset[] = [
  { token: 'today', label: 'Today' },
  { token: 'yesterday', label: 'Yesterday' },
  { token: 'last-7-days', label: 'Last 7 days' },
  { token: 'last-30-days', label: 'Last 30 days' },
  { token: 'last-90-days', label: 'Last 90 days' },
  { token: 'recent', label: 'Recent (3 months)' },
  { token: 'this-month', label: 'This month' },
  { token: 'last-month', label: 'Last month' },
  { token: 'this-quarter', label: 'This quarter' },
  { token: 'last-quarter', label: 'Last quarter' },
  { token: 'this-year', label: 'This year' },
  { token: 'last-year', label: 'Last year' },
]
const PRESET_LABELS = new Map(DATE_PRESETS.map((p) => [p.token, p.label]))

/** Canonical hyphenated token for a date value ("last 30 days" → "last-30-days"); ISO/year as-is. */
export function canonicalDateToken(value: string): string {
  const key = normalizeTerm(value).replace(/\s+/g, '-')
  return PRESET_LABELS.has(key) || /^last-\d+-days$/.test(key) ? key : value.trim()
}

/** Human label for a date value/token ("last-30-days" → "Last 30 days"); ISO/year shown as typed. */
export function dateLabel(value: string): string {
  const key = normalizeTerm(value).replace(/\s+/g, '-')
  if (PRESET_LABELS.has(key)) return PRESET_LABELS.get(key)!
  const m = key.match(/^last-(\d+)-days$/)
  return m ? `Last ${m[1]} days` : value.trim()
}

const ABSOLUTE_DATE_RE = /^(\d{4}-\d{2}-\d{2}|\d{4}-\d{2}|\d{4}|[QH][1-4]\/\d{4})$/i

/** True if the value re-resolves relative to "now" (rolling), vs an absolute date/year/quarter. */
export function isRollingDate(value: string, now: Date = new Date()): boolean {
  const raw = value.trim()
  if (!raw || ABSOLUTE_DATE_RE.test(raw)) return false
  return resolveDate(raw, now) !== null
}
