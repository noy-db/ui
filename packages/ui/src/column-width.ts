// Width engine for the fit-the-container table (responsive width policy). Pure + testable.
//
// The invariant: the table width EQUALS its container — it never overflows. Columns are sized from
// a budget, not from content. Two steps:
//   1. selectColumns — drop the lowest-relevance columns until the survivors' minimum widths fit the
//      budget (so we shed columns instead of growing a horizontal scrollbar).
//   2. distributeWidths — hand each survivor a pixel width that, summed, equals the budget: fixed
//      columns keep their px, proportional columns take a % of the table, the rest (auto) share the
//      leftover by flex weight, never below their min.
//
// Min widths come from a per-content ARCHETYPE (derived from the schema FieldType, the same source
// the type icons use) with per-column overrides. Drop priority is the existing `relevance` order.

import type { FieldType } from './types'

export type WidthArchetype = 'serial' | 'blob' | 'tinyNum' | 'num' | 'enum' | 'date' | 'entity' | 'text'

export interface ArchetypeSpec {
  /** Minimum width in px — the column never renders narrower than this (else it's dropped). */
  min: number
  /** Comfortable width in px — the target the column sizes to when there's room (header + content
   *  read cleanly). Columns grow to `ideal` BEFORE any surplus goes to flex columns. */
  ideal: number
  /** Flex weight for sharing surplus beyond every column's ideal. 0 = rigid (stays at ideal). */
  flex: number
}

/** Default min/ideal width + flex per content archetype. Tuned for a 16px root. */
export const WIDTH_ARCHETYPES: Record<WidthArchetype, ArchetypeSpec> = {
  serial: { min: 34, ideal: 34, flex: 0 },
  blob: { min: 56, ideal: 56, flex: 0 },
  tinyNum: { min: 44, ideal: 72, flex: 0 },
  num: { min: 60, ideal: 84, flex: 0 },
  enum: { min: 76, ideal: 104, flex: 0 },
  date: { min: 92, ideal: 116, flex: 0 },
  entity: { min: 110, ideal: 148, flex: 1 },
  text: { min: 96, ideal: 176, flex: 2 },
}

/** Map an engine FieldType to its default width archetype. */
export function archetypeForFieldType(type: FieldType): WidthArchetype {
  switch (type) {
    case 'number':
    case 'money':
      return 'num'
    case 'enum':
      return 'enum'
    case 'date':
      return 'date'
    case 'entity':
      return 'entity'
    case 'boolean':
      return 'tinyNum'
    case 'text':
    default:
      return 'text'
  }
}

/** A column as the width engine sees it: just the numbers it needs to fit + size. */
export interface SizedColumn {
  key: string
  /** Drop priority. Lower drops first; `undefined` = core (dropped only after every relevance'd one). */
  relevance?: number
  /** Minimum width px. */
  min: number
  /** Comfortable target width px (≥ min). Defaults to `min` when omitted. */
  ideal?: number
  /** Flex weight (0 = rigid). */
  flex: number
  /** Pinned absolute width px (fixed mode) — overrides flex participation. */
  fixedPx?: number
  /** Pinned proportion of the table (0..1) — recomputed against the container on every resize. */
  pct?: number
}

/** The floor width a column needs to be considered "fitting" at this container size. */
function floorWidth(c: SizedColumn, container: number): number {
  if (c.fixedPx !== undefined) return Math.max(c.fixedPx, 0)
  if (c.pct !== undefined) return Math.max(c.pct * container, c.min)
  return c.min
}

const isPinned = (c: SizedColumn): boolean => c.fixedPx !== undefined || c.pct !== undefined

/**
 * Drop priority: unpinned & unforced drop first (bucket 0), then pinned (1), then forced (2).
 * Within a bucket, the lower `relevance` drops first (core = +∞ survives longest); ties break on
 * the lower `flex` so the primary content column (highest flex) is the last to go. Returns the
 * index of the column to drop, or -1 if nothing may be dropped.
 */
function nextToDrop(cols: readonly SizedColumn[], force: ReadonlySet<string>): number {
  let worst = -1
  let wb = Infinity, wr = Infinity, wf = Infinity
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i]!
    const bucket = force.has(c.key) ? 2 : isPinned(c) ? 1 : 0
    const rel = c.relevance ?? Number.POSITIVE_INFINITY
    // Lexicographic on (bucket, relevance, flex), all ascending — the smallest drops.
    if (bucket < wb || (bucket === wb && (rel < wr || (rel === wr && c.flex < wf)))) {
      worst = i; wb = bucket; wr = rel; wf = c.flex
    }
  }
  return worst
}

