<script setup lang="ts">
// Pills-in-the-box search. Renders the committed query as removable pills plus a trailing text
// input with autocomplete. Two-step disambiguation: a bare word offers field chips + a free-text
// fallback; Tab/Enter commits the highlighted suggestion. Backspace on an empty input removes the
// last pill. v-model is the query STRING (round-trips via the AST). Nuxt-UI-free; takes the engine
// `schema` as a prop (domain-agnostic).
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { astToPills, narrate, resolveField, type Pill, removePill, movePill } from '@noy-db/ui'
import { buildSuggestions, type Suggestion } from '@noy-db/ui'
import { parse } from '@noy-db/ui'
import { resolve } from '@noy-db/ui'
import { serialize } from '@noy-db/ui'
import type { EntitySchema } from '@noy-db/ui'
import { useNuiI18n } from '../core/i18n'

const props = withDefaults(defineProps<{
  modelValue: string
  schema: EntitySchema
  /** Source rows, used to derive entity/enum facet values for value suggestions. */
  rows?: readonly Record<string, any>[]
  /** Column list (key+label) so show:/hide: can suggest every column, incl. derived ones. */
  columns?: { key: string; label: string }[]
  placeholder?: string
  /** Canonical value → display name (enum/entity labels), so the rest-title reads "Jazz" not "jazz". */
  formatValue?: (field: string, value: string) => string | undefined
  /** Render the trailing clear (×) inside the box. Turn off when the host puts clear in its own
   *  fixed icon toolbar (so × never moves with the content). */
  inlineClear?: boolean
  /** Interpretation voice (spec §2): 'exact' = deterministic parse + suggestions (default);
   *  'ask' = the draft is natural language — Enter emits `ask`, suggestions hide, blur keeps
   *  the draft (never committed as free-text pills, never discarded). */
  mode?: 'exact' | 'ask'
  /** An AI request is in flight: draft shimmers, input is read-only, Esc emits `abortAsk`. */
  busy?: boolean
}>(), { rows: () => [], columns: () => [], inlineClear: true, mode: 'exact', busy: false })

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** Send this natural-language draft to AI (Enter in ask mode, or Alt+Enter one-shot in exact). */
  ask: [nl: string]
  /** Esc during an in-flight AI request. */
  abortAsk: []
}>()
const { t } = useNuiI18n()
const effPlaceholder = computed(() =>
  props.placeholder
  ?? (props.mode === 'ask'
    ? t('nui.search.askPlaceholder', 'Describe it — e.g. cheap jazz from the 70s…')
    : t('nui.search.placeholder', 'Filter — type to search, Tab to add a pill…')))

const draft = ref('')
const open = ref(false)
const active = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)
const focused = ref(false)

const ast = computed(() => resolve(parse(props.modelValue).ast, props.schema))
const pills = computed(() => astToPills(ast.value, props.schema, props.formatValue, t))
// At rest the box reads as the view title: the fluent, compact narrate title ("Records by Genre").
// Focusing swaps to the interactive pill editor. The full sentence rides along as the tooltip —
// essential when the compact title budget-truncates to "+N".
const narration = computed(() => narrate(ast.value, props.schema, { t, formatValue: props.formatValue }))
const restTitle = computed(() => narration.value.title)

const facets = computed<Record<string, string[]>>(() => {
  const out: Record<string, string[]> = {}
  for (const f of props.schema.fields) {
    // Text fields get observed values too: after the two-step `Label:` the user expects the list of
    // labels, and joined entity-display fields (artist_name/label_name) are type text in the schema.
    if (f.type !== 'entity' && f.type !== 'enum' && f.type !== 'text') continue
    const set = new Set<string>()
    for (const r of props.rows) { const v = r[f.rowKey ?? f.id]; if (v != null && v !== '') set.add(String(v)) }
    out[f.id] = [...set].sort()
  }
  return out
})

// Suggestions are the EXACT voice's instrument; in ask mode the panel hides (natural-language
// register — a hint row shows instead). EXCEPTION: a pill-edit session is a DSL operation — its
// popup and deterministic commit apply in ANY mode, or editing a pill while ✨ is armed would
// send raw DSL to the AI as if it were prose.
const askVoice = computed(() => props.mode === 'ask' && !editing.value)
const suggestions = computed<Suggestion[]>(() =>
  askVoice.value ? [] : buildSuggestions(draft.value, props.schema, facets.value, undefined, props.columns, props.formatValue, t))

