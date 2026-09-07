<script setup lang="ts">
// Search mode group — the three "voices" of the search field (spec: docs/superpowers/specs/
// 2026-07-02-search-toolbar-interaction-design.md §2): exact (⌕ deterministic), ask (✨ AI),
// speak (🎤 momentary voice → AI). A segmented radio capsule with a sliding thumb; exact/ask are
// sticky modes, speak is spring-loaded (the thumb visits the mic only while listening). Arming a
// voice also focuses the field — the HOST handles that on update:mode / speak. Nuxt-UI-free.
import { computed, ref } from 'vue'
import { useNuiI18n } from '../core/i18n'

const props = withDefaults(defineProps<{
  mode: 'exact' | 'ask'
  /** Mic is hot (held; push-to-record pressed state). */
  listening?: boolean
  /** An AI request is in flight (the ✨ segment pulses). */
  busy?: boolean
  /** Hide the mic segment entirely when speech input isn't available. */
  micSupported?: boolean
}>(), { listening: false, busy: false, micSupported: false })

const emit = defineEmits<{ 'update:mode': [m: 'exact' | 'ask']; speakStart: []; speakStop: [] }>()
const { t } = useNuiI18n()

// Thumb slot: exact=0, ask=1, speak(listening)=2. Buttons are size-9 (2.25rem) on the shared grid.
const idx = computed(() => (props.listening ? 2 : props.mode === 'ask' ? 1 : 0))

// Push-to-record: hold the mic to capture, release to interpret. A quick TAP (people will tap)
// teaches the gesture with a transient "Hold to speak" hint instead of doing nothing.
const hint = ref(false)
let pressedAt = 0
let hintTimer: ReturnType<typeof setTimeout> | null = null
let keyHeld = false
function micDown(e?: PointerEvent): void {
  pressedAt = Date.now()
  // Keep the release reliable even if the pointer drifts off the button; inactive pointer ids
  // (synthetic events) throw — never let that block the capture start.
  if (e) { try { (e.target as Element).setPointerCapture?.(e.pointerId) } catch { /* inactive pointer */ } }
  emit('speakStart')
}
function micUp(): void {
  emit('speakStop')
  if (Date.now() - pressedAt < 250) {
    hint.value = true
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = setTimeout(() => { hint.value = false }, 1400)
  }
}
function micKeydown(e: KeyboardEvent): void {
  if ((e.key === ' ' || e.key === 'Enter') && !keyHeld) { keyHeld = true; micDown(); e.preventDefault() }
}
function micKeyup(e: KeyboardEvent): void {
  if ((e.key === ' ' || e.key === 'Enter') && keyHeld) { keyHeld = false; micUp(); e.preventDefault() }
}
</script>

<template>
  <div
    class="nui-mode-group relative inline-flex items-center rounded-[var(--radius-control)] bg-nui-bg-accent p-0.5"
    role="radiogroup"
    :aria-label="t('nui.mode.label', 'Search mode')"
  >
    <span
      class="nui-mode-thumb absolute top-0.5 size-9 rounded-[calc(var(--radius-control)-2px)] bg-nui-bg shadow-sm"
      :style="{ transform: `translateX(${idx * 2.25}rem)` }"
      aria-hidden="true"
    />
    <button
      type="button"
      role="radio"
      class="relative size-9 inline-flex items-center justify-center"
      :class="mode === 'exact' && !listening ? 'text-nui-accent' : 'text-nui-muted'"
      :aria-checked="mode === 'exact' && !listening"
      :title="t('nui.mode.exact', 'Search — type exact filters')"
      @click="emit('update:mode', 'exact')"
    >
      <span class="i-lucide-search size-[1.3125rem]" aria-hidden="true" />
    </button>
    <button
      type="button"
      role="radio"
      class="relative size-9 inline-flex items-center justify-center"
      :class="mode === 'ask' && !listening ? 'text-nui-accent' : 'text-nui-muted'"
      :aria-checked="mode === 'ask' && !listening"
      :title="t('nui.mode.ask', 'Ask — describe it, AI interprets')"
      @click="emit('update:mode', 'ask')"
    >
      <span class="i-lucide-sparkles size-[1.3125rem]" :class="busy ? 'animate-pulse' : ''" aria-hidden="true" />
    </button>
    <button
      v-if="micSupported"
      type="button"
      class="relative size-9 inline-flex items-center justify-center touch-none select-none"
      :class="listening ? 'text-red-500' : 'text-nui-muted'"
      :aria-pressed="listening"
      :title="t('nui.mode.speak', 'Hold to speak — voice, AI interprets')"
      @pointerdown.prevent="micDown($event)"
      @pointerup.prevent="micUp"
      @pointercancel="micUp"
      @keydown="micKeydown"
      @keyup="micKeyup"
      @contextmenu.prevent
    >
      <span class="i-lucide-mic size-[1.3125rem]" :class="listening ? 'animate-pulse' : ''" aria-hidden="true" />
    </button>

    <!-- Quick-tap teaching hint: the gesture is hold-to-record. -->
    <span
      v-if="hint"
      class="nui-panel absolute top-full mt-1 right-0 z-20 whitespace-nowrap px-2 py-1 text-[11px] text-nui-muted"
      role="status"
    >{{ t('nui.mode.holdHint', 'Hold to speak') }}</span>
  </div>
</template>

<style scoped>
.nui-mode-thumb {
  left: 2px;
  transition: transform 0.15s ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .nui-mode-thumb { transition: none; }
}
</style>
