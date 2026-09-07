<script setup lang="ts">
// Skeleton placeholder: N pulsing bars (the last shorter). Nuxt-UI-free.
defineProps<{ lines?: number; height?: string }>()
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="i in (lines || 3)"
      :key="i"
      class="rounded bg-nui-bg-accent animate-pulse"
      :style="{ height: height || '20px', width: i === (lines || 3) ? '60%' : '100%' }"
    />
  </div>
</template>
