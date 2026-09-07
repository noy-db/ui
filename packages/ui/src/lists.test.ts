import { describe, it, expect } from 'vitest'
import {
  makeList, resolveListIds, addToList, removeFromList, toggleInList, isInList,
  isFixedList, listKind, isValidListName, listsForEntity, sortLists,
  addAllToList, removeAllFromList, intersectListWith, type ListDef,
} from './lists'

const def = (over: Partial<ListDef> = {}): ListDef =>
  ({ id: 'l1', entity: 'records', name: 'Mix', query: 'genre:jazz', hide: [], patch: [], createdAt: 1, updatedAt: 1, ...over })

const EVAL = ['a', 'b', 'c', 'd'] // the query's sorted result

describe('makeList / classification', () => {
  it('trims name and copies override arrays', () => {
    const l = makeList({ entity: 'records', name: '  Faves  ', query: 'g:jazz', patch: ['x'] }, 5, 'l9')
    expect(l).toMatchObject({ id: 'l9', name: 'Faves', query: 'g:jazz', hide: [], patch: ['x'], createdAt: 5, updatedAt: 5 })
  })
  it('classifies fixed / smart / smart-overridden', () => {
    expect(isFixedList(makeList({ entity: 'r', name: 'P' }, 1, 'l'))).toBe(true)
    expect(listKind(def())).toBe('smart')
    expect(listKind(def({ hide: ['b'] }))).toBe('smart-overridden')
    expect(listKind(def({ query: '' }))).toBe('fixed')
  })
  it('validates names', () => {
    expect(isValidListName('  ')).toBe(false)
    expect(isValidListName(' x ')).toBe(true)
  })
})

