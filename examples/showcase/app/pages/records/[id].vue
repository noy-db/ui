<script setup lang="ts">
import { useRecordItem, useFoundSet, captureFoundSet, setReturnAnchor, useTraverse, rememberDirection, recallDirection, useCollectionList, narrate, foundSetItems as buildFoundSetItems, historyRows, type HistoryRow, type HistorySnapshot, attachmentList, attachmentSlot, fileCategory, type AttachmentItem } from '@noy-db/ui'
import { diff } from '@noy-db/hub/history'
import { useVault } from '../../composables/useVault'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'
import { useLists } from '../../composables/useLists'
import { buildRecordsView } from '../../lib/collectionView'
import { saveCoverBytes } from '../../lib/cover'
import { seedRecordBlobs } from '../../lib/recordBlobs'
import { VAULT_USER, COVER_FIELD } from '../../../src/data/vault'
import { GENRES, FORMATS, CONDITIONS } from '../../../src/data/types'

interface RawHistoryEntry { version: number; timestamp: string; userId: string; record: Record<string, unknown> }

const route = useRoute()
const router = useRouter()
const { vault } = useVault()
const { t, fieldLabel, enumLabel, locale } = useShowcaseI18n()

const id = route.params.id as string
const records = vault.value!.collection('records')

const item = useRecordItem({ collection: records, id })
await item.load()

// Found-set traversal (spec §4): the list's captured snapshot drives the skim/step cluster;
// a missing record (deleted between capture and visit) auto-advances past it.
const { snapshot } = useFoundSet('records')

// P-C multi-tab: a forked/cold tab (own empty per-tab store) has no captured snapshot. If the URL
// carries ?q= it is fully derivable (spec §6 invariant 1) — re-evaluate the query through a headless
// list and rebuild the frozen snapshot, so the traverse bar renders in the new tab too (spec D5).
const routeQ = typeof route.query.q === 'string' ? route.query.q : ''
if (!snapshot.value && routeQ && vault.value) {
  const rv = buildRecordsView(vault.value)
  const labelForValue = (field: string, value: string): string | undefined =>
    field === 'priceUsd' ? `$${value}` : rv.entityName(field, value) ?? (enumLabel(field, value) || undefined)
  const rebuilt = useCollectionList({
    baseRows: computed(() => rv.rows as Record<string, any>[]),
    query: ref(routeQ),
    entity: 'records',
    columns: rv.columns,
    defaultSort: [{ field: 'title', dir: 'asc' }],
    schema: () => rv.schema,
    formatGroupLabel: labelForValue,
  })
  captureFoundSet({
    kind: 'query', entity: 'records',
    query: routeQ,
    title: narrate(rebuilt.ast.value, rv.schema, { t, formatValue: labelForValue }).title,
    items: buildFoundSetItems({ lines: rebuilt.groupLines.value as any[], rows: rebuilt.visibleRows.value as any[] }),
    total: rv.rows.length,
    capturedAt: new Date().toISOString(),
  })
}

// `traverse` is referenced inside its own onSettle closure — safe: the closure only runs on a
// later go()/goTo() call, by which point `const traverse` has been initialized. router.replace keeps
// ?q= so the found set survives a further fork/refresh from this tab (P-C).
const withQ = (nid: string): string => `/records/${nid}${routeQ ? `?q=${encodeURIComponent(routeQ)}` : ''}`
const traverse = useTraverse({
  snapshot: () => snapshot.value,
  currentId: () => (route.params.id as string),
  onSettle: (nid) => { rememberDirection('records', traverse.lastDirection.value); router.replace(withQ(nid)) },
})
if (!item.record.value && snapshot.value) traverse.go(recallDirection('records'))

function goBack(): void {
  if (snapshot.value) setReturnAnchor('records', { query: snapshot.value.query, id: String(route.params.id) })
  navigateTo('/records')
}

// async describe({}) → validator-derived optional + constraints drive the hints. The cover blob is
// rendered by the masthead art (with its own edit affordance), so it's dropped from the detail cards
// — otherwise it lands in a stray, empty "Cover —" cell.
const described = await records.describe({})
const fields = computed(() => described.fields
  .filter((f) => f.key !== COVER_FIELD)
  .map((f) => {
    const l = fieldLabel('records', f.key)
    return l === f.key ? f : { ...f, label: l }
  }))

