import { describe, it, expect } from 'vitest'
import { dict } from '@noy-db/hub'
import { buildVault } from '../vault'

const PASS = 'spin-the-black-circle'

describe('enum labels localize per locale', () => {
  it('resolves a dict label in EN and TH', async () => {
    const { vault } = await buildVault(PASS)
    const records = vault.collection<{ id: string; genre: string }>('records', {
      lookupFields: { genre: dict('genre', { keys: ['rock', 'jazz'] }) },
    })
    const genres = vault.dictionary('genre')
    await genres.put('rock', { en: 'Rock', th: 'ร็อก' })
    await genres.put('jazz', { en: 'Jazz', th: 'แจ๊ส' })

    await records.put('r1', { id: 'r1', genre: 'rock' })

    const en = await records.get('r1', { locale: 'en' })
    const th = await records.get('r1', { locale: 'th' })
    expect((en as any).genreLabel).toBe('Rock')
    expect((th as any).genreLabel).toBe('ร็อก')
  })
})
