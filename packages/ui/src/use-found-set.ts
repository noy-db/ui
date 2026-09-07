// Per-entity found-set session store (module-level, saved-searches pattern).
// PER-TAB BY CONSTRUCTION (spec §6 invariant 2): a new browser tab is a new module
// graph — never assume another tab shares this state. The snapshot's `query` string
// is the cross-tab seed (invariant 1); URL seeding lands in P-C.
import { ref, type Ref } from 'vue'
import type { FoundSetSnapshot } from './traverse'

const snapshots = new Map<string, Ref<FoundSetSnapshot | null>>()
const anchors = new Map<string, { query: string; id: string }>()
const directions = new Map<string, 1 | -1>()

/** Traversal direction memory — survives the page remount that router.replace causes,
 *  so the missing-record skip continues in the direction the user was travelling. */
export function rememberDirection(entity: string, dir: 1 | -1): void { directions.set(entity, dir) }
export function recallDirection(entity: string): 1 | -1 { return directions.get(entity) ?? 1 }

function refFor(entity: string): Ref<FoundSetSnapshot | null> {
  let r = snapshots.get(entity)
  if (!r) { r = ref(null); snapshots.set(entity, r) }
  return r
}

/** List row-click: freeze the current display order as the traversable found set. */
export function captureFoundSet(snap: FoundSetSnapshot): void { refFor(snap.entity).value = snap }

export function useFoundSet(entity: string): { snapshot: Ref<FoundSetSnapshot | null>; clear: () => void } {
  const r = refFor(entity)
  return { snapshot: r, clear: () => { r.value = null } }
}

/** Detail "back": where the list should restore to (query + row to anchor). */
export function setReturnAnchor(entity: string, anchor: { query: string; id: string }): void { anchors.set(entity, anchor) }

/** List mount: one-shot read of the return anchor. */
export function consumeReturnAnchor(entity: string): { query: string; id: string } | null {
  const a = anchors.get(entity) ?? null
  anchors.delete(entity)
  return a
}
