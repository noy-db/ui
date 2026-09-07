// Detail-view value formatting — the Item-family counterpart to the table's column derivation.
// Turns a `describe()` field + a record into a display cell: formatted value, entity link, PII mask.
// Pure + framework-free, so RecordDetail (and an export/print view) share it.
import type { DescribedField } from '@noy-db/hub/introspection'

export interface DetailCell {
  key: string
  label: string
  /** Human-ready display string ('—' when empty, '••••••' when masked). */
  display: string
  /** Direct link target (url / mailto). */
  href?: string
  /** Entity reference → the host turns this into a route via `routeFor(collection, id)`. */
  ref?: { collection: string; id: string }
  /** Per-locale entries when the field is i18n-declared and the record was read with { locale: 'raw' }. */
  i18n?: { locale: string; display: string; missing: boolean }[]
  masked: boolean
  empty: boolean
}

const MASK = '••••••'

/** Only http(s) values become links — zod's .url() does not block javascript:/data: schemes. */
function safeHref(raw: unknown): string | undefined {
  try {
    const u = new URL(String(raw))
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined
  } catch { return undefined }
}

/** Format one field of a record for display, honouring semanticType, enum labels, refs and PII. */
export function formatDetailCell(
  field: DescribedField,
  record: Record<string, unknown>,
  opts: {
    reveal?: boolean
    /** Host-supplied `{ value, label }` list for THIS field (same shape as the form's select
     *  options) — resolves enum codes and bare entity ids to display labels in read mode. */
    options?: readonly { value: string; label: string }[]
  } = {},
): DetailCell {
  const { key, label } = field
  const raw = record[key]
  const empty = raw == null || raw === ''
  if (empty) return { key, label, display: '—', masked: false, empty: true }

  const sensitive = field.sensitivity === 'pii' || field.sensitivity === 'secret'
  if (sensitive && !opts.reveal) return { key, label, display: MASK, masked: true, empty: false }

  // i18n locale map (host read with { locale: 'raw' }) → per-locale entries
  if (field.i18n && typeof raw === 'object' && !Array.isArray(raw)) {
    const map = raw as Record<string, unknown>
    const locales = field.i18n.locales ?? Object.keys(map)
    const entries = locales.map((locale) => {
      const v = map[locale]
      const missing = v == null || v === ''
      return { locale, display: missing ? '—' : String(v), missing }
    })
    const first = entries.find((e) => !e.missing)
    if (!first) return { key, label, display: '—', masked: false, empty: true }
    return { key, label, display: first.display, i18n: entries, masked: false, empty: false }
  }

  // entity pairing: the id field carries ref + displayFor → show the human name, link to the record
  if (field.displayFor && field.ref) {
    return {
      key, label, masked: false, empty: false,
      display: String(record[field.displayFor] ?? raw),
      ref: { collection: field.ref.target, id: String(raw) },
    }
  }

  // bare entity reference (no display pairing) → still a link; the name comes from host options
  if (field.ref) {
    return {
      key, label, masked: false, empty: false,
      display: opts.options?.find((o) => o.value === raw)?.label ?? String(raw),
      ref: { collection: field.ref.target, id: String(raw) },
    }
  }

  switch (field.semanticType) {
    case 'currency': return { key, label, display: `${raw}${field.unit ? ` ${field.unit}` : ''}`, masked: false, empty: false }
    case 'percent': return { key, label, display: `${raw}%`, masked: false, empty: false }
    case 'url': return { key, label, display: String(raw), ...(safeHref(raw) !== undefined ? { href: safeHref(raw) } : {}), masked: false, empty: false }
    case 'email': return { key, label, display: String(raw), href: `mailto:${raw}`, masked: false, empty: false }
  }
  // enum (dict/lookup-declared) → label precedence: the hub-dressed `<key>Label` sibling (a
  // { locale } read resolved it at the call's locale) › host options (active app locale) › the
  // dictionary's declared-locale label › the raw code
  if (field.dict || field.lookup) {
    const dressed = record[`${key}Label`]
    const display =
      (typeof dressed === 'string' && dressed !== '' ? dressed : undefined)
      ?? opts.options?.find((o) => o.value === raw)?.label
      ?? field.dict?.values?.find((v) => v.value === raw)?.label
      ?? String(raw)
    return { key, label, display, masked: false, empty: false }
  }
  return { key, label, display: String(raw), masked: false, empty: false }
}

/** The fields a detail view should render: drop ids/audit internals and the display-target names
 *  (those surface via their id field as a link). The host groups them into cards (view choice). */
export function detailFields(fields: readonly DescribedField[]): DescribedField[] {
  const displayTargets = new Set(fields.map((f) => f.displayFor).filter(Boolean) as string[])
  const HIDE = new Set(['id', 'deletedAt'])
  return fields.filter((f) => !displayTargets.has(f.key) && !HIDE.has(f.key) && !f.key.startsWith('_'))
}
