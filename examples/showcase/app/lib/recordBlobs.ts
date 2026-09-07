import type { Vault } from '@noy-db/hub'
import { attachmentSlot } from '@noy-db/ui'

// Demo blobs for a record — seeded lazily/session-only (blobs don't travel in the demo bundle; see
// scripts/seed.ts). Two families the detail page renders with different UIs:
//   • MEDIA (images + a short video) — real bytes, so previews / duration work.
//   • DOCUMENTS (paperwork) — zero-filled placeholders at a plausible size; the type icon comes
//     from the filename/MIME, not the content.

// Generate a gradient PNG in-browser at a real size, so image previews show meaningful dimensions.
async function makeImage(w: number, h: number, hue: number, label: string): Promise<Uint8Array> {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, `hsl(${hue} 62% 55%)`); g.addColorStop(1, `hsl(${(hue + 55) % 360} 55% 32%)`)
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(w * 0.72, h * 0.32, 40 + i * 34, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke() }
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = `bold ${Math.round(h * 0.085)}px system-ui, sans-serif`
  ctx.fillText(label, w * 0.06, h * 0.9)
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
  return new Uint8Array(await blob!.arrayBuffer())
}
async function fetchBytes(url: string): Promise<Uint8Array> {
  return new Uint8Array(await fetch(url).then((r) => r.arrayBuffer()))
}

const DEMO_DOCS: readonly { readonly name: string; readonly mime: string; readonly kb: number }[] = [
  { name: 'provenance.pdf', mime: 'application/pdf', kb: 214 },
  { name: 'appraisal.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kb: 38 },
  { name: 'liner-notes.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kb: 52 },
  { name: 'press-kit.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kb: 256 },
  { name: 'discography.csv', mime: 'text/csv', kb: 6 },
  { name: 'masters-archive.zip', mime: 'application/zip', kb: 180 },
  { name: 'metadata.json', mime: 'application/json', kb: 3 },
  { name: 'catalog.sql', mime: 'application/sql', kb: 12 },
  { name: 'authenticity.pem', mime: 'application/x-pem-file', kb: 2 },
  { name: 'tour-dates.ics', mime: 'text/calendar', kb: 4 },
  { name: 'label-contact.vcf', mime: 'text/vcard', kb: 1 },
  { name: 'collectors-guide.epub', mime: 'application/epub+zip', kb: 148 },
]

const seeded = new Set<string>()

/** Seed the demo media + documents on a record once per session, unless it already has attachments. */
export async function seedRecordBlobs(vault: Vault, recordId: string): Promise<void> {
  if (seeded.has(recordId)) return
  seeded.add(recordId)
  const blob = vault.collection('records').blob(recordId)
  if ((await blob.list()).some((s) => s.name.startsWith('att:'))) return // never clobber real uploads

  // Media — generated stills + the sample clip (real bytes, so previews and duration work).
  const media: { name: string; mime: string; bytes: Uint8Array }[] = [
    { name: 'sleeve-front.png', mime: 'image/png', bytes: await makeImage(1000, 667, 210, 'Sleeve — front') },
    { name: 'sleeve-back.png', mime: 'image/png', bytes: await makeImage(1000, 667, 28, 'Sleeve — back') },
    { name: 'label-detail.png', mime: 'image/png', bytes: await makeImage(760, 760, 140, 'Label detail') },
    { name: 'live-set.mp4', mime: 'video/mp4', bytes: await fetchBytes('/media/live-set.mp4') },
  ]
  for (const m of media) await blob.put(attachmentSlot(`demo-${m.name}`), m.bytes, { filename: m.name, mimeType: m.mime })

  // Documents — zero-filled placeholders at a plausible size.
  for (const d of DEMO_DOCS) await blob.put(attachmentSlot(`demo-${d.name}`), new Uint8Array(d.kb * 1024), { filename: d.name, mimeType: d.mime })
}
