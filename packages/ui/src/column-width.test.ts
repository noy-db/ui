import { describe, it, expect } from 'vitest'
import {
  selectColumns, distributeWidths, fitColumns,
  archetypeForFieldType, WIDTH_ARCHETYPES, type SizedColumn,
} from './column-width'

const col = (key: string, min: number, flex = 0, extra: Partial<SizedColumn> = {}): SizedColumn =>
  ({ key, min, flex, ...extra })

describe('archetypeForFieldType', () => {
  it('maps every FieldType to an archetype with a positive min', () => {
    for (const t of ['enum', 'entity', 'date', 'money', 'number', 'text'] as const) {
      const a = archetypeForFieldType(t)
      expect(WIDTH_ARCHETYPES[a].min).toBeGreaterThan(0)
    }
  })
  it('numeric types share the num archetype; text is the widest', () => {
    expect(archetypeForFieldType('number')).toBe('num')
    expect(archetypeForFieldType('money')).toBe('num')
    expect(WIDTH_ARCHETYPES.text.min).toBeGreaterThan(WIDTH_ARCHETYPES.num.min)
  })
})

describe('selectColumns — drop to fit the budget', () => {
  const cols = [
    col('title', 96, 3),                 // core (no relevance)
    col('artist', 110, 2),               // core
    col('year', 60, 0, { relevance: 70 }),
    col('genre', 76, 1, { relevance: 65 }),
    col('price', 60, 0, { relevance: 40 }),
  ]
  it('keeps everything when they fit', () => {
    expect(selectColumns(cols, 1000)).toEqual(['title', 'artist', 'year', 'genre', 'price'])
  })
  it('drops the lowest-relevance column first when over budget', () => {
    // total floor = 402; at 360 the 40-relevance price (60px) drops → 342 fits.
    expect(selectColumns(cols, 360)).toEqual(['title', 'artist', 'year', 'genre'])
  })
  it('keeps dropping by ascending relevance; core columns survive longest', () => {
    expect(selectColumns(cols, 230)).toEqual(['title', 'artist'])      // both relevance'd dropped
    expect(selectColumns(cols, 120)).toEqual(['title'])                // even a core drops to fit
  })
  it('never drops below one column', () => {
    expect(selectColumns(cols, 10)).toEqual(['title'])
  })
  it('reserves the serial width against the budget', () => {
    // budget = 360 − 44 = 316 → price(60) and genre(76) drop, leaving 266 ≤ 316.
    expect(selectColumns(cols, 360, { serial: 44 })).toEqual(['title', 'artist', 'year'])
  })
  it('a forced column is dropped last, even at low relevance', () => {
    expect(selectColumns(cols, 230, { force: new Set(['price']) })).toContain('price')
  })
})

describe('distributeWidths — widths sum to the budget', () => {
  it('auto columns share leftover by flex; sum equals container', () => {
    const cols = [col('a', 100, 1), col('b', 100, 3)]
    const w = distributeWidths(cols, 600)
    expect(w.a! + w.b!).toBe(600)
    // leftover 400 split 1:3 → a=100+100=200, b=100+300=400
    expect(w).toEqual({ a: 200, b: 400 })
  })
  it('a fixed column keeps its px; autos flex around it; total fills', () => {
    const cols = [col('serialish', 0, 0, { fixedPx: 50 }), col('title', 100, 1)]
    const w = distributeWidths(cols, 500)
    expect(w.serialish).toBe(50)
    expect(w.title).toBe(450)
  })
  it('a proportional column takes pct of the WHOLE container', () => {
    const cols = [col('p', 40, 0, { pct: 0.25 }), col('rest', 100, 1)]
    const w = distributeWidths(cols, 800)
    expect(w.p).toBe(200)          // 25% of 800
    expect(w.p! + w.rest!).toBe(800)
  })
  it('rigid-only autos (no flex) share surplus proportionally so the table fills evenly', () => {
    const cols = [col('x', 40, 0), col('y', 40, 0)]
    const w = distributeWidths(cols, 200)
    expect(w.x! + w.y!).toBe(200)
    expect(w.x).toBe(w.y)  // equal ideals → equal share, no single column ballooning
  })

  it('gives each column its ideal first; surplus goes only to flex columns', () => {
    const cols = [col('num', 60, 0, { ideal: 84 }), col('text', 96, 2, { ideal: 176 })]
    const w = distributeWidths(cols, 400)   // sumIdeal 260, surplus 140 → all to text
    expect(w.num).toBe(84)                   // rigid column stays at its ideal (header reads cleanly)
    expect(w.text).toBe(316)                 // 176 + 140
    expect(w.num! + w.text!).toBe(400)
  })

  it('shrinks from ideal toward min (proportional to slack) when too tight, never below min', () => {
    const cols = [col('a', 40, 0, { ideal: 100 }), col('b', 40, 0, { ideal: 100 })]
    const w = distributeWidths(cols, 120)    // sumIdeal 200 > 120 > sumMin 80
    expect(w.a).toBe(60)                      // each loses 60·(80/120) = 40 → 60
    expect(w.b).toBe(60)
  })
})

describe('fitColumns — select then size', () => {
  it('drops to fit, then the survivors fill the container exactly', () => {
    const cols = [
      col('title', 96, 3),
      col('artist', 110, 2),
      col('extra', 200, 1, { relevance: 10 }),
    ]
    const { visible, widths } = fitColumns(cols, 300)
    expect(visible).toEqual(['title', 'artist'])              // extra dropped (won't fit)
    expect(widths.title! + widths.artist!).toBe(300)          // survivors fill exactly
  })
})
