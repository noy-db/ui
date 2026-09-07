import { describe, it, expect } from 'vitest'
import { coverScale, clampOffset, cropRect, displaySize } from './crop'

describe('coverScale', () => {
  it('scales the SHORTER side to fill the frame (landscape)', () => {
    // 200×100 into a 100 frame: height is the short side → 100/100 = 1 covers it; width 200 overflows.
    expect(coverScale(200, 100, 100)).toBe(1)
  })
  it('portrait: width is the short side', () => {
    expect(coverScale(100, 200, 100)).toBe(1)
  })
  it('upscales a small image to cover', () => {
    expect(coverScale(50, 50, 100)).toBe(2)
  })
})

describe('displaySize', () => {
  it('a landscape image is frame-tall and wider at zoom 1', () => {
    expect(displaySize(200, 100, 100, 1)).toEqual({ w: 200, h: 100 })
  })
  it('zoom multiplies both sides', () => {
    expect(displaySize(200, 100, 100, 2)).toEqual({ w: 400, h: 200 })
  })
})

describe('clampOffset', () => {
  it('keeps the frame covered (range [frame - displayLen, 0])', () => {
    expect(clampOffset(0, 200, 100)).toBe(0)       // left edge flush
    expect(clampOffset(-100, 200, 100)).toBe(-100) // right edge flush (frame - 200)
    expect(clampOffset(-300, 200, 100)).toBe(-100) // over-panned → clamped to right edge
    expect(clampOffset(50, 200, 100)).toBe(0)      // positive → clamped to left edge
  })
  it('pins to origin when the image is not larger than the frame', () => {
    expect(clampOffset(-20, 100, 100)).toBe(0)
  })
})

describe('cropRect', () => {
  const base = { imageW: 200, imageH: 100, frame: 100 }
  it('at zoom 1 / offset 0 the source is the top-left frame-sized square', () => {
    expect(cropRect({ ...base, zoom: 1, offsetX: 0, offsetY: 0 })).toEqual({ sx: 0, sy: 0, sw: 100, sh: 100 })
  })
  it('panning the image left reveals a rightward source rect', () => {
    // offsetX -50 (image dragged 50px left) → source x moves right by 50/ds (ds=1)
    expect(cropRect({ ...base, zoom: 1, offsetX: -50, offsetY: 0 })).toMatchObject({ sx: 50, sw: 100 })
  })
  it('zooming in shrinks the source rect (a tighter crop)', () => {
    // ds = coverScale(1) * zoom(2) = 2 → sw = 100/2 = 50
    expect(cropRect({ ...base, zoom: 2, offsetX: 0, offsetY: 0 })).toMatchObject({ sx: 0, sy: 0, sw: 50, sh: 50 })
  })
  it('the source is always square (sw === sh) regardless of aspect', () => {
    const r = cropRect({ imageW: 640, imageH: 480, frame: 320, zoom: 1.5, offsetX: -30, offsetY: -10 })
    expect(r.sw).toBe(r.sh)
  })
})