describe('resolveListIds — (eval − hide) ∪ patch', () => {
  it('a pure smart list is exactly the eval, in order', () => {
    expect(resolveListIds(def(), EVAL)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('hide masks a matching row, keeping the rest in order', () => {
    expect(resolveListIds(def({ hide: ['b'] }), EVAL)).toEqual(['a', 'c', 'd'])
  })
  it('patch appends non-matching rows after the eval, in patch order', () => {
    expect(resolveListIds(def({ patch: ['z', 'y'] }), EVAL)).toEqual(['a', 'b', 'c', 'd', 'z', 'y'])
  })
  it('a patched id already in eval keeps its eval position, not duplicated', () => {
    expect(resolveListIds(def({ patch: ['c'] }), EVAL)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('union wins: an id in both hide and patch is included (at its eval position)', () => {
    expect(resolveListIds(def({ hide: ['b'], patch: ['b'] }), EVAL)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('a fixed list is exactly its patch, in order', () => {
    expect(resolveListIds(def({ query: '', patch: ['p', 'q'] }), [])).toEqual(['p', 'q'])
  })
  it('dedupes a repeated evaluated id', () => {
    expect(resolveListIds(def(), ['a', 'a', 'b'])).toEqual(['a', 'b'])
  })
})

describe('total add / remove', () => {
  it('remove a matching (in-query) row → hide', () => {
    expect(removeFromList(def(), 'b', 9)).toMatchObject({ hide: ['b'], patch: [], updatedAt: 9 })
  })
  it('remove a patched row → unpatch (not hide)', () => {
    expect(removeFromList(def({ patch: ['z'] }), 'z', 9)).toMatchObject({ hide: [], patch: [] })
  })
  it('add a non-matching row → patch', () => {
    expect(addToList(def(), 'z', 9)).toMatchObject({ patch: ['z'], updatedAt: 9 })
  })
  it('add a hidden row → unhide (not patch)', () => {
    expect(addToList(def({ hide: ['b'] }), 'b', 9)).toMatchObject({ hide: [], patch: [] })
  })
  it('add/remove are idempotent', () => {
    const once = addToList(def(), 'z', 9)
    expect(addToList(once, 'z', 10)).toBe(once) // no change → same object
    const rm = removeFromList(def(), 'b', 9)
    expect(removeFromList(rm, 'b', 10)).toBe(rm)
  })
  it('add then remove of an in-query row round-trips to empty overrides', () => {
    const removed = removeFromList(def(), 'b', 2)      // hide:[b]
    expect(addToList(removed, 'b', 3)).toMatchObject({ hide: [], patch: [] }) // unhide
  })
})

describe('isInList / toggleInList', () => {
  it('reflects query membership adjusted by overrides', () => {
    expect(isInList(def(), 'b', true)).toBe(true)       // in query, not hidden
    expect(isInList(def({ hide: ['b'] }), 'b', true)).toBe(false)
    expect(isInList(def({ patch: ['z'] }), 'z', false)).toBe(true)
    expect(isInList(def(), 'z', false)).toBe(false)
  })
  it('toggle removes an included id and adds an excluded one', () => {
    expect(toggleInList(def(), 'b', true, 9)).toMatchObject({ hide: ['b'] })     // was in → remove
    expect(toggleInList(def(), 'z', false, 9)).toMatchObject({ patch: ['z'] })   // was out → add
  })
  it('toggle then toggle restores', () => {
    const off = toggleInList(def(), 'b', true, 9)
    expect(resolveListIds(toggleInList(off, 'b', true, 10), EVAL)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('set algebra (P-E) — fold a selection into a list', () => {
  it('union adds every selected id (a fixed list becomes the union)', () => {
    const fixed = def({ query: '', patch: ['a'] })
    expect(resolveListIds(addAllToList(fixed, ['b', 'c'], 9), [])).toEqual(['a', 'b', 'c'])
  })
  it('union pins every selected id (explicit add, like P-D single-add); resolve dedupes eval members', () => {
    // both 'a' (already in eval) and 'z' (new) become patch entries — 'a' redundantly, but
    // resolveListIds keeps 'a' at its eval position (no dup) and appends 'z'.
    const out = addAllToList(def(), ['a', 'z'], 9)
    expect(out.patch).toEqual(['a', 'z'])
    expect(resolveListIds(out, EVAL)).toEqual(['a', 'b', 'c', 'd', 'z'])
  })
  it('subtract removes every selected id (hide in-query, unpatch patched)', () => {
    const l = def({ patch: ['z'] })
    const out = removeAllFromList(l, ['b', 'z'], 9)  // b in-query → hide; z patched → unpatch
    expect(out).toMatchObject({ hide: ['b'], patch: [] })
  })
  it('intersect keeps only members that are also selected', () => {
    // list = eval[a,b,c,d]; keep only {b,d} → hide a and c
    const out = intersectListWith(def(), ['b', 'd'], EVAL, 9)
    expect(resolveListIds(out, EVAL)).toEqual(['b', 'd'])
  })
  it('intersect over a patched list drops unselected patch + hides unselected eval', () => {
    const l = def({ patch: ['z'] })              // members: a,b,c,d,z
    const out = intersectListWith(l, ['a', 'z'], EVAL, 9)
    expect(resolveListIds(out, EVAL)).toEqual(['a', 'z'])
  })
  it('folds are idempotent and an empty selection is a no-op', () => {
    expect(resolveListIds(addAllToList(def(), [], 9), EVAL)).toEqual(['a', 'b', 'c', 'd'])
    const once = addAllToList(def(), ['z'], 9)
    expect(resolveListIds(addAllToList(once, ['z'], 10), EVAL)).toEqual(['a', 'b', 'c', 'd', 'z'])
  })
  it('create-from-selection is a fixed list of the selected ids', () => {
    const l = makeList({ entity: 'records', name: 'Picks', patch: ['x', 'y'] }, 1, 'lp')
    expect(isFixedList(l)).toBe(true)
    expect(resolveListIds(l, [])).toEqual(['x', 'y'])
  })
})

describe('collection helpers', () => {
  const lists = [
    def({ id: '1', entity: 'records', name: 'A', updatedAt: 10 }),
    def({ id: '2', entity: 'labels', name: 'B', updatedAt: 30 }),
    def({ id: '3', entity: 'records', name: 'C', updatedAt: 20 }),
  ]
  it('filters by entity', () => {
    expect(listsForEntity(lists, 'records').map((l) => l.id)).toEqual(['1', '3'])
  })
  it('sorts most-recently-updated first', () => {
    expect(sortLists(lists).map((l) => l.id)).toEqual(['2', '3', '1'])
  })
})
