import type { Directive } from 'vue'

// v-ellipsis-title: sets a native title (tooltip) to the element's full text ONLY when the text is
// visually clipped (scrollWidth > clientWidth), so hovering a truncated label/cell reveals the whole
// value — and adds no tooltip noise when nothing is hidden. Re-checked on every re-render (the table's
// column widths are reactive, so width changes trigger an update).
function sync(el: HTMLElement): void {
  const clipped = el.scrollWidth > el.clientWidth + 1
  const full = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (clipped && full) el.setAttribute('title', full)
  else el.removeAttribute('title')
}

export const vEllipsisTitle: Directive<HTMLElement> = {
  mounted: (el) => sync(el),
  updated: (el) => sync(el),
}
