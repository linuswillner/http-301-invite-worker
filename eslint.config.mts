import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-plugin-prettier/recommended'

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
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