// Localized reference data — feeds the drum selector AND the edit-mode ref pickers. The names are
// resolved by the hub at read time, so a locale switch must refetch (else the drums stay in the old
// language). Kept in refs and reloaded on `locale` change.
const artistRows = ref<{ id: string; name: string }[]>([])
const labelRows = ref<{ id: string; name: string }[]>([])
const recordRows = ref<{ id: string; title: string; labelId: string; artistId: string }[]>([])
async function loadRefData(loc: string): Promise<void> {
  const [artists, labels, recs] = await Promise.all([
    vault.value!.collection('artists').list({ locale: loc, fallback: 'any' }),
    vault.value!.collection('labels').list({ locale: loc, fallback: 'any' }),
    records.list({ locale: loc, fallback: 'any' }),
  ])
  artistRows.value = artists as { id: string; name: string }[]
  labelRows.value = labels as { id: string; name: string }[]
  recordRows.value = recs as { id: string; title: string; labelId: string; artistId: string }[]
}
await loadRefData(locale.value)
watch(locale, loadRefData)

// Drum captions in the active language.
const slotCaptions = computed(() => ({
  label: fieldLabel('records', 'labelId'),
  artist: fieldLabel('records', 'artistId'),
  title: fieldLabel('records', 'title'),
}))

const options = computed(() => ({
  artistId: artistRows.value.map((a) => ({ value: a.id, label: a.name })),
  labelId: labelRows.value.map((l) => ({ value: l.id, label: l.name })),
  genre: GENRES.map((v) => ({ value: v, label: enumLabel('genre', v) })),
  format: FORMATS.map((v) => ({ value: v, label: enumLabel('format', v) })),
  condition: CONDITIONS.map((v) => ({ value: v, label: enumLabel('condition', v) })),
}))

// Change-history panel (P4): lazy — fetch versions only when the panel first expands, and refresh
// after a successful edit. history() returns prior versions (raw records); the live record is
// prepended as the current snapshot — stamped with the session author, but no timestamp (an absent
// timestamp is what marks it "Current").
const historyData = ref<HistoryRow[]>([])
const historyLoading = ref(false)
const historyRequested = ref(false)

async function loadHistory(): Promise<void> {
  historyRequested.value = true
  historyLoading.value = true
  try {
    const entries = (await (records as { history(id: string): Promise<RawHistoryEntry[]> }).history(id))
    const snapshots: HistorySnapshot[] = []
    const current = item.record.value as Record<string, unknown> | null
    if (current) snapshots.push({ version: (entries[0]?.version ?? 0) + 1, actor: VAULT_USER, record: current })
    for (const e of entries) snapshots.push({ version: e.version, timestamp: e.timestamp, actor: e.userId, record: e.record })
    historyData.value = historyRows(snapshots, (a, b) => diff(a, b), fields.value, { now: Date.now() })
  } finally {
    historyLoading.value = false
  }
}

async function onSave(): Promise<void> {
  const ok = await item.submit()
  if (ok && historyRequested.value) await loadHistory()
}

// Attachments gallery (P5): the record's `att:` blob slots. Session-only (D3) — uploads live in the
// in-memory vault for the session; the cover slot is filtered out by attachmentList.
const blobHandle = records.blob(id)
const attachments = ref<AttachmentItem[]>([])
const uploadBusy = ref(false)
async function refreshAttachments(): Promise<void> {
  attachments.value = attachmentList(await blobHandle.list())
}
// Split the record's blobs by kind: images + video render in the Media gallery, everything else
// (paperwork) in the Documents list.
const isMedia = (i: AttachmentItem): boolean => ['image', 'video'].includes(fileCategory(i.mime, i.filename).category)
const mediaItems = computed(() => attachments.value.filter(isMedia))
const documentItems = computed(() => attachments.value.filter((i) => !isMedia(i)))
async function loadAttachmentBytes(slot: string): Promise<Uint8Array | null> {
  return (await blobHandle.get(slot)) ?? null
}
async function onUpload(file: File): Promise<void> {
  uploadBusy.value = true
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    await blobHandle.put(attachmentSlot(crypto.randomUUID()), bytes, { filename: file.name, ...(file.type ? { mimeType: file.type } : {}) })
    await refreshAttachments()
  } finally {
    uploadBusy.value = false
  }
}
async function onRemoveAttachment(slot: string): Promise<void> {
  await blobHandle.delete(slot)
  await refreshAttachments()
}
onMounted(async () => { await seedRecordBlobs(vault.value!, id); await refreshAttachments() })

