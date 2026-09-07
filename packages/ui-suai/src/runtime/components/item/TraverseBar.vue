<script setup lang="ts">
// Traverse bar — sticky found-set stepper above an item's detail view (FileMaker-style browse).
// Presentational + keyboard only: the PAGE owns useTraverse (the skim controller) and passes down
// the frozen snapshot + derived position; this component renders the fixed cluster (spec D9) and
// emits intents (go/goTo/first/last/back) for the page to act on.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { FoundSetSnapshot, TraversePosition } from '@noy-db/ui'
import { useNuiI18n } from '../../core/i18n'
import { useContainerSize } from '../../core/container'
import NuiText from '../NuiText.vue'
import Popover from '../../internal/Popover.vue'
import TraverseScrubber from '../../internal/TraverseScrubber.vue'

const { t } = useNuiI18n()

const props = withDefaults(defineProps<{
  snapshot: FoundSetSnapshot
  position: TraversePosition | null
  skimming?: boolean
  editing?: boolean
}>(), { skimming: false, editing: false })

const emit = defineEmits<{
  go: [delta: number]
  goTo: [index: number]
  first: []
  last: []
  back: []
}>()

const host = ref<HTMLElement | null>(null)
const { width } = useContainerSize(host)

// Fixed width per D9 — reserved for the max digit count so the cluster never reflows under the pointer.
const posWidth = computed(() => `${String(props.snapshot.items.length).length * 2 + 1}ch`)

const prevTitle = computed(() => {
  const base = t('nui.traverse.prev', 'Previous')
  const label = props.position?.prev?.label
  return label ? `${base} — ${label}` : base
})
const nextTitle = computed(() => {
  const base = t('nui.traverse.next', 'Next')
  const label = props.position?.next?.label
  return label ? `${base} — ${label}` : base
})

function onKeydown(e: KeyboardEvent): void {
  if (props.editing) return
  const target = e.target as HTMLElement | null
  const tag = target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
  if (e.metaKey || e.ctrlKey || e.shiftKey) return
  if (e.altKey) {
    if (e.key === 'ArrowDown') { e.preventDefault(); emit('go', 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); emit('go', -1) }
    return
  }
  if (e.key === 'j') { e.preventDefault(); emit('go', 1) }
  else if (e.key === 'k') { e.preventDefault(); emit('go', -1) }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div ref="host" class="nui-traverse sticky top-0 z-10 bg-nui-bg flex items-center gap-2 py-1.5" :class="editing ? 'opacity-50 pointer-events-none' : ''">
    <button type="button" class="nui-btn-ghost min-w-0 flex-1 justify-start" :title="snapshot.title" :aria-label="t('nui.traverse.back', 'Back to list')" @click="emit('back')">
      <span aria-hidden="true">←</span> <NuiText :reps="[snapshot.title]" />
    </button>

    <div class="shrink-0 flex items-center gap-1">
      <button type="button" class="nui-icon-btn" :title="t('nui.traverse.first', 'First')" @click="emit('first')">
        <span class="i-lucide-chevrons-up size-4" aria-hidden="true" />
      </button>
      <span v-if="width >= 640 && position?.prev" class="text-xs text-nui-muted max-w-32 truncate">{{ position.prev.label }}</span>
      <button type="button" class="nui-icon-btn disabled:opacity-40" :disabled="position?.atFirst" :title="prevTitle" @click="emit('go', -1)">
        <span class="i-lucide-chevron-up size-4" aria-hidden="true" />
      </button>

      <Popover align="end" :label="t('nui.traverse.goto', 'Go to #')" trigger-class="nui-icon-btn px-2">
        <span class="tabular-nums inline-block text-center" :class="skimming ? 'text-nui-accent' : ''" :style="{ minWidth: posWidth }">
          {{ position ? position.index + 1 : '–' }}/{{ snapshot.items.length }}
        </span>
        <template #content="{ close }">
          <TraverseScrubber :snapshot="snapshot" :index="position ? position.index : 0" @jump="(i) => { emit('goTo', i); close() }" />
        </template>
      </Popover>

      <button type="button" class="nui-icon-btn disabled:opacity-40" :disabled="position?.atLast" :title="nextTitle" @click="emit('go', 1)">
        <span class="i-lucide-chevron-down size-4" aria-hidden="true" />
      </button>
      <span v-if="width >= 640 && position?.next" class="text-xs text-nui-muted max-w-32 truncate">{{ position.next.label }}</span>
      <button type="button" class="nui-icon-btn" :title="t('nui.traverse.last', 'Last')" @click="emit('last')">
        <span class="i-lucide-chevrons-down size-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
