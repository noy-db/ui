import { describe, it, expect } from 'vitest'
import { createApp } from 'vue'
import { NOYDB_UI_KEY, useNoydbUi, type NoydbUiConfig, type LlmClient } from './provider'
import { useNuiI18n } from './i18n'
import { useLlm } from './llm'

// `inject` needs an app context but not a DOM: runWithContext gives us one without mounting, so
// these stay in the package's plain node vitest run.
function withConfig<T>(config: NoydbUiConfig | null, fn: () => T): T {
  const app = createApp({})
  if (config) app.provide(NOYDB_UI_KEY, config)
  return app.runWithContext(fn)
}

describe('useNoydbUi', () => {
  it('falls back to an empty config when nothing was provided', () => {
    expect(withConfig(null, () => useNoydbUi())).toEqual({})
  })

  it('reads the provided config', () => {
    const cfg: NoydbUiConfig = { locale: 'th', theme: 'dark' }
    expect(withConfig(cfg, () => useNoydbUi())).toEqual(cfg)
  })
})

describe('useNuiI18n', () => {
  it('is usable with zero i18n setup — English fallbacks, locale en', () => {
    const { locale, t } = withConfig(null, () => useNuiI18n())
    expect(locale).toBe('en')
    expect(t('nui.save', 'Save')).toBe('Save')
  })

  it('returns the key itself when a string has no fallback', () => {
    expect(withConfig(null, () => useNuiI18n()).t('nui.save')).toBe('nui.save')
  })

  it('uses the configured translator and locale', () => {
    const { locale, t } = withConfig(
      { locale: 'th', t: (k, f) => (k === 'nui.save' ? 'บันทึก' : (f ?? k)) },
      () => useNuiI18n(),
    )
    expect(locale).toBe('th')
    expect(t('nui.save', 'Save')).toBe('บันทึก')
    expect(t('nui.cancel', 'Cancel')).toBe('Cancel') // untranslated key still degrades to English
  })
})

describe('useLlm', () => {
  it('is null when AI features are not wired, so callers can degrade', () => {
    expect(withConfig(null, () => useLlm())).toBeNull()
  })

  it('returns the configured client', () => {
    const llm: LlmClient = { complete: async () => 'ok' }
    expect(withConfig({ llm }, () => useLlm())).toBe(llm)
  })
})
