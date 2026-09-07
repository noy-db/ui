// Recursive-descent parser for the search DSL. Precedence: OR (lowest) < AND < NOT < term.
// AND is implicit between adjacent terms. `sort:` / `group:` tokens are extracted into ast.sort /
// ast.groupBy rather than the where-tree. The parser is PANIC-FREE: it records soft errors and
// always returns a (possibly partial) AST plus a `tail` describing the unfinished token under the
// caret (cursor-at-end model) that drives autocomplete. Values stay raw strings — resolve.ts
// coerces them and upgrades bare `text` terms into predicates later.
// See docs/unified-search-and-data-cube-spec.md §3.3.
import { tokenize, type Token, type TokenKind } from './tokenize.js'
import type {
  Ast, CmpOp, DraftTail, Node, ParseError, ParseResult, Predicate, RawValue, SortKey,
} from './ast.js'

const COLON_OPS = new Set<TokenKind>(['colon', 'colon>', 'colon<', 'colon>=', 'colon<=', 'colon!'])
const CMP_OPS = new Set<TokenKind>(['cmp>', 'cmp<', 'cmp>=', 'cmp<=', 'cmp=', 'cmp!='])
const isOp = (k: TokenKind) => COLON_OPS.has(k) || CMP_OPS.has(k)

function opFor(k: TokenKind): CmpOp {
  switch (k) {
    case 'colon': case 'cmp=': return 'eq'
    case 'colon!': case 'cmp!=': return 'ne'
    case 'colon>': case 'cmp>': return 'gt'
    case 'colon>=': case 'cmp>=': return 'gte'
    case 'colon<': case 'cmp<': return 'lt'
    case 'colon<=': case 'cmp<=': return 'lte'
    default: return 'eq'
  }
}

export function parse(input: string): ParseResult {
  const tokens = tokenize(input)
  const sort: SortKey[] = []
  const groupBy: import('./ast.js').GroupKey[] = []
  const show: string[] = []
  const hide: string[] = []
  const errors: ParseError[] = []
  let pos = 0

  const cur = (): Token => tokens[pos]!
  const at = (k: TokenKind) => cur().kind === k
  const skipWs = () => { while (at('ws')) pos++ }
  const startsTerm = (k: TokenKind) => k === 'word' || k === 'string' || k === 'lparen' || k === 'not'
  const err = (message: string) => errors.push({ at: cur().start, message })

  function combine(type: 'and' | 'or', left: Node | null, right: Node | null): Node | null {
    if (!left) return right
    if (!right) return left
    if (left.t === type) { left.nodes.push(right); return left }
    return { t: type, nodes: [left, right] }
  }

  function parseOr(): Node | null {
    skipWs()
    let left = parseAnd()
    for (;;) {
      skipWs()
      if (at('or')) { pos++; skipWs(); left = combine('or', left, parseAnd()) }
      else break
    }
    return left
  }

  function parseAnd(): Node | null {
    let left = parseNot()
    for (;;) {
      const save = pos
      skipWs()
      const k = cur().kind
      if (k === 'and') { pos++; skipWs(); left = combine('and', left, parseNot()); continue }
      if (startsTerm(k)) { left = combine('and', left, parseNot()); continue }
      pos = save
      break
    }
    return left
  }

  function parseNot(): Node | null {
    skipWs()
    if (at('not')) { pos++; const node = parseNot(); return node ? { t: 'not', node } : null }
    return parseTerm()
  }

  function parseTerm(): Node | null {
    skipWs()
    const t = cur()
    if (t.kind === 'lparen') {
      pos++
      const inner = parseOr()
      skipWs()
      if (at('rparen')) pos++
      else err('expected )')
      return inner
    }
    if (t.kind === 'word') {
      pos++
      const nx = cur() // contiguous — no ws skip
      if (isOp(nx.kind)) return parsePredicate(t, nx)
      return { t: 'text', value: t.text!, literal: false }
    }
    if (t.kind === 'string') { pos++; return { t: 'text', value: t.text!, literal: true } }
    // unexpected token where a term was expected: record, consume one to guarantee progress
    if (t.kind !== 'eof') { err(`unexpected ${t.kind}`); pos++ }
    return null
  }

  function parsePredicate(head: Token, opTok: Token): Node | null {
    const field = head.text!
    pos++ // consume operator
    if (field === 'sort' || field === 'sort-by' || field === 'sortby') { parseSortValue(); return null }
    if (field === 'group' || field === 'group-by' || field === 'groupby') { parseGroupValue(); return null }
    if (field === 'show' || field === 'hide') { parseViewValue(field); return null }

    const v = parseValue()
    const op: CmpOp = v.op ?? opFor(opTok.kind)
    const endOffset = v.endOffset ?? opTok.end
    const node: Predicate = {
      t: 'pred', field, op, value: v.value,
      raw: input.slice(head.start, endOffset),
    }
    if (v.partial) node.partial = true
    return node
  }

  interface ValueResult { value: RawValue; op?: CmpOp; partial?: boolean; endOffset?: number }

  function parseValue(): ValueResult {
    const t = cur()
    if (t.kind === 'lbrack') {
      pos++
      const items: string[] = []
      for (;;) {
        const k = cur().kind
        if (k === 'word' || k === 'string') { items.push(cur().text!); pos++; continue }
        if (k === 'comma') { pos++; continue }
        if (k === 'rbrack') { pos++; break }
        break // unterminated list — tolerate
      }
      return { value: { k: 'list', v: items }, op: 'in', endOffset: tokens[pos - 1]!.end }
    }
    if (t.kind === 'range') { // open-start range  ..20000
      pos++
      let to: string | null = null
      if (at('word') || at('string')) { to = cur().text!; pos++ }
      return { value: { k: 'range', from: null, to }, op: 'range', endOffset: tokens[pos - 1]!.end }
    }
    if (t.kind === 'word' || t.kind === 'string') {
      const first = t.text!; pos++
      if (at('range')) {
        pos++
        let to: string | null = null
        if (at('word') || at('string')) { to = cur().text!; pos++ }
        return { value: { k: 'range', from: first, to }, op: 'range', endOffset: tokens[pos - 1]!.end }
      }
      return { value: { k: 'scalar', v: first }, endOffset: t.end }
    }
    // no value present (eof / ws / rparen) → partial predicate
    return { value: { k: 'scalar', v: '' }, partial: true }
  }

  function parseSortValue(): void {
    if (!at('word')) return
    let f = cur().text!; pos++
    let dir: 'asc' | 'desc' = 'asc'
    if (f.startsWith('-')) { dir = 'desc'; f = f.slice(1) } // -field → desc
    // suffix direction: field-up / field-down / field-asc / field-desc
    const m = f.match(/-(up|down|asc|desc)$/i)
    if (m) { const s = m[1]!.toLowerCase(); dir = s === 'down' || s === 'desc' ? 'desc' : 'asc'; f = f.slice(0, -(m[1]!.length + 1)) }
    if (at('colon')) { // field:asc / field:desc / field:up / field:down
      pos++
      if (at('word')) { const d = cur().text!.toLowerCase(); if (d === 'desc' || d === 'down') dir = 'desc'; else if (d === 'asc' || d === 'up') dir = 'asc'; pos++ }
    }
    if (f) sort.push({ field: f, dir })
  }

  function parseGroupValue(): void {
    if (!at('word')) return
    let f = cur().text!; pos++
    let dir: 'asc' | 'desc' | undefined
    if (f.startsWith('-')) { dir = 'desc'; f = f.slice(1) }
    if (f) groupBy.push(dir ? { field: f, dir } : { field: f })
  }

  function parseViewValue(kind: 'show' | 'hide'): void {
    if (!at('word')) return
    const f = cur().text!; pos++
    if (f) (kind === 'show' ? show : hide).push(f)
  }

  const where = parseOr()
  const ast: Ast = { where, sort, groupBy, view: { show, hide } }
  return { ast, tail: computeTail(tokens), errors }
}

