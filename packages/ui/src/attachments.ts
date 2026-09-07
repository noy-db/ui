// Attachment-gallery helpers — the Item-family blob surface (Item Release P5).
//
// A record's blob handle (`collection.blob(id)`) holds freeform-named slots: the cover lives in a
// reserved slot, attachments in `att:<uuid>` slots. `attachmentList` filters a `blob(id).list()`
// result to the attachment slots and derives the per-item view model (kind, human size, mime).
// Pure + framework-free; AttachmentGallery.vue renders it and owns the objectURL lifecycle.

/** The slot-name prefix that marks a user attachment (keeps the cover + named slots out). */
export const ATTACHMENT_PREFIX = 'att:'

/** A `blob(id).list()` entry — the fields this module reads (the hub returns more, e.g. eTag). */
export interface BlobSlotInfo {
  readonly name: string
  readonly filename?: string
  readonly size?: number
  readonly mimeType?: string
  readonly uploadedAt?: string
  readonly uploadedBy?: string
}

export interface AttachmentItem {
  /** The full slot name (`att:<uuid>`) — pass to `blob(id).get/delete`. */
  readonly slot: string
  /** Display filename (falls back to the slot's uuid tail). */
  readonly filename: string
  readonly mime: string
  readonly size: number
  readonly humanSize: string
  readonly kind: 'image' | 'file'
  readonly uploadedAt?: string
  readonly uploadedBy?: string
}

/** `1234` → `1.2 KB`. Binary units, one decimal above KB. */
export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

/** Make an `att:` slot name for a fresh upload. Caller supplies the uuid (framework-free). */
export function attachmentSlot(uuid: string): string {
  return `${ATTACHMENT_PREFIX}${uuid}`
}

/** One of the ~20 recognised attachment kinds (`file` is the catch-all). */
export type FileCategoryKind =
  | 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'spreadsheet' | 'presentation'
  | 'archive' | 'code' | 'json' | 'markup' | 'text' | 'font' | 'ebook' | 'calendar'
  | 'contact' | 'disk' | 'database' | 'certificate' | 'application' | 'file'

/** Display classification for an attachment — drives the row icon + a friendly type label. */
export interface FileCategory {
  readonly category: FileCategoryKind
  /** Friendly type name, e.g. `PDF document`, `Spreadsheet`. */
  readonly label: string
  /** Lucide icon class for the tile (only a fallback for images, which show a thumbnail). */
  readonly icon: string
}

