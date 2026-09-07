import { describe, it, expect } from 'vitest'
import type { AppColumn } from './column'
import { relatedColumns, summaryCards } from './related'

const col = (key: string, label = key): AppColumn => ({ key, label, sortable: true }) as AppColumn

describe('relatedColumns', () => {
  const all = [col('title'), col('year'), col('genre'), col('priceUsd', 'Price')]

  it('selects the subset in the requested order', () => {
    expect(relatedColumns(all, ['priceUsd', 'title']).map((c) => c.key)).toEqual(['priceUsd', 'title'])
  })

  it('skips unknown keys without throwing', () => {
    expect(relatedColumns(all, ['title', 'nope', 'year']).map((c) => c.key)).toEqual(['title', 'year'])
  })

  it('returns the full column objects, not just keys', () => {
    expect(relatedColumns(all, ['priceUsd'])[0]).toMatchObject({ key: 'priceUsd', label: 'Price' })
  })
})

describe('summaryCards', () => {
  const spec = [
    { key: 'n', label: 'Records' },
    { key: 'total', label: 'Total', format: (v: number | null) => (v == null ? '—' : `$${v}`), icon: 'i-lucide-dollar-sign', color: 'success' as const },
    { key: 'avgRating', label: 'Avg rating', format: (v: number | null) => (v == null ? '—' : v.toFixed(1)) },
  ]

  it('formats a populated aggregate into cards', () => {
    const cards = summaryCards({ n: 2, total: 30, avgRating: 4.5 }, spec)
    expect(cards).toEqual([
      { label: 'Records', value: '2' },
      { label: 'Total', value: '$30', icon: 'i-lucide-dollar-sign', color: 'success' },
      { label: 'Avg rating', value: '4.5' },
    ])
  })

  it('renders an empty set (null avg) through the format, count as 0', () => {
    const cards = summaryCards({ n: 0, total: 0, avgRating: null }, spec)
    expect(cards.map((c) => c.value)).toEqual(['0', '$0', '—'])
  })

  it('defaults a missing key to —', () => {
    expect(summaryCards({}, [{ key: 'ghost', label: 'Ghost' }])[0].value).toBe('—')
  })
})
