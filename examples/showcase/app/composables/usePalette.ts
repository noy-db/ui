import { ref } from 'vue'

type Palette = 'bluenote' | 'hifi' | 'whitelabel' | 'speed'

const STORAGE_KEY = 'showcase.palette'

// Module-level ref — shared across all callers
const palette = ref<Palette>('bluenote')

function setPalette(p: Palette) {
  palette.value = p
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-palette', p)
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, p)
  }
}

/** Call once on app mount to restore the persisted palette and apply it to <html>. */
function initPalette() {
  if (typeof localStorage === 'undefined') return
  const stored = localStorage.getItem(STORAGE_KEY) as Palette | null
  if (stored === 'bluenote' || stored === 'hifi' || stored === 'whitelabel' || stored === 'speed') {
    setPalette(stored)
  } else {
    // Apply default so data-palette attribute is set even without a stored value
    setPalette(palette.value)
  }
}

export function usePalette() {
  return { palette, setPalette, initPalette }
}
