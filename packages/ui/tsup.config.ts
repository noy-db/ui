import { defineConfig } from 'tsup'
import { copyFileSync, mkdirSync } from 'node:fs'

// @noy-db/ui — the framework-agnostic base. Single barrel entry built dual ESM+CJS with types.
// The design tokens ship as a plain stylesheet, copied verbatim into dist (referenced by the
// `./tokens.css` export). Peers (vue, @noy-db/hub, zod) stay external — the consumer provides them.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: 'es2022',
  external: ['vue', '@noy-db/hub', 'zod'],
  onSuccess: async () => {
    mkdirSync('dist', { recursive: true })
    copyFileSync('src/style/tokens.css', 'dist/tokens.css')
  },
})
