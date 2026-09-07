import { describe, it, expect } from 'vitest'
import { seedVault } from '../scripts/seed'
import { loadCoverBytes } from '../app/lib/cover'

describe('loadCoverBytes (live blob round-trip)', () => {
  it('writes a cover into the vault and reads back a PNG', async () => {
    const { vault } = await seedVault()
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    const out = await loadCoverBytes(vault, 'rc01', async () => bytes) // inject fetch
    expect(Array.from(out.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})
