import { app, BrowserWindow, ipcMain, screen, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { registerIpcHandlers } from './ipc'
import { readSettings, writeTimerState, clearTimerState, readTimerState } from './fileStore'

let mainWindow: BrowserWindow | null = null
let adminWindow: BrowserWindow | null = null
let tray: Tray | null = null

let timerStart: number | null = null
let timerLimitMs: number | null = null
let timerInterval: ReturnType<typeof setInterval> | null = null
const warnedMinutes = new Set<number>()
let inCenterMode = false

let trayClicks: number[] = []
let trayClickTimer: ReturnType<typeof setTimeout> | null = null

let robloxDetectInterval: ReturnType<typeof setInterval> | null = null
let robloxRunning = false

const CORNER_W = 172, CORNER_H = 72
const CENTER_W = 320, CENTER_H = 140

function getResourcesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(process.cwd(), 'resources')
}

function killRoblox(): void {
  if (process.platform === 'win32') {
    exec('taskkill /F /IM RobloxPlayer.exe', (err) => {
      if (err) exec('taskkill /F /IM RobloxPlayerBeta.exe')
    })
  } else if (process.platform === 'darwin') {
    exec('pkill -x "Roblox"')
  }
}

function stopTimerInternals(): void {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  timerStart = null
  timerLimitMs = null
  warnedMinutes.clear()
  inCenterMode = false
  clearTimerState()
}

function getCornerPos(): { x: number; y: number } {
  const { width } = screen.getPrimaryDisplay().workAreaSize
  return { x: width - CORNER_W - 16, y: 16 }
}

function getCenterPos(): { x: number; y: number } {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  return {
    x: Math.round((width - CENTER_W) / 2),
    y: Math.round((height - CENTER_H) / 2),
  }
}

function moveToCenterPopup(win: BrowserWindow): void {
  win.setOpacity(0)
  const { x, y } = getCenterPos()
  win.setSize(CENTER_W, CENTER_H, false)
  win.setPosition(x, y)
  win.webContents.send('timer:mode', { mode: 'center-popup' })
  setTimeout(() => win.setOpacity(1), 40)
}

function moveToCorner(win: BrowserWindow): void {
  win.setOpacity(0)
  const { x, y } = getCornerPos()
  win.setSize(CORNER_W, CORNER_H, false)
  win.setPosition(x, y)
  win.webContents.send('timer:mode', { mode: 'corner' })
  setTimeout(() => win.setOpacity(1), 40)
}

function restoreWindow(win: BrowserWindow): void {
  win.setOpacity(0)
  win.setSize(380, 620, false)
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  win.setPosition(Math.round((width - 380) / 2), Math.round((height - 620) / 2))
  win.setAlwaysOnTop(false)
  win.setSkipTaskbar(true)
  win.show()
  setTimeout(() => win.setOpacity(1), 40)
}

function startTimer(win: BrowserWindow, limitMinutes: number, resumeRemainingMs?: number): void {
  stopTimerInternals()

  const limitMs = limitMinutes * 60 * 1000
  timerLimitMs = limitMs

  if (resumeRemainingMs !== undefined) {
    timerStart = Date.now() - (limitMs - resumeRemainingMs)
  } else {
    timerStart = Date.now()
  }

  warnedMinutes.clear()
  inCenterMode = false

  const settings = readSettings()
  if (settings.resumeTimerOnRestart) {
    const today = new Date().toISOString().slice(0, 10)
    writeTimerState({ startTime: timerStart, limitMs: timerLimitMs, date: today })
  }

  win.setOpacity(0)
  const { x, y } = getCornerPos()
  win.setSize(CORNER_W, CORNER_H, false)
  win.setPosition(x, y)
  win.setAlwaysOnTop(true, 'floating')
  win.setSkipTaskbar(true)
  setTimeout(() => win.setOpacity(1), 40)

  timerInterval = setInterval(() => {
    if (timerStart === null || timerLimitMs === null) return

    const elapsed = Date.now() - timerStart
    const remaining = Math.max(0, timerLimitMs - elapsed)
    const remainingSeconds = Math.ceil(remaining / 1000)

    win.webContents.send('timer:tick', { remainingSeconds })

    const minutesLeft = Math.ceil(remaining / 60000)
    for (const warnAt of [5, 3, 1]) {
      if (minutesLeft <= warnAt && minutesLeft > 0 && !warnedMinutes.has(warnAt)) {
        warnedMinutes.add(warnAt)
        win.webContents.send('timer:warning', { minutesLeft: warnAt })
        if (!inCenterMode) {
          moveToCenterPopup(win)
          setTimeout(() => { if (!inCenterMode) moveToCorner(win) }, 4000)
        }
      }
    }

    if (remainingSeconds <= 30 && remainingSeconds > 10 && !warnedMinutes.has(0)) {
      warnedMinutes.add(0)
      win.webContents.send('timer:warning', { minutesLeft: 0 })
      if (!inCenterMode) {
        moveToCenterPopup(win)
        setTimeout(() => { if (!inCenterMode) moveToCorner(win) }, 4000)
      }
    }

    if (remainingSeconds <= 10 && remainingSeconds > 0 && !warnedMinutes.has(-1)) {
      warnedMinutes.add(-1)
      inCenterMode = true
      win.setOpacity(0)
      const { x: cx, y: cy } = getCenterPos()
      win.setSize(CENTER_W, CENTER_H, false)
      win.setPosition(cx, cy)
      win.webContents.send('timer:mode', { mode: 'center-countdown' })
      setTimeout(() => win.setOpacity(1), 40)
    }

    if (remaining <= 0) {
      stopTimerInternals()
      win.webContents.send('timer:mode', { mode: 'shutdown' })
      setTimeout(() => {
        killRoblox()
        restoreWindow(win)
        win.webContents.send('timer:expired')
      }, 3000)
    }
  }, 1000)
}

