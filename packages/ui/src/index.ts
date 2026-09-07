// @noy-db/ui — framework-agnostic base of the noy-db UI family.
//
// The domain-free DATA core + the pure SEARCH ENGINE + the `useCollectionList` composable + the
// detail/form field resolvers. The Vue/Nuxt components live in the binding packages
// (@noy-db/ui-nuxt, …) which import from here. Destined for the noy-db monorepo.

// schema shape + resolver
export type { EntitySchema, FieldDef, FieldType } from './types'
export { resolveField, ordinalRank } from './resolve-field'

// schema-derived data-type icons (column chooser / header type indicators)
export { FIELD_TYPE_ICON, fieldTypeIcon } from './field-icons'

// responsive width engine: fit-the-container column sizing (no horizontal overflow)
export {
  WIDTH_ARCHETYPES, archetypeForFieldType, selectColumns, distributeWidths, fitColumns,
  type WidthArchetype, type ArchetypeSpec, type SizedColumn,
} from './column-width'

// adaptive text: fit a value into a width via abbreviate → condense → wrap → ellipsis
export {
  fitText, repsFor, compactNumber,
  type FitTreatment, type FitOptions, type TextKind,
} from './adaptive-text'

// square-crop geometry for a pan/zoom image cropper (cover upload)
export { coverScale, clampOffset, cropRect, displaySize, type CropView } from './crop'

// describe()-driven schema + cross-collection joins
export { schemaFromDescribe, type SchemaFromDescribeOptions } from './schema-from-describe'
export { joinedSchema, joinedRows, joinedKey, type JoinLeg } from './collection-source'

// search engine (Pass 1): AST → parse → resolve* → evaluate (filter+sort) → group/summary/pills
// (*resolve stays app-side until value-synonyms are made injectable)
export * from './ast'
export * from './tokenize'
export * from './parse'
export * from './serialize'
export * from './resolve'
export * from './evaluate'
export * from './group'
export * from './summary'
export * from './dates'
export * from './pills'
export * from './narrate'
export * from './column-filter'

// filter value types — explicit so they win over column-filter's re-export of Facet/EntityFacets
export type { ColumnFilterValue, Facet, EntityFacets, FilterChip } from './table-filter'

// value-synonym mechanism (the host registers its domain table via registerSynonyms)
export {
  registerSynonyms, normalizeTerm, resolveSynonym, hasSynonyms, synonymCanonicals,
  type SynonymTable,
} from './synonyms'

// column model (view-side description of a list column)
export type { AppColumn, SubtotalEnum } from './column'

// the list composable: query string ⇄ AST → rows/facets/subtotals/grouping/column prefs
export { useCollectionList, type DisplayLine, type GroupLine, type RowLine } from './use-collection-list'

// Item family: detail-view value formatting + schema-driven form input resolution
export { formatDetailCell, detailFields, type DetailCell } from './detail'
export { groupFields, type FieldGroup } from './groups'
export { fieldInput, formFields, fieldErrors, fieldHint, type FieldInput, type FieldInputLookup, type InputKind, type FieldHint } from './form'
export { useRecordItem, type ItemCollection } from './use-record-item'

// Item family: change-history "what / who / when" timeline (P4)
export {
  historyRows,
  type HistoryRow, type HistoryChange, type HistoryChangeType,
  type HistorySnapshot, type HistoryDiffEntry, type HistoryDiffFn, type HistoryRowsOptions,
} from './history-view'

// Item family: attachments gallery (P5) + related list with derived summary (P6)
export {
  attachmentList, humanSize, attachmentSlot, ATTACHMENT_PREFIX, fileCategory,
  type AttachmentItem, type BlobSlotInfo, type FileCategory, type FileCategoryKind,
} from './attachments'
export { parseExif, type ExifData } from './exif'
export {
  relatedColumns, summaryCards,
  type SummaryFieldSpec, type SummaryCard,
} from './related'

// Traverse family: found-set snapshots + traversal position + path-shaped titles
export { positionOf, itemAt, type FoundSetItem, type FoundSetSnapshot, type TraversePosition } from './traverse'
export { useTraverse } from './use-traverse'
export { pathSegments, type PathSegment } from './path'
export { captureFoundSet, useFoundSet, setReturnAnchor, consumeReturnAnchor, rememberDirection, recallDirection } from './use-found-set'
export { foundSetItems, type FoundSetItemsOptions } from './found-set-items'

// search-box + saved/recent/NL search logic (domain-free; storage data supplied by the host)
export * from './suggest'
export * from './history'
export * from './saved'
export * from './nl'

// Lists — the hide/patch algebra (traverse P-D) + bulk set algebra (P-E)
export {
  makeList, resolveListIds, addToList, removeFromList, toggleInList, isInList,
  isFixedList, listKind, isValidListName, listsForEntity, sortLists,
  addAllToList, removeAllFromList, intersectListWith, type ListDef,
} from './lists'

// table utilities: formatting, column aggregates, responsive column resolution, column prefs
export * from './format'
export * from './aggregate'
export * from './responsive-columns'
export * from './use-column-prefs'

// shipped locale catalogs for the engine's own strings (hosts spread into their translator)
export { LOCALE_TH } from './locale-th'
export { NUI_LOCALE_TH } from './nui-locale-th'

// The configurable layer, shared by every binding. These are plain Vue composables (no Nuxt API),
// single-sourced here so `ui-nuxt` and `ui-suai` cannot drift apart; each binding re-exports them
// from its own `/core` subpath, which stays the surface a host imports. `useTheme` is deliberately
// NOT here — it is the one piece the forks genuinely disagree on (`.dark` class for Nuxt UI vs
// `data-theme` + `--nui-*` tokens for suai), so it stays in each binding.
export {
  provideNoydbUi, useNoydbUi, NOYDB_UI_KEY,
  type NoydbUiConfig, type LlmClient, type VoiceSource, type ThemeMode,
} from './provider'
export { useNuiI18n } from './i18n'
export { useLlm } from './llm'
export { useViewport } from './responsive'
export { useContainerSize, type ContainerSize } from './container'
export { useVoiceInput } from './voice'
