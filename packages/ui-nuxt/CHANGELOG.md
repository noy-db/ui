# Changelog

All notable changes to `@noy-db/ui-nuxt` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning will follow the noy-db line on release.

## [0.4.0-pre.0] — 2026-08-24

**Onto the hub 0.7 line.**

### Compatibility

- **Peer range widened by appending, not narrowed**: `^0.6.0-pre.0 || ^0.7.0-pre.0`,
  uniform across all three packages. A consumer on a `0.6.x` hub keeps it; nothing
  compels an upgrade. Verified by compiling all three packages against the **oldest**
  hub the range admits, not just against the dev pin.
- This package imports **zero** symbols retired by hub 0.7's `Provider`-suffix
  removal (measured against the shipped codemod map), which is why widening rather
  than narrowing is honest here.
- The committed-bundle canary — the only thing that opens this repo's checked-in
  encrypted artefact — passes under hub `0.7.0-pre.2`, so this line carries **no
  format break** for existing vaults.


## [0.3.0] — 2026-08-20

**The first stable release of this package.** Everything before it was a pre-release, and
`@latest` had been frozen at `0.3.0-pre.3` since this package's debut — npm sets `latest` on a
package's *first* publish regardless of `--tag`, so a package born inside a pre-release line
stays pinned there until a stable exists. This is that stable, and it clears the tag.

`@latest` and `@next` both point at `0.3.0`. That is deliberate: leaving `@next` on a
pre-release would put it *below* `@latest`. The next pre-release restores the usual invariant.

### What a consumer gets

Pins `@noy-db/hub@0.6.0` — the hub's own first `0.6` stable. `peerDependencies` stays
`^0.6.0-pre.0`, unchanged and still verified: all three packages compile against
`hub@0.6.0-pre.0`, and the range admits `0.6.0` without an edit. **Nothing forces an existing
consumer off the hub they are on.**

### ⚠️ On the format breaks in the 0.6 pre line

If you are coming from a `0.6.0-pre.*` hub, three no-migration format changes happened along the
way — record AAD at `pre.18`, an authenticated keyring roster at `pre.21`, and
`NOYDB_KEYRING_VERSION → 2` at `pre.24`. A vault written before the relevant change refuses to
open and says so, naming the transition rather than accusing your store.

`0.6.0` itself adds **no** further break: a pod written under `pre.24` opens under `0.6.0`
unchanged — measured here, by the guard on this repo's committed demo pod, before re-seeding it.

**Coming from `0.5.x` or earlier, expect to re-seed.** The format is replaced rather than
migrated; see noy-db #1100.

### Since 0.3.0-pre.7

`0.3.0-pre.8` was prepared and never published; its changes are folded in here.

- Dev pins moved onto `@noy-db/hub@0.6.0` (via `0.6.0-pre.24`), the whole `@noy-db` lockstep line
  as a unit. Peer range untouched.
