<!-- prettier-ignore-start -->
<div align="center">

# `@noy-db/ui-nuxt`

### Schema-driven UI for [noy-db](https://github.com/noy-db/core) vaults, on Nuxt UI

Domain-free · built on Nuxt UI · deliberately plain · local-first.

The **plain fork** of the noy-db-ui family: a small component set styled entirely by
[Nuxt UI](https://ui.nuxt.com), on the same `@noy-db/ui` engine as the flagship
**`@noy-db/ui-suai`** — identical data capability, plainer surface. Pill search, header filters,
grouping, record edit, history and theming live in `ui-suai`.

Concepts (schema-driven, search engine, design tokens, architecture) live in **`@noy-db/ui`**.

</div>
<!-- prettier-ignore-end -->

---

A noy-db collection already describes itself — labels, types, units, enums, refs (`collection.describe()`).
The `@noy-db/ui` engine turns that into a schema, columns and a query; this package renders them with
Nuxt UI components.

## Quick start

```bash
npm i @noy-db/ui-nuxt @nuxt/ui
```

```ts
// nuxt.config.ts — the module installs @nuxt/ui, auto-registers the components, auto-imports the
// core/ composables, and wires theme + locale. It ships NO CSS: styling is Nuxt UI's (Tailwind v4 +
// app.config theming). Configure once via the `noydbUi` key.
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@noy-db/ui-nuxt/module'],
  noydbUi: { theme: 'system', locale: 'en' },
})
```

```ts
// non-serializable layers (AI client, custom voice source) are provided at runtime:
import { provideNoydbUi } from '@noy-db/ui-nuxt/core'
provideNoydbUi({ llm: myLlmClient /* , voice: myVoiceSource */ })
```

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useCollectionList, schemaFromDescribe } from '@noy-db/ui'
const schema = schemaFromDescribe('sales', vault.collection('sales').describe().fields)
const query = ref('')
const list = useCollectionList({ baseRows, query, entity: 'sales', columns, defaultSort, schema })
</script>

<template>
  <SearchBox v-model="query" />
  <CollectionList :columns="columns" :rows="list.visibleRows.value" @row-click="open" />
</template>
```

The query string is the engine's full DSL (`field:value`, `>`, `<`, `sort:`, `group:`); filtering
happens in `useCollectionList`, not in the component.

## Components

Registered flat (no prefix) by the module:

| Component | Props | What it does |
|---|---|---|
| **CollectionList** | `columns`, `rows`, `loading?` · emits `row-click` | engine `AppColumn[]` + rows → a `UTable`; sorting is table-local |
| **SearchBox** | `v-model` (query string), `placeholder?` | one `UInput` bound to the query — no pills or suggestions |
| **RecordDetail** | `fields` (describe()), `record`, `optionsFor?` · emits `ref` | read-only label/value grid; `pii`/`secret` fields always masked |
| **StatCard** | `label`, `value`, `subValue?`, `icon?`, `color?` | a single metric |
| **EmptyState** | `title`, `icon?`, `description?`, `actionLabel?` · emits `action` | empty/no-match placeholder |
| **LoadingSkeleton** | `lines?`, `height?` | loading placeholder |

[`examples/plain`](https://github.com/noy-db/ui/tree/main/examples/plain) is a complete app on this
package.

## Develop

From the repo root (pnpm workspace):

```bash
pnpm --filter @noy-db/ui-nuxt build       # tsup (module) + runtime copy
pnpm --filter @noy-db/ui-nuxt typecheck   # vue-tsc over src (.vue + .ts)
```

The engine + its unit tests live in **`@noy-db/ui`** (`pnpm --filter @noy-db/ui test`).

## License

[Apache-2.0](LICENSE)
