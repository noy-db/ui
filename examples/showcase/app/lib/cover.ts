import type { Vault } from '@noy-db/hub'
import { COVER_FIELD, COVER_SLOT } from '../../src/data/vault'

// fetchPng defaults to the static asset; injectable for tests.
export async function loadCoverBytes(
  vault: Vault, id: string,
  fetchPng: (id: string) => Promise<Uint8Array> = (i) =>
    fetch(`/covers/${i}.png`).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b)),
): Promise<Uint8Array> {
  const records = vault.collection('records', { blobFields: { [COVER_FIELD]: { retainDays: 36500 } } })
  // If a cover already exists (e.g. one the user uploaded this session), keep it — don't overwrite
  // with the shipped static art. Only seed the static PNG on first access.
  const existing = await records.blob(id).get(COVER_SLOT)
  if (existing) return existing
  const png = await fetchPng(id)
  await records.blob(id).put(COVER_SLOT, png, { mimeType: 'image/png' })
  const back = await records.blob(id).get(COVER_SLOT)
  if (!back) throw new Error(`cover blob missing for ${id}`)
  return back
}

/** Store a user-cropped cover for a record (overwrites the seeded/static art for the session). */
export async function saveCoverBytes(vault: Vault, id: string, bytes: Uint8Array): Promise<void> {
  const records = vault.collection('records', { blobFields: { [COVER_FIELD]: { retainDays: 36500 } } })
  await records.blob(id).put(COVER_SLOT, bytes, { mimeType: 'image/png' })
}