- **The describe types now bind `@noy-db/hub/introspection`** rather than the bare package root
  (noy-db #1021). Published source takes `DescribedField` from the subpath — nine files, all
  type-only, no runtime hub import anywhere in shipped code. This is what a stable should promise:
  a hub root-export change is no longer a potential break here.

  One symbol stayed on the root, deliberately: `StandardSchemaV1Issue` only reached
  `./introspection` in hub `0.6.0-pre.9`, and our floor is `^0.6.0-pre.0`. Moving it would have
  made the declared range false, and narrowing the floor to repair that would compel an upgrade
  for consumers on `pre.0..pre.8` to satisfy import cosmetics. `/ui` will never exist — noy-db
  #1002 is closed `NOT_PLANNED`.
- The demo pods in `examples/` are re-seeded under `0.6.0`, so the shipped artefact is written by
  the same version that reads it.

### Note: hub #1141 fixes a ref-declaration ordering bug

`refs` declared on an **already-constructed** collection were silently discarded, so for those
collections the reference closure was incomplete and a strict `put()` with a dangling ref was
accepted. Declaring `refs` before first touching the collection always behaved correctly. Adopting
the fix is a **no-op** unless you hit that ordering; only code that did sees new
`RefIntegrityError`s, and those writes were genuinely invalid.

## [0.3.0-pre.7] — 2026-08-19

Dev pins move onto `@noy-db/hub@0.6.0-pre.23`. **No change to any published UI code.**

### ⚠️ This release does NOT move the hub peer floor

The `peerDependencies` range stays `^0.6.0-pre.0`, unchanged and verified: all three packages
still compile against `hub@0.6.0-pre.0`.

**Upgrading `@noy-db/ui*` alone is safe.** A consumer already on an earlier `0.6.0-pre` keeps their
hub, and that permissive floor is precisely what lets them take this release *without* their vault
becoming unreadable. The breaks below arrive only if you **separately** take `@noy-db/hub@next`.

### ⚠️ If you do take `hub@0.6.0-pre.23`: two format breaks, neither with a migration

Both were found here, by the guard on this repo's committed demo pod.

| | `pre.18` — record AAD (noy-db #1041) | `pre.21` — authenticated keyring |
|---|---|---|
| travels with | the payload | the vault |
| fails at | first record read | **unlock** |
| blast radius | one record | **the whole vault** |
| a pre-break artefact | unopenable | **still opens until unlock** |

`pre.18` began *applying* AAD (`pre.17` compiled the machinery without invoking it), so records
written earlier fail their tag. `pre.21` made the keyring roster authenticated, so a vault written
earlier fails at unlock with `KeyringTamperedError (roster-key-missing)`.

Records are cross-readable across `pre.18 … pre.23`, so **a pod re-seeded under `pre.18` or later
still fails on the keyring** if it carries one — a vault-at-rest pod does; an extracted compartment
does not. Tracked as noy-db #1100.

**The committed demo pods in `examples/` were re-seeded** for exactly this reason. If you keep a
committed encrypted artefact of your own, expect to re-seed it; the error names the format
transition rather than accusing your store (noy-db #1129), so it should be recognisable rather
than something to debug.

### Note: hub #1141 fixes a ref-declaration ORDERING bug

> **Clarified 2026-08-19.** This section first said #1141 "turns ref enforcement ON", which
> overstated it — enforcement was never globally off. Corrected in place rather than rewritten,
> since the original wording was published.

Not a change in this package, but worth knowing before you take the hub. `refs` declared on an
**already-constructed** collection were silently discarded, so for those collections the reference
closure was incomplete and a strict `put()` with a dangling ref was **accepted**. Declaring `refs`
*before* first touching the collection always behaved correctly, under `pre.21` and `pre.23` alike.

So the incomplete closure and the unenforced integrity were **one bug, not two**, and adopting
`pre.23` is a **no-op** unless you hit the ordering. Only code that did will see new
`RefIntegrityError`s — and those writes were genuinely invalid.

This repo's examples declare refs in `'warn'` mode and use no materialized views (the other trigger:
a query-form materialized view runs `db.collection(name)` inside `openVault()`, before any user code,
so its sources' `refs` were discarded with no ordering the consumer could have chosen). Nothing here
newly rejects; the fix means the post-`load()` re-declaration in `useVault.ts` now actually takes
effect where it was previously discarded.

## [0.3.0-pre.6] — 2026-08-14

No change to any published code — this release exists to put the repo's **first GitHub Release**
through the Release-triggered publish path, which had never been exercised (both prior cuts went
out via `workflow_dispatch`).

### Changed (repo tooling only)
- The release path is now gated on the **peer-floor guard** (#27). It was merged in #26 but
  triggered only on `package.json` edits, and a Release event is not one — so it could not block
  a release that advertised a peer range it would have rejected. Now called via `workflow_call`
  at the release tag.
- **A docs bridge** (#28): a release now attaches a `bridge: 1` payload and files a doc-sync issue
  in noy-db-docs, which records this repo's versions but previously had no way to learn when they
  changed.
- The peer-floor guard **no longer dies with a stack trace on a bad peer range** (#30), and
  detects an unbounded range by its computed floor rather than by its text.

## [0.3.0-pre.5] — 2026-08-09

### Changed
- **`runtime/core/` is now a re-export shim over `@noy-db/ui`** (#9). The configuration layer —
  `provideNoydbUi`/`useNoydbUi`, `useNuiI18n`, `useLlm`, `useViewport`, `useContainerSize`,
  `useVoiceInput`, `NUI_LOCALE_TH` — was byte-identical in both bindings and now has one home.
  `useTheme` stays here: it is the real fork.

  **No surface change.** `/core` exports the same nine runtime names as `0.3.0-pre.4`, and the
  files stay in `runtime/core/` so the Nuxt module's `addImportsDir` keeps auto-importing every
  composable exactly as before.

## [0.3.0-pre.4] — 2026-08-09

### Changed
- Dev pin moved to `@noy-db/hub` `0.6.0-pre.4`; the peer range `^0.6.0-pre.0` is unchanged.

### Note
- The `autocomplete` control added to `@noy-db/ui` in this release is rendered by `ui-suai`'s
  `FieldControl`. This fork carries no form layer yet — `RecordForm`/`FieldControl` were not part
  of the v1 slice (#9) — so nothing here consumes it until that layer is ported.

## [0.3.0-pre.3] — 2026-08-02

**BREAKING** — the package is rebuilt as the **plain fork on Nuxt UI**, the regressed tier of the
three-fork model (shared `@noy-db/ui` engine; forks differ only in visual tier). Components now
compose `@nuxt/ui` v4 primitives (UTable/UInput/UCard-level) with standard Nuxt UI theming and no
CSS of their own — the pre-compiled UnoCSS pipeline, `--nui` token injection, and the `style.css`
export are gone.

### Removed (BREAKING)
- The previous flagship component set (~20 components: `RecordForm`, `RecordDetail` (flagship),
  `RecordHistory`, `AttachmentGallery`, `RelatedList`, `TraverseBar`, `ItemPath`, `ColumnChooser`,
  `GroupByControl`, `SavedSearchMenu`, `RecentSearchMenu`, `NlSearchButton`, `SearchModeGroup`,
  `NuiText`, …) and the `style.css` / `--nui` theming surface. That entire surface — including the
  improvements that had accumulated unreleased here since 0.3.0-pre.2 (the `AttachmentGallery`
  metadata-row redesign with EXIF, `RecordDetail` in-place edit mode + `FieldControl`,
  `TraverseBar`/`ItemPath` found-set traversal, `CollectionList` bulk selection and `anchorKey`,
  `RecordHistory` timestamps) — now lives in **`@noy-db/ui-suai`**, the flagship fork debuting at
  this version with an identical module surface and the same `noydbUi` configKey. Switching forks
  means swapping the package name only; see `@noy-db/ui-suai`'s 0.3.0-pre.3 entry for the detailed
  notes on those improvements.

### Added
- The plain component set on Nuxt UI semantics: `CollectionList` (UTable + the engine's AppColumns,
  local sort), `SearchBox` (UInput bound to the DSL query string), `EmptyState` / `LoadingSkeleton` /
  `StatCard`, plus the full `core/` layer (unchanged engine re-export).
- **`RecordDetail` (plain)** — a label/value grid on the engine's `detailFields`/`formatDetailCell`;
  entity refs emit for host routing, i18n fields show every locale.
- The module now installs `@nuxt/ui` (deduped when the host lists it first); `useTheme` keeps the
  same API but drives Nuxt UI's `.dark` class convention.
- `playground/` — a standalone dev harness (own pnpm workspace, module loaded from source).
- `docs/ui-nuxt/7.suai-bridge.md` — the SUAI bridge map: Nuxt UI v4 theme vars → `--su-*` token
  derivations; dark mode flows through the `.dark` class with no dark block in the bridge.

### Fixed
- `CollectionList` `@select` argument order — UTable emits `(Event, TableRow)` (event first), so row
  ids now reach row-click handlers.

## [0.3.0-pre.2] — 2026-07-04

The item-family foundation: RecordDetail joins the list's responsive system.

### Added
- **`useContainerSize(host)`** (auto-imported from `core/`) — container-measured
  (ResizeObserver) width + `'sm' | 'md' | 'lg'` density tier on the list's 448/640
  thresholds; widest-first before measurement.

### Changed
- **`RecordDetail`** — cards now derive from `describe()`'s `group`/`order` metadata via
  `groupFields` (the `groups` prop remains as a host override); the grid is
  container-measured instead of viewport-`sm:` (1-column cells `<448px`, two card columns
  `≥992px`); values render through `NuiText`; i18n fields read with `{ locale: 'raw' }`
  render one badged row per language (missing locale dimmed); card padding follows the
  density tier via `--nui-card-px` (host-overridable).
- `@noy-db/hub` peer floor → `^0.3.0-pre.2`.

### Fixed
- `possibly undefined` type errors in `CollectionList` (`bannerLeadCols`) and `SearchBox`
  (`smartQuote`) that surfaced when a consuming app type-checks the shipped `.vue` runtime
  under a strict tsconfig (`noUncheckedIndexedAccess`). Both accesses are guaranteed by
  surrounding logic; asserted non-null. No behavior change.

## [0.3.0-pre.1] — 2026-07-03

Version alignment with `@noy-db/hub` 0.3.0-pre.1 — the package now tracks the noy-db version
line. No functional changes over 0.2.0-pre.1.

## [0.2.0-pre.1] — 2026-07-03

The fluent-search release: the search box becomes the view's editable title, with three input
voices and full localizability.

### Added
- **Search-as-title** — at rest the `SearchBox` renders the fluent narrate title (with the full
  sentence as tooltip); focusing swaps to the two-tone pill editor continuing the title.
- **Pill editing** — click edits a pill as a labelled token with the value pre-selected; every
  pill has a × and a popup Remove row; Esc restores the original (cancel is never a delete);
  drag ≥6px reorders within its own segment with an insertion marker.
- **Keyboard roving** — arrows/Home/End roam the pill row, Enter/Space edits, Delete removes
  (focus stays in the row), Alt+arrows reorder, `/` focuses the field from anywhere.
- **Three-voice mode group** — exact ⌕ / ask ✨ (sticky AI, refine automatic) / speak 🎤
  (push-to-record via pointer capture; release finalizes into the ask pipeline). Morphing reset
  (✕ discard draft / abort flight → 🗑 erase search), Esc ladder, floating key card + status notes.
- **`GroupByControl`**, saved/recent search menus with narrate-based fluent rows, and a print
  contract (report header = narrate title + sentence).
- **`NUI_LOCALE_TH`** (`@noy-db/ui-nuxt/core`) — Thai catalog for the whole family: the engine's
  `LOCALE_TH` merged with this binding's component chrome. Hosts spread it into their translator
  and override freely; domain words (entity nouns, field labels, enum values) stay host-side.
- Suggestion hint chips render through `t('nui.hint.<hint>')`.

### Changed
- Components pass the host `t` into `astToPills`/`buildSuggestions`, so pill heads and suggestion
  labels follow the active locale. The host's `t` bridge receives the FULL `nui.*` key — never
  re-prefix it.

## [0.2.0-pre.0] — 2026-06-26

Initial extraction from an internal pilot app — the Nuxt binding for `@noy-db/ui`.

### Added
- **Nuxt module** (`@noy-db/ui-nuxt/module`) — auto-registers components, auto-imports the `core/`
  composables, injects the pre-compiled CSS, and wires theme + locale (`noydbUi` config key).
- **List family** — `CollectionList`, `SearchBox`, `SavedSearchMenu`, `RecentSearchMenu`,
  `NlSearchButton`, `ColumnChooser`, `GroupByControl`.
- **Item family** — `RecordDetail` (schema-driven read) + `RecordForm` (schema-driven edit, per-field
  errors).
- **Insight family** — `EmptyState`, `LoadingSkeleton`, `StatCard`.
- **`core/` config layer** — `provideNoydbUi` + `useTheme`/`useNuiI18n`/`useLlm`/`useVoiceInput`/
  `useViewport`. AI (BYO LLM) and voice (Web Speech, swappable) are pluggable.
- **i18n** — every built-in string routes through `useNuiI18n()` under the `nui.*` key namespace,
  with English fallbacks.
- Pre-compiled CSS shipped at `@noy-db/ui-nuxt/style.css` (namespaced `nui-*`, no host-engine conflict).
