import type { EntitySchema, FieldDef } from './types'

/** Resolve a user-typed field name to a FieldDef — case-insensitive, by PRIORITY:
 *  canonical id → alias → display label. Matching labels lets the UI surface human tokens
 *  (`Artist:`) instead of internal ids (`artist_name:`); the priority order keeps explicit
 *  identifiers/aliases authoritative when two fields share a display label (an FK and its
 *  joined display field are both labelled "Artist" — the alias on the display field wins). */
export function resolveField(schema: EntitySchema, name: string): FieldDef | undefined {
  const n = name.trim().toLowerCase()
  return (
    schema.fields.find((f) => f.id.toLowerCase() === n)
    ?? schema.fields.find((f) => f.aliases?.some((a) => a.toLowerCase() === n))
    ?? schema.fields.find((f) => f.label.toLowerCase() === n)
  )
}

/** Ordinal rank of an enum value (unknown/legacy values sort to the end). */
export function ordinalRank(order: readonly string[] | undefined, value: string): number {
  if (!order) return Number.MAX_SAFE_INTEGER
  const i = order.indexOf(value)
  return i === -1 ? order.length : i
}
