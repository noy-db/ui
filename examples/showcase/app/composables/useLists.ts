import { ref, computed } from 'vue'
import {
  makeList, sortLists, listsForEntity, addToList, removeFromList, isValidListName,
  addAllToList, removeAllFromList, type ListDef,
} from '@noy-db/ui'

// P-D lists persistence. Lists are DATA (vault-encrypted/syncable is the endgame) — but the
// showcase vault is session-only (D3), so here they live in localStorage, exactly like saved
// searches. The @noy-db/ui algebra is storage-agnostic; only this seam is showcase-specific.
const STORAGE_KEY = 'showcase.lists'

function load(): ListDef[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ListDef[]) : []
  } catch {
    return []
  }
}

function persist(list: ListDef[]): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch { /* quota */ }
}

const _all = ref<ListDef[]>(load())
// The currently-viewed list id, shared at module scope so it survives SPA navigation (a detail
// round-trip must return to the list view, not the bare query) — same pattern as the found-set store.
const _activeId = ref<string | null>(null)

export function useLists(entity: string) {
  const lists = computed<ListDef[]>(() => sortLists(listsForEntity(_all.value, entity)))
  const activeId = _activeId

  function byId(id: string): ListDef | undefined {
    return _all.value.find((l) => l.id === id)
  }
  function upsert(def: ListDef): void {
    _all.value = _all.value.some((l) => l.id === def.id)
      ? _all.value.map((l) => (l.id === def.id ? def : l))
      : [..._all.value, def]
    persist(_all.value)
  }
  function create(name: string, opts: { query?: string } = {}): ListDef | null {
    if (!isValidListName(name)) return null
    const def = makeList({ entity, name, query: opts.query }, Date.now(), crypto.randomUUID())
    upsert(def)
    return def
  }
  function remove(id: string): void {
    _all.value = _all.value.filter((l) => l.id !== id)
    persist(_all.value)
  }
  function addItem(id: string, itemId: string): void {
    const l = byId(id)
    if (l) upsert(addToList(l, itemId, Date.now()))
  }
  function removeItem(id: string, itemId: string): void {
    const l = byId(id)
    if (l) upsert(removeFromList(l, itemId, Date.now()))
  }
  // P-E bulk set algebra: fold a whole selection into a list.
  function union(id: string, ids: readonly string[]): void {
    const l = byId(id)
    if (l) upsert(addAllToList(l, ids, Date.now()))
  }
  function subtract(id: string, ids: readonly string[]): void {
    const l = byId(id)
    if (l) upsert(removeAllFromList(l, ids, Date.now()))
  }
  function createFromSelection(name: string, ids: readonly string[]): ListDef | null {
    if (!isValidListName(name)) return null
    const def = makeList({ entity, name, patch: [...ids] }, Date.now(), crypto.randomUUID())
    upsert(def)
    return def
  }

  return { lists, activeId, byId, create, remove, addItem, removeItem, union, subtract, createFromSelection }
}
