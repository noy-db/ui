import { describe, it, expect } from 'vitest'
import { fitText, repsFor, compactNumber } from './adaptive-text'

// Fake measurer: every character is 10px wide. Deterministic, so the ladder is fully testable.
const measure = (s: string) => s.length * 10

describe('fitText — ladder', () => {
  it('renders plain when the richest rep fits', () => {
    const t = fitText(['hello'], 100, { measure }) // 50 ≤ 100
    expect(t).toMatchObject({ text: 'hello', scaleX: 1, wrap: false, ellipsis: false })
  })

  it('steps to a shorter rep rather than over-squeezing', () => {
    // "2026"=40, "’26"=30. Width 32: 40 needs scaleX .8 (< soft .94) so step to "’26" which fits.
    const t = fitText(['2026', '’26'], 32, { measure })
    expect(t.text).toBe('’26')
    expect(t.scaleX).toBe(1)
  })

  it('keeps the richer rep with a MILD squeeze instead of abbreviating', () => {
    // "2026"=40 at width 39 → squeeze .975 (≥ soft .94) → keep "2026", lightly condensed.
    const t = fitText(['2026', '’26'], 39, { measure })
    expect(t.text).toBe('2026')
    expect(t.scaleX).toBeCloseTo(0.975, 3)
  })

  it('hard-condenses the last rep when nothing fits mildly', () => {
    // single rep "abcdefghij"=100, width 88 → .88 squeeze (in [hard .8, soft .94))
    const t = fitText(['abcdefghij'], 88, { measure })
    expect(t.text).toBe('abcdefghij')
    expect(t.scaleX).toBeCloseTo(0.88, 2)
    expect(t.ellipsis).toBe(false)
  })

  it('ellipsis is the single-line last resort', () => {
    // "abcdefghij"=100, width 50 → even hard .8 needs 80 > 50, font floor can't save it → ellipsis.
    const t = fitText(['abcdefghij'], 50, { measure })
    expect(t.ellipsis).toBe(true)
    expect(t.scaleX).toBeCloseTo(0.8, 2)
  })

  it('prefers WRAP over hard-condense when a line budget exists', () => {
    // width 50, rep 100. lineBudget 2 → ceil(100/50)=2 lines ≤ 2 → wrap, no squeeze.
    const t = fitText(['abcdefghij'], 50, { measure, lineBudget: 2 })
    expect(t.wrap).toBe(true)
    expect(t.lines).toBe(2)
    expect(t.scaleX).toBe(1)
    expect(t.ellipsis).toBe(false)
  })

  it('preferWrap wraps even when a squeeze WOULD fit (covered row)', () => {
    // width 85, rep 100: hard-condense (.85) would fit, but with a line budget we wrap instead.
    const t = fitText(['abcdefghij'], 85, { measure, lineBudget: 2 })
    expect(t.wrap).toBe(true)
    expect(t.scaleX).toBe(1)
  })

  it('preferWrap off condenses instead of wrapping when the squeeze fits', () => {
    const t = fitText(['abcdefghij'], 85, { measure, lineBudget: 2, preferWrap: false })
    expect(t.wrap).toBe(false)
    expect(t.scaleX).toBeCloseTo(0.85, 2)
  })
})

describe('repsFor — semantic ladders', () => {
  it('year → full then apostrophe-two-digit', () => {
    expect(repsFor('year', 2026)).toEqual(['2026', '’26'])
  })
  it('money → decimals → grouped → compact', () => {
    expect(repsFor('money', 1200.01, { currency: 'USD' })).toEqual(['$1,200.01', '$1,200', '$1.2k'])
  })
  it('duration → "47 min" → "47′" → "47"', () => {
    expect(repsFor('duration', 47)).toEqual(['47 min', '47′', '47'])
  })
  it('date → long → medium → short', () => {
    expect(repsFor('date', '2026-06-29')).toEqual(['Jun 29, 2026', 'Jun 29', '6/29/26'])
  })
  it('text → a single representation', () => {
    expect(repsFor('text', 'Echoes at Dawn')).toEqual(['Echoes at Dawn'])
  })
})

describe('compactNumber', () => {
  it('keeps small numbers whole and suffixes large ones', () => {
    expect(compactNumber(999)).toBe('999')
    expect(compactNumber(1234)).toBe('1.2k')
    expect(compactNumber(2_500_000)).toBe('2.5M')
  })
})
