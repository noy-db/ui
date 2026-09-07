<script setup lang="ts">
// KPI/metric card on Nuxt UI semantics: label + big value + optional sub-value + tinted icon
// badge. Colors ride Nuxt UI's semantic aliases (primary/success/warning/error/info).
defineProps<{
  label: string
  value: string | number
  subValue?: string
  icon?: string
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info'
}>()

const badge: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  info: 'bg-info/10 text-info',
}
</script>

<template>
  <div class="rounded-lg border border-default bg-default p-4">
    <div class="flex items-start gap-4">
      <div
        v-if="icon"
        class="flex size-11 shrink-0 items-center justify-center rounded-md"
        :class="badge[color ?? 'primary']"
      >
        <UIcon :name="icon" class="size-6" aria-hidden="true" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm text-muted">{{ label }}</p>
        <p class="mt-1 text-2xl font-bold text-highlighted">{{ value }}</p>
        <p v-if="subValue" class="mt-1 text-xs text-muted">{{ subValue }}</p>
      </div>
    </div>
  </div>
</template>
