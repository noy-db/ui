import { schemaFromDescribe, fieldTypeIcon } from '@noy-db/ui'
import type { AppColumn, FieldType } from '@noy-db/ui'
import type { Vault } from '@noy-db/hub'
import { applyI18nLocale } from '@noy-db/hub/i18n'
import { NAME_I18N, NOTES_I18N } from '../../src/data/collections'
import { LANGS } from '../../src/data/vault'
import { FIELD_LABELS } from '../../src/data/dicts'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'

interface EntityConfig {
  enumFields?: string[]
  columnOverrides?: Record<string, Partial<AppColumn>>
}

const ENTITY_CONFIG: Record<string, EntityConfig> = {
  artists: {
    // genre/country are dict dimensions now — schemaFromDescribe derives their enum type
    // from describe() itself, no view-side enumFields forcing needed.
    columnOverrides: {
      genre: { filter: 'enum' },
      country: { filter: 'enum' },
      formedYear: { relevance: 50 },
    },
  },
  labels: {
    columnOverrides: {
      country: { filter: 'enum' },
      founded: { relevance: 50 },
    },
  },
}

export function buildSimpleView(vault: Vault, entity: string) {
  const { locale, fieldLabel } = useShowcaseI18n()
  const col = vault.collection(entity)
  const fields = col.describe().fields
  const config = ENTITY_CONFIG[entity] ?? {}
  // Localize schema labels (pills/suggestions/narrate) like collectionView does — the describe()
  // label survives as an alias so data-language queries still resolve.
  const schema = schemaFromDescribe(entity, fields, {
    enumFields: config.enumFields,
    labelFor: (key) => FIELD_LABELS[entity]?.[key]?.[locale.value],
  })
  // Type icon per column derived from the schema's FieldType (booleans → checkbox widget).
  const typeByKey = new Map<string, FieldType>(schema.fields.map((f) => [f.id, f.type]))
  const booleanKeys = new Set(
    fields.filter((f: any) => f.widget === 'checkbox').map((f: any) => f.key),
  )
  const columns: AppColumn[] = fields
    .filter((f: any) => f.key !== 'id')
    .map((f: any) => ({
      key: f.key,
      label: fieldLabel(entity, f.key),
      icon: booleanKeys.has(f.key) ? 'i-lucide-square-check' : fieldTypeIcon(typeByKey.get(f.key) ?? 'text'),
      sortable: true,
      ...config.columnOverrides?.[f.key],
    }))
  // Resolve EVERY i18n-declared field of the entity — labels carries notes as well as name;
  // an unresolved field would render its raw locale map as JSON in the cell.
  const I18N_FIELDS: Record<string, Record<string, typeof NAME_I18N>> = {
    artists: { name: NAME_I18N },
    labels: { name: NAME_I18N, notes: NOTES_I18N },
  }
  const i18nFields = I18N_FIELDS[entity]
  const rawRows = col.query().toArray()
  // fallback: a partially-translated field (lb5's EN-only notes) resolves to any available
  // language instead of leaking its raw locale map into the cell.
  const rows = i18nFields
    ? rawRows.map(r => applyI18nLocale(r as Record<string, unknown>, i18nFields, locale.value, LANGS))
    : rawRows
  return { schema, columns, rows }
}
