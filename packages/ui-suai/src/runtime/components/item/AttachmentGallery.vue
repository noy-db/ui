<script setup lang="ts">
// Item family — the attachments gallery (Item Release P5). A record's blob attachments (`att:`
// slots) as image thumbnails / file tiles, with an upload affordance that is BOTH a drop-zone
// (drag files onto the panel) and a click-to-browse. The item view models come from
// `attachmentList()` (@noy-db/ui); this component owns the objectURL lifecycle for image thumbs
// (revoked on unmount and when an item disappears). Vault I/O stays with the host via `upload`/
// `remove` (one `upload` per file, so a multi-file pick/drop emits several).
import { ref, computed, watch, onUnmounted } from 'vue'
import { fileCategory, parseExif, type AttachmentItem, type ExifData } from '@noy-db/ui'
import { useNuiI18n } from '../../core/i18n'

const { t } = useNuiI18n()

const props = withDefaults(defineProps<{
  items: AttachmentItem[]
  /** Host vault read used to build image thumbnails (e.g. `slot => blob(id).get(slot)`). */
  loadBytes: (slot: string) => Promise<Uint8Array | null>
  /** An upload is in flight — disables the add affordance. */
  busy?: boolean
  /** Panel heading — defaults to the localized "Attachments". */
  title?: string
}>(), { items: () => [], busy: false })

const emit = defineEmits<{ upload: [File]; remove: [slot: string] }>()

const urls = ref<Record<string, string>>({})
const dims = ref<Record<string, string>>({}) // slot → "W×H" for images (computed client-side)
const exif = ref<Record<string, ExifData>>({}) // slot → parsed EXIF (from the decrypted bytes)
const failed = ref<Set<string>>(new Set())     // slots whose thumbnail couldn't decode (e.g. HEIC in Chrome)
function onImgError(slot: string): void { if (!failed.value.has(slot)) failed.value = new Set(failed.value).add(slot) }
const confirming = ref<string | null>(null)
const expanded = ref<string | null>(null)      // slot whose metadata detail is open
const fileEl = ref<HTMLInputElement | null>(null)
// Slots with a loadBytes in flight — the watch can re-fire mid-load, so this guards against a
// second syncThumbs re-issuing the load and double-creating (then leaking) the objectURL.
const inFlight = new Set<string>()

async function syncThumbs(): Promise<void> {
  if (import.meta.server) return
  const wanted = new Set(props.items.filter((i) => i.kind === 'image').map((i) => i.slot))
  for (const slot of Object.keys(urls.value)) {
    if (!wanted.has(slot)) {
      URL.revokeObjectURL(urls.value[slot]!)
      const next = { ...urls.value }; delete next[slot]; urls.value = next
      if (dims.value[slot]) { const d = { ...dims.value }; delete d[slot]; dims.value = d }
      if (exif.value[slot]) { const x = { ...exif.value }; delete x[slot]; exif.value = x }
      if (failed.value.has(slot)) { const f = new Set(failed.value); f.delete(slot); failed.value = f }
    }
  }
  for (const item of props.items) {
    if (item.kind !== 'image' || urls.value[item.slot] || inFlight.has(item.slot)) continue
    inFlight.add(item.slot)
    let bytes: Uint8Array | null = null
    try { bytes = await props.loadBytes(item.slot) } catch { bytes = null }
    inFlight.delete(item.slot)
    // Post-await: the slot may have been removed, or a URL may already exist — never overwrite
    // (which would strand the previous URL) and never create for a slot that is gone.
    const stillWanted = props.items.some((i) => i.slot === item.slot && i.kind === 'image')
    if (!bytes || !stillWanted || urls.value[item.slot]) continue
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: item.mime }))
    urls.value = { ...urls.value, [item.slot]: url }
    // Pixel dimensions aren't in the blob metadata (a cloud pipeline would populate them), so read
    // them off the decoded image — cheap, and only for the thumbnail we already built.
    const probe = new Image()
    probe.onload = () => { dims.value = { ...dims.value, [item.slot]: `${probe.naturalWidth}×${probe.naturalHeight}` } }
    probe.src = url
    // EXIF lives inside the (decrypted) bytes — parse it here rather than expecting a server bag.
    const x = parseExif(bytes)
    if (x) exif.value = { ...exif.value, [item.slot]: x }
  }
}
watch(() => props.items.map((i) => i.slot).join('|'), syncThumbs, { immediate: true })
onUnmounted(() => { for (const u of Object.values(urls.value)) URL.revokeObjectURL(u) })

function pick(): void { fileEl.value?.click() }
function sendFiles(list: FileList | null | undefined): void {
  if (!list) return
  const files = Array.from(list)
  expecting += files.length
  for (const f of files) emit('upload', f)
}
function onFile(e: Event): void {
  const input = e.target as HTMLInputElement
  sendFiles(input.files)
  input.value = '' // allow re-selecting the same file
}

