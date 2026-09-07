import { describe, it, expect } from 'vitest'
import { toBytes } from '@noy-db/as-noydb'
import { buildVault, openVaultFromBundle } from '../vault'

const PASS = 'spin-the-black-circle'

describe('the secret gates the bundle', () => {
  it('the right secret reads, the wrong secret throws', async () => {
    const { vault } = await buildVault(PASS)
    const col = vault.collection<{ id: string; n: number }>('probe')
    await col.put('a', { id: 'a', n: 1 })
    const bytes = await toBytes(vault)

    // right secret: reads back
    // note: list() (not query().toArray()) is used because list() triggers
    // ensureHydrated(), which loads records from the adapter into the in-memory
    // cache. query().toArray() is synchronous and reads the cache directly —
    // it would return [] on a freshly-loaded vault whose collection cache was
    // cleared by vault.load().
    const reopened = await openVaultFromBundle(bytes, PASS)
    const rows = await reopened.collection<{ id: string; n: number }>('probe').list()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.n).toBe(1)

    // wrong secret: denied
    await expect(openVaultFromBundle(bytes, 'wrong-pass')).rejects.toThrow()
  })
})
