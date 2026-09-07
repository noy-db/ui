<script setup lang="ts">
// Traverse scrubber — the found-set jump list inside TraverseBar's position popover. Presentational:
// renders the frozen snapshot's items (with group banners when the captured list was grouped) and a
// typed "go to #" input; all navigation is emitted up as `jump(index)` for the page's useTraverse to
// settle (immediate — same as first/last).
import { ref, onMounted } from 'vue'
import type { FoundSetSnapshot } from '@noy-db/ui'
import { useNuiI18n } from '../core/i18n'
import NuiText from '../components/NuiText.vue'

const { t } = useNuiI18n()

const props = defineProps<{
  snapshot: FoundSetSnapshot
  index: number
}>()

const emit = defineEmits<{ jump: [index: number] }>()

const goto = ref('')
function submitGoto(): void {
  const n = Number(goto.value)
  if (!Number.isFinite(n) || n < 1 || n > props.snapshot.items.length) return
  emit('jump', n - 1)
  goto.value = ''
}

// Group banners: same trail-compare idiom as CollectionList's grouped rows — walk down from the
// first level where this item's trail diverges from the previous item's, rendering one banner per
// level from there (deeper levels always re-announce when a shallower one changes).
function bannerLevels(i: number): { level: number; label: string }[] {
  const group = props.snapshot.items[i]?.group
  if (!group?.length) return []
  const prevGroup = i > 0 ? (props.snapshot.items[i - 1]?.group ?? []) : []
  const out: { level: number; label: string }[] = []
  for (let level = 0; level < group.length; level++) {
    if (out.length > 0 || group[level] !== prevGroup[level]) out.push({ level, label: group[level]! })
  }
  return out
}
const indentStyle = (level: number) => (level > 0 ? { paddingInlineStart: `${0.75 + level * 1.25}rem` } : undefined)

const listEl = ref<HTMLElement | null>(null)
onMounted(() => {
  listEl.value?.querySelector<HTMLElement>('[data-current="true"]')?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
  <div class="w-72 max-w-[90vw] py-1">
    <div class="px-3 py-1.5 border-b border-nui-border flex items-baseline gap-1.5 min-w-0">
      <NuiText :reps="[snapshot.title]" class="text-sm font-medium" />
      <span class="text-xs text-nui-muted shrink-0">{{ snapshot.items.length }} {{ t('nui.traverse.of', 'of') }} {{ snapshot.total }}</span>
    </div>

    <div class="px-3 py-2 border-b border-nui-border flex items-center gap-2">
      <label for="nui-traverse-goto" class="text-xs text-nui-muted">{{ t('nui.traverse.goto', 'Go to #') }}</label>
      <input
        id="nui-traverse-goto"
        v-model="goto"
        type="number"
        min="1"
        :max="snapshot.items.length"
        class="nui-field w-20"
        @keydown.enter="submitGoto"
      >
    </div>

    <ul ref="listEl" class="max-h-80 overflow-y-auto py-1">
      <template v-for="(item, i) in snapshot.items" :key="item.id">
        <li
          v-for="b in bannerLevels(i)"
          :key="`${item.id}-g${b.level}`"
          class="text-xs font-semibold text-nui-muted px-3 py-1"
          :style="indentStyle(b.level)"
        >
          {{ b.label }}
        </li>
        <li>
          <button
            type="button"
            class="w-full text-start truncate px-3 py-1.5 text-sm"
            :class="i === index ? 'bg-nui-bg-accent text-nui-accent' : 'hover:bg-nui-bg-accent'"
            :data-current="i === index"
            @click="emit('jump', i)"
          >
            {{ item.label }}
          </button>
        </li>
      </template>
    </ul>
  </div>
</template>
