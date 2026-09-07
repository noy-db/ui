// Minimal EXIF reader for image attachments — pulls the handful of fields worth surfacing (camera,
// lens, capture time, exposure, GPS, orientation) straight from the file's TIFF/EXIF block. No
// dependency, offline, and returns `null` for an unsupported or EXIF-less file. The metadata already
// lives inside the (decrypted) bytes — the natural store for a zero-knowledge vault, where there is
// no server-side metadata bag to sync into.
//
// The EXIF payload is a TIFF block wherever it lives; only the container differs:
//   • JPEG — APP1 (`FFE1`) segment beginning `Exif\0\0`, then the TIFF header.
//   • PNG  — an `eXIf` chunk whose data *is* the TIFF header (no `Exif\0\0` prefix).
//   • HEIC/HEIF — an ISOBMFF `Exif` item located via the `meta` box's `iinf`/`iloc`.
// All offsets inside a TIFF block are relative to its header start. Any malformed read throws and is
// caught → `null`.

export interface ExifData {
  /** 1–8; the TIFF orientation. Browsers auto-apply it to `<img>`, but it's worth showing. */
  readonly orientation?: number
  readonly make?: string
  readonly model?: string
  readonly lens?: string
  /** Capture time, normalized to `YYYY-MM-DD HH:MM`. */
  readonly takenAt?: string
  /** e.g. `1/250s`. */
  readonly exposure?: string
  /** e.g. `f/2.8`. */
  readonly fNumber?: string
  readonly iso?: number
  /** e.g. `35mm`. */
  readonly focalLength?: string
  /** Decimal degrees (signed: south / west negative). */
  readonly gps?: { readonly lat: number; readonly lng: number }
}

interface Entry { readonly type: number; readonly count: number; readonly valueOff: number }
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

/** Parse EXIF from JPEG / PNG / HEIC bytes. Returns the fields it recognises, or `null`. */
export function parseExif(input: Uint8Array): ExifData | null {
  try {
    const b = input
    let tiff = -1
    if (b.length >= 12 && b[0] === 0xff && b[1] === 0xd8) tiff = locateJpeg(b)
    else if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) tiff = locatePng(b)
    else if (b.length >= 16 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) tiff = locateHeif(b)
    return tiff < 0 ? null : extractFromTiff(b, tiff)
  } catch {
    return null // malformed input — never throw at a display path
  }
}

/** JPEG: walk markers to the APP1 (`FFE1`) segment starting `Exif\0\0`; return the TIFF start. */
function locateJpeg(b: Uint8Array): number {
  let off = 2
  while (off + 4 <= b.length) {
    if (b[off] !== 0xff) break
    const marker = b[off + 1]
    if (marker === 0xda || marker === 0xd9) break // start-of-scan / end-of-image
    const segLen = (b[off + 2]! << 8) | b[off + 3]!
    if (segLen < 2) break
    if (marker === 0xe1 && b[off + 4] === 0x45 && b[off + 5] === 0x78 && b[off + 6] === 0x69
      && b[off + 7] === 0x66 && b[off + 8] === 0x00 && b[off + 9] === 0x00) return off + 10
    off += 2 + segLen
  }
  return -1
}

/** PNG: walk chunks for `eXIf`; its data is a bare TIFF header. */
function locatePng(b: Uint8Array): number {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let p = 8 // past the 8-byte signature
  while (p + 12 <= b.length) {
    const len = dv.getUint32(p)
    const type = String.fromCharCode(b[p + 4]!, b[p + 5]!, b[p + 6]!, b[p + 7]!)
    if (type === 'eXIf') return p + 8
    if (type === 'IEND') break
    p += 12 + len // length(4) + type(4) + data(len) + crc(4)
  }
  return -1
}

