/**
 * Pure half of the peer-floor guard: work out WHICH versions to check, and keep
 * `package.json` safe while checking them. Split out from
 * `check-peer-floor.mjs` so it can be unit-tested without installing anything —
 * importing this module runs no pnpm, touches no network, and takes no minutes.
 *
 * The guard has two halves and only one of them is unit-testable. This one is
 * pure, fast, and silently regressible — exactly the shape that needs tests.
 * The other half (install at the floor, build, typecheck) is what the CI job
 * proves; a fixture faking a real floor failure would only test the fixture.
 * So: the CI job proves the guard can ANSWER the question, these tests prove it
 * still ASKS the right one.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const semver = createRequire(import.meta.url)('semver')

/**
 * The oldest version a range admits, as a string — or null when there isn't one.
 *
 * Wraps `semver.minVersion`, which fails two different ways for two different
 * kinds of bad range: it THROWS on an unparseable one ('not-a-range') and
 * RETURNS NULL on a well-formed one nothing satisfies ('>1.0.0 <1.0.0'). A bare
 * `if (!min)` guard only ever caught the second, so a malformed range died with
 * a raw TypeError naming neither the package nor the range — while the friendly
 * branch looked exercised, because the null path did reach it.
 *
 * Collapsing both into null means a caller has one case to handle and can
 * always report which package and which range, never a stack trace.
 */
export function floorOf(range) {
  let min
  try {
    min = semver.minVersion(range)
  } catch {
    return null
  }
  if (!min) return null

  // An unbounded range floors at 0.0.0, and that is checked on the VALUE rather
  // than on the range text on purpose. At least eight spellings reach it — ''
  // '   ' '*' 'x' '>=0.0.0' '<1.0.0' '1 || ' '^0.6.0-pre.0 || ' — and two of
  // them defeat any text rule: `<1.0.0` carries an UPPER bound so it does not
  // read as unbounded at all, and `^0.6.0-pre.0 || ` is a half-finished "widen
  // by appending", the failure state of the very procedure the family
  // coordination file prescribes. One value check covers all of them, and the
  // ninth nobody has found.
  //
  // The sentinel works because no @noy-db package has ever published 0.0.0 —
  // verified for this repo's only peer: @noy-db/hub@0.0.0 is E404 and none of
  // its 86 published versions is 0.0.0. If one ever ships a 0.0.0 this
  // detection silently becomes wrong.
  //
  // Only 0.0.0 is the sentinel: '>=0.0.1' floors at 0.0.1 and is a real, if
  // unusual, bound — rejecting low floors generally would be an over-correction.
  if (min.version === '0.0.0') return null

  return min.version
}

/**
 * Compute one floor per `@noy-db/*` peer across the workspace's packages.
 *
 * Returns data rather than exiting, so the caller owns presentation and the
 * whole thing is testable: `{ floors, conflicts, invalid }`. `conflicts` means
 * two packages disagree about the same peer — these three ship in lockstep and
 * changesets does not enforce it (`fixed: []`), so a divergence is a signal, not
 * a case to merge. `invalid` carries the ranges `floorOf` could not read.
 */
export function planFloors(pkgs) {
  const floors = {}
  const conflicts = []
  const invalid = []

  for (const { pj } of pkgs) {
    for (const [name, range] of Object.entries(pj.peerDependencies ?? {})) {
      if (!name.startsWith('@noy-db/')) continue
      const floor = floorOf(range)
      if (floor === null) {
        invalid.push({ pkg: pj.name, name, range })
        continue
      }
      if (floors[name] && floors[name] !== floor) conflicts.push({ name, a: floors[name], b: floor })
      floors[name] = floor
    }
  }

  return { floors, conflicts, invalid }
}

/**
 * Run `body` with `file` restored to its exact original bytes afterwards, on
 * success and on failure alike, then rethrow whatever `body` threw.
 *
 * The guard mutates the root `package.json` to inject `pnpm.overrides` pinning
 * each floor. A restore regression corrupts the repo it was checking — and does
 * it on the failure path, where the run is already red and nobody is reading the
 * working tree. Byte-for-byte matters: re-serializing the JSON would silently
 * reformat indentation and drop the trailing newline.
 */
export function withRestoredFile(file, body) {
  const original = readFileSync(file, 'utf8')
  try {
    return body()
  } finally {
    writeFileSync(file, original)
  }
}
