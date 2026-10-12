# noy-db · Vinyl Showcase

A static, browser-only Nuxt SPA that demonstrates `@noy-db/ui` (the engine) and `@noy-db/ui-suai`
(the SUAI binding, `--su-*` tokens) against a real noy-db vault — a vinyl record collection with
album, artist, and label collections, joins, Thai/English localization, cover art round-tripped
through the vault's encrypted blob store, and a guided balloon tour.

`ssr: false` — no server. Everything runs in the browser: vault decryption, schema-driven list/
search/detail, cover blob round-trips, i18n switch, theme toggle.

## Demo secret

```
spin-the-black-circle
```

## Prerequisites

The `@noy-db/*` runtime packages (`hub`, `as-noydb`) are consumed **from npm at a pinned
version**, exactly as an outside consumer would — no sibling checkout is needed. The vault runs on
hub's built-in in-memory store (`createNoydb` with no `store`), so no `to-*` package is involved.
This repo's own UI packages are linked as `workspace:*` — the showcase is a member of the root
workspace — so they must be built first.

### 1. Build this repo's UI packages

From the repo root (`noy-db-ui/`):

```bash
cd ../../
pnpm install
pnpm build
```

The root `pnpm install` also installs the showcase; it has no lockfile of its own.

`public/demo.noydb` and `public/covers/` are **committed**, so the app runs as-is. The covers
are **plain PNGs**, not encrypted: blobs do not travel in a `.noydb` bundle, so `scripts/seed.ts`
writes them as static assets. On first view the app stores a cover in the vault's encrypted blob
store and reads it back — the demo is that round-trip, not secret art. `pnpm seed`
re-runs `scripts/seed.ts` to regenerate them; you only need it if you change the dataset.

## Running

### Dev server

```bash
cd examples/showcase
pnpm dev
```

Opens at `http://localhost:3000`.

### Static build

```bash
pnpm generate
```

Produces `.output/public/` — a fully self-contained static SPA. Serve it with any static file
server:

```bash
npx serve .output/public
```

## Notes

- **`demo.noydb` is non-deterministic** across re-seeds (the vault re-encrypts with a fresh key
  each time). It *is* committed, so after re-seeding `git status` will show it as modified —
  that churn is expected and should not be committed on its own.

- **A cosmetic console warning is expected** on first load:
  `[noy-db] Loaded a legacy backup with no ledgerHead` — this is benign and does not affect
  functionality.

- `src/data/__tests__/committed-bundle.test.ts` guards the committed bundle against the pinned
  hub, so a `@noy-db/*` version bump cannot silently break it for anyone who never re-seeds.

## What it demonstrates

| Feature | Where |
|---|---|
| Secret unlock + wrong-secret error | `/` (unlock screen) |
| Schema-driven list + search | `/records`, `/artists`, `/labels` |
| Joins surfaced in list columns | `/records` (artist + label join) |
| Record detail with ref links | `/records/[id]` |
| Cover art — blob encrypt + decrypt round-trip in-browser (source PNG is a public static asset) | `/records/[id]` (cover panel + caption) |
| Thai/English across chrome + enum values + field headers | lang switcher in header |
| Light/dark/system theme toggle | theme toggle in header |
| Guided balloon tour (per-page, localized, Prev/Next/Skip) | `?` button in header |
