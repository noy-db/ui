<script setup lang="ts">
// Generic collection list: describe() → schema → columns → CollectionList (UTable).
// One route serves every collection; the DSL query string is the only search UI.
import { computed, ref } from 'vue'
import { useCollectionList } from '@noy-db/ui'
import { buildView, COLLECTIONS, type CollectionName } from '../../lib/views'

const route = useRoute()
const meta = COLLECTIONS.find((c) => c.name === route.params.collection)
if (!meta) throw createError({ statusCode: 404, statusMessage: 'Unknown collection' })

const { vault } = useVault()
const view = computed(() => buildView(vault.value!, meta.name as CollectionName))
const baseRows = computed(() => view.value.rows)
const query = ref('')

const list = useCollectionList({
  baseRows,
  query,
  entity: meta.name,
  columns: view.value.columns,
  defaultSort: view.value.defaultSort,
  schema: () => view.value.schema,
})

const open = (row: Record<string, any>) => navigateTo(`/${meta!.name}/${row.id}`)
</script>

<template>
  <div class="space-y-4">
    <header class="flex items-baseline justify-between">
      <h1 class="text-xl font-bold text-highlighted">{{ meta!.label }}</h1>
      <p class="text-sm text-muted">{{ list.visibleRows.value.length }} / {{ baseRows.length }}</p>
    </header>

    <SearchBox v-model="query" :placeholder="`Search ${meta!.label.toLowerCase()}… (DSL: field:value, >, <)`" />

    <EmptyState
      v-if="list.visibleRows.value.length === 0"
      icon="i-lucide-search-x"
      title="No matches"
      description="Clear the query to see every row."
      action-label="Clear"
      @action="query = ''"
    />
    <CollectionList v-else :columns="view.columns" :rows="list.visibleRows.value" @row-click="open" />
  </div>
</template>
