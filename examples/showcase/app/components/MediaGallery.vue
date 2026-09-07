<script setup lang="ts">
// Media blob UI (Pattern ②): a record's images + video, shown either as a uniform-tile GALLERY or a
// preview LIST. Images show their pixel dimensions, videos a play badge + duration; clicking any
// item opens a lightbox (full image, or the video with controls). Drag-and-drop / click to add.
// The item view models are the record's `att:` blobs filtered to media; this component owns the
// objectURL lifecycle and reads dimensions/duration off the decoded media.
import { ref, computed, watch, onUnmounted } from 'vue'
import { fileCategory, type AttachmentItem } from '@noy-db/ui'

const props = withDefaults(defineProps<{
  items: AttachmentItem[]
  loadBytes: (slot: string) => Promise<Uint8Array | null>
  busy?: boolean
}>(), { items: () => [], busy: false })
const emit = defineEmits<{ upload: [File]; remove: [slot: string] }>()

const view = ref<'gallery' | 'list'>('gallery')
const urls = ref<Record<string, string>>({})
const meta = ref<Record<string, { w?: number; h?: number; dur?: number }>>({})
const confirming = ref<string | null>(null)
const lightbox = ref<string | null>(null)
const fileEl = ref<HTMLInputElement | null>(null)
const inFlight = new Set<string>()

const rows = computed(() => props.items.map((item) => {
  const isVideo = fileCategory(item.mime, item.filename).category === 'video'
  const m = meta.value[item.slot] ?? {}
  const parts: string[] = []
  if (isVideo && m.dur) parts.push(fmtDur(m.dur))
  if (m.w) parts.push(`${m.w}×${m.h}`)
  parts.push(item.humanSize)
  return { item, isVideo, dur: isVideo ? fmtDur(m.dur) : '', sub: parts.join(' · ') }
}))

async function sync(): Promise<void> {
  if (import.meta.server) return
  const want = new Set(props.items.map((i) => i.slot))
  for (const slot of Object.keys(urls.value)) {
    if (!want.has(slot)) { URL.revokeObjectURL(urls.value[slot]!); const n = { ...urls.value }; delete n[slot]; urls.value = n }
  }
  for (const it of props.items) {
    if (urls.value[it.slot] || inFlight.has(it.slot)) continue
    inFlight.add(it.slot)
    let bytes: Uint8Array | null = null
    try { bytes = await props.loadBytes(it.slot) } catch { bytes = null }
    inFlight.delete(it.slot)
    if (!bytes || urls.value[it.slot] || !props.items.some((i) => i.slot === it.slot)) continue
    urls.value = { ...urls.value, [it.slot]: URL.createObjectURL(new Blob([bytes as BlobPart], { type: it.mime })) }
  }
}
watch(() => props.items.map((i) => i.slot).join('|'), sync, { immediate: true })
onUnmounted(() => { for (const u of Object.values(urls.value)) URL.revokeObjectURL(u); if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey) })