function tryResumeTimer(): void {
  const win = mainWindow
  if (!win) return

  const settings = readSettings()
  if (!settings.resumeTimerOnRestart) return

  const state = readTimerState()
  if (!state) return

  const today = new Date().toISOString().slice(0, 10)
  if (state.date !== today) {
    clearTimerState()
    return
  }

  const elapsed = Date.now() - state.startTime
  const remaining = state.limitMs - elapsed
  if (remaining <= 0) {
    clearTimerState()
    return
  }

  const limitMinutes = state.limitMs / 60000
  startTimer(win, limitMinutes, remaining)
  win.webContents.send('timer:resumed', { remainingSeconds: Math.ceil(remaining / 1000) })
}

function openAdminWindow(): void {
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.show()
    adminWindow.focus()
    return
  }

  const preloadPath = join(__dirname, '../preload/index.js')

  adminWindow = new BrowserWindow({
    width: 360,
    height: 560,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0f0f1e',
    hasShadow: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    adminWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#admin`)
  } else {
    adminWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'admin' })
  }

  adminWindow.on('closed', () => {
    adminWindow = null
  })
}

function createTray(): void {
  const iconPath = join(getResourcesDir(), 'tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Pact')

  tray.on('click', () => {
    const now = Date.now()
    trayClicks = trayClicks.filter(t => now - t < 1500)
    trayClicks.push(now)

    if (trayClickTimer) clearTimeout(trayClickTimer)

    if (trayClicks.length >= 3) {
      trayClicks = []
      openAdminWindow()
      return
    }

    trayClickTimer = setTimeout(() => {
      trayClicks = []
      mainWindow?.show()
      mainWindow?.focus()
    }, 400)
  })
}

function startRobloxDetection(): void {
  if (robloxDetectInterval) return

  robloxDetectInterval = setInterval(() => {
    exec('tasklist /FO CSV /NH', (err, stdout) => {
      if (err) return
      const isRunning = /RobloxPlayer(Beta)?\.exe/i.test(stdout)

      if (isRunning && !robloxRunning) {
        robloxRunning = true
        mainWindow?.webContents.send('roblox:detected')
      } else if (!isRunning && robloxRunning) {
        robloxRunning = false
        mainWindow?.webContents.send('roblox:closed')
      }
    })
  }, 3000)
}

function createWindow(): void {
  const preloadPath = join(__dirname, '../preload/index.js')

  mainWindow = new BrowserWindow({
    width: 380,
    height: 620,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    skipTaskbar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow?.hide()
  })

  ipcMain.handle('timer:start', async (_e, { limitMinutes }: { limitMinutes: number }) => {
    if (mainWindow) startTimer(mainWindow, limitMinutes)
  })

  ipcMain.handle('timer:stop', async () => {
    stopTimerInternals()
    if (mainWindow) restoreWindow(mainWindow)
  })

  ipcMain.handle('timer:get-status', async () => {
    if (timerStart === null || timerLimitMs === null) {
      return { running: false, remainingSeconds: 0 }
    }
    const elapsed = Date.now() - timerStart
    const remaining = Math.max(0, timerLimitMs - elapsed)
    return { running: true, remainingSeconds: Math.ceil(remaining / 1000) }
  })

  ipcMain.handle('timer:add-time', async (_e, { minutes }: { minutes: number }) => {
    if (timerStart === null || timerLimitMs === null) return
    timerLimitMs += minutes * 60 * 1000
    const settings = readSettings()
    if (settings.resumeTimerOnRestart && timerStart !== null) {
      const today = new Date().toISOString().slice(0, 10)
      writeTimerState({ startTime: timerStart, limitMs: timerLimitMs, date: today })
    }
  })

  ipcMain.handle('timer:admin-stop', async () => {
    stopTimerInternals()
    if (mainWindow) {
      restoreWindow(mainWindow)
      mainWindow.webContents.send('timer:admin-stopped')
    }
  })

  ipcMain.handle('admin:close-window', async () => {
    adminWindow?.close()
  })

  ipcMain.handle('admin:get-resume-option', async () => {
    return readSettings().resumeTimerOnRestart
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    stopTimerInternals()
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  createTray()
  startRobloxDetection()

  if (process.platform === 'win32' && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true, name: 'Pact' })
  }

  mainWindow?.webContents.once('did-finish-load', () => {
    setTimeout(() => tryResumeTimer(), 500)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 트레이에서 계속 실행 — 종료하지 않음
})
