import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    files: ['src/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded RNG from src/engine/random instead.',
        },
      ],
      'no-restricted-globals': [
        'error',
        'document',
        'window',
        'localStorage',
        'sessionStorage',
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'The engine must remain framework-independent.' },
            { name: 'react-dom', message: 'The engine must remain framework-independent.' },
            { name: 'zustand', message: 'State adapters belong outside the engine.' },
          ],
          patterns: [
            {
              group: ['**/app/**', '**/components/**', '**/store/**'],
              message: 'UI and application layers may depend on the engine, never the reverse.',
            },
          ],
        },
      ],
    },
  },
])
