<script lang="ts">
/** A user width override from "Adjust widths": a proportional `pct` (0..1) or a `fixed` px width. */
export interface WidthOverride { mode: 'pct' | 'fixed'; value: number }
</script>

<script setup lang="ts" generic="T extends Record<string, any>">
// The collection list table: a lean styled <table> driven by columns + rows + cell slots, with a
// sticky accent header, an optional sticky subtotal/aggregate row, responsive column dropping +
// xs-stacking, and collapse-aware grouped rendering. Nuxt-UI-free (UnoCSS + --nui tokens + the
// hand-rolled Popover-based header filters).
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import type { AppColumn, SubtotalEnum } from '@noy-db/ui'
import type { ColumnFilterValue, EntityFacets, Facet, FilterChip } from '@noy-db/ui'
import type { SortKey } from '@noy-db/ui'
import type { DisplayLine } from '@noy-db/ui'
import { columnAggregate } from '@noy-db/ui'
import { selectColumns, distributeWidths, shouldStack, applyStacking, type SizedColumn } from '@noy-db/ui'
import { vEllipsisTitle } from '../internal/ellipsis-title'
import FilterChips from '../internal/FilterChips.vue'
import ColumnHeader from '../internal/ColumnHeader.vue'
import HeaderFilterCell from '../internal/HeaderFilterCell.vue'
import { useNuiI18n } from '../core/i18n'

const { t } = useNuiI18n()
const props = withDefaults(defineProps<{
  columns: AppColumn[]
  rows: T[]
  rowKey?: (row: T) => string
  sortKey?: string | null
  sortDir?: 'asc' | 'desc' | null
  /** Full multi-sort list (priority order) — drives numbered header badges. */
  sortKeys?: SortKey[]
  /** Sort is "locked"/multi → show position numbers on sorted columns. */
  sortLocked?: boolean
  // interactive headers (all optional — omit for a plain sortable table)
  filters?: Record<string, ColumnFilterValue>
  enumFacets?: Record<string, Facet[]>
  entityFacets?: Record<string, EntityFacets>
  chips?: FilterChip[]
  /** Leading serial-index column (display index 1..N of the visible rows). On by default. */
  serialIndex?: boolean
  /** When set, rows are rendered grouped: a flattened, collapse-aware list of banner + row lines. */
  groupLines?: DisplayLine<T>[]
  /** Per-column enum breakdowns shown in the second-header row (keyed by column key). */
  subtotalEnums?: Record<string, SubtotalEnum>
  /** Plural noun for the visible-row count shown in the second header ("sales"). */
  rowNoun?: string
  /** Cap on how many (ungrouped) rows are rendered; aggregates still use ALL rows. Default: all. */
  displayLimit?: number
  /** Column keys hidden because they are the active group-by field(s) — their value shows in the
   *  group banner instead, so the dedicated column would be redundant. */
  groupedKeys?: string[]
  /** Grouped + every main group collapsed → the header arrow shows "expand", else "collapse all". */
  allCollapsed?: boolean
  /** Column keys to force-visible regardless of width: search-driven "focus" columns + show: tokens (R4/R5). */
  focusKeys?: string[]
  /** Column keys to force-hidden via hide: tokens (R5) — removed even if core (force-show wins). */
  hideKeys?: string[]
  /** "Adjust widths" mode (v-model:resizing) — drag column edges to resize. Entered from the column
   *  chooser dialog (its "Adjust widths" action), exited via the in-table Done button. */
  resizing?: boolean
  /** User width overrides (v-model:widths) — per column: a proportional `pct` or a `fixed` px width. */
  widths?: Record<string, WidthOverride>
  /** A row key to scroll into view + flash-highlight once (e.g. returning from a detail's back()). */
  anchorKey?: string
  /** Bulk selection (P-E): show a leading checkbox column. Host owns the selection set. */
  selectable?: boolean
  /** Selected row keys (rowKey/id) when `selectable`. */
  selectedKeys?: readonly string[]
}>(), { serialIndex: true, rowNoun: 'rows' })

// Measure the table container so responsive resolution can drop low-relevance columns as it narrows.
const wrapperEl = ref<HTMLElement | null>(null)
const containerWidth = ref(Infinity)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (wrapperEl.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => { containerWidth.value = entries[0]!.contentRect.width })
    ro.observe(wrapperEl.value)
  }
})
onBeforeUnmount(() => { ro?.disconnect(); if (anchorTimer) clearTimeout(anchorTimer) })

const showSerial = () => props.serialIndex

// Fixed px reserved for the serial/index column in the width budget + its <col>.
const SERIAL_W = 34
// Once the container is measured, the table is sized to fit it exactly (table-layout: fixed +
// colgroup). Before measurement (Infinity) we fall back to natural auto layout — no flash, no widths.
const measured = computed(() => Number.isFinite(containerWidth.value) && containerWidth.value > 0)