// Change cover: pick an image → crop/zoom in a modal → store the resized PNG as the cover blob →
// bump coverVersion so <CoverImage> remounts and shows it (session-only per D3).
const coverVersion = ref(0)
const cropSrc = ref<string | null>(null)
const coverFileEl = ref<HTMLInputElement | null>(null)
function pickCover(): void { coverFileEl.value?.click() }
function onCoverFile(e: Event): void {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (f) cropSrc.value = URL.createObjectURL(f)
}
function closeCrop(): void {
  if (cropSrc.value) URL.revokeObjectURL(cropSrc.value)
  cropSrc.value = null
}
async function onCropConfirm(bytes: Uint8Array): Promise<void> {
  await saveCoverBytes(vault.value!, id, bytes)
  closeCrop()
  coverVersion.value++
}

// Lists (P-D): pin this record into a list even when it doesn't match the list's query — the PATCH
// half of the algebra. Membership shown here is the explicit `patch` set (the detail's domain);
// removing a query-matched member happens in the list view's per-row ✕.
const { lists: recordLists, addItem: addToList, removeItem: removeFromList } = useLists('records')
const listMenuOpen = ref(false)
const isPinned = (l: { patch: string[] }): boolean => l.patch.includes(id)
function toggleList(l: { id: string; patch: string[] }): void {
  isPinned(l) ? removeFromList(l.id, id) : addToList(l.id, id)
}

</script>

<template>
  <article v-if="item.record.value" class="p-4">
    <div class="record-wrap space-y-5">
      <!-- Sticky top bar: back to the found set on the left, the record's actions on the right. It sits
           in flow (never over the cover art) and sticks, so Save/Cancel stay reachable through a long
           form without a floating overlay covering the page. -->
      <div class="record-toolbar">
        <div class="rt-lead">
          <TraverseBar
            v-if="snapshot"
            :snapshot="snapshot" :position="traverse.position.value"
            :skimming="traverse.skimming.value" :editing="item.editing.value"
            @go="traverse.go" @go-to="traverse.goTo" @first="traverse.first" @last="traverse.last" @back="goBack"
          />
          <button v-else type="button" class="rt-back" @click="navigateTo('/records')">
            <span class="i-lucide-chevron-left size-4" aria-hidden="true" /> records
          </button>
        </div>

        <div class="rt-actions">
          <template v-if="item.editing.value">
            <span class="rt-editing"><span class="rt-dot" aria-hidden="true" /> Editing</span>
            <button type="button" class="edit-dock-btn ghost" :disabled="item.submitting.value" @click="item.cancel">Cancel</button>
            <button type="button" class="edit-dock-btn solid" :disabled="item.submitting.value" @click="onSave">
              {{ item.submitting.value ? 'Saving…' : 'Save' }}
            </button>
          </template>
          <template v-else>
            <button type="button" class="icon-btn" aria-label="Edit record" title="Edit" @click="item.enterEdit">
              <span class="i-lucide-pencil size-4" aria-hidden="true" />
            </button>
            <div v-if="recordLists.length" class="relative">
              <button
                type="button" class="icon-btn ghost"
                aria-label="Add to list" title="Add to list"
                :aria-expanded="listMenuOpen" @click="listMenuOpen = !listMenuOpen"
              >
                <span class="i-lucide-list-plus size-4" aria-hidden="true" />
              </button>
              <div v-if="listMenuOpen" class="absolute right-0 top-full mt-1 z-50 nui-panel p-1.5 w-52 space-y-0.5 shadow-lg">
                <button
                  v-for="l in recordLists"
                  :key="l.id"
                  type="button"
                  class="w-full text-left text-sm px-2 py-1 rounded hover:bg-nui-bg-accent flex items-center gap-2"
                  @click="toggleList(l)"
                >
                  <span class="size-4 shrink-0 flex items-center justify-center" :class="isPinned(l) ? 'text-nui-accent' : 'text-nui-subtle'">
                    <span :class="isPinned(l) ? 'i-lucide-check' : 'i-lucide-plus'" class="size-3.5" aria-hidden="true" />
                  </span>
                  <span class="truncate text-nui-fg">{{ l.name }}</span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="record-body" :class="traverse.skimming.value ? 'opacity-60 pointer-events-none' : ''">
        <!-- Masthead: cover art + the identity navigator (Title headline · Artist · Label). -->
        <header class="masthead">
          <div class="record-cover">
            <CoverImage :key="coverVersion" :id="id" />
            <button
              v-if="!item.editing.value"
              type="button"
              class="record-cover-change"
              @click="pickCover"
            >
              <span class="i-lucide-image-up size-3.5" aria-hidden="true" /> Change
            </button>
            <!-- Visually hidden, NOT display:none — a display:none input's programmatic .click() is
                 blocked in some browsers, which left the Change button doing nothing. -->
            <input
              ref="coverFileEl" type="file" accept="image/*" @change="onCoverFile"
              style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0"
            >
          </div>

          <div class="masthead-nav">
            <SlotPath
              :records="recordRows"
              :labels="labelRows"
              :artists="artistRows"
              :current-id="id"
              :captions="slotCaptions"
              @navigate="(rid) => navigateTo(withQ(rid))"
            />
          </div>
        </header>

        <RecordDetail
          :record="item.record.value"
          :fields="fields"
          :controls="false"
          :editing="item.editing.value"
          :draft="item.draft.value"
          :errors="item.errors.value"
          :error-banner="item.errorBanner.value"
          :options="options"
          :submitting="item.submitting.value"
          :route-for="(c: string, i: string) => `/${c}/${i}`"
          @navigate="(e: { collection: string; id: string }) => navigateTo(`/${e.collection}/${e.id}`)"
        />
        <!-- Media (Pattern ②): images + video, gallery ⇆ list, preview + duration/dimensions. -->
        <MediaGallery
          class="record-media"
          :items="mediaItems"
          :load-bytes="loadAttachmentBytes"
          :busy="uploadBusy"
          @upload="onUpload"
          @remove="onRemoveAttachment"
        />
        <!-- Secondary sections: documents (files, type icons) + the history log, side by side. -->
        <div class="record-secondary">
          <AttachmentGallery
            title="Documents"
            :items="documentItems"
            :load-bytes="loadAttachmentBytes"
            :busy="uploadBusy"
            @upload="onUpload"
            @remove="onRemoveAttachment"
          />
          <RecordHistory
            :rows="historyData"
            :loading="historyLoading"
            @expand="loadHistory"
          />
        </div>
      </div>
    </div>
  </article>
  <p v-else class="p-4">Not found.</p>

  <!-- Cover crop/resize modal -->
  <div v-if="cropSrc" class="crop-overlay" @click.self="closeCrop">
    <div class="crop-dialog nui-panel p-4">
      <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted mb-3">Change cover</h3>
      <ImageCropper :src="cropSrc" confirm-label="Save cover" @confirm="onCropConfirm" @cancel="closeCrop" />
    </div>
  </div>
