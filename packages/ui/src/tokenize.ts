// Character scanner for the search DSL. Produces a flat token stream with absolute offsets and
// NEVER throws (an unterminated quote is flagged, not fatal) — the parser builds on this for live,
// error-tolerant autocomplete. The key design choice: `..` is the ONLY structural range operator;
// `-`, `.`, `/`, `+` stay INSIDE words, so ISO dates (2026-03-01), reg numbers (2026/0007),
// money (€5000+) and text-ranges (10000-20000) are single word tokens and the `-` ambiguity is
// deferred to value resolution. A leading `-`/`!` at a term boundary (or the `NOT` keyword) is
// negation. See docs/unified-search-and-data-cube-spec.md §3.3.

export type TokenKind =
  | 'ws'
  | 'word'
  | 'string'
  | 'colon' | 'colon>' | 'colon<' | 'colon>=' | 'colon<=' | 'colon!'
  | 'cmp>' | 'cmp<' | 'cmp>=' | 'cmp<=' | 'cmp=' | 'cmp!='
  | 'lparen' | 'rparen' | 'lbrack' | 'rbrack' | 'comma' | 'range'
  | 'and' | 'or' | 'not'
  | 'eof'

export interface Token {
  kind: TokenKind
  /** Present for `word` and `string` tokens. */
  text?: string
  start: number
  end: number
  /** `string` only: the closing quote was missing. */
  unterminated?: boolean
}

/** Characters that always break a word (besides whitespace). `-`/`.`/`+`/`/`/`@` are NOT here. */
const STRUCTURAL = new Set(['"', '(', ')', '[', ']', ',', ':', '<', '>', '=', '!', '&', '|'])

const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r'
const isWordChar = (c: string) => !isSpace(c) && !STRUCTURAL.has(c)

export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  const n = input.length
  let i = 0
  // True when the next token would start a fresh term (so a leading - / ! means negation).
  let atBoundary = true

  const push = (kind: TokenKind, start: number, end: number, extra?: Partial<Token>) => {
    tokens.push({ kind, start, end, ...extra })
  }

  while (i < n) {
    const c = input[i]!

    // whitespace (collapsed into one ws token; marks a term boundary)
    if (isSpace(c)) {
      const start = i
      while (i < n && isSpace(input[i]!)) i++
      push('ws', start, i)
      atBoundary = true
      continue
    }

    // quoted string (literal) — never tokenized further
    if (c === '"') {
      const start = i
      i++ // opening quote
      let text = ''
      let unterminated = true
      while (i < n) {
        const ch = input[i]!
        if (ch === '\\' && i + 1 < n && input[i + 1] === '"') { text += '"'; i += 2; continue }
        if (ch === '"') { i++; unterminated = false; break }
        text += ch
        i++
      }
      push('string', start, i, { text, ...(unterminated ? { unterminated: true } : {}) })
      atBoundary = false
      continue
    }

    // structural singles & multis
    if (c === '(') { push('lparen', i, i + 1); i++; atBoundary = true; continue }
    if (c === ')') { push('rparen', i, i + 1); i++; atBoundary = false; continue }
    if (c === '[') { push('lbrack', i, i + 1); i++; atBoundary = false; continue }
    if (c === ']') { push('rbrack', i, i + 1); i++; atBoundary = false; continue }
    if (c === ',') { push('comma', i, i + 1); i++; atBoundary = false; continue }
    if (c === '&') { push('and', i, i + 1); i++; atBoundary = true; continue }
    if (c === '|') { push('or', i, i + 1); i++; atBoundary = true; continue }

    // range `..`
    if (c === '.' && input[i + 1] === '.') { push('range', i, i + 2); i += 2; atBoundary = false; continue }

    // colon operator family
    if (c === ':') {
      const start = i
      const next2 = input.slice(i + 1, i + 3)
      if (next2 === '>=') { push('colon>=', start, i + 3); i += 3 }
      else if (next2 === '<=') { push('colon<=', start, i + 3); i += 3 }
      else if (input[i + 1] === '>') { push('colon>', start, i + 2); i += 2 }
      else if (input[i + 1] === '<') { push('colon<', start, i + 2); i += 2 }
      else if (input[i + 1] === '!') { push('colon!', start, i + 2); i += 2 }
      else { push('colon', start, i + 1); i += 1 }
      atBoundary = false
      continue
    }

    // comparison operators (bare)
    if (c === '>') { if (input[i + 1] === '=') { push('cmp>=', i, i + 2); i += 2 } else { push('cmp>', i, i + 1); i++ }; atBoundary = false; continue }
    if (c === '<') { if (input[i + 1] === '=') { push('cmp<=', i, i + 2); i += 2 } else { push('cmp<', i, i + 1); i++ }; atBoundary = false; continue }
    if (c === '=') { push('cmp=', i, i + 1); i++; atBoundary = false; continue }
    if (c === '!') {
      if (input[i + 1] === '=') { push('cmp!=', i, i + 2); i += 2; atBoundary = false }
      else { push('not', i, i + 1); i++; atBoundary = true } // bare ! = NOT
      continue
    }

    // leading - at a term boundary = negation; otherwise it's part of a word
    if (c === '-' && atBoundary && i + 1 < n && isWordChar(input[i + 1]!) && input[i + 1] !== '-') {
      push('not', i, i + 1); i++; atBoundary = true; continue
    }

    // word: maximal run of word chars; stop at `..`
    const start = i
    let text = ''
    while (i < n) {
      const ch = input[i]!
      if (!isWordChar(ch)) break
      if (ch === '.' && input[i + 1] === '.') break // `..` range follows
      text += ch
      i++
    }
    if (text.length === 0) { // a stray char we don't recognize — consume one to guarantee progress
      i++
      continue
    }
    const upper = text.toUpperCase()
    if (upper === 'AND') { push('and', start, i); atBoundary = true }
    else if (upper === 'OR') { push('or', start, i); atBoundary = true }
    else if (upper === 'NOT') { push('not', start, i); atBoundary = true }
    else { push('word', start, i, { text }); atBoundary = false }
  }

  push('eof', n, n)
  return tokens
}
