// The PLAIN example app — same vault, same seed, same engine as examples/showcase;
// rendered by @noy-db/ui-nuxt (the Nuxt UI fork) with default Nuxt UI styling only.
export default defineNuxtConfig({
  // '@nuxt/ui' first so it resolves from this app's node_modules (single instance);
  // the ui-nuxt module's own installModule('@nuxt/ui') then dedupes by name.
  modules: ['@nuxt/ui', '@noy-db/ui-nuxt/module'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  compatibilityDate: '2026-07-16',
})
