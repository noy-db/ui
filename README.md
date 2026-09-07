<div align="center">

# noy-db-ui

### Schema-driven UI for [noy-db](https://github.com/noy-db/core) vaults

**Drop in a collection — get a fully interactive list, detail, search and AI out of the box.**
Domain-free · design-system-free · local-first.

</div>

---

A noy-db collection already describes itself — labels, types, units, enums, refs
(`collection.describe()`). noy-db-ui turns that metadata into the UI you'd otherwise hand-write per
entity: **browse, search, filter, group, view, edit, and AI/voice query** — with **zero per-collection
code**.

## Packages

**Bare name = the agnostic base, `<framework>` suffix = the binding** (mirrors noy-db's `@noy-db/in-*`):

| Package | What it is |
|---|---|
| [`@noy-db/ui`](packages/ui) | the framework-agnostic **base** — search/list engine, schema model, design tokens. Pure TS/CSS. |
| [`@noy-db/ui-nuxt`](packages/ui-nuxt) | the **Nuxt binding** — components + the Nuxt module + the `core/` config layer. |
| *(future)* `@noy-db/ui-next`, `@noy-db/ui-react` | other bindings, same base. |

`@noy-db/hub` (the vault runtime) is an external peer.

## Quick start (Nuxt)

```bash
npm i @noy-db/ui-nuxt
```

```ts
// nuxt.config.ts — the module auto-registers components, auto-imports core/ composables,
// injects the pre-built CSS, and wires theme + locale.
export default defineNuxtConfig({
  modules: ['@noy-db/ui-nuxt/module'],
  noydbUi: { theme: 'system', locale: 'en' },
})
```

```vue
<CollectionList :columns="columns" :rows="rows" @row-click="open" />
<SearchBox v-model="query" :schema="schema" :rows="rows" />
```

## Docs


## Develop

```bash
pnpm install
pnpm build      # turbo → tsup
pnpm test       # vitest (engine unit tests)
pnpm typecheck  # tsc + vue-tsc
pnpm lint
```

See [CLAUDE.md](CLAUDE.md) for the build shapes and conventions.

## License

[MIT](LICENSE) © vLannaAi
