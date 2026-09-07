// Barrel so the engine modules can keep importing `./schema` after moving into the package.
// The schema SHAPE + resolver; the domain SCHEMAS registry stays in the consuming app.
export type { EntitySchema, FieldDef, FieldType } from './types'
export { resolveField, ordinalRank } from './resolve-field'