/** The unfinished token under the caret (caret at end of input) — drives autocomplete. */
function computeTail(tokens: Token[]): DraftTail | null {
  const sig = tokens.filter((t) => t.kind !== 'eof')
  if (sig.length === 0) return null
  const trailingWs = sig[sig.length - 1]!.kind === 'ws'
  let idx = sig.length - 1
  while (idx >= 0 && sig[idx]!.kind === 'ws') idx--
  if (idx < 0) return null
  const e = sig[idx]!
  const prev = sig[idx - 1]
  const wordBefore = (opIdx: number): string | undefined => {
    const w = sig[opIdx - 1]
    return w && w.kind === 'word' ? w.text : undefined
  }

  if (COLON_OPS.has(e.kind) || CMP_OPS.has(e.kind)) {
    return { caretIn: 'value', field: wordBefore(idx), op: e.kind, text: '', start: e.end, end: e.end }
  }
  if (e.kind === 'range') {
    return { caretIn: 'value', field: prev ? wordBefore(idx - 1) : undefined, op: 'range', text: '', start: e.end, end: e.end }
  }
  if (e.kind === 'and' || e.kind === 'or' || e.kind === 'not' || e.kind === 'lparen') {
    return { caretIn: 'field', text: '', start: e.end, end: e.end }
  }
  if (e.kind === 'word' || e.kind === 'string') {
    const asValue = !!prev && (COLON_OPS.has(prev.kind) || CMP_OPS.has(prev.kind))
    if (trailingWs) return null // complete term + space → ready for a fresh term
    if (asValue) {
      return { caretIn: 'value', field: wordBefore(idx - 1), op: prev!.kind, text: e.text!, start: e.start, end: e.end }
    }
    return { caretIn: 'field', text: e.text!, start: e.start, end: e.end }
  }
  return null
}
