// AST → canonical query string (A6). Re-parses to an equivalent AST (round-trip), so it backs
// ?q= URLs, saved searches and history. Operators render in their canonical colon forms; values
// with spaces are quoted; precedence is preserved with parentheses only where needed (an OR child
// inside an AND). See docs/unified-search-and-data-cube-spec.md §3.2.
import type { Ast, Node, Predicate, RawValue } from './ast.js'

const needsQuote = (s: string) => /[\s()[\],"]/.test(s) || s === ''
const q = (s: string) => (needsQuote(s) ? `"${s.replace(/"/g, '\\"')}"` : s)

const OP_PREFIX: Record<Predicate['op'], string> = {
  eq: ':', ne: ':!', gt: ':>', gte: ':>=', lt: ':<', lte: ':<=', in: ':', range: ':',
}

function value(v: RawValue): string {
  if (v.k === 'scalar') return q(v.v)
  if (v.k === 'list') return `[${v.v.map(q).join(',')}]`
  return `${v.from == null ? '' : q(v.from)}..${v.to == null ? '' : q(v.to)}`
}

function predicate(p: Predicate): string {
  return `${p.field}${OP_PREFIX[p.op]}${value(p.value)}`
}

function node(n: Node, insideAnd = false): string {
  switch (n.t) {
    case 'pred': return predicate(n)
    case 'text': return n.literal ? `"${n.value.replace(/"/g, '\\"')}"` : q(n.value)
    case 'not': {
      const inner = n.node
      if (inner.t === 'and' || inner.t === 'or') return `NOT (${node(inner)})`
      return `-${node(inner)}`
    }
    case 'and': return n.nodes.map((c) => node(c, true)).join(' ')
    case 'or': {
      const s = n.nodes.map((c) => node(c)).join(' OR ')
      return insideAnd ? `(${s})` : s
    }
  }
}

export function serialize(ast: Ast): string {
  const parts: string[] = []
  if (ast.where) parts.push(node(ast.where))
  for (const s of ast.sort) parts.push(`sort:${s.dir === 'desc' ? `${s.field}:desc` : s.field}`)
  for (const g of ast.groupBy) parts.push(`group:${g.dir === 'desc' ? `${g.field}:desc` : g.field}`)
  for (const f of ast.view?.show ?? []) parts.push(`show:${f}`)
  for (const f of ast.view?.hide ?? []) parts.push(`hide:${f}`)
  return parts.join(' ')
}
