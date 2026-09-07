<script setup lang="ts">
// Regressed SearchBox for the Nuxt UI fork: one UInput bound to the query STRING. The engine
// DSL still applies in full upstream (parse → resolve → evaluate) — only the pill UI, saved
// searches, and suggestions are gone (they live in @noy-db/ui-suai).
const model = defineModel<string>({ default: '' })
defineProps<{ placeholder?: string }>()
</script>

<template>
  <UInput
    v-model="model"
    icon="i-lucide-search"
    :placeholder="placeholder ?? 'Search…'"
    class="w-full"
  />
</template>
