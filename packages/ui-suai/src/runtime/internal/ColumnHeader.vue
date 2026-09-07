<script setup lang="ts">
// Label-row header cell: column label + sort affordance. Single click = transient sort (cycle
// asc→desc→off). Double-click LOCKS the column into the numbered multi-sort chain; shift-click also
// extends. A faint chevrons icon signals sortability; a bold ▲/▼ shows direction; a number badge
// shows the position when the sort is "locked"/multi. Nuxt-UI-free.
import { computed, onBeforeUnmount } from 'vue'
import type { AppColumn } from '@noy-db/ui'
import type { SortKey } from '@noy-db/ui'
import { useNuiI18n } from '../core/i18n'
import { vEllipsisTitle } from './ellipsis-title'

const { t } = useNuiI18n()

const props = defineProps<{
  column: AppColumn
  sortKeys?: SortKey[]
  sortKey?: string | null
  sortDir?: 'asc' | 'desc' | null
  numbered?: boolean
  subLabel?: string
}>()
const emit = defineEmits<{
  sort: [payload: { key: string; additive?: boolean }]
  lockSort: [payload: { key: string }]
}>()

const sortEntryIndex = computed(() => props.sortKeys?.findIndex((s) => s.field === props.column.key) ?? -1)
const isSorted = computed(() =>
  props.sortKeys ? sortEntryIndex.value !== -1 : props.sortKey === props.column.key)
const dir = computed<'asc' | 'desc' | null>(() =>
  props.sortKeys ? (sortEntryIndex.value !== -1 ? props.sortKeys[sortEntryIndex.value]!.dir : null) : (props.sortDir ?? null))
const sortPriority = computed(() => (props.numbered && sortEntryIndex.value !== -1 ? sortEntryIndex.value + 1 : null))

let timer: ReturnType<typeof setTimeout> | null = null
function onClick(e: MouseEvent): void {
  if (e.shiftKey) { emit('sort', { key: props.column.key, additive: true }); return }
  if (timer) return
  timer = setTimeout(() => { timer = null; emit('sort', { key: props.column.key }) }, 200)
}
function onDblclick(): void {
  if (timer) { clearTimeout(timer); timer = null }
  emit('lockSort', { key: props.column.key })
}
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
</script>

<template>
  <button
    v-if="column.sortable"
    type="button"
    class="inline-flex flex-col text-nui-accent-fg select-none"
    :class="column.align === 'right' ? 'items-end' : 'items-start'"
    :title="t('nui.sort.hint', 'Click to sort · Double-click to lock a multi-sort · Shift-click to add')"
    @click="onClick"
    @dblclick="onDblclick"
  >
    <span class="inline-flex items-center gap-1 whitespace-nowrap max-w-full min-w-0" :class="column.align === 'right' ? 'flex-row-reverse' : ''">
      <span v-if="column.headerSymOnly" class="shrink-0">{{ column.headerSym }}</span>
      <template v-else>
        <span v-ellipsis-title class="min-w-0 truncate">{{ column.label }}</span>
        <span v-if="column.headerSym" class="shrink-0 font-normal opacity-60" aria-hidden="true">{{ column.headerSym }}</span>
      </template>
      <span v-if="isSorted" class="shrink-0 text-[0.8rem] leading-none font-bold" aria-hidden="true">{{ dir === 'asc' ? '▲' : '▼' }}</span>
      <span v-else-if="!column.headerSymOnly" class="relative w-0 h-3 shrink-0" aria-hidden="true">
        <span class="nui-sort-hint i-lucide-chevrons-up-down size-3 absolute top-0" :class="column.align === 'right' ? 'right-0' : 'left-0'" />
      </span>
      <span v-if="sortPriority" class="inline-flex items-center justify-center rounded-full bg-nui-accent-fg/30 text-[10px] font-semibold leading-none size-3.5">{{ sortPriority }}</span>
    </span>
    <span v-if="subLabel" class="text-[10px] font-normal opacity-70 leading-tight whitespace-nowrap">{{ subLabel }}</span>
  </button>
  <span v-else class="inline-flex flex-col max-w-full" :class="column.align === 'right' ? 'items-end' : 'items-start'">
    <span class="inline-flex items-center gap-1 whitespace-nowrap max-w-full min-w-0">
      <span v-if="column.headerSymOnly" class="shrink-0">{{ column.headerSym }}</span>
      <template v-else>
        <span v-ellipsis-title class="min-w-0 truncate">{{ column.label }}</span>
        <span v-if="column.headerSym" class="shrink-0 font-normal opacity-60" aria-hidden="true">{{ column.headerSym }}</span>
      </template>
    </span>
    <span v-if="subLabel" class="text-[10px] font-normal opacity-70 leading-tight whitespace-nowrap">{{ subLabel }}</span>
  </span>
</template>