function setMeta(slot: string, m: { w?: number; h?: number; dur?: number }): void { meta.value = { ...meta.value, [slot]: { ...(meta.value[slot] ?? {}), ...m } } }
function onImgMeta(slot: string, e: Event): void { const i = e.target as HTMLImageElement; setMeta(slot, { w: i.naturalWidth, h: i.naturalHeight }) }
function onVideoMeta(slot: string, e: Event): void { const v = e.target as HTMLVideoElement; setMeta(slot, { w: v.videoWidth, h: v.videoHeight, dur: v.duration }); try { v.currentTime = 0.1 } catch { /* seek to render a poster frame */ } }
function fmtDur(s?: number): string { if (!s || !Number.isFinite(s)) return ''; const m = Math.floor(s / 60); return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}` }

const lightboxRow = computed(() => rows.value.find((r) => r.item.slot === lightbox.value) ?? null)
const lightboxIndex = computed(() => rows.value.findIndex((r) => r.item.slot === lightbox.value))

// Step through the media in the lightbox (wraps). Arrow keys mirror the on-screen arrows.
function step(delta: number): void {
  if (!lightbox.value || rows.value.length < 2) return
  const i = rows.value.findIndex((r) => r.item.slot === lightbox.value)
  if (i < 0) return
  const n = rows.value.length
  lightbox.value = rows.value[(i + delta + n) % n]!.item.slot
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'ArrowLeft') step(-1)
  else if (e.key === 'ArrowRight') step(1)
  else if (e.key === 'Escape') lightbox.value = null
}
watch(lightbox, (open) => {
  if (typeof window === 'undefined') return
  if (open) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})

function pick(): void { fileEl.value?.click() }
function sendFiles(list: FileList | null | undefined): void { if (list) for (const f of Array.from(list)) emit('upload', f) }
function onFile(e: Event): void { const i = e.target as HTMLInputElement; sendFiles(i.files); i.value = '' }

const dragging = ref(false)
let depth = 0
function onDragEnter(): void { depth += 1; dragging.value = true }
function onDragLeave(): void { depth = Math.max(0, depth - 1); if (depth === 0) dragging.value = false }
function onDrop(e: DragEvent): void { depth = 0; dragging.value = false; if (!props.busy) sendFiles(e.dataTransfer?.files) }
</script>

<template>
  <section
    class="mg-panel nui-panel nui-card"
    :class="{ 'mg-dragging': dragging }"
    @dragenter.prevent="onDragEnter" @dragover.prevent @dragleave.prevent="onDragLeave" @drop.prevent="onDrop"
  >
    <div class="mg-head">
      <span class="i-lucide-images size-4 text-nui-muted" aria-hidden="true" />
      <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted">Media</h3>
      <span v-if="items.length" class="text-[10px] text-nui-subtle tabular-nums">{{ items.length }}</span>
      <div v-if="items.length" class="mg-toggle">
        <button type="button" :class="{ on: view === 'gallery' }" aria-label="Gallery view" @click="view = 'gallery'"><span class="i-lucide-layout-grid size-3.5" aria-hidden="true" /></button>
        <button type="button" :class="{ on: view === 'list' }" aria-label="List view" @click="view = 'list'"><span class="i-lucide-list size-3.5" aria-hidden="true" /></button>
      </div>
    </div>

    <!-- Gallery: uniform square tiles -->
    <ul v-if="items.length && view === 'gallery'" class="mg-grid">
      <li v-for="row in rows" :key="row.item.slot" class="mg-tile group">
        <button type="button" class="mg-tile-hit" :aria-label="row.item.filename" @click="lightbox = row.item.slot">
          <video v-if="row.isVideo" :src="urls[row.item.slot]" muted playsinline preload="metadata" @loadedmetadata="onVideoMeta(row.item.slot, $event)" />
          <img v-else-if="urls[row.item.slot]" :src="urls[row.item.slot]" :alt="row.item.filename" @load="onImgMeta(row.item.slot, $event)" >
          <span v-else class="mg-loading i-lucide-image size-6" aria-hidden="true" />
          <span v-if="row.isVideo" class="mg-play"><span class="i-lucide-play size-5" aria-hidden="true" /></span>
          <span v-if="row.dur" class="mg-badge">{{ row.dur }}</span>
        </button>
        <button type="button" class="mg-del" :aria-label="`Delete ${row.item.filename}`" @click.stop="confirming = row.item.slot"><span class="i-lucide-trash-2 size-3.5" aria-hidden="true" /></button>
        <div v-if="confirming === row.item.slot" class="mg-confirm">
          <button type="button" class="del" @click.stop="confirming = null; emit('remove', row.item.slot)">Delete</button>
          <button type="button" class="cancel" @click.stop="confirming = null">Cancel</button>
        </div>
      </li>
    </ul>

    <!-- List: preview rows -->
    <ul v-else-if="items.length" class="mg-list">
      <li v-for="row in rows" :key="row.item.slot" class="mg-row">
        <button type="button" class="mg-row-thumb" :aria-label="row.item.filename" @click="lightbox = row.item.slot">
          <video v-if="row.isVideo" :src="urls[row.item.slot]" muted playsinline preload="metadata" @loadedmetadata="onVideoMeta(row.item.slot, $event)" />
          <img v-else-if="urls[row.item.slot]" :src="urls[row.item.slot]" :alt="row.item.filename" @load="onImgMeta(row.item.slot, $event)" >
          <span v-if="row.isVideo" class="mg-play sm"><span class="i-lucide-play size-3.5" aria-hidden="true" /></span>
        </button>
        <span class="mg-meta">
          <span class="mg-name" :title="row.item.filename">{{ row.item.filename }}</span>
          <span class="mg-sub">{{ row.sub }}</span>
        </span>
        <span v-if="confirming === row.item.slot" class="mg-confirm inline">
          <button type="button" class="del" @click="confirming = null; emit('remove', row.item.slot)">Delete</button>
          <button type="button" class="cancel" @click="confirming = null">Cancel</button>
        </span>
        <button v-else type="button" class="mg-row-del" aria-label="Delete" @click="confirming = row.item.slot"><span class="i-lucide-trash-2 size-3.5" aria-hidden="true" /></button>
      </li>
    </ul>

    <button type="button" class="mg-add" :class="{ 'is-empty': !items.length }" :disabled="busy" @click="pick">
      <span class="i-lucide-upload size-4" aria-hidden="true" />
      <span>{{ busy ? 'Uploading…' : items.length ? 'Add media' : 'Drop images or video here, or click to browse' }}</span>
    </button>
    <input ref="fileEl" type="file" accept="image/*,video/*" multiple @change="onFile" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0" >

    <div v-if="dragging" class="mg-overlay" aria-hidden="true"><span class="i-lucide-upload size-5" /> Drop to upload</div>

    <!-- Lightbox -->
    <div v-if="lightboxRow" class="mg-lightbox" @click.self="lightbox = null">
      <button type="button" class="mg-close" aria-label="Close" @click="lightbox = null">✕</button>
      <button v-if="rows.length > 1" type="button" class="mg-nav prev" aria-label="Previous" @click.stop="step(-1)"><span class="i-lucide-chevron-left size-6" aria-hidden="true" /></button>
      <button v-if="rows.length > 1" type="button" class="mg-nav next" aria-label="Next" @click.stop="step(1)"><span class="i-lucide-chevron-right size-6" aria-hidden="true" /></button>
      <video v-if="lightboxRow.isVideo" :key="lightboxRow.item.slot" :src="urls[lightboxRow.item.slot]" controls autoplay playsinline class="mg-lightbox-media" />
      <img v-else :src="urls[lightboxRow.item.slot]" :alt="lightboxRow.item.filename" class="mg-lightbox-media" >
      <div class="mg-caption" @click.stop>
        <span class="mg-caption-name" :title="lightboxRow.item.filename">{{ lightboxRow.item.filename }}</span>
        <span class="mg-caption-meta">{{ lightboxRow.sub }}<template v-if="rows.length > 1"> · {{ lightboxIndex + 1 }} / {{ rows.length }}</template></span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.nui-card { padding: var(--nui-card-px, 1rem); }
.mg-panel { position: relative; }
.mg-dragging { outline: 2px dashed var(--nui-accent); outline-offset: -3px; }
.mg-head { display: flex; align-items: center; gap: 0.5rem; }
.mg-toggle { margin-left: auto; display: flex; gap: 2px; border: 1px solid var(--nui-border); border-radius: var(--radius-control, 6px); padding: 2px; }
.mg-toggle button { display: flex; padding: 3px; border-radius: var(--radius-control, 5px); background: none; border: 0; color: var(--nui-subtle); cursor: pointer; }
.mg-toggle button.on { background: var(--nui-bg-accent); color: var(--nui-fg); }

/* Gallery */
.mg-grid { list-style: none; margin: 0.6rem 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
.mg-tile { position: relative; aspect-ratio: 1; border-radius: var(--radius-control, 6px); overflow: hidden; background: var(--nui-bg-accent); }
.mg-tile-hit { position: absolute; inset: 0; display: block; padding: 0; border: 0; background: none; cursor: pointer; }
.mg-tile-hit img, .mg-tile-hit video { width: 100%; height: 100%; object-fit: cover; display: block; }
.mg-loading { position: absolute; inset: 0; margin: auto; color: var(--nui-subtle); }
.mg-play { position: absolute; inset: 0; margin: auto; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); color: #fff; pointer-events: none; }
.mg-play.sm { position: static; width: 22px; height: 22px; }
.mg-badge { position: absolute; right: 4px; bottom: 4px; font-size: 10px; font-variant-numeric: tabular-nums; color: #fff; background: rgba(0,0,0,0.6); padding: 1px 5px; border-radius: 4px; pointer-events: none; }
.mg-del { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.55); color: #fff; border: 0; cursor: pointer; opacity: 0; transition: opacity 120ms; }
.mg-tile:hover .mg-del, .mg-del:focus-visible { opacity: 1; }
.mg-del:hover { background: var(--nui-danger); }
.mg-confirm { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; background: rgba(0,0,0,0.72); }
.mg-confirm.inline { position: static; flex-direction: row; background: none; flex: 0 0 auto; }
.mg-confirm button { font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: var(--radius-control, 5px); cursor: pointer; border: 0; }
.mg-confirm .del { background: var(--nui-danger); color: #fff; }
.mg-confirm .cancel { background: var(--nui-bg); color: var(--nui-fg); }
.mg-confirm.inline .cancel { background: var(--nui-bg-accent); color: var(--nui-muted); }

/* List */
.mg-list { list-style: none; margin: 0.6rem 0 0; padding: 0; }
.mg-list > li + li { border-top: 1px solid var(--nui-border); }
.mg-row { display: flex; align-items: center; gap: 0.7rem; padding: 0.5rem 0; }
.mg-row-thumb { position: relative; flex: 0 0 auto; width: 48px; height: 48px; border-radius: var(--radius-control, 6px); overflow: hidden; background: var(--nui-bg-accent); border: 0; padding: 0; cursor: pointer; }
.mg-row-thumb img, .mg-row-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
.mg-row-thumb .mg-play { background: rgba(0,0,0,0.5); }
.mg-meta { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.mg-name { font-size: 0.82rem; color: var(--nui-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mg-sub { font-size: 0.7rem; color: var(--nui-subtle); font-variant-numeric: tabular-nums; margin-top: 1px; }
.mg-row-del { flex: 0 0 auto; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-control, 6px); color: var(--nui-subtle); background: none; border: 0; cursor: pointer; opacity: 0; transition: opacity 120ms; }
.mg-row:hover .mg-row-del, .mg-row-del:focus-visible { opacity: 1; }
.mg-row-del:hover { color: var(--nui-danger); background: color-mix(in oklab, var(--nui-danger) 10%, transparent); }

/* Add / drop */
.mg-add { width: 100%; margin-top: 0.7rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.55rem 0.75rem; border: 1.5px dashed var(--nui-border); border-radius: var(--radius, 8px); background: transparent; color: var(--nui-muted); cursor: pointer; font-size: 0.8rem; transition: border-color 150ms, color 150ms, background 150ms; }
.mg-add.is-empty { flex-direction: column; gap: 0.4rem; padding: 1.5rem 1rem; margin-top: 0.6rem; }
.mg-add:hover:not(:disabled) { border-color: var(--nui-accent); color: var(--nui-fg); background: color-mix(in oklab, var(--nui-accent) 5%, transparent); }
.mg-add:disabled { opacity: 0.5; cursor: default; }
.mg-overlay { position: absolute; inset: 0; z-index: 5; border-radius: inherit; pointer-events: none; display: flex; align-items: center; justify-content: center; gap: 0.5rem; background: color-mix(in oklab, var(--nui-accent) 12%, var(--nui-bg)); color: var(--nui-accent); font-size: 0.85rem; font-weight: 600; }

/* Lightbox */
.mg-lightbox { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 2rem; }
.mg-lightbox-media { max-width: 90vw; max-height: 85vh; border-radius: 6px; box-shadow: 0 12px 48px rgba(0,0,0,0.5); }
.mg-close { position: fixed; top: 1rem; right: 1.25rem; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.12); color: #fff; border: 0; font-size: 1.2rem; cursor: pointer; }
.mg-close:hover { background: rgba(255,255,255,0.22); }
.mg-nav { position: fixed; top: 50%; transform: translateY(-50%); width: 46px; height: 46px; border-radius: 50%; background: rgba(255,255,255,0.12); color: #fff; border: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.mg-nav:hover { background: rgba(255,255,255,0.22); }
.mg-nav.prev { left: 1.25rem; }
.mg-nav.next { right: 1.25rem; }
@media (max-width: 560px) { .mg-nav { width: 38px; height: 38px; } .mg-nav.prev { left: 0.4rem; } .mg-nav.next { right: 0.4rem; } }
.mg-caption {
  position: fixed; left: 50%; bottom: 1.1rem; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  max-width: 88vw; padding: 0.35rem 0.75rem; border-radius: 8px; text-align: center;
  background: rgba(0, 0, 0, 0.4); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
}
.mg-caption-name { max-width: 84vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; font-weight: 600; color: #fff; }
.mg-caption-meta { font-size: 0.72rem; color: rgba(255, 255, 255, 0.7); font-variant-numeric: tabular-nums; }
</style>
