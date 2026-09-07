import { defineConfig, presetWind4, presetIcons, transformerVariantGroup, transformerDirectives } from 'unocss'

// Showcase UnoCSS — generates the utility classes THIS app's templates use, so we no longer depend
// on whichever utilities happen to be baked into @noy-db/ui-suai's pre-compiled style.css (that trap
// left `inset-0`, `bg-black/50`, `mt-5`, `hidden`, … silently doing nothing). Mirrors the ui-suai
// preset/theme so `nui-*` colours, the `nui-*` shortcuts, and `i-lucide-*` icons resolve identically;
// the library's style.css still provides the wind4 reset (loaded first), so we skip ours to avoid a
// duplicate preflight.
export default defineConfig({
  presets: [
    presetWind4({ preflights: { reset: false } }),
    presetIcons({ scale: 1.1, warn: true }),
  ],
  transformers: [transformerVariantGroup(), transformerDirectives()],
  // `i-lucide` (no icon name) is a false positive from SlotPath's `[class^='i-lucide']` selector.
  blocklist: ['i-lucide'],
  theme: {
    colors: {
      'nui-fg': 'var(--nui-fg)',
      'nui-accent': 'var(--nui-accent)',
      'nui-accent-fg': 'var(--nui-accent-fg)',
      'nui-muted': 'var(--nui-muted)',
      'nui-subtle': 'var(--nui-subtle)',
      'nui-border': 'var(--nui-border)',
      'nui-bg': 'var(--nui-bg)',
      'nui-bg-accent': 'var(--nui-bg-accent)',
      'nui-danger': 'var(--nui-danger)',
    },
  },
  shortcuts: {
    'nui-chip': 'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs',
    'nui-btn': 'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors disabled:(opacity-40 pointer-events-none)',
    'nui-btn-ghost': 'nui-btn text-nui-muted hover:bg-nui-bg-accent',
    'nui-btn-soft': 'nui-btn bg-nui-bg-accent text-nui-muted hover:opacity-80',
    'nui-icon-btn': 'inline-flex items-center justify-center rounded hover:bg-nui-bg-accent',
    'nui-field': 'border border-nui-border rounded px-2 py-1 text-sm bg-nui-bg w-full',
    'nui-panel': 'rounded-lg border border-nui-border bg-nui-bg text-nui-fg shadow-lg',
  },
})
