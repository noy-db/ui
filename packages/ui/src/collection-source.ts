// The smart table's data-source model: turn one noy-db collection — or a root collection joined
// to others by their declared refs — into the (schema, rows) pair the schema-driven search engine
// consumes. Because the engine became schema-injectable (schemaFromDescribe + useAstTable's
// `schema?`), a JOINED view is just a merged schema + merged rows; no engine code changes.
//
// Joins are ref-based left joins: a root row's foreign key (e.g. order.customerId) looks up the
// joined record by its `id`, and the selected joined fields are flattened onto the root row under a
// namespaced key (`customer_sector`) so they never collide with root field ids/aliases. This is the
// data-source core of @noy-db/ui's list engine.

import type { EntitySchema, FieldDef } from './types'

/** One ref-based join leg: a foreign collection pulled onto the root by a local key. */
export interface JoinLeg {
  /** The joined collection's schema (typically `schemaFromDescribe(joined.describe())`). */
  schema: EntitySchema
  /** The joined collection's rows — indexed by `id` for lookup. */
  rows: readonly Record<string, unknown>[]
  /** Root-row key holding the foreign id, e.g. 'buyerId'. */
  localKey: string
  /** Namespace prefix for the joined fields. Default: `localKey` without a trailing 'Id'. */
  as?: string
  /** Which joined field ids to surface. Default: all of the joined schema's fields. */
  fields?: readonly string[]
  /** Human label prefix. Default: capitalized `as` (e.g. 'Buyer'). */
  labelPrefix?: string
}

const nsOf = (leg: JoinLeg): string => leg.as ?? leg.localKey.replace(/Id$/, '')
/** Flattened key for a joined field: `buyer` + `sector` → `buyer_sector`. */
export const joinedKey = (ns: string, id: string): string => `${ns}_${id}`

/**
 * Merge a root schema with its join legs into one `EntitySchema`. Joined fields are namespaced
 * (`buyer_sector`), relabeled (`Buyer · Sector`), read via `rowKey`, and stripped of aliases so a
 * joined field can never hijack a root field's alias. Joined text/entity fields extend textFields.
 */
export function joinedSchema(root: EntitySchema, legs: readonly JoinLeg[]): EntitySchema {
  const fields: FieldDef[] = [...root.fields]
  const textFields: string[] = [...root.textFields]
  for (const leg of legs) {
    const ns = nsOf(leg)
    const prefix = leg.labelPrefix ?? ns.charAt(0).toUpperCase() + ns.slice(1)
    const picked = leg.fields
      ? leg.schema.fields.filter((f) => leg.fields!.includes(f.id))
      : leg.schema.fields
    for (const f of picked) {
      const id = joinedKey(ns, f.id)
      // drop aliases (collision-safety): joined fields are addressed by their namespaced id
      fields.push({ id, label: `${prefix} · ${f.label}`, type: f.type, rowKey: id, enumOrder: f.enumOrder })
      if (f.type === 'text' || f.type === 'entity') textFields.push(id)
    }
  }
  return { entity: root.entity, fields, textFields }
}

/**
 * Left-join the root rows with each leg: look up the joined record by `row[localKey] === joined.id`
 * and flatten the selected joined fields onto a copy of the root row under their namespaced keys.
 * Unmatched refs yield `null` for the joined fields. Pure; returns new row objects.
 */
export function joinedRows<T extends Record<string, unknown>>(
  rootRows: readonly T[],
  legs: readonly JoinLeg[],
): T[] {
  const prepared = legs.map((leg) => ({
    ns: nsOf(leg),
    localKey: leg.localKey,
    pick: leg.fields ?? leg.schema.fields.map((f) => f.id),
    byId: new Map(leg.rows.map((r) => [r.id as string, r])),
  }))
  return rootRows.map((row) => {
    const merged: Record<string, unknown> = { ...row }
    for (const { ns, localKey, pick, byId } of prepared) {
      const joined = byId.get(row[localKey] as string)
      for (const fid of pick) merged[joinedKey(ns, fid)] = joined?.[fid] ?? null
    }
    return merged as T
  })
}
