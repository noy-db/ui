<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useCollectionList, narrate, captureFoundSet, consumeReturnAnchor, type FoundSetItem } from '@noy-db/ui'
import { useVault } from '../../composables/useVault'
import { buildSimpleView } from '../../lib/simpleView'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'
import { useSearchVoices } from '../../composables/useSearchVoices'

const { vault } = useVault()
const { t, locale, enumLabel } = useShowcaseI18n()
const query = ref('')

const view = computed(() => buildSimpleView(vault.value!, 'artists'))
const baseRows = computed(() => view.value.rows as Record<string, any>[])

const list = useCollectionList({
  baseRows,
  query,
  entity: 'artists',
  columns: view.value.columns,
  defaultSort: [{ field: 'name', dir: 'asc' }],
  schema: () => view.value.schema, // getter: field labels are locale-reactive
})

// Return-restore (spec §5): one-shot read of the anchor a detail-page "back" may have left.
const anchor = consumeReturnAnchor('artists')
if (anchor) query.value = anchor.query
const anchorKey = ref<string | undefined>()
onMounted(() => { if (anchor) nextTick(() => { anchorKey.value = anchor.id }) })

// Search voices + morphing reset + key sheet + `/` focus (spec:
// docs/superpowers/specs/2026-07-02-search-toolbar-interaction-design.md).
const {
  searchBox, searchMode, nlLoading, nlError, nlNote, needKey, keyDraft, keyEl, hasKey,
  onModeChange, onAsk, onAbortAsk, saveKeyDraft,
  micOn, micSupported, onSpeakStart, onSpeakStop,
  resetFace, onReset,
} = useSearchVoices(query, () => view.value.schema)

// Print: fluent report header (hidden on screen, shown by @media print — contract I1 on paper).
const printText = computed(() => narrate(list.ast.value, view.value.schema, { t }))
const printPage = (): void => window.print()
const printedAt = () => new Date().toLocaleString(locale.value === 'th' ? 'th-TH' : 'en-US')

// Found-set capture (spec §4): freeze the current display order for detail-page traversal.
function foundSetItems(): FoundSetItem[] {
  const lines = list.groupLines.value
  if (lines.length > 0) {
    const trail: string[] = []
    const items: FoundSetItem[] = []
    for (const line of lines) {
      if (line.kind === 'group') { trail.length = line.level; trail[line.level] = line.label }
      else items.push({ id: String(line.row.id), label: String(line.row.name ?? line.row.id), group: [...trail] })
    }
    return items
  }
  return list.visibleRows.value.map((r: any) => ({ id: String(r.id), label: String(r.name ?? r.id) }))
}

function openArtist(r: any): void {
  captureFoundSet({
    kind: 'query', entity: 'artists',
    query: query.value,
    title: printText.value.title,
    items: foundSetItems(),
    total: view.value.rows.length,
    capturedAt: new Date().toISOString(),
  })
  navigateTo(`/artists/${r.id}`)
}
</script>

