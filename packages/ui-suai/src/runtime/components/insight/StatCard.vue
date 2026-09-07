<script setup lang="ts">
// A single KPI/metric card: label + big value + optional sub-value + a tinted icon badge.
// Nuxt-UI-free (nui-panel surface; --nui-badge-* CSS variables for the badge tints so all
// 6 themes adapt correctly in both light and dark modes).
defineProps<{
  label: string
  value: string | number
  subValue?: string
  icon?: string
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info'
}>()
</script>

<template>
  <div class="nui-panel p-4">
    <div class="flex items-start gap-4">
      <div
        v-if="icon"
        class="nui-stat-badge"
        :class="{
          'nui-stat-badge--primary': color === 'primary' || !color,
          'nui-stat-badge--success': color === 'success',
          'nui-stat-badge--warning': color === 'warning',
          'nui-stat-badge--error': color === 'error',
          'nui-stat-badge--info': color === 'info',
        }"
      >
        <span :class="[icon, 'size-6']" aria-hidden="true" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-nui-muted truncate">{{ label }}</p>
        <p class="text-2xl font-bold mt-1 text-nui-fg">{{ value }}</p>
        <p v-if="subValue" class="text-xs text-nui-muted mt-1">{{ subValue }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nui-stat-badge {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: max(6px, var(--radius, 6px));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nui-stat-badge--primary { background: var(--nui-bg-accent); color: var(--nui-accent); }
.nui-stat-badge--success { background: var(--nui-badge-success-bg); color: var(--nui-badge-success-fg); }
.nui-stat-badge--warning { background: var(--nui-badge-warning-bg); color: var(--nui-badge-warning-fg); }
.nui-stat-badge--error { background: var(--nui-badge-error-bg); color: var(--nui-badge-error-fg); }
.nui-stat-badge--info { background: var(--nui-badge-info-bg); color: var(--nui-badge-info-fg); }
</style>