// Column-resize state (overrides declared early so the layout's sizedOf can read them).
const overrides = ref<Record<string, WidthOverride>>({ ...(props.widths ?? {}) })

// Density ladder: as the container narrows we REDUCE first (cell padding, header type-icons) before
// REMOVING columns. `trim` is the per-column width the tighter horizontal padding gives back — fed
// to the engine so a tighter table fits MORE columns (reduce-first, remove-later). px/py/hpy drive
// the cell padding via CSS vars. trim == 2·(12 − px) so the engine and the CSS agree.
// Size tiers — sm/md/lg (industry-standard codes; user-facing: Compact/Medium/Expanded). Exposed as
// `data-nui-size` on the table for debug + QC.
function densityFor(w: number): { px: number; py: number; hpy: number; trim: number; dense: boolean; tier: 'sm' | 'md' | 'lg' } {
  if (w < 448) return { px: 5, py: 4, hpy: 6, trim: 10, dense: true, tier: 'sm' }   // Compact
  if (w < 640) return { px: 7, py: 6, hpy: 8, trim: 6, dense: false, tier: 'md' }   // Medium
  return { px: 10, py: 8, hpy: 10, trim: 0, dense: false, tier: 'lg' }              // Expanded
}
const density = computed(() => densityFor(containerWidth.value))

// Project an AppColumn onto the width engine's numeric view. Defaults: text-ish columns flex,
// right-aligned (numeric) columns are rigid; min falls back to a generic 80 when unspecified.
// The current density `trim` shrinks each auto min (pinned widths are untouched).
const sizedOf = (c: AppColumn, trim = 0): SizedColumn => {
  // A user width override (from "Adjust widths") wins over the column's declared fixedPx/pct.
  const ov = overrides.value[c.key]
  const fixedPx = ov?.mode === 'fixed' ? ov.value : c.fixedPx
  const pct = ov?.mode === 'pct' ? ov.value : c.pct
  const min = Math.max((c.minWidth ?? 80) - trim, 32)
  return {
    key: c.key,
    ...(c.relevance !== undefined ? { relevance: c.relevance } : {}),
    min,
    ideal: Math.max((c.idealWidth ?? c.minWidth ?? 80) - trim, min),
    flex: c.flex ?? (c.align === 'right' ? 0 : 1),
    ...(fixedPx !== undefined ? { fixedPx } : {}),
    ...(pct !== undefined ? { pct } : {}),
  }
}

const layout = computed<{ columns: AppColumn[]; folds: Record<string, string>; widths: Record<string, number> }>(() => {
  const afterGroup = props.groupedKeys && props.groupedKeys.length
    ? props.columns.filter((c) => !props.groupedKeys!.includes(c.key))
    : props.columns
  const forceShow = new Set(props.focusKeys ?? [])
  const hidden = new Set(props.hideKeys ?? [])
  const afterHide = hidden.size ? afterGroup.filter((c) => !hidden.has(c.key)) : afterGroup
  const serial = showSerial() ? SERIAL_W : 0
  const trim = density.value.trim

  // 1. Drop the lowest-relevance columns until the survivors' (density-trimmed) min widths fit.
  const survivors = new Set(selectColumns(afterHide.map((c) => sizedOf(c, trim)), containerWidth.value, { serial, force: forceShow }))
  const kept = afterHide.filter((c) => survivors.has(c.key))
  // 2. At xs, fold a secondary column onto a 2nd line of its host (frees its width).
  const stacked = applyStacking(kept, shouldStack(containerWidth.value), hidden, forceShow)
  // 3. Size the final standalone columns so they fill the container exactly.
  const widths = measured.value
    ? distributeWidths(stacked.columns.map((c) => sizedOf(c, trim)), containerWidth.value, { serial })
    : {}
  return { columns: stacked.columns, folds: stacked.folds, widths }
})
const visibleColumns = (): AppColumn[] => layout.value.columns
const colWidth = (key: string): number | undefined => layout.value.widths[key]
const foldedColOf = (col: AppColumn): AppColumn | null => {
  const key = layout.value.folds[col.key]
  return key ? props.columns.find((c) => c.key === key) ?? null : null
}
const selCol = () => (props.selectable ? 1 : 0)
const bodyColspan = () => visibleColumns().length + (props.serialIndex ? 1 : 0) + selCol()

// Bulk selection (P-E): the host owns the selection set; this component reflects it + emits toggles.
const keyOf = (r: T): string => (props.rowKey ? props.rowKey(r) : (r.id as string))
const selectedSet = computed(() => new Set(props.selectedKeys ?? []))
const dataRowKeys = (): string[] =>
  isGrouped()
    ? (props.groupLines ?? []).filter((l) => l.kind !== 'group').map((l) => keyOf((l as { row: T }).row))
    : props.rows.map(keyOf)
