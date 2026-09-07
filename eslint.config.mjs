import js from '@eslint/js'
import tseslint from 'typescript-eslint'

// Flat config. Lints the TypeScript engine + module/composables. Vue SFCs are type-checked by
// vue-tsc (see packages/ui-nuxt typecheck:ui); add eslint-plugin-vue later if SFC linting is wanted.
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.vue'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
)
