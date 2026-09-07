<script setup lang="ts">
// Square image cropper for the cover upload: a fixed frame the picked image pans/zooms within
// (object-fit: cover at zoom 1), rendered to a target-size PNG on confirm. The geometry is the
// pure `@noy-db/ui` crop helpers; this component only owns the pointer drag + canvas export.
import { ref, computed, watch } from 'vue'
import { clampOffset, cropRect, displaySize } from '@noy-db/ui'

const props = withDefaults(defineProps<{
  /** Object URL of the picked image. */
  src: string
  /** Display frame size (px). */
  frame?: number
  /** Output square size (px). */
  output?: number
  /** Crop shape — `circle` outputs a round PNG with transparent corners (a profile photo). */
  shape?: 'square' | 'circle'
  /** Confirm-button label. */
  confirmLabel?: string
}>(), { frame: 288, output: 512, shape: 'square', confirmLabel: 'Save' })

const emit = defineEmits<{ confirm: [bytes: Uint8Array]; cancel: [] }>()

const imgEl = ref<HTMLImageElement | null>(null)
const natW = ref(0)
const natH = ref(0)
const zoom = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const busy = ref(false)

const ready = computed(() => natW.value > 0)
const disp = computed(() => displaySize(natW.value, natH.value, props.frame, zoom.value))

function reclamp(): void {
  offsetX.value = clampOffset(offsetX.value, disp.value.w, props.frame)
  offsetY.value = clampOffset(offsetY.value, disp.value.h, props.frame)
}
function onLoad(): void {
  const el = imgEl.value
  if (!el) return
  natW.value = el.naturalWidth
  natH.value = el.naturalHeight
  reclamp()
}
watch(zoom, reclamp)

let dragging = false
let lastX = 0
let lastY = 0
function onDown(e: PointerEvent): void {
  dragging = true; lastX = e.clientX; lastY = e.clientY
  ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
}
function onMove(e: PointerEvent): void {
  if (!dragging) return
  offsetX.value = clampOffset(offsetX.value + (e.clientX - lastX), disp.value.w, props.frame)
  offsetY.value = clampOffset(offsetY.value + (e.clientY - lastY), disp.value.h, props.frame)
  lastX = e.clientX; lastY = e.clientY
}
function onUp(): void { dragging = false }

async function confirm(): Promise<void> {
  const el = imgEl.value
  if (!el || busy.value) return
  busy.value = true
  try {
    const { sx, sy, sw, sh } = cropRect({
      imageW: natW.value, imageH: natH.value, frame: props.frame,
      zoom: zoom.value, offsetX: offsetX.value, offsetY: offsetY.value,
    })
    const canvas = document.createElement('canvas')
    canvas.width = props.output; canvas.height = props.output
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(el, sx, sy, sw, sh, 0, 0, props.output, props.output)
    if (props.shape === 'circle') {
      // Keep only the inscribed circle — transparent corners, a round profile photo.
      ctx.globalCompositeOperation = 'destination-in'
      ctx.beginPath()
      ctx.arc(props.output / 2, props.output / 2, props.output / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (blob) emit('confirm', new Uint8Array(await blob.arrayBuffer()))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <div
      class="relative overflow-hidden bg-nui-bg-accent mx-auto rounded select-none"
      :style="{ width: `${frame}px`, height: `${frame}px`, touchAction: 'none', cursor: 'grab' }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointerleave="onUp"
    >
      <img
        ref="imgEl"
        :src="src"
        alt=""
        draggable="false"
        @load="onLoad"
        :style="{ position: 'absolute', left: `${offsetX}px`, top: `${offsetY}px`, width: `${disp.w}px`, height: `${disp.h}px`, maxWidth: 'none' }"
      >
      <div
        class="absolute pointer-events-none"
        :style="`inset:0; ${shape === 'circle'
          ? 'border-radius:50%; box-shadow: 0 0 0 9999px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.55)'
          : 'box-shadow: inset 0 0 0 1px var(--nui-border)'}`"
      />
    </div>

    <div class="flex items-center gap-2">
      <span class="i-lucide-zoom-out size-4 text-nui-muted shrink-0" aria-hidden="true" />
      <input v-model.number="zoom" type="range" min="1" max="4" step="0.01" class="flex-1" aria-label="Zoom">
      <span class="i-lucide-zoom-in size-4 text-nui-muted shrink-0" aria-hidden="true" />
    </div>

    <div class="flex justify-end gap-2">
      <button type="button" class="nui-btn-ghost px-3 py-1.5" @click="emit('cancel')">Cancel</button>
      <button type="button" class="nui-btn bg-nui-accent text-nui-accent-fg px-3 py-1.5" :disabled="!ready || busy" @click="confirm">
        {{ busy ? '…' : confirmLabel }}
      </button>
    </div>
  </div>
</template>
