// Card grouping for the Item family — turns describe()'s group/order metadata into ordered
// card sections. Pure + framework-free; RecordDetail (and the form views) share it.
import type { DescribedField } from '@noy-db/hub/introspection'

export interface FieldGroup {
  /** The raw group id from field.group ('_default' for the ungrouped bucket). */
  id: string
  /** Localized title: t(`nui.detail.group.${id}`, id); default bucket uses t('nui.detail.details', 'Details'). */
  title: string
  fields: DescribedField[]
}

const DEFAULT_ID = '_default'

/** Group fields into ordered card sections. Groups sort by their minimum member `order`
 *  (groups with no ordered member sink last, the default bucket very last); fields inside
 *  a group sort by `order` (missing → last, stable). */
export function groupFields(
  fields: readonly DescribedField[],
  t: (key: string, fallback: string) => string = (_k, fb) => fb,
): FieldGroup[] {
  const buckets = new Map<string, DescribedField[]>()
  for (const field of fields) {
    const id = field.group ?? DEFAULT_ID
    const bucket = buckets.get(id)
    if (bucket) bucket.push(field)
    else buckets.set(id, [field])
  }

  const rank = (id: string, members: DescribedField[]): number => {
    if (id === DEFAULT_ID) return Number.POSITIVE_INFINITY
    const orders = members.map((f) => f.order).filter((o): o is number => o !== undefined)
    return orders.length ? Math.min(...orders) : Number.MAX_SAFE_INTEGER
  }

  return [...buckets.entries()]
    .sort((a, b) => rank(a[0], a[1]) - rank(b[0], b[1]))
    .map(([id, members]) => ({
      id,
      title: id === DEFAULT_ID ? t('nui.detail.details', 'Details') : t(`nui.detail.group.${id}`, id),
      fields: members
        .map((f, i) => ({ f, i }))
        .sort((a, b) => (a.f.order ?? Number.MAX_SAFE_INTEGER) - (b.f.order ?? Number.MAX_SAFE_INTEGER) || a.i - b.i)
        .map((x) => x.f),
    }))
}
