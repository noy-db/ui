// Schema shape the search/table engine operates on. Domain-free: `entity` is an opaque string
// (a collection name), not a fixed union — the app supplies whatever collections it has.

/** Coarse field kind the engine branches on for filtering, sorting, faceting and formatting. */
export type FieldType = 'enum' | 'entity' | 'date' | 'money' | 'number' | 'boolean' | 'text'

export interface FieldDef {
  /** Canonical field id (used in the AST and pills). */
  id: string
  label: string
  type: FieldType
  /** Record key to read (defaults to id). */
  rowKey?: string
  /** Canonical value order for enums — drives ordinal sort and facet ordering. */
  enumOrder?: readonly string[]
  /** Alternative names the user may type (field aliases, EN/IT/…). */
  aliases?: readonly string[]
}

export interface EntitySchema {
  /** Collection name this schema describes (opaque to the engine). */
  entity: string
  fields: readonly FieldDef[]
  /** Fields scanned for bare free-text terms (substring match). */
  textFields: readonly string[]
}