function setQuery(q: string): void { emit('update:modelValue', q.trim()) }
function accept(s: Suggestion): void {
  if (s.caretAfter === 'value') { draft.value = s.token; focusInput(); return }
  setQuery(`${props.modelValue} ${s.token}`)
  editing.value = null
  draft.value = ''
  active.value = 0
}
/** Quote a `field:multi word value` draft before a RAW commit (no suggestion picked): unquoted it
 *  would parse as `field:multi` + stray free-text words. Lists/ranges/quoted values pass through,
 *  and so does a MULTI-TOKEN paste (a second `field:` in the tail) — that is DSL, not one value. */
function smartQuote(d: string): string {
  const m = d.match(/^(\S+?):([^"[>=<!].*\s.+)$/)
  return m && !/\s\S+:/.test(m[2]!) ? `${m[1]}:"${m[2]!.replace(/"/g, '\\"')}"` : d
}
function commitDraft(): void {
  const d = draft.value.trim()
  if (!d) return
  if (open.value && suggestions.value.length) { accept(suggestions.value[Math.min(active.value, suggestions.value.length - 1)]!); return }
  setQuery(`${props.modelValue} ${smartQuote(d)}`)
  editing.value = null
  draft.value = ''
}
function remove(pill: Pill): void { setQuery(serialize(removePill(ast.value, pill))) }
function clearAll(): void { setQuery(''); draft.value = ''; editing.value = null }

// ── Drag pills to reorder ────────────────────────────────────────────────────
// Order MEANS something for sort (priority) and group (nesting); for filters it's cosmetic.
// Drags are constrained to the pill's own segment. A short press stays a click (edit); movement
// past 6px becomes a drag; an accent bar marks the insertion slot.
const rootEl = ref<HTMLElement | null>(null)
const drag = ref<{ pill: Pill; listIdx: number; x0: number; y0: number; active: boolean } | null>(null)
const dragMarker = ref<number | null>(null)
let suppressClick = false

const pillEls = (): HTMLElement[] =>
  rootEl.value ? (Array.from(rootEl.value.querySelectorAll('[data-pill-id]')) as HTMLElement[]) : []

function onPillPointerDown(pill: Pill, listIdx: number, e: PointerEvent): void {
  if (e.button !== 0) return
  drag.value = { pill, listIdx, x0: e.clientX, y0: e.clientY, active: false }
  window.addEventListener('pointermove', onPillPointerMove)
  window.addEventListener('pointerup', onPillPointerUp)
}
function onPillPointerMove(e: PointerEvent): void {
  const d = drag.value
  if (!d) return
  if (!d.active) {
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return
    d.active = true
    open.value = false
  }
  // Insertion slot: within the dragged pill's segment, before the first same-source pill whose
  // row is below the pointer or whose center is right of it; else the segment end.
  const els = pillEls()
  const src = d.pill.source
  let segStart = -1
  let segEnd = -1
  pills.value.forEach((p, i) => { if (p.source === src) { if (segStart < 0) segStart = i; segEnd = i + 1 } })
  let idx = segEnd
  for (let i = segStart; i < segEnd; i++) {
    const b = els[i]?.getBoundingClientRect()
    if (!b) continue
    if (e.clientY < b.top - 4 || (e.clientY <= b.bottom + 4 && e.clientX < b.left + b.width / 2)) { idx = i; break }
  }
  dragMarker.value = idx
}
function onPillPointerUp(): void {
  const d = drag.value
  const m = dragMarker.value
  window.removeEventListener('pointermove', onPillPointerMove)
  window.removeEventListener('pointerup', onPillPointerUp)
  drag.value = null
  dragMarker.value = null
  if (!d?.active || m == null) return
  // Swallow ONLY the click generated by this drag's release; if the pointer was released off the
  // pill no click follows — the flag must expire, or it would eat the NEXT genuine click.
  suppressClick = true
  setTimeout(() => { suppressClick = false }, 0)
  // pills-array slot → index within the source list, excluding the dragged pill itself.
  let toIdx = 0
  for (let i = 0; i < m; i++) if (pills.value[i]!.source === d.pill.source && i !== d.listIdx) toIdx++
  setQuery(serialize(movePill(ast.value, d.pill, toIdx)))
  focusInput()
}
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPillPointerMove)
  window.removeEventListener('pointerup', onPillPointerUp)
})

