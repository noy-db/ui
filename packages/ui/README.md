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

## Docs

- Schema-driven — `describe()` → columns / filters / widgets / joins
- Search engine — the query AST/DSL pipeline + `useCollectionList`
- Design tokens — the `--nui-*` variables
- Architecture — the two-axis / three-tier model

> Naming: **bare = base, suffix = binding.** `@noy-db/ui` is the agnostic core; `@noy-db/ui-<framework>`
> packages are thin adapters that depend on it.
