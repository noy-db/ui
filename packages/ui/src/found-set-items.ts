// Found-set item builder — the "snapshot derivable from the display" step (traverse spec §6,
// multi-tab invariant 1). Converts a list's rendered order into the frozen `FoundSetItem[]` a
// snapshot carries: the grouped line list (carrying the group-by trail per row) when the list was
// grouped, else the flat visible rows. Shared by the list's capture-on-click AND a forked/cold
// tab's rebuild-from-`?q=`, so both tabs derive an identical order + grouping from the same query.
// Pure + framework-free.
import type { DisplayLine } from './use-collection-list'
import type { FoundSetItem } from './traverse'

export interface FoundSetItemsOptions<T> {
  /** Row → id. Default: `String(row.id)`. */
  idOf?: (row: T) => string
  /** Row → frozen display label. Default: `row.title ?? row.name ?? row.id`. */
  labelOf?: (row: T) => string
}

/**
 * Build ordered `FoundSetItem[]` from a list display. When `lines` is non-empty the group-by trail
 * (outermost first) is attached to each row; otherwise the flat `rows` are used. Order is exactly
 * the rendered order.
 */
export function foundSetItems<T extends Record<string, unknown>>(
  source: { lines?: readonly DisplayLine<T>[]; rows?: readonly T[] },
  opts: FoundSetItemsOptions<T> = {},
): FoundSetItem[] {
  const idOf = opts.idOf ?? ((r: T) => String((r as { id?: unknown }).id))
  const labelOf = opts.labelOf ?? ((r: T) => {
    const rec = r as { title?: unknown; name?: unknown; id?: unknown }
    return String(rec.title ?? rec.name ?? rec.id)
  })
  const lines = source.lines ?? []
  if (lines.length > 0) {
    const trail: string[] = []
    const items: FoundSetItem[] = []
    for (const line of lines) {
      if (line.kind === 'group') { trail.length = line.level; trail[line.level] = line.label }
      else items.push({ id: idOf(line.row), label: labelOf(line.row), group: [...trail] })
    }
    return items
  }
  return (source.rows ?? []).map((r) => ({ id: idOf(r), label: labelOf(r) }))
}
