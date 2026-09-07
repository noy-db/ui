import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'
// Viewport + pointer awareness for touch/small-screen variants (e.g. Popover → bottom sheet, List →
// cards). Components already drop columns via @container; this adds device-level signals.
export function useViewport(): { width: Ref<number>; coarse: Ref<boolean>; isSmall: () => boolean } {
  const width = ref(Infinity); const coarse = ref(false)
  function update(): void {
    width.value = globalThis.innerWidth ?? Infinity
    coarse.value = !!globalThis.matchMedia?.('(pointer: coarse)').matches
  }
  onMounted(() => { update(); globalThis.addEventListener?.('resize', update) })
  onBeforeUnmount(() => globalThis.removeEventListener?.('resize', update))
  return { width, coarse, isSmall: () => width.value < 640 }
}
