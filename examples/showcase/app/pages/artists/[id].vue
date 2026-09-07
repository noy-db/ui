<script setup lang="ts">
import { useFoundSet, setReturnAnchor, useTraverse, pathSegments, rememberDirection, recallDirection } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'
import { GENRE_LABELS, COUNTRY_LABELS } from '../../../src/data/dicts'

const route = useRoute()
const router = useRouter()
const { vault } = useVault()

const id = route.params.id as string
const record = await vault.value!.collection('artists').get(id, { locale: 'raw' })
const { fieldLabel, enumLabel } = useShowcaseI18n()
// re-label per active locale (fieldLabel reads the locale ref -> computed re-tracks)
const fields = computed(() => vault.value!.collection('artists').describe().fields.map((f) => {
  const l = fieldLabel('artists', f.key)
  return l === f.key ? f : { ...f, label: l }
}))

// dict-dimension display labels at the ACTIVE locale (read mode resolves via options).
const options = computed(() => ({
  genre: Object.keys(GENRE_LABELS).map((v) => ({ value: v, label: enumLabel('genre', v) })),
  country: Object.keys(COUNTRY_LABELS).map((v) => ({ value: v, label: enumLabel('country', v) })),
}))

// Found-set traversal (spec §4): the list's captured snapshot drives the skim/step cluster;
// a missing record (deleted between capture and visit) auto-advances past it.
const { snapshot } = useFoundSet('artists')
// `traverse` is referenced inside its own onSettle closure — safe: the closure only runs on a
// later go()/goTo() call, by which point `const traverse` has been initialized.
const traverse = useTraverse({
  snapshot: () => snapshot.value,
  currentId: () => (route.params.id as string),
  onSettle: (nid) => { rememberDirection('artists', traverse.lastDirection.value); router.replace(`/artists/${nid}`) },
})
if (!record && snapshot.value) traverse.go(recallDirection('artists'))

function goBack(): void {
  if (snapshot.value) setReturnAnchor('artists', { query: snapshot.value.query, id: String(route.params.id) })
  navigateTo('/artists')
}

// `name` is read raw (a locale map, spec: no re-localizing a frozen found-set label) — use its
// first non-empty translation, falling back to the frozen cursor label, then the bare id.
function firstLocaleValue(map: unknown): string | undefined {
  if (!map || typeof map !== 'object') return undefined
  return Object.values(map as Record<string, string>).find((v) => v)
}
const segments = computed(() => pathSegments({
  item: traverse.cursorItem.value,
  record: null,
  fields: fields.value,
  titleLabel: traverse.cursorItem.value?.label
    ?? firstLocaleValue((record as any)?.name)
    ?? String(route.params.id),
}))
const displayName = computed(() => firstLocaleValue((record as any)?.name) ?? String(id))

// Avatar: pick an image → crop/zoom with a CIRCLE mask → store the round PNG on the artist's
// `avatar` blob slot → bump the version so <ArtistAvatar> reloads (session-only, per D3).
const avatarVersion = ref(0)
const avatarCropSrc = ref<string | null>(null)
const avatarFileEl = ref<HTMLInputElement | null>(null)
function pickAvatar(): void { avatarFileEl.value?.click() }
function onAvatarFile(e: Event): void {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (f) avatarCropSrc.value = URL.createObjectURL(f)
}
function closeAvatarCrop(): void {
  if (avatarCropSrc.value) URL.revokeObjectURL(avatarCropSrc.value)
  avatarCropSrc.value = null
}
async function onAvatarConfirm(bytes: Uint8Array): Promise<void> {
  await vault.value!.collection('artists').blob(id).put('avatar', bytes, { mimeType: 'image/png' })
  closeAvatarCrop()
  avatarVersion.value++
}
</script>

<template>
  <article v-if="record" class="p-4 space-y-6">
    <TraverseBar
      v-if="snapshot"
      :snapshot="snapshot" :position="traverse.position.value"
      :skimming="traverse.skimming.value"
      @go="traverse.go" @go-to="traverse.goTo" @first="traverse.first" @last="traverse.last" @back="goBack"
    />
    <NuxtLink v-else to="/artists" class="text-sm text-nui-accent hover:underline">← artists</NuxtLink>
    <ItemPath
      :segments="segments"
      @back="goBack"
      @navigate="(r) => navigateTo(`/${r.collection}/${r.id}`)"
    />
    <div :class="traverse.skimming.value ? 'opacity-60 pointer-events-none' : ''">
      <!-- Round profile photo (crop + resize + circle mask) — the artist's avatar. -->
      <header class="artist-head">
        <button type="button" class="artist-avatar-btn" :aria-label="`Change ${displayName}'s photo`" @click="pickAvatar">
          <ArtistAvatar :key="avatarVersion" :id="id" :name="displayName" :size="96" />
          <span class="artist-avatar-cam"><span class="i-lucide-image-up size-4" aria-hidden="true" /></span>
        </button>
        <div class="artist-head-meta">
          <h2 class="artist-name">{{ displayName }}</h2>
          <button type="button" class="artist-change" @click="pickAvatar">
            <span class="i-lucide-image-up size-3.5" aria-hidden="true" /> Change photo
          </button>
        </div>
        <input ref="avatarFileEl" type="file" accept="image/*" class="hidden" @change="onAvatarFile">
      </header>

      <RecordDetail
        :record="record"
        :fields="fields"
        :options="options"
        :route-for="(c: string, i: string) => `/${c}/${i}`"
        @navigate="(e: { collection: string; id: string }) => navigateTo(`/${e.collection}/${e.id}`)"
      />
    </div>
  </article>
  <p v-else class="p-4">Not found.</p>

  <!-- Circle crop/resize modal for the profile photo. -->
  <div v-if="avatarCropSrc" class="crop-overlay" @click.self="closeAvatarCrop">
    <div class="crop-dialog nui-panel p-4">
      <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted mb-3">Profile photo</h3>
      <ImageCropper :src="avatarCropSrc" shape="circle" confirm-label="Save photo" @confirm="onAvatarConfirm" @cancel="closeAvatarCrop" />
    </div>
  </div>
</template>

<style scoped>
.artist-head { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.artist-avatar-btn { position: relative; padding: 0; border: 0; background: none; cursor: pointer; border-radius: 50%; line-height: 0; }
.artist-avatar-cam {
  position: absolute; right: 0; bottom: 0; width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--nui-accent); color: var(--nui-accent-fg); border: 2px solid var(--nui-bg);
  opacity: 0; transition: opacity 150ms;
}
.artist-avatar-btn:hover .artist-avatar-cam, .artist-avatar-btn:focus-visible .artist-avatar-cam { opacity: 1; }
.artist-head-meta { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
.artist-name { font-family: var(--font-display, 'Saira'), sans-serif; font-size: 1.5rem; font-weight: var(--display-weight, 700); letter-spacing: var(--display-spacing, -0.01em); color: var(--nui-fg); margin: 0; }
.artist-change {
  display: inline-flex; align-items: center; gap: 0.3rem; align-self: flex-start;
  font-size: 0.75rem; color: var(--nui-muted); background: none; border: 0; cursor: pointer; padding: 0;
}
.artist-change:hover { color: var(--nui-accent); }

/* Modal overlay — `inset-0` / `bg-black/50` aren't in ui-suai's pre-compiled CSS, so style it here. */
.crop-overlay { position: fixed; inset: 0; z-index: 50; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; }
.crop-dialog { width: 100%; max-width: 24rem; }
</style>
