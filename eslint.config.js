import oxlint from 'eslint-plugin-oxlint';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  // Only the RC hooks rules we want (Compiler-aligned)
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/set-state-in-render': 'error',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn'
    }
  },

  // Turn off any ESLint rules that Oxlint already covers to avoid dupes
  ...oxlint.configs['flat/recommended'],

  {
    ignores: ['.react-router/**', '**/*.ts', '**/*.tsx']
  }
]);