/**
 * Choose which columns survive at `container` width: drop the lowest-priority/relevance column until
 * the survivors' floor widths fit the budget, never dropping below one column. Order is preserved.
 *
 * @param columns ordered columns
 * @param container available width in px (already net of any serial column — see `serial`)
 * @param opts.serial reserved px for a leading serial/index column (counts against the budget)
 * @param opts.force keys that must never be dropped (search focus / `show:` / user pin)
 */
export function selectColumns(
  columns: readonly SizedColumn[],
  container: number,
  opts: { serial?: number; force?: ReadonlySet<string> } = {},
): string[] {
  const force = opts.force ?? new Set<string>()
  const budget = Math.max(0, container - (opts.serial ?? 0))
  const survivors = [...columns]
  const sum = (cs: readonly SizedColumn[]) => cs.reduce((t, c) => t + floorWidth(c, container), 0)
  while (survivors.length > 1 && sum(survivors) > budget) {
    const i = nextToDrop(survivors, force)
    if (i === -1) break
    survivors.splice(i, 1)
  }
  return survivors.map((c) => c.key)
}

/**
 * Size the given (already-selected) columns so the widths sum to the budget. Fixed → its px;
 * proportional → pct·container (≥ min); auto → min + a flex-weighted share of the leftover. Any
 * rounding remainder lands on the highest-flex auto column (or the first column if none flex).
 */
export function distributeWidths(
  columns: readonly SizedColumn[],
  container: number,
  opts: { serial?: number } = {},
): Record<string, number> {
  const budget = Math.max(0, container - (opts.serial ?? 0))
  const out: Record<string, number> = {}
  if (columns.length === 0) return out

  let pinnedTotal = 0
  const autos: SizedColumn[] = []
  for (const c of columns) {
    if (c.fixedPx !== undefined) { out[c.key] = Math.max(c.fixedPx, 0); pinnedTotal += out[c.key]! }
    else if (c.pct !== undefined) { out[c.key] = Math.max(c.pct * container, c.min); pinnedTotal += out[c.key]! }
    else autos.push(c)
  }

  const idealOf = (c: SizedColumn) => Math.max(c.ideal ?? c.min, c.min)
  const autoBudget = budget - pinnedTotal
  const sumIdeal = autos.reduce((t, c) => t + idealOf(c), 0)

  if (autoBudget >= sumIdeal) {
    // Room for every column's comfortable width — give it, then hand the surplus to flex columns
    // (or, if none flex, spread it proportionally so the table fills without any column ballooning).
    const surplus = autoBudget - sumIdeal
    const flexTotal = autos.reduce((t, c) => t + c.flex, 0)
    for (const c of autos) {
      const share = flexTotal > 0 ? (c.flex / flexTotal) * surplus
        : (sumIdeal > 0 ? (idealOf(c) / sumIdeal) * surplus : surplus / autos.length)
      out[c.key] = idealOf(c) + share
    }
  } else {
    // Too tight for every ideal — shrink each from ideal toward its min, proportional to its slack.
    const sumMin = autos.reduce((t, c) => t + c.min, 0)
    const shrinkable = sumIdeal - sumMin
    const deficit = sumIdeal - autoBudget
    for (const c of autos) {
      const room = idealOf(c) - c.min
      out[c.key] = shrinkable > 0 ? idealOf(c) - room * (deficit / shrinkable) : c.min
    }
  }

  // Round to whole px and pin the rounding remainder on the widest-flex auto (or first column).
  let acc = 0
  const keys = columns.map((c) => c.key)
  for (const k of keys) { out[k] = Math.round(out[k]!); acc += out[k]! }
  const remainder = budget - acc
  if (remainder !== 0) {
    const target = autos.length
      ? autos.reduce((a, b) => (b.flex > a.flex ? b : a)).key
      : keys[0]!
    out[target] = Math.max(0, out[target]! + remainder)
  }
  return out
}

/** Convenience: select then distribute. Returns surviving keys (in order) and their px widths. */
export function fitColumns(
  columns: readonly SizedColumn[],
  container: number,
  opts: { serial?: number; force?: ReadonlySet<string> } = {},
): { visible: string[]; widths: Record<string, number> } {
  const visible = selectColumns(columns, container, opts)
  const set = new Set(visible)
  const survivors = columns.filter((c) => set.has(c.key))
  return { visible, widths: distributeWidths(survivors, container, { serial: opts.serial }) }
}
