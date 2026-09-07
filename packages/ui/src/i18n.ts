import { useNoydbUi } from './provider'
// UI-string translation. Components call `t('list.clearAll', 'Clear all')`; if no `t` is configured,
// the English fallback is used — so the library is fully usable with zero i18n setup.
export function useNuiI18n() {
  const cfg = useNoydbUi()
  return { locale: cfg.locale ?? 'en', t: cfg.t ?? ((_k: string, fallback?: string) => fallback ?? _k) }
}
