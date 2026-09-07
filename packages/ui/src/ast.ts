// Syntactic query AST produced by parse.ts. Values here are RAW strings and field names are RAW
// (aliases unresolved) — parse.ts stays schema-free so it never throws and runs on every keystroke
// for autocomplete. A later resolve.ts pass enriches this into the *semantic* AST: it coerces
// values (dates/money/number), resolves field aliases + synonyms to canonical ids, and upgrades
// bare `text` terms into predicates against the per-module schema. The tree round-trips to/from
// the search-box pills (pills.ts) and a serialized string (serialize.ts) for ?q=, saved searches,
// and history. See docs/unified-search-and-data-cube-spec.md §3.2.

/** Comparison operators on a predicate. `in` = within-field OR (a list); `range` = bounded. */
export type CmpOp = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'range'

/** One `field op value` predicate (raw, pre-resolution). */
export interface Predicate {
  t: 'pred'
  field: string
  op: CmpOp
  value: RawValue
  /** Original token text, kept for faithful re-serialization and the pill label. */
  raw?: string
  /** Set by parse when the predicate is incomplete (e.g. `status:` with no value yet). */
  partial?: boolean
}

/** A predicate's raw value before type coercion. */
export type RawValue =
  | { k: 'scalar'; v: string }
  | { k: 'list'; v: string[] }
  | { k: 'range'; from: string | null; to: string | null }

/** Free text (a bareword the resolver may later upgrade, or a quoted literal that stays text). */
export interface TextNode { t: 'text'; value: string; literal: boolean }

export interface AndNode { t: 'and'; nodes: Node[] }
export interface OrNode { t: 'or'; nodes: Node[] }
export interface NotNode { t: 'not'; node: Node }

export type Node = AndNode | OrNode | NotNode | Predicate | TextNode

/** A sort key (from a `sort:field[:dir]` token or a header click). */
export interface SortKey { field: string; dir: 'asc' | 'desc'; comparator?: 'natural' | 'ordinal' }

/** A group-by key (from a `group:field` token or a header action). */
export interface GroupKey {
  field: string
  dir?: 'asc' | 'desc'
  comparator?: 'natural' | 'ordinal'
  collapsed?: boolean
}

/** View directives (R5): force columns visible/hidden via `show:field` / `hide:field`, independent
 *  of the responsive width rules. Optional so partial-Ast call sites stay valid. */
export interface ViewDirectives { show: string[]; hide: string[] }

/** The whole query: a where-tree plus sort, group-by, and view (column show/hide) channels. */
export interface Ast {
  where: Node | null
  sort: SortKey[]
  groupBy: GroupKey[]
  view?: ViewDirectives
}

/** Where the caret sits in the trailing unfinished token — drives autocomplete (B2). */
export type CaretIn = 'field' | 'op' | 'value' | 'boolean'

/** The unfinished token under the caret at end-of-input (cursor-at-end model for now). */
export interface DraftTail {
  caretIn: CaretIn
  /** Resolved-or-raw field name when the caret is past a `field:`. */
  field?: string
  /** The operator already typed (`:`, `:>`, …) when caretIn is 'value'. */
  op?: string
  /** The partial text the user is typing (a bare word, or the partial value). */
  text: string
  /** Absolute offsets of the partial text in the input, for in-place replacement on commit. */
  start: number
  end: number
}

/** A non-fatal parse problem (the parser is panic-free; it records and continues). */
export interface ParseError { at: number; message: string }

/** parse.ts result: always an AST (possibly partial), the draft tail, and any soft errors. */
export interface ParseResult {
  ast: Ast
  tail: DraftTail | null
  errors: ParseError[]
}