const allSelected = computed(() => { const ks = dataRowKeys(); return ks.length > 0 && ks.every((k) => selectedSet.value.has(k)) })
const someSelected = computed(() => !allSelected.value && dataRowKeys().some((k) => selectedSet.value.has(k)))

// Group banners normally show a per-column rollup, with the group value in the (narrow) first cell.
// When the table is narrow, that first cell clips "Genre: Rock" to an unreadable sliver — so there
// we render the banner as one full-width cell, keeping the group value legible. Rollups add little
// when only a column or two survive anyway.
const bannerFull = () => density.value.tier === 'sm' || visibleColumns().length <= 3

// Otherwise the group label spans the leading IDENTITY columns (those with no explicit aggregate —
// cover, title, …) so it gets real width instead of being crammed into a thumbnail/serial column
// and clipped to a glyph. Columns that carry an aggregate keep their per-column rollup. At least 1.
const bannerLeadCols = () => {
  const cols = visibleColumns()
  let n = 0
  while (n < cols.length && !cols[n]!.aggregate) n++
  return Math.max(1, n)
}
const bannerRollupCols = () => visibleColumns().slice(bannerLeadCols())

const emit = defineEmits<{
  sort: [payload: { key: string; additive?: boolean }]
  lockSort: [payload: { key: string }]
  rowClick: [row: T]
  filterChange: [payload: { key: string; value: ColumnFilterValue | null }]
  removeFilter: [key: string]
  clearFilters: []
  toggleGroup: [id: string]
  toggleCollapseAll: []
  'update:widths': [widths: Record<string, WidthOverride>]
  'update:resizing': [on: boolean]
  toggleSelect: [key: string]
  toggleSelectAll: []
}>()

// Resize mode is host-controlled (v-model:resizing) — entered from the column chooser, exited via Done.
const resizeMode = computed({ get: () => props.resizing ?? false, set: (v) => emit('update:resizing', v) })

// ── Column resize ("Adjust widths" mode) — state declared above; handlers below ────────────────────
watch(() => props.widths, (w) => { overrides.value = { ...(w ?? {}) } })
function setOverride(key: string, ov: WidthOverride | null): void {
  const next = { ...overrides.value }
  if (ov) next[key] = ov; else delete next[key]
  overrides.value = next
  emit('update:widths', next)
}
function resetWidths(): void { overrides.value = {}; emit('update:widths', {}) }

// Anchor a row (e.g. returning from a detail's back()): scroll it into view + flash it once.
let anchorTimer: ReturnType<typeof setTimeout> | null = null
watch(() => props.anchorKey, async (key) => {
  if (!key || key.includes('"')) return
  await nextTick()
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(key) : key
  const row = wrapperEl.value?.querySelector(`[data-row-key="${escaped}"]`)
  if (!row) return
  row.scrollIntoView({ block: 'center' })
  row.classList.add('nui-row-anchored')
  if (anchorTimer) clearTimeout(anchorTimer)
  anchorTimer = setTimeout(() => row.classList.remove('nui-row-anchored'), 1600)
})

/** Pixel bounds for a column drag: never below its min, never so wide the table can't fit. */
function resizeBounds(key: string): { min: number; max: number } {
  const trim = density.value.trim
  const cols = visibleColumns()
  const me = cols.find((c) => c.key === key)
  const myMin = Math.max((me?.minWidth ?? 80) - trim, 32)
  const serial = showSerial() ? SERIAL_W : 0
  let otherMin = 0
  for (const c of cols) {
    if (c.key === key) continue
    const ov = overrides.value[c.key]
    otherMin += ov?.mode === 'fixed' ? ov.value : Math.max((c.minWidth ?? 80) - trim, 32)
  }
  return { min: myMin, max: Math.max(myMin, containerWidth.value - serial - otherMin) }
}

let dragging: { key: string; startX: number; startW: number; mode: 'pct' | 'fixed' } | null = null
function onHandleDown(e: PointerEvent, key: string): void {
  if (!resizeMode.value) return
  e.preventDefault(); e.stopPropagation()
  const startW = colWidth(key) ?? 0
  const mode = overrides.value[key]?.mode ?? 'pct' // drag is proportional unless the column is locked
  dragging = { key, startX: e.clientX, startW, mode }
  window.addEventListener('pointermove', onHandleMove)
  window.addEventListener('pointerup', onHandleUp)
}
function onHandleMove(e: PointerEvent): void {
  if (!dragging) return
  const { key, startX, startW, mode } = dragging
  const { min, max } = resizeBounds(key)
  const w = Math.min(Math.max(startW + (e.clientX - startX), min), max)
  setOverride(key, { mode, value: mode === 'fixed' ? Math.round(w) : w / containerWidth.value })
}
function onHandleUp(): void {
  dragging = null
  window.removeEventListener('pointermove', onHandleMove)
  window.removeEventListener('pointerup', onHandleUp)
}
/** Click the badge / double-click the handle → toggle fixed-px ⇄ proportional for this column. */
function toggleFixed(key: string): void {
  const w = colWidth(key) ?? 0
  const cur = overrides.value[key]
  if (cur?.mode === 'fixed') setOverride(key, { mode: 'pct', value: w / containerWidth.value })
  else setOverride(key, { mode: 'fixed', value: Math.round(w) })
}
function badgeText(key: string): string {
  const ov = overrides.value[key]
  if (ov?.mode === 'fixed') return `🔒${ov.value}px`
  const w = colWidth(key) ?? 0
  const pct = containerWidth.value > 0 ? Math.round((w / containerWidth.value) * 100) : 0
  return `${pct}%`
}

