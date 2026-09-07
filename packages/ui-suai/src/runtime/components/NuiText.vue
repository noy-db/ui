<script setup lang="ts">
// Width-aware text. Given a value's representation ladder (richest → most abbreviated), it climbs the
// compression ladder from @noy-db/ui — abbreviate → font-condense → wrap → ellipsis — to fit the space
// it's given. It self-measures its own width (ResizeObserver) and measures candidate text with a
// shared canvas (no reflow). Use for titles, headers, and cells.
import { ref, computed, onMounted, onBeforeUnmount, watch, type CSSProperties } from 'vue'
import { fitText, repsFor, type TextKind } from '@noy-db/ui'

const props = withDefaults(defineProps<{
  /** Pre-built representation ladder (richest → most abbreviated). Wins over value+kind. */
  reps?: string[]
  /** Or a typed value + kind, from which the ladder is built. */
  value?: unknown
  kind?: TextKind
  /** Currency for kind="money". */
  currency?: string
  /** Available lines (height ÷ line-height). >1 enables wrapping (e.g. a row with a cover image). */
  lines?: number
  /** When a line budget exists, prefer wrapping over hard font-condensing. */
  preferWrap?: boolean
  /** Alignment — drives the squeeze origin so condensed text grows from the correct edge. */
  align?: 'left' | 'right'
}>(), { lines: 1, preferWrap: true, align: 'left' })

const host = ref<HTMLElement | null>(null)
const budget = ref(0)
const fontReady = ref(0) // bumped when web-fonts settle, to re-measure

// One shared canvas context for measureText — synchronous, no layout.
let ctx: CanvasRenderingContext2D | null = null
function measurer(): (s: string) => number {
  const el = host.value
  if (!el || typeof document === 'undefined') return (s) => s.length * 8
  ctx ??= document.createElement('canvas').getContext('2d')
  if (!ctx) return (s) => s.length * 8
  const cs = getComputedStyle(el)
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  return (s) => ctx!.measureText(s).width
}

const reps = computed<string[]>(() =>
  props.reps && props.reps.length ? props.reps
    : props.kind ? repsFor(props.kind, props.value, { currency: props.currency })
      : [String(props.value ?? '')])

const treatment = computed(() => {
  void fontReady.value
  return fitText(reps.value, budget.value, {
    measure: measurer(),
    lineBudget: props.lines,
    preferWrap: props.preferWrap,
  })
})

const innerStyle = computed<CSSProperties>(() => {
  const t = treatment.value
  if (t.wrap) {
    return { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: String(t.lines), overflow: 'hidden', whiteSpace: 'normal' }
  }
  if (t.ellipsis) {
    return { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  }
  return {
    display: 'inline-block',
    whiteSpace: 'nowrap',
    transform: t.scaleX < 1 ? `scaleX(${t.scaleX.toFixed(3)})` : undefined,
    transformOrigin: props.align === 'right' ? 'right center' : 'left center',
    letterSpacing: t.letterSpacing ? `${t.letterSpacing}em` : undefined,
    fontSize: t.fontScale < 1 ? `${t.fontScale.toFixed(3)}em` : undefined,
  }
})

let ro: ResizeObserver | null = null
onMounted(() => {
  if (host.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((e) => { budget.value = e[0]!.contentRect.width })
    ro.observe(host.value)
    budget.value = host.value.clientWidth
  }
  // Re-measure once web fonts finish loading (canvas metrics shift otherwise).
  ;(document as any).fonts?.ready?.then(() => { fontReady.value++ })
})
onBeforeUnmount(() => ro?.disconnect())
watch(() => [props.reps, props.value, props.kind], () => { /* recompute via reps computed */ })
</script>

<template>
  <span ref="host" class="nui-text" :title="treatment.text">
    <span class="nui-text-inner" :style="innerStyle">{{ treatment.text }}</span>
  </span>
</template>

<style scoped>
.nui-text {
  display: block;
  overflow: hidden;
  max-width: 100%;
}
</style>