/** HEIC/HEIF (ISOBMFF): find the `Exif` item via `meta` → `iinf`/`iloc`, then its TIFF header. */
function locateHeif(b: Uint8Array): number {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const typeAt = (p: number): string => String.fromCharCode(b[p + 4]!, b[p + 5]!, b[p + 6]!, b[p + 7]!)
  const sizeAt = (p: number): { size: number; head: number } => {
    let s = dv.getUint32(p); let head = 8
    if (s === 1) { s = Number(dv.getBigUint64(p + 8)); head = 16 } // 64-bit largesize (e.g. mdat)
    if (s === 0) s = b.length - p // extends to EOF
    return { size: s, head }
  }

  // Top-level walk → the `meta` box.
  let p = 0; let meta = -1; let metaEnd = -1
  while (p + 8 <= b.length) {
    const { size } = sizeAt(p)
    if (size < 8) break
    if (typeAt(p) === 'meta') { meta = p; metaEnd = p + size; break }
    p += size
  }
  if (meta < 0) return -1

  // `meta` is a FullBox (version/flags), children follow.
  let iinf = -1; let iloc = -1; let idat = -1
  let q = meta + 12
  while (q + 8 <= metaEnd) {
    const { size } = sizeAt(q); const t = typeAt(q)
    if (size < 8) break
    if (t === 'iinf') iinf = q
    else if (t === 'iloc') iloc = q
    else if (t === 'idat') idat = q
    q += size
  }
  if (iinf < 0 || iloc < 0) return -1

  const exifId = findExifItem(b, dv, iinf, sizeAt)
  if (exifId < 0) return -1
  const loc = resolveIloc(b, dv, iloc, exifId, idat)
  if (loc < 0) return -1

  // Exif item payload: 4-byte offset to the TIFF header, then usually `Exif\0\0` + TIFF.
  const hdrOff = dv.getUint32(loc)
  for (const start of [loc + 4 + hdrOff, loc + 4]) {
    let t = start
    if (b[t] === 0x45 && b[t + 1] === 0x78 && b[t + 2] === 0x69 && b[t + 3] === 0x66) t += 6 // skip "Exif\0\0"
    if (b[t] === 0x49 || b[t] === 0x4d) return t
  }
  return -1
}

/** Scan an `iinf` box's `infe` entries for the item whose type is `Exif`; return its item ID. */
function findExifItem(b: Uint8Array, dv: DataView, iinf: number, sizeAt: (p: number) => { size: number; head: number }): number {
  const iinfEnd = iinf + sizeAt(iinf).size
  const ver = b[iinf + 8]
  let p = iinf + 12 + (ver === 0 ? 2 : 4) // entry_count: 16-bit (v0) or 32-bit (v1+)
  while (p + 8 <= iinfEnd) {
    const { size } = sizeAt(p)
    if (size < 8) break
    if (String.fromCharCode(b[p + 4]!, b[p + 5]!, b[p + 6]!, b[p + 7]!) === 'infe') {
      const iver = b[p + 8]!
      if (iver >= 2) {
        let ip = p + 12
        const itemId = iver === 2 ? dv.getUint16(ip) : dv.getUint32(ip)
        ip += iver === 2 ? 2 : 4
        ip += 2 // item_protection_index
        if (String.fromCharCode(b[ip]!, b[ip + 1]!, b[ip + 2]!, b[ip + 3]!) === 'Exif') return itemId
      }
    }
    p += size
  }
  return -1
}

/** Resolve an item's absolute byte offset from an `iloc` box (construction methods 0 file / 1 idat). */
function resolveIloc(b: Uint8Array, dv: DataView, iloc: number, wantId: number, idat: number): number {
  const ver = b[iloc + 8]!
  let p = iloc + 12
  const sizes = b[p]!; const sizes2 = b[p + 1]!; p += 2
  const offsetSize = (sizes >> 4) & 0xf
  const lengthSize = sizes & 0xf
  const baseOffsetSize = (sizes2 >> 4) & 0xf
  const indexSize = sizes2 & 0xf
  const readN = (pp: number, n: number): number =>
    n === 8 ? Number(dv.getBigUint64(pp)) : n === 4 ? dv.getUint32(pp) : n === 2 ? dv.getUint16(pp) : 0
  let count: number
  if (ver < 2) { count = dv.getUint16(p); p += 2 } else { count = dv.getUint32(p); p += 4 }

  for (let i = 0; i < count; i++) {
    const itemId = ver < 2 ? dv.getUint16(p) : dv.getUint32(p); p += ver < 2 ? 2 : 4
    let method = 0
    if (ver === 1 || ver === 2) { method = dv.getUint16(p) & 0xf; p += 2 } // reserved(12) + construction_method(4)
    p += 2 // data_reference_index
    const baseOffset = readN(p, baseOffsetSize); p += baseOffsetSize
    const extents = dv.getUint16(p); p += 2
    for (let e = 0; e < extents; e++) {
      if ((ver === 1 || ver === 2) && indexSize > 0) p += indexSize
      const extOffset = readN(p, offsetSize); p += offsetSize
      p += lengthSize
      if (itemId === wantId && e === 0) {
        // method 1 = offset within the `idat` box's payload (header 12: size+type+version/flags? idat is a plain box → +8)
        if (method === 1) return idat < 0 ? -1 : idat + 8 + baseOffset + extOffset
        return baseOffset + extOffset // method 0 = absolute file offset
      }
    }
  }
  return -1
}

