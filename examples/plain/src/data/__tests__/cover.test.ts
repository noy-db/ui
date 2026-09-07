import { describe, it, expect } from 'vitest'
import { makeCover } from '../cover'

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

describe('makeCover', () => {
  it('returns a valid PNG with the magic header', () => {
    const png = makeCover('Kind of Blue')
    expect(Array.from(png.slice(0, 8))).toEqual(PNG_MAGIC)
    expect(png.length).toBeGreaterThan(100)
  })
  it('is deterministic for the same seed and varies by seed', () => {
    expect(Array.from(makeCover('A'))).toEqual(Array.from(makeCover('A')))
    expect(Array.from(makeCover('A'))).not.toEqual(Array.from(makeCover('B')))
  })
})
