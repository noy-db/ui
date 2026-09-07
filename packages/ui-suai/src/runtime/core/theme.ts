import { ref, watch, onMounted, type Ref } from 'vue'
import { useNoydbUi, type ThemeMode } from './provider'
// Dark/light via a `data-theme` attribute on <html>; the --nui-* token sets do the rest (no JS in
// components). 'system' follows prefers-color-scheme. Tokens live in src/style/tokens.css.
export function useTheme(): { mode: Ref<ThemeMode>; resolved: Ref<'light' | 'dark'>; set: (m: ThemeMode) => void } {
  const mode = ref<ThemeMode>(useNoydbUi().theme ?? 'system')
  const resolved = ref<'light' | 'dark'>('light')
  function apply(): void {
    const dark = mode.value === 'dark' ||
      (mode.value === 'system' && !!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches)
    resolved.value = dark ? 'dark' : 'light'
    globalThis.document?.documentElement.setAttribute('data-theme', resolved.value)
  }
  onMounted(apply); watch(mode, apply)
  return { mode, resolved, set: (m) => { mode.value = m } }
}
