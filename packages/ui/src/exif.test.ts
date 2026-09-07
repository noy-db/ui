import { describe, it, expect } from 'vitest'
import { parseExif } from './exif'

// A shared little-endian TIFF/EXIF block: Make (ASCII via offset) + Orientation (inline SHORT) + a
// GPS IFD with lat/lng as 3-rational arrays (N/E). Wrapped below into JPEG / PNG / HEIC containers.
function buildTiff(): Uint8Array {
  const tiff = new Uint8Array(160)
  const dv = new DataView(tiff.buffer)
  const LE = true
  tiff[0] = 0x49; tiff[1] = 0x49; dv.setUint16(2, 0x002a, LE); dv.setUint32(4, 8, LE)
  let p = 8
  const entry = (tag: number, type: number, count: number, value: number): void => {
    dv.setUint16(p, tag, LE); dv.setUint16(p + 2, type, LE); dv.setUint32(p + 4, count, LE); dv.setUint32(p + 8, value, LE); p += 12
  }
  dv.setUint16(p, 3, LE); p += 2
  entry(0x010f, 2, 8, 50)   // Make → 50
  entry(0x0112, 3, 1, 6)    // Orientation = 6
  entry(0x8825, 4, 1, 58)   // GPS IFD → 58
  dv.setUint32(p, 0, LE)
  for (const [i, c] of [...'TestCam'].entries()) tiff[50 + i] = c.charCodeAt(0)
  p = 58
  dv.setUint16(p, 4, LE); p += 2
  entry(0x0001, 2, 2, 0x0000004e) // GPSLatitudeRef 'N'
  entry(0x0002, 5, 3, 112)        // GPSLatitude → 112
  entry(0x0003, 2, 2, 0x00000045) // GPSLongitudeRef 'E'
  entry(0x0004, 5, 3, 136)        // GPSLongitude → 136
  dv.setUint32(p, 0, LE)
  const rat = (at: number, n: number, d: number): void => { dv.setUint32(at, n, LE); dv.setUint32(at + 4, d, LE) }
  rat(112, 13, 1); rat(120, 45, 1); rat(128, 0, 1)
  rat(136, 100, 1); rat(144, 30, 1); rat(152, 0, 1)
  return tiff
}
const EXPECTED = { make: 'TestCam', orientation: 6, gps: { lat: 13.75, lng: 100.5 } }

const cat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
const u32 = (n: number): Uint8Array => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])
const u16 = (n: number): Uint8Array => new Uint8Array([(n >>> 8) & 255, n & 255])
const ascii = (s: string): Uint8Array => new Uint8Array([...s].map((c) => c.charCodeAt(0)))

function buildJpeg(): Uint8Array {
  const seg = cat(ascii('Exif'), new Uint8Array([0, 0]), buildTiff())
  return cat(new Uint8Array([0xff, 0xd8, 0xff, 0xe1]), u16(seg.length + 2), seg)
}
function buildPng(): Uint8Array {
  const chunk = (type: string, data: Uint8Array): Uint8Array => cat(u32(data.length), ascii(type), data, u32(0)) // CRC unchecked
  return cat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', new Uint8Array(13)), chunk('eXIf', buildTiff()), chunk('IEND', new Uint8Array(0)))
}
function buildHeic(): Uint8Array {
  const box = (type: string, data: Uint8Array): Uint8Array => cat(u32(data.length + 8), ascii(type), data)
  const full = (type: string, version: number, data: Uint8Array): Uint8Array => box(type, cat(new Uint8Array([version, 0, 0, 0]), data))
  const exifItem = cat(u32(0), buildTiff()) // 4-byte tiff-header-offset (0) + TIFF
  const infe = full('infe', 2, cat(u16(1), u16(0), ascii('Exif'), new Uint8Array([0])))
  const iinf = full('iinf', 0, cat(u16(1), infe))
  const ilocBody = cat(new Uint8Array([0x44, 0x00]), u16(1), u16(1), u16(0), u16(0), u16(1), u32(0), u32(exifItem.length))
  const iloc = full('iloc', 1, ilocBody)
  const meta = full('meta', 0, cat(iinf, iloc))
  const ftyp = box('ftyp', cat(ascii('heic'), u32(0), ascii('heic')))
  const out = cat(ftyp, meta, exifItem)
  // Patch the extent_offset (abs file offset of the Exif item) now that the layout is known.
  const extOffPos = ftyp.length + 24 + iinf.length + ilocBody.length - 8
  new DataView(out.buffer).setUint32(extOffPos, ftyp.length + meta.length)
  return out
}

describe('parseExif', () => {
  it('reads EXIF from a JPEG APP1 block', () => {
    expect(parseExif(buildJpeg())).toMatchObject(EXPECTED)
  })
  it('reads EXIF from a PNG eXIf chunk', () => {
    expect(parseExif(buildPng())).toMatchObject(EXPECTED)
  })
  it('reads EXIF from a HEIC ISOBMFF Exif item', () => {
    expect(parseExif(buildHeic())).toMatchObject(EXPECTED)
  })

  it('returns null for a non-image (e.g. PNG-less/JPEG-less bytes)', () => {
    expect(parseExif(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull()
  })
  it('returns null for a JPEG with no EXIF segment', () => {
    expect(parseExif(new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull()
  })
  it('never throws on malformed input', () => {
    expect(parseExif(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0xff, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]))).toBeNull()
  })
})