// Ordered rules — first match wins (MIME preferred, then extension). The broad `image/`, `audio/`,
// `video/`, `text/` MIME prefixes sit AFTER the specific rules they'd otherwise swallow (csv → sheet,
// html → markup, code → code).
interface Rule { readonly category: FileCategoryKind; readonly label: string; readonly icon: string; readonly mime?: RegExp; readonly ext: readonly string[] }
const RULES: readonly Rule[] = [
  { category: 'image', label: 'Image', icon: 'i-lucide-file-image', mime: /^image\//, ext: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'heic', 'heif', 'avif'] },
  { category: 'pdf', label: 'PDF document', icon: 'i-lucide-file-text', mime: /\/pdf$/, ext: ['pdf'] },
  { category: 'spreadsheet', label: 'Spreadsheet', icon: 'i-lucide-file-spreadsheet', mime: /spreadsheet|ms-excel|csv/, ext: ['xlsx', 'xls', 'ods', 'csv', 'tsv', 'numbers'] },
  { category: 'presentation', label: 'Presentation', icon: 'i-lucide-presentation', mime: /presentation|powerpoint/, ext: ['pptx', 'ppt', 'odp', 'key'] },
  { category: 'document', label: 'Document', icon: 'i-lucide-file-type', mime: /msword|wordprocessing|opendocument\.text|\/rtf/, ext: ['docx', 'doc', 'odt', 'rtf', 'pages'] },
  // E-book before archive: EPUB is a zip container (`application/epub+zip`) that must not read as an archive.
  { category: 'ebook', label: 'E-book', icon: 'i-lucide-book-open', mime: /epub/, ext: ['epub', 'mobi', 'azw', 'azw3'] },
  { category: 'archive', label: 'Archive', icon: 'i-lucide-file-archive', mime: /zip|compressed|tar|x-7z|x-rar/, ext: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'] },
  { category: 'json', label: 'JSON', icon: 'i-lucide-file-json', mime: /\/json$/, ext: ['json', 'jsonl', 'geojson'] },
  { category: 'markup', label: 'Markup', icon: 'i-lucide-code-xml', mime: /html|\/xml$|\+xml/, ext: ['html', 'htm', 'xml', 'xhtml'] },
  { category: 'code', label: 'Code', icon: 'i-lucide-file-code', mime: /javascript|typescript|x-python|x-sh/, ext: ['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'vue', 'py', 'rb', 'php', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'cs', 'go', 'rs', 'css', 'scss', 'sh', 'yml', 'yaml', 'toml'] },
  { category: 'database', label: 'Database', icon: 'i-lucide-database', ext: ['sql', 'db', 'sqlite', 'sqlite3'] },
  { category: 'font', label: 'Font', icon: 'i-lucide-type', mime: /^font\//, ext: ['ttf', 'otf', 'woff', 'woff2', 'eot'] },
  { category: 'calendar', label: 'Calendar', icon: 'i-lucide-calendar', mime: /calendar/, ext: ['ics'] },
  { category: 'contact', label: 'Contact', icon: 'i-lucide-contact', mime: /vcard/, ext: ['vcf'] },
  { category: 'certificate', label: 'Certificate', icon: 'i-lucide-file-key', ext: ['pem', 'key', 'crt', 'cert', 'cer', 'p12', 'pfx', 'asc', 'gpg'] },
  { category: 'disk', label: 'Disk image', icon: 'i-lucide-disc', ext: ['dmg', 'iso', 'img'] },
  { category: 'application', label: 'Application', icon: 'i-lucide-file-cog', ext: ['exe', 'msi', 'app', 'bin', 'apk', 'deb', 'rpm'] },
  { category: 'audio', label: 'Audio', icon: 'i-lucide-file-audio', mime: /^audio\//, ext: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'aiff'] },
  { category: 'video', label: 'Video', icon: 'i-lucide-film', mime: /^video\//, ext: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'] },
  { category: 'text', label: 'Text file', icon: 'i-lucide-file-text', mime: /^text\//, ext: ['txt', 'md', 'markdown', 'log', 'text'] },
]

/**
 * Classify an attachment by MIME type (preferred) then filename extension into a display category,
 * with a friendly label and an icon — so a non-image (a PDF, a spreadsheet, an archive, a font…)
 * reads as what it is instead of a generic blob. The hub MIME-sniffs by magic bytes, so `mime` is
 * reliable even when the browser gave no `file.type`.
 */
export function fileCategory(mime: string, filename: string): FileCategory {
  const m = mime.toLowerCase()
  const ext = (filename.split('.').pop() ?? '').toLowerCase()
  for (const r of RULES) {
    if ((r.mime && r.mime.test(m)) || r.ext.includes(ext)) return { category: r.category, label: r.label, icon: r.icon }
  }
  return { category: 'file', label: 'File', icon: 'i-lucide-file' }
}

/**
 * Filter a `blob(id).list()` result to the attachment slots (`att:` prefix) and shape each into an
 * `AttachmentItem`. Non-attachment slots (the cover, any named slot) are dropped. Sorted by upload
 * time ascending (stable insertion order) so a freshly-added item lands at the end.
 */
export function attachmentList(slots: readonly BlobSlotInfo[]): AttachmentItem[] {
  return slots
    .filter((s) => s.name.startsWith(ATTACHMENT_PREFIX))
    .map((s) => {
      const mime = s.mimeType ?? 'application/octet-stream'
      const size = s.size ?? 0
      return {
        slot: s.name,
        filename: s.filename && s.filename !== s.name ? s.filename : s.name.slice(ATTACHMENT_PREFIX.length),
        mime,
        size,
        humanSize: humanSize(size),
        kind: mime.startsWith('image/') ? 'image' : 'file',
        ...(s.uploadedAt !== undefined ? { uploadedAt: s.uploadedAt } : {}),
        ...(s.uploadedBy !== undefined ? { uploadedBy: s.uploadedBy } : {}),
      } satisfies AttachmentItem
    })
    .sort((a, b) => (a.uploadedAt ?? '').localeCompare(b.uploadedAt ?? ''))
}