// ── Keyboard path into the pills (roving focus) ─────────────────────────────
// ← at the input's start enters the row; ←/→ roam; Enter edits; Delete/Backspace removes;
// Alt+←/→ reorders (segment-clamped like drag); Esc / → past the last returns to the input.
// Pills are real focusable elements (tabindex=-1), so the themed :focus-visible ring applies.
function focusPillAt(i: number): void {
  // One tick late: focusing synchronously right after a query change can land on a DOM node the
  // patch is about to replace — focus silently drops to <body> and the next key goes nowhere.
  void nextTick(() => {
    const els = pillEls()
    els[Math.max(0, Math.min(i, els.length - 1))]?.focus()
  })
}
function reorderByKeyboard(pill: Pill, pi: number, dir: -1 | 1): void {
  const sameSrc = pills.value.filter((p) => p.source === pill.source).length
  const toIdx = pill.index + dir
  if (toIdx < 0 || toIdx >= sameSrc) return
  setQuery(serialize(movePill(ast.value, pill, toIdx)))
  void nextTick(() => focusPillAt(pi + dir)) // segments are contiguous → the moved pill shifts by dir
}
function onPillKeydown(pill: Pill, pi: number, e: KeyboardEvent): void {
  if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    reorderByKeyboard(pill, pi, e.key === 'ArrowLeft' ? -1 : 1)
    e.preventDefault()
  } else if (e.key === 'ArrowLeft') {
    if (pi > 0) focusPillAt(pi - 1)
    e.preventDefault()
  } else if (e.key === 'ArrowRight') {
    if (pi < pills.value.length - 1) focusPillAt(pi + 1)
    else focusInput()
    e.preventDefault()
  } else if (e.key === 'Home') { focusPillAt(0); e.preventDefault() }
  else if (e.key === 'End') { focusPillAt(pills.value.length - 1); e.preventDefault() }
  else if (e.key === 'Enter' || e.key === ' ') { editPill(pill); e.preventDefault() }
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    const target = Math.max(0, pi - 1)
    // Park focus on the input FIRST: when the focused pill unmounts, focus would exit the
    // container for a beat — the container focusout would close the editor and unmount the whole
    // row before the neighbor could be focused. The input persists across renders.
    inputEl.value?.focus()
    remove(pill)
    void nextTick(() => void nextTick(() => {
      const els = pillEls()
      if (els.length) els[Math.min(target, els.length - 1)]?.focus()
    }))
    e.preventDefault()
  } else if (e.key === 'Escape') { focusInput(); e.preventDefault() }
}

/** Active pill-edit session: lets Esc RESTORE the original criterion (cancel means cancel, never
 *  silent deletion), and puts an explicit "Remove" option at the top of the popup. */
const editing = ref<{ label: string; prevQuery: string } | null>(null)
function removeEditing(): void {
  // The criterion already left the query when the pill opened — removing = discarding the draft.
  editing.value = null
  draft.value = ''
  open.value = false
  focusInput()
}

/** Click a pill to EDIT it: its DSL token moves back into the draft (removed from the query), so
 *  the user reshapes it as text with autocomplete, exactly as if they had just typed it. A simple
 *  `field: value` pill re-opens as `Field:value` UNQUOTED — the suggestion popup opens filtered by
 *  the value, so the user edits the text pattern or picks another value from the list. */
function editPill(pill: Pill): void {
  if (suppressClick) return // the click generated by a completed drag (flag expires via timeout)
  editing.value = { label: pill.label, prevQuery: props.modelValue }
  const a = ast.value
  let token = ''
  if (pill.source === 'where') {
    const top = a.where ? (a.where.t === 'and' ? a.where.nodes : [a.where]) : []
    const n = top[pill.index]
    if (n?.t === 'pred' && n.op === 'eq' && n.value.k === 'scalar') token = `${n.field}:${n.value.v}`
    else if (n) token = serialize({ where: n, sort: [], groupBy: [] })
  } else if (pill.source === 'sort') {
    const s = a.sort[pill.index]
    if (s) token = serialize({ where: null, sort: [s], groupBy: [] })
  } else if (pill.source === 'group') {
    const g = a.groupBy[pill.index]
    if (g) token = serialize({ where: null, sort: [], groupBy: [g] })
  } else if (pill.field) {
    token = `${pill.source}:${pill.field}`
  }
  // Surface the human field name in the editable text (`Artist:No`, not `artist_name:No`) — the
  // resolver matches labels, so the labelled form round-trips.
  if (pill.field) {
    const fd = resolveField(props.schema, pill.field)
    if (fd && /^[\p{L}\p{N}_-]+$/u.test(fd.label)) token = token.replace(fd.id, fd.label)
  }
  setQuery(serialize(removePill(a, pill)))
  draft.value = token
  focusInput()
  // Pre-select the VALUE part (after the first colon): typing immediately REPLACES it — without
  // this, typing appends and 'genre:soul' + 'rock' silently becomes the value 'soulrock'.
  void nextTick(() => {
    const el = inputEl.value
    if (!el) return
    const colon = token.indexOf(':')
    if (colon > 0 && colon < token.length - 1) el.setSelectionRange(colon + 1, token.length)
  })
}

