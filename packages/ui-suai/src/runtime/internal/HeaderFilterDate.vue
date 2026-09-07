<script setup lang="ts">
// Date column popover body: an inclusive from/to ISO range + quick presets. Emits `change` with
// { from?, to? } (empty = inactive). Nuxt-UI-free: native date inputs + nui shortcuts.
import { useNuiI18n } from '../core/i18n'
const props = defineProps<{ from?: string; to?: string }>()
const emit = defineEmits<{ change: [value: { from?: string; to?: string }]; clear: [] }>()
const { t } = useNuiI18n()

function iso(d: Date): string { return d.toISOString().slice(0, 10) }
function thisYear(): void {
  const y = new Date().getFullYear()
  emit('change', { from: `${y}-01-01`, to: `${y}-12-31` })
}
function lastDays(n: number): void {
  const to = new Date()
  const from = new Date(); from.setDate(from.getDate() - n)
  emit('change', { from: iso(from), to: iso(to) })
}
function setFrom(e: Event): void { emit('change', { from: (e.target as HTMLInputElement).value || undefined, to: props.to }) }
function setTo(e: Event): void { emit('change', { from: props.from, to: (e.target as HTMLInputElement).value || undefined }) }
</script>

<template>
  <div class="p-2 min-w-64 flex flex-col gap-3" role="dialog" :aria-label="t('nui.filter.byDate', 'Filter by date')">
    <div class="grid grid-cols-[auto_1fr] items-center gap-2">
      <span class="text-xs text-nui-muted">{{ t('nui.filter.from', 'From') }}</span>
      <input type="date" class="nui-field" :value="from ?? ''" @input="setFrom">
      <span class="text-xs text-nui-muted">{{ t('nui.filter.to', 'To') }}</span>
      <input type="date" class="nui-field" :value="to ?? ''" @input="setTo">
    </div>
    <div class="flex flex-wrap gap-1">
      <button type="button" class="nui-btn-soft" @click="thisYear">{{ t('nui.filter.thisYear', 'This year') }}</button>
      <button type="button" class="nui-btn-soft" @click="lastDays(30)">{{ t('nui.filter.last30', 'Last 30 days') }}</button>
      <button type="button" class="nui-btn-soft" @click="lastDays(90)">{{ t('nui.filter.last90', 'Last 90 days') }}</button>
    </div>
    <div class="border-t border-nui-border pt-1 flex justify-end">
      <button type="button" class="nui-btn-ghost" :disabled="!from && !to" @click="emit('clear')">{{ t('nui.clear', 'Clear') }}</button>
    </div>
  </div>
</template>
