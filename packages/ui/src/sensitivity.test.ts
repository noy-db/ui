import { describe, it, expect } from 'vitest'
import type { DescribedField } from '@noy-db/hub'
import { schemaFromDescribe } from './schema-from-describe'
import { evaluate } from './evaluate'
import { parse } from './parse'
import { resolve } from './resolve'
import { facetsForColumn, observedFacets } from './column-filter'
import { buildSuggestions } from './suggest'
import { groupRowsMulti } from './group'
import { describeSchemaForPrompt } from './nl'
import { fieldInput } from './form'
import type { EntitySchema } from './types'

// family#158: a field describe() marks pii/secret is masked in the detail view, so the search engine
// must not read its values either — no filter, sort, group, facet, suggestion, free-text match or NL
// prompt — unless the schema was built with `reveal`. Otherwise a masked record is an oracle.
const f = (p: Partial<DescribedField> & { key: string }): DescribedField =>
  ({ type: 'string', optional: true, label: p.key, widget: 'text', editable: true, ...p }) as DescribedField

const described: DescribedField[] = [
  f({ key: 'name', label: 'Name' }),
  f({ key: 'ssn', label: 'SSN', sensitivity: 'pii' }),
  f({ key: 'pin', label: 'PIN', sensitivity: 'secret' }),
  f({ key: 'tier', label: 'Tier', sensitivity: 'pii', dict: { name: 't', static: true, values: [{ value: 'gold', label: 'Gold' }, { value: 'basic', label: 'Basic' }] } }),
  f({ key: 'note', label: 'Note', sensitivity: 'public' }),
]
const rows = [
  { id: '1', name: 'Ann', ssn: '111-22-3333', pin: '9876', tier: 'gold', note: 'a' },
  { id: '2', name: 'Bob', ssn: '444-55-6666', pin: '1234', tier: 'basic', note: 'b' },
]
const run = (schema: EntitySchema, q: string) => evaluate(rows, resolve(parse(q).ast, schema), schema)

describe('sensitive fields are masked in the search engine (family#158)', () => {
  const masked = schemaFromDescribe('people', described)

  it('carries sensitivity onto FieldDef for pii/secret only', () => {
    const by = Object.fromEntries(masked.fields.map((d) => [d.id, d.sensitivity]))
    expect(by).toEqual({ name: undefined, ssn: 'pii', pin: 'secret', tier: 'pii', note: undefined })
  })

  it('excludes sensitive fields from free text', () => {
    expect(masked.textFields).toEqual(['name', 'note'])
    expect(run(masked, '111-22')).toHaveLength(0)
  })

  it('answers no predicate on a sensitive field — not an oracle', () => {
    expect(run(masked, 'ssn:111-22-3333')).toHaveLength(0)
    expect(run(masked, 'tier:gold')).toHaveLength(0)
    expect(run(masked, 'ssn!=111-22-3333')).toHaveLength(0)
  })

  it('ignores sort on a sensitive field', () => {
    expect(run(masked, 'sort:pin-up').map((r) => r.id)).toEqual(['1', '2'])
    expect(run(masked, 'sort:pin-down').map((r) => r.id)).toEqual(['1', '2'])
  })

  it('does not group by a sensitive field', () => {
    expect(groupRowsMulti(rows, masked, ['tier'])).toEqual([])
  })

  it('offers no facets for a sensitive field', () => {
    expect(facetsForColumn(rows, { where: null, sort: [], groupBy: [] }, masked, 'ssn')).toEqual([])
    expect(Object.keys(observedFacets(masked, rows))).toEqual(['name', 'note'])
  })

  it('suggests no values, sort or group for a sensitive field', () => {
    const facets = observedFacets(masked, rows)
    const labels = (draft: string) => buildSuggestions(draft, masked, facets).map((s) => s.label).join('|')
    expect(labels('ssn:')).not.toContain('111')
    expect(labels('tier:')).not.toMatch(/gold|Gold/)
    expect(labels('sort:pin')).not.toContain('PIN')
    expect(labels('group:tier')).not.toContain('Tier')
  })

  it('puts no sensitive values in the NL prompt', () => {
    const prompt = describeSchemaForPrompt(masked, new Date(), { ssn: ['111-22-3333'] })
    expect(prompt).not.toContain('111-22-3333')
    expect(prompt).not.toContain('gold')
  })
})

describe('reveal: true restores every path (the gate is falsifiable)', () => {
  const revealed = schemaFromDescribe('people', described, { reveal: true })

  it('carries no sensitivity flag', () => {
    expect(revealed.fields.every((d) => d.sensitivity === undefined)).toBe(true)
  })

  it('filters, searches, sorts, groups, facets and suggests', () => {
    expect(run(revealed, 'ssn:111-22-3333').map((r) => r.id)).toEqual(['1'])
    expect(run(revealed, '444-55').map((r) => r.id)).toEqual(['2'])
    expect(run(revealed, 'sort:pin-up').map((r) => r.id)).toEqual(['2', '1'])
    expect(groupRowsMulti(rows, revealed, ['tier']).map((g) => g.value).sort()).toEqual(['basic', 'gold'])
    expect(facetsForColumn(rows, { where: null, sort: [], groupBy: [] }, revealed, 'ssn').map((x) => x.value).sort()).toEqual(['111-22-3333', '444-55-6666'])
    const facets = observedFacets(revealed, rows)
    expect(buildSuggestions('ssn:', revealed, facets).map((s) => s.label).join('|')).toContain('111-22-3333')
  })
})

describe('edit mode keeps sensitive inputs masked (family#158)', () => {
  it('marks the input descriptor of a pii/secret field', () => {
    expect(fieldInput(described[1]!).sensitive).toBe(true)
    expect(fieldInput(described[2]!).sensitive).toBe(true)
    expect(fieldInput(described[0]!).sensitive).toBeUndefined()
    expect(fieldInput(described[4]!).sensitive).toBeUndefined()
  })
})
