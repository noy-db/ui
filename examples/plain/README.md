# noy-db · Vinyl, plain

The same vinyl vault as [`examples/showcase`](../showcase/) — same seed, same secret, same
`@noy-db/ui` engine — rendered by **`@noy-db/ui-nuxt`** with default Nuxt UI styling and nothing
else. Use it to see what the engine and the Nuxt binding give you before any theming.

One generic route serves every collection: `describe()` → schema → columns → `CollectionList`,
with the query DSL as the only search UI.

| Route | What it shows |
|---|---|
| `/` | Secret unlock (`spin-the-black-circle`); a wrong secret is refused |
| `/records`, `/artists`, `/labels` | Schema-driven list + DSL search; records join artist/label names |
| `/[collection]/[id]` | Record detail |

## Run

```bash
# from the repo root: build the UI packages this app links via file:
pnpm install && pnpm build

cd examples/plain
pnpm install      # its own workspace and lockfile — the root install does not reach it
pnpm dev
```

`public/demo.noydb` and `public/covers/` are committed; `pnpm seed` regenerates them. The vault
runs on hub's built-in in-memory store (`createNoydb` with no `store`), so no `to-*` package is
needed.
