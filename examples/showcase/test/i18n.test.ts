import { describe, it, expect } from 'vitest'
import { useShowcaseI18n } from '../app/composables/useShowcaseI18n'

describe('useShowcaseI18n', () => {
  it('localizes enum values + field headers + chrome for en/th', () => {
    const i = useShowcaseI18n()
    i.setLocale('en')
    expect(i.enumLabel('genre', 'rock')).toBe('Rock')
    expect(i.fieldLabel('records', 'title')).toBe('Title')
    i.setLocale('th')
    expect(i.enumLabel('genre', 'rock')).toBe('ร็อก')
    expect(i.fieldLabel('records', 'title')).toBe('ชื่ออัลบั้ม')
    expect(i.t('nav.records', 'Records')).toBeTruthy()
  })
})
