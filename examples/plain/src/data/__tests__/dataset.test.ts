import { describe, it, expect } from 'vitest'
import { artists, labels, records } from '../dataset'
import { ArtistSchema, LabelSchema, RecordSchema, GENRES, FORMATS, CONDITIONS } from '../types'

describe('dataset integrity', () => {
  it('has the required counts', () => {
    expect(artists).toHaveLength(9)
    expect(labels).toHaveLength(5)
    expect(records).toHaveLength(24)
  })
  it('every row matches its schema', () => {
    for (const a of artists) expect(ArtistSchema.safeParse(a).success).toBe(true)
    for (const l of labels) expect(LabelSchema.safeParse(l).success).toBe(true)
    for (const r of records) expect(RecordSchema.safeParse(r).success).toBe(true)
  })
  it('refs resolve and enums are in range', () => {
    const artistIds = new Set(artists.map((a) => a.id))
    const labelIds = new Set(labels.map((l) => l.id))
    for (const r of records) {
      expect(artistIds.has(r.artistId)).toBe(true)
      expect(labelIds.has(r.labelId)).toBe(true)
      expect(GENRES).toContain(r.genre)
      expect(FORMATS).toContain(r.format)
      expect(CONDITIONS).toContain(r.condition)
    }
  })
  it('ids are unique within each collection', () => {
    expect(new Set(records.map((r) => r.id)).size).toBe(24)
  })
})
