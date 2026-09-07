import { describe, it, expect } from 'vitest'
import type { DescribedField } from '@noy-db/hub'
import { groupFields } from './groups'

// minimal DescribedField builder for the pure grouper (no vault needed)
const f = (p: Partial<DescribedField> & { key: string }): DescribedField =>
  ({ type: 'string', optional: true, label: p.key, widget: 'text', editable: true, ...p }) as DescribedField

describe('groupFields', () => {
  it('groups by field.group, ordered by the minimum member order', () => {
    const groups = groupFields([
      f({ key: 'total', group: 'Amounts', order: 10 }),
      f({ key: 'issuedOn', group: 'Dates', order: 1 }),
      f({ key: 'vat', group: 'Amounts', order: 11 }),
    ])
    expect(groups.map((g) => g.id)).toEqual(['Dates', 'Amounts'])
    expect(groups[1]!.fields.map((x) => x.key)).toEqual(['total', 'vat'])
  })

  it('fields sort by order inside a group; missing order sinks last, ties keep input order', () => {
    const groups = groupFields([
      f({ key: 'b', group: 'G' }), // no order → last
      f({ key: 'c', group: 'G', order: 2 }),
      f({ key: 'a', group: 'G', order: 1 }),
    ])
    expect(groups[0]!.fields.map((x) => x.key)).toEqual(['a', 'c', 'b'])
  })

  it('ungrouped fields land in a default bucket, last, with the localizable title', () => {
    const t = (key: string, fallback: string) => (key === 'nui.detail.details' ? 'รายละเอียด' : fallback)
    const groups = groupFields([f({ key: 'x' }), f({ key: 'total', group: 'Amounts', order: 1 })], t)
    expect(groups.map((g) => g.id)).toEqual(['Amounts', '_default'])
    expect(groups[1]!.title).toBe('รายละเอียด')
  })

  it('group titles localize via t(nui.detail.group.<id>) with the id as fallback', () => {
    const t = (key: string, fallback: string) => (key === 'nui.detail.group.Amounts' ? 'ยอดเงิน' : fallback)
    expect(groupFields([f({ key: 'total', group: 'Amounts' })], t)[0]!.title).toBe('ยอดเงิน')
  })

  it('a group with no ordered member sorts after ordered groups, before the default bucket', () => {
    const groups = groupFields([
      f({ key: 'loose' }),
      f({ key: 'u', group: 'Unordered' }),
      f({ key: 'o', group: 'Ordered', order: 5 }),
    ])
    expect(groups.map((g) => g.id)).toEqual(['Ordered', 'Unordered', '_default'])
  })

  it('all fields ungrouped → single default group (back-compat with the one-card render)', () => {
    const groups = groupFields([f({ key: 'a' }), f({ key: 'b' })])
    expect(groups).toHaveLength(1)
    expect(groups[0]!).toMatchObject({ id: '_default', title: 'Details' })
  })
})
