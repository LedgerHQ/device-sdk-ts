import { app, shell, BrowserWindow, ipcMain, net, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// The renderer CSP cannot list every mock server host, so the renderer calls
// mockserver://proxy/<http|https>/<host:port>/<path> and the main process
// forwards it. The target sits in the path because custom schemes drop ports.
const MOCK_SERVER_SCHEME = 'mockserver'

protocol.registerSchemesAsPrivileged([
  {
    scheme: MOCK_SERVER_SCHEME,
    privileges: { standard: true, supportFetchAPI: true, corsEnabled: true }
  }
])

function forwardMockServerRequest(request: Request): Promise<Response> | Response {
  const { pathname, search } = new URL(request.url)
  const [, target, host, ...path] = pathname.split('/')
  if (target !== 'http' && target !== 'https') {
    return new Response(null, { status: 400 })
  }
  return net.fetch(`${target}://${host}/${path.join('/')}${search}`, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    duplex: 'half'
  } as RequestInit)
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  protocol.handle(MOCK_SERVER_SCHEME, forwardMockServerRequest)

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
import { setupWebsocketServer, stopWebsocketServer } from './setupWebsocketServer'

// Start the WebSocket server when the app is ready
app.whenReady().then(() => {
  setupWebsocketServer()
})

// Stop the WebSocket server when the app is about to quit
app.on('will-quit', () => {
  stopWebsocketServer()
})
