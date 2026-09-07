// Domain-free unit tests: prove the core works against a GENERIC noy-db collection (no app-specific /
// domain coupling), so this package is portable to the noy-db monorepo as-is. The app keeps
// separate integration tests against its real collections.
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { createNoydb, dict, enumOf, ref, type FieldMeta } from '@noy-db/hub'
import { toMemory } from '@noy-db/to-memory'
import { schemaFromDescribe } from './schema-from-describe'
import { joinedSchema, joinedRows, joinedKey } from './collection-source'
import { resolveField } from './resolve-field'

const TASK_STATUS = ['todo', 'doing', 'done'] as const
const TASK_PRIORITY = ['low', 'mid', 'high'] as const

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownerId: z.string(),
  ownerName: z.string(),
  status: z.enum(TASK_STATUS),
  priority: z.enum(TASK_PRIORITY),
  estimate: z.number().optional(),
})
const taskFieldMeta: Record<string, FieldMeta> = {
  title: { label: 'Title', aliases: ['name'], widget: 'text' },
  ownerId: { label: 'Owner', semanticType: 'entity', displayFor: 'ownerName', aliases: ['owner'], widget: 'select' },
  ownerName: { label: 'Owner', aliases: ['owner'], widget: 'text' },
  status: { label: 'Status', widget: 'select' },
  priority: { label: 'Priority', widget: 'select' },
  estimate: { label: 'Estimate', semanticType: 'number', aggregate: 'sum', widget: 'number' },
}

const UserSchema = z.object({ id: z.string(), name: z.string(), team: z.string() })
const userFieldMeta: Record<string, FieldMeta> = {
  name: { label: 'Name', widget: 'text' },
  team: { label: 'Team', aliases: ['squad'], widget: 'select' },
}

async function setup() {
  const db = await createNoydb({ store: toMemory(), user: 'op', secret: 'noydb-ui-core-test-secret-2026-phrase' })
  const vault = await db.openVault('v')
  const users = vault.collection('users', { schema: UserSchema, fieldMeta: userFieldMeta })
  const tasks = vault.collection('tasks', {
    schema: TaskSchema,
    refs: { ownerId: ref('users', 'warn') },
    // native via-lookup spellings: reserved dict tier + inline enum tier (no dictKey alias)
    lookupFields: {
      status: dict('taskStatus', { keys: TASK_STATUS }),
      priority: enumOf(TASK_PRIORITY),
    },
    fieldMeta: taskFieldMeta,
  })
  await users.put('u1', { id: 'u1', name: 'Ada', team: 'core' })
  await users.put('u2', { id: 'u2', name: 'Lin', team: 'web' })
  await tasks.put('t1', { id: 't1', title: 'A', ownerId: 'u1', ownerName: 'Ada', status: 'todo', priority: 'high', estimate: 3 })
  await tasks.put('t2', { id: 't2', title: 'B', ownerId: 'u2', ownerName: 'Lin', status: 'done', priority: 'low', estimate: 5 })
  return { tasks, users }
}

describe('@noy-db/ui core — schemaFromDescribe', () => {
  it('derives field types, enum order and entity pairing from describe()', async () => {
    const { tasks } = await setup()
    const schema = schemaFromDescribe('tasks', tasks.describe().fields)
    const f = (id: string) => schema.fields.find((x) => x.id === id)
    expect(f('status')).toMatchObject({ type: 'enum', enumOrder: ['todo', 'doing', 'done'] })
    // enum tier (bare enumOf): the describe() lookup block alone drives type + declared key order
    expect(f('priority')).toMatchObject({ type: 'enum', enumOrder: ['low', 'mid', 'high'] })
    expect(f('estimate')!.type).toBe('number')
    // entity pairing: ownerName is the searchable entity; the ownerId id-side is dropped
    expect(f('ownerName')!.type).toBe('entity')
    expect(f('ownerId')).toBeUndefined()
    // aliases resolve
    expect(resolveField(schema, 'name')!.id).toBe('title')
  })
})

describe('@noy-db/ui core — joins', () => {
  it('merges + flattens a ref-based join (tasks ⋈ users)', async () => {
    const { tasks, users } = await setup()
    const tasksSchema = schemaFromDescribe('tasks', tasks.describe().fields)
    const usersSchema = schemaFromDescribe('users', users.describe().fields, { enumFields: ['team'] })
    const schema = joinedSchema(tasksSchema, [
      { schema: usersSchema, rows: [], localKey: 'ownerId', fields: ['team'] },
    ])
    expect(schema.fields.find((f) => f.id === joinedKey('owner', 'team'))).toMatchObject({
      label: 'Owner · Team',
      rowKey: 'owner_team',
    })
    const rows = joinedRows(tasks.query().toArray(), [
      { schema: usersSchema, rows: users.query().toArray(), localKey: 'ownerId', fields: ['team'] },
    ]) as Array<Record<string, unknown>>
    expect(rows.find((r) => r.id === 't1')!.owner_team).toBe('core')
    expect(rows.find((r) => r.id === 't2')!.owner_team).toBe('web')
  })
})
