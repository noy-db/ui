// Change-history view model — the Item-family "what / who / when" timeline (Item Release P4).
//
// Pure + framework-free, so RecordHistory.vue (and any print/audit surface) share it. The host
// fetches `collection.history(id)` (prior versions, newest-first) and the live record, assembles
// them into `HistorySnapshot`s (current first), and passes a diff function — this module turns the
// adjacent-pair diffs into labelled, formatted, masking-aware display rows.
//
// Why a diff FUNCTION is injected rather than called here: the hub's per-record diff lives in
// `@noy-db/hub/history` and needs a vault; keeping it out makes this module a pure unit the tests
// exercise with a hand-rolled object differ.
import type { DescribedField } from '@noy-db/hub/introspection'
import { relativeTime } from './history'

export type HistoryChangeType = 'added' | 'removed' | 'changed'

/** A single field change within one version, matching the hub's `DiffEntry` shape. */
export interface HistoryDiffEntry {
  readonly path: string
  readonly type: HistoryChangeType
  readonly from?: unknown
  readonly to?: unknown
}

export type HistoryDiffFn = (
  older: Record<string, unknown>,
  newer: Record<string, unknown>,
) => readonly HistoryDiffEntry[]

/**
 * One version in the timeline, newest-first. The live/current version carries no `timestamp`/`actor`
 * (the hub only records those when a version is archived by the *next* write — `get()` exposes no
 * write metadata), so an absent `timestamp` marks the current row.
 */
export interface HistorySnapshot {
  readonly version: number
  readonly timestamp?: string
  readonly actor?: string
  readonly record: Record<string, unknown>
}

export interface HistoryChange {
  /** Raw dot/bracket path from the diff (e.g. `notes.en`). */
  readonly path: string
  /** Resolved label — the field's label, with an i18n locale suffix (`Notes (TH)`) for nested paths. */
  readonly fieldLabel: string
  readonly type: HistoryChangeType
  /** Formatted previous value (undefined for `added`; masked for sensitive fields). */
  readonly from?: string
  /** Formatted new value (undefined for `removed`; masked for sensitive fields). */
  readonly to?: string
}

export interface HistoryRow {
  readonly version: number
  readonly actor?: string
  /** ISO timestamp, absent for the current version. */
  readonly iso?: string
  /** Compact relative time (`5m`, `2d`) — present only when `iso` and `opts.now` both are. */
  readonly relative?: string
  /** The live version (no archived metadata). */
  readonly isCurrent: boolean
  /** The oldest version — nothing preceded it, so it renders as "created" with no changes. */
  readonly genesis: boolean
  readonly changes: readonly HistoryChange[]
}

export interface HistoryRowsOptions {
  /** Translator for the i18n locale suffix wrapper (`nui.history.locale`). */
  readonly t?: (key: string, fallback?: string) => string
  /** Epoch ms "now" for relative time; omit to skip the relative field. */
  readonly now?: number
  /** Reveal sensitive from/to values instead of masking. */
  readonly reveal?: boolean
}

const MASK = '••••••'

/** The base field key of a diff path (`notes.en` → `notes`, `tags[0]` → `tags`). */
function baseKey(path: string): string {
  const m = /^[^.[]+/.exec(path)
  return m ? m[0] : path
}

/** Fields the timeline never surfaces as changes (id + reserved internals). */
function skip(path: string): boolean {
  const key = baseKey(path)
  return key === 'id' || key.startsWith('_')
}

function labelFor(
  field: DescribedField | undefined,
  path: string,
  key: string,
  t?: (k: string, f?: string) => string,
): string {
  const base = field?.label ?? key
  if (path === key) return base
  const sub = path.slice(key.length).replace(/^\./, '')
  // i18n nested path (`notes.en`) → "Notes (EN)"; keep the sub-token for other nested shapes.
  if (field?.i18n && sub && !sub.includes('.') && !sub.includes('[')) {
    const loc = sub.toUpperCase()
    return t ? t('nui.history.locale', `${base} (${loc})`).replace('{loc}', loc) : `${base} (${loc})`
  }
  return `${base}.${sub}`
}

/** Format one endpoint of a change, honouring sensitivity/enum/currency — a focused sibling of formatDetailCell. */
function formatValue(
  field: DescribedField | undefined,
  path: string,
  value: unknown,
  reveal: boolean,
): string | undefined {
  if (value === undefined) return undefined
  if (field && (field.sensitivity === 'pii' || field.sensitivity === 'secret') && !reveal) return MASK
  if (value === null || value === '') return '—'
  // nested path → the sub-value is already a primitive (e.g. a locale string)
  if (path !== baseKey(path)) return String(value)
  const dictLabel = field?.dict?.values?.find((v) => v.value === value)?.label
  if (dictLabel) return dictLabel
  if (field?.semanticType === 'currency') return `${value}${field.unit ? ` ${field.unit}` : ''}`
  if (field?.semanticType === 'percent') return `${value}%`
  return String(value)
}

/**
 * Build the change-history display rows from newest-first version snapshots.
 *
 * Each row's `changes` are the diff from the next-older snapshot; the oldest row is `genesis`
 * (rendered as "created"). Values format through the field's `describe()` metadata and sensitive
 * fields stay masked unless `opts.reveal`.
 */
export function historyRows(
  snapshots: readonly HistorySnapshot[],
  diffFn: HistoryDiffFn,
  fields: readonly DescribedField[],
  opts: HistoryRowsOptions = {},
): HistoryRow[] {
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const rows: HistoryRow[] = []

  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i]!
    const older = snapshots[i + 1]
    const genesis = older === undefined
    const changes: HistoryChange[] = []

    if (!genesis) {
      for (const d of diffFn(older.record, snap.record)) {
        if (skip(d.path)) continue
        const key = baseKey(d.path)
        const field = byKey.get(key)
        changes.push({
          path: d.path,
          fieldLabel: labelFor(field, d.path, key, opts.t),
          type: d.type,
          ...(formatValue(field, d.path, d.from, opts.reveal ?? false) !== undefined
            ? { from: formatValue(field, d.path, d.from, opts.reveal ?? false) }
            : {}),
          ...(formatValue(field, d.path, d.to, opts.reveal ?? false) !== undefined
            ? { to: formatValue(field, d.path, d.to, opts.reveal ?? false) }
            : {}),
        })
      }
    }

    const iso = snap.timestamp
    const relative =
      iso && opts.now !== undefined ? relativeTime(Date.parse(iso), opts.now) : undefined

    rows.push({
      version: snap.version,
      ...(snap.actor !== undefined ? { actor: snap.actor } : {}),
      ...(iso !== undefined ? { iso } : {}),
      ...(relative !== undefined ? { relative } : {}),
      isCurrent: iso === undefined,
      genesis,
      changes,
    })
  }

  return rows
}
