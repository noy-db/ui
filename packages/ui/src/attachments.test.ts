import { describe, it, expect } from 'vitest'
import { attachmentList, humanSize, attachmentSlot, ATTACHMENT_PREFIX, fileCategory, type BlobSlotInfo } from './attachments'

describe('humanSize', () => {
  it('scales bytes to binary units', () => {
    expect(humanSize(500)).toBe('500 B')
    expect(humanSize(1024)).toBe('1.0 KB')
    expect(humanSize(1536)).toBe('1.5 KB')
    expect(humanSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
  it('guards bad input', () => {
    expect(humanSize(-1)).toBe('—')
    expect(humanSize(NaN)).toBe('—')
  })
})

describe('attachmentSlot', () => {
  it('prefixes a uuid', () => {
    expect(attachmentSlot('abc-123')).toBe('att:abc-123')
    expect(attachmentSlot('x').startsWith(ATTACHMENT_PREFIX)).toBe(true)
  })
})

describe('attachmentList', () => {
  const slots: BlobSlotInfo[] = [
    { name: 'art', filename: 'cover', size: 12000, mimeType: 'image/png', uploadedAt: '2026-07-01T00:00:00Z' }, // cover — excluded
    { name: 'att:2', filename: 'invoice.pdf', size: 2048, mimeType: 'application/pdf', uploadedAt: '2026-07-03T00:00:00Z' },
    { name: 'att:1', filename: 'sleeve.png', size: 1024, mimeType: 'image/png', uploadedAt: '2026-07-02T00:00:00Z' },
  ]

  it('keeps only att: slots, dropping the cover', () => {
    expect(attachmentList(slots).map((a) => a.slot)).toEqual(['att:1', 'att:2'])
  })

  it('sorts by upload time ascending (newest last)', () => {
    expect(attachmentList(slots).map((a) => a.filename)).toEqual(['sleeve.png', 'invoice.pdf'])
  })

  it('classifies image vs file by mime', () => {
    const byKind = Object.fromEntries(attachmentList(slots).map((a) => [a.filename, a.kind]))
    expect(byKind).toEqual({ 'sleeve.png': 'image', 'invoice.pdf': 'file' })
  })

  it('derives filename + human size + mime', () => {
    const pdf = attachmentList(slots).find((a) => a.slot === 'att:2')!
    expect(pdf).toMatchObject({ filename: 'invoice.pdf', mime: 'application/pdf', size: 2048, humanSize: '2.0 KB' })
  })

  it('falls back to the uuid tail and octet-stream when metadata is missing', () => {
    const item = attachmentList([{ name: 'att:bare-uuid' }])[0]
    expect(item).toMatchObject({ filename: 'bare-uuid', mime: 'application/octet-stream', kind: 'file', size: 0, humanSize: '0 B' })
  })

  it('treats a filename equal to the slot name as absent (uses the tail)', () => {
    const item = attachmentList([{ name: 'att:xyz', filename: 'att:xyz', size: 10 }])[0]
    expect(item.filename).toBe('xyz')
  })
})

describe('fileCategory', () => {
  it('classifies by MIME first', () => {
    expect(fileCategory('image/png', 'x.png').category).toBe('image')
    expect(fileCategory('application/pdf', 'x').category).toBe('pdf')
    expect(fileCategory('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'budget.xlsx').category).toBe('spreadsheet')
    expect(fileCategory('audio/mpeg', 'track').category).toBe('audio')
    expect(fileCategory('video/mp4', 'clip').category).toBe('video')
  })
  it('falls back to the extension when MIME is generic', () => {
    const cat = (fn: string): string => fileCategory('application/octet-stream', fn).category
    expect(cat('sheet.csv')).toBe('spreadsheet')
    expect(cat('notes.docx')).toBe('document')
    expect(cat('slides.pptx')).toBe('presentation')
    expect(cat('bundle.zip')).toBe('archive')
    expect(cat('readme.md')).toBe('text')
    expect(cat('data.json')).toBe('json')
    expect(cat('page.html')).toBe('markup')
    expect(cat('main.ts')).toBe('code')
    expect(cat('db.sqlite')).toBe('database')
    expect(cat('brand.woff2')).toBe('font')
    expect(cat('novel.epub')).toBe('ebook')
    expect(cat('trip.ics')).toBe('calendar')
    expect(cat('card.vcf')).toBe('contact')
    expect(cat('id.pem')).toBe('certificate')
    expect(cat('boot.iso')).toBe('disk')
    expect(cat('setup.exe')).toBe('application')
  })
  it('every rule keeps image/audio/video/text prefixes from swallowing specifics', () => {
    expect(fileCategory('text/csv', 'x.csv').category).toBe('spreadsheet')
    expect(fileCategory('text/html', 'x.html').category).toBe('markup')
    expect(fileCategory('text/plain', 'x.txt').category).toBe('text')
  })
  it('keeps zip-container formats out of the archive bucket', () => {
    expect(fileCategory('application/epub+zip', 'book.epub').category).toBe('ebook')
    expect(fileCategory('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'x.docx').category).toBe('document')
    expect(fileCategory('application/zip', 'x.zip').category).toBe('archive')
  })
  it('gives a friendly label and an icon, defaulting to a generic file', () => {
    expect(fileCategory('application/vnd.ms-excel', 'q.xls')).toMatchObject({ label: 'Spreadsheet', icon: 'i-lucide-file-spreadsheet' })
    expect(fileCategory('video/quicktime', 'clip.mov')).toMatchObject({ label: 'Video', icon: 'i-lucide-film' })
    const unknown = fileCategory('application/x-weird', 'mystery.zzz')
    expect(unknown).toMatchObject({ category: 'file', label: 'File', icon: 'i-lucide-file' })
  })
})