// Drag-and-drop: the whole panel is a drop target. A depth counter keeps the highlight steady while
// the cursor crosses child elements (each fires its own dragenter/dragleave).
const dragging = ref(false)
let dragDepth = 0
function onDragEnter(): void { dragDepth += 1; dragging.value = true }
function onDragLeave(): void { dragDepth = Math.max(0, dragDepth - 1); if (dragDepth === 0) dragging.value = false }
function onDrop(e: DragEvent): void {
  dragDepth = 0; dragging.value = false
  if (!props.busy) sendFiles(e.dataTransfer?.files)
}

// Short type tag from the extension (e.g. "PNG"), shown before the size.
function ext(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i > 0 && i < filename.length - 1 ? filename.slice(i + 1).toUpperCase() : ''
}

// Upload-confirmation flash: attachments save on drop/pick (no separate Save), so the newly-added
// row briefly highlights to confirm it landed. Only slots that appear after a user-initiated
// upload flash — never the ones already present when the panel first loads.
const justAdded = ref<Set<string>>(new Set())
let prevSlots = new Set<string>()
let expecting = 0
watch(() => props.items.map((i) => i.slot).join('|'), () => {
  for (const slot of props.items.map((i) => i.slot)) {
    if (!prevSlots.has(slot) && expecting > 0) {
      expecting -= 1
      justAdded.value = new Set(justAdded.value).add(slot)
      setTimeout(() => { const n = new Set(justAdded.value); n.delete(slot); justAdded.value = n }, 1800)
    }
  }
  prevSlots = new Set(props.items.map((i) => i.slot))
})

// Upload time — a friendly relative for the row, the exact stamp in the tooltip.
function relTime(iso?: string): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (s < 45) return t('nui.time.justNow', 'just now')
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  const d = new Date(iso); const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}`
}
function fullStamp(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function toggle(slot: string): void { expanded.value = expanded.value === slot ? null : slot }

// A camera-settings one-liner (exposure · f/N · ISO · focal), any part optional.
function settingsLine(x: ExifData): string {
  return [x.exposure, x.fNumber, x.iso ? `ISO ${x.iso}` : '', x.focalLength].filter(Boolean).join(' · ')
}
// An OpenStreetMap link for a GPS fix (user-clicked; nothing is fetched automatically).
function mapUrl(g: { lat: number; lng: number }): string {
  return `https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lng}#map=14/${g.lat}/${g.lng}`
}

// Enriched view rows: category (icon + friendly label), a "TYPE · dims · size" subline (dims for
// images only), the upload time, the just-added flash flag, and the expandable metadata detail.
const rows = computed(() => props.items.map((item) => {
  const cat = fileCategory(item.mime, item.filename)
  const isImage = cat.category === 'image'
  const px = dims.value[item.slot]
  const x = exif.value[item.slot]
  const parts: string[] = []
  if (isImage) {
    const e = ext(item.filename); if (e) parts.push(e)
    if (px) parts.push(px)
  } else {
    parts.push(cat.label)
  }
  parts.push(item.humanSize)
  return {
    item, icon: cat.icon, isImage,
    sub: parts.join(' · '),
    rel: relTime(item.uploadedAt),
    full: fullStamp(item.uploadedAt),
    added: justAdded.value.has(item.slot),
    open: expanded.value === item.slot,
    detail: {
      typeLabel: `${cat.label}${item.mime ? ` · ${item.mime}` : ''}`,
      bytes: `${item.size.toLocaleString('en-US')} bytes`,
      dims: px ? `${px} px` : '',
      by: item.uploadedBy ?? '',
      exif: x,
      settings: x ? settingsLine(x) : '',
      camera: x ? [x.make, x.model].filter(Boolean).join(' ') : '',
      map: x?.gps ? mapUrl(x.gps) : '',
      coords: x?.gps ? `${x.gps.lat.toFixed(5)}, ${x.gps.lng.toFixed(5)}` : '',
    },
  }
}))
</script>

