// Filter UI value types shared by the AST-backed table (column-filter.ts + use-ast-table.ts) and
// the header/chip components. This module is TYPES ONLY — the filtering logic lives in
// column-filter.ts, evaluated over the search AST. (The pre-AST TableFilters engine that used to
// live here — per-column predicates, faceting, subtotals, chips — was retired when Phase 3 unified
// everything onto the one AST; see git history for the old implementation.)

/** A column header filter's current value. */
export type ColumnFilterValue =
  | { kind: 'enum'; selected: string[] }
  | { kind: 'entity'; selected: string[] }
  | { kind: 'date'; from?: string; to?: string }

/** One faceted value option in a header filter popover. `value` is the canonical key used for
 *  filtering; `label` (optional) is the host-supplied display string (e.g. a dict/locale label). */
export interface Facet { value: string; count: number; selected: boolean; label?: string }

/** Entity-column facets split into those present in the current view and the rest. */
export interface EntityFacets { inView: Facet[]; others: Facet[] }

/** A removable active-filter chip. */
export interface FilterChip { key: string; label: string; text: string }
