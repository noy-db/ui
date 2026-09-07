// Minimal PNG writer: 64x64 RGB, color derived from a hash of the seed.
// Uncompressed (stored) zlib + CRC32 — no dependencies, deterministic.

function crc32(bytes: Uint8Array): number {
  let c = ~0
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i]!
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1, b = 0
  for (let i = 0; i < bytes.length; i++) { a = (a + bytes[i]!) % 65521; b = (b + a) % 65521 }
  return ((b << 16) | a) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const t = new TextEncoder().encode(type)
  const len = data.length
  const out = new Uint8Array(12 + len)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, len)
  out.set(t, 4)
  out.set(data, 8)
  dv.setUint32(8 + len, crc32(out.subarray(4, 8 + len)))
  return out
}

function hashHue(seed: string): { r: number; g: number; b: number } {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  // map to a pleasant mid-tone RGB
  return { r: 60 + (h & 0x7f), g: 60 + ((h >>> 8) & 0x7f), b: 60 + ((h >>> 16) & 0x7f) }
}

export function makeCover(seedText: string): Uint8Array {
  const W = 64, H = 64
  const { r, g, b } = hashHue(seedText)
  // raw image: each row prefixed with filter byte 0
  const raw = new Uint8Array(H * (1 + W * 3))
  for (let y = 0; y < H; y++) {
    const row = y * (1 + W * 3)
    raw[row] = 0
    for (let x = 0; x < W; x++) {
      const px = row + 1 + x * 3
      const shade = 1 - y / (H * 2) // subtle vertical gradient
      raw[px] = Math.round(r * shade)
      raw[px + 1] = Math.round(g * shade)
      raw[px + 2] = Math.round(b * shade)
    }
  }
  // zlib stored blocks
  const blocks: number[] = [0x78, 0x01]
  let off = 0
  while (off < raw.length) {
    const len = Math.min(65535, raw.length - off)
    const final = off + len >= raw.length ? 1 : 0
    blocks.push(final, len & 0xff, (len >>> 8) & 0xff, (~len) & 0xff, ((~len) >>> 8) & 0xff)
    for (let i = 0; i < len; i++) blocks.push(raw[off + i]!)
    off += len
  }
  const zlib = new Uint8Array(blocks.length + 4)
  zlib.set(blocks, 0)
  new DataView(zlib.buffer).setUint32(blocks.length, adler32(raw))

  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, W); dv.setUint32(4, H)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit, truecolor RGB

  const magic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const parts = [magic, chunk('IHDR', ihdr), chunk('IDAT', zlib), chunk('IEND', new Uint8Array(0))]
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let p = 0
  for (const part of parts) { out.set(part, p); p += part.length }
  return out
}
