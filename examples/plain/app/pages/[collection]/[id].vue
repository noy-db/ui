<script setup lang="ts">
// Single-record page: raw record → RecordDetail (engine detailFields/formatDetailCell).
// Entity references navigate to the linked record; the records collection also shows its
// cover (static asset keyed by serial id, same as the showcase).
import { computed } from 'vue'
import { COLLECTIONS, entityOptions } from '../../lib/views'

const route = useRoute()
const meta = COLLECTIONS.find((c) => c.name === route.params.collection)
if (!meta) throw createError({ statusCode: 404, statusMessage: 'Unknown collection' })
const id = String(route.params.id)

const { vault } = useVault()
const col = computed(() => vault.value!.collection(meta!.name))
const fields = computed(() => col.value.describe().fields)
const record = computed(() =>
  (col.value.query().toArray() as Record<string, unknown>[]).find((r) => String(r.id) === id),
)

const options = computed(() => entityOptions(vault.value!))
const optionsFor = (key: string) => options.value[key]

// Header title: raw rows keep i18n fields as {en, th} maps — pick EN (fallback: first locale).
const displayTitle = computed(() => {
  const r = record.value
  if (!r) return id
  const pick = (v: unknown) =>
    v && typeof v === 'object' ? ((v as Record<string, unknown>).en ?? Object.values(v as object)[0]) : v
  return String(pick(r.title) ?? pick(r.name) ?? id)
})

const onRef = (t: { collection: string; id: string }) => navigateTo(`/${t.collection}/${t.id}`)
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-4">
    <UButton
      :to="`/${meta!.name}`"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      size="sm"
    >
      {{ meta!.label }}
    </UButton>

    <UCard v-if="record">
      <template #header>
        <div class="flex items-center gap-4">
          <img
            v-if="meta!.name === 'records'"
            :src="`/covers/${id}.png`"
            :alt="`Cover of ${displayTitle}`"
            class="size-16 rounded-md border border-default object-cover"
          >
          <div>
            <h1 class="text-lg font-bold text-highlighted">{{ displayTitle }}</h1>
            <p class="text-sm text-muted">{{ id }}</p>
          </div>
        </div>
      </template>
      <RecordDetail :fields="fields" :record="record" :options-for="optionsFor" @ref="onRef" />
    </UCard>

    <EmptyState v-else icon="i-lucide-file-question" title="Record not found" :description="id" />
  </div>
</template>
