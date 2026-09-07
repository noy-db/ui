<script setup lang="ts">
// A round artist avatar: the stored (circle-cropped) photo blob if present, else a deterministic
// initial-avatar (coloured gradient + first letter). The photo blob is written by the ImageCropper
// in `shape="circle"` mode, so it already has transparent corners.
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useVault } from '../composables/useVault'

const props = withDefaults(defineProps<{ id: string; name?: string; size?: number }>(), { size: 96 })
const { vault } = useVault()
const url = ref<string | null>(null)

async function load(): Promise<void> {
  if (url.value) { URL.revokeObjectURL(url.value); url.value = null }
  if (!vault.value) return
  const bytes = await vault.value.collection('artists').blob(props.id).get('avatar')
  if (bytes) url.value = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
}
onMounted(load)
watch(() => props.id, load)
onUnmounted(() => { if (url.value) URL.revokeObjectURL(url.value) })

// Deterministic hue from the id → a stable colour per artist for the fallback.
const hue = computed(() => { let h = 0; for (const c of props.id) h = (h * 31 + c.charCodeAt(0)) % 360; return h })
const initial = computed(() => (props.name?.trim()?.[0] ?? '?').toUpperCase())
</script>

<template>
  <div class="artist-avatar" :style="{ width: `${size}px`, height: `${size}px` }">
    <img v-if="url" :src="url" alt="" >
    <span
      v-else class="artist-avatar-initial"
      :style="{ fontSize: `${size * 0.42}px`, background: `linear-gradient(135deg, hsl(${hue} 55% 55%), hsl(${(hue + 45) % 360} 60% 42%))` }"
    >{{ initial }}</span>
  </div>
</template>

<style scoped>
.artist-avatar { border-radius: 50%; overflow: hidden; flex: 0 0 auto; border: 1px solid var(--nui-border); line-height: 0; }
.artist-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.artist-avatar-initial {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  color: #fff; font-family: 'Saira', system-ui, sans-serif; font-weight: 700; line-height: 1;
}
</style>
