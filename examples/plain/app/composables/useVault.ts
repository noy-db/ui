import { shallowRef, computed } from 'vue'
import type { Vault } from '@noy-db/hub'
import { openVaultFromBundle } from '../../src/data/vault'
import { declareCollections } from '../../src/data/collections'

// shallowRef: the vault is an encryption engine, not view state (deep-reactifying breaks
// zod internals and costs proxy overhead) — same pattern as the showcase.
const vault = shallowRef<Vault | null>(null)

export function useVault() {
  async function unlock(secret: string) {
    const bytes = new Uint8Array(await fetch('/demo.noydb').then((r) => r.arrayBuffer()))
    const v = await openVaultFromBundle(bytes, secret) // throws InvalidKeyError on the wrong secret
    const { artists, labels, records } = declareCollections(v)
    await records.list()
    await artists.list()
    await labels.list()
    vault.value = v
  }
  return { vault, unlock, locked: computed(() => vault.value === null) }
}
