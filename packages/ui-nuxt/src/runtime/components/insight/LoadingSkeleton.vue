<script setup lang="ts">
// Skeleton placeholder: N pulsing bars (the last shorter), via USkeleton.
defineProps<{ lines?: number; height?: string }>()
</script>

<template>
  <div class="space-y-3">
    <USkeleton
      v-for="i in (lines || 3)"
      :key="i"
      :style="{ height: height || '20px', width: i === (lines || 3) ? '60%' : '100%' }"
    />
  </div>
</template>
