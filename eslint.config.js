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
              group: [
                '**/app/**',
                '**/components/**',
                '**/store/**',
                '**/universe/**',
                '**/postseason/**',
              ],
              message: 'UI and application layers may depend on the engine, never the reverse.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/universe/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded RNG exported by src/engine.',
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
            { name: 'react', message: 'The universe must remain framework-independent.' },
            { name: 'react-dom', message: 'The universe must remain framework-independent.' },
            { name: 'zustand', message: 'Application state belongs above the universe.' },
          ],
          patterns: [
            {
              group: [
                '**/app/**',
                '**/components/**',
                '**/demo/**',
                '**/store/**',
                '**/postseason/**',
              ],
              message: 'Presentation and application layers may depend on the universe, never the reverse.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/schedule/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded RNG exported by src/engine.',
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
            { name: 'react', message: 'Schedule logic must remain framework-independent.' },
            { name: 'react-dom', message: 'Schedule logic must remain framework-independent.' },
            { name: 'zustand', message: 'Application state belongs above schedule logic.' },
          ],
          patterns: [
            {
              group: [
                '**/app/**',
                '**/components/**',
                '**/demo/**',
                '**/store/**',
                '**/postseason/**',
              ],
              message: 'Presentation and application layers may depend on schedules, never the reverse.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/season/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Season logic must use explicit deterministic inputs.',
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
            { name: 'react', message: 'Season logic must remain framework-independent.' },
            { name: 'react-dom', message: 'Season logic must remain framework-independent.' },
            { name: 'zustand', message: 'Application state belongs above Season State.' },
          ],
          patterns: [
            {
              group: [
                '**/app/**',
                '**/components/**',
                '**/demo/**',
                '**/store/**',
                '**/postseason/**',
              ],
              message: 'Presentation and application layers may depend on Season, never the reverse.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/postseason/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Postseason logic must use explicit deterministic inputs.',
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
            { name: 'react', message: 'Postseason logic must remain framework-independent.' },
            { name: 'react-dom', message: 'Postseason logic must remain framework-independent.' },
            { name: 'zustand', message: 'Application state belongs above Postseason.' },
          ],
          patterns: [
            {
              group: ['**/app/**', '**/components/**', '**/demo/**', '**/store/**'],
              message: 'Presentation and application layers may depend on Postseason, never the reverse.',
            },
          ],
        },
      ],
    },
  },
])
