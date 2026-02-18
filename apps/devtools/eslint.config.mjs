import baseConfig from '@ledgerhq/eslint-config-dsdk'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default [
  ...baseConfig,
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.web.json'
      }
    }
  },
  {
    files: ['electron.vite.config.*', 'src/main/**/*', 'src/preload/**/*.ts'],
    ignores: ['**/*.d.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.node.json'
      }
    }
  },
  {
    files: ['electron.vite.config.*', 'src/main/**/*', 'src/preload/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off'
    }
  },
  {
    files: ['eslint.config.mjs'],
    languageOptions: {
      parserOptions: {
        project: null
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      'no-restricted-syntax': 0,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'react/react-in-jsx-scope': 'off'
    }
  }
]
