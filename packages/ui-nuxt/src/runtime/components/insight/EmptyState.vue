<script setup lang="ts">
// Empty/zero-state block on Nuxt UI: icon + title + optional description + optional action.
defineProps<{ icon?: string; title: string; description?: string; actionLabel?: string }>()
defineEmits<{ action: [] }>()
</script>

<template>
  <div class="py-12 text-center">
    <UIcon v-if="icon" :name="icon" class="mx-auto mb-3 block size-10 text-muted" aria-hidden="true" />
    <h3 class="text-base font-medium text-highlighted">{{ title }}</h3>
    <p v-if="description" class="mx-auto mt-1 max-w-sm text-sm text-muted">{{ description }}</p>
    <div v-if="actionLabel || $slots.action" class="mt-4">
      <slot name="action">
        <UButton :label="actionLabel" @click="$emit('action')" />
      </slot>
    </div>
  </div>
</template>
