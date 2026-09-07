# Changelog — @noy-db/ui-suai

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

### Added
- **`FieldControl` renders the new `autocomplete` kind** — a dependency-free combobox for a lookup
  field backed by a reference collection. `RecordForm` and `RecordDetail` (edit mode) gain a
  **`search`** prop, `Record<fieldKey, (term) => Promise<{ value, label }[]>>`, mirroring the
  existing `options` prop: supply `options` for a field and it stays a plain select, supply
  `search` and it becomes a typeahead. A `closed` vocabulary discards free text on blur; an `open`
  one stores what was typed. Option labels are only shown for options the host has returned — the
  component never guesses at the backing collection.

### Changed
- Dev pin moved to `@noy-db/hub` `0.6.0-pre.4`; the peer range `^0.6.0-pre.0` is unchanged.

## [0.3.0-pre.3] — 2026-08-02

**First published release.** `@noy-db/ui-suai` is the **flagship rendering fork** of the three-fork
model: the shared `@noy-db/ui` engine dressed in the sophisticated visual tier — the full component
set, pre-compiled UnoCSS pipeline, `--nui` design-token injection, and `style.css` export that
`@noy-db/ui-nuxt` carried through 0.3.0-pre.2 (`ui-nuxt` is now the plain fork on Nuxt UI). The
module surface and the `noydbUi` configKey are identical, so an app switches forks by swapping the
package name only. The showcase example app now consumes this package.

Relative to the last published flagship surface (`@noy-db/ui-nuxt` 0.3.0-pre.2), this release also
ships the improvements below (developed on the pre-fork tree, first published here).

`RecordDetail` gains in-place editing, sharing its widget renderer with `RecordForm`. Also: found-set
traversal — a sticky stepper bar and a path-shaped detail title.

### Added
- **`RecordHistory` shows the exact timestamp** — each row now renders the full `YYYY-MM-DD HH:MM`
  next to the relative time ("2 days ago · 2026-07-11 14:32") instead of hiding it in a tooltip; the
  author (`row.actor`) sits alongside.

### Changed
- **`AttachmentGallery` gains a `title` prop** — overrides the panel heading (default: the localized
  "Attachments"), e.g. `title="Documents"` when it holds only non-media files.
- **`AttachmentGallery` redesigned as a metadata row list + drop-zone** — attachments render as tidy
  rows (thumbnail / type-icon · name · `TYPE · dimensions · size` · upload time · delete-on-hover with
  an inline confirm) divided by hairlines, instead of nested cards with their own borders/shadows that
  didn't align. Each non-image gets a category icon + friendly label via `fileCategory` (@noy-db/ui);
  images show a thumbnail and their pixel dimensions (read client-side off the decoded image, since the
  blob metadata doesn't carry them); the upload time comes from the blob's `uploadedAt`. A just-added
  row briefly flashes to confirm the upload landed (attachments save immediately, no separate Save).
  Each row expands to a metadata detail (type · exact size · dimensions · uploaded-when/by), and for
  photos a full **EXIF** block via `parseExif` (@noy-db/ui) — camera, lens, capture time, exposure /
  f-number / ISO / focal length, orientation, and GPS with an OpenStreetMap link — for JPEG, PNG, and
  HEIC. A thumbnail the browser can't decode (e.g. HEIC in Chrome) falls back to the type icon.
  The whole panel accepts dragged files (drop overlay); a slim dashed "Add files" bar sits below the
  list, and the empty state is a "drop files here, or click to browse" target. The file input is now
  visually-hidden rather than `display:none` (a `display:none` input's programmatic `.click()` is
  blocked in some browsers, so "Add" opened nothing), and it takes `multiple` (one `upload` per file).
- **`RecordDetail` cards scale to the container width** — the card grid now grows to 3 and then 4
  columns on wider surfaces (≥1160 / ≥1700px) instead of capping at 2, so a wide detail view fills
  the width with more cards per row rather than stretching each one; each card's inner field grid
  drops to one column when the card itself gets narrow.
- **`RecordDetail` gains a `controls` prop** (default `true`) — set `false` to suppress the built-in
  edit/save/cancel action row so the host can own those controls (e.g. an edit icon in a masthead plus
  a sticky save/cancel bar). The cells still morph into inputs on `editing`; only the action row is
  withheld.
- **`FieldControl`** (internal) — the single widget renderer for a `FieldInput`
  (text/textarea/number+unit/date/select/checkbox/i18n-text), with error and constraint-hint lines
  underneath. Shared by `RecordForm` and `RecordDetail`'s edit mode so both surfaces stay
  pixel-consistent.
- **`RecordDetail` in-place edit mode** — new `editing`/`draft`/`errors`/`options`/`submitting`/
  `errorBanner` props and `save`/`cancel` emits (pair with `useRecordItem` from `@noy-db/ui`).
  Editable cells morph into their `FieldControl` widget in the same grid cell; required fields get a
  `*` mark, constraints render as a hint line, and non-editable fields show a lock affordance
  (`i-lucide-lock`, `nui.detail.readonly` string).
- **`TraverseBar`** — sticky found-set stepper above a detail view: the narrated-search breadcrumb
  doubles as "back to list"; a fixed vertical cluster (⤒ first, ▲ prev, N/M, ▼ next, ⤓ last) with
  destination-named tooltips/labels and a tabular-nums reserved width so it never reflows; `j`/`k`
  and `⌥↑`/`⌥↓` step; a popover scrubber (internal `TraverseScrubber`) offers a typed jump and a
  grouped mini-list; goes inert while `editing`.
- **`ItemPath`** — a detail's path-shaped title: the group-by trail when the found set was grouped,
  else the entity's natural ref-axis, terminating in the record's title; collapses to
  first › … › terminal below 448px; group segments emit `back`, entity segments emit `navigate`.
- **`CollectionList` gains `anchorKey`** — scrolls a row into view and flash-highlights it once,
  e.g. when a detail's `back()` restores the list to where you left it.
- **`CollectionList` gains bulk selection** (traverse P-E) — an opt-in `selectable` prop adds a
  leading checkbox column with a header select-all (indeterminate on a partial selection); the host
  owns the set via `selectedKeys` and the `toggleSelect`/`toggleSelectAll` events. Default off, so
  every existing usage is byte-identical. Pairs with `@noy-db/ui`'s set-algebra (`addAllToList` /
  `removeAllFromList` / create-from-selection) to fold a selection into a named list.
