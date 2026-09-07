<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Popover from '../internal/Popover.vue'
import { useNuiI18n } from '../core/i18n'

export type ColViz = 'essential' | 'show-sm' | 'show-lg' | 'hidden'

export interface ColDef {
  key: string
  label: string
  /** UnoCSS icon class for the field type, e.g. 'i-lucide-dollar-sign' */
  icon?: string
  /** Table-defined default; shown as soft highlight when no user pref is set */
  default?: ColViz
}

const VIZ: { id: ColViz; icon: string; label: string }[] = [
  { id: 'essential', icon: 'i-lucide-shield',    label: 'Essential' },
  { id: 'show-sm',  icon: 'i-lucide-smartphone', label: 'All screens' },
  { id: 'show-lg',  icon: 'i-lucide-monitor',    label: 'Large screens' },
  { id: 'hidden',   icon: 'i-lucide-eye-off',    label: 'Hidden' },
]

const props = withDefaults(defineProps<{
  columns: ColDef[]
  states?: Record<string, ColViz>
  order?: string[]
}>(), { states: () => ({}), order: () => [] })

const emit = defineEmits<{
  'set-state': [key: string, state: ColViz | null]
  reorder: [keys: string[]]
  reset: []
  'adjust-widths': []
}>()

const { t } = useNuiI18n()

