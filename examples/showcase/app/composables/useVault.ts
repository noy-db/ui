import { shallowRef, computed } from 'vue'
import type { Vault } from '@noy-db/hub'
import { openVaultFromBundle } from '../../src/data/vault'
import { declareCollections } from '../../src/data/collections'

// shallowRef: the vault is an encryption engine, not view state — deep-reactifying it
// wraps its internals (incl. zod schemas) in Vue proxies, which breaks zod 4's
// toJSONSchema ('_zod' is non-configurable) and costs proxy overhead on every read.
const vault = shallowRef<Vault | null>(null)

export function useVault() {
  async function unlock(secret: string) {
    const bytes = new Uint8Array(await fetch('/demo.noydb').then((r) => r.arrayBuffer()))
    const v = await openVaultFromBundle(bytes, secret) // throws InvalidKeyError on the wrong secret
    // Re-declare all collections with full config (schema + refs + fieldMeta) so
    // describe() returns rich metadata after reopen, then hydrate.
    const { artists, labels, records } = declareCollections(v)
    await records.list()
    await artists.list()
    await labels.list()
    vault.value = v
  }
  return { vault, unlock, locked: computed(() => vault.value === null) }
}
