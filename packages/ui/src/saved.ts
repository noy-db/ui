// Saved smart searches (L1) — the model + pure helpers. A SavedSearch stores the CANONICAL
// serialized query (where + sort + group in one string, per the AST round-trip), never result
// rows: "smart" means re-running it replays the AST on the current dataset (L4). A "static"
// snapshot is an explicit future opt-in. Persisted in the encrypted vault (business-relevant,
// deliberate, low-frequency) — unlike recents, which are localStorage. See spec §L.

export interface SavedSearch {
  id: string
  entity: string
  /** User-given label. */
  name: string
  /** Canonical serialized AST — applied verbatim to the search state to re-run it. */
  query: string
  /** Pinned to the top of the menu (L3). */
  favorite: boolean
  /** This module's default view: applied as removable pills when the list opens bare (B5). */
  isDefault: boolean
  /** 'smart' replays the AST live (default); 'static' would snapshot rows (not yet built). */
  mode: 'smart' | 'static'
  createdAt: number
  updatedAt: number
}

/** True if a name is usable (non-blank after trimming). */
export function isValidName(name: string): boolean {
  return name.trim().length > 0
}

/** Build a SavedSearch with defaults (smart, not-favorite, equal timestamps). Trims the name. */
export function makeSavedSearch(
  input: { entity: string; name: string; query: string; mode?: 'smart' | 'static'; favorite?: boolean; isDefault?: boolean },
  now: number,
  id: string,
): SavedSearch {
  return {
    id,
    entity: input.entity,
    name: input.name.trim(),
    query: input.query.trim(),
    favorite: input.favorite ?? false,
    isDefault: input.isDefault ?? false,
    mode: input.mode ?? 'smart',
    createdAt: now,
    updatedAt: now,
  }
}

/** Built-in default scope keyword for date-bearing modules (sales/purchases) — see dates.ts. */
export const BUILTIN_DEFAULT_QUERY = 'recent'

/**
 * The query a module should open with: the user's default saved search if one is marked, else the
 * built-in `recent` scope for date-bearing entities, else nothing. `hasDateField` lets the caller
 * decide built-in applicability without importing the schema here.
 */
export function pickDefaultQuery(
  list: readonly SavedSearch[], entity: string, hasDateField: boolean,
): string {
  const userDefault = list.find((s) => s.entity === entity && s.isDefault)
  if (userDefault) return userDefault.query
  return hasDateField ? BUILTIN_DEFAULT_QUERY : ''
}

/** This entity's saved searches only. */
export function savedForEntity(list: readonly SavedSearch[], entity: string): SavedSearch[] {
  return list.filter((s) => s.entity === entity)
}

/** Display order: favorites first, then most-recently-updated, then name as a stable tiebreak. */
export function sortSaved(list: readonly SavedSearch[]): SavedSearch[] {
  return [...list].sort((a, b) =>
    (Number(b.favorite) - Number(a.favorite)) ||
    (b.updatedAt - a.updatedAt) ||
    a.name.localeCompare(b.name))
}

/** Find an existing saved search for this entity whose canonical query matches (dedup on save). */
export function findByQuery(list: readonly SavedSearch[], entity: string, query: string): SavedSearch | undefined {
  const q = query.trim()
  return list.find((s) => s.entity === entity && s.query === q)
}
