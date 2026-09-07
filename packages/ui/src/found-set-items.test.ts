import { describe, it, expect } from 'vitest'
import { foundSetItems } from './found-set-items'
import type { DisplayLine } from './use-collection-list'

type Row = { id: string; title: string }
const row = (id: string, title: string): Row => ({ id, title })

describe('foundSetItems', () => {
  it('maps flat rows in order when ungrouped', () => {
    expect(foundSetItems<Row>({ rows: [row('a', 'A'), row('b', 'B')] })).toEqual([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ])
  })

  it('attaches the group-by trail from the line list', () => {
    const lines: DisplayLine<Row>[] = [
      { kind: 'group', id: 'g1', level: 0, field: 'genre', value: 'jazz', label: 'Jazz', count: 2, cells: {}, collapsed: false },
      { kind: 'row', level: 1, row: row('a', 'A'), serial: 1 },
      { kind: 'row', level: 1, row: row('b', 'B'), serial: 2 },
      { kind: 'group', id: 'g2', level: 0, field: 'genre', value: 'rock', label: 'Rock', count: 1, cells: {}, collapsed: false },
      { kind: 'row', level: 1, row: row('c', 'C'), serial: 1 },
    ]
    expect(foundSetItems<Row>({ lines })).toEqual([
      { id: 'a', label: 'A', group: ['Jazz'] },
      { id: 'b', label: 'B', group: ['Jazz'] },
      { id: 'c', label: 'C', group: ['Rock'] },
    ])
  })

  it('handles nested groups (trail truncates per level)', () => {
    const lines: DisplayLine<Row>[] = [
      { kind: 'group', id: 'g1', level: 0, field: 'label', value: 'gh', label: 'Groove Hill', count: 2, cells: {}, collapsed: false },
      { kind: 'group', id: 'g1a', level: 1, field: 'genre', value: 'jazz', label: 'Jazz', count: 1, cells: {}, collapsed: false },
      { kind: 'row', level: 2, row: row('a', 'A'), serial: 1 },
      { kind: 'group', id: 'g1b', level: 1, field: 'genre', value: 'soul', label: 'Soul', count: 1, cells: {}, collapsed: false },
      { kind: 'row', level: 2, row: row('b', 'B'), serial: 1 },
    ]
    expect(foundSetItems<Row>({ lines })).toEqual([
      { id: 'a', label: 'A', group: ['Groove Hill', 'Jazz'] },
      { id: 'b', label: 'B', group: ['Groove Hill', 'Soul'] },
    ])
  })

  it('prefers lines over rows when both are given', () => {
    const lines: DisplayLine<Row>[] = [{ kind: 'row', level: 0, row: row('a', 'A'), serial: 1 }]
    expect(foundSetItems<Row>({ lines, rows: [row('z', 'Z')] })).toEqual([{ id: 'a', label: 'A', group: [] }])
  })

  it('honours custom idOf/labelOf', () => {
    type N = { pk: number; name: string }
    expect(foundSetItems<N>({ rows: [{ pk: 7, name: 'Seven' }] }, { idOf: (r) => `n${r.pk}`, labelOf: (r) => r.name }))
      .toEqual([{ id: 'n7', label: 'Seven' }])
  })

  it('default label falls back title → name → id', () => {
    expect(foundSetItems({ rows: [{ id: 'x', name: 'Named' }] })).toEqual([{ id: 'x', label: 'Named' }])
    expect(foundSetItems({ rows: [{ id: 'y' }] })).toEqual([{ id: 'y', label: 'y' }])
  })
})
