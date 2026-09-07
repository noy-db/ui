import { ref, watch, onMounted, type Ref } from 'vue'
import { useNoydbUi, type ThemeMode } from './provider'
// Dark/light via the `.dark` class on <html> — the convention Nuxt UI's theme variables key on.
// 'system' follows prefers-color-scheme. (The ui-suai fork uses data-theme + --nui-* tokens
// instead; same useTheme() API in both forks.)
export function useTheme(): { mode: Ref<ThemeMode>; resolved: Ref<'light' | 'dark'>; set: (m: ThemeMode) => void } {
  const mode = ref<ThemeMode>(useNoydbUi().theme ?? 'system')
  const resolved = ref<'light' | 'dark'>('light')
  function apply(): void {
    const dark = mode.value === 'dark' ||
      (mode.value === 'system' && !!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches)
    resolved.value = dark ? 'dark' : 'light'
    globalThis.document?.documentElement.classList.toggle('dark', dark)
  }
  onMounted(apply); watch(mode, apply)
  return { mode, resolved, set: (m) => { mode.value = m } }
}