<template>
  <section
    class="nui-panel nui-card att-panel"
    :class="{ 'att-dragging': dragging }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div class="att-head">
      <span class="i-lucide-paperclip size-4 text-nui-muted" aria-hidden="true" />
      <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted">{{ title ?? t('nui.attachments.title', 'Attachments') }}</h3>
      <span v-if="items.length" class="text-[10px] text-nui-subtle tabular-nums">{{ items.length }}</span>
    </div>

    <!-- A tidy row per file: thumbnail/type icon, name + type·dimensions·size, upload time, delete.
         The name area toggles an expandable detail (full metadata + EXIF for photos). -->
    <ul v-if="rows.length" class="att-list">
      <li v-for="row in rows" :key="row.item.slot" class="att-item">
        <div class="att-row" :class="{ 'att-added': row.added }">
          <button type="button" class="att-open" :aria-expanded="row.open" @click="toggle(row.item.slot)">
            <span class="att-thumb">
              <img
                v-if="row.isImage && urls[row.item.slot] && !failed.has(row.item.slot)"
                :src="urls[row.item.slot]" :alt="row.item.filename" @error="onImgError(row.item.slot)"
              >
              <span v-else-if="row.isImage && !failed.has(row.item.slot)" class="i-lucide-image size-4 animate-pulse" aria-hidden="true" />
              <span v-else :class="row.icon" class="size-4" aria-hidden="true" />
            </span>
            <span class="att-meta">
              <span class="att-name" :title="row.item.filename">{{ row.item.filename }}</span>
              <span class="att-sub">{{ row.sub }}</span>
            </span>
            <span class="i-lucide-chevron-down att-chev size-3.5" :class="{ open: row.open }" aria-hidden="true" />
          </button>

          <span v-if="confirming === row.item.slot" class="att-confirm">
            <button type="button" class="del" @click="confirming = null; emit('remove', row.item.slot)">{{ t('nui.delete', 'Delete') }}</button>
            <button type="button" class="cancel" @click="confirming = null">{{ t('nui.cancel', 'Cancel') }}</button>
          </span>
          <template v-else>
            <time v-if="row.rel" class="att-time" :datetime="row.item.uploadedAt" :title="row.full">{{ row.rel }}</time>
            <button
              type="button" class="att-del"
              :aria-label="t('nui.delete', 'Delete')" @click="confirming = row.item.slot"
            >
              <span class="i-lucide-trash-2 size-3.5" aria-hidden="true" />
            </button>
          </template>
        </div>

        <dl v-if="row.open" class="att-detail">
          <div><dt>{{ t('nui.attachments.meta.type', 'Type') }}</dt><dd>{{ row.detail.typeLabel }}</dd></div>
          <div><dt>{{ t('nui.attachments.meta.size', 'Size') }}</dt><dd>{{ row.detail.bytes }}</dd></div>
          <div v-if="row.detail.dims"><dt>{{ t('nui.attachments.meta.dimensions', 'Dimensions') }}</dt><dd>{{ row.detail.dims }}</dd></div>
          <div v-if="row.full"><dt>{{ t('nui.attachments.meta.uploaded', 'Uploaded') }}</dt><dd>{{ row.full }}<template v-if="row.detail.by"> · {{ row.detail.by }}</template></dd></div>
          <template v-if="row.detail.exif">
            <div v-if="row.detail.camera"><dt>{{ t('nui.attachments.meta.camera', 'Camera') }}</dt><dd>{{ row.detail.camera }}</dd></div>
            <div v-if="row.detail.exif.lens"><dt>{{ t('nui.attachments.meta.lens', 'Lens') }}</dt><dd>{{ row.detail.exif.lens }}</dd></div>
            <div v-if="row.detail.exif.takenAt"><dt>{{ t('nui.attachments.meta.taken', 'Taken') }}</dt><dd>{{ row.detail.exif.takenAt }}</dd></div>
            <div v-if="row.detail.settings"><dt>{{ t('nui.attachments.meta.settings', 'Settings') }}</dt><dd>{{ row.detail.settings }}</dd></div>
            <div v-if="row.detail.exif.orientation"><dt>{{ t('nui.attachments.meta.orientation', 'Orientation') }}</dt><dd>{{ row.detail.exif.orientation }}</dd></div>
            <div v-if="row.detail.map" class="att-detail-wide">
              <dt>{{ t('nui.attachments.meta.location', 'Location') }}</dt>
              <dd>{{ row.detail.coords }} · <a :href="row.detail.map" target="_blank" rel="noopener noreferrer" class="att-map">{{ t('nui.attachments.meta.map', 'Map') }}</a></dd>
            </div>
          </template>
        </dl>
      </li>
    </ul>

    <!-- Add / drop affordance — a slim bar below the list, or the whole empty state. -->
    <button type="button" class="att-add" :class="{ 'is-empty': !items.length }" :disabled="busy" @click="pick">
      <span class="i-lucide-upload size-4" aria-hidden="true" />
      <span>{{ busy
        ? t('nui.attachments.uploading', 'Uploading…')
        : items.length ? t('nui.attachments.add', 'Add files') : t('nui.attachments.drop', 'Drop files here, or click to browse') }}</span>
    </button>

    <!-- Rendered but visually hidden (NOT display:none, so a programmatic click reliably opens the
         file dialog across browsers). `multiple` so a pick can add several at once. -->
    <input
      ref="fileEl" type="file" multiple @change="onFile"
      style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0"
    >

    <div v-if="dragging" class="att-overlay" aria-hidden="true">
      <span class="i-lucide-upload size-5" aria-hidden="true" />
      {{ t('nui.attachments.dropNow', 'Drop to upload') }}
    </div>
  </section>
