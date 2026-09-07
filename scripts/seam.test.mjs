import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const SRC = ['packages/ui/src', 'packages/ui-nuxt/src', 'packages/ui-suai/src']

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|vue)$/.test(e) && !/\.test\.ts$/.test(e)) out.push(p)
  }
  return out
}

// #1021. These three packages bind noy-db through ONE published seam:
// `@noy-db/hub/introspection`, which carries the describe types. Binding the bare
// package root instead makes any hub root-export change a potential break here —
// the opposite of what a stable release promises. `/ui` will never exist
// (noy-db #1002, closed NOT_PLANNED), so `/introspection` is the target.
//
// Not an eslint rule: the flat config ignores `**/*.vue`, so a lint rule would
// cover six of the nine files and look complete. Three of them are SFCs.
//
// Test files are exempt and legitimately import the root — they construct real
// vaults with createNoydb/dict/enumOf/ref, which are runtime values the
// introspection subpath does not carry.
describe('the published hub seam', () => {
  const files = SRC.flatMap((d) => walk(join(ROOT, d)))

  it('scans every published source file, .vue included', () => {
    expect(files.length).toBeGreaterThan(20)
    expect(files.some((f) => f.endsWith('.vue'))).toBe(true)
  })

  // Exactly one file may still import the bare root, and only for one symbol.
  // StandardSchemaV1Issue reached ./introspection in hub 0.6.0-pre.9 (measured: absent
  // at pre.8, present at pre.9) while our peer floor is ^0.6.0-pre.0 — so moving it would
  // make the declared range false. Pinned as data rather than waived, so the exception
  // cannot quietly grow: a second file, or a second symbol, fails this.
  const ROOT_OK = 'packages/ui/src/form.ts'

  it('imports the bare @noy-db/hub root from exactly one published file', () => {
    const offenders = files
      .filter((f) => /from '@noy-db\/hub'/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(ROOT.length + 1))
    expect(offenders).toEqual([ROOT_OK])
  })

  it('takes only StandardSchemaV1Issue from the root, and only as a type', () => {
    const line = readFileSync(join(ROOT, ROOT_OK), 'utf8')
      .split('\n')
      .find((l) => /from '@noy-db\/hub'/.test(l))
    expect(line).toBe("import type { StandardSchemaV1Issue } from '@noy-db/hub'")
  })

  it('binds the describe types through /introspection', () => {
    const bound = files.filter((f) => /from '@noy-db\/hub\/introspection'/.test(readFileSync(f, 'utf8')))
    expect(bound.length).toBeGreaterThan(0)
  })
})
