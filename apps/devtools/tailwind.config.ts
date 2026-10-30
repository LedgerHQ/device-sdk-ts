import { ledgerLivePreset } from '@ledgerhq/lumen-design-core'
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  presets: [ledgerLivePreset]
} satisfies Config
