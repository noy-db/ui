import { describe, it, expect } from 'vitest'
import { buildVault, COVER_FIELD, COVER_SLOT } from '../vault'

const PASS = 'spin-the-black-circle'

describe('blob put→get round-trips inside a live vault', () => {
  it('reads back identical bytes from a vault blob', async () => {
    const { vault } = await buildVault(PASS)
    const records = vault.collection<{ id: string; title: string }>('records', {
      blobFields: { [COVER_FIELD]: { retainDays: 36500 } },
    })
    await records.put('r1', { id: 'r1', title: 'Test LP' })

    const original = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5])
    await records.blob('r1').put(COVER_SLOT, original, { mimeType: 'image/png' })
    const got = await records.blob('r1').get(COVER_SLOT)

    expect(got).not.toBeNull()
    expect(Array.from(got!)).toEqual(Array.from(original))
  })
})
