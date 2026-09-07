<script setup lang="ts">
// Regressed CollectionList for the Nuxt UI fork: engine AppColumn[] + rows → UTable (TanStack).
// Sorting is table-local; query filtering/derivation happens upstream (useCollectionList /
// evaluate on the page). The sophisticated version — header filters, grouping, subtotals,
// column prefs — lives in @noy-db/ui-suai. Identical data capability, plainer table.
import { computed, h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { AppColumn } from '@noy-db/ui'

const props = defineProps<{
  columns: AppColumn[]
  rows: Record<string, any>[]
  loading?: boolean
}>()
const emit = defineEmits<{ 'row-click': [row: Record<string, any>] }>()

const UButton = resolveComponent('UButton')

function headerLabel(c: AppColumn): string {
  const base = c.headerSymOnly && c.headerSym ? c.headerSym : c.label
  return !c.headerSymOnly && c.headerSym ? `${base} ${c.headerSym}` : base
}

const tableColumns = computed<TableColumn<Record<string, any>>[]>(() =>
  props.columns.map((c) => ({
    accessorKey: c.key,
    meta: c.align === 'right' ? { class: { th: 'text-right', td: 'text-right' } } : undefined,
    header: c.sortable === false
      ? headerLabel(c)
      : ({ column }) => {
          const sorted = column.getIsSorted()
          return h(UButton, {
            color: 'neutral',
            variant: 'ghost',
            label: headerLabel(c),
            icon: sorted
              ? (sorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow')
              : 'i-lucide-arrow-up-down',
            class: '-mx-2.5',
            onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
          })
        },
  })),
)
</script>

<template>
  <!-- @select signature is (Event, TableRow) — event FIRST -->
  <UTable
    :data="rows"
    :columns="tableColumns"
    :loading="loading"
    @select="(_e: Event, row: any) => emit('row-click', row?.original ?? row)"
  />
</template>
