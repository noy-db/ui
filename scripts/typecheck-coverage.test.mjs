import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')

// family#28. Every test file must be compiled by a program that `typecheck` actually
// runs — not merely by one that exists. Placement inside `typecheck` is the invariant,
// because `check-peer-floor` runs `typecheck` against the OLDEST hub the peer range
// admits: a test compiled anywhere else is absent from the floor check, which is the
// one check that can falsify our declared range.
//
// This repo already satisfies it, but by accident rather than by decision: its tests are
// colocated in `src/`, so `include: ["src"]` sweeps them up. Measured 2026-09-16 —
// 22 of 22 in the tsc program, falsified by planting a type error in a test file and
// watching `tsc --noEmit` fail. Moving them to `__tests__/`, the layout every sibling
// uses, would silently drop all 22 with no config change and no failing command.
// That is what this file exists to stop.
const PACKAGES = ['ui', 'ui-nuxt', 'ui-suai']

// The exclusions, by name and with the reason — never a silent skip.
//   examples/*  two private, separately-locked workspaces (`private: true`, own
//               lockfile, `file:` deps). Neither is published and neither is in
//               `pnpm-workspace.yaml`, so `turbo run typecheck` cannot reach them.
//               Their tests are typechecked by nothing; that is a known, declared gap.
//   scripts/    this harness. `.mjs` by convention — there is no TypeScript here to check.
const EXCLUDED = ['examples/', 'scripts/']

const tracked = (pattern) =>
  execFileSync('git', ['ls-files', pattern], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)

/** The files the package's own `typecheck` command compiles. */
function programOf(pkg) {
  const { scripts } = JSON.parse(readFileSync(join(ROOT, 'packages', pkg, 'package.json'), 'utf8'))
  // Follow the declared command rather than assuming `tsc` — the two Nuxt packages
  // typecheck with `vue-tsc`, and a check that quietly used the wrong compiler would
  // report a program the repo never builds.
  const bin = scripts.typecheck.trim().split(/\s+/)[0]
  const out = execFileSync(join(ROOT, 'node_modules/.bin', bin), ['-p', 'tsconfig.json', '--noEmit', '--listFiles'], {
    cwd: join(ROOT, 'packages', pkg),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return new Set(out.split('\n').filter(Boolean).map((f) => relative(ROOT, f)))
}

describe('typecheck covers the test files', () => {
  const testFiles = tracked('*.test.ts')
  const inPackages = testFiles.filter((f) => f.startsWith('packages/'))

  it('names its denominator, so a shrunken set is visible rather than inferred', () => {
    // A coverage check that reports only pass/fail passes loudest when it has stopped
    // looking at anything. Both halves are asserted non-empty on purpose.
    expect(testFiles.length).toBeGreaterThan(0)
    expect(inPackages.length).toBeGreaterThan(0)
  })

  it('accounts for every tracked test file — covered, or excluded by name', () => {
    const unaccounted = testFiles.filter(
      (f) => !f.startsWith('packages/') && !EXCLUDED.some((e) => f.startsWith(e)),
    )
    expect(unaccounted).toEqual([])
  })

  for (const pkg of PACKAGES) {
    const owned = inPackages.filter((f) => f.startsWith(`packages/${pkg}/`))
    if (owned.length === 0) {
      // Not a pass by default: if this package ever gains a test file, the branch flips
      // and the program assertion below starts applying to it.
      it(`packages/${pkg} has no test files`, () => expect(owned).toEqual([]))
      continue
    }
    it(`packages/${pkg}: all ${owned.length} test files are in the typecheck program`, () => {
      const program = programOf(pkg)
      expect(owned.filter((f) => !program.has(f))).toEqual([])
    })
  }
})
