// Found-set traversal — the FileMaker found-set contract for the item family.
// A snapshot is FROZEN at capture (spec D1) and fully derivable from its serialized
// query (spec §6 multi-tab invariant 1). Pure + framework-free.

export interface FoundSetItem {
  id: string
  /** Primary display text at capture time (frozen; does not re-localize). */
  label: string
  /** Group-by trail values, outermost first (present only when the list was grouped). */
  group?: readonly string[]
}

export interface FoundSetSnapshot {
  /** 'fixed' is reserved for the lists phase (spec P-D); all machinery reads either. */
  kind: 'query' | 'fixed'
  entity: string
  /** Serialized DSL (filter+sort+group) — the fork seed. */
  query: string
  /** narrate(ast).title at capture time. */
  title: string
  items: readonly FoundSetItem[]
  /** Unfiltered collection size (found-vs-total fraction). */
  total: number
  capturedAt: string
}

export interface TraversePosition {
  index: number
  count: number
  atFirst: boolean
  atLast: boolean
  current: FoundSetItem
  prev?: FoundSetItem
  next?: FoundSetItem
}

/** Position of `id` in the snapshot, with neighbors for destination-labelled steppers. */
export function positionOf(snap: FoundSetSnapshot, id: string): TraversePosition | null {
  const index = snap.items.findIndex((it) => it.id === id)
  if (index < 0) return null
  const count = snap.items.length
  const prev = index > 0 ? snap.items[index - 1] : undefined
  const next = index < count - 1 ? snap.items[index + 1] : undefined
  return {
    index, count, atFirst: index === 0, atLast: index === count - 1,
    current: snap.items[index]!,
    ...(prev !== undefined ? { prev } : {}),
    ...(next !== undefined ? { next } : {}),
  }
}

/** Item at a clamped index; null only for an empty set. */
export function itemAt(snap: FoundSetSnapshot, index: number): FoundSetItem | null {
  if (snap.items.length === 0) return null
  const i = Math.min(Math.max(index, 0), snap.items.length - 1)
  return snap.items[i]!
}
