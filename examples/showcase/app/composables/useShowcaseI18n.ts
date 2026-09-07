import { ref } from 'vue'
import { GENRE_LABELS, FORMAT_LABELS, CONDITION_LABELS, COUNTRY_LABELS, FIELD_LABELS } from '../../src/data/dicts'
import { MESSAGES } from '../i18n/messages'

const DICTS: Record<string, Record<string, { en: string; th: string }>> = {
  genre: GENRE_LABELS,
  format: FORMAT_LABELS,
  condition: CONDITION_LABELS,
  country: COUNTRY_LABELS,
}

const locale = ref<'en' | 'th'>('en')

export function useShowcaseI18n() {
  const setLocale = (l: 'en' | 'th') => { locale.value = l }
  const t = (key: string, fallback = key) => MESSAGES[locale.value][key] ?? fallback
  const enumLabel = (field: string, value: string) => DICTS[field]?.[value]?.[locale.value] ?? value
  const fieldLabel = (entity: string, key: string) => FIELD_LABELS[entity]?.[key]?.[locale.value] ?? key
  return { locale, setLocale, t, enumLabel, fieldLabel }
}
