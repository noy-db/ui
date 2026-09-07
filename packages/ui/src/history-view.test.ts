import { describe, it, expect } from 'vitest'
import type { DescribedField } from '@noy-db/hub'
import { historyRows, type HistoryDiffEntry, type HistorySnapshot } from './history-view'

const f = (p: Partial<DescribedField> & { key: string }): DescribedField =>
  ({ type: 'string', optional: true, label: p.key, widget: 'text', editable: true, ...p }) as DescribedField

const FIELDS = [
  f({ key: 'title', label: 'Title' }),
  f({ key: 'rating', label: 'Rating', semanticType: 'number' }),
  f({ key: 'priceUsd', label: 'Price', semanticType: 'currency', unit: 'USD' }),
  f({ key: 'genre', label: 'Genre', dict: { name: 'genre', static: true, values: [{ value: 'jazz', label: 'Jazz' }, { value: 'rock', label: 'Rock' }] } }),
  f({ key: 'notes', label: 'Notes', i18n: { locales: ['en', 'th'] } }),
  f({ key: 'ssn', label: 'SSN', sensitivity: 'secret' }),
  f({ key: 'favorite', label: 'Favorite', type: 'boolean', widget: 'checkbox' }),
]

// A tiny object differ standing in for the hub's per-record diff (dot paths for nested objects).
function objDiff(older: Record<string, unknown>, newer: Record<string, unknown>, base = ''): HistoryDiffEntry[] {
  const out: HistoryDiffEntry[] = []
  const keys = new Set([...Object.keys(older ?? {}), ...Object.keys(newer ?? {})])
  for (const k of keys) {
    const p = base ? `${base}.${k}` : k
    const a = (older ?? {})[k], b = (newer ?? {})[k]
    if (JSON.stringify(a) === JSON.stringify(b)) continue
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
      out.push(...objDiff(a as Record<string, unknown>, b as Record<string, unknown>, p))
    } else if (a === undefined) out.push({ path: p, type: 'added', to: b })
    else if (b === undefined) out.push({ path: p, type: 'removed', from: a })
    else out.push({ path: p, type: 'changed', from: a, to: b })
  }
  return out
}

// v1 (created) → v2 (rating + notes.en) → current v3 (favorite added). Newest-first, current has no ts.
const snapshots: HistorySnapshot[] = [
  { version: 3, record: { id: 'r1', title: 'A', rating: 5, notes: { en: 'first!', th: 'หนึ่ง' }, favorite: true } },
  { version: 2, timestamp: '2026-07-10T09:00:00.000Z', actor: 'bob', record: { id: 'r1', title: 'A', rating: 5, notes: { en: 'first!', th: 'หนึ่ง' } } },
  { version: 1, timestamp: '2026-07-09T08:00:00.000Z', actor: 'alice', record: { id: 'r1', title: 'A', rating: 3, notes: { en: 'first', th: 'หนึ่ง' } } },
]

describe('historyRows', () => {
  const rows = historyRows(snapshots, objDiff, FIELDS, { now: Date.parse('2026-07-12T09:00:00.000Z') })

  it('produces one row per snapshot, newest first', () => {
    expect(rows.map((r) => r.version)).toEqual([3, 2, 1])
  })

  it('marks the live version current (no timestamp) and the oldest genesis', () => {
    expect(rows[0]).toMatchObject({ isCurrent: true, genesis: false })
    expect(rows[0].iso).toBeUndefined()
    expect(rows[2]).toMatchObject({ isCurrent: false, genesis: true, changes: [] })
  })

  it('the current row diffs against the previous version', () => {
    expect(rows[0].changes).toEqual([{ path: 'favorite', fieldLabel: 'Favorite', type: 'added', to: 'true' }])
  })

  it('resolves field labels and formats a scalar change', () => {
    const change = rows[1].changes.find((c) => c.path === 'rating')
    expect(change).toEqual({ path: 'rating', fieldLabel: 'Rating', type: 'changed', from: '3', to: '5' })
  })

  it('renders a nested i18n path as "Label (LOCALE)"', () => {
    const change = rows[1].changes.find((c) => c.path === 'notes.en')
    expect(change).toEqual({ path: 'notes.en', fieldLabel: 'Notes (EN)', type: 'changed', from: 'first', to: 'first!' })
  })

  it('carries actor + relative time on archived rows', () => {
    expect(rows[1].actor).toBe('bob')
    expect(rows[1].iso).toBe('2026-07-10T09:00:00.000Z')
    expect(rows[1].relative).toBe('2d')
    expect(rows[0].relative).toBeUndefined() // current has no timestamp
  })

  it('skips id and reserved-internal paths', () => {
    const withId = historyRows(
      [
        { version: 2, record: { id: 'CHANGED', _ts: 2, title: 'B' } },
        { version: 1, timestamp: '2026-07-09T08:00:00.000Z', record: { id: 'r1', _ts: 1, title: 'A' } },
      ],
      objDiff, FIELDS,
    )
    expect(withId[0].changes.map((c) => c.path)).toEqual(['title'])
  })

  it('masks a sensitive field on both endpoints unless revealed', () => {
    const snaps: HistorySnapshot[] = [
      { version: 2, record: { id: 'r1', ssn: '999-88-7777' } },
      { version: 1, timestamp: '2026-07-09T08:00:00.000Z', record: { id: 'r1', ssn: '111-22-3333' } },
    ]
    const masked = historyRows(snaps, objDiff, FIELDS)[0].changes[0]
    expect(masked).toMatchObject({ from: '••••••', to: '••••••' })
    const revealed = historyRows(snaps, objDiff, FIELDS, { reveal: true })[0].changes[0]
    expect(revealed).toMatchObject({ from: '111-22-3333', to: '999-88-7777' })
  })

  it('formats enum labels and currency units in change values', () => {
    const snaps: HistorySnapshot[] = [
      { version: 2, record: { id: 'r1', genre: 'rock', priceUsd: 40 } },
      { version: 1, timestamp: '2026-07-09T08:00:00.000Z', record: { id: 'r1', genre: 'jazz', priceUsd: 33 } },
    ]
    const changes = historyRows(snaps, objDiff, FIELDS)[0].changes
    expect(changes.find((c) => c.path === 'genre')).toMatchObject({ from: 'Jazz', to: 'Rock' })
    expect(changes.find((c) => c.path === 'priceUsd')).toMatchObject({ from: '33 USD', to: '40 USD' })
  })

  it('added/removed omit the absent endpoint', () => {
    const snaps: HistorySnapshot[] = [
      { version: 2, record: { id: 'r1', title: 'A', favorite: true } },
      { version: 1, timestamp: '2026-07-09T08:00:00.000Z', record: { id: 'r1', title: 'A' } },
    ]
    const change = historyRows(snaps, objDiff, FIELDS)[0].changes[0]
    expect(change.type).toBe('added')
    expect(change.from).toBeUndefined()
    expect(change.to).toBe('true')
  })

  it('uses a translator for the locale suffix when provided', () => {
    const t = (k: string, fb?: string) => (k === 'nui.history.locale' ? 'ภาษา {loc}' : fb ?? k)
    const rowsT = historyRows(snapshots, objDiff, FIELDS, { t })
    expect(rowsT[1].changes.find((c) => c.path === 'notes.en')?.fieldLabel).toBe('ภาษา EN')
  })
})
