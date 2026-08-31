// ESLint flat config (ESLint 9+/10). Lints the library source and the tests.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'demo', 'coverage', 'src/generated'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.es2021 } },
  },
  {
    // The hooks rule would have caught the conditional-hook bug in DocViewer.
    files: ['src/react/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    // Node scripts and CommonJS config files.
    files: ['scripts/**/*.mjs', '*.config.{js,cjs,mjs}', 'commitlint.config.cjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
)
