<script setup lang="ts">
// The column filter trigger (funnel) + popover, hosted in the second header row. Reuses the
// HeaderFilter{Enum,Entity,Date} popover bodies; emits the same filterChange the table forwards.
// Nuxt-UI-free: the hand-rolled Popover + a CSS-icon funnel.
import type { AppColumn } from '@noy-db/ui'
import type { ColumnFilterValue, EntityFacets, Facet } from '@noy-db/ui'
import Popover from './Popover.vue'
import HeaderFilterEnum from './HeaderFilterEnum.vue'
import HeaderFilterEntity from './HeaderFilterEntity.vue'
import HeaderFilterDate from './HeaderFilterDate.vue'
import { useNuiI18n } from '../core/i18n'

const { t } = useNuiI18n()
const props = defineProps<{
  column: AppColumn
  filter?: ColumnFilterValue
  enumFacets?: Facet[]
  entityFacets?: EntityFacets
}>()
const emit = defineEmits<{
  filterChange: [payload: { key: string; value: ColumnFilterValue | null }]
}>()

const selectedCount = (): number => {
  const f = props.filter
  if (!f) return 0
  if (f.kind === 'date') return (f.from || f.to) ? 1 : 0
  return f.selected.length
}
function onEnum(selected: string[]): void {
  emit('filterChange', { key: props.column.key, value: selected.length ? { kind: 'enum', selected } : null })
}
function onEntity(selected: string[]): void {
  emit('filterChange', { key: props.column.key, value: selected.length ? { kind: 'entity', selected } : null })
}
function onDate(value: { from?: string; to?: string }): void {
  emit('filterChange', { key: props.column.key, value: (value.from || value.to) ? { kind: 'date', ...value } : null })
}
function clear(): void { emit('filterChange', { key: props.column.key, value: null }) }
</script>

<template>
  <Popover
    :align="column.align === 'right' ? 'end' : 'start'"
    :label="`${t('nui.filter.label', 'Filter')} ${column.label}`"
    :trigger-class="`inline-flex items-center gap-0.5 shrink-0 align-middle hover:text-nui-accent ${selectedCount() ? 'text-nui-accent' : 'text-nui-muted'}`"
  >
    <span class="i-lucide-list-filter size-3 opacity-70" aria-hidden="true" />
    <span v-if="selectedCount()" class="text-[10px] leading-none font-semibold">{{ selectedCount() }}</span>

    <template #content>
      <HeaderFilterEnum
        v-if="column.filter === 'enum'"
        :facets="enumFacets ?? []"
        :selected="filter && filter.kind === 'enum' ? filter.selected : []"
        @change="onEnum"
        @clear="clear"
      />
      <HeaderFilterEntity
        v-else-if="column.filter === 'entity'"
        :in-view="entityFacets?.inView ?? []"
        :others="entityFacets?.others ?? []"
        :selected="filter && filter.kind === 'entity' ? filter.selected : []"
        @change="onEntity"
        @clear="clear"
      />
      <HeaderFilterDate
        v-else
        :from="filter && filter.kind === 'date' ? filter.from : undefined"
        :to="filter && filter.kind === 'date' ? filter.to : undefined"
        @change="onDate"
        @clear="clear"
      />
    </template>
  </Popover>
</template>
