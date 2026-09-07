# Changelog

All notable changes to `@noy-db/ui` are documented here. Format follows
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

The configurable layer moves here, so the two bindings stop carrying a copy each (#9).

### Added
- **The `core/` composables are now exported from `@noy-db/ui`** — `provideNoydbUi`, `useNoydbUi`,
  `NOYDB_UI_KEY`, `useNuiI18n`, `useLlm`, `useViewport`, `useContainerSize`, `useVoiceInput`, the
  `NoydbUiConfig` / `LlmClient` / `VoiceSource` / `ThemeMode` types, and the `NUI_LOCALE_TH` Thai
  catalog. They were duplicated verbatim in `ui-nuxt` and `ui-suai` (six byte-identical files
  apiece); every one is plain Vue with no Nuxt API, so there is no new dependency edge — `vue` was
  already a peer.

  **`useTheme` deliberately did not move.** It is the one piece the forks genuinely disagree on —
  `.dark` class for Nuxt UI vs `data-theme` + `--nui-*` tokens for suai — and it stays in each
  binding.

  Additive: both bindings still re-export the identical set from their own `/core` subpath, which
  remains the surface a host imports.

### Tested
- `provider.test.ts` covers the config-injection contract that had none: absent-provider defaults,
  the zero-setup English fallback, key-as-last-resort, a configured translator, and `useLlm()`
  degrading to `null`. Uses `app.runWithContext()`, so it needs no DOM.

## [0.3.0-pre.4] — 2026-08-09

Sync onto the current family rail (hub `0.6.0-pre.4`), and close the last gap in the hub's
native `via-lookup` surface: a lookup field backed by a reference collection now resolves to a
control that can actually be used.

### Added
- **`InputKind` gains `'autocomplete'`**, with a new **`FieldInput.lookup`** descriptor
  (`FieldInputLookup`). `fieldInput()` splits a `lookup()` field by whether its vocabulary can be
  shown whole: the `static` and `reserved` tiers keep rendering as a `select` sourced from
  `dict.values` or the declared `lookup.keys`, while the **`collection` tier** — whose membership
  lives in a first-class reference collection that `describe()` deliberately does not embed —
  becomes an `autocomplete` carrying `{ dimension, key, vocabulary, present, sortBy }` so the host
  can resolve options search-as-you-type. Previously such a field fell through to a **free-text
  input**, because there were no inline options to build a select from.

  Host-supplied `options` still win and still produce a `select`, so nothing that works today
  changes shape; the new kind only appears where the control was previously wrong.

### Changed
- Dev pins moved to `@noy-db/hub` / `@noy-db/to-memory` `0.6.0-pre.4` (from `0.6.0-pre.1`). The
  `peerDependencies` range `^0.6.0-pre.0` already admitted it and is untouched.

## [0.3.0-pre.3] — 2026-08-02

In-place editing: hints, i18n/unit inputs, and the edit-state composable. Also: found-set
traversal — frozen query-derivable snapshots, path-shaped titles, and the skim controller.
And: the hub's native via-lookup surface (≥0.3.0-pre.9) flows into the schema and read paths.

### Added
- **`parseExif(bytes)`** (`exif.ts`) — a dependency-free EXIF reader for **JPEG, PNG, and HEIC/HEIF**
  attachments: pulls orientation, camera make/model, lens, capture time, exposure / f-number / ISO /
  focal length, and GPS (as signed decimal degrees) from the file's TIFF block, wherever the container
  keeps it — JPEG APP1, PNG `eXIf` chunk, or a HEIC ISOBMFF `Exif` item (located via `meta`→`iinf`/
  `iloc`). Offline by design — the metadata lives inside the decrypted bytes (a zero-knowledge vault
  has no server-side metadata bag), and any malformed read yields `null` rather than throwing.
- **`fileCategory(mime, filename)`** (`attachments.ts`) — classify an attachment by MIME (preferred)
  then extension into a display `{ category, label, icon }` across ~20 common kinds (image, pdf,
  document, spreadsheet, presentation, archive, audio, video, code, json, markup, text, font, ebook,
  calendar, contact, disk, database, certificate, application, + a generic fallback), so a non-image
  reads as what it is with a friendly label and a distinct lucide icon rather than a generic blob.
  Exports the `FileCategoryKind` union.
- **`crop.ts` — square-crop geometry** for a pan/zoom image cropper (cover upload): `coverScale`
  (base scale where an image just covers a frame), `clampOffset` (keep the frame covered while
  panning), `cropRect(view)` → `{ sx, sy, sw, sh }` (the source rectangle to feed
  `ctx.drawImage`, so the crop renders at any output size), and `displaySize`. Pure — the component
  owns pointer/canvas, this owns the math (11 tests).
- **`lists.ts` — the hide/patch list algebra** (traverse P-D). One `ListDef { name, entity, query,
  hide[], patch[] }` unifies a smart list (bookmarked query), a smart list with overrides, and a
  fixed playlist. `resolveListIds(def, evaluatedIds)` computes `(eval(query) − hide) ∪ patch` with
  stable order (query members keep their sorted position, patch-only ids append); `addToList`/
  `removeFromList` are **total** (`remove = id ∈ patch ? unpatch : hide`, `add = id ∈ hide ? unhide
  : patch`) and idempotent; `toggleInList`/`isInList` (need the live `inQuery`), `listKind`
  (fixed/smart/smart-overridden), plus `makeList`/`sortLists`/`listsForEntity`. Pure — the host owns
  persistence (localStorage today; vault-encrypted/syncable is the endgame).
- **Bulk set algebra** (traverse P-E) — `addAllToList` (∪), `removeAllFromList` (∖), and
  `intersectListWith` (∩, keeps only members also selected) fold a whole selection into a list
  through the same total single-id ops. Create-a-list-from-a-selection is `makeList({ patch: ids })`.
- **`attachmentList(slots)` + `humanSize`/`attachmentSlot`/`ATTACHMENT_PREFIX`** (`attachments.ts`,
  Item Release P5) — filter a `blob(id).list()` result to the `att:`-prefixed attachment slots (the
  cover + named slots stay out) and shape each into an `AttachmentItem` (`{ slot, filename, mime,
  size, humanSize, kind: 'image'|'file', uploadedAt? }`), sorted by upload time. `attachmentSlot(uuid)`
  mints a new slot name; `humanSize` renders binary units.
- **`relatedColumns(columns, keys)` + `summaryCards(agg, spec)`** (`related.ts`, Item Release P6) —
  the reverse-lookup surface: `relatedColumns` picks/orders a column subset for a compact embedded
  list (unknown keys skipped); `summaryCards` turns an `aggregate().run()` result into StatCard-ready
  `{ label, value, icon?, color? }[]`, rendering an empty-set `null` (e.g. `avg` over zero rows) as
  `—` unless the spec's `format` says otherwise.
- **`historyRows(snapshots, diffFn, fields, opts?)`** (`history-view.ts`) — the change-history
  "what / who / when" view model (Item Release P4). Turns newest-first version snapshots + a diff
  function into display rows `{ version, actor?, iso?, relative?, isCurrent, genesis, changes[] }`;
  each change resolves its field label (nested i18n paths → `Notes (TH)`), formats values through
  `describe()` metadata (enum labels, currency units) and keeps sensitive fields masked. The live
  version (no archived timestamp) is `isCurrent`; the oldest is `genesis` (renders as "created").
  Pure — the host injects the hub's per-record `diff`, so it unit-tests without a vault.
- **`describe().lookup` consumption** — `schemaFromDescribe` treats a native
  `lookup()`/`enum()`/`dict()` field as an enum even without a `dict` block, sourcing `enumOrder`
  from the lookup's declared key set; `fieldInput` derives fallback select options from
  `lookup.keys` when neither host options nor `dict.values` exist.
- **`formatDetailCell` read-mode label resolution** — new `opts.options` (`{ value, label }[]`,
  the same shape the form widgets take) resolves enum codes and entity ids to display labels;
  label precedence for dict/lookup fields is the hub-dressed `<key>Label` sibling (a `{ locale }`
  read resolved it at the call's locale) › host options › the dictionary's declared-locale label ›
  the raw code. A bare `ref` field **without** `displayFor` now emits a navigable `ref` (linked,
  named via options) instead of rendering its raw id as dead text.
- **`fieldHint(field)`** — derives a client-side *hint* (never validation) from `describe()`'s async
  constraints: a required mark plus a compact range/length/format text (`minimum`/`maximum`/`gt`/`lt`
  → `1900–2100` / `≥ 0`; `minLength`/`maxLength` → `≤ 300 chars`; `format` → `uri`). New `FieldHint`
  type.
- **`fieldInput` gains an `i18n-text` kind** — one text box per locale for `field.i18n` fields;
  `FieldInput` carries `locales` for it, and `unit` passes through for number inputs (display suffix
  like `USD`/`min`). Integer-typed fields (`field.type === 'integer'`) now map to the `number` kind.
- **`useRecordItem({ collection, id, readOptions? })`** — the edit-state machine behind an in-place
  editable record: `load`/`enterEdit`/`draft`/`dirty`/`errors`/`errorBanner`/`submitting`/`cancel`/
  `submit`. `submit()` calls `collection.put()`, decomposes a failure through `fieldErrors`, and
  reloads on success. Clones via a JSON round-trip (both Vue reactive proxies and the hub's sealed-view
  proxies aren't structured-cloneable).
- **`--nui-danger`** design token (light `#dc2626` / dark `#f87171`) — the 9th `--nui-*` variable, for
  error text/marks.
- **`FoundSetItem`/`FoundSetSnapshot`** (`traverse.ts`) — the found set as a frozen, query-derivable
  snapshot (spec D1/D2): serialized DSL + `narrate()` title + the captured row order/labels
  (`kind: 'query' | 'fixed'`); `positionOf`/`itemAt` locate a record within it for
  destination-labelled steppers.
- **`pathSegments`** (`path.ts`) — the detail title as a path (spec D7): the group-by trail when the
  found set was grouped, else the entity's natural ref-axis, terminating in the record's own title.
- **`captureFoundSet`/`useFoundSet`/`setReturnAnchor`/`consumeReturnAnchor`/`rememberDirection`/
  `recallDirection`** (`use-found-set.ts`) — a per-entity, per-tab found-set session store: a row
  click captures the current display order; the detail's "back" hands the list a return anchor
  (query + row) to restore to; direction memory survives the page remount a returning navigation
  causes.
- **`foundSetItems({ lines, rows }, opts?)`** (`found-set-items.ts`, traverse P-C) — the pure
  "display → frozen `FoundSetItem[]`" step: the grouped line list (carrying each row's group-by
  trail, outermost first) when present, else the flat rows. Shared by the list's capture-on-click
  AND a forked/cold tab's rebuild-from-`?q=`, so both tabs derive an identical order from the same
  query (spec §6 invariant 1 — a snapshot is fully derivable from its query string).
- **`useTraverse`** (`use-traverse.ts`) — the skim controller (spec D8): an instant cursor over the
  frozen snapshot, with a ~250ms generation-guarded settle before triggering the real record load
  (fast clicks skim titles; a paused click loads the record) — `go`/`goTo`/`first`/`last`,
  `skimming`, `lastDirection`.

### Changed
- **`fieldErrors(err)`** also maps noy-db's `MissingTranslationError` (duck-typed on `field` +
  `missing`) to its offending field, alongside `SchemaValidationError` issues — same
  `Record<fieldKey, message>` shape either way.
- `@noy-db/hub` peer floor → `^0.3.0-pre.9` (the via-port line: lookup/computed/classified
  describe() blocks are additive; the `dict` block consumed here is byte-stable). `@noy-db/to-memory`
  dev floor follows (it peer-pins hub per release).

### Fixed
- **`fieldHint` suppresses zod `.int()`'s implicit ±`MAX_SAFE_INTEGER` bounds** — a
  `z.number().int().min(1)` field now hints `≥ 1` instead of `1–9007199254740991`.

## [0.3.0-pre.2] — 2026-07-04

The item-family foundation: schema-driven card grouping + dual-language detail cells.

### Added
- **`groupFields(fields, t?)`** — turns `describe()`'s new `group`/`order` metadata into
  ordered card sections (`FieldGroup { id, title, fields }`): groups rank by their minimum
  member `order`, fields sort stably within a group, ungrouped fields land in a localizable
  default bucket (`nui.detail.details`); group titles localize via `nui.detail.group.<id>`.
- **`DetailCell.i18n`** — `formatDetailCell` explodes a raw i18n locale map (record read with
  `{ locale: 'raw' }`) into per-locale entries `{ locale, display, missing }`; `display` stays
  the first non-missing locale. Resolved-string reads are untouched; sensitivity masking wins.

### Changed
- `@noy-db/hub` peer floor → `^0.3.0-pre.2` (the release that ships `DescribedField.group/order`).

## [0.3.0-pre.1] — 2026-07-03

Version alignment with `@noy-db/hub` 0.3.0-pre.1 — the package now tracks the noy-db version
line. No functional changes over 0.2.0-pre.1.

## [0.2.0-pre.1] — 2026-07-03

The fluent-search release: the query pipeline gains narration, presentation pills, and full
localizability.

### Added
- **`narrate(ast, schema, opts)`** — renders a resolved search as a compact title + full sentence
  (window/tab titles, report headers, saved/recent rows). Host-localizable via `t` (`nui.q.*`
  structural words, `nui.q.noun.<entity>`, per-entity empty titles `nui.q.all.<entity>`).
- **Two-tone pills** — `astToPills` splits each pill into a muted `head` and strong `value`;
  `movePill` reorders within its own segment (sort priority / group nesting). Accepts `t` for the
  structural words (not/and/or) and the Sort:/Group:/Show:/Hide: heads.
- **`boolean` FieldType** — checkbox-widget fields narrate/pill/suggest as the bare label
  ("Favorite" / "not Favorite"), never `true`/`false`.
- **Localized field labels** — `schemaFromDescribe` takes `labelFor(key, label)`; noy-db's
  `describe()` labels are single-language by design, so the host injects its locale dictionary
  here. The original label survives as an alias, so data-language queries still resolve.
- **`buildSuggestions` accepts `t`** — suggestion labels (Sort/Group by/Show/Hide/Search "…") and
  hint chips localize; boolean value suggestions; "as typed" pattern fallback for text fields.
- **`LOCALE_TH`** — shipped Thai catalog for every string the engine emits.
- `resolve` dedupes duplicate sort/group/show/hide keys and merges same-field eq/in predicates
  (OR semantics).

### Changed
- **`useCollectionList` accepts a schema getter** (`schema: () => EntitySchema`) so locale-reactive
  field labels flow into grouping, facets, and the group-by field list.

## [0.2.0-pre.0] — 2026-06-26

Initial extraction from an internal pilot app — the framework-agnostic base of the noy-db UI family.

### Added
- **Search engine** — the query AST/DSL pipeline (tokenize → parse → resolve → evaluate →
  group/summary/pills), rolling-date tokens, suggestions, saved/recent/NL helpers.
- **Schema model** — `schemaFromDescribe` + cross-collection `joinedSchema`/`joinedRows` over a
  collection's `describe()` metadata.
- **Item resolvers** — `formatDetailCell`/`detailFields` (read) and `fieldInput`/`formFields` (edit),
  plus `fieldErrors()` to decompose a `SchemaValidationError` into per-field messages.
- **`useCollectionList`** — the reactive composable wiring the pipeline to query state.
- **Design tokens** — `@noy-db/ui/tokens.css` (`--nui-*` variables + dark mode).
