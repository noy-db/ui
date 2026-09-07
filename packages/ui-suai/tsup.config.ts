import { defineConfig } from 'tsup'
import { cpSync } from 'node:fs'

// @noy-db/ui-suai — the Nuxt binding. tsup builds only the module factory (src/module.ts → the file
// Nuxt imports during config). The runtime — .vue components, internal sub-components, core/
// composables, the client plugin — ships as SOURCE under dist/runtime and is compiled by the
// consuming Nuxt app (Nuxt transpiles module runtime). The module resolves to ./runtime/* at run time.
// Pre-compiled CSS (dist/style.css) is produced by the build:css step after this (see package.json).
export default defineConfig({
  entry: { module: 'src/module.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: 'es2022',
  external: ['@nuxt/kit', '@nuxt/schema', 'nuxt', 'vue', '@noy-db/ui', '@noy-db/hub'],
  onSuccess: async () => {
    // ship the runtime tree verbatim — the consuming app compiles the .vue/.ts
    cpSync('src/runtime', 'dist/runtime', { recursive: true })
  },
})
