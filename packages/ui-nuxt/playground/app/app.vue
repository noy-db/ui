<script setup lang="ts">
// Exercises the full chain: DSL query string → useCollectionList (parse/resolve/evaluate)
// → regressed CollectionList (UTable) + SearchBox (UInput) + insight cards. Fake data, no hub.
import { computed, ref } from 'vue'
import { useCollectionList, type AppColumn, type EntitySchema } from '@noy-db/ui'

const schema: EntitySchema = {
  entity: 'records',
  fields: [
    { id: 'title', label: 'Title', type: 'text' },
    { id: 'artist', label: 'Artist', type: 'text' },
    { id: 'year', label: 'Year', type: 'number' },
    { id: 'genre', label: 'Genre', type: 'enum', enumOrder: ['classical', 'jazz', 'soul', 'rock', 'electronic', 'hip-hop'] },
    { id: 'price', label: 'Price', type: 'money' },
  ],
  textFields: ['title', 'artist'],
}

const columns: AppColumn[] = [
  { key: 'title', label: 'Title', sortable: true },
  { key: 'artist', label: 'Artist', sortable: true },
  { key: 'year', label: 'Year', sortable: true, align: 'right' },
  { key: 'genre', label: 'Genre', sortable: true },
  { key: 'price', label: 'Price', headerSym: '$', sortable: true, align: 'right', summable: true },
]

const baseRows = ref([
  { title: 'Blue Note Sketches', artist: 'Blue Quartet', year: 1963, genre: 'jazz', price: 33 },
  { title: 'Concerto No. 3', artist: 'Aurelia Strings', year: 1958, genre: 'classical', price: 41 },
  { title: 'Echoes at Dawn', artist: 'The Midnight Echoes', year: 1973, genre: 'rock', price: 34 },
  { title: 'Kosmos Drift', artist: 'Neon Circuit', year: 1985, genre: 'electronic', price: 32 },
  { title: 'Marvelle Live', artist: 'Marvelle', year: 1970, genre: 'soul', price: 18 },
  { title: 'Boom Bap Almanac', artist: 'Crate Diggers', year: 1995, genre: 'hip-hop', price: 45 },
  { title: 'Quartet in Blue', artist: 'Blue Quartet', year: 1961, genre: 'jazz', price: 58 },
  { title: 'Neon Drift', artist: 'Neon Circuit', year: 1983, genre: 'electronic', price: 12 },
])

const query = ref('')
const list = useCollectionList({
  baseRows,
  query,
  entity: 'records',
  columns,
  defaultSort: [{ field: 'title', dir: 'asc' }],
  schema,
})

const clicked = ref('')
const count = computed(() => list.visibleRows.value.length)
const avgPrice = computed(() => {
  const rows = list.visibleRows.value
  return rows.length ? Math.round(rows.reduce((s, r) => s + r.price, 0) / rows.length) : 0
})

const { resolved, set } = useTheme()
</script>

<template>
  <UApp>
    <div class="mx-auto max-w-4xl space-y-6 p-8">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-highlighted">ui-nuxt playground</h1>
          <p class="text-sm text-muted">the plain fork — Nuxt UI primitives, engine intact</p>
        </div>
        <UButton
          :icon="resolved === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
          color="neutral"
          variant="ghost"
          @click="set(resolved === 'dark' ? 'light' : 'dark')"
        />
      </header>

      <div class="grid grid-cols-3 gap-4">
        <StatCard label="Records" :value="count" icon="i-lucide-disc-3" />
        <StatCard label="Avg price" :value="`$${avgPrice}`" icon="i-lucide-dollar-sign" color="success" />
        <StatCard label="Query" :value="query || '—'" icon="i-lucide-search" color="info" />
      </div>

      <SearchBox v-model="query" placeholder="Try: genre:jazz · year>1970 · blue" />

      <EmptyState
        v-if="count === 0"
        icon="i-lucide-search-x"
        title="No records match"
        description="The DSL still works here — clear the query to see everything."
        action-label="Clear"
        @action="query = ''"
      />
      <CollectionList
        v-else
        :columns="columns"
        :rows="list.visibleRows.value"
        @row-click="(r) => (clicked = r.title)"
      />

      <p v-if="clicked" class="text-sm text-muted">row-click: <span class="text-highlighted">{{ clicked }}</span></p>
    </div>
  </UApp>
</template>
