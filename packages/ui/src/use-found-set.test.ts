import { describe, it, expect } from 'vitest'
import { captureFoundSet, useFoundSet, setReturnAnchor, consumeReturnAnchor, rememberDirection, recallDirection } from './use-found-set'
import type { FoundSetSnapshot } from './traverse'

const snap = (entity: string): FoundSetSnapshot => ({
  kind: 'query', entity, query: 'x', title: 't', items: [{ id: 'a', label: 'A' }], total: 1, capturedAt: 'now',
})

describe('found-set store', () => {
  it('capture is per-entity and reactive through useFoundSet', () => {
    const records = useFoundSet('fs-records')
    expect(records.snapshot.value).toBeNull()
    captureFoundSet(snap('fs-records'))
    expect(records.snapshot.value!.items[0]!.id).toBe('a')
    expect(useFoundSet('fs-artists').snapshot.value).toBeNull() // isolation
  })
  it('clear() empties only its entity', () => {
    captureFoundSet(snap('fs-c1')); captureFoundSet(snap('fs-c2'))
    useFoundSet('fs-c1').clear()
    expect(useFoundSet('fs-c1').snapshot.value).toBeNull()
    expect(useFoundSet('fs-c2').snapshot.value).not.toBeNull()
  })
  it('return anchor is one-shot', () => {
    setReturnAnchor('fs-r', { query: 'genre:jazz', id: 'rc02' })
    expect(consumeReturnAnchor('fs-r')).toEqual({ query: 'genre:jazz', id: 'rc02' })
    expect(consumeReturnAnchor('fs-r')).toBeNull()
  })
  it('direction memory survives across reads and defaults to forward', () => {
    expect(recallDirection('fs-dir')).toBe(1)
    rememberDirection('fs-dir', -1)
    expect(recallDirection('fs-dir')).toBe(-1)
    expect(recallDirection('fs-dir')).toBe(-1) // NOT one-shot — a chain of deleted records keeps skipping the same way
  })
})