function onKeydown(e: KeyboardEvent): void {
  if (props.busy) { if (e.key === 'Escape') emit('abortAsk'); e.preventDefault(); return }
  if (e.key === 'ArrowDown') { open.value = true; active.value = Math.min(active.value + 1, suggestions.value.length - 1); e.preventDefault() }
  else if (e.key === 'ArrowUp') { active.value = Math.max(active.value - 1, 0); e.preventDefault() }
  // ← at the very start of the input walks INTO the pill row (roving focus).
  else if (e.key === 'ArrowLeft' && pills.value.length
    && inputEl.value?.selectionStart === 0 && inputEl.value?.selectionEnd === 0) {
    focusPillAt(pills.value.length - 1)
    e.preventDefault()
  }
  // Ask voice: Enter sends the natural-language draft to AI (never during a pill-edit session —
  // that draft is DSL). Exact voice: Alt+Enter = one-shot ask.
  else if (e.key === 'Enter' && (askVoice.value || (e.altKey && !editing.value))) {
    const d = draft.value.trim()
    if (d) { emit('ask', d); e.preventDefault() }
  }
  else if (e.key === 'Enter' || e.key === 'Tab') { if (draft.value.trim()) { commitDraft(); e.preventDefault() } }
  else if (e.key === 'Backspace' && !draft.value && pills.value.length) { remove(pills.value[pills.value.length - 1]!); e.preventDefault() }
  // Escape ladder (spec §4/§5), one rung per press: ① close suggestions → ② cancel the draft —
  // and cancelling a PILL EDIT restores the original criterion (never a silent delete; the
  // explicit Remove option is the delete) → ③ blur back to the title.
  else if (e.key === 'Escape') {
    // Rung ① counts the popup in EVERY form — including the editing-only Remove row (a money/date
    // pill has no value suggestions), so double-Esc means the same thing for every pill type.
    if (open.value && (suggestions.value.length || editing.value)) { open.value = false; return }
    if (editing.value) { setQuery(editing.value.prevQuery); editing.value = null; draft.value = ''; open.value = false; return }
    if (draft.value) { draft.value = ''; open.value = false; return }
    inputEl.value?.blur()
  }
}
function focusInput(): void { inputEl.value?.focus(); open.value = true }
function onInput(): void { open.value = true; active.value = 0 }

// Track focus state on the container, not just the input. This lets clicks on pill remove
// buttons not cause a false blur (relatedTarget stays inside the container).
function onContainerFocusIn(): void {
  focused.value = true
}
function onContainerFocusOut(e: FocusEvent): void {
  if (!(e.currentTarget as Element).contains(e.relatedTarget as Node | null)) {
    // Leaving edit mode must never lose typed work. EXACT: commit the draft (no suggestion pick;
    // spaced values smart-quoted) — without this, click-to-edit → blur silently DROPPED the
    // criterion. ASK: the draft is prose — committing it would pollute the query with free-text
    // pills, so it stays in the field (shown as the pending-ask line at rest) until sent/Escaped.
    const d = draft.value.trim()
    if (d && !askVoice.value) { setQuery(`${props.modelValue} ${smartQuote(d)}`); draft.value = ''; editing.value = null }
    focused.value = false
    open.value = false
  }
}

// Two visible kingdoms so the row reads as consistent chips (not some filled, some bare text):
// filter/text = accent fill (what to match); sort/group/view = neutral fill (how it's shaped).
const pillClass = (k: Pill['kind']): string =>
  (k === 'filter' || k === 'text') ? 'bg-nui-accent/15 text-nui-accent' : 'bg-nui-fg/10 text-nui-fg'

