<!-- prettier-ignore-start -->
<div align="center">

# `@noy-db/ui-nuxt`

### Schema-driven UI for [noy-db](https://github.com/noy-db/core) vaults

**Drop in a collection — get a fully interactive list, detail, search and AI out of the box.**
Domain-free · built on Nuxt UI · deliberately plain · local-first.

> **Fork status (rebuild in progress):** this package was rebuilt on **Nuxt UI** as the plain
> fork of the family. It currently ships a subset — `CollectionList`, `SearchBox`, `EmptyState`,
> `LoadingSkeleton`, `StatCard` — plus the full `core/` composable layer. The sophisticated
> components described further down (record detail, traverse, header filters, galleries, themes)
> live in **`@noy-db/ui-suai`**; sections below may still describe that richer surface until this
> README is rewritten.

Concepts (schema-driven, search engine, design tokens, architecture) live in **`@noy-db/ui`**.

</div>
<!-- prettier-ignore-end -->

---

A noy-db collection already describes itself — labels, types, units, enums, refs (`collection.describe()`).
`@noy-db/ui-nuxt` turns that metadata into the UI you'd otherwise hand-write per entity: **browse, search,
filter, group, view, edit, and AI-query** — with **zero per-collection code**.

```vue
<!-- a complete, searchable, filterable, groupable sales list -->
<CollectionList :columns="columns" :rows="rows" @row-click="open" />
<SearchBox v-model="query" :schema="schema" :rows="rows" />
```

## Why

- 🧠 **Schema-driven** — columns, filters, enums, entity links and edit widgets all derive from
  `describe()`. Add a collection, get its UI for free.
- 🔗 **One vault or a federation** — components map 1:1 to noy-db's domains (collections, records,
  blobs, keyring, identity).
- 🎨 **Themeable, not opinionated** — UnoCSS + `--nui-*` CSS variables. Set `--nui-accent` and the
  whole library reskins. Dark mode included. **No Nuxt UI, no CSS framework forced on your app.**
- 🗣️ **AI + voice ready** — natural-language search (BYO LLM) and speech-to-text are first-class,
  pluggable layers — not bolted on.
- 📦 **Ships pre-compiled CSS** — consume it as a Nuxt module; your app build stays untouched.

## The shape of the package

Three tiers, by how often a developer touches them:

```
🛍️  src/runtime/components/   TOP SHELF   ← what you compose (10–15, discoverable at a glance)
⚙️   src/runtime/core/         CONFIG       ← what you tune (theme · i18n · AI · voice · responsive)
🔒  src/runtime/internal/     INVARIANT    ← sub-components you never place; on top of the @noy-db/ui engine
```

The engine itself (AST search, schema adapters, `useCollectionList`, tokens) is the framework-agnostic
**`@noy-db/ui`** base this package depends on.



## Quick start

```bash
npm i @noy-db/ui-nuxt
```

```ts
// nuxt.config.ts — add the module; it auto-registers components, auto-imports core/ composables,
// injects the pre-built CSS, and wires theme + locale. Configure once via the `noydbUi` key.
export default defineNuxtConfig({
  modules: ['@noy-db/ui-nuxt/module'],
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
import { useCollectionList, schemaFromDescribe } from '@noy-db/ui'
const schema = schemaFromDescribe('sales', vault.collection('sales').describe().fields)
const list = useCollectionList({ baseRows, query, entity: 'sales', columns, defaultSort, schema })
</script>

<template>
  <CollectionList :columns="columns" :rows="list.visibleRows.value" v-bind="list" />
</template>
```

## Top-shelf components

| | Component | One-liner |
|---|---|---|
| 📋 | **CollectionList** | browse/search/filter/group/sort a collection (or joined ones) |
| 🔎 | **SearchBox** | pills-in-the-box query with field/value autocomplete |
| ⭐ | **SavedSearchMenu** | bookmark, favorite, rename, set-default searches |
| 🕘 | **RecentSearchMenu** | recently-run queries as pills |
| ✨ | **NlSearchButton** | natural-language → query (presentational; BYO AI) |
| 👁️ | **ColumnChooser** | per-user show/hide column preferences |
| 🗂️ | **GroupByControl** | group-by + expand/collapse to level |

…with **`Item` · `Asset` · `Auth` · `Owner`** families on the roadmap (record detail/edit, blob
viewer, vault unlock/keyring, identity & federation).

## Status

Extracted from an internal pilot app; **destined for the noy-db monorepo as a standalone repo.** The List
family + the engine are production-validated (type-checked, `nuxt build`-clean). `core/` is scaffolded;
`Item`/`Asset`/`Auth`/`Owner` are next.

## Develop

From the repo root (pnpm workspace):

```bash
pnpm --filter @noy-db/ui-nuxt build       # tsup (module) + runtime copy
pnpm --filter @noy-db/ui-nuxt typecheck   # vue-tsc over src (.vue + .ts)
```

The engine + its unit tests live in **`@noy-db/ui`** (`pnpm --filter @noy-db/ui test`).

## License

TBD (will follow noy-db).
