// Runtime plugin added by the @noy-db/ui-nuxt module. Installs the (serializable) config — theme +
// locale, from the module options via runtimeConfig — app-wide, so every component's useNoydbUi()
// resolves it; and applies the initial theme to <html>. Non-serializable layers (llm/voice) are
// provided by the host at runtime via provideNoydbUi() / useNoydbUiConfig.
import { NOYDB_UI_KEY, type NoydbUiConfig, type ThemeMode } from './core/provider'
import { defineNuxtPlugin, useRuntimeConfig } from 'nuxt/app'

export default defineNuxtPlugin((nuxtApp) => {
  const opts = (useRuntimeConfig().public.noydbUi ?? {}) as { theme?: ThemeMode; locale?: string }
  const config: NoydbUiConfig = { theme: opts.theme ?? 'system', locale: opts.locale ?? 'en' }
  nuxtApp.vueApp.provide(NOYDB_UI_KEY, config)

  // apply the initial theme (useTheme() takes over reactively once a component mounts)
  const dark = config.theme === 'dark' ||
    (config.theme === 'system' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
})
