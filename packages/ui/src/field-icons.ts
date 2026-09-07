// Canonical map from the engine's coarse FieldType (derived from a noy-db collection.describe())
// to a lucide icon class. Lets a UI show a *data-type* indicator — in a column chooser, a header,
// or a field list — that comes from the schema rather than being hand-picked per field.
//
// The set is intentionally tiny and finite so a host that pre-compiles its icon CSS can safelist
// the whole thing (see @noy-db/ui-nuxt uno.config.ts → safelist). Icon class names are the one UI
// concern that already crosses the @noy-db/ui boundary (AppColumn.icon, ColDef.icon).

import type { FieldType } from './types'

export const FIELD_TYPE_ICON: Record<FieldType, string> = {
  text: 'i-lucide-type',
  number: 'i-lucide-hash',
  date: 'i-lucide-calendar',
  money: 'i-lucide-dollar-sign',
  enum: 'i-lucide-tags',
  entity: 'i-lucide-link-2',
  boolean: 'i-lucide-square-check',
}

/** Lucide icon class for a field's schema-derived data type. */
export function fieldTypeIcon(type: FieldType): string {
  return FIELD_TYPE_ICON[type]
}