// Keyboard resize: a focused handle nudges its column with the arrow keys (Shift = bigger step,
// Home = release the override). Keeps the same mode (proportional unless the column is locked).
function onHandleKey(e: KeyboardEvent, key: string): void {
  if (e.key === 'Home') { setOverride(key, null); e.preventDefault(); return }
  const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (!dir) return
  e.preventDefault()
  const { min, max } = resizeBounds(key)
  const w = Math.min(Math.max((colWidth(key) ?? 0) + dir * (e.shiftKey ? 24 : 8), min), max)
  const mode = overrides.value[key]?.mode ?? 'pct'
  setOverride(key, { mode, value: mode === 'fixed' ? Math.round(w) : w / containerWidth.value })
}

// Auto-fit: size a column (as a fixed width) to its widest displayed content. Double-clicking the
// handle is the standard gesture; lossless ellipsized text still reports its full width via canvas.
let fitCanvas: CanvasRenderingContext2D | null = null
function autoFit(key: string): void {
  const wrap = wrapperEl.value
  if (!wrap || typeof document === 'undefined') return
  const idx = visibleColumns().findIndex((c) => c.key === key)
  if (idx < 0) return
  const nth = idx + (showSerial() ? 2 : 1) // 1-based, after the serial column
  fitCanvas ??= document.createElement('canvas').getContext('2d')
  if (!fitCanvas) return
  const measure = (el: Element | null): number => {
    if (!el) return 0
    const cs = getComputedStyle(el)
    fitCanvas!.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    return fitCanvas!.measureText((el.textContent ?? '').trim()).width
  }
  const head = wrap.querySelector(`thead tr:first-child th:nth-child(${nth})`)
  let widest = measure(head) + 30 // header carries an icon + sort affordance
  for (const cell of Array.from(wrap.querySelectorAll(`tbody tr td:nth-child(${nth})`))) widest = Math.max(widest, measure(cell))
  const { min, max } = resizeBounds(key)
  const w = Math.min(Math.max(widest + density.value.px * 2 + 4, min), max)
  setOverride(key, { mode: 'fixed', value: Math.round(w) })
}

const isGrouped = () => !!(props.groupLines && props.groupLines.length)
const indentStyle = (level: number) => (level > 0 ? { paddingInlineStart: `${0.75 + level * 1.25}rem` } : undefined)

const agg = (col: AppColumn) => columnAggregate(props.rows, col)
const foldedAgg = (col: AppColumn) => { const f = foldedColOf(col); return f ? columnAggregate(props.rows, f) : null }
// Align the subtotal cell with the column's data (same rule as the body/header cells), so a count
// like "9 artists" under a left-aligned text column stays left — not forced right by its numeric-ness.
const aggAlign = (col: AppColumn): string => (col.align === 'right' ? 'text-right' : 'text-left')
const hasSubtotalRow = () =>
  props.rows.length > 0 && (props.columns.some((c) => c.aggregate) || !!props.subtotalEnums)
// Rollup cells align with their column's DATA, so the summary sits under the values it counts — a
// right-aligned number column gets a right-aligned rollup, a left-aligned text/entity column a
// left-aligned one (a count floating at the far right of a left column reads as disconnected).
const groupCellAlign = (col: AppColumn): string => (col.align === 'right' ? 'text-right' : 'text-left')

// Second-header summary when grouped: every grouped field, in nesting order, with how many groups it
// makes at its level — e.g. "Label · 5 › Artist · 12". The field names live here, not on every banner.
const groupSummary = computed(() => {
  if (!props.groupLines || !props.groupLines.length || !props.groupedKeys) return null
  return props.groupedKeys.map((key, level) => {
    const col = props.columns.find((c) => c.key === key)
    const count = props.groupLines!.filter((l) => l.kind === 'group' && l.level === level).length
    return { label: col?.label ?? key, count }
  })
})
</script>

