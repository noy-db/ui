<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useVault } from '../composables/useVault'
import { loadCoverBytes } from '../lib/cover'

const props = defineProps<{ id: string; thumb?: boolean }>()

const url = ref<string | null>(null)
const kb = ref(0)

const { vault } = useVault()

onMounted(async () => {
  if (!vault.value) return
  const bytes = await loadCoverBytes(vault.value, props.id)
  kb.value = Math.round(bytes.length / 1024)
  url.value = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
})

onUnmounted(() => {
  if (url.value) URL.revokeObjectURL(url.value)
})
</script>

<template>
  <figure :class="thumb ? 'nui-cover-thumb' : 'nui-cover-hero'" data-tour="cover">
    <img v-if="url" :src="url" alt="cover" />
    <figcaption v-if="!thumb && url">decrypted from a vault blob · {{ kb }} KB</figcaption>
  </figure>
</template>

<style scoped>
.nui-cover-thumb {
  margin: 0;
  line-height: 0;
}
.nui-cover-thumb img {
  width: 38px;
  height: 38px;
  max-width: none;
  object-fit: cover;
  display: block;
  border-radius: var(--radius-control, 4px);
  border: var(--border-w, 1px) solid var(--hairline, var(--nui-border));
}
.nui-cover-hero {
  margin: 0 0 1rem;
}
.nui-cover-hero img {
  width: 100%;
  max-width: 260px;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
  border-radius: var(--radius, 8px);
  border: var(--border-w, 1px) solid var(--hairline, var(--nui-border));
  box-shadow: var(--shadow-card, 0 2px 12px rgba(0, 0, 0, 0.12));
}
.nui-cover-hero figcaption {
  margin-top: 0.45rem;
  font-size: 0.72rem;
  letter-spacing: 0.02em;
  color: var(--nui-muted);
  font-family: var(--font-mono, inherit);
}
</style>