// ── Viewport tracking ─────────────────────────────────────────────────────────
const vw = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
function onResize() { vw.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

// Which state slot represents the current screen breakpoint (for column bg hint)
// < 1024px → show-sm column is "current"; ≥ 1024px → show-lg column is "current"
const currentScreenViz = computed<ColViz>(() => vw.value >= 1024 ? 'show-lg' : 'show-sm')

// ── Column ordering ───────────────────────────────────────────────────────────
const hasUserPrefs = computed(() => Object.keys(props.states).length > 0)

const orderedColumns = computed(() => {
  if (!props.order.length) return props.columns
  const idx = new Map(props.order.map((k, i) => [k, i]))
  return [...props.columns].sort((a, b) => (idx.get(a.key) ?? 999) - (idx.get(b.key) ?? 999))
})

// ── State helpers ─────────────────────────────────────────────────────────────
const defaultOf = (key: string): ColViz | undefined =>
  props.columns.find(c => c.key === key)?.default

const effectiveState = (key: string): ColViz =>
  props.states[key] ?? defaultOf(key) ?? 'show-lg'

// Column name is grayed when it won't show on the current screen
const isEffectivelyHidden = (key: string): boolean => {
  const s = effectiveState(key)
  if (s === 'hidden')  return true
  if (s === 'show-lg') return vw.value < 1024
  return false
}

// 'user' = explicit override | 'default' = matches table default | 'off' = neither
const btnLevel = (key: string, state: ColViz): 'user' | 'default' | 'off' => {
  const u = props.states[key]
  if (u === state) return 'user'
  if (!u && defaultOf(key) === state) return 'default'
  return 'off'
}

// Button background: user → solid accent; current screen → subtle bg; else hover only
const btnBg = (key: string, state: ColViz): string => {
  if (btnLevel(key, state) === 'user') return 'bg-nui-accent'
  if (state === currentScreenViz.value) return 'bg-nui-bg-accent'
  return 'hover:bg-nui-bg-accent'
}

// Icon color: user → white (on solid bg); default → soft accent; off → gray
const iconColor = (key: string, state: ColViz): string => {
  const l = btnLevel(key, state)
  if (l === 'user')    return 'text-white'
  if (l === 'default') return 'text-nui-accent opacity-50'
  return 'text-nui-subtle opacity-30'
}

function toggle(key: string, state: ColViz): void {
  emit('set-state', key, props.states[key] === state ? null : state)
}

// ── Drag & drop ───────────────────────────────────────────────────────────────
const dragKey     = ref<string | null>(null)
const dragOverKey = ref<string | null>(null)

function onDragStart(key: string): void { dragKey.value = key }
function onDragOver(key: string): void  { dragOverKey.value = key }
function onDragEnd(): void              { dragKey.value = null; dragOverKey.value = null }
function onDrop(targetKey: string): void {
  const from = dragKey.value
  if (!from || from === targetKey) { onDragEnd(); return }
  const keys = orderedColumns.value.map(c => c.key)
  const fi = keys.indexOf(from)
  const ti = keys.indexOf(targetKey)
  keys.splice(fi, 1)
  keys.splice(ti, 0, from)
  emit('reorder', keys)
  onDragEnd()
}
</script>

<template>
  <Popover
    align="start"
    :label="hasUserPrefs ? t('nui.columns.titleCustom', 'Columns (custom)') : t('nui.columns.title', 'Columns')"
    trigger-class="nui-btn text-nui-accent-fg hover:bg-white/10"
    active-class="bg-white/15"
  >
    <span class="i-lucide-columns-3 size-3.5" aria-hidden="true" />

    <template #content="{ close }">
      <div class="w-80 max-w-[calc(100vw-2rem)] py-1">

        <!-- Header -->
        <div class="flex items-center justify-between px-3 py-1.5 border-b border-nui-border">
          <span class="text-xs font-medium uppercase tracking-wide text-nui-muted">
            {{ t('nui.columns.title', 'Columns') }}
          </span>
          <button v-if="hasUserPrefs" type="button" class="nui-btn-ghost" @click="emit('reset'); close()">
            {{ t('nui.reset', 'Reset') }}
          </button>
        </div>

        <!-- Column rows -->
        <ul class="py-1 max-h-[min(480px,70vh)] overflow-y-auto" role="listbox">
          <li
            v-for="col in orderedColumns"
            :key="col.key"
            class="flex items-center gap-1.5 px-2 py-0.5 select-none"
            :class="dragOverKey === col.key && dragKey !== col.key
              ? 'border-t-2 border-nui-accent'
              : 'border-t-2 border-transparent'"
            draggable="true"
            @dragstart="onDragStart(col.key)"
            @dragover.prevent="onDragOver(col.key)"
            @drop.prevent="onDrop(col.key)"
            @dragend="onDragEnd"
          >
            <!-- Drag handle -->
            <span class="i-lucide-grip-vertical size-3.5 text-nui-subtle cursor-grab shrink-0" aria-hidden="true" />

            <!-- Field type icon -->
            <span :class="[col.icon ?? 'i-lucide-minus', 'size-3.5 shrink-0', isEffectivelyHidden(col.key) ? 'text-nui-subtle opacity-30' : 'text-nui-muted']" aria-hidden="true" />

            <!-- Label — left-aligned, grayed when hidden on current screen -->
            <span
              class="flex-1 text-left text-sm truncate transition-colors"
              :class="isEffectivelyHidden(col.key) ? 'text-nui-subtle' : 'text-nui-fg'"
            >{{ col.label }}</span>

            <!-- 4-state visibility buttons -->
            <div class="flex items-center gap-0.5 shrink-0">
              <button
                v-for="opt in VIZ"
                :key="opt.id"
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded transition-colors"
                :class="btnBg(col.key, opt.id)"
                :title="opt.label"
                @click.stop="toggle(col.key, opt.id)"
              >
                <span
                  :class="[opt.icon, 'size-3 block', iconColor(col.key, opt.id)]"
                  aria-hidden="true"
                />
              </button>
            </div>
          </li>
        </ul>

        <!-- Legend -->
        <div class="flex items-center gap-3 flex-wrap px-3 pt-1.5 pb-1 border-t border-nui-border">
          <span v-for="opt in VIZ" :key="opt.id" class="flex items-center gap-1 text-[10px] text-nui-muted whitespace-nowrap">
            <span :class="[opt.icon, 'size-3', opt.id === currentScreenViz ? 'text-nui-accent' : 'text-nui-muted opacity-50']" aria-hidden="true" />{{ opt.label }}
          </span>
        </div>

        <!-- Adjust widths — enters the table's drag-to-resize mode -->
        <div class="px-2 py-1.5 border-t border-nui-border">
          <button type="button" class="nui-btn-ghost w-full justify-center gap-1.5 text-nui-accent" @click="emit('adjust-widths'); close()">
            <span class="i-lucide-move-horizontal size-3.5" aria-hidden="true" />{{ t('nui.resize.adjust', 'Adjust widths') }}
          </button>
        </div>
      </div>
    </template>
  </Popover>
</template>
