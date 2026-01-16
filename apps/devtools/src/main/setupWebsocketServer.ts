import { DevToolsWebSocketServer } from '@ledgerhq/device-management-kit-devtools-websocket-server'

let server: DevToolsWebSocketServer | null = null

export function setupWebsocketServer(): void {
  server = new DevToolsWebSocketServer()
  server.start()
}

export function stopWebsocketServer(): void {
  if (server) {
    server.stop()
    server = null
  }
}
