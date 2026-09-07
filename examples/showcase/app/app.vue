<script setup lang="ts">
import { provideNoydbUi } from '@noy-db/ui-suai/core'
import { useShowcaseI18n } from './composables/useShowcaseI18n'
import { makeAnthropicLlm } from './lib/anthropicLlm'
import { useApiKey } from './composables/useApiKey'

const { locale, t } = useShowcaseI18n()
// TODO: key is BYO — the user pastes it via NlSearchButton; never hardcoded.
provideNoydbUi({
  theme: 'system',
  locale: locale.value,
  // Components pass their FULL key ('nui.search.placeholder') — forward it verbatim. (A previous
  // version prepended 'nui.' here, double-prefixing every lookup so no catalog entry ever matched.)
  t: (k, f) => t(k, f),
  llm: makeAnthropicLlm(() => useApiKey().key.value),
})
</script>

<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
