// Value-synonym MECHANISM (domain-free). Synonyms canonicalize a typed value to a real schema
// value at resolve time (e.g. "unpaid"/"insoluto" → "invoiced"). The synonym DATA is domain-
// specific, so the host app registers it via `registerSynonyms()`; this module only normalizes
// and looks up over the registered table. An empty registry is a safe no-op (values pass through).

export type SynonymTable = Record<string, Record<string, string>>

let registered: SynonymTable = {}

/** Register the host's value-synonym table, keyed `"<entity>.<field>"`. */
export function registerSynonyms(table: SynonymTable): void {
  registered = table
}

/** lowercase + strip accents (München → munchen, città → citta). */
export function normalizeTerm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Canonicalize a value for (entity, field) via the registered table; returns the input if no match. */
export function resolveSynonym(entity: string, field: string, value: string): string {
  const table = registered[`${entity}.${field}`]
  if (!table) return value
  return table[normalizeTerm(value)] ?? value
}

/** True when (entity, field) has a synonym table (used to decide bare-term upgrades). */
export function hasSynonyms(entity: string, field: string): boolean {
  return `${entity}.${field}` in registered
}

/** All canonical values reachable for a field's synonyms (for suggestion ranking). */
export function synonymCanonicals(entity: string, field: string): string[] {
  const table = registered[`${entity}.${field}`]
  return table ? [...new Set(Object.values(table))] : []
}
