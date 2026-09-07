<script setup lang="ts">
// Item family — a related list with a derived summary (Item Release P6). On a record's detail
// (e.g. a label), this card shows the rows of another collection that reference it — the host runs
// the reverse-lookup (`records.query().where('labelId','==',id)`) and the same query's
// `aggregate()` for the summary. This component is presentational: a StatCard strip over a compact
// CollectionList. Cell slots forward through to the inner list, so the host localizes enum/entity
// cells exactly as on the full list page.
import type { AppColumn } from '@noy-db/ui'
import type { SummaryCard } from '@noy-db/ui'
import { useNuiI18n } from '../../core/i18n'
import CollectionList from '../CollectionList.vue'
import StatCard from '../insight/StatCard.vue'

const { t } = useNuiI18n()

const props = withDefaults(defineProps<{
  /** Card heading — usually the related collection's plural label ("Records"). */
  title: string
  /** Derived-summary cards from `summaryCards(aggregate().run(), spec)`. */
  summary?: SummaryCard[]
  columns: AppColumn[]
  rows: Record<string, any>[]
  rowKey?: (row: Record<string, any>) => string
  emptyText?: string
}>(), { summary: () => [], rows: () => [] })

const emit = defineEmits<{ rowClick: [row: Record<string, any>] }>()
</script>

<template>
  <section class="nui-panel nui-card space-y-3">
    <div class="flex items-baseline gap-2">
      <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted">{{ title }}</h3>
      <span class="text-[10px] text-nui-subtle tabular-nums">{{ rows.length }}</span>
    </div>

    <div v-if="summary.length" class="grid gap-2" :class="summary.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'">
      <StatCard v-for="s in summary" :key="s.label" :label="s.label" :value="s.value" :icon="s.icon" :color="s.color" />
    </div>

    <CollectionList
      v-if="rows.length"
      :columns="columns"
      :rows="rows"
      :row-key="rowKey"
      :serial-index="false"
      row-noun="records"
      @row-click="(r: Record<string, any>) => emit('rowClick', r)"
    >
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </CollectionList>
    <p v-else class="text-sm text-nui-subtle">{{ emptyText ?? t('nui.related.empty', 'Nothing here yet.') }}</p>
  </section>
</template>

<style scoped>
.nui-card { padding: var(--nui-card-px, 1rem); }
</style>
