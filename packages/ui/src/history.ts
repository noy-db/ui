// Search history (K2) — a pure, capped, deduped ring of recent queries per module.
//
// This file is intentionally storage-agnostic and time-agnostic: it transforms plain arrays so it
// can be unit-tested without a browser. The composable (app/shared/use-search-history.ts) owns the
// localStorage I/O and the clock. Entries hold the CANONICAL serialized query string (the caller
// normalizes via parse→resolve→serialize) so dedup-by-AST collapses equivalent queries into one.
// See docs/unified-search-and-data-cube-spec.md §K.

export interface HistoryEntry {
  /** Canonical serialized query (normalized AST string). Empty/blank queries are never stored. */
  q: string
  /** Epoch ms when this query was last run. */
  at: number
}

/** Default cap on retained recent searches (a small ring — the menu shows the freshest). */
export const HISTORY_MAX = 25

/**
 * Record `q` as the most-recent search: an existing identical entry moves to the front with the new
 * timestamp (dedup by string == dedup by AST, since callers pass the canonical serialization);
 * blank queries are ignored; the list stays newest-first and capped at `max`.
 */
export function pushHistory(
  list: readonly HistoryEntry[],
  q: string,
  at: number,
  max: number = HISTORY_MAX,
): HistoryEntry[] {
  const norm = q.trim()
  if (!norm) return list.slice()
  const without = list.filter((e) => e.q !== norm)
  return [{ q: norm, at }, ...without].slice(0, Math.max(0, max))
}

/** Remove a single recent entry by its query string. No-op if absent. */
export function removeHistory(list: readonly HistoryEntry[], q: string): HistoryEntry[] {
  const norm = q.trim()
  return list.filter((e) => e.q !== norm)
}

/** Coerce arbitrary parsed JSON into a clean, ordered HistoryEntry[] (drops malformed rows). */
export function sanitizeHistory(raw: unknown, max: number = HISTORY_MAX): HistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const clean: HistoryEntry[] = []
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue
    const q = typeof (e as any).q === 'string' ? (e as any).q.trim() : ''
    const at = Number((e as any).at)
    if (!q || !Number.isFinite(at)) continue
    clean.push({ q, at })
  }
  // Sort newest-first, THEN dedup so the freshest timestamp wins for each query.
  clean.sort((a, b) => b.at - a.at)
  const out: HistoryEntry[] = []
  const seen = new Set<string>()
  for (const e of clean) {
    if (seen.has(e.q)) continue
    seen.add(e.q)
    out.push(e)
  }
  return out.slice(0, Math.max(0, max))
}

/**
 * Human "time ago" for a recent entry, EN, compact (e.g. "now", "5m", "3h", "2d", "4w").
 * Falls back to whole weeks past a month — recents rarely live longer than the cap anyway.
 */
export function relativeTime(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 45) return 'now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  return `${Math.round(d / 7)}w`
}