- **`RecordHistory`** — the change-history timeline (Item Release P4): a collapsed panel at the
  detail's foot, newest version first, each row an actor + relative time with an expandable
  field-change list (`from → to`, masking-aware, nested i18n paths labelled `Notes (TH)`). Rows come
  from `@noy-db/ui`'s `historyRows()`; the panel is **lazy** — it emits `expand` once on first open
  so the host fetches `collection.history(id)` only then, and re-fetches after an edit. Current
  version renders as "Current", the oldest as "Created".
- **`AttachmentGallery`** — the attachments gallery (Item Release P5): a grid of image thumbnails +
  file tiles for a record's `att:` blob slots, an upload button and per-item delete with inline
  confirm. Items come from `attachmentList()`; the component owns the image objectURL lifecycle
  (built from host-supplied bytes via `loadBytes`, revoked on unmount and when an item disappears).
  Emits `upload`/`remove` — vault I/O (`blob.put`/`blob.delete`) stays host-side.
- **`RelatedList`** — a reverse-lookup list with a derived summary (Item Release P6): a StatCard
  summary strip (from `summaryCards()`) over a compact `CollectionList` (column subset via
  `relatedColumns()`) of another collection's rows that reference this record. Cell slots forward
  through to the inner list so enum/entity cells localize as on the full list; emits `rowClick`. The
  host supplies the rows and summary from `query().where(...).toArray()` + the same query's
  `aggregate().run()`.

### Changed
- **`RecordForm`** delegates its per-field controls to the internal `FieldControl` renderer instead of
  inlining them.
- `@noy-db/hub` peer floor → `^0.3.0-pre.9` (additive describe() surface; no component changes
  needed).
- **`RecordDetail` read mode resolves display labels through `options`** — the prop that already
  fed edit-mode selects now also names read-mode cells: enum codes render their localized label and
  bare entity refs (no `displayFor` pairing) render as links named by their option entry, following
  `formatDetailCell`'s new precedence (`<field>Label` sibling › options › declared-locale dict
  label › raw code).

## 0.3.0-pre.2 — unpublished

- Package created: flagship rendering fork, seeded 1:1 from `@noy-db/ui-nuxt` 0.3.0-pre.2
  (same components, theming, and module surface; `configKey` stays `noydbUi` so an app
  switches forks without touching its config). History before this point lives in
  `packages/ui-nuxt/CHANGELOG.md`.
