// The skim controller (spec D8): every step moves a lightweight cursor instantly
// (labels from the snapshot — zero data access); a settle debounce triggers the real
// record load, generation-guarded so a stale settle can never fire after a newer
// interaction. Slow clicks screen records; fast clicks skim titles.
import { ref, computed, watch, getCurrentScope, onScopeDispose, type Ref, type ComputedRef } from 'vue'
import { positionOf, itemAt, type FoundSetSnapshot, type FoundSetItem, type TraversePosition } from './traverse'

export function useTraverse(opts: {
  snapshot: () => FoundSetSnapshot | null
  currentId: () => string
  settleMs?: number
  onSettle: (id: string) => void
}): {
  cursor: Ref<number>
  cursorItem: ComputedRef<FoundSetItem | null>
  position: ComputedRef<TraversePosition | null>
  skimming: Ref<boolean>
  lastDirection: Ref<1 | -1>
  go: (delta: number) => void
  goTo: (index: number) => void
  first: () => void
  last: () => void
} {
  const settleMs = opts.settleMs ?? 250
  const cursor = ref(0)
  const skimming = ref(false)
  const lastDirection = ref<1 | -1>(1)
  let timer: ReturnType<typeof setTimeout> | null = null
  let generation = 0

  const cursorItem = computed(() => {
    const s = opts.snapshot()
    return s ? itemAt(s, cursor.value) : null
  })
  const position = computed<TraversePosition | null>(() => {
    const s = opts.snapshot()
    const it = cursorItem.value
    return s && it ? positionOf(s, it.id) : null
  })

  function settle(immediate: boolean): void {
    if (timer) { clearTimeout(timer); timer = null }
    const gen = ++generation
    const fire = (): void => {
      if (gen !== generation) return
      const it = cursorItem.value
      if (it && it.id !== opts.currentId()) opts.onSettle(it.id)
    }
    if (immediate) fire()
    else timer = setTimeout(fire, settleMs)
  }

  function moveTo(index: number, immediate: boolean): void {
    const s = opts.snapshot()
    if (!s || s.items.length === 0) return
    const clamped = Math.min(Math.max(index, 0), s.items.length - 1)
    const noop = clamped === cursor.value
    if (index > cursor.value) lastDirection.value = 1
    else if (index < cursor.value) lastDirection.value = -1
    if (noop) return // clamped to where we already are: don't skim, leave any armed settle alone
    cursor.value = clamped
    skimming.value = true
    settle(immediate)
  }

  const go = (delta: number): void => moveTo(cursor.value + delta, false)
  const goTo = (index: number): void => moveTo(index, true)
  const first = (): void => moveTo(0, true)
  const last = (): void => {
    const s = opts.snapshot()
    if (s) moveTo(s.items.length - 1, true)
  }

  watch(() => opts.currentId(), (id) => {
    // external navigation invalidates any in-flight skim intent (spec D4); harmless in the
    // self-settle path, since currentId only changes from our own onSettle after that settle fired.
    if (timer) { clearTimeout(timer); timer = null }
    generation++
    const s = opts.snapshot()
    const p = s ? positionOf(s, id) : null
    if (p) cursor.value = p.index
    skimming.value = false
  }, { immediate: true, flush: 'sync' })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (timer) { clearTimeout(timer); timer = null }
      generation++
    })
  }

  return { cursor, cursorItem, position, skimming, lastDirection, go, goTo, first, last }
}