<template>
  <FilterChips
    v-if="chips && chips.length"
    :chips="chips"
    @remove="emit('removeFilter', $event)"
    @clear-all="emit('clearFilters')"
  />
  <!-- Adjust-widths control bar (only while in resize mode; entered from the column chooser) -->
  <div v-if="resizeMode" class="flex items-center justify-end gap-2 px-1 pb-1">
    <span class="text-[11px] text-nui-muted me-auto">{{ t('nui.resize.hint', 'Drag an edge to resize (← → when focused) · double-click to auto-fit · click a badge to lock px') }}</span>
    <button type="button" class="nui-btn-ghost" @click="resetWidths">{{ t('nui.reset', 'Reset') }}</button>
    <button type="button" class="nui-btn-soft" @click="resizeMode = false">{{ t('nui.resize.done', 'Done') }}</button>
  </div>
  <div
    ref="wrapperEl"
    class="nui-table-wrap @container sm:rounded-lg sm:ring sm:ring-nui-border bg-nui-bg"
    :class="{ 'nui-dense': density.dense }"
    :data-nui-size="density.tier"
    :style="{ '--nui-cell-px': density.px + 'px', '--nui-cell-py': density.py + 'px', '--nui-head-py': density.hpy + 'px' }"
  >
    <table class="w-full text-sm border-collapse" :class="measured ? 'table-fixed' : ''">
      <colgroup v-if="measured">
        <col v-if="showSerial()" :style="{ width: SERIAL_W + 'px' }">
        <col v-for="col in visibleColumns()" :key="col.key" :style="{ width: (colWidth(col.key) ?? 0) + 'px' }">
      </colgroup>
      <thead
        class="sticky z-10 text-nui-accent-fg text-sm sm:rounded-t-lg"
        style="top: 0; background: var(--nui-thead-bg, var(--nui-accent)); backdrop-filter: blur(var(--nui-thead-blur, 0px)); -webkit-backdrop-filter: blur(var(--nui-thead-blur, 0px));"
      >
        <tr>
          <th v-if="selectable" class="px-1.5 py-1.5 font-normal text-center w-px">
            <input
              type="checkbox"
              class="align-middle cursor-pointer"
              :checked="allSelected"
              :indeterminate.prop="someSelected"
              :aria-label="t('nui.list.selectAll', 'Select all')"
              @change="emit('toggleSelectAll')"
            >
          </th>
          <th v-if="showSerial()" class="px-1.5 py-1.5 font-normal text-center w-px" :aria-label="t('nui.list.rowNumber', 'Row number')">
            <slot name="serial-header">#</slot>
          </th>
          <th
            v-for="col in visibleColumns()"
            :key="col.key"
            class="px-3 py-2.5 font-normal"
            :class="[col.align === 'right' ? 'text-right' : 'text-left', col.class, { 'relative': resizeMode }]"
            :aria-sort="sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : (col.sortable || col.filter === 'date' ? 'none' : undefined)"
          >
            <span :style="resizeMode ? { pointerEvents: 'none' } : undefined">
              <ColumnHeader
                :column="col"
                :sort-keys="sortKeys"
                :sort-key="sortKey"
                :sort-dir="sortDir"
                :numbered="sortLocked || (sortKeys?.length ?? 0) > 1"
                :sub-label="foldedColOf(col)?.label"
                @sort="emit('sort', $event)"
                @lock-sort="emit('lockSort', $event)"
              />
            </span>
            <!-- Resize affordances: a width badge (click = lock/unlock fixed) + a drag handle. -->
            <template v-if="resizeMode">
              <button
                type="button"
                class="nui-resize-badge"
                :class="{ 'is-fixed': overrides[col.key]?.mode === 'fixed' }"
                :title="t('nui.resize.lockHint', 'Click to lock/unlock a fixed pixel width')"
                @click.stop="toggleFixed(col.key)"
              >{{ badgeText(col.key) }}</button>
              <span
                class="nui-resize-handle"
                role="separator"
                tabindex="0"
                aria-orientation="vertical"
                :aria-valuenow="Math.round(colWidth(col.key) ?? 0)"
                :aria-label="`${t('nui.resize.handle', 'Resize')} ${col.label}`"
                @pointerdown="onHandleDown($event, col.key)"
                @dblclick.stop="autoFit(col.key)"
                @keydown="onHandleKey($event, col.key)"
              />
            </template>
          </th>
        </tr>
        <tr v-if="hasSubtotalRow()" class="subtotal-row">
          <td v-if="selectable" class="px-3 py-1.5 w-px" />
          <td v-if="showSerial()" class="px-3 py-1.5 w-px text-center">
            <button
              v-if="isGrouped()"
              type="button"
              class="inline-flex items-center justify-center hover:opacity-70 align-middle text-nui-muted"
              :aria-label="allCollapsed ? t('nui.list.expandGroups', 'Expand all groups') : t('nui.list.collapseGroups', 'Collapse all groups')"
              :title="allCollapsed ? t('nui.list.expandGroups', 'Expand all groups') : t('nui.list.collapseGroups', 'Collapse all groups')"
              @click="emit('toggleCollapseAll')"
            >
              <span class="size-4" :class="allCollapsed ? 'i-lucide-chevrons-up-down' : 'i-lucide-chevrons-down-up'" aria-hidden="true" />
            </button>
          </td>
          <!-- Grouped: a leading cell names the grouped field + group total ("Artist · 9"), then the
               remaining columns keep just their filter funnels (per-column aggregates are redundant with
               the group banners). Mirrors the banner's leading-span so nothing crushes the cover. -->
          <template v-if="isGrouped()">
            <td :colspan="bannerLeadCols()" class="px-3 py-1.5 align-middle text-left">
              <span v-if="groupSummary" class="text-xs whitespace-nowrap inline-flex items-center gap-1.5">
                <template v-for="(g, i) in groupSummary" :key="i">
                  <span v-if="i" class="text-nui-subtle" aria-hidden="true">›</span>
                  <span><span class="font-semibold text-nui-fg">{{ g.label }}</span><span class="text-nui-muted"> · {{ g.count }}</span></span>
                </template>
              </span>
            </td>
            <td
              v-for="col in bannerRollupCols()"
              :key="col.key"
              class="px-3 py-1.5 align-middle"
              :class="[aggAlign(col), col.class]"
            >
              <span v-if="col.filter" class="inline-flex" :class="aggAlign(col) === 'text-right' ? 'float-right' : ''">
                <HeaderFilterCell
                  :column="col"
                  :filter="filters?.[col.key]"
                  :enum-facets="enumFacets?.[col.key]"
                  :entity-facets="entityFacets?.[col.key]"
                  @filter-change="emit('filterChange', $event)"
                />
              </span>
            </td>
          </template>
          <td
            v-for="col in (isGrouped() ? [] : visibleColumns())"
            :key="col.key"
            class="px-3 py-1.5 align-middle"
            :class="[aggAlign(col), col.class]"
          >
            <!-- Total/summary first so it aligns with the column's header + body edge; the filter
                 funnel trails as a small affordance (on the outer side for right-aligned columns). -->
            <div class="inline-flex items-center gap-1 max-w-full min-w-0" :class="aggAlign(col) === 'text-right' ? 'flex-row-reverse' : ''">
              <span v-if="subtotalEnums?.[col.key]" class="text-xs text-nui-muted leading-snug min-w-0 truncate">
                <template v-for="(it, i) in subtotalEnums[col.key]!.items" :key="it.value"><span v-if="i" class="opacity-50"> · </span><span class="whitespace-nowrap"><span class="font-semibold text-nui-fg">{{ it.count }}</span> {{ it.label ?? it.value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) }}</span></template>
              </span>
              <span
                v-else-if="agg(col)"
                class="truncate tabular-nums"
                :class="col.aggregate === 'sum' || col.aggregate === 'count' ? 'text-sm font-semibold' : 'text-xs text-nui-muted'"
                :title="agg(col)!.title"
              >{{ agg(col)!.text }}</span>
              <span v-if="col.filter" class="shrink-0">
                <HeaderFilterCell
                  :column="col"
                  :filter="filters?.[col.key]"
                  :enum-facets="enumFacets?.[col.key]"
                  :entity-facets="entityFacets?.[col.key]"
                  @filter-change="emit('filterChange', $event)"
                />
              </span>
            </div>
            <div v-if="foldedAgg(col)" class="text-[11px] text-nui-muted tabular-nums leading-tight" :class="aggAlign(col)" :title="foldedAgg(col)!.title">{{ foldedAgg(col)!.text }}</div>
          </td>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td :colspan="bodyColspan()" class="px-3 py-6">
            <slot name="empty"><p class="text-center text-nui-muted">{{ t('nui.list.noData', 'No data.') }}</p></slot>
          </td>
        </tr>

        <template v-if="isGrouped()">
          <template v-for="line in groupLines" :key="line.kind === 'group' ? line.id : (rowKey ? rowKey(line.row) : (line.row.id as string))">
            <tr
              v-if="line.kind === 'group'"
              class="group-row cursor-pointer select-none"
              :class="`group-level-${line.level}`"
              @click="emit('toggleGroup', line.id)"
            >
              <td
                v-if="bannerFull()"
                :colspan="bodyColspan()"
                class="px-3 py-2 font-semibold"
                :style="indentStyle(line.level)"
              >
                <span class="flex items-center gap-1.5 min-w-0">
                  <span class="tabular-nums text-nui-muted shrink-0">{{ line.serial }}.</span>
                  <span class="size-3.5 shrink-0 text-nui-muted" :class="line.collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'" aria-hidden="true" />
                  <span class="truncate">{{ line.label }}</span>
                  <span class="tabular-nums text-nui-muted shrink-0 ms-auto ps-2">{{ line.count }}</span>
                </span>
              </td>
              <template v-else>
                <td
                  :colspan="selCol() + (showSerial() ? 1 : 0) + bannerLeadCols()"
                  class="px-3 py-2 font-semibold"
                  :style="indentStyle(line.level)"
                >
                  <span class="flex items-center gap-1.5 min-w-0">
                    <span class="tabular-nums text-nui-muted shrink-0">{{ line.serial }}.</span>
                    <span class="size-3.5 shrink-0 text-nui-muted" :class="line.collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'" aria-hidden="true" />
                    <span v-ellipsis-title class="truncate">{{ line.label }}</span>
                    <span class="tabular-nums text-nui-muted shrink-0 ms-auto ps-2">{{ line.count }}</span>
                  </span>
                </td>
                <td
                  v-for="col in bannerRollupCols()"
                  :key="col.key"
                  class="px-3 py-2 font-normal text-nui-muted whitespace-nowrap"
                  :class="[groupCellAlign(col), groupCellAlign(col) === 'text-right' ? 'tabular-nums' : '', col.class]"
                >
                  {{ line.cells[col.key] ?? '' }}
                  <div v-if="foldedColOf(col) && line.cells[foldedColOf(col)!.key]" class="text-xs font-normal text-nui-muted leading-tight">{{ line.cells[foldedColOf(col)!.key] }}</div>
                </td>
              </template>
            </tr>
            <tr
              v-else
              class="border-t border-nui-border hover:bg-nui-bg-accent transition-colors cursor-pointer"
              :data-row-key="rowKey ? rowKey(line.row) : (line.row.id as string)"
              @click="!resizeMode && emit('rowClick', line.row)"
            >
              <td v-if="selectable" class="px-3 py-2 w-px text-center">
                <input type="checkbox" class="align-middle cursor-pointer" :checked="selectedSet.has(keyOf(line.row))" :aria-label="t('nui.list.selectRow', 'Select row')" @click.stop @change="emit('toggleSelect', keyOf(line.row))">
              </td>
              <td v-if="showSerial()" class="px-3 py-2 text-right tabular-nums text-nui-muted w-px whitespace-nowrap ps-6">{{ line.serial }}</td>
              <td
                v-for="col in visibleColumns()"
                :key="col.key"
                v-ellipsis-title
                class="px-3 py-2 whitespace-nowrap"
                :class="[col.align === 'right' ? 'text-right tabular-nums' : 'text-left', col.class]"
              >
                <slot :name="`cell-${col.key}`" :row="line.row" :width="colWidth(col.key)">{{ line.row[col.key] ?? '' }}</slot>
                <div v-if="foldedColOf(col)" class="text-xs text-nui-muted leading-tight">
                  <slot :name="`cell-${foldedColOf(col)!.key}`" :row="line.row">{{ line.row[foldedColOf(col)!.key] ?? '' }}</slot>
                </div>
              </td>
            </tr>
          </template>
        </template>

        <tr
          v-for="(row, index) in (isGrouped() ? [] : rows.slice(0, displayLimit ?? rows.length))"
          :key="rowKey ? rowKey(row) : (row.id as string)"
          class="nui-row transition-colors cursor-pointer"
          :class="index % 2 === 1 ? 'zebra' : ''"
          :data-row-key="rowKey ? rowKey(row) : (row.id as string)"
          @click="!resizeMode && emit('rowClick', row)"
        >
          <td v-if="selectable" class="px-3 py-2 w-px text-center">
            <input type="checkbox" class="align-middle cursor-pointer" :checked="selectedSet.has(keyOf(row))" :aria-label="t('nui.list.selectRow', 'Select row')" @click.stop @change="emit('toggleSelect', keyOf(row))">
          </td>
          <td v-if="showSerial()" class="px-3 py-2 text-right tabular-nums text-nui-muted w-px whitespace-nowrap">{{ index + 1 }}</td>
          <td
            v-for="col in visibleColumns()"
            :key="col.key"
            v-ellipsis-title
            class="px-3 py-2 whitespace-nowrap"
            :class="[col.align === 'right' ? 'text-right tabular-nums' : 'text-left', col.class]"
          >
            <slot :name="`cell-${col.key}`" :row="row" :width="colWidth(col.key)">{{ row[col.key] ?? '' }}</slot>
            <div v-if="foldedColOf(col)" class="text-xs text-nui-muted leading-tight">
              <slot :name="`cell-${foldedColOf(col)!.key}`" :row="row">{{ row[foldedColOf(col)!.key] ?? '' }}</slot>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <slot name="after" />
  </div>
