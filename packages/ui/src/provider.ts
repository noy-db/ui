// The single configuration surface developers touch. Configure once (a Nuxt plugin calls
// provideNoydbUi, or `nuxtApp.vueApp.provide`); every component reads it via the composables below,
// falling back to safe defaults when unset — so nothing is *required* to render.
import { inject, provide, type InjectionKey } from 'vue'

/** Pluggable LLM transport (host supplies; e.g. Anthropic BYO-key). Used by NL search, AI-fill, … */
export interface LlmClient { complete(prompt: { system: string; user: string }): Promise<string> }

/** Pluggable speech-to-text source (Web Speech now; AI-Edge/Whisper-WASM later). */
export interface VoiceSource {
  supported: boolean
  start(handlers: {
    onResult: (text: string, final: boolean) => void
    onEnd: () => void
    /** Recognition failed to (keep) running — e.g. 'not-allowed' (mic permission), 'network',
     *  'audio-capture'. Callers surface this: capture failing SILENTLY reads as a dead button. */
    onError?: (code: string) => void
  }): void
  stop(): void
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface NoydbUiConfig {
  /** Active locale (data labels still come from describe()/i18nText). */
  locale?: string
  /** Translate a UI string key; receives an English fallback. */
  t?: (key: string, fallback?: string) => string
  /** Initial theme; defaults to 'system'. */
  theme?: ThemeMode
  /** AI client for NL/AI features. */
  llm?: LlmClient
  /** Speech-to-text source for voice input. */
  voice?: VoiceSource
}

/** Injection key — exported so the Nuxt module's plugin can install config app-wide via
 *  `nuxtApp.vueApp.provide(NOYDB_UI_KEY, config)`. */
export const NOYDB_UI_KEY: InjectionKey<NoydbUiConfig> = Symbol('noydb-ui')
const DEFAULTS: NoydbUiConfig = {}

/** Provide the config to a component tree (the module installs it app-wide for you). */
export function provideNoydbUi(config: NoydbUiConfig): void { provide(NOYDB_UI_KEY, config) }
export function useNoydbUi(): NoydbUiConfig { return inject(NOYDB_UI_KEY, DEFAULTS) }
