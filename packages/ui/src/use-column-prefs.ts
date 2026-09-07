// Per-user column visibility preferences (R9). A persistent, personal default layered on top of the
// responsive rules: a column can be pinned 'show' (always visible) or 'hide' (always hidden), or
// left 'auto' (responsive decides). Stored per entity in localStorage so it survives reloads and
// applies to every query; per-query `show:`/`hide:` tokens still compose on top (see useAstTable,
// where force-show always wins over hide). The ColumnChooser control edits these.
import { computed, ref, watch } from 'vue'

export type ColPrefState = 'auto' | 'show' | 'hide'
interface Prefs { show: string[]; hide: string[] }

export function useColumnPrefs(entity: string) {
  const key = `nui.colprefs.${entity}`
  const load = (): Prefs => {
    try {
      const raw = globalThis.localStorage?.getItem(key)
      const p = raw ? (JSON.parse(raw) as Partial<Prefs>) : {}
      return { show: p.show ?? [], hide: p.hide ?? [] }
    } catch { return { show: [], hide: [] } }
  }
  const prefs = ref<Prefs>(load())
  watch(prefs, (p) => { try { globalThis.localStorage?.setItem(key, JSON.stringify(p)) } catch { /* ignore */ } }, { deep: true })

  const prefShow = computed(() => prefs.value.show)
  const prefHide = computed(() => prefs.value.hide)
  const hasPrefs = computed(() => prefs.value.show.length > 0 || prefs.value.hide.length > 0)
  const stateOf = (k: string): ColPrefState =>
    prefs.value.show.includes(k) ? 'show' : prefs.value.hide.includes(k) ? 'hide' : 'auto'

  /** Cycle a column's personal default: auto → show → hide → auto. */
  function cycle(k: string): void {
    const s = stateOf(k)
    const show = prefs.value.show.filter((x) => x !== k)
    const hide = prefs.value.hide.filter((x) => x !== k)
    if (s === 'auto') show.push(k)
    else if (s === 'show') hide.push(k)
    prefs.value = { show, hide }
  }
  function reset(): void { prefs.value = { show: [], hide: [] } }

  return { prefShow, prefHide, hasPrefs, stateOf, cycle, reset }
}
