import { describe, it, expect } from 'vitest'
import type { DescribedField } from '@noy-db/hub'
import { fieldInput, formFields, fieldErrors, fieldHint } from './form'

const f = (p: Partial<DescribedField> & { key: string }): DescribedField =>
  ({ type: 'string', optional: true, label: p.key, widget: 'text', editable: true, ...p }) as DescribedField

describe('fieldInput', () => {
  it('picks controls from widget / semanticType', () => {
    expect(fieldInput(f({ key: 'name' })).kind).toBe('text')
    expect(fieldInput(f({ key: 'notes', widget: 'textarea' })).kind).toBe('textarea')
    expect(fieldInput(f({ key: 'total', semanticType: 'currency', widget: 'money' })).kind).toBe('number')
    expect(fieldInput(f({ key: 'date', semanticType: 'date' })).kind).toBe('date')
    expect(fieldInput(f({ key: 'active', type: 'boolean' })).kind).toBe('checkbox')
  })

  it('makes a select from a dictionary, with labels', () => {
    const inp = fieldInput(f({ key: 'status', dict: { name: 's', static: true, values: [{ value: 'paid', label: 'Paid' }, { value: 'draft' }] } }))
    expect(inp.kind).toBe('select')
    expect(inp.options).toEqual([{ value: 'paid', label: 'Paid' }, { value: 'draft', label: 'draft' }])
  })

  it('accepts host-supplied options (e.g. entity refs)', () => {
    const inp = fieldInput(f({ key: 'buyerId', label: 'Buyer' }), [{ value: 'b1', label: 'ACME' }])
    expect(inp.kind).toBe('select')
    expect(inp.options).toEqual([{ value: 'b1', label: 'ACME' }])
  })
})

describe('fieldInput — phase-3 widgets', () => {
  it('an i18n field becomes an i18n-text input carrying its locales', () => {
    const inp = fieldInput(f({ key: 'title', label: 'Title', i18n: { locales: ['en', 'th'] } }))
    expect(inp.kind).toBe('i18n-text')
    expect(inp.locales).toEqual(['en', 'th'])
  })

  it('a currency field keeps kind number and carries its unit', () => {
    const inp = fieldInput(f({ key: 'price', label: 'Price', semanticType: 'currency', unit: 'USD', type: 'number' }))
    expect(inp.kind).toBe('number')
    expect(inp.unit).toBe('USD')
  })

  it('ref-select with host options is a select; without options it falls back to text', () => {
    const field = f({ key: 'labelId', label: 'Label', widget: 'ref-select', ref: { target: 'labels', mode: 'warn' } })
    expect(fieldInput(field, [{ value: 'lb1', label: 'Groove Hill' }]).kind).toBe('select')
    expect(fieldInput(field).kind).toBe('text')
  })

  it('an integer-typed field (zod .int()) is a number input', () => {
    expect(fieldInput(f({ key: 'year', label: 'Year', type: 'integer' })).kind).toBe('number')
  })
})

describe('fieldHint', () => {
  it('marks non-optional fields required', () => {
    expect(fieldHint(f({ key: 'year', optional: false })).required).toBe(true)
    expect(fieldHint(f({ key: 'notes', optional: true })).required).toBe(false)
  })

  it('composes a numeric range from minimum/maximum', () => {
    expect(fieldHint(f({ key: 'year', constraints: { minimum: 1900, maximum: 2100 } })).text).toBe('1900–2100')
    expect(fieldHint(f({ key: 'price', constraints: { minimum: 0 } })).text).toBe('≥ 0')
  })

  it('composes a length range and a format name', () => {
    expect(fieldHint(f({ key: 'notes', constraints: { maxLength: 300 } })).text).toBe('≤ 300 chars')
    expect(fieldHint(f({ key: 'shopUrl', constraints: { format: 'uri' } })).text).toBe('uri')
  })

  it('no constraints → no text', () => {
    expect(fieldHint(f({ key: 'genre' })).text).toBeUndefined()
  })

  it("suppresses zod .int()'s ±MAX_SAFE_INTEGER noise, keeping the real bound", () => {
    expect(fieldHint(f({ key: 'trackCount', constraints: { minimum: 1, maximum: 9007199254740991 } })).text).toBe('≥ 1')
    expect(fieldHint(f({ key: 'delta', constraints: { minimum: -9007199254740991, maximum: 9007199254740991 } })).text).toBeUndefined()
  })
})

