<script setup lang="ts">
// Active-filter summary: one removable chip per active column filter, plus "Clear all".
// Nuxt-UI-free: styled with UnoCSS utilities + --nui tokens; the × is a preset-icons CSS icon.
import type { FilterChip } from '@noy-db/ui'
import { useNuiI18n } from '../core/i18n'
defineProps<{ chips: FilterChip[] }>()
const emit = defineEmits<{ remove: [key: string]; clearAll: [] }>()
// UI strings route through the injected translator (English fallback if no locale configured).
const { t } = useNuiI18n()
</script>

<template>
  <div v-if="chips.length" class="flex flex-wrap items-center gap-2 mb-2" aria-live="polite">
    <span class="text-xs text-nui-muted">{{ t('nui.filters', 'Filters') }}:</span>
    <span v-for="chip in chips" :key="chip.key" class="nui-chip bg-nui-bg-accent text-nui-accent">
      <span class="font-medium">{{ chip.label }}:</span> {{ chip.text }}
      <button
        type="button"
        class="nui-icon-btn ms-1 hover:text-nui-accent"
        :aria-label="`Remove ${chip.label} filter`"
        @click="emit('remove', chip.key)"
      >
        <span class="i-lucide-x size-3" aria-hidden="true" />
      </button>
    </span>
    <button type="button" class="nui-btn-ghost" @click="emit('clearAll')">{{ t('nui.clearAll', 'Clear all') }}</button>
  </div>
</template>
