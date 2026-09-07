<script setup lang="ts">
// Plain app shell: collections sidebar (derived from the declared collections) + content.
import { computed } from 'vue'
import { COLLECTIONS } from '../lib/views'

const { vault, locked } = useVault()
const route = useRoute()

const counts = computed<Record<string, number>>(() => {
  if (!vault.value) return {}
  return Object.fromEntries(
    COLLECTIONS.map((c) => [c.name, vault.value!.collection(c.name).query().toArray().length]),
  )
})

function lock() {
  vault.value = null
  navigateTo('/')
}
</script>

<template>
  <div class="flex min-h-screen">
    <aside v-if="!locked" class="flex w-60 shrink-0 flex-col gap-1 border-r border-default p-4">
      <p class="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-dimmed">Collections</p>
      <UButton
        v-for="c in COLLECTIONS"
        :key="c.name"
        :to="`/${c.name}`"
        :icon="c.icon"
        color="neutral"
        variant="ghost"
        class="justify-start"
        :class="{ 'bg-elevated': route.path.startsWith(`/${c.name}`) }"
      >
        <span class="flex-1 text-left">{{ c.label }}</span>
        <span class="text-xs text-dimmed">{{ counts[c.name] }}</span>
      </UButton>
      <div class="flex-1" />
      <UButton icon="i-lucide-lock" color="neutral" variant="ghost" class="justify-start" @click="lock">
        Lock vault
      </UButton>
    </aside>
    <main class="min-w-0 flex-1 p-6">
      <slot />
    </main>
  </div>
</template>
