import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'
// Container-measured size for the Item family — the element-level counterpart of useViewport().
// Same tier thresholds as CollectionList's densityFor, so cards and tables agree on density.
export type ContainerSize = 'sm' | 'md' | 'lg'

export function useContainerSize(host: Ref<HTMLElement | null>): { width: Ref<number>; size: Ref<ContainerSize> } {
  const width = ref(Number.POSITIVE_INFINITY) // widest-first: render everything until measured
  const size = ref<ContainerSize>('lg')
  let ro: ResizeObserver | null = null

  function apply(w: number): void {
    width.value = w
    size.value = w < 448 ? 'sm' : w < 640 ? 'md' : 'lg'
  }

  onMounted(() => {
    if (!host.value || typeof ResizeObserver === 'undefined') return
    ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w !== undefined && w > 0) apply(w)
    })
    ro.observe(host.value)
    const w = host.value.getBoundingClientRect().width
    if (w > 0) apply(w)
  })
  onBeforeUnmount(() => { ro?.disconnect(); ro = null })

  return { width, size }
}
