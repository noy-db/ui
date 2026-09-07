import { describe, it, expect } from 'vitest'
import { columnAggregate, singularize, daysBetween, median } from './aggregate'

describe('singularize', () => {
  it('handles the column nouns', () => {
    expect(singularize('buyers')).toBe('buyer')
    expect(singularize('suppliers')).toBe('supplier')
    expect(singularize('companies')).toBe('company')
    expect(singularize('statuses')).toBe('status')
  })
})

describe('columnAggregate distinct', () => {
  const rows = (vals: string[]) => vals.map((buyerName) => ({ buyerName }))
  it('shows the count only; the pluralized noun lives in the tooltip (singular at 1)', () => {
    const two = columnAggregate(rows(['A', 'B', 'A']), { key: 'buyerName', aggregate: 'distinct', aggregateNoun: 'buyers' })!
    expect(two.text).toBe('2'); expect(two.title).toBe('2 buyers')
    const one = columnAggregate(rows(['A', 'A']), { key: 'buyerName', aggregate: 'distinct', aggregateNoun: 'buyers' })!
    expect(one.text).toBe('1'); expect(one.title).toBe('1 buyer')
  })
})

describe('daysBetween / dateRange', () => {
  it('1 Jan → 15 Feb = 45 days', () => {
    expect(daysBetween('2026-01-01', '2026-02-15')).toBe(45)
  })
  it('singular "1 day"', () => {
    const r = columnAggregate([{ d: '2026-01-01' }, { d: '2026-01-02' }], { key: 'd', aggregate: 'dateRange', dateOf: (x) => x.d })
    expect(r!.text).toBe('1 day')
  })
})

describe('median', () => {
  it('odd length → centre', () => expect(median([3, 1, 2])).toBe(2))
  it('even length → mean of two centres', () => expect(median([1, 2, 3, 4])).toBe(2.5))
  it('empty → 0', () => expect(median([])).toBe(0))
})

describe('columnAggregate range', () => {
  const rows = (ns: number[]) => ns.map((year) => ({ year }))
  it('numeric min–max', () => {
    expect(columnAggregate(rows([1973, 1955, 1999]), { key: 'year', aggregate: 'range' })!.text).toBe('1955–1999')
  })
  it('collapses to a single value when min === max', () => {
    expect(columnAggregate(rows([1980, 1980]), { key: 'year', aggregate: 'range' })!.text).toBe('1980')
  })
  it('date → year span with full-date tooltip', () => {
    const r = columnAggregate([{ d: '2023-09-14' }, { d: '2024-06-02' }], { key: 'd', aggregate: 'range', dateOf: (x) => x.d })
    expect(r!.text).toBe('2023–2024')
    expect(r!.title).toBe('2023-09-14 → 2024-06-02')
  })
  it('returns null with no data', () => {
    expect(columnAggregate([], { key: 'year', aggregate: 'range' })).toBeNull()
  })
  it('formatRange compacts the low/high pair when lo ≠ hi', () => {
    const compact = (lo: number, hi: number) => `${lo}–${String(hi).slice(-2)}`
    expect(columnAggregate(rows([1986, 1999, 1991]), { key: 'year', aggregate: 'range', formatRange: compact })!.text).toBe('1986–99')
  })
  it('formatRange is ignored when lo === hi (single value)', () => {
    const compact = (lo: number, hi: number) => `${lo}–${String(hi).slice(-2)}`
    expect(columnAggregate(rows([1980, 1980]), { key: 'year', aggregate: 'range', formatRange: compact })!.text).toBe('1980')
  })
})

describe('columnAggregate stats', () => {
  const rows = (ns: number[]) => ns.map((n) => ({ n }))
  it('min‹avg›max with a clarifying tooltip', () => {
    const r = columnAggregate(rows([7, 52, 49]), { key: 'n', aggregate: 'stats', statMiddle: 'avg' })
    expect(r!.text).toBe('7‹36›52')
    expect(r!.title).toBe('min 7 · avg 36 · max 52')
  })
  it('median middle + prefix/format', () => {
    const r = columnAggregate(rows([10, 30, 70, 20]), { key: 'n', aggregate: 'stats', statMiddle: 'median', prefix: '$' })
    expect(r!.text).toBe('$10‹25›70')
  })
})

describe('columnAggregate avg', () => {
  it('reports the mean, formatted, with a suffix', () => {
    const rows = [{ r: 3 }, { r: 4 }, { r: 5 }, { r: 4 }]
    const t = columnAggregate(rows, { key: 'r', aggregate: 'avg', formatNum: (n) => n.toFixed(1), suffix: '★' })
    expect(t!.text).toBe('4.0★')
  })
})

describe('columnAggregate boolTrue', () => {
  it('counts truthy rows with a suffix', () => {
    const rows = [{ fav: true }, { fav: false }, { fav: true }]
    const r = columnAggregate(rows, { key: 'fav', aggregate: 'boolTrue', suffix: ' ★', boolOf: (x) => x.fav })
    expect(r!.text).toBe('2 ★')
    expect(r!.title).toBe('2 of 3')
  })
})