</template>

<style scoped>
/* Use the full content width on large screens — the cards add columns rather than stretching (see
   RecordDetail's responsive grid), so wide screens fit more cards per row. A generous cap keeps
   ultra-wide (4K) from over-spreading. */
.record-wrap { max-width: 2200px; margin-inline: auto; }

.record-media { margin-top: 1rem; }
/* The body is a query container so documents + history land on the SAME column count as the detail
   cards above (RecordDetail's own container breakpoints: 2 ≥900, 3 ≥1160, 4 ≥1700). Each is one
   grid track wide, so they line up under the first cards instead of drifting off the grid. */
.record-body { container-type: inline-size; }
.record-secondary {
  display: grid; gap: 1rem; margin-top: 1rem; align-items: start;
  grid-template-columns: 1fr;
}
@container (min-width: 900px)  { .record-secondary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (min-width: 1160px) { .record-secondary { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@container (min-width: 1700px) { .record-secondary { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

/* The masthead: a record "plate" — cover art alongside the identity navigator (Title headline with
   an Artist · Label byline). The record's actions live in the sticky toolbar above, not here. */
.masthead { display: flex; align-items: flex-start; gap: 1.25rem; position: relative; margin-bottom: 2rem; }
.record-cover { position: relative; flex: 0 0 auto; width: 176px; margin: 0; }
.masthead-nav { flex: 1 1 auto; min-width: 0; }

/* Speed mirrors the plate: the drum navigator leads from the left, the cover art anchors the right. */
[data-palette='speed'] .masthead-nav { order: 0; }
[data-palette='speed'] .record-cover { order: 1; }

@media (max-width: 640px) {
  .masthead { flex-direction: column; align-items: stretch; gap: 0.9rem; }
  .record-cover { width: 160px; align-self: flex-start; }
}

.record-cover-change {
  position: absolute; top: 0.5rem; right: 0.5rem; z-index: 2;
  display: flex; align-items: center; gap: 0.25rem;
  font-size: 0.72rem; line-height: 1; padding: 0.3rem 0.55rem; border-radius: 7px;
  background: color-mix(in oklab, var(--nui-bg) 80%, transparent);
  -webkit-backdrop-filter: blur(5px); backdrop-filter: blur(5px);
  color: var(--nui-fg); border: 1px solid var(--nui-border); cursor: pointer;
  opacity: 0; transition: opacity 150ms;
}
.record-cover:hover .record-cover-change,
.record-cover-change:focus-visible { opacity: 1; }

/* Modal overlay — `inset-0` / `bg-black/50` aren't in ui-suai's pre-compiled CSS, so style it here. */
.crop-overlay { position: fixed; inset: 0; z-index: 50; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; }
.crop-dialog { width: 100%; max-width: 24rem; }

/* Icon action button — filled accent by default; the Speed theme restyles it flat (see below), so
   the same control reads differently per palette. */
.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 9px; flex: 0 0 auto;
  background: var(--nui-accent); color: var(--nui-accent-fg);
  border: 1px solid transparent; cursor: pointer;
  transition: filter 150ms, background 150ms, color 150ms, border-color 150ms;
}
.icon-btn:hover { filter: brightness(1.08); }
.icon-btn:focus-visible { outline: 2px solid var(--nui-accent); outline-offset: 2px; }
.icon-btn.ghost { background: transparent; color: var(--nui-muted); border-color: var(--nui-border); }
.icon-btn.ghost:hover { color: var(--nui-fg); background: var(--nui-bg-accent); filter: none; }

/* Speed = flat glass, not a filled chip. */
[data-palette='speed'] .icon-btn {
  background: color-mix(in oklab, var(--nui-accent) 10%, transparent);
  color: var(--nui-accent);
  border-color: color-mix(in oklab, var(--nui-accent) 40%, var(--nui-border));
}
[data-palette='speed'] .icon-btn:hover { background: color-mix(in oklab, var(--nui-accent) 18%, transparent); filter: none; }
[data-palette='speed'] .icon-btn.ghost { background: transparent; color: var(--nui-muted); border-color: var(--nui-border); }

/* Sticky record toolbar — back affordance on the left, the record's actions on the right. In flow
   (so it never overlaps the cover/masthead) yet sticky, so Save/Cancel follow through a long form. */
.record-toolbar {
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center; gap: 1rem;
  padding: 0.45rem 0; margin-bottom: 0.25rem;
  background: color-mix(in oklab, var(--nui-bg) 90%, transparent);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.rt-lead { flex: 1 1 auto; min-width: 0; }
/* The traverse stepper already carries its own sticky; inside the toolbar the toolbar owns that. */
.rt-lead :deep(.nui-traverse) { position: static; padding-top: 0; padding-bottom: 0; }
.rt-actions { flex: 0 0 auto; display: flex; align-items: center; gap: 0.5rem; }

/* Styled back-to-list — the counterpart to the traverse breadcrumb for a direct (no found-set) visit. */
.rt-back {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.85rem; font-weight: 500; color: var(--nui-muted);
  padding: 0.3rem 0.55rem 0.3rem 0.35rem; border-radius: 8px;
  background: none; border: 0; cursor: pointer; transition: color 150ms, background 150ms;
}
.rt-back:hover { color: var(--nui-accent); background: var(--nui-bg-accent); }

.rt-editing {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.72rem; letter-spacing: 0.02em; color: var(--nui-muted);
  font-family: 'Space Mono', ui-monospace, monospace;
}
.rt-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--nui-accent);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--nui-accent) 22%, transparent);
}
.edit-dock-btn {
  font-size: 0.8rem; padding: 0.35rem 0.85rem; border-radius: 8px; cursor: pointer;
  border: 1px solid transparent; transition: filter 150ms, background 150ms, color 150ms;
}
.edit-dock-btn:disabled { opacity: 0.5; cursor: default; }
.edit-dock-btn.ghost { background: transparent; color: var(--nui-muted); border-color: var(--nui-border); }
.edit-dock-btn.ghost:hover:not(:disabled) { color: var(--nui-fg); background: var(--nui-bg-accent); }
.edit-dock-btn.solid { background: var(--nui-accent); color: var(--nui-accent-fg); }
.edit-dock-btn.solid:hover:not(:disabled) { filter: brightness(1.08); }
</style>
