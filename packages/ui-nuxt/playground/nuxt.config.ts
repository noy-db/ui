// Playground for the Nuxt UI fork — loads the module from SOURCE (../src/module), so edits to
// the runtime are picked up live. This is the fork's development harness, not a demo app.
export default defineNuxtConfig({
  // '@nuxt/ui' listed explicitly FIRST so it resolves from the playground's own node_modules
  // (single instance); the module's own installModule('@nuxt/ui') then dedupes by name instead
  // of installing a second copy from packages/ui-nuxt/node_modules.
  modules: ['@nuxt/ui', '../src/module'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  compatibilityDate: '2026-07-16',
})
