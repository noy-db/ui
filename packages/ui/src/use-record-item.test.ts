import { describe, it, expect } from 'vitest'
import { useRecordItem, type ItemCollection } from './use-record-item'

type Rec = { id: string; title: Record<string, string>; year: number }

function fakeCollection(initial: Rec, opts: { failPut?: unknown } = {}) {
  let stored = structuredClone(initial)
  const calls: { get: unknown[][]; put: unknown[][] } = { get: [], put: [] }
  const collection: ItemCollection<Rec> = {
    async get(id, readOptions) { calls.get.push([id, readOptions]); return structuredClone(stored) },
    async put(id, record) {
      calls.put.push([id, structuredClone(record)])
      if (opts.failPut) throw opts.failPut
      stored = structuredClone(record)
    },
  }
  return { collection, calls, current: () => stored }
}

const REC: Rec = { id: 'r1', title: { en: 'First' }, year: 1990 }

describe('useRecordItem', () => {
  it('load() fetches with { locale: "raw" } by default', async () => {
    const { collection, calls } = fakeCollection(REC)
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    expect(item.record.value).toEqual(REC)
    expect(calls.get[0]).toEqual(['r1', { locale: 'raw' }])
  })

  it('enterEdit deep-clones into draft; edits do not touch the record', async () => {
    const { collection } = fakeCollection(REC)
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    item.enterEdit()
    item.draft.value!.title.en = 'Changed'
    expect(item.record.value!.title.en).toBe('First')
    expect(item.dirty.value).toBe(true)
  })

  it('cancel() drops the draft and exits edit', async () => {
    const { collection } = fakeCollection(REC)
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    item.enterEdit()
    item.draft.value!.year = 2000
    item.cancel()
    expect(item.editing.value).toBe(false)
    expect(item.draft.value).toBeNull()
    expect(item.dirty.value).toBe(false)
  })

  it('submit() puts the draft, re-fetches, exits edit', async () => {
    const { collection, calls } = fakeCollection(REC)
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    item.enterEdit()
    item.draft.value!.year = 2001
    expect(await item.submit()).toBe(true)
    expect(calls.put[0]![0]).toBe('r1')
    expect((calls.put[0]![1] as Rec).year).toBe(2001)
    expect(item.record.value!.year).toBe(2001) // re-fetched
    expect(item.editing.value).toBe(false)
    expect(item.errors.value).toEqual({})
  })

  it('a validation failure populates per-field errors and stays in edit', async () => {
    const failPut = { issues: [{ message: 'Too small', path: ['year'] }] } // SchemaValidationError shape
    const { collection } = fakeCollection(REC, { failPut })
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    item.enterEdit()
    item.draft.value!.year = 3
    expect(await item.submit()).toBe(false)
    expect(item.errors.value).toEqual({ year: 'Too small' })
    expect(item.errorBanner.value).toBeNull()
    expect(item.editing.value).toBe(true)
  })

  it('a non-validation failure sets the generic banner', async () => {
    const { collection } = fakeCollection(REC, { failPut: new Error('store offline') })
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    item.enterEdit()
    expect(await item.submit()).toBe(false)
    expect(item.errors.value).toEqual({})
    expect(item.errorBanner.value).toBe('store offline')
  })

  it('editing again after an error clears stale errors on enterEdit', async () => {
    const { collection } = fakeCollection(REC, { failPut: new Error('x') })
    const item = useRecordItem({ collection, id: 'r1' })
    await item.load()
    item.enterEdit()
    await item.submit()
    item.cancel()
    item.enterEdit()
    expect(item.errorBanner.value).toBeNull()
    expect(item.errors.value).toEqual({})
  })

  it('enterEdit clones through a foreign proxy (hub sealed-view records)', async () => {
    // the hub wraps records in its own Proxy; structuredClone throws on any Proxy
    const proxied: ItemCollection<Rec> = {
      async get() { return new Proxy(structuredClone(REC), {}) },
      async put() {},
    }
    const item = useRecordItem({ collection: proxied, id: 'r1' })
    await item.load()
    item.enterEdit()                       // must not throw DataCloneError
    expect(item.draft.value).toEqual(REC)  // plain clone, structurally equal
    item.draft.value!.title.en = 'X'
    expect(item.record.value!.title.en).toBe('First') // still isolated from the record
  })
})
