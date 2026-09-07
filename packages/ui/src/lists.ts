// Lists — the hide/patch algebra (traverse spec P-D). One `ListDef` unifies three shapes:
//
//   list = (eval(query) − hide) ∪ patch      (ordered by the query's own sort)
//
//   • pure smart list       — a bookmarked query, no overrides
//   • smart with overrides  — a query plus `hide` (mask a matching row) / `patch` (add a non-matching one)
//   • fixed playlist        — no query, all members in `patch`
//
// Add/remove are TOTAL — one pair of operations works on every shape (the overrides absorb the diff):
//   remove(id) = id ∈ patch ? unpatch : hide          add(id) = id ∈ hide ? unhide : patch
//
// Pure + framework-free (like `saved.ts`): the model + operations live here; the host owns
// persistence (localStorage today; vault-encrypted/syncable is the endgame — lists are data).

export interface ListDef {
  id: string
  entity: string
  /** User-given label. */
  name: string
  /** Canonical serialized query (AST round-trip), or empty for a fixed playlist (all `patch`). */
  query: string
  /** Ids masked out even though the query matches them. Disjoint from `patch` under the total ops. */
  hide: string[]
  /** Ids force-included even though the query doesn't match them (or there is no query). */
  patch: string[]
  createdAt: number
  updatedAt: number
}

/** True if a name is usable (non-blank after trimming). */
export function isValidListName(name: string): boolean {
  return name.trim().length > 0
}

/** Build a `ListDef` with defaults (empty overrides, equal timestamps). Trims the name. */
export function makeList(
  input: { entity: string; name: string; query?: string; hide?: string[]; patch?: string[] },
  now: number,
  id: string,
): ListDef {
  return {
    id,
    entity: input.entity,
    name: input.name.trim(),
    query: (input.query ?? '').trim(),
    hide: [...(input.hide ?? [])],
    patch: [...(input.patch ?? [])],
    createdAt: now,
    updatedAt: now,
  }
}

/** A list with no query is a fixed playlist — its membership is exactly `patch`. */
export function isFixedList(def: ListDef): boolean {
  return def.query.trim() === ''
}

/** Classify a list for display: fixed (no query) · smart-overridden (query + overrides) · smart (query only). */
export function listKind(def: ListDef): 'fixed' | 'smart' | 'smart-overridden' {
  if (isFixedList(def)) return 'fixed'
  return def.hide.length || def.patch.length ? 'smart-overridden' : 'smart'
}

/**
 * Resolve a list to its ordered member ids: `(eval(query) − hide) ∪ patch`.
 *
 * `evaluatedIds` is the query result in the query's own sort order (empty for a fixed list). Query
 * members keep their evaluated position; `hide` drops them (unless also patched, where the union
 * wins); `patch`-only ids append after, in `patch` order. Order-stable and duplicate-free.
 */
export function resolveListIds(def: ListDef, evaluatedIds: readonly string[]): string[] {
  const hide = new Set(def.hide)
  const patch = new Set(def.patch)
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of evaluatedIds) {
    if (seen.has(id)) continue
    if (hide.has(id) && !patch.has(id)) continue // masked (unless the union adds it back)
    out.push(id)
    seen.add(id)
  }
  for (const id of def.patch) {
    if (!seen.has(id)) { out.push(id); seen.add(id) }
  }
  return out
}

/** Would this id show in the list right now? `inQuery` = the query currently evaluates to it. */
export function isInList(def: ListDef, id: string, inQuery: boolean): boolean {
  if (def.patch.includes(id)) return true
  if (def.hide.includes(id)) return false
  return inQuery
}

/** TOTAL add: an id in `hide` un-hides; otherwise it's added to `patch` (idempotent). */
export function addToList(def: ListDef, id: string, now: number): ListDef {
  if (def.hide.includes(id)) {
    return { ...def, hide: def.hide.filter((h) => h !== id), updatedAt: now }
  }
  if (def.patch.includes(id)) return def
  return { ...def, patch: [...def.patch, id], updatedAt: now }
}

/** TOTAL remove: an id in `patch` un-patches; otherwise it's added to `hide` (idempotent). */
export function removeFromList(def: ListDef, id: string, now: number): ListDef {
  if (def.patch.includes(id)) {
    return { ...def, patch: def.patch.filter((p) => p !== id), updatedAt: now }
  }
  if (def.hide.includes(id)) return def
  return { ...def, hide: [...def.hide, id], updatedAt: now }
}

/** Toggle membership: remove if currently in the list, else add. `inQuery` from the live query. */
export function toggleInList(def: ListDef, id: string, inQuery: boolean, now: number): ListDef {
  return isInList(def, id, inQuery) ? removeFromList(def, id, now) : addToList(def, id, now)
}

// ─── Set algebra (traverse P-E): fold a bulk SELECTION into a list ────────────────────────────
// Each folds the total single-id ops, so the result stays a valid `ListDef` and every combination
// (union of a fresh selection, subtract of members, intersect down to an overlap) is expressible.

/** Union: add every selected id to the list (∪). */
export function addAllToList(def: ListDef, ids: readonly string[], now: number): ListDef {
  return ids.reduce((d, id) => addToList(d, id, now), def)
}

/** Subtract: remove every selected id from the list (∖). */
export function removeAllFromList(def: ListDef, ids: readonly string[], now: number): ListDef {
  return ids.reduce((d, id) => removeFromList(d, id, now), def)
}

/**
 * Intersect: keep only members that are also selected (∩) — removes each currently-resolved member
 * not in `ids`. Needs `evaluatedIds` (the list's query result) to know the live membership.
 */
export function intersectListWith(
  def: ListDef, ids: readonly string[], evaluatedIds: readonly string[], now: number,
): ListDef {
  const keep = new Set(ids)
  const drop = resolveListIds(def, evaluatedIds).filter((m) => !keep.has(m))
  return drop.reduce((d, id) => removeFromList(d, id, now), def)
}

/** This entity's lists only. */
export function listsForEntity(list: readonly ListDef[], entity: string): ListDef[] {
  return list.filter((l) => l.entity === entity)
}

/** Display order: most-recently-updated first, name as a stable tiebreak. */
export function sortLists(list: readonly ListDef[]): ListDef[] {
  return [...list].sort((a, b) => (b.updatedAt - a.updatedAt) || a.name.localeCompare(b.name))
}