/** Host toolbar hooks: focus() enters edit mode (the lens button), clear() empties the query,
 *  focused tells the toolbar to flip its lens icon to × while editing. draft/setDraft let an AI
 *  action consume the typed text ("write in the search field, press ✨ to process with AI"). */
defineExpose({ focus: focusInput, clear: clearAll, focused, draft, setDraft: (v: string) => { draft.value = v } })
</script>

<template>
  <div
    ref="rootEl"
    class="nui-search-root relative w-full"
    @focusin="onContainerFocusIn"
    @focusout="onContainerFocusOut"
  >
    <!-- Editing the title: no border/ring — the focused state IS the title, with the criteria as
         title-sized tokens and the caret continuing on the same baseline. Fixed min-height +
         items-center (same font metrics everywhere) keep the box height IDENTICAL between rest and
         edit, so the content below never shifts. -->
    <div
      class="nui-search-inner flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 min-h-[2.875rem] cursor-text"
      @click="focusInput"
    >
      <!-- The field wears its voice: a small ✨ ghost opens the line while ask mode is armed. -->
      <span
        v-if="mode === 'ask' && (focused || draft)"
        class="i-lucide-sparkles size-4 shrink-0 text-nui-accent opacity-60"
        :class="busy ? 'animate-pulse' : ''"
        aria-hidden="true"
      />

      <!-- Ask, blurred with an unsent draft: the pending question replaces the title until sent. -->
      <span
        v-if="!focused && mode === 'ask' && draft"
        class="truncate text-2xl leading-tight text-nui-muted"
      >{{ draft }}</span>

      <!-- At rest with a query: the box reads as the fluent view title (large, bold). Click to edit.
           The tooltip carries the FULL sentence (the title may be budget-truncated to "+N"). -->
      <span
        v-else-if="!focused && pills.length"
        class="nui-search-title truncate font-bold text-nui-fg text-2xl leading-tight"
        :title="narration.subtitle"
      >{{ restTitle }}</span>

      <!-- Focused: the interactive pill editor — capsules at title scale, sharing the title baseline.
           Click a pill to edit it as text; click its × to remove it; DRAG it to reorder (order =
           sort priority / group nesting; drags stay within the pill's own segment). -->
      <template v-if="focused">
        <template v-for="(pill, pi) in pills" :key="pill.id">
          <span v-if="drag?.active && dragMarker === pi" class="w-0.5 h-8 rounded bg-nui-accent shrink-0" aria-hidden="true" />
          <!-- mousedown.prevent: a real mouse press must NOT blur the input — the blur would close
               the editor and unmount this very pill before its click could fire. -->
          <span
            :data-pill-id="pill.id"
            tabindex="-1"
            role="button"
            :aria-label="`${pill.label} — ${t('nui.search.pillKeys', 'Enter edits, Delete removes, Alt+arrows reorder')}`"
            class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 max-w-full text-2xl font-medium leading-tight cursor-text hover:ring-1 hover:ring-current/30 touch-none"
            :class="[pillClass(pill.kind), drag?.active && drag.pill.id === pill.id ? 'opacity-40' : '']"
            :title="t('nui.search.editPill', 'Click to edit · drag to reorder')"
            @mousedown.prevent
            @pointerdown="onPillPointerDown(pill, pi, $event)"
            @click.stop="editPill(pill)"
            @keydown="onPillKeydown(pill, pi, $event)"
          >
          <!-- Two tones: the field/kind head reads quiet, the value carries the weight. Accent pills
               keep the head at 75% (60% crimson over the pink fill sits at the contrast floor). -->
          <span class="truncate">
            <template v-if="pill.head"><span class="font-normal" :class="pill.kind === 'filter' || pill.kind === 'text' ? 'opacity-75' : 'opacity-60'">{{ pill.head }}</span> <span class="font-semibold">{{ pill.value }}</span></template>
            <template v-else>{{ pill.label }}</template>
          </span>
          <!-- inline-flex: the icon span must be a flex CHILD to get a box (an inline span with a
               mask has zero size — this × was invisible until the button became a flex container).
               p-1/-m-1 pads the hit area to 24px without moving a pixel — daily-use delete target. -->
          <button
            type="button"
            class="inline-flex items-center p-1 -m-1 opacity-50 hover:opacity-100 shrink-0"
            :aria-label="`${t('nui.search.removePill', 'Remove')} ${pill.label}`"
            @click.stop="remove(pill)"
          >
            <span class="i-lucide-x size-4" aria-hidden="true" />
          </button>
          </span>
        </template>
        <!-- Insertion slot after the last pill -->
        <span v-if="drag?.active && dragMarker === pills.length" class="w-0.5 h-8 rounded bg-nui-accent shrink-0" aria-hidden="true" />
      </template>

      <!-- Text input: continues the title (same size/weight/baseline); zero-width invisible at rest -->
      <input
        ref="inputEl"
        v-model="draft"
        type="text"
        :readonly="busy"
        :aria-busy="busy"
        :class="[
          'bg-transparent outline-none text-2xl font-bold leading-tight text-nui-fg placeholder:font-normal placeholder:text-nui-subtle',
          focused ? 'flex-1 min-w-32' : 'w-0 opacity-0 pointer-events-none overflow-hidden',
          busy ? 'nui-ask-busy' : ''
        ]"
        :placeholder="focused ? (pills.length ? '' : effPlaceholder) : ''"
        @keydown="onKeydown"
        @input="onInput"
        @focus="open = true"
        @blur="open = false"
      >

      <!-- Placeholder shown at rest when nothing is typed or committed -->
      <span
        v-if="!focused && !pills.length && !(mode === 'ask' && draft)"
        class="text-nui-subtle text-2xl leading-tight px-1 select-none"
      >{{ effPlaceholder }}</span>

      <!-- Clear: only visible while editing (hosts with their own icon toolbar turn this off) -->
      <button
        v-if="inlineClear && focused && (pills.length || draft.length)"
        type="button"
        class="nui-icon-btn text-nui-muted size-6 self-center ms-auto"
        :aria-label="t('nui.search.clearFilters', 'Clear all filters')"
        @click.stop="clearAll"
      >
        <span class="i-lucide-x size-3.5" aria-hidden="true" />
      </button>
    </div>

    <!-- Ask voice: no suggestion panel — one ACTIONABLE hint row (spec §2): it looks like an
         option, so it must BE one (click = same as Enter). Hidden during a pill-edit session,
         whose deterministic popup takes over even while ✨ is armed. -->
    <button
      v-if="focused && askVoice && draft && !busy"
      type="button"
      class="nui-panel absolute z-20 mt-1 px-3 py-1.5 text-xs text-nui-muted text-start cursor-pointer hover:text-nui-fg hover:bg-nui-bg-accent"
      @mousedown.prevent
      @click="draft.trim() && emit('ask', draft.trim())"
    >↵ {{ t('nui.search.askHint', 'interpret with AI') }}</button>

    <ul
      v-if="open && (suggestions.length || editing)"
      class="nui-panel absolute z-20 mt-1 w-full max-w-md max-h-72 overflow-y-auto py-1"
      role="listbox"
    >
      <!-- Editing a pill: an explicit Remove is the FIRST option — deleting is a choice, never
           an accident (Esc cancels the edit and restores the pill instead). -->
      <li
        v-if="editing"
        class="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer text-nui-accent hover:bg-nui-bg-accent border-b border-nui-border"
        role="option"
        @mousedown.prevent="removeEditing"
      >
        <span class="i-lucide-trash-2 size-3.5 shrink-0" aria-hidden="true" />
        <span class="flex-1 truncate">{{ t('nui.search.removeFilter', 'Remove') }} {{ editing.label }}</span>
      </li>
      <li
        v-for="(s, i) in suggestions"
        :key="s.token"
        :class="['flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer', i === active ? 'bg-nui-bg-accent' : 'hover:bg-nui-bg-accent']"
        role="option"
        :aria-selected="i === active"
        @mousedown.prevent="accept(s)"
        @mouseenter="active = i"
      >
        <span class="flex-1 truncate">{{ s.label }}</span>
        <span v-if="s.hint" class="text-[11px] uppercase tracking-wide text-nui-muted shrink-0">{{ t(`nui.hint.${s.hint}`, s.hint) }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Borderless in BOTH states — editing looks like editing the title, not entering a form field. */
.nui-search-inner {
  border-radius: var(--radius-control);
}

/* AI request in flight: the draft shimmers while the model thinks. */
.nui-ask-busy {
  animation: nui-ask-shimmer 1s ease-in-out infinite;
}
@keyframes nui-ask-shimmer {
  50% { opacity: 0.55; }
}
@media (prefers-reduced-motion: reduce) {
  .nui-ask-busy { animation: none; opacity: 0.7; }
}
</style>