</template>

<style scoped>
/* The table fills its container and never overflows it (table-layout: fixed + a computed colgroup);
   clip guards against sub-pixel rounding without creating a scrollbar or breaking the sticky head. */
.nui-table-wrap { overflow-x: clip; }
/* Under fixed layout a too-wide cell would otherwise spill into its neighbour — clip the body cells
   and the header-label row (its label truncates, the sort affordance stays). The SUBTOTAL row is
   deliberately NOT clipped: its filter popovers must escape the cell. */
table.table-fixed tbody td,
table.table-fixed thead tr:first-child th { overflow: hidden; text-overflow: ellipsis; }

/* Density ladder (driven by JS density tiers → CSS vars): cell padding shrinks as the table narrows,
   BEFORE columns drop. Horizontal padding tracks the engine's width `trim` so the two stay in sync. */
.nui-table-wrap th,
.nui-table-wrap td { padding-left: var(--nui-cell-px, 0.75rem); padding-right: var(--nui-cell-px, 0.75rem); }
.nui-table-wrap tbody td { padding-top: var(--nui-cell-py, 0.5rem); padding-bottom: var(--nui-cell-py, 0.5rem); }
/* Thumbnail columns use tight, fixed side padding (not the text cell padding) so the cover image fills
   its cell instead of being clipped by it. */
