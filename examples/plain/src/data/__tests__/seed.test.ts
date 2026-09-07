import { describe, it, expect } from 'vitest'
import { ref } from '@noy-db/hub'
import { toBytes } from '@noy-db/as-noydb'
import { seedVault, coverFiles } from '../../../scripts/seed'
import { openVaultFromBundle } from '../vault'
import { GENRE_LABELS } from '../dicts'

const PASS = 'spin-the-black-circle'

describe('seeded vault', () => {
  it('round-trips 24 records with joins, covers, and TH/EN labels', async () => {
    const { vault, recordIds } = await seedVault()
    const bytes = await toBytes(vault)
    const v = await openVaultFromBundle(bytes, PASS)

    // Reopened caches are empty — declare records with its refs (so joins know
    // their target collections) and hydrate all three collections first (Task 2 finding).
    const records = v.collection('records', {
      refs: { artistId: ref('artists', 'warn'), labelId: ref('labels', 'warn') },
    })
    await records.list()
    await v.collection('artists').list()
    await v.collection('labels').list()
    const rows = records.query().join('artistId', { as: 'artist' }).join('labelId', { as: 'label' }).toArray()
    expect(rows).toHaveLength(24)
    expect((rows[0] as any).artist).toBeTruthy()      // join resolved
    expect((rows[0] as any).label).toBeTruthy()

    const covers = coverFiles(recordIds)  // covers ship as static PNG assets, not in the bundle
    expect(covers).toHaveLength(24)
    expect(Array.from(covers[0]!.bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])

    // Serial ids: the sequence service allocated formatted serials in dataset order.
    expect(recordIds.get('rc01')).toBe('RC-001')
    expect(covers[0]!.id).toBe('RC-001')

    // Static lookup tables live in-code; raw enum key persists, labels come app-side from dicts.ts.
    const rec = await records.get('RC-001')
    expect((rec as any).genre).toBe('rock')
    expect((rec as any).artistId).toMatch(/^AR-\d{3}$/)
    expect(GENRE_LABELS['rock']).toEqual({ en: 'Rock', th: 'ร็อก' })
  }, 30_000)
})
