<script setup lang="ts">
// High-cardinality filter popover body: a typeahead over two faceted sections — "In view" (values
// present in the visible rows) and "All others" (exist in the dataset but filtered out). Toggling
// applies immediately. Emits the new selected[] (empty = inactive). Nuxt-UI-free.
import { computed, ref } from 'vue'
import type { Facet } from '@noy-db/ui'
import { useNuiI18n } from '../core/i18n'

const props = defineProps<{ inView: Facet[]; others: Facet[]; selected: string[] }>()
const emit = defineEmits<{ change: [selected: string[]]; clear: [] }>()
const { t } = useNuiI18n()

const q = ref('')
const match = (list: Facet[]) => {
  const n = q.value.trim().toLowerCase()
  return n ? list.filter((f) => f.value.toLowerCase().includes(n)) : list
}
const inViewF = computed(() => match(props.inView))
const othersF = computed(() => match(props.others))

const displayed = computed(() => [...inViewF.value, ...othersF.value])
const allSelected = computed(() => displayed.value.length > 0 && displayed.value.every((f) => props.selected.includes(f.value)))

function toggle(value: string, checked: boolean): void {
  const set = new Set(props.selected)
  if (checked) set.add(value)
  else set.delete(value)
  emit('change', [...set])
}
function selectAll(): void {
  const set = new Set(props.selected)
  for (const f of displayed.value) set.add(f.value)
  emit('change', [...set])
}
</script>

<template>
  <div class="p-1 min-w-64" role="dialog" :aria-label="t('nui.filter.title', 'Filter')">
    <div class="p-1 relative">
      <span class="i-lucide-search size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-nui-subtle" aria-hidden="true" />
      <input v-model="q" class="nui-field ps-7" :placeholder="t('nui.filter.search', 'Search…')">
    </div>
    <div class="max-h-72 overflow-y-auto py-1">
      <template v-if="inViewF.length">
        <p class="px-2 pt-1 pb-0.5 text-[11px] uppercase tracking-wide text-nui-muted">{{ t('nui.filter.inView', 'In view') }}</p>
        <label v-for="f in inViewF" :key="`v-${f.value}`" class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-nui-bg-accent cursor-pointer">
          <input type="checkbox" class="accent-nui-accent" :checked="selected.includes(f.value)" @change="toggle(f.value, ($event.target as HTMLInputElement).checked)">
          <span class="flex-1 truncate text-sm">{{ f.value }}</span>
          <span class="text-xs text-nui-muted tabular-nums">{{ f.count }}</span>
        </label>
      </template>
      <template v-if="othersF.length">
        <p class="px-2 pt-2 pb-0.5 text-[11px] uppercase tracking-wide text-nui-muted">{{ t('nui.filter.allOthers', 'All others') }}</p>
        <label v-for="f in othersF" :key="`o-${f.value}`" class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-nui-bg-accent cursor-pointer">
          <input type="checkbox" class="accent-nui-accent" :checked="selected.includes(f.value)" @change="toggle(f.value, ($event.target as HTMLInputElement).checked)">
          <span class="flex-1 truncate text-sm">{{ f.value }}</span>
          <span class="text-xs text-nui-muted tabular-nums">{{ f.count }}</span>
        </label>
      </template>
      <p v-if="!inViewF.length && !othersF.length" class="px-2 py-2 text-sm text-nui-muted">{{ t('nui.filter.noMatches', 'No matches.') }}</p>
    </div>
    <div class="border-t border-nui-border pt-1 flex justify-between">
      <button type="button" class="nui-btn-ghost" :disabled="allSelected" @click="selectAll">{{ t('nui.selectAll', 'Select all') }}</button>
      <button type="button" class="nui-btn-ghost" :disabled="selected.length === 0" @click="emit('clear')">{{ t('nui.clear', 'Clear') }}</button>
    </div>
  </div>
</template>
