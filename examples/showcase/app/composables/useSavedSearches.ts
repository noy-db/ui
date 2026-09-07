import { ref, computed } from 'vue'
import { makeSavedSearch, sortSaved, savedForEntity, findByQuery, isValidName } from '@noy-db/ui'
import type { SavedSearch } from '@noy-db/ui'

const STORAGE_KEY = 'showcase.saved'

function load(): SavedSearch[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedSearch[]) : []
  } catch {
    return []
  }
}

function persist(list: SavedSearch[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

const _all = ref<SavedSearch[]>(load())

export function useSavedSearches(entity: string) {
  const saved = computed<SavedSearch[]>(() => sortSaved(savedForEntity(_all.value, entity)))

  function add(query: string, name: string): void {
    if (!isValidName(name) || !query.trim()) return
    // dedup: update existing if same query exists for entity
    const existing = findByQuery(_all.value, entity, query)
    if (existing) return
    const item = makeSavedSearch({ entity, name, query }, Date.now(), crypto.randomUUID())
    _all.value = [..._all.value, item]
    persist(_all.value)
  }

  function rename(id: string, name: string): void {
    if (!isValidName(name)) return
    _all.value = _all.value.map((s) =>
      s.id === id ? { ...s, name: name.trim(), updatedAt: Date.now() } : s,
    )
    persist(_all.value)
  }

  function remove(id: string): void {
    _all.value = _all.value.filter((s) => s.id !== id)
    persist(_all.value)
  }

  function toggleFavorite(id: string): void {
    _all.value = _all.value.map((s) =>
      s.id === id ? { ...s, favorite: !s.favorite, updatedAt: Date.now() } : s,
    )
    persist(_all.value)
  }

  function setDefault(id: string): void {
    _all.value = _all.value.map((s) => ({
      ...s,
      isDefault: s.id === id ? !s.isDefault : false,
      updatedAt: s.id === id ? Date.now() : s.updatedAt,
    }))
    persist(_all.value)
  }

  return { saved, add, rename, remove, toggleFavorite, setDefault }
}
