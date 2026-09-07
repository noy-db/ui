import { defineConfig } from 'vitest/config'

// Repo tooling under scripts/ is not part of any published package, so it is not
// covered by `turbo run test` (which runs each package's own test script). This
// project makes it reachable as `vitest run --project scripts`, wired into CI via
// the root `test:scripts` script.
export default defineConfig({
  test: {
    name: 'scripts',
    root: __dirname,
    include: ['**/*.test.mjs'],
  },
})
