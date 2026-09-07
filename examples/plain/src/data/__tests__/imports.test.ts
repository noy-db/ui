import { describe, it, expect } from 'vitest'
import { createNoydb } from '@noy-db/hub'
import { toMemory } from '@noy-db/to-memory'
import { toBytes } from '@noy-db/as-noydb'

describe('sibling runtime resolves', () => {
  it('exports are functions', () => {
    expect(typeof createNoydb).toBe('function')
    expect(typeof toMemory).toBe('function')
    expect(typeof toBytes).toBe('function')
  })
})
