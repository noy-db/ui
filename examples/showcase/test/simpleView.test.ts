import { describe, it, expect } from 'vitest'
import { seedVault } from '../scripts/seed'
import { buildSimpleView } from '../app/lib/simpleView'

describe('buildSimpleView', () => {
  it('builds schema + rows for artists (9) and labels (5)', async () => {
    const { vault } = await seedVault()
    await vault.collection('artists').list()
    await vault.collection('labels').list()
    expect(buildSimpleView(vault, 'artists').rows).toHaveLength(9)
    expect(buildSimpleView(vault, 'labels').rows).toHaveLength(5)
  }, 30_000)
})
