import { ElectronAPI } from '@electron-toolkit/preload'
import type { AiClient } from '@ledgerhq/device-management-kit-devtools-ui'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    ai: AiClient
  }
}
