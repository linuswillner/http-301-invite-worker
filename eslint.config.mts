import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, includeIgnoreFile } from 'eslint/config'
import prettier from 'eslint-plugin-prettier/recommended'
import { fileURLToPath } from 'node:url'

export default defineConfig([
  includeIgnoreFile(fileURLToPath(new URL('./.gitignore', import.meta.url))),
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    ignores: ['**/generated/**/*.ts'],
    plugins: { js },
    extends: ['js/recommended', tseslint.configs.recommendedTypeChecked, prettier],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true
      }
    }
  }
])