<template>
  <section class="p-4 space-y-4">
    <header class="print-header">
      <h1>{{ printText.title || 'All artists' }}</h1>
      <p>{{ printText.subtitle }}</p>
      <p class="print-meta">{{ list.visibleRows.value.length }} {{ t('print.artists', 'artists') }} · {{ printedAt() }}</p>
    </header>
    <!-- Toolbar zones: EXPRESS (mode capsule) │ SHAPE (group) │ RESET. -->
    <div class="relative flex items-center gap-2 print-hide">
      <div class="flex-1 min-w-0">
        <SearchBox
          ref="searchBox"
          v-model="query"
          :schema="view.schema"
          :rows="list.visibleRows.value"
          :columns="view.columns"
          :inline-clear="false"
          :mode="searchMode"
          :busy="nlLoading"
          @ask="onAsk"
          @abort-ask="onAbortAsk"
        />
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <SearchModeGroup
          :mode="searchMode"
          :listening="micOn"
          :busy="nlLoading"
          :mic-supported="micSupported"
          @update:mode="onModeChange"
          @speak-start="onSpeakStart"
          @speak-stop="onSpeakStop"
        />
        <span class="w-px h-5 shrink-0" :style="{ background: 'var(--hairline)' }" aria-hidden="true" />
        <GroupByControl
          :fields="list.groupableFields.value"
          :active="list.groupFields.value"
          @toggle="list.toggleGroupField"
          @clear="list.clearGroups"
          @expand-all="list.expandAll"
          @collapse-level="list.collapseToLevel"
        />
        <button
          type="button"
          class="nui-btn text-nui-muted hover:bg-nui-bg-accent"
          :aria-label="t('toolbar.print', 'Print this view')"
          :title="t('toolbar.print', 'Print this view')"
          @click="printPage"
        >
          <span class="i-lucide-printer size-[1.3125rem]" aria-hidden="true" />
        </button>
        <span class="w-px h-5 shrink-0" :style="{ background: 'var(--hairline)' }" aria-hidden="true" />
        <button
          type="button"
          class="nui-btn"
          :class="resetFace === 'none' ? 'text-nui-subtle opacity-40 pointer-events-none' : 'text-nui-muted hover:bg-nui-bg-accent'"
          :aria-label="resetFace === 'draft' ? t('toolbar.discardDraft', 'Discard draft') : t('toolbar.clearSearch', 'Clear search')"
          @mousedown.prevent
          @click="onReset"
        >
          <span :class="resetFace === 'draft' ? 'i-lucide-x' : 'i-lucide-trash-2'" class="size-[1.3125rem]" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Status notes float over the content (zero-height strip): appearing/disappearing must
         never shift the table below — same no-shake rule as the title box itself. -->
    <div class="relative h-0 !mt-0 print-hide" style="z-index: 40">
      <p v-if="nlError" class="absolute top-1 left-0 nui-panel px-3 py-1.5 text-sm text-nui-accent">{{ nlError }}</p>
      <p v-else-if="nlNote" class="absolute top-1 left-0 nui-panel px-3 py-1.5 text-sm text-nui-muted">{{ nlNote }}</p>
      <div v-if="needKey && !hasKey" class="absolute top-1 left-0 nui-panel px-3 py-2 flex items-center gap-2">
      <span class="text-sm text-nui-muted">{{ t('nl.needKey', 'AI needs an Anthropic API key (stored locally):') }}</span>
      <input
        ref="keyEl"
        v-model="keyDraft"
        type="password"
        placeholder="sk-…"
        class="text-sm w-64 px-2 py-1 rounded border border-nui-border bg-nui-bg outline-none focus:border-nui-accent"
        @keydown.enter.prevent="saveKeyDraft"
      >
      <button type="button" class="nui-btn-ghost" @click="saveKeyDraft">{{ t('nui.save', 'Save') }}</button>
      <button type="button" class="nui-btn-ghost text-nui-muted" @click="needKey = false">{{ t('nl.later', 'Later') }}</button>
      </div>
    </div>

    <CollectionList
      :columns="view.columns"
      :rows="list.visibleRows.value"
      :sort-key="list.sortKey.value"
      :sort-dir="list.sortDir.value"
      :sort-keys="list.sortKeys.value"
      :sort-locked="list.sortLocked.value"
      :filters="list.columnFilters.value"
      :enum-facets="list.enumFacets.value"
      :group-lines="list.groupLines.value"
      :grouped-keys="list.groupedColumnKeys.value"
      :all-collapsed="list.allTopCollapsed.value"
      :anchor-key="anchorKey"
      row-noun="artists"
      @row-click="openArtist"
      @sort="list.onSort"
      @filter-change="(p) => list.setColumnFilter(p.key, p.value)"
      @toggle-group="list.toggleGroup"
      @toggle-collapse-all="list.toggleCollapseAll"
    >
      <template #cell-genre="{ row }">{{ enumLabel('genre', String(row.genre ?? '')) }}</template>
      <template #cell-country="{ row }">{{ enumLabel('country', String(row.country ?? '')) }}</template>
    </CollectionList>
  </section>
</template>
