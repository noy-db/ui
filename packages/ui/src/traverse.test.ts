import { describe, it, expect } from 'vitest'
import { positionOf, itemAt, type FoundSetSnapshot } from './traverse'

const snap = (ids: string[]): FoundSetSnapshot => ({
  kind: 'query', entity: 'records', query: 'genre:jazz sort:year', title: 'jazz · by year',
  items: ids.map((id) => ({ id, label: `L-${id}` })), total: 24, capturedAt: '2026-07-04T00:00:00Z',
})

describe('positionOf', () => {
  it('finds index, neighbors and end flags', () => {
    const p = positionOf(snap(['a', 'b', 'c']), 'b')!
    expect(p).toMatchObject({ index: 1, count: 3, atFirst: false, atLast: false })
    expect(p.prev!.id).toBe('a'); expect(p.next!.id).toBe('c'); expect(p.current.id).toBe('b')
  })
  it('first/last omit the missing neighbor and set the flag', () => {
    const first = positionOf(snap(['a', 'b']), 'a')!
    expect(first.atFirst).toBe(true); expect(first.prev).toBeUndefined(); expect(first.next!.id).toBe('b')
    const last = positionOf(snap(['a', 'b']), 'b')!
    expect(last.atLast).toBe(true); expect(last.next).toBeUndefined()
  })
  it('single item is both first and last', () => {
    const p = positionOf(snap(['x']), 'x')!
    expect(p).toMatchObject({ index: 0, count: 1, atFirst: true, atLast: true })
  })
  it('unknown id → null', () => { expect(positionOf(snap(['a']), 'zz')).toBeNull() })
})

describe('itemAt', () => {
  it('clamps below and above', () => {
    expect(itemAt(snap(['a', 'b']), -5)!.id).toBe('a')
    expect(itemAt(snap(['a', 'b']), 99)!.id).toBe('b')
  })
  it('empty set → null', () => { expect(itemAt(snap([]), 0)).toBeNull() })
})
