// Schema-driven form logic — pick the input control for a describe() field. Pure; shared by
// RecordForm (and any custom editor). Validation stays with the collection: the host calls put(),
// noy-db zod-validates, and errors flow back to the form per field.
import type { DescribedField } from '@noy-db/hub/introspection'
// StandardSchemaV1Issue deliberately stays on the bare root. It is NOT exported from
// ./introspection until hub 0.6.0-pre.9 — measured against published tarballs: absent at
// pre.8, present at pre.9 — while our declared peer floor is ^0.6.0-pre.0. Moving it would
// make that range false, and the honest repair would be narrowing the floor to pre.9, which
// compels an upgrade for every consumer on pre.0..pre.8 to satisfy import cosmetics. The
// peer-floor guard caught this on the #1021 migration; it is not a lint exception, it is the
// floor telling us where the seam actually is. Move it when the floor rises for a real reason.
import type { StandardSchemaV1Issue } from '@noy-db/hub'
import { detailFields } from './detail'

export type InputKind = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'autocomplete' | 'checkbox' | 'i18n-text'

/**
 * What an `autocomplete` control needs to ask the host for options — the matrix tier of a
 * `lookup()` field, whose membership lives in a first-class reference collection that describe()
 * deliberately does not embed. Mirrors the `DescribedField.lookup` block, narrowed to the parts a
 * widget uses: `onDelete` is a write-path rule and `backing`/`altKeys` are already spent by the
 * time this exists.
 */
export interface FieldInputLookup {
  /** The backing collection to search. */
  dimension?: string
  /** The backing-collection field holding the value that gets stored on this record. */
  key: string
  /** `open` admits a value absent from the backing collection; `closed` does not. */
  vocabulary: 'open' | 'closed'
  /** The backing-collection field to display as the option label. */
  present?: { label: string; by?: string }
  /** The backing-collection field to order suggestions by. */
  sortBy?: string
}

export interface FieldInput {
  key: string
  label: string
  kind: InputKind
  /** select options (from the field's dictionary, or host-supplied for entity/other fields). */
  options?: { value: string; label: string }[]
  /** For `autocomplete`: how the host resolves options for this field. */
  lookup?: FieldInputLookup
  /** locale codes for an i18n-text input (one text box per locale). */
  locales?: readonly string[]
  /** display unit suffix for number inputs (e.g. 'USD', 'min'). */
  unit?: string
}

/** Resolve the input control for a field, honouring its `widget`, then `semanticType`/`type`. */
export function fieldInput(field: DescribedField, extraOptions?: { value: string; label: string }[]): FieldInput {
  const options = extraOptions
    ?? field.dict?.values?.map((v) => ({ value: v.value, label: v.label ?? v.value }))
    ?? field.lookup?.keys?.map((k) => ({ value: k, label: k }))
  // Only reached when nothing above enumerated the vocabulary: a host that passed `options`, a
  // dict block, or a declared key set has already said what the choices are, and a <select> beats
  // a typeahead for a list you can show whole.
  const lk = field.lookup
  const lookup: FieldInputLookup | undefined = !options && lk?.backing === 'collection'
    ? {
        ...(lk.dimension ? { dimension: lk.dimension } : {}),
        key: lk.key,
        vocabulary: lk.vocabulary,
        ...(lk.present ? { present: lk.present } : {}),
        ...(lk.sortBy ? { sortBy: lk.sortBy } : {}),
      }
    : undefined
  const w = field.widget
  let kind: InputKind = 'text'
  if (field.i18n) kind = 'i18n-text'
  else if (options) kind = 'select'
  else if (lookup) kind = 'autocomplete'
  else if (w === 'textarea') kind = 'textarea'
  else if (w === 'checkbox' || field.type === 'boolean') kind = 'checkbox'
  else if (w === 'date' || field.semanticType === 'date' || field.semanticType === 'datetime') kind = 'date'
  else if (w === 'number' || w === 'money' || field.semanticType === 'currency' || field.semanticType === 'percent' || field.type === 'number' || field.type === 'integer') kind = 'number'
  return {
    key: field.key, label: field.label, kind, options,
    ...(lookup ? { lookup } : {}),
    ...(field.i18n?.locales ? { locales: field.i18n.locales } : {}),
    ...(kind === 'number' && field.unit ? { unit: field.unit } : {}),
  }
}

/** A client-side *hint* (never client-side validation): required mark + a compact constraint text. */
export interface FieldHint { required: boolean; text?: string }

/** Derive a hint from the async describe({}) constraints (minimum/maximum/gt/lt/minLength/maxLength/format). */
export function fieldHint(field: DescribedField): FieldHint {
  const c = (field.constraints ?? {}) as Record<string, unknown>
  // zod's .int() derives ±MAX_SAFE_INTEGER bounds — implementation noise, not a hint ("1–9007199254740991")
  const num = (v: unknown): v is number => typeof v === 'number' && Math.abs(v) < Number.MAX_SAFE_INTEGER
  const parts: string[] = []
  const lo = num(c.minimum) ? c.minimum : num(c.gt) ? c.gt : undefined
  const hi = num(c.maximum) ? c.maximum : num(c.lt) ? c.lt : undefined
  if (lo !== undefined && hi !== undefined) parts.push(`${lo}–${hi}`)
  else if (lo !== undefined) parts.push(`≥ ${lo}`)
  else if (hi !== undefined) parts.push(`≤ ${hi}`)
  if (num(c.minLength) && num(c.maxLength)) parts.push(`${c.minLength}–${c.maxLength} chars`)
  else if (num(c.minLength)) parts.push(`≥ ${c.minLength} chars`)
  else if (num(c.maxLength)) parts.push(`≤ ${c.maxLength} chars`)
  if (typeof c.format === 'string') parts.push(c.format)
  return { required: field.optional === false, ...(parts.length ? { text: parts.join(' · ') } : {}) }
}

/** Editable fields for a form: the detail fields minus computed/id/provenance (editable === false). */
export function formFields(fields: readonly DescribedField[]): DescribedField[] {
  return detailFields(fields).filter((f) => f.editable !== false)
}

/**
 * Decompose a failed `put()` into per-field error text for `RecordForm`'s `errors` prop.
 *
 * Maps both `SchemaValidationError` (carrying Standard-Schema-v1 `issues`) and `MissingTranslationError`
 * (duck-typed on `field` + `missing` array) into per-field error messages. For `issues`, we key by the
 * **first** path segment (the top-level field) and keep the first message per field. Duck-typed on
 * `issues` and `field`+`missing` so it's resilient across module realms; a non-validation error
 * (or one with no field path) yields `{}` — the host shows its generic message instead.
 */
export function fieldErrors(err: unknown): Record<string, string> {
  // i18n `required` violation: MissingTranslationError carries the offending field directly
  const mt = err as { field?: unknown; missing?: unknown; message?: unknown } | null | undefined
  if (typeof mt?.field === 'string' && mt.field && Array.isArray(mt.missing)) {
    return { [mt.field]: String(mt.message ?? 'Missing required translation') }
  }
  const issues = (err as { issues?: readonly StandardSchemaV1Issue[] } | null | undefined)?.issues
  if (!Array.isArray(issues)) return {}
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const seg = issue.path?.[0]
    const key = seg == null ? '' : typeof seg === 'object' ? String((seg as { key: PropertyKey }).key) : String(seg)
    if (key && !(key in out)) out[key] = issue.message
  }
  return out
}
