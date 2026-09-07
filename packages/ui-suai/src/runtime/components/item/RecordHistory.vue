<script setup lang="ts">
// Item family — the change-history "what / who / when" timeline (Item Release P4). A collapsed
// panel at the bottom of a record detail: newest version first, each row an actor + relative time
// with an expandable list of field changes (labelled, formatted, masking-aware — all resolved
// upstream by `historyRows` from @noy-db/ui). Lazy: the host fetches versions on first expand
// (the `expand` event), so an unopened panel costs nothing.
import { ref, computed, watch } from 'vue'
import type { HistoryRow } from '@noy-db/ui'
import { useNuiI18n } from '../../core/i18n'

const { t } = useNuiI18n()

const props = withDefaults(defineProps<{
  /** Display rows from `historyRows()` — newest first. */
  rows?: HistoryRow[]
  /** Version count for the collapsed header (before the rows are fetched). */
  count?: number
  loading?: boolean
}>(), { rows: () => [], loading: false })

const emit = defineEmits<{ expand: [] }>()

const open = ref(false)
const requested = ref(false)
// Per-version expansion of the change list; the current (top) row starts open.
const expanded = ref<Set<number>>(new Set())

const badge = computed(() => props.count ?? (props.rows.length || undefined))

function toggle(): void {
  open.value = !open.value
  if (open.value && !requested.value) {
    requested.value = true
    emit('expand')
  }
}

// Keep the newest version's change list open — on first load and after each edit adds a version.
watch(() => props.rows[0]?.version, (v) => {
  if (v !== undefined) expanded.value = new Set([...expanded.value, v])
})
function toggleRow(v: number): void {
  const next = new Set(expanded.value)
  next.has(v) ? next.delete(v) : next.add(v)
  expanded.value = next
}
function headline(row: HistoryRow): string {
  // "Created" wins for the origin version (a pristine record is both current AND genesis).
  if (row.genesis) return t('nui.history.created', 'Created')
  if (row.isCurrent) return t('nui.history.current', 'Current version')
  return t('nui.history.version', `Version ${row.version}`).replace('{v}', String(row.version))
}
// The archived timestamp as a fixed, locale-neutral `YYYY-MM-DD HH:MM` — shown in full next to the
// relative time (which stays for at-a-glance), so "2 days ago" also carries its exact moment.
function fullStamp(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <section class="nui-panel nui-card nui-history">
    <button
      type="button"
      class="w-full flex items-center gap-2 text-left"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="i-lucide-history size-4 text-nui-muted" aria-hidden="true" />
      <span class="text-xs font-medium uppercase tracking-wide text-nui-muted">{{ t('nui.history.title', 'History') }}</span>
      <span v-if="badge" class="text-[10px] text-nui-subtle tabular-nums">{{ badge }}</span>
      <span
        class="i-lucide-chevron-down size-4 text-nui-subtle ml-auto transition-transform"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      />
    </button>

    <div v-if="open" class="mt-3">
      <div v-if="loading" class="space-y-2" aria-busy="true">
        <div v-for="n in 3" :key="n" class="h-4 rounded bg-nui-bg-accent animate-pulse" :style="{ width: `${70 - n * 12}%` }" />
      </div>
      <p v-else-if="!rows.length" class="text-sm text-nui-subtle">{{ t('nui.history.empty', 'No history yet.') }}</p>

      <ol v-else class="nui-timeline space-y-3">
        <li v-for="row in rows" :key="row.version" class="relative pl-5">
          <span
            class="nui-dot absolute left-0 top-1.5 size-2 rounded-full"
            :class="row.isCurrent ? 'bg-nui-accent' : 'bg-nui-border'"
            aria-hidden="true"
          />
          <div class="flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
            <span class="text-sm font-medium text-nui-fg">{{ headline(row) }}</span>
            <span v-if="row.actor" class="text-xs text-nui-muted">{{ row.actor }}</span>
            <time v-if="row.relative" :datetime="row.iso" class="text-xs text-nui-subtle tabular-nums">{{ row.relative }}</time>
            <span v-if="fullStamp(row.iso)" class="text-xs text-nui-subtle tabular-nums">· {{ fullStamp(row.iso) }}</span>
            <button
              v-if="row.changes.length"
              type="button"
              class="text-xs text-nui-muted hover:text-nui-fg ml-auto"
              :aria-expanded="expanded.has(row.version)"
              @click="toggleRow(row.version)"
            >
              {{ t('nui.history.changed', `${row.changes.length} changed`).replace('{n}', String(row.changes.length)) }}
            </button>
          </div>

          <dl v-if="expanded.has(row.version) && row.changes.length" class="mt-1.5 space-y-1">
            <div v-for="c in row.changes" :key="c.path" class="flex items-baseline gap-2 text-sm min-w-0">
              <dt class="text-xs text-nui-muted shrink-0">{{ c.fieldLabel }}</dt>
              <dd class="min-w-0 flex items-baseline gap-1.5 flex-wrap">
                <span v-if="c.type === 'added'" class="text-nui-fg">{{ c.to }}</span>
                <span v-else-if="c.type === 'removed'" class="text-nui-danger line-through">{{ c.from }}</span>
                <template v-else>
                  <span class="text-nui-subtle line-through">{{ c.from ?? '—' }}</span>
                  <span class="i-lucide-arrow-right size-3 text-nui-subtle shrink-0" aria-hidden="true" />
                  <span class="text-nui-fg">{{ c.to ?? '—' }}</span>
                </template>
              </dd>
            </div>
          </dl>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.nui-card { padding: var(--nui-card-px, 1rem); }
/* the vertical rail connecting the dots */
.nui-timeline > li:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 1.25rem;
  bottom: -0.75rem;
  width: 1px;
  background: var(--nui-border);
}
</style>
