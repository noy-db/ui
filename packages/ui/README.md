# `@noy-db/ui`

Framework-agnostic **base** of the noy-db UI family. Pure TypeScript + CSS, no framework binding.

It holds the two portable layers every binding (`@noy-db/ui-nuxt`, future `@noy-db/ui-next`, …) imports:

- **Engine** (`.`) — the schema-driven search/list logic: the query AST (tokenize → parse → resolve →
  evaluate → group/summary/pills), `schemaFromDescribe` + cross-collection joins, the `detail`/`form`
  field resolvers, column model, formatting/aggregation, and the `useCollectionList` composable. All
  domain-free — it consumes a collection's `describe()` metadata, never hard-coded fields.
- **Design tokens** (`./tokens.css`) — the `--nui-*` CSS variables + light/dark themes. A consuming app
  overrides any of them on `:root`.

```ts
import { useCollectionList, schemaFromDescribe, parse, resolve } from '@noy-db/ui'
import '@noy-db/ui/tokens.css'
```

A framework binding adds the components on top; this package never renders anything itself.

## Sensitive fields

A field whose `fieldMeta` marks `sensitivity: 'pii' | 'secret'` is masked by everything the engine
produces: detail and history cells show `••••••`, and `schemaFromDescribe` flags it so search never
reads its values — no filter, sort, group, facet, suggestion, free-text match or NL prompt. Pass
`schemaFromDescribe(…, { reveal: true })` (and `reveal` to the detail/history formatters) for a
viewer allowed to see them.

**The engine masks what it renders; your own columns are yours.** List cells come from the
`AppColumn[]` and rows the host builds, so a column on a sensitive field shows the raw value unless
the host leaves it out or masks it. Likewise `exclude` only removes a field from search — it is not
a privacy control.

## Docs

- Schema-driven — `describe()` → columns / filters / widgets / joins
- Search engine — the query AST/DSL pipeline + `useCollectionList`
- Design tokens — the `--nui-*` variables
- Architecture — the two-axis / three-tier model

> Naming: **bare = base, suffix = binding.** `@noy-db/ui` is the agnostic core; `@noy-db/ui-<framework>`
> packages are thin adapters that depend on it.
