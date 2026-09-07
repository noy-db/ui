<script setup lang="ts">
// Hand-rolled accessible popover (no Nuxt UI / headless dep). Owns its own a11y: opens on trigger
// click, closes on Escape or outside pointer-down, returns focus to the trigger on close, moves focus
// into the panel on open. The panel is TELEPORTED to <body> and positioned `fixed` from the trigger's
// rect (viewport-clamped, re-placed on scroll/resize) so it escapes any clipped/overflow ancestor —
// e.g. the fit-the-container table uses `overflow-x: clip`, which would otherwise hide an inline panel.
import { ref, reactive, nextTick, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  align?: 'start' | 'end'
  /** Accessible label for the trigger button. */
  label?: string
  /** Classes for the trigger button (the host styles the funnel/affordance). */
  triggerClass?: string
  /** Extra classes applied to the trigger when the panel is open. */
  activeClass?: string
}>(), { align: 'start' })

const emit = defineEmits<{ close: [] }>()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const pos = reactive({ top: 0, left: 0 })

function place(): void {
  const t = triggerEl.value?.getBoundingClientRect()
  const p = panelEl.value
  if (!t || !p) return
  const pw = p.offsetWidth
  const vw = window.innerWidth
  let left = props.align === 'end' ? t.right - pw : t.left
  left = Math.max(8, Math.min(left, vw - pw - 8))
  pos.top = Math.round(t.bottom + 4)
  pos.left = Math.round(left)
}

function onDocPointer(e: PointerEvent): void {
  const target = e.target as Node
  if (!rootEl.value?.contains(target) && !panelEl.value?.contains(target)) close()
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') { e.stopPropagation(); close() }
}
function onReflow(): void { place() }
function listen(on: boolean): void {
  const m = on ? 'addEventListener' : 'removeEventListener'
  document[m]('pointerdown', onDocPointer as EventListener, true)
  document[m]('keydown', onKey as EventListener, true)
  window[m]('scroll', onReflow, true)
  window[m]('resize', onReflow)
}
function openPanel(): void {
  open.value = true
  listen(true)
  nextTick(() => {
    place()
    const focusable = panelEl.value?.querySelector<HTMLElement>('input, button, [tabindex]')
    ;(focusable ?? panelEl.value)?.focus()
  })
}
function close(): void {
  if (!open.value) return
  open.value = false
  listen(false)
  emit('close')
  triggerEl.value?.focus()
}
function toggle(): void { open.value ? close() : openPanel() }
onBeforeUnmount(() => listen(false))
</script>

<template>
  <div ref="rootEl" class="relative inline-flex">
    <button
      ref="triggerEl"
      type="button"
      :class="[triggerClass, open && activeClass]"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="label"
      @click="toggle"
    >
      <slot />
    </button>
    <Teleport to="body">
      <Transition name="nui-pop">
        <div
          v-if="open"
          ref="panelEl"
          class="nui-panel fixed z-50 shadow-xl"
          :style="{ top: pos.top + 'px', left: pos.left + 'px' }"
        >
          <slot name="content" :close="close" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.nui-pop-enter-active {
  animation: nui-pop-in 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.nui-pop-leave-active {
  animation: nui-pop-in 80ms cubic-bezier(0.16, 1, 0.3, 1) reverse both;
}
@keyframes nui-pop-in {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to   { opacity: 1; transform: scale(1)    translateY(0);    }
}
</style>