.nui-table-wrap .nui-col-cover { padding-left: 6px; padding-right: 6px; }
.nui-table-wrap thead tr:first-child th { padding-top: var(--nui-head-py, 0.625rem); padding-bottom: var(--nui-head-py, 0.625rem); }
/* Small tiers (sm/md): the table goes full-bleed — drop the ring border + rounded corners so it can
   reach the screen edges as a flat band. The host page cancels its side padding to finish the look. */
.nui-table-wrap[data-nui-size='sm'],
.nui-table-wrap[data-nui-size='md'] { border-radius: 0; box-shadow: none; }

/* Sort affordance: the faint "sortable" chevron stays hidden for a clean header and reveals only when
   the header row is hovered or focused. The active ▲/▼ direction indicator is always shown (separate). */
.nui-table-wrap :deep(.nui-sort-hint) { opacity: 0; transition: opacity 0.12s ease; }
.nui-table-wrap thead:hover :deep(.nui-sort-hint),
.nui-table-wrap thead:focus-within :deep(.nui-sort-hint) { opacity: 0.4; }

/* ── Column resize ("Adjust widths" mode) ─────────────────────────────────── */
.nui-resize-handle {
  position: absolute;
  top: 0;
  right: -4px;
  width: 9px;
  height: 100%;
  cursor: col-resize;
  z-index: 6;
  touch-action: none;
}
.nui-resize-handle::after {
  content: '';
  position: absolute;
  right: 4px;
  top: 12%;
  height: 76%;
  width: 2px;
  background: var(--nui-accent-fg);
  opacity: 0.4;
  border-radius: 1px;
  transition: opacity 0.1s;
}
.nui-resize-handle:hover::after { opacity: 0.9; }
.nui-resize-handle:focus-visible { outline: none; }
.nui-resize-handle:focus-visible::after { opacity: 1; width: 3px; }
.nui-resize-badge {
  position: absolute;
  bottom: 1px;
  right: 9px;
  z-index: 7;
  font-size: 10px;
  line-height: 1.4;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--nui-bg);
  color: var(--nui-muted);
  border: 1px solid var(--nui-border);
  cursor: pointer;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.nui-resize-badge.is-fixed { border-color: var(--nui-accent); color: var(--nui-accent); }
