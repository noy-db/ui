import { describe, it, expect } from 'vitest'
import { FIELD_TYPE_ICON, fieldTypeIcon } from './field-icons'
import type { FieldType } from './types'

const ALL_TYPES: FieldType[] = ['enum', 'entity', 'date', 'money', 'number', 'text']

describe('fieldTypeIcon', () => {
  it('maps every FieldType to a lucide icon class', () => {
    for (const t of ALL_TYPES) {
      expect(fieldTypeIcon(t)).toBe(FIELD_TYPE_ICON[t])
      expect(fieldTypeIcon(t)).toMatch(/^i-lucide-[a-z0-9-]+$/)
    }
  })

  it('gives each type a distinct icon (a legible type legend)', () => {
    const icons = ALL_TYPES.map(fieldTypeIcon)
    expect(new Set(icons).size).toBe(ALL_TYPES.length)
  })
})