</template>

<style scoped>
.nui-card { padding: var(--nui-card-px, 1rem); }
.att-panel { position: relative; }
.att-dragging { outline: 2px dashed var(--nui-accent); outline-offset: -3px; }

.att-head { display: flex; align-items: center; gap: 0.5rem; }

/* One clean row per attachment — hairline dividers, no nested card/shadow. */
.att-list { list-style: none; margin: 0.6rem 0 0; padding: 0; }
.att-list > .att-item + .att-item { border-top: 1px solid var(--nui-border); }
.att-row { display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0; }
/* The thumbnail + name area is the click target that toggles the metadata detail. */
.att-open {
  flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 0.7rem;
  background: none; border: 0; padding: 0; cursor: pointer; text-align: left;
}
.att-thumb {
  flex: 0 0 auto; width: 38px; height: 38px; border-radius: var(--radius-control, 6px);
  overflow: hidden; background: var(--nui-bg-accent); color: var(--nui-subtle);
  display: flex; align-items: center; justify-content: center;
}
.att-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.att-meta { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.att-name { font-size: 0.82rem; color: var(--nui-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.att-sub { font-size: 0.7rem; color: var(--nui-subtle); font-variant-numeric: tabular-nums; margin-top: 1px; }
.att-chev { flex: 0 0 auto; color: var(--nui-subtle); transition: transform 160ms; }
.att-chev.open { transform: rotate(180deg); }
.att-open:hover .att-name { color: var(--nui-accent); }
.att-open:hover .att-chev { color: var(--nui-accent); }

/* Expandable metadata detail — a compact two-column definition list under the row. */
.att-detail {
  display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 0.75rem;
  margin: 0.1rem 0 0.6rem 47px; padding: 0.5rem 0.7rem;
  border-radius: var(--radius-control, 6px); background: var(--nui-bg-accent);
}
.att-detail > div { display: contents; }
.att-detail dt { font-size: 0.68rem; color: var(--nui-subtle); text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
.att-detail dd { font-size: 0.75rem; color: var(--nui-fg); margin: 0; min-width: 0; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.att-map { color: var(--nui-accent); }
.att-map:hover { text-decoration: underline; }

.att-del {
  flex: 0 0 auto; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-control, 6px); color: var(--nui-subtle); background: none; border: 0; cursor: pointer;
  opacity: 0; transition: opacity 120ms, color 120ms, background 120ms;
}
.att-row:hover .att-del, .att-del:focus-visible { opacity: 1; }
.att-del:hover { color: var(--nui-danger); background: color-mix(in oklab, var(--nui-danger) 10%, transparent); }

.att-time { flex: 0 0 auto; font-size: 0.68rem; color: var(--nui-subtle); font-variant-numeric: tabular-nums; white-space: nowrap; }

/* Just-uploaded confirmation: a brief accent wash that fades (attachments save immediately). */
.att-added { animation: att-flash 1.8s ease-out; border-radius: var(--radius-control, 6px); }
@keyframes att-flash {
  0% { background: color-mix(in oklab, var(--nui-accent) 20%, transparent); }
  100% { background: transparent; }
}
@media (prefers-reduced-motion: reduce) { .att-added { animation: none; } }

.att-confirm { flex: 0 0 auto; display: flex; align-items: center; gap: 0.35rem; }
.att-confirm button { font-size: 0.72rem; padding: 0.22rem 0.55rem; border-radius: var(--radius-control, 5px); cursor: pointer; border: 0; }
.att-confirm .del { background: var(--nui-danger); color: #fff; }
.att-confirm .cancel { background: var(--nui-bg-accent); color: var(--nui-muted); }

/* Add / drop affordance: a slim dashed bar; taller centered box when it's the empty state. */
.att-add {
  width: 100%; margin-top: 0.7rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 0.55rem 0.75rem; border: 1.5px dashed var(--nui-border); border-radius: var(--radius, 8px);
  background: transparent; color: var(--nui-muted); cursor: pointer; font-size: 0.8rem;
  transition: border-color 150ms, color 150ms, background 150ms;
}
.att-add.is-empty { flex-direction: column; gap: 0.4rem; padding: 1.5rem 1rem; margin-top: 0.6rem; }
.att-add:hover:not(:disabled) { border-color: var(--nui-accent); color: var(--nui-fg); background: color-mix(in oklab, var(--nui-accent) 5%, transparent); }
.att-add:disabled { opacity: 0.5; cursor: default; }

.att-overlay {
  position: absolute; inset: 0; z-index: 5; border-radius: inherit; pointer-events: none;
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  background: color-mix(in oklab, var(--nui-accent) 12%, var(--nui-bg));
  color: var(--nui-accent); font-size: 0.85rem; font-weight: 600;
}
</style>
