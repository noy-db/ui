// Responsive column resolution (R2/R3 of the responsive-columns plan). Pure + testable: given the
// measured container width and a force-show set (search-driven "focus" columns + explicit show:),
// decide which columns render. Columns WITHOUT a `relevance` are CORE (always shown); columns with
// a relevance show only once the container is wide enough (relevance ≥ the bucket threshold).
// Order is preserved from the input array — anchor ordering is encoded by authoring the array in
// the desired final order, so revealing/hiding never reshuffles the survivors.

export interface ResponsiveColumn { key: string; relevance?: number; stackWith?: string }

/** A width bucket: shown when containerWidth ≥ `min`; a column needs relevance ≥ `threshold`. */
export interface Bucket { name: string; min: number; threshold: number }

// rem→px at the default 16px root. xs has a HIGHER threshold than sm so the smallest screens can
// shed "shown-but-not-essential" columns (e.g. a cover thumbnail): a relevance in [80, 85) shows
// down to sm but drops at xs. md adds outstanding+country, lg adds supplier.
export const BUCKETS: readonly Bucket[] = [
  { name: 'xs', min: 0, threshold: 85 },
  { name: 'sm', min: 448, threshold: 80 },
  { name: 'md', min: 736, threshold: 55 },
  { name: 'lg', min: 992, threshold: 0 },
]

/** The active bucket for a container width = the one with the largest `min` not exceeding width. */
export function bucketFor(width: number): Bucket {
  let chosen = BUCKETS[0]!
  for (const b of BUCKETS) if (width >= b.min) chosen = b
  return chosen
}

/**
 * Filter `columns` to those that should render at `width`, preserving order. A column shows when:
 *  - it is force-shown (focus / show: token), OR
 *  - it is core (no `relevance`), OR
 *  - its relevance meets the active bucket's threshold.
 * `width = Infinity` (pre-measurement) yields the widest bucket → everything shows (no flash).
 */
export function resolveResponsiveColumns<T extends ResponsiveColumn>(
  columns: readonly T[], width: number, forceShow: ReadonlySet<string> = new Set(),
): T[] {
  const threshold = bucketFor(width).threshold
  return columns.filter((c) => forceShow.has(c.key) || c.relevance === undefined || c.relevance >= threshold)
}

/** Is the container in the narrowest bucket, where stacking (2-line cells) kicks in? (R6) */
export function shouldStack(width: number): boolean {
  return bucketFor(width).name === 'xs'
}

/**
 * Fold each host column's `stackWith` partner into it as a second line (R6). When `stacking` is on,
 * a host's partner is removed from the standalone column list and recorded in `folds` (host.key →
 * partner.key) so the caller can render it on line 2 — even if the partner was dropped by the
 * responsive pass (that's the point: stacking brings it back compactly). A partner in `hidden`
 * (explicit hide:) is NOT folded. Returns the unchanged list (empty folds) when stacking is off.
 */
export function applyStacking<T extends ResponsiveColumn>(
  visible: readonly T[], stacking: boolean,
  hidden: ReadonlySet<string> = new Set(), forceShow: ReadonlySet<string> = new Set(),
): { columns: T[]; folds: Record<string, string> } {
  if (!stacking) return { columns: [...visible], folds: {} }
  const folds: Record<string, string> = {}
  // A partner that is force-shown (focus / show: / user pin) is NOT folded — an explicit request to
  // show a column is honoured as its own standalone column even at xs (host then has no 2nd line).
  for (const c of visible) if (c.stackWith && !hidden.has(c.stackWith) && !forceShow.has(c.stackWith)) folds[c.key] = c.stackWith
  const foldedKeys = new Set(Object.values(folds))
  return { columns: visible.filter((c) => !foldedKeys.has(c.key)), folds }
}
