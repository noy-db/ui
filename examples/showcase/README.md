# noy-db · Vinyl Showcase

A static, browser-only Nuxt SPA that demonstrates `@noy-db/ui` and `@noy-db/ui-nuxt` against a
real noy-db vault — a vinyl record collection with album, artist, and label collections, joins,
Thai/English localization, encrypted cover-art blobs, and a guided balloon tour.

`ssr: false` — no server. Everything runs in the browser: vault decryption, schema-driven list/
search/detail, cover blob round-trips, i18n switch, theme toggle.

## Demo secret

```
spin-the-black-circle
```

## Prerequisites

The `@noy-db/*` runtime packages are consumed **from npm at a pinned version**, exactly as an
outside consumer would — no sibling checkout is needed. Only this repo's own UI packages are
linked locally, via `file:` paths, so they must be built first.

### 1. Build this repo's UI packages

From the repo root (`noy-db-ui/`):

```bash
cd ../../
pnpm install
pnpm build
```

### 2. Install

```bash
cd examples/showcase
pnpm install
```

`public/demo.noydb` and `public/covers/` are **committed**, so the app runs as-is. `pnpm seed`
re-runs `scripts/seed.ts` to regenerate them; you only need it if you change the dataset.

## Running

### Dev server

```bash
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
| Cover art — live blob decrypt in-browser | `/records/[id]` (cover panel + caption) |
| Thai/English across chrome + enum values + field headers | lang switcher in header |
| Light/dark/system theme toggle | theme toggle in header |
| Guided balloon tour (per-page, localized, Prev/Next/Skip) | `?` button in header |
