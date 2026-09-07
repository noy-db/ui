// Adaptive text: fit a value into a known width by climbing a compression ladder. Pure + testable —
// the DOM measurement is injected as `measure(text) => px`, so the decision logic is unit-tested with
// a fake measurer. The Vue `<NuiText>` wrapper supplies a canvas `measureText` and applies the result.
//
// The ladder, in order (matching the design):
//   1. SEMANTIC abbreviation — pick the richest representation that fits within a *mild* squeeze, so a
//      2px overflow doesn't force an over-abbreviation ("2026" beats "'26" if it nearly fits).
//   2. TYPOGRAPHIC condensing — squeeze the most-abbreviated rep horizontally (scaleX), then shrink the
//      font as a floor. Lossless until font-size.
//   3. WRAP — only when a line budget exists (e.g. a cover image makes the row ≥2 lines tall). When it
//      does, wrapping is *preferred over* hard-condensing/ellipsis.
//   4. ELLIPSIS — last resort.

export interface FitTreatment {
  /** The chosen representation. */
  text: string
  /** Horizontal squeeze (0 < scaleX ≤ 1); 1 = none. */
  scaleX: number
  /** Letter-spacing in em (≤ 0) — a cosmetic tightening applied alongside a squeeze. */
  letterSpacing: number
  /** Font-size factor (≤ 1); 1 = none. The last typographic resort. */
  fontScale: number
  /** Whether to wrap across multiple lines. */
  wrap: boolean
  /** Line budget used when wrapping (1 when single-line). */
  lines: number
  /** Whether to truncate with an ellipsis. */
  ellipsis: boolean
}

export interface FitOptions {
  /** Natural rendered width (px) of a string at the base font. Injected (canvas in the browser). */
  measure: (s: string) => number
  /** Available lines (height ÷ line-height). Default 1 (single line). */
  lineBudget?: number
  /** Mild squeeze allowed before stepping to a lossier representation. Default 0.94. */
  softCondense?: number
  /** Hardest squeeze allowed on the most-abbreviated rep. Default 0.80. */
  hardCondense?: number
  /** Smallest font factor before giving up to wrap/ellipsis. Default 0.85. */
  minFontScale?: number
  /** When a line budget exists, prefer wrapping over hard-condensing. Default true. */
  preferWrap?: boolean
}

const NONE = { scaleX: 1, letterSpacing: 0, fontScale: 1, wrap: false, lines: 1, ellipsis: false }

/**
 * Choose the richest representation + lightest treatment that fits `width`. `reps` is ordered richest
 * → most-abbreviated (e.g. `["$1,200.01","$1,200","$1.2k"]`). Returns the text plus the CSS treatment
 * the renderer should apply.
 */
export function fitText(reps: readonly string[], width: number, o: FitOptions): FitTreatment {
  const text0 = reps[0] ?? ''
  if (reps.length === 0 || width <= 0) return { text: text0, ...NONE }

  const soft = o.softCondense ?? 0.94
  const hard = o.hardCondense ?? 0.80
  const minFont = o.minFontScale ?? 0.85
  const lineBudget = Math.max(1, Math.floor(o.lineBudget ?? 1))
  const preferWrap = o.preferWrap ?? true

  // 1+2a. Richest rep that fits plainly or within a mild squeeze.
  for (const rep of reps) {
    const w = o.measure(rep)
    if (w <= width) return { text: rep, ...NONE }
    if (w * soft <= width) {
      const c = width / w // in [soft, 1)
      return { text: rep, ...NONE, scaleX: c, letterSpacing: -0.01 }
    }
  }

  // Past here even the most-abbreviated rep needs more than a mild squeeze.
  const last = reps[reps.length - 1]!
  const wl = o.measure(last)

  // 3. Wrap first when there's vertical room and it's preferred (the cover-image case).
  if (lineBudget >= 2 && preferWrap) {
    const lines = Math.ceil(wl / width)
    if (lines <= lineBudget) return { text: last, ...NONE, wrap: true, lines }
  }

  // 2b. Hard horizontal squeeze.
  if (wl * hard <= width) {
    return { text: last, ...NONE, scaleX: width / wl, letterSpacing: -0.02 }
  }

  // 2c. Shrink the font (with the squeeze at its floor) as the last typographic step.
  const fontScale = width / (wl * hard)
  if (fontScale >= minFont) {
    return { text: last, ...NONE, scaleX: hard, fontScale, letterSpacing: -0.02 }
  }

  // 4. Out of typographic room: wrap if any vertical budget exists, else ellipsis.
  if (lineBudget >= 2) {
    const lines = Math.min(Math.ceil((wl * hard) / width), lineBudget)
    return { text: last, ...NONE, scaleX: hard, wrap: true, lines }
  }
  return { text: last, ...NONE, scaleX: hard, ellipsis: true }
}

// ── Semantic representation ladders (richest → most abbreviated) ──────────────────────────────────

export type TextKind = 'text' | 'year' | 'number' | 'money' | 'date' | 'duration'

const dropTrailingZeros = (s: string): string => s.replace(/\.0+$|(\.\d*?)0+$/, '$1')

/** Compact a number to a k/M/B suffix (e.g. 1234 → "1.2k"). */
export function compactNumber(n: number): string {
  const abs = Math.abs(n)
  if (abs < 1000) return String(Math.round(n))
  const units: [number, string][] = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']]
  for (const [base, suf] of units) {
    if (abs >= base) return dropTrailingZeros((n / base).toFixed(1)) + suf
  }
  return String(n)
}

/**
 * Build the representation ladder for a typed value, richest first. `text` has a single rep (the
 * component relies on condense/wrap/ellipsis); the others abbreviate meaningfully.
 */
export function repsFor(kind: TextKind, value: unknown, opts: { currency?: string } = {}): string[] {
  switch (kind) {
    case 'year': {
      const y = String(value)
      return y.length === 4 ? [y, '’' + y.slice(-2)] : [y]
    }
    case 'number': {
      const n = Number(value)
      if (!Number.isFinite(n)) return [String(value)]
      const full = dropTrailingZeros(String(n))
      const rounded = String(Math.round(n))
      return [...new Set([full, rounded, compactNumber(n)])]
    }
    case 'money': {
      const n = Number(value)
      if (!Number.isFinite(n)) return [String(value)]
      const sym = opts.currency === 'USD' ? '$' : opts.currency ? opts.currency + ' ' : '$'
      const grouped = Math.round(n).toLocaleString('en-US')
      const decimals = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return [...new Set([`${sym}${decimals}`, `${sym}${grouped}`, `${sym}${compactNumber(n)}`])]
    }
    case 'duration': {
      const n = Number(value)
      if (!Number.isFinite(n)) return [String(value)]
      const r = dropTrailingZeros(String(n))
      return [...new Set([`${r} min`, `${r}′`, r])]
    }
    case 'date': {
      const s = String(value)
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
      if (!m) return [s]
      const [, y, mo, d] = m
      const mon = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(mo)]
      return [`${mon} ${Number(d)}, ${y}`, `${mon} ${Number(d)}`, `${Number(mo)}/${Number(d)}/${y!.slice(-2)}`]
    }
    case 'text':
    default:
      return [String(value ?? '')]
  }
}
