import { ref, computed } from 'vue'

const STORAGE_KEY = 'showcase.anthropic-key'

// Module-level singleton: shared across all useApiKey() calls so every component sees the same key.
const key = ref<string | null>(null)

// Hydrate from localStorage on module load (SSR is off for this showcase, but guard anyway).
if (typeof window !== 'undefined') {
  key.value = localStorage.getItem(STORAGE_KEY)
}

export function useApiKey() {
  return {
    key,
    hasKey: computed(() => !!key.value),
    saveKey(k: string) {
      key.value = k
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, k)
    },
    forgetKey() {
      key.value = null
      if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY)
    },
  }
}
