// Re-exported from @noy-db/ui so both bindings share one configuration surface. Kept as a file in
// this directory because the Nuxt module auto-imports it via addImportsDir('./runtime/core').
export {
  provideNoydbUi, useNoydbUi, NOYDB_UI_KEY,
  type NoydbUiConfig, type LlmClient, type VoiceSource, type ThemeMode,
} from '@noy-db/ui'
