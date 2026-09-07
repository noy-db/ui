import { describe, it, expect } from 'vitest'
import { seedVault } from '../scripts/seed'
import { buildRecordsView } from '../app/lib/collectionView'
import { GENRE_LABELS } from '../src/data/dicts'

describe('buildRecordsView', () => {
  it('produces a joined schema + 24 rows with artist/label names', async () => {
    const { vault } = await seedVault()
    await vault.collection('artists').list()
    await vault.collection('labels').list()
    await vault.collection('records').list()
    const { schema, columns, rows } = buildRecordsView(vault)
    expect(rows).toHaveLength(24)
    expect(columns.some((c) => c.key === 'title')).toBe(true)
    // joinedKey('artist', 'name') === 'artist_name'
    expect((rows[0] as any).artist_name).toBeTruthy()
    expect((rows[0] as any).label_name).toBeTruthy()
    expect(schema.entity).toBe('records')
  }, 30_000)

  it('keeps enum values CANONICAL in rows so the engine filters/groups on stable keys', async () => {
    const { vault } = await seedVault()
    await vault.collection('records').list()
    const { rows } = buildRecordsView(vault)
    const canonical = new Set(Object.keys(GENRE_LABELS)) // 'rock','jazz',… not 'Rock'/'แจ๊ส'
    // Every row's genre must be a canonical key, never a localized display label.
    // Display localization happens in the #cell-genre slot, not in the row data.
    for (const r of rows as any[]) {
      expect(canonical.has(r.genre)).toBe(true)
    }
  }, 30_000)
})
