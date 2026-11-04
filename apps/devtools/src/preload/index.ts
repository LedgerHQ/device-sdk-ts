import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AiClient, AiEvent } from '@ledgerhq/device-management-kit-devtools-ui'

// Custom APIs for renderer
const api = {}

// Runs Claude in the main process for the dashboard's AI panel
const ai: AiClient = {
  status: (refresh = false) => ipcRenderer.invoke('ai:status', refresh),
  analyze: (request, onEvent) => {
    const id = crypto.randomUUID()
    const listener = (_event: IpcRendererEvent, eventId: string, aiEvent: AiEvent): void => {
      if (eventId !== id) return
      onEvent(aiEvent)
      if (aiEvent.type === 'done' || aiEvent.type === 'error') {
        ipcRenderer.removeListener('ai:event', listener)
      }
    }
    ipcRenderer.on('ai:event', listener)
    ipcRenderer.send('ai:analyze', id, request)
    return () => {
      ipcRenderer.removeListener('ai:event', listener)
      ipcRenderer.send('ai:stop', id)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('ai', ai)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.ai = ai
}
