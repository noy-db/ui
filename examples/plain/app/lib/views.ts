// The plain fork's view derivation: describe() → engine schema → generic columns.
// Same data path as the showcase (schemaFromDescribe + artist/label joins), none of its
// presentation machinery — no width archetypes, no type icons, no aggregates, no relevance
// tiers, no i18n label dictionaries. Locale is fixed to 'en' for display; the detail page
// still shows every locale of i18n fields (raw rows).
import { schemaFromDescribe, joinedSchema, joinedRows } from '@noy-db/ui'
import type { AppColumn, EntitySchema, FieldType, SortKey } from '@noy-db/ui'
import type { Vault } from '@noy-db/hub'
import { applyI18nLocale } from '@noy-db/hub/i18n'
import { NAME_I18N, TITLE_I18N } from '../../src/data/collections'

export const COLLECTIONS = [
  { name: 'records', label: 'Records', icon: 'i-lucide-disc-3' },
  { name: 'artists', label: 'Artists', icon: 'i-lucide-users' },
  { name: 'labels', label: 'Labels', icon: 'i-lucide-tag' },
] as const
export type CollectionName = (typeof COLLECTIONS)[number]['name']

const LOC = 'en'
const ENUM_FIELDS: Record<CollectionName, string[]> = {
  records: ['genre', 'format', 'condition'],
  artists: ['genre'],
  labels: [],
}
const DEFAULT_SORT: Record<CollectionName, SortKey[]> = {
  records: [{ field: 'title', dir: 'asc' }],
  artists: [{ field: 'name', dir: 'asc' }],
  labels: [{ field: 'name', dir: 'asc' }],
}
// Hidden in LIST columns only (the detail page shows the full record): blobs and raw FK ids
// (records shows the joined artist/label names instead).
const LIST_SKIP: Record<CollectionName, string[]> = {
  records: ['cover', 'artistId', 'labelId'],
  artists: [],
  labels: [],
}

const RIGHT_ALIGNED: FieldType[] = ['number', 'money']

// Identity fields first, long text last; anything not listed keeps describe() order in between.
const FIELD_ORDER: Record<CollectionName, string[]> = {
  records: ['title', 'artist_name', 'label_name', 'year', 'genre', 'format', 'condition', 'rating', 'durationMin', 'trackCount', 'priceUsd', 'purchasedOn', 'favorite', 'notes'],
  artists: ['name', 'country', 'formedYear', 'genre'],
  labels: ['name', 'country', 'founded', 'notes'],
}

function columnsFrom(schema: EntitySchema, skip: readonly string[], order: readonly string[]): AppColumn[] {
  const rank = (id: string) => {
    const i = order.indexOf(id)
    return i === -1 ? order.length : i
  }
  return schema.fields
    .filter((f) => !skip.includes(f.id))
    .toSorted((a, b) => rank(a.id) - rank(b.id))
    .map((f) => ({
      key: f.rowKey ?? f.id,
      field: f.id,
      label: f.label,
      sortable: true,
      align: RIGHT_ALIGNED.includes(f.type) ? ('right' as const) : undefined,
    }))
}

export function buildView(vault: Vault, name: CollectionName) {
  const col = vault.collection(name)
  const described = col.describe().fields
  const base = schemaFromDescribe(name, described, { enumFields: ENUM_FIELDS[name] })
  const localizeName = (r: Record<string, unknown>) => applyI18nLocale(r, { name: NAME_I18N }, LOC)

  if (name !== 'records') {
    const rows = col.query().toArray().map(localizeName) as Record<string, any>[]
    return { schema: base, columns: columnsFrom(base, LIST_SKIP[name], FIELD_ORDER[name]), rows, defaultSort: DEFAULT_SORT[name] }
  }

  // records: join the artist/label display names so the list carries the same data as ui-suai
  const artists = vault.collection('artists')
  const labels = vault.collection('labels')
  const artistsSchema = schemaFromDescribe('artists', artists.describe().fields, {})
  const labelsSchema = schemaFromDescribe('labels', labels.describe().fields, {})
  const artistRows = artists.query().toArray().map(localizeName) as Record<string, any>[]
  const labelRows = labels.query().toArray().map(localizeName) as Record<string, any>[]
  const legs = [
    { schema: artistsSchema, rows: artistRows, localKey: 'artistId', fields: ['name'] as const, as: 'artist' },
    { schema: labelsSchema, rows: labelRows, localKey: 'labelId', fields: ['name'] as const, as: 'label' },
  ]
  const schema = joinedSchema(base, legs)
  // The joined display fields get generic "Artist · Name" labels; they ARE the record's
  // artist/label, so relabel to the FK's own label (same move as the showcase).
  for (const f of schema.fields) {
    if (f.id === 'artist_name') (f as { label: string }).label = 'Artist'
    if (f.id === 'label_name') (f as { label: string }).label = 'Label'
  }
  const rows = joinedRows(
    col.query().toArray().map((r) => applyI18nLocale(r, { title: TITLE_I18N }, LOC)) as Record<string, any>[],
    legs,
  )
  return { schema, columns: columnsFrom(schema, LIST_SKIP.records, FIELD_ORDER.records), rows, defaultSort: DEFAULT_SORT.records }
}

/** Entity display options for the detail page: FK field → { value: id, label: name } list. */
export function entityOptions(vault: Vault): Record<string, { value: string; label: string }[]> {
  const nameOf = (r: Record<string, unknown>) =>
    String((applyI18nLocale(r, { name: NAME_I18N }, LOC) as Record<string, unknown>).name)
  const opts = (colName: string) =>
    vault.collection(colName).query().toArray().map((r) => ({ value: String(r.id), label: nameOf(r) }))
  return { artistId: opts('artists'), labelId: opts('labels') }
}
