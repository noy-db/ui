<script setup lang="ts">
// Empty/zero-state block: icon + title + optional description + an optional action. Nuxt-UI-free.
// The action emits `action`; use the #action slot for a router link or custom control.
defineProps<{ icon?: string; title: string; description?: string; actionLabel?: string }>()
defineEmits<{ action: [] }>()
</script>

<template>
  <div class="text-center py-12">
    <span v-if="icon" :class="[icon, 'size-10 text-nui-muted mx-auto mb-3 block']" aria-hidden="true" />
    <h3 class="text-base font-medium text-nui-fg">{{ title }}</h3>
    <p v-if="description" class="text-sm text-nui-muted mt-1 max-w-sm mx-auto">{{ description }}</p>
    <div v-if="actionLabel || $slots.action" class="mt-4">
      <slot name="action">
        <button type="button" class="nui-btn bg-nui-accent text-nui-accent-fg px-3 py-1.5" @click="$emit('action')">{{ actionLabel }}</button>
      </slot>
    </div>
  </div>
</template>
