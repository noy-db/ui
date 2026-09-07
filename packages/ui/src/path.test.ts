import { describe, it, expect } from 'vitest'
import type { DescribedField } from '@noy-db/hub'
import { pathSegments } from './path'

const f = (p: Partial<DescribedField> & { key: string }): DescribedField =>
  ({ type: 'string', optional: true, label: p.key, widget: 'text', editable: true, ...p }) as DescribedField
const FIELDS = [
  f({ key: 'labelId', ref: { target: 'labels', mode: 'warn' } }),
  f({ key: 'artistId', ref: { target: 'artists', mode: 'warn' } }),
  f({ key: 'title' }),
]

describe('pathSegments — grouped', () => {
  it('group trail then bold terminal', () => {
    const segs = pathSegments({
      item: { id: 'r1', label: 'After Hours', group: ['Jazz', 'Groove Hill'] },
      record: null, fields: FIELDS, titleLabel: 'After Hours',
    })
    expect(segs).toEqual([
      { label: 'Jazz', kind: 'group' },
      { label: 'Groove Hill', kind: 'group' },
      { label: 'After Hours', kind: 'title' },
    ])
  })
})

describe('pathSegments — natural axis', () => {
  const record = { id: 'r1', labelId: 'lb1', artistId: 'ar2', title: 'After Hours' }
  it('ref segments in naturalOrder with resolved labels + refs', () => {
    const segs = pathSegments({
      item: { id: 'r1', label: 'After Hours' }, record, fields: FIELDS,
      naturalOrder: ['labelId', 'artistId'],
      labelFor: (field, id) => (field === 'labelId' ? 'Groove Hill' : field === 'artistId' ? 'Blue Quartet' : undefined),
      titleLabel: 'After Hours',
    })
    expect(segs).toEqual([
      { label: 'Groove Hill', kind: 'entity', ref: { collection: 'labels', id: 'lb1' } },
      { label: 'Blue Quartet', kind: 'entity', ref: { collection: 'artists', id: 'ar2' } },
      { label: 'After Hours', kind: 'title' },
    ])
  })
  it('missing labelFor falls back to the raw id; empty values are skipped', () => {
    const segs = pathSegments({
      item: null, record: { ...record, artistId: '' }, fields: FIELDS,
      naturalOrder: ['labelId', 'artistId'], titleLabel: 'After Hours',
    })
    expect(segs).toEqual([
      { label: 'lb1', kind: 'entity', ref: { collection: 'labels', id: 'lb1' } },
      { label: 'After Hours', kind: 'title' },
    ])
  })
  it('skim (no record, no group) → title only', () => {
    expect(pathSegments({ item: { id: 'r2', label: 'X' }, record: null, fields: FIELDS, naturalOrder: ['labelId'], titleLabel: 'X' }))
      .toEqual([{ label: 'X', kind: 'title' }])
  })
})
