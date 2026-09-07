import UnoCSS from '@unocss/vite'

export default defineNuxtConfig({
  ssr: false,
  modules: ['@noy-db/ui-suai/module'],
  noydbUi: { theme: 'system', locale: 'en' },
  // themes.css (tokens) → the library's pre-compiled utilities (via the module) → our own UnoCSS
  // output last, so the showcase's utility classes always resolve (see uno.config.ts).
  css: ['~/assets/themes.css', 'virtual:uno.css'],
  app: {
    head: {
      title: 'noy-db · Vinyl',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..400&family=Public+Sans:wght@400;600;700&family=Saira:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@600;700;800&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..600&family=Bitter:wght@400;500;700&display=swap',
        },
      ],
    },
  },
  vite: {
    plugins: [UnoCSS()],
    resolve: {
      alias: {
        // Serve @noy-db/ui directly from the workspace dist so `pnpm build` in
        // packages/ui reflects immediately without re-copying into the pnpm store.
        '@noy-db/ui': new URL('../../packages/ui/dist', import.meta.url).pathname,
      },
    },
    optimizeDeps: { exclude: ['@noy-db/ui'] },
  },
  compatibilityDate: '2025-01-01',
})
