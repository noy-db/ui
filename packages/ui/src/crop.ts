// Square-crop math for a pan/zoom image cropper (cover upload). Pure + framework-free: the
// component owns pointer/canvas; this owns the geometry so it's unit-testable without a DOM.
//
// Model: a `frame`×`frame` square viewport. At `zoom = 1` the image exactly COVERS the frame
// (object-fit: cover); zooming in enlarges it. `offsetX`/`offsetY` are the image's top-left in
// frame pixels (≤ 0 — the image is always at least frame-sized, so its edges sit outside).

/** The base scale (px per image px) at which the image just covers a `frame`×`frame` box. */
export function coverScale(imageW: number, imageH: number, frame: number): number {
  return Math.max(frame / imageW, frame / imageH)
}

/**
 * Clamp a pan offset so the scaled image never uncovers the frame. `displayLen` is the image side
 * in display px (`imageSide * coverScale * zoom`). Valid range is `[frame - displayLen, 0]`.
 */
export function clampOffset(offset: number, displayLen: number, frame: number): number {
  const min = frame - displayLen
  if (min >= 0) return 0 // image not larger than the frame — pin to origin
  return Math.min(0, Math.max(min, offset))
}

export interface CropView {
  imageW: number
  imageH: number
  frame: number
  /** ≥ 1 — 1 is cover-fit. */
  zoom: number
  /** Image top-left in frame px (≤ 0). */
  offsetX: number
  offsetY: number
}

/**
 * The source rectangle (in image pixels) that the frame currently shows — feed straight to
 * `ctx.drawImage(img, sx, sy, sw, sh, 0, 0, target, target)` to render the crop at any output size.
 */
export function cropRect(v: CropView): { sx: number; sy: number; sw: number; sh: number } {
  const ds = coverScale(v.imageW, v.imageH, v.frame) * v.zoom
  const side = v.frame / ds
  // `+ 0` normalizes the signed zero `-0 / ds` produces at offset 0.
  return { sx: -v.offsetX / ds + 0, sy: -v.offsetY / ds + 0, sw: side, sh: side }
}

/** Convenience: the displayed image dimensions (px) at a given zoom. */
export function displaySize(imageW: number, imageH: number, frame: number, zoom: number): { w: number; h: number } {
  const s = coverScale(imageW, imageH, frame) * zoom
  return { w: imageW * s, h: imageH * s }
}
