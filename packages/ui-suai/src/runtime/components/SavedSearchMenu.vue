<script setup lang="ts">
// Saved smart searches — a bookmark dropdown beside the search box. Lists saved searches (favorites
// first) with their fluent narrate title (ONE language across title/recents/saved); click runs one.
// Footer saves the CURRENT query under a name prefilled from the same fluent title. Per-row:
// favorite toggle, rename, delete, set-default. All persistence is delegated up via emits; the host
// supplies the `saved` list + `schema`. Nuxt-UI-free.
import { computed, nextTick, ref } from 'vue'
import { narrate } from '@noy-db/ui'
import { parse } from '@noy-db/ui'
import { resolve } from '@noy-db/ui'
import { isRollingDate } from '@noy-db/ui'
import type { Node } from '@noy-db/ui'
import type { SavedSearch } from '@noy-db/ui'
import type { EntitySchema } from '@noy-db/ui'
import Popover from '../internal/Popover.vue'
import { useNuiI18n } from '../core/i18n'

const { t } = useNuiI18n()
const props = defineProps<{
  schema: EntitySchema
  saved: readonly SavedSearch[]
  currentQuery: string
  currentSaved: boolean
  defaultQuery?: string
  /** Optional canonical value → display name resolver (enum/entity labels), same as the list's. */
  formatValue?: (field: string, value: string) => string | undefined
}>()
const emit = defineEmits<{
  run: [query: string]
  save: [name: string]
  rename: [payload: { id: string; name: string }]
  remove: [id: string]
  toggleFavorite: [id: string]
  setDefault: [id: string]
}>()

// Fluent description of a stored query — same renderer as the window title and the recents menu,
// so saved searches read in the system's one language ("Records: Jazz, by Label, …").
function descFor(q: string): { title: string; subtitle: string } {
  try { return narrate(resolve(parse(q).ast, props.schema), props.schema, { t, formatValue: props.formatValue }) } catch { return { title: q, subtitle: q } }
}
function isRolling(q: string): boolean {
  try {
    let rolling = false
    const walk = (n: Node | null): void => {
      if (!n || rolling) return
      if (n.t === 'pred') { if (n.value.k === 'scalar' && isRollingDate(n.value.v)) rolling = true }
      else if (n.t === 'and' || n.t === 'or') n.nodes.forEach(walk)
      else if (n.t === 'not') walk(n.node)
    }
    walk(resolve(parse(q).ast, props.schema).where)
    return rolling
  } catch { return false }
}

const defaultLabel = computed(() => {
  const marked = props.saved.find((s) => s.isDefault)
  if (marked) return marked.name
  const q = (props.defaultQuery ?? '').trim()
  if (!q) return t('nui.saved.allRecords', 'All records')
  if (q === 'recent') return t('nui.saved.recent3m', 'Recent (3 months)')
  return descFor(q).title
})

const naming = ref(false)
const draftName = ref('')
const nameEl = ref<HTMLInputElement | null>(null)
const hasQuery = computed(() => props.currentQuery.trim().length > 0)
function startSave(): void {
  draftName.value = descFor(props.currentQuery).title.slice(0, 60)
  naming.value = true
  // The input renders on the next tick — focus it (pre-selected) so Enter saves keyboard-only.
  void nextTick(() => { nameEl.value?.focus(); nameEl.value?.select() })
}
function confirmSave(): void {
  if (!draftName.value.trim()) return
  emit('save', draftName.value.trim())
  naming.value = false
  draftName.value = ''
}

const editingId = ref<string | null>(null)
const editName = ref('')
function startRename(s: SavedSearch): void { editingId.value = s.id; editName.value = s.name }
function confirmRename(): void {
  if (editingId.value && editName.value.trim()) emit('rename', { id: editingId.value, name: editName.value.trim() })
  editingId.value = null
}
function resetForms(): void { naming.value = false; draftName.value = ''; editingId.value = null }
</script>

