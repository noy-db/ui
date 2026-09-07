// Path-shaped titles for the item family (spec D7): the detail title is a path —
// the group-by trail when the found set was grouped, else the entity's natural
// ref axis — terminating in the record title. Pure + framework-free.
import type { DescribedField } from '@noy-db/hub/introspection'
import type { FoundSetItem } from './traverse'

export interface PathSegment {
  label: string
  kind: 'group' | 'entity' | 'title'
  /** entity segments navigate to their own detail. */
  ref?: { collection: string; id: string }
}

export function pathSegments(opts: {
  item: FoundSetItem | null
  record: Record<string, unknown> | null
  fields: readonly DescribedField[]
  /** ref field keys in path order (host config, e.g. ['labelId','artistId']). */
  naturalOrder?: readonly string[]
  labelFor?: (field: string, id: string) => string | undefined
  titleLabel: string
}): PathSegment[] {
  const terminal: PathSegment = { label: opts.titleLabel, kind: 'title' }

  if (opts.item?.group?.length) {
    return [...opts.item.group.map((label): PathSegment => ({ label, kind: 'group' })), terminal]
  }

  if (opts.record && opts.naturalOrder?.length) {
    const byKey = new Map(opts.fields.map((f) => [f.key, f]))
    const segs: PathSegment[] = []
    for (const key of opts.naturalOrder) {
      const field = byKey.get(key)
      const raw = opts.record[key]
      if (!field?.ref || raw == null || raw === '') continue
      const id = String(raw)
      segs.push({ label: opts.labelFor?.(key, id) ?? id, kind: 'entity', ref: { collection: field.ref.target, id } })
    }
    return [...segs, terminal]
  }

  return [terminal]
}
