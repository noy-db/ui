import { fileURLToPath } from 'node:url'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { type Vault } from '@noy-db/hub'
import { toBytes } from '@noy-db/as-noydb'
import { buildVault } from '../src/data/vault'
import { makeCover } from '../src/data/cover'
import { artists, labels, records } from '../src/data/dataset'
import { declareCollections } from '../src/data/collections'

const PASS = 'spin-the-black-circle'

export interface SeedResult {
  vault: Vault
  /** dataset authoring id (rc01/ar1/lb1) → allocated serial id (RC-001/AR-001/LB-001) */
  recordIds: ReadonlyMap<string, string>
}

export async function seedVault(): Promise<SeedResult> {
  const { vault } = await buildVault(PASS)

  // Note: enum-value dictionaries are NOT seeded — the static lookup tables live in-code
  // (dicts.ts) and travel with the app, not the bundle. The bundle carries the raw enum
  // keys (e.g. `genre: 'rock'`).

  // --- collections ---
  const { artists: artistsCol, labels: labelsCol, records: recordsCol } = declareCollections(vault)

  // --- serial ids (hub sequence service): each row's id is allocated from a per-collection
  //     gap-free counter with a formatted serial (AR-001, LB-001, RC-001). The dataset's
  //     authoring ids (ar1/lb1/rc01) exist only to express references and are remapped here.
  //     Sequence state travels in the pod, so a reopened vault continues at 10/6/25. ---
  const artistSeq = vault.sequence('artists', { format: 'AR-{seq:03}' })
  const labelSeq = vault.sequence('labels', { format: 'LB-{seq:03}' })
  const recordSeq = vault.sequence('records', { format: 'RC-{seq:03}' })

  const artistIds = new Map<string, string>()
  for (const a of artists) {
    const { formatted } = await artistSeq.next()
    artistIds.set(a.id, formatted)
    await artistsCol.put(formatted, { ...a, id: formatted })
  }
  const labelIds = new Map<string, string>()
  for (const l of labels) {
    const { formatted } = await labelSeq.next()
    labelIds.set(l.id, formatted)
    await labelsCol.put(formatted, { ...l, id: formatted })
  }
  const recordIds = new Map<string, string>()
  // --- seed rows (records only; blobs are NOT written here — they don't
  //     survive the bundle export, so covers ship as static assets and the
  //     browser writes them into the vault at runtime, see Plan B) ---
  for (const r of records) {
    const { formatted } = await recordSeq.next()
    recordIds.set(r.id, formatted)
    await recordsCol.put(formatted, {
      ...r,
      id: formatted,
      artistId: artistIds.get(r.artistId)!,
      labelId: labelIds.get(r.labelId)!,
    })
  }

  return { vault, recordIds }
}

/** Cover PNG bytes per SERIAL record id — written as static assets by `main()`. */
export function coverFiles(recordIds: ReadonlyMap<string, string>): { id: string; bytes: Uint8Array }[] {
  return records.map((r) => ({ id: recordIds.get(r.id)!, bytes: makeCover(r.title['en'] ?? r.id) }))
}

// Executed by `pnpm seed`.
async function main() {
  const { vault, recordIds } = await seedVault()
  const bytes = await toBytes(vault)
  const here = dirname(fileURLToPath(import.meta.url))
  const publicDir = join(here, '..', 'public')
  await mkdir(publicDir, { recursive: true })
  const out = join(publicDir, 'demo.noydb')
  await writeFile(out, bytes)

  // Covers ship as static assets (blobs don't travel in the bundle), keyed by serial id.
  const covers = coverFiles(recordIds)
  const coversDir = join(publicDir, 'covers')
  await mkdir(coversDir, { recursive: true })
  for (const { id, bytes: png } of covers) {
    await writeFile(join(coversDir, `${id}.png`), png)
  }
  console.log(`wrote ${out} (${bytes.length} bytes) + ${covers.length} covers`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
