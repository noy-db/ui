import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { pushHistory, removeHistory, sanitizeHistory } from '@noy-db/ui'
import type { HistoryEntry } from '@noy-db/ui'

const STORAGE_KEY = 'showcase.recent'

function load(): HistoryEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return sanitizeHistory(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return []
  }
}

function persist(list: HistoryEntry[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

const _entries = ref<HistoryEntry[]>(load())

export function useRecentSearches(query: Ref<string>) {
  const recents = computed<HistoryEntry[]>(() => _entries.value)

  // Record query whenever it changes to a non-empty value
  watch(query, (q) => {
    const canonical = q.trim()
    if (!canonical) return
    _entries.value = pushHistory(_entries.value, canonical, Date.now())
    persist(_entries.value)
  })

  function record(q: string): void {
    const canonical = q.trim()
    if (!canonical) return
    _entries.value = pushHistory(_entries.value, canonical, Date.now())
    persist(_entries.value)
  }

  function remove(q: string): void {
    _entries.value = removeHistory(_entries.value, q)
    persist(_entries.value)
  }

  function clear(): void {
    _entries.value = []
    persist(_entries.value)
  }

  return { recents, record, remove, clear }
}
