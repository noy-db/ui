import { schemaFromDescribe, joinedSchema, joinedRows, fieldTypeIcon, FIELD_TYPE_ICON, archetypeForFieldType, WIDTH_ARCHETYPES } from '@noy-db/ui'
import type { AppColumn, JoinLeg, FieldType } from '@noy-db/ui'
import type { Vault } from '@noy-db/hub'
import { applyI18nLocale } from '@noy-db/hub/i18n'
import { COVER_FIELD } from '../../src/data/vault'
import { NAME_I18N, TITLE_I18N } from '../../src/data/collections'
import { FIELD_LABELS } from '../../src/data/dicts'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'

/**
 * Build the joined schema, column definitions, and joined rows for the records list.
 * Caller must have called .list() on all three collections before invoking this.
 * Joined keys: artist_name = joinedKey('artist', 'name'), label_name = joinedKey('label', 'name').
 * Column labels are localized via useShowcaseI18n (reactive — re-runs on locale change).
 * Enum values in rows are kept CANONICAL (raw keys like 'rock') so the engine can
 * filter/facet/sort correctly. Display localization happens in cell slots.
 */
export function buildRecordsView(vault: Vault) {
  const { locale, fieldLabel } = useShowcaseI18n()
  const loc = locale.value

  const records = vault.collection('records')
  const artists = vault.collection('artists')
  const labels = vault.collection('labels')

  // Field labels in the QUERY language (pills, suggestions, group menu, narrate) come from the
  // schema; noy-db's describe() labels are single-language by design, so localize them here via
  // the same dictionary the columns use (schemaFromDescribe keeps the describe() label as an
  // alias, so `genre:` typed in the data language still resolves).
  const labelFor = (entity: string) => (key: string) => FIELD_LABELS[entity]?.[key]?.[loc]
  const base = schemaFromDescribe('records', records.describe().fields, {
    enumFields: ['genre', 'format', 'condition'],
    labelFor: labelFor('records'),
  })
  const artistsSchema = schemaFromDescribe('artists', artists.describe().fields, { labelFor: labelFor('artists') })
  const labelsSchema = schemaFromDescribe('labels', labels.describe().fields, { labelFor: labelFor('labels') })

  const applyName  = (r: Record<string, unknown>) => applyI18nLocale(r, { name: NAME_I18N }, loc)
  const applyTitle = (r: Record<string, unknown>) => applyI18nLocale(r, { title: TITLE_I18N }, loc)

  const artistRows = artists.query().toArray().map(applyName) as Record<string, unknown>[]
  const labelRows  = labels.query().toArray().map(applyName) as Record<string, unknown>[]

  const legs: JoinLeg[] = [
    { schema: artistsSchema, rows: artistRows, localKey: 'artistId', fields: ['name'], as: 'artist' },
    { schema: labelsSchema,  rows: labelRows,  localKey: 'labelId',  fields: ['name'], as: 'label'  },
  ]

  // Entity FK → display name. Grouping by an entity field (Artist/Label) banners the canonical
  // value, which for an FK is the raw id; resolve it to the (localized) joined name instead.
  const entityNames: Record<string, Map<string, string>> = {
    artistId: new Map(artistRows.map((r) => [r.id as string, r.name as string])),
    labelId:  new Map(labelRows.map((r) => [r.id as string, r.name as string])),
  }
  const entityName = (field: string, value: string): string | undefined => entityNames[field]?.get(value)

  const schema = joinedSchema(base, legs)
  // The joined display fields get generic "Artist · Name" labels; they ARE the artist/label of a
  // record, so relabel them to the FK's own label — sort/group suggestions, pills and the fluent
  // search title then read "Artist"/"Label" instead of "Artist · Name".
  const JOIN_LABEL: Record<string, string> = {
    artist_name: fieldLabel('records', 'artistId'),
    label_name: fieldLabel('records', 'labelId'),
  }
  for (const f of schema.fields) {
    const l = JOIN_LABEL[f.id]
    if (!l) continue
    // Relabel + alias: the alias makes a typed "Artist:" bind HERE (name substring match), not to
    // the FK field that shares the label (id equality) — resolveField prefers aliases over labels.
    ;(f as { label: string }).label = l
    ;(f as { aliases?: readonly string[] }).aliases = [l]
  }
  const rows = joinedRows(
    records.query().toArray().map(applyTitle) as Record<string, unknown>[],
    legs,
  )

  // Column type icons come from the noy-db schema (describe() → engine FieldType), so every column
  // shows a data-type indicator instead of a hand-picked glyph. A few keys aren't plain schema
  // fields: the cover blob, the two entity-display joins (rendered from the *name*, but they ARE the
  // artistId/labelId entity refs), and booleans (the engine has no boolean FieldType — detect them
  // from the schema's checkbox widget).
  const typeByKey = new Map<string, FieldType>(schema.fields.map((f) => [f.id, f.type]))
  const booleanKeys = new Set(
    records.describe().fields.filter((f) => f.widget === 'checkbox').map((f) => f.key),
  )
  const ICON_OVERRIDE: Record<string, string> = {
    [COVER_FIELD]: 'i-lucide-image',
    artist_name: FIELD_TYPE_ICON.entity,
    label_name: FIELD_TYPE_ICON.entity,
  }
  const iconOf = (key: string): string =>
    ICON_OVERRIDE[key]
    ?? (booleanKeys.has(key) ? 'i-lucide-square-check' : fieldTypeIcon(typeByKey.get(key) ?? 'text'))

  // Second-header summaries: each column gets a short, informative aggregate (see columnAggregate).
  // FKs → distinct count; year → range; numeric columns → min‹mid›max stats; dates → year span;
  // boolean → count of trues. Genre keeps its enum breakdown (supplied via subtotalEnums upstream).
  const int = (n: number) => String(Math.round(n))
  const oneDp = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1))

  const columns: AppColumn[] = [
    // Cover is nice-to-have, not essential: relevance 80 keeps it on sm+ but drops it at xs (the
    // very smallest screens), where the row identity is carried by title + artist.
    { key: COVER_FIELD, label: '', icon: iconOf(COVER_FIELD),       class: 'nui-col-cover', relevance: 80 },
    { key: 'title',      label: fieldLabel('records', 'title'),     icon: iconOf('title'),          sortable: true },
    {
      key: 'artist_name', field: 'artistId', label: fieldLabel('records', 'artistId'), icon: iconOf('artist_name'),
      sortable: true, filter: 'enum',
      aggregate: 'distinct', aggregateNoun: 'artists', enumOf: (r) => r.artistId as string,
    },
    {
      key: 'label_name',  field: 'labelId', label: fieldLabel('records', 'labelId'),  icon: iconOf('label_name'),
      sortable: true, filter: 'enum', relevance: 60,
      aggregate: 'distinct', aggregateNoun: 'labels', enumOf: (r) => r.labelId as string,
    },
    {
      key: 'year',        label: fieldLabel('records', 'year'),     icon: iconOf('year'),
      sortable: true, align: 'right', relevance: 70,
      aggregate: 'range', amountOf: (r) => r.year as number,
      // Compact year span: same century → "1986–99", else full "1899–1901".
      formatRange: (lo, hi) =>
        Math.floor(lo / 100) === Math.floor(hi / 100) ? `${lo}–${String(hi).slice(-2)}` : `${lo}–${hi}`,
    },
    {
      key: 'genre',       label: fieldLabel('records', 'genre'),    icon: iconOf('genre'),
      sortable: true, filter: 'enum', relevance: 65,
      aggregate: 'distinct', aggregateNoun: 'genres',
    },
    {
      key: 'format',      label: fieldLabel('records', 'format'),   icon: iconOf('format'),
      sortable: true, filter: 'enum', relevance: 50,
      aggregate: 'distinct', aggregateNoun: 'formats',
    },
    {
      key: 'condition',   label: fieldLabel('records', 'condition'), icon: iconOf('condition'),
      sortable: true, filter: 'enum', relevance: 45,
      aggregate: 'distinct', aggregateNoun: 'grades',
    },
    {
      key: 'rating',
      label: fieldLabel('records', 'rating'),
      icon: iconOf('rating'),
      headerSym: '★', headerSymOnly: true,
      sortable: true,
      align: 'right',
      relevance: 55,
      stackWith: 'condition',
      aggregate: 'avg', formatNum: oneDp, amountOf: (r) => r.rating as number,
    },
    {
      key: 'durationMin', label: fieldLabel('records', 'durationMin'), icon: iconOf('durationMin'),
      headerSym: 'min',
      sortable: true, align: 'right', relevance: 35,
      aggregate: 'range', formatNum: int, amountOf: (r) => r.durationMin as number,
    },
    {
      key: 'trackCount',  label: fieldLabel('records', 'trackCount'),  icon: iconOf('trackCount'),
      sortable: true, align: 'right', relevance: 30,
      aggregate: 'range', formatNum: int, amountOf: (r) => r.trackCount as number,
    },
    {
      key: 'priceUsd',
      label: fieldLabel('records', 'priceUsd'),
      headerSym: '$',
      icon: iconOf('priceUsd'),
      sortable: true,
      align: 'right',
      aggregate: 'range', formatNum: (n: number) => String(Math.round(n)),
      amountOf: (r) => r.priceUsd as number,
      relevance: 75,
    },
    {
      key: 'purchasedOn', label: fieldLabel('records', 'purchasedOn'), icon: iconOf('purchasedOn'),
      sortable: true, filter: 'date', relevance: 40,
      aggregate: 'range', dateOf: (r) => r.purchasedOn as string,
    },
    {
      key: 'favorite',    label: fieldLabel('records', 'favorite'),    icon: iconOf('favorite'),
      headerSym: '♥', headerSymOnly: true, align: 'right',
      sortable: true, relevance: 25,
      aggregate: 'boolTrue', boolOf: (r) => Boolean(r.favorite),
    },
  ]

  // Width archetype (min px + flex) per column — from the schema FieldType, same as the type icons,
  // with content overrides: cover is a thumbnail, the star/checkbox/track cells are tiny, and the
  // entity-display joins size like entities (their underlying name field reads as text).
  const A = WIDTH_ARCHETYPES
  const WIDTH_OVERRIDE: Record<string, { minWidth: number; idealWidth: number; flex: number }> = {
    [COVER_FIELD]: { minWidth: A.blob.min,    idealWidth: A.blob.ideal,    flex: A.blob.flex },
    // Year shows a 4-digit value; the range rollup is compacted ("1986–99") — size to fit that.
    year:          { minWidth: 78,            idealWidth: 92,              flex: 0 },
    // BOTH min and ideal must clear the HEADER, not just the data: a column is shown with a readable
    // header or dropped (by relevance) — it never compresses to a mid-word "Durati…". Ideal = roomy,
    // min = the smallest the header still reads at.
    durationMin:   { minWidth: 114,           idealWidth: 124,             flex: 0 }, // "Duration min"
    artist_name:   { minWidth: A.entity.min,  idealWidth: A.entity.ideal,  flex: A.entity.flex },
    label_name:    { minWidth: A.entity.min,  idealWidth: A.entity.ideal,  flex: A.entity.flex },
    format:        { minWidth: 82,            idealWidth: A.enum.ideal,    flex: A.enum.flex },     // "Format"
    condition:     { minWidth: 96,            idealWidth: A.enum.ideal,    flex: A.enum.flex },     // "Condition"
    purchasedOn:   { minWidth: 100,           idealWidth: 116,             flex: 0 },                // "Purchased"
    // Rating header is just "★"; ideal ≥ 88 so a wide table can show full stars (else the bare number).
    rating:        { minWidth: 56,            idealWidth: 92,              flex: 0 },
    trackCount:    { minWidth: 80,            idealWidth: 88,              flex: 0 },                // "Tracks"
    priceUsd:      { minWidth: 80,            idealWidth: 88,              flex: 0 },                // "Price $"
    favorite:      { minWidth: A.tinyNum.min, idealWidth: A.tinyNum.ideal, flex: A.tinyNum.flex },
  }
  for (const c of columns) {
    const o = WIDTH_OVERRIDE[c.key]
    if (o) { c.minWidth = o.minWidth; c.idealWidth = o.idealWidth; c.flex = o.flex; continue }
    const a = A[archetypeForFieldType(typeByKey.get(c.key) ?? 'text')]
    c.minWidth = a.min; c.idealWidth = a.ideal; c.flex = a.flex
  }

  return { schema, columns, rows, entityName }
}
