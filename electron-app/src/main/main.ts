import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

let timerStart: number | null = null
let timerLimitMs: number | null = null
let timerInterval: ReturnType<typeof setInterval> | null = null
const warnedMinutes = new Set<number>()
let inCenterMode = false

const CORNER_W = 172, CORNER_H = 72
const CENTER_W = 320, CENTER_H = 140

function killRoblox(): void {
  if (process.platform === 'darwin') {
    exec('pkill -x "Roblox"', (err) => {
      if (err) console.log('Roblox not running or already closed')
    })
  } else if (process.platform === 'win32') {
    exec('taskkill /F /IM RobloxPlayer.exe', (err) => {
      if (err) {
        exec('taskkill /F /IM RobloxPlayerBeta.exe', (err2) => {
          if (err2) console.log('Roblox not running or already closed')
        })
      }
    })
  }
}

function stopTimer(): void {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  timerStart = null
  timerLimitMs = null
  warnedMinutes.clear()
  inCenterMode = false
}

function restoreWindow(win: BrowserWindow): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  win.setSize(480, 640, true)
  win.setPosition(
    Math.round((width - 480) / 2),
    Math.round((height - 640) / 2)
  )
  win.setAlwaysOnTop(false)
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
  const { x, y } = getCenterPos()
  win.setSize(CENTER_W, CENTER_H, true)
  win.setPosition(x, y)
  win.webContents.send('timer:mode', { mode: 'center-popup' })
}

function moveToCorner(win: BrowserWindow): void {
  const { x, y } = getCornerPos()
  win.setSize(CORNER_W, CORNER_H, true)
  win.setPosition(x, y)
  win.webContents.send('timer:mode', { mode: 'corner' })
}

function startTimer(win: BrowserWindow, limitMinutes: number): void {
  stopTimer()
  timerStart = Date.now()
  timerLimitMs = limitMinutes * 60 * 1000
  warnedMinutes.clear()
  inCenterMode = false

  const { x: cornerX, y: cornerY } = getCornerPos()
  win.setSize(CORNER_W, CORNER_H, true)
  win.setPosition(cornerX, cornerY)
  win.setAlwaysOnTop(true, 'floating')

  timerInterval = setInterval(() => {
    if (timerStart === null || timerLimitMs === null) return

    const elapsed = Date.now() - timerStart
    const remaining = Math.max(0, timerLimitMs - elapsed)
    const remainingSeconds = Math.ceil(remaining / 1000)

    win.webContents.send('timer:tick', { remainingSeconds })

    // 분 단위 경고 (5, 3, 1분) → 중앙 팝업 4초 후 코너 복귀
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

    // 30초 경고 → 중앙 팝업 4초 후 코너 복귀
    if (remainingSeconds <= 30 && remainingSeconds > 10 && !warnedMinutes.has(0)) {
      warnedMinutes.add(0)
      win.webContents.send('timer:warning', { minutesLeft: 0 })
      if (!inCenterMode) {
        moveToCenterPopup(win)
        setTimeout(() => { if (!inCenterMode) moveToCorner(win) }, 4000)
      }
    }

    // 10초부터 중앙 카운트다운 (영구 유지)
    if (remainingSeconds <= 10 && remainingSeconds > 0 && !warnedMinutes.has(-1)) {
      warnedMinutes.add(-1)
      inCenterMode = true
      const { x, y } = getCenterPos()
      win.setSize(CENTER_W, CENTER_H, true)
      win.setPosition(x, y)
      win.webContents.send('timer:mode', { mode: 'center-countdown' })
    }

    // 타이머 종료
    if (remaining <= 0) {
      stopTimer()
      win.webContents.send('timer:mode', { mode: 'shutdown' })
      setTimeout(() => {
        killRoblox()
        restoreWindow(win)
        win.webContents.send('timer:expired')
      }, 3000)
    }
  }, 1000)
}

function createWindow(): void {
  const preloadPath = join(__dirname, '../preload/index.js')

  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  ipcMain.handle('timer:start', async (_e, { limitMinutes }: { limitMinutes: number }) => {
    if (mainWindow) startTimer(mainWindow, limitMinutes)
  })

  ipcMain.handle('timer:stop', async () => {
    stopTimer()
    if (mainWindow) restoreWindow(mainWindow)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    stopTimer()
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
