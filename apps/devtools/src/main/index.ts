import { app, shell, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// The renderer CSP cannot list every mock server host, so the renderer calls
// mockserver://proxy/<http|https>/<host:port>/<path> and the main process
// forwards it. The target sits in the path because custom schemes drop ports.
const MOCK_SERVER_SCHEME = 'mockserver'

// The connected app names its mock server, so the user approves each origin the proxy may reach
const mockServerApprovals = new Map<string, Promise<boolean>>()

function approveMockServer(origin: string): Promise<boolean> {
  let approval = mockServerApprovals.get(origin)
  if (!approval) {
    const options = {
      type: 'question' as const,
      buttons: ['Allow', 'Deny'],
      defaultId: 1,
      cancelId: 1,
      message: `Show the mock device screen from ${origin}?`,
      detail:
        'The app connected to the DevTools says it uses this mock server. The DevTools will send it requests for the device screen. Deny if you do not recognise it.'
    }
    const window = BrowserWindow.getAllWindows()[0]
    approval = (
      window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)
    ).then(({ response }) => response === 0)
    mockServerApprovals.set(origin, approval)
  }
  return approval
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: MOCK_SERVER_SCHEME,
    privileges: { standard: true, supportFetchAPI: true, corsEnabled: true }
  }
])

async function forwardMockServerRequest(request: Request): Promise<Response> {
  const { pathname, search } = new URL(request.url)
  const [, target, host, ...path] = pathname.split('/')
  if (target !== 'http' && target !== 'https') {
    return new Response(null, { status: 400 })
  }
  const url = `${target}://${host}/${path.join('/')}${search}`
  if (!(await approveMockServer(new URL(url).origin))) {
    return new Response(null, { status: 403 })
  }
  try {
    return await net.fetch(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      duplex: 'half',
      // A redirect would reach an origin nobody approved, so it fails the request
      redirect: 'manual'
    } as RequestInit)
  } catch {
    return new Response(null, { status: 502 })
  }
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
    // Links can come from the connected app: never hand another scheme to the OS
    if (/^https?:\/\//i.test(details.url)) shell.openExternal(details.url)
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
import { setupAi } from './ai'

// Start the WebSocket server when the app is ready
app.whenReady().then(() => {
  setupWebsocketServer()
  setupAi()
})

// Stop the WebSocket server when the app is about to quit
app.on('will-quit', () => {
  stopWebsocketServer()
})
