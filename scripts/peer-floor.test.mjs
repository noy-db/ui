import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { floorOf, planFloors, withRestoredFile } from './peer-floor.mjs'

describe('floorOf', () => {
  // The likeliest silent failure in this script. Every range in the family is a
  // pre-release, and `^0.6.0-pre.0` and `^0.6.0` are one character apart in a
  // refactor — but flooring at `0.6.0` would skip every pre-release the range
  // actually admits, so a range that is false for pre-releases would pass.
  it('floors a pre-release range at the pre-release, not the stable', () => {
    expect(floorOf('^0.6.0-pre.0')).toBe('0.6.0-pre.0')
    expect(floorOf('^0.6.0-pre.14')).toBe('0.6.0-pre.14')
  })

  it('floors an ordinary range', () => {
    expect(floorOf('^1.2.3')).toBe('1.2.3')
    expect(floorOf('>=2.0.0 <3.0.0')).toBe('2.0.0')
  })

  // semver.minVersion THROWS on a malformed range and returns null on a
  // valid-but-unsatisfiable one. Only the second reaches a `if (!min)` guard, so
  // a malformed range used to die with a raw stack trace naming neither the
  // package nor the range — while the friendly branch looked exercised.
  it('returns null for a malformed range instead of throwing', () => {
    expect(floorOf('not-a-range')).toBeNull()
  })

  it('returns null for a valid but unsatisfiable range', () => {
    expect(floorOf('>1.0.0 <1.0.0')).toBeNull()
  })

  // An unbounded range floors at 0.0.0 — a version no @noy-db package has ever
  // published (verified: @noy-db/hub@0.0.0 is E404, and none of its 86 versions
  // is 0.0.0). Checking against it fails minutes later as a baffling "no
  // matching version for @noy-db/hub@0.0.0" from the install step, which reads
  // as a registry problem rather than a malformed manifest.
  //
  // Detection is on the VALUE, not the range text: `<1.0.0` has an upper bound
  // and does not look unbounded at all, so any rule reasoning about "empty or
  // wildcard" misses it. One value check covers every spelling, including ones
  // nobody has enumerated yet.
  it.each(['', '   ', '*', 'x', '>=0.0.0', '<1.0.0', '1 || '])(
    'rejects the unbounded range %j rather than flooring it at 0.0.0',
    (range) => { expect(floorOf(range)).toBeNull() },
  )

  // The one that is not pedantry. The family's documented way to widen a peer
  // range is "widen by APPENDING (… || ^0.7.0-pre.0)", and this is exactly what
  // an interrupted edit leaves behind — the failure state of the procedure the
  // coordination file tells people to follow. It reads as almost-correct in a
  // diff, and it silently floors the whole range at 0.0.0.
  it('rejects a half-finished "widen by appending" edit', () => {
    expect(floorOf('^0.6.0-pre.0 || ')).toBeNull()
  })

  // Easy to over-correct into rejecting any low floor. 0.0.0 is the sentinel
  // precisely because it is unpublishable in this family; 0.0.1 is a real
  // version shape and must still be accepted.
  it('still accepts a genuinely low but bounded floor', () => {
    expect(floorOf('>=0.0.1')).toBe('0.0.1')
  })

  // The negative assertion: whatever arrives, the caller gets a value it can
  // report on, never a stack trace.
  it('never throws, whatever it is handed', () => {
    for (const bad of ['', '   ', 'not-a-range', '^^1', '>1.0.0 <1.0.0', 'latest', '@#$%', '1.2.3.4', null, undefined, 42, {}]) {
      expect(() => floorOf(bad)).not.toThrow()
      expect(floorOf(bad)).toBeNull()
    }
  })
})

const pkg = (name, peers) => ({ pj: { name, peerDependencies: peers } })

describe('planFloors', () => {
  it('collects one floor per peer when the packages agree', () => {
    const plan = planFloors([
      pkg('@noy-db/ui', { '@noy-db/hub': '^0.6.0-pre.0' }),
      pkg('@noy-db/ui-nuxt', { '@noy-db/hub': '^0.6.0-pre.0' }),
    ])
    expect(plan.floors).toEqual({ '@noy-db/hub': '0.6.0-pre.0' })
    expect(plan.conflicts).toEqual([])
    expect(plan.invalid).toEqual([])
  })

  it('ignores non-@noy-db peers', () => {
    const plan = planFloors([pkg('@noy-db/ui', { vue: '^3.5.0', '@nuxt/kit': '^4.0.0' })])
    expect(plan.floors).toEqual({})
  })

  it('reports a conflict when two packages declare different floors', () => {
    const plan = planFloors([
      pkg('@noy-db/ui', { '@noy-db/hub': '^0.6.0-pre.0' }),
      pkg('@noy-db/ui-suai', { '@noy-db/hub': '^0.6.0-pre.14' }),
    ])
    expect(plan.conflicts).toEqual([{ name: '@noy-db/hub', a: '0.6.0-pre.0', b: '0.6.0-pre.14' }])
  })

  it('reports a bad range as data naming the package and the range, not as a throw', () => {
    const plan = planFloors([pkg('@noy-db/ui', { '@noy-db/hub': 'not-a-range' })])
    expect(plan.invalid).toEqual([{ pkg: '@noy-db/ui', name: '@noy-db/hub', range: 'not-a-range' }])
    expect(plan.floors).toEqual({})
  })

  it('handles a package with no peerDependencies at all', () => {
    expect(planFloors([{ pj: { name: '@noy-db/ui' } }]).floors).toEqual({})
  })
})

describe('withRestoredFile', () => {
  const withTmp = (body) => {
    const dir = mkdtempSync(join(tmpdir(), 'peer-floor-'))
    const file = join(dir, 'package.json')
    try { return body(file) } finally { rmSync(dir, { recursive: true, force: true }) }
  }

  it('restores the file byte-for-byte after the body throws', () => {
    withTmp((file) => {
      const original = '{\n  "name": "root"\n}\n'
      writeFileSync(file, original)
      expect(() => withRestoredFile(file, () => {
        writeFileSync(file, '{"name":"MUTATED","pnpm":{"overrides":{}}}')
        throw new Error('install failed')
      })).toThrow('install failed')
      expect(readFileSync(file, 'utf8')).toBe(original)
    })
  })

  it('restores after a successful body too, and returns its value', () => {
    withTmp((file) => {
      const original = '{"name":"root"}\n'
      writeFileSync(file, original)
      const out = withRestoredFile(file, () => { writeFileSync(file, 'mutated'); return 'ok' })
      expect(out).toBe('ok')
      expect(readFileSync(file, 'utf8')).toBe(original)
    })
  })

  it('preserves exact bytes, including trailing newline and indentation', () => {
    withTmp((file) => {
      const original = '{\n\t"a": 1,\n\t"b": [2, 3]\n}\n\n'
      writeFileSync(file, original)
      withRestoredFile(file, () => writeFileSync(file, '{}'))
      expect(readFileSync(file, 'utf8')).toBe(original)
    })
  })
})