/* Second-header (subtotal) row: reads as a continuation of the header — a vertical gradient from a
   strong accent tint at the top (near the header colour) fading into the body tint below. */
.subtotal-row td {
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--nui-accent) 45%, var(--nui-bg)),
    color-mix(in srgb, var(--nui-accent) 12%, var(--nui-bg))
  );
  color: var(--nui-fg);
}
.zebra {
  background: color-mix(in srgb, var(--nui-accent) 4%, var(--nui-bg));
}
/* Row dividers + hover are accent-tinted (not the neutral --nui-border / --nui-bg-accent), so they
   harmonize with the accent-tinted zebra/subtotal/group rows. A cool-gray hairline or gray hover over
   a warm zebra reads as a smudge (e.g. the crimson "Speed" palette). */
.nui-row td { border-top: 1px solid color-mix(in srgb, var(--nui-accent) 8%, var(--nui-bg)); }
.nui-row:hover td { background: color-mix(in srgb, var(--nui-accent) 11%, var(--nui-bg)); }
/* Group banner rows: distinguished by an accent tint alone (no heavy divider — the row borders match
   the normal list), deeper levels tint lighter. */
.group-row td {
  background: color-mix(in srgb, var(--nui-accent) 14%, var(--nui-bg));
}
.group-row.group-level-1 td {
  background: color-mix(in srgb, var(--nui-accent) 9%, var(--nui-bg));
}
.group-row.group-level-2 td {
  background: color-mix(in srgb, var(--nui-accent) 6%, var(--nui-bg));
}
thead th:first-child { border-top-left-radius: 0.5rem; }
thead th:last-child { border-top-right-radius: 0.5rem; }

/* Anchored row (returning from a detail's back()): scroll target flashes once, then settles. */
.nui-row-anchored td { animation: nui-anchor-flash 1.6s ease-out; }
@keyframes nui-anchor-flash {
  0%, 35% { background-color: color-mix(in oklab, var(--nui-accent) 18%, transparent); }
  100% { background-color: transparent; }
}
</style>
