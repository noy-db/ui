import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { openVaultFromBundle } from '../vault'

const PASS = 'spin-the-black-circle'
const BUNDLE = fileURLToPath(new URL('../../../public/demo.noydb', import.meta.url))

// The committed bundle is only ever read by the browser (useVault.ts fetches
// /demo.noydb) — no other test touches it. It was written by an older hub than
// the one this example now pins, so this is the only guard that a pin bump does
// not silently break the shipped artefact for everyone who never re-seeds.
describe('the committed demo bundle', () => {
  it('still opens under the pinned hub', async () => {
    const vault = await openVaultFromBundle(new Uint8Array(await readFile(BUNDLE)), PASS)

    // list() (not query().toArray()) — see the note in spike-secret.test.ts.
    expect(await vault.collection('records').list()).toHaveLength(24)
    expect(await vault.collection('artists').list()).toHaveLength(9)
    expect(await vault.collection('labels').list()).toHaveLength(5)
  })
})
