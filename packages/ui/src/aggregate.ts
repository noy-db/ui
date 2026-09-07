// Per-column aggregate for the second-header row and the group-rollup banners — one implementation
// so both agree. count → N; sum → decimal (no € symbol, the header says "Amount €"); distinct →
// open-domain count ("4 buyers"); dateRange → the SPAN IN DAYS between first and last date
// ("45 days", with the from→to range as a tooltip); range → a 2-value span ("1952–1989", or the
// year span for dates); stats → min/middle/max with the central value bracketed ("12‹31›47", middle
// = avg or median); boolTrue → count of truthy rows ("7 ★"). `numeric` drives right-alignment.
import { formatAmount } from './format'

export interface AggregateColumn {
  key: string
  aggregate?: 'count' | 'sum' | 'distinct' | 'dateRange' | 'range' | 'stats' | 'avg' | 'boolTrue'
  aggregateNoun?: string
  amountOf?: (r: Record<string, any>) => number
  formatSum?: (n: number) => string
  enumOf?: (r: Record<string, any>) => string | null | undefined
  dateOf?: (r: Record<string, any>) => string | null | undefined
  /** Truthiness reader for the 'boolTrue' aggregate (default: Boolean(row[key])). */
  boolOf?: (r: Record<string, any>) => boolean
  /** Central value for 'stats' — the bracketed middle of min‹mid›max. Default 'avg'. */
  statMiddle?: 'avg' | 'median'
  /** Format each number in 'range'/'stats' (default: rounded integer). */
  formatNum?: (n: number) => string
  /** Format a 'range' low/high pair as one string (e.g. years → "1986–99"), used when lo ≠ hi. */
  formatRange?: (lo: number, hi: number) => string
  /** Wrap the whole 'range'/'stats' text (e.g. prefix '$', suffix ' ★'). */
  prefix?: string
  suffix?: string
}

export interface AggregateResult { text: string; title?: string; numeric: boolean }

/** Naive English singular of a plural noun for count==1 ("buyers"→"buyer", "companies"→"company",
 *  "statuses"→"status"). Good enough for our fixed column nouns. */
export function singularize(plural: string): string {
  if (/ies$/i.test(plural)) return plural.replace(/ies$/i, 'y')
  if (/(s|x|z|ch|sh)es$/i.test(plural)) return plural.replace(/es$/i, '')
  return plural.replace(/s$/i, '')
}

/** Whole days between two ISO dates (max − min); 1/1 → 15/2 = 45. */
export function daysBetween(minISO: string, maxISO: string): number {
  const a = new Date(`${minISO}T00:00:00`).getTime()
  const b = new Date(`${maxISO}T00:00:00`).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** Median of a numeric list (mean of the two centres when even). Empty → 0. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** Collect the finite numbers a column reads from the rows. */
function numbersOf(rows: readonly Record<string, any>[], col: AggregateColumn): number[] {
  const get = col.amountOf ?? ((r: Record<string, any>) => Number(r[col.key]))
  const out: number[] = []
  for (const r of rows) { const n = get(r); if (Number.isFinite(n)) out.push(n) }
  return out
}

export function columnAggregate(rows: readonly Record<string, any>[], col: AggregateColumn): AggregateResult | null {
  switch (col.aggregate) {
    case 'count':
      return { text: String(rows.length), numeric: true }
    case 'sum': {
      const get = col.amountOf ?? ((r) => Number(r[col.key]) || 0)
      let sum = 0
      for (const r of rows) sum += get(r)
      return { text: col.formatSum ? col.formatSum(sum) : formatAmount(sum), numeric: true }
    }
    case 'distinct': {
      const get = col.enumOf ?? ((r) => r[col.key])
      const set = new Set<string>()
      for (const r of rows) { const v = get(r); if (v != null && v !== '') set.add(String(v)) }
      // Count only — the column header already says what's being counted; the noun would just clog a
      // tight row. The full "N artists" lives in the tooltip for the occasional reader.
      const noun = col.aggregateNoun ? (set.size === 1 ? singularize(col.aggregateNoun) : col.aggregateNoun) : ''
      return { text: String(set.size), title: noun ? `${set.size} ${noun}` : undefined, numeric: true }
    }
    case 'dateRange': {
      const get = col.dateOf ?? ((r) => r[col.key])
      let min = ''; let max = ''
      for (const r of rows) {
        const v = get(r); if (v == null || v === '') continue
        const s = String(v)
        if (!min || s < min) min = s
        if (!max || s > max) max = s
      }
      if (!min) return null
      const d = daysBetween(min, max)
      return { text: `${d} ${d === 1 ? 'day' : 'days'}`, title: `${min} → ${max}`, numeric: true }
    }
    case 'range': {
      // Dates (dateOf set) → year span; numbers → min–max via formatNum.
      if (col.dateOf) {
        const get = col.dateOf
        let min = ''; let max = ''
        for (const r of rows) {
          const v = get(r); if (v == null || v === '') continue
          const s = String(v)
          if (!min || s < min) min = s
          if (!max || s > max) max = s
        }
        if (!min) return null
        const yr = (iso: string) => iso.slice(0, 4)
        const text = yr(min) === yr(max) ? yr(min) : `${yr(min)}–${yr(max)}`
        return { text: `${col.prefix ?? ''}${text}${col.suffix ?? ''}`, title: `${min} → ${max}`, numeric: true }
      }
      const ns = numbersOf(rows, col)
      if (ns.length === 0) return null
      const fmt = col.formatNum ?? ((n: number) => String(Math.round(n)))
      const lo = Math.min(...ns); const hi = Math.max(...ns)
      // formatRange lets a column render a compact pair (e.g. years "1986–99"); else min–max via formatNum.
      const span = lo === hi ? fmt(lo) : (col.formatRange ? col.formatRange(lo, hi) : `${fmt(lo)}–${fmt(hi)}`)
      return { text: `${col.prefix ?? ''}${span}${col.suffix ?? ''}`, numeric: true }
    }
    case 'stats': {
      const ns = numbersOf(rows, col)
      if (ns.length === 0) return null
      const fmt = col.formatNum ?? ((n: number) => String(Math.round(n)))
      const lo = Math.min(...ns); const hi = Math.max(...ns)
      const midKind = col.statMiddle ?? 'avg'
      const mid = midKind === 'median' ? median(ns) : ns.reduce((a, b) => a + b, 0) / ns.length
      const text = `${col.prefix ?? ''}${fmt(lo)}‹${fmt(mid)}›${fmt(hi)}${col.suffix ?? ''}`
      const title = `min ${fmt(lo)} · ${midKind} ${fmt(mid)} · max ${fmt(hi)}`
      return { text, title, numeric: true }
    }
    case 'avg': {
      const ns = numbersOf(rows, col)
      if (ns.length === 0) return null
      const fmt = col.formatNum ?? ((n: number) => String(Math.round(n)))
      const mean = ns.reduce((a, b) => a + b, 0) / ns.length
      return { text: `${col.prefix ?? ''}${fmt(mean)}${col.suffix ?? ''}`, numeric: true }
    }
    case 'boolTrue': {
      const get = col.boolOf ?? ((r) => Boolean(r[col.key]))
      let n = 0
      for (const r of rows) if (get(r)) n++
      const text = col.suffix ? `${n}${col.suffix}` : String(n)
      return { text, title: `${n} of ${rows.length}`, numeric: true }
    }
    default:
      return null
  }
}
