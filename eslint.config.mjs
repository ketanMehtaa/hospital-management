import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      // ✅ Import sorting (VERY useful with AI code)
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',

      // ✅ General code hygiene
      'no-unused-vars': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // ✅ React / Next specific improvements
      'react-hooks/exhaustive-deps': 'warn',

      // ✅ TypeScript strictness boost
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // ✅ MUST BE LAST → disables formatting conflicts
  prettier,

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
