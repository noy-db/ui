<script setup lang="ts">
// Item family — path-shaped detail title (spec D7/D9): a breadcrumb-like trail (the group-by chain
// when the found set was grouped, else the entity's natural ref axis) terminating in the record's
// title. Presentational + container-measured (not viewport), like the rest of the item family: the
// host page owns navigation — `back` re-enters the found set at the group, `navigate` jumps to a
// referenced record's own detail.
import { ref, computed } from 'vue'
import type { PathSegment } from '@noy-db/ui'
import { useNuiI18n } from '../../core/i18n'
import { useContainerSize } from '../../core/container'
import NuiText from '../NuiText.vue'

const { t } = useNuiI18n()

const props = defineProps<{ segments: readonly PathSegment[] }>()
const emit = defineEmits<{ back: []; navigate: [{ collection: string; id: string }] }>()

const host = ref<HTMLElement | null>(null)
const { width } = useContainerSize(host)

// Below 448px, a full trail crowds out the title — collapse to first › … › terminal.
type PathItem = { ellipsis: true } | { ellipsis: false; seg: PathSegment }
const items = computed<PathItem[]>(() => {
  const segs = props.segments
  if (width.value < 448 && segs.length > 2) {
    return [{ ellipsis: false, seg: segs[0]! }, { ellipsis: true }, { ellipsis: false, seg: segs[segs.length - 1]! }]
  }
  return segs.map((seg) => ({ ellipsis: false, seg }))
})

function onClick(seg: PathSegment): void {
  if (seg.kind === 'group') emit('back')
  else if (seg.kind === 'entity' && seg.ref) emit('navigate', seg.ref)
}
</script>

<template>
  <nav ref="host" class="nui-path flex items-center gap-1 min-w-0" :aria-label="t('nui.path.label', 'Path')">
    <template v-for="(item, i) in items" :key="i">
      <span v-if="i > 0" class="text-nui-subtle shrink-0" aria-hidden="true">›</span>
      <span v-if="item.ellipsis" class="text-nui-subtle shrink-0 select-none" aria-hidden="true">…</span>
      <NuiText v-else-if="item.seg.kind === 'title'" :reps="[item.seg.label]" class="min-w-0 flex-1 text-lg font-semibold text-nui-fg" />
      <button
        v-else
        type="button"
        class="nui-btn-ghost text-nui-muted hover:text-nui-accent shrink-0"
        @click="onClick(item.seg)"
      >{{ item.seg.label }}</button>
    </template>
  </nav>
</template>