<template>
  <Popover
    align="end"
    :label="saved.length ? `${t('nui.saved.title', 'Saved searches')} (${saved.length})` : t('nui.saved.title', 'Saved searches')"
    trigger-class="nui-icon-btn text-nui-muted size-6"
    @close="resetForms"
  >
    <span class="i-lucide-bookmark size-[1.3125rem]" aria-hidden="true" />

    <template #content="{ close }">
      <div class="w-80 max-w-[90vw] py-1">
        <div class="px-3 py-1.5 border-b border-nui-border">
          <span class="text-xs font-medium uppercase tracking-wide text-nui-muted">{{ t('nui.saved.title', 'Saved searches') }}</span>
        </div>

        <ul v-if="saved.length" class="max-h-72 overflow-y-auto py-1" role="listbox">
          <li v-for="s in saved" :key="s.id" class="group flex items-center gap-2 px-3 py-1.5 hover:bg-nui-bg-accent">
            <button
              type="button"
              class="shrink-0"
              :class="s.favorite ? 'text-nui-accent' : 'text-nui-muted opacity-60 hover:opacity-100'"
              :aria-label="s.favorite ? t('nui.saved.unpin', 'Unpin from favorites') : t('nui.saved.pin', 'Pin to favorites')"
              :aria-pressed="s.favorite"
              @click.stop="emit('toggleFavorite', s.id)"
            >
              <span class="i-lucide-heart size-3.5" aria-hidden="true" />
            </button>

            <template v-if="editingId === s.id">
              <input
                v-model="editName"
                type="text"
                class="flex-1 min-w-0 bg-transparent outline-none text-sm ring ring-nui-border rounded px-1.5 py-0.5"
                :aria-label="t('nui.saved.renameAria', 'Rename saved search')"
                @keydown.enter="confirmRename"
                @keydown.esc="editingId = null"
              >
              <button type="button" class="shrink-0 hover:text-nui-accent" :aria-label="t('nui.saved.confirmRename', 'Confirm rename')" @click.stop="confirmRename">
                <span class="i-lucide-check size-3.5" aria-hidden="true" />
              </button>
            </template>

            <template v-else>
              <button type="button" class="flex flex-col gap-0.5 flex-1 min-w-0 text-start cursor-pointer" :title="descFor(s.query).subtitle" @click="emit('run', s.query); close()">
                <span class="flex items-center gap-1 max-w-full">
                  <span class="text-sm font-medium truncate">{{ s.name }}</span>
                  <span v-if="isRolling(s.query)" class="nui-chip bg-nui-bg-accent text-nui-muted shrink-0" :title="t('nui.saved.rollingTitle', 'Rolling — the date period moves with today')">
                    <span class="i-lucide-refresh-cw size-3" aria-hidden="true" /> {{ t('nui.saved.rolling', 'rolling') }}
                  </span>
                </span>
                <!-- The query in the system's one fluent language; hidden when the name already IS it. -->
                <span v-if="descFor(s.query).title !== s.name" class="block text-xs text-nui-muted truncate w-full">{{ descFor(s.query).title }}</span>
              </button>
              <button
                type="button"
                class="shrink-0"
                :class="s.isDefault ? 'text-nui-accent' : 'text-nui-muted opacity-0 group-hover:opacity-100'"
                :aria-label="s.isDefault ? t('nui.saved.clearDefault', 'Clear default view') : t('nui.saved.setDefault', 'Set as default view')"
                :aria-pressed="s.isDefault"
                :title="t('nui.saved.defaultTitle', 'Open this module on this search by default')"
                @click.stop="emit('setDefault', s.id)"
              >
                <span class="i-lucide-pin size-3.5" aria-hidden="true" />
              </button>
              <button type="button" class="shrink-0 opacity-0 group-hover:opacity-100 hover:text-nui-accent" :aria-label="t('nui.saved.rename', 'Rename')" @click.stop="startRename(s)">
                <span class="i-lucide-pencil size-3.5" aria-hidden="true" />
              </button>
              <button type="button" class="shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-500" :aria-label="t('nui.saved.delete', 'Delete saved search')" @click.stop="emit('remove', s.id)">
                <span class="i-lucide-trash-2 size-3.5" aria-hidden="true" />
              </button>
            </template>
          </li>
        </ul>

        <p v-else class="px-3 py-3 text-sm text-nui-muted text-center">{{ t('nui.saved.empty', 'No saved searches yet.') }}</p>

        <div class="border-t border-nui-border px-3 py-1.5 flex items-center gap-1.5 text-xs text-nui-muted">
          <span class="i-lucide-pin size-3 shrink-0" aria-hidden="true" />
          <span class="truncate">{{ t('nui.saved.opensOn', 'Opens on:') }} <span class="text-nui-fg">{{ defaultLabel }}</span></span>
        </div>

        <div class="border-t border-nui-border px-3 py-2">
          <div v-if="naming" class="flex items-center gap-1">
            <input
              ref="nameEl"
              v-model="draftName"
              type="text"
              class="flex-1 min-w-0 bg-transparent outline-none text-sm ring ring-nui-border rounded px-1.5 py-1"
              :placeholder="t('nui.saved.namePlaceholder', 'Name this search…')"
              :aria-label="t('nui.saved.nameAria', 'Name this search')"
              @keydown.enter="confirmSave"
              @keydown.esc="naming = false"
            >
            <button type="button" class="nui-btn bg-nui-accent text-nui-accent-fg" :disabled="!draftName.trim()" @click.stop="confirmSave">{{ t('nui.save', 'Save') }}</button>
          </div>
          <p v-else-if="currentSaved" class="text-xs text-nui-muted flex items-center gap-1">
            <span class="i-lucide-check size-3.5 text-nui-accent" aria-hidden="true" /> {{ t('nui.saved.currentSaved', 'Current search is saved.') }}
          </p>
          <button
            v-else
            type="button"
            class="nui-btn-ghost w-full justify-start disabled:(opacity-40 pointer-events-none)"
            :disabled="!hasQuery"
            @click.stop="startSave"
          >
            <span class="i-lucide-bookmark-plus size-3.5" aria-hidden="true" /> {{ t('nui.saved.saveCurrent', 'Save current search') }}
          </button>
        </div>
      </div>
    </template>
  </Popover>
</template>
