<script setup lang="ts">
// Categorical filter popover body: faceted checkboxes (value + count), applied immediately on
// toggle. Emits the new selected[] (empty = inactive). Nuxt-UI-free: native checkboxes + nui shortcuts.
import { computed } from 'vue'
import type { Facet } from '@noy-db/ui'
import { useNuiI18n } from '../core/i18n'

const props = defineProps<{ facets: Facet[]; selected: string[] }>()
const emit = defineEmits<{ change: [selected: string[]]; clear: [] }>()
const { t } = useNuiI18n()

const allSelected = computed(() => props.facets.length > 0 && props.facets.every((f) => props.selected.includes(f.value)))

function toggle(value: string, checked: boolean): void {
  const set = new Set(props.selected)
  if (checked) set.add(value)
  else set.delete(value)
  emit('change', [...set])
}
function selectAll(): void { emit('change', props.facets.map((f) => f.value)) }
</script>

<template>
  <div class="p-1 min-w-56 text-left" role="dialog" :aria-label="t('nui.filter.title', 'Filter')">
    <ul class="max-h-72 overflow-y-auto py-1">
      <li v-for="f in facets" :key="f.value">
        <label class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-nui-bg-accent cursor-pointer">
          <input
            type="checkbox"
            class="accent-nui-accent"
            :checked="selected.includes(f.value)"
            @change="toggle(f.value, ($event.target as HTMLInputElement).checked)"
          >
          <span class="flex-1 truncate text-sm">{{ f.label ?? f.value }}</span>
          <span class="text-xs text-nui-muted tabular-nums">{{ f.count }}</span>
        </label>
      </li>
      <li v-if="facets.length === 0" class="px-2 py-2 text-sm text-nui-muted">{{ t('nui.filter.noValues', 'No values.') }}</li>
    </ul>
    <div class="border-t border-nui-border pt-1 flex justify-between">
      <button type="button" class="nui-btn-ghost" :disabled="allSelected" @click="selectAll">{{ t('nui.selectAll', 'Select all') }}</button>
      <button type="button" class="nui-btn-ghost" :disabled="selected.length === 0" @click="emit('clear')">{{ t('nui.clear', 'Clear') }}</button>
    </div>
  </div>
</template>