/** Extract the recognised fields from a TIFF block starting at `tiff` (relative offsets within). */
function extractFromTiff(b: Uint8Array, tiff: number): ExifData | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const le = b[tiff] === 0x49 ? true : b[tiff] === 0x4d ? false : null
  if (le === null) return null
  const u8 = (p: number): number => view.getUint8(tiff + p)
  const u16 = (p: number): number => view.getUint16(tiff + p, le)
  const u32 = (p: number): number => view.getUint32(tiff + p, le)

  const readIfd = (ifdOff: number): Map<number, Entry> => {
    const m = new Map<number, Entry>()
    if (ifdOff <= 0) return m
    const n = u16(ifdOff)
    for (let i = 0; i < n; i++) {
      const e = ifdOff + 2 + i * 12
      m.set(u16(e), { type: u16(e + 2), count: u32(e + 4), valueOff: e + 8 })
    }
    return m
  }
  const dataOff = (t: Entry): number => ((TYPE_SIZE[t.type] ?? 1) * t.count <= 4 ? t.valueOff : u32(t.valueOff))
  const asciiOf = (m: Map<number, Entry>, tag: number): string | undefined => {
    const t = m.get(tag); if (!t || t.type !== 2) return undefined
    const base = dataOff(t); let s = ''
    for (let i = 0; i < t.count; i++) { const c = u8(base + i); if (c === 0) break; s += String.fromCharCode(c) }
    return s.trim() || undefined
  }
  const shortOf = (m: Map<number, Entry>, tag: number): number | undefined => {
    const t = m.get(tag); if (!t) return undefined
    if (t.type === 3) return u16(t.valueOff)
    if (t.type === 4) return u32(t.valueOff)
    return undefined
  }
  const ratOf = (m: Map<number, Entry>, tag: number): number | undefined => {
    const t = m.get(tag); if (!t || (t.type !== 5 && t.type !== 10)) return undefined
    const base = dataOff(t)
    const num = t.type === 10 ? view.getInt32(tiff + base, le) : u32(base)
    const den = t.type === 10 ? view.getInt32(tiff + base + 4, le) : u32(base + 4)
    return den === 0 ? undefined : num / den
  }
  const ratsOf = (m: Map<number, Entry>, tag: number): number[] | undefined => {
    const t = m.get(tag); if (!t || t.type !== 5) return undefined
    const base = dataOff(t); const out: number[] = []
    for (let i = 0; i < t.count; i++) { const den = u32(base + i * 8 + 4); out.push(den === 0 ? 0 : u32(base + i * 8) / den) }
    return out
  }

  const ifd0 = readIfd(u32(4))
  const exifP = shortOf(ifd0, 0x8769)
  const exif = exifP ? readIfd(exifP) : new Map<number, Entry>()
  const gpsP = shortOf(ifd0, 0x8825)
  const gps = gpsP ? readIfd(gpsP) : new Map<number, Entry>()

  const out: { -readonly [K in keyof ExifData]?: ExifData[K] } = {}
  const orientation = shortOf(ifd0, 0x0112); if (orientation) out.orientation = orientation
  const make = asciiOf(ifd0, 0x010f); if (make) out.make = make
  const model = asciiOf(ifd0, 0x0110); if (model) out.model = model
  const lens = asciiOf(exif, 0xa434); if (lens) out.lens = lens

  const taken = asciiOf(exif, 0x9003) ?? asciiOf(ifd0, 0x0132)
  if (taken) {
    const mt = taken.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})/)
    out.takenAt = mt ? `${mt[1]}-${mt[2]}-${mt[3]} ${mt[4]}:${mt[5]}` : taken
  }
  const et = ratOf(exif, 0x829a); if (et !== undefined) out.exposure = et > 0 && et < 1 ? `1/${Math.round(1 / et)}s` : `${+et.toFixed(1)}s`
  const fn = ratOf(exif, 0x829d); if (fn !== undefined) out.fNumber = `f/${+fn.toFixed(1)}`
  const iso = shortOf(exif, 0x8827); if (iso) out.iso = iso
  const fl = ratOf(exif, 0x920a); if (fl !== undefined) out.focalLength = `${fl < 10 ? +fl.toFixed(1) : Math.round(fl)}mm`

  const latRef = asciiOf(gps, 0x0001); const lat = ratsOf(gps, 0x0002)
  const lngRef = asciiOf(gps, 0x0003); const lng = ratsOf(gps, 0x0004)
  if (lat && lng && lat.length === 3 && lng.length === 3) {
    let latD = lat[0]! + lat[1]! / 60 + lat[2]! / 3600
    let lngD = lng[0]! + lng[1]! / 60 + lng[2]! / 3600
    if (latRef === 'S') latD = -latD
    if (lngRef === 'W') lngD = -lngD
    out.gps = { lat: +latD.toFixed(6), lng: +lngD.toFixed(6) }
  }

  return Object.keys(out).length ? out : null
}
