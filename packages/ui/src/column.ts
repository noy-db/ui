// Column model for the list/table: a view-side description of one column (label, alignment,
// filter kind, aggregate, responsive priority, accessors). Distinct from the data-layer FieldDef
// (which comes from the schema) — an AppColumn is what a view chooses to render and how.
import type { EnumCount } from './summary'

/** Per-column enum breakdown for the second-header row (e.g. Status → draft/to_verify counts). */
export interface SubtotalEnum { items: readonly EnumCount[]; distinctNoun: string }

export interface AppColumn {
  key: string
  /** The schema field this column actually represents, when it differs from `key` — e.g. an entity
   *  column keyed by the joined display field (`artist_name`) but backed by the FK (`artistId`).
   *  Used to match the column to group-by / filter / sort fields. Defaults to `key`. */
  field?: string
  label: string
  /** Header representation ladder (rich → abbreviated), e.g. `['Price', '$']`. The header shows the
   *  richest that fits, like a cell's NuiText. Defaults to `[label]`. */
  labelReps?: string[]
  /** UnoCSS icon class indicating the field type, e.g. 'i-lucide-calendar'. Shown in the column header and in column-chooser panels. */
  icon?: string
  /** Unit/symbol shown once, faded, after the header label (e.g. '$', '★', 'min', '♥') so cells can
   *  carry bare values. Keeps a tight table uniform — the glyph lives in the header, not every row. */
  headerSym?: string
  /** Render the header as just `headerSym` (the glyph), dropping the word — for narrow symbol columns
   *  (rating ★, favourite ♥) where the label would only truncate. `label` still drives the chooser/aria. */
  headerSymOnly?: boolean
  align?: 'left' | 'right'
  sortable?: boolean
  /** Extra classes for the header + body cells of this column. */
  class?: string
  /** Header filter control. Omit for no filter. */
  filter?: 'enum' | 'entity' | 'date'
  /** Amount column: sum visible rows into the subtotal cell. */
  summable?: boolean
  /** Read the categorical/entity value of a row for enum/entity filtering (default: String(row[key])). */
  enumOf?: (row: Record<string, any>) => string | null | undefined
  /** Read the numeric value of a row for summing (default: Number(row[key])). */
  amountOf?: (row: Record<string, any>) => number
  /** Read the ISO date string of a row for date filtering (default: String(row[key])). */
  dateOf?: (row: Record<string, any>) => string | null | undefined
  /** Format a summed amount for the subtotal cell (default: n.toFixed(2)). */
  formatSum?: (n: number) => string
  /** What to show in this column's second-header cell. enum breakdowns come via `subtotalEnums`.
   *  range → "1952–1989" (or a date year-span); stats → min‹mid›max; boolTrue → count of truthy. */
  aggregate?: 'count' | 'sum' | 'distinct' | 'dateRange' | 'range' | 'stats' | 'avg' | 'boolTrue'
  /** Plural noun for a 'distinct' aggregate (e.g. "buyers" → "4 buyers"). */
  aggregateNoun?: string
  /** Truthiness reader for a 'boolTrue' aggregate (default: Boolean(row[key])). */
  boolOf?: (row: Record<string, any>) => boolean
  /** Central value for a 'stats' aggregate — the bracketed middle of min‹mid›max. Default 'avg'. */
  statMiddle?: 'avg' | 'median'
  /** Format each number in a 'range'/'stats' aggregate (default: rounded integer). */
  formatNum?: (n: number) => string
  /** Format a 'range' aggregate's low/high pair as one string (e.g. years → "1986–99"). Overrides
   *  the default `formatNum(lo)–formatNum(hi)` when lo ≠ hi. */
  formatRange?: (lo: number, hi: number) => string
  /** Wrap a 'range'/'stats'/'boolTrue' aggregate text (e.g. prefix '$', suffix ' ★'). */
  prefix?: string
  suffix?: string
  /** Sort by several fields at once (a composite ID, e.g. Reg = ['year','numberT']). */
  sortFields?: string[]
  /** Responsive priority. Omit = CORE (dropped last). With a value, the column is dropped before
   *  core columns when the width budget is tight — lower relevance drops first. */
  relevance?: number
  /** Minimum rendered width in px. Defaults from the column's content archetype (see WIDTH_ARCHETYPES).
   *  The column never renders narrower than this; if it can't fit, it is dropped instead. */
  minWidth?: number
  /** Comfortable width in px (≥ minWidth) — the size the column targets when there's room (header +
   *  content read cleanly). Surplus beyond every column's ideal goes to flex columns. */
  idealWidth?: number
  /** Flex weight for sharing surplus beyond ideal (0 = rigid, stays at ideal). Defaults from the archetype. */
  flex?: number
  /** Pinned absolute width px (fixed mode) — set by the user via column resize. Overrides flex. */
  fixedPx?: number
  /** Pinned proportion of the table (0..1) — recomputed against the container on every resize. */
  pct?: number
  /** At the narrowest (xs) bucket, fold this other column's value onto a 2nd line of this cell (R6),
   *  e.g. Reg.stackWith='saleDate'. The folded column then isn't shown standalone. */
  stackWith?: string
}