describe('fieldInput — native lookup fields', () => {
  it('derives select options from the lookup block key set when there is no dict block', () => {
    const field = f({
      key: 'priority', widget: 'select',
      lookup: { dimension: '', backing: 'static', vocabulary: 'closed', key: 'id', onDelete: 'restrict', keys: ['low', 'mid', 'high'] },
    } as Parameters<typeof f>[0])
    const input = fieldInput(field)
    expect(input.kind).toBe('select')
    expect(input.options).toEqual([
      { value: 'low', label: 'low' }, { value: 'mid', label: 'mid' }, { value: 'high', label: 'high' },
    ])
  })
})

// The matrix tier: a lookup whose membership lives in a first-class reference collection.
// describe() deliberately does NOT embed that collection's rows, so there is nothing to put in a
// <select> — the control has to ask the host, search-as-you-type.
describe('fieldInput — collection-backed lookup fields', () => {
  const country = (over: Record<string, unknown> = {}) => f({
    key: 'country', label: 'Country', widget: 'select',
    lookup: {
      dimension: 'countries', backing: 'collection', vocabulary: 'closed',
      key: 'iso2', altKeys: ['iso3'], present: { label: 'name' }, sortBy: 'name', onDelete: 'restrict',
      ...over,
    },
  } as Parameters<typeof f>[0])

  it('becomes an autocomplete when the vocabulary cannot be enumerated inline', () => {
    expect(fieldInput(country()).kind).toBe('autocomplete')
  })

  it('carries what the host needs to resolve options: collection, key, ordering and display field', () => {
    expect(fieldInput(country()).lookup).toEqual({
      dimension: 'countries', key: 'iso2', vocabulary: 'closed',
      present: { label: 'name' }, sortBy: 'name',
    })
  })

  it('reports an open vocabulary so the control can admit a value not in the collection', () => {
    expect(fieldInput(country({ vocabulary: 'open' })).lookup?.vocabulary).toBe('open')
  })

  it('stays a select when the host enumerated the options itself', () => {
    const inp = fieldInput(country(), [{ value: 'th', label: 'Thailand' }])
    expect(inp.kind).toBe('select')
    expect(inp.lookup).toBeUndefined()
  })

  it('stays a select when the collection tier still declared a closed key set', () => {
    expect(fieldInput(country({ keys: ['th', 'jp'] })).kind).toBe('select')
  })

  it('leaves the enumerable tiers alone — no lookup descriptor on a static select', () => {
    const inp = fieldInput(f({
      key: 'priority', widget: 'select',
      lookup: { backing: 'static', vocabulary: 'closed', key: 'id', onDelete: 'restrict', keys: ['low'] },
    } as Parameters<typeof f>[0]))
    expect(inp.kind).toBe('select')
    expect(inp.lookup).toBeUndefined()
  })
})

describe('fieldErrors', () => {
  it('keys issues by the first path segment, first message per field', () => {
    const err = { issues: [
      { message: 'Invalid VAT number', path: ['vatNumber'] },
      { message: 'Required', path: [{ key: 'companyName' }] },   // object segment form
      { message: 'ignored — second on same field', path: ['vatNumber'] },
    ] }
    expect(fieldErrors(err)).toEqual({ vatNumber: 'Invalid VAT number', companyName: 'Required' })
  })

  it('returns {} for non-validation errors (host shows the generic message)', () => {
    expect(fieldErrors(new Error('network down'))).toEqual({})
    expect(fieldErrors(null)).toEqual({})
    expect(fieldErrors({ issues: undefined })).toEqual({})
  })

  it('skips issues with no field path', () => {
    expect(fieldErrors({ issues: [{ message: 'whole-record rule failed', path: [] }] })).toEqual({})
    expect(fieldErrors({ issues: [{ message: 'no path at all' }] })).toEqual({})
  })
})

describe('fieldErrors — MissingTranslationError', () => {
  it('maps a missing-translation failure to its field', () => {
    const err = Object.assign(new Error('Field "title": missing required translation(s): th.'), {
      field: 'title',
      missing: ['th'],
    })
    expect(fieldErrors(err)).toEqual({ title: 'Field "title": missing required translation(s): th.' })
  })

  it('still returns {} for a plain error', () => {
    expect(fieldErrors(new Error('boom'))).toEqual({})
  })

  it('an empty field name falls through to {} (banner path)', () => {
    expect(fieldErrors(Object.assign(new Error('x'), { field: '', missing: ['th'] }))).toEqual({})
  })
})

describe('formFields', () => {
  it('keeps editable fields, drops computed/id/audit', () => {
    const fields = [
      f({ key: 'id' }),
      f({ key: 'total', editable: false }), // computed
      f({ key: 'name' }),
      f({ key: 'buyerId', displayFor: 'buyerName' }),
      f({ key: 'buyerName' }), // display target
    ]
    expect(formFields(fields).map((x) => x.key)).toEqual(['name', 'buyerId'])
  })
})
