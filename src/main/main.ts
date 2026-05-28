import { app, BrowserWindow, ipcMain, screen, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { exec, spawn } from 'child_process'
import { existsSync } from 'fs'
import { registerIpcHandlers } from './ipc'
import { readSettings, writeTimerState, clearTimerState, readTimerState } from './fileStore'

// 중복 실행 방지
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

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

// 타이머 시작 시점 커서 위치 기준 모니터를 저장 (팝업/코너 이동 시 동일 모니터 유지)
let timerDisplay: Electron.Display | null = null

function getResourcesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(process.cwd(), 'resources')
}

function killRoblox(): void {
  if (process.platform === 'win32') {
    exec('taskkill /F /IM RobloxPlayer.exe', { windowsHide: true }, (err) => {
      if (err) exec('taskkill /F /IM RobloxPlayerBeta.exe', { windowsHide: true })
    })
  } else if (process.platform === 'darwin') {
    exec('pkill -x "Roblox"')
  }
}

function pauseTimerInternals(): void {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  timerStart = null
  timerLimitMs = null
  warnedMinutes.clear()
  inCenterMode = false
  timerDisplay = null
  // clearTimerState() 미호출 — pausedRemainingMs 파일 보존
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
  timerDisplay = null
  clearTimerState()
}

// 타이머가 표시될 모니터: 커서 위치 기준 (getPrimaryDisplay 대신 사용)
function getActiveDisplay(): Electron.Display {
  if (timerDisplay) return timerDisplay
  const cursor = screen.getCursorScreenPoint()
  return screen.getDisplayNearestPoint(cursor)
}

// 화면 해상도에 비례한 코너 창 크기 계산
function getCornerInfo(): { w: number; h: number; x: number; y: number } {
  const display = getActiveDisplay()
  const { x: wx, y: wy, width: ww } = display.workArea
  // 1920 기준 200px, 해상도 비례 확대 (최대 360px)
  const scale = ww / 1920
  const w = Math.round(Math.min(360, Math.max(200, 200 * scale)))
  const h = Math.round(w * 0.42)
  return { w, h, x: wx + ww - w - 16, y: wy + 16 }
}

// 화면 해상도에 비례한 센터 창 크기 계산
function getCenterInfo(): { w: number; h: number; x: number; y: number } {
  const display = getActiveDisplay()
  const { x: wx, y: wy, width: ww, height: wh } = display.workArea
  const scale = ww / 1920
  const w = Math.round(Math.min(480, Math.max(320, 320 * scale)))
  const h = Math.round(Math.min(200, Math.max(140, 140 * scale)))
  return {
    w, h,
    x: wx + Math.round((ww - w) / 2),
    y: wy + Math.round((wh - h) / 2),
  }
}

function hideToTray(): void {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(false)
    mainWindow.hide()
  }
}

function moveToCenterPopup(win: BrowserWindow): void {
  win.hide()
  const { w, h, x, y } = getCenterInfo()
  win.setSize(w, h, false)
  win.setPosition(x, y)
  win.webContents.send('timer:mode', { mode: 'center-popup' })
  setTimeout(() => win.show(), 40)
}

function moveToCorner(win: BrowserWindow): void {
  win.hide()
  const { w, h, x, y } = getCornerInfo()
  win.setSize(w, h, false)
  win.setPosition(x, y)
  win.webContents.send('timer:mode', { mode: 'corner' })
  setTimeout(() => win.show(), 40)
}

function restoreWindow(win: BrowserWindow): void {
  win.hide()
  win.setSize(380, 620, false)
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x: wx, y: wy, width: ww, height: wh } = display.workArea
  win.setPosition(wx + Math.round((ww - 380) / 2), wy + Math.round((wh - 620) / 2))
  win.setAlwaysOnTop(false)
  win.setSkipTaskbar(true)
  setTimeout(() => win.show(), 40)
}

function startTimer(win: BrowserWindow, limitMinutes: number, resumeRemainingMs?: number): void {
  stopTimerInternals()

  // 타이머 시작 시점의 커서 위치로 모니터 확정
  const cursor = screen.getCursorScreenPoint()
  timerDisplay = screen.getDisplayNearestPoint(cursor)

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

  const { w, h, x, y } = getCornerInfo()
  win.hide()
  win.setSize(w, h, false)
  win.setPosition(x, y)
  win.setAlwaysOnTop(true, 'floating')
  win.setSkipTaskbar(true)
  setTimeout(() => win.show(), 100)

  timerInterval = setInterval(() => {
    if (timerStart === null || timerLimitMs === null) return

    const elapsed = Date.now() - timerStart
    const remaining = Math.max(0, timerLimitMs - elapsed)
    const remainingSeconds = Math.ceil(remaining / 1000)

    win.webContents.send('timer:tick', { remainingSeconds })

    const minutesLeft = Math.ceil(remaining / 60000)
    for (const warnAt of [5, 3, 1]) {
      if (minutesLeft <= warnAt && limitMinutes > warnAt && minutesLeft > 0 && !warnedMinutes.has(warnAt)) {
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
      win.hide()
      const { w: cw, h: ch, x: cx, y: cy } = getCenterInfo()
      win.setSize(cw, ch, false)
      win.setPosition(cx, cy)
      win.webContents.send('timer:mode', { mode: 'center-countdown' })
      setTimeout(() => win.show(), 40)
    }

    if (remaining <= 0) {
      stopTimerInternals()
      win.webContents.send('timer:mode', { mode: 'shutdown' })
      setTimeout(() => {
        killRoblox()
        hideToTray()
        win.webContents.send('timer:expired')
      }, 3000)
    }
  }, 1000)
}

function tryResumeTimer(): boolean {
  const win = mainWindow
  if (!win) return false

  const settings = readSettings()
  if (!settings.resumeTimerOnRestart) return false

  const state = readTimerState()
  if (!state) return false

  const today = new Date().toISOString().slice(0, 10)
  if (state.date !== today) {
    clearTimerState()
    return false
  }

  // pausedRemainingMs가 있으면 일시정지 스냅샷 사용, 없으면 startTime 기준 계산
  const remaining = state.pausedRemainingMs !== undefined
    ? state.pausedRemainingMs
    : Math.max(0, state.limitMs - (Date.now() - state.startTime))

  if (remaining <= 0) {
    clearTimerState()
    return false
  }

  const limitMinutes = state.limitMs / 60000
  startTimer(win, limitMinutes, remaining)
  win.webContents.send('timer:resumed', { remainingSeconds: Math.ceil(remaining / 1000) })
  return true
}

function spawnWatchdog(): void {
  if (!app.isPackaged) return
  const watchdogPath = join(process.resourcesPath, 'resources', 'watch-loop.ps1')
  if (!existsSync(watchdogPath)) return
  const ps = spawn('powershell.exe', [
    '-NonInteractive', '-WindowStyle', 'Hidden',
    '-ExecutionPolicy', 'Bypass', '-File', watchdogPath,
  ], { detached: true, stdio: 'ignore', windowsHide: true })
  ps.unref()
}

function openAdminWindow(): void {
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.show()
    adminWindow.focus()
    return
  }

  const preloadPath = join(__dirname, '../preload/index.js')
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x: wx, y: wy, width: ww, height: wh } = display.workArea
  const AW = 360, AH = 560

  adminWindow = new BrowserWindow({
    width: AW,
    height: AH,
    x: wx + Math.round((ww - AW) / 2),
    y: wy + Math.round((wh - AH) / 2),
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

function addTrayClick(count = 1): void {
  const now = Date.now()
  trayClicks = trayClicks.filter(t => now - t < 1500)
  for (let i = 0; i < count; i++) trayClicks.push(now)

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
}

function createTray(): void {
  const iconPath = join(getResourcesDir(), 'tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Pact')

  tray.on('click', () => addTrayClick(1))
  // Windows: 빠른 2번 클릭은 double-click 이벤트 1개로 오므로 +2로 계산
  tray.on('double-click', () => addTrayClick(2))
}

function startRobloxDetection(): void {
  if (robloxDetectInterval) return

  robloxDetectInterval = setInterval(() => {
    exec('tasklist /FO CSV /NH', { windowsHide: true }, (err, stdout) => {
      if (err) return
      const isRunning = /RobloxPlayer(Beta)?\.exe/i.test(stdout)

      if (isRunning && !robloxRunning) {
        robloxRunning = true
        // 허용 시간 외에는 main 프로세스에서 즉시 강제 종료
        const settings = readSettings()
        const hour = new Date().getHours()
        if (hour < settings.allowedStartHour || hour >= settings.allowedEndHour) {
          killRoblox()
        } else {
          mainWindow?.webContents.send('roblox:detected')
        }
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
    // resizable: false 제거 — frame:false라 사용자가 크기 조절 불가, setSize()는 정상 동작
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    show: false,
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
    if (!mainWindow) return { resumed: false, remainingSeconds: limitMinutes * 60 }
    const today = new Date().toISOString().slice(0, 10)
    const state = readTimerState()
    if (state && state.date === today && state.pausedRemainingMs !== undefined && state.pausedRemainingMs > 0) {
      // 일시정지 상태 복원 — resumeTimerOnRestart 설정과 무관하게 항상 재개
      startTimer(mainWindow, limitMinutes, state.pausedRemainingMs)
      const remainingSeconds = Math.ceil(state.pausedRemainingMs / 1000)
      return { resumed: true, remainingSeconds }
    }
    startTimer(mainWindow, limitMinutes)
    return { resumed: false, remainingSeconds: limitMinutes * 60 }
  })

  ipcMain.handle('timer:stop', async () => {
    stopTimerInternals()
    hideToTray()
  })

  ipcMain.handle('timer:pause', async () => {
    if (timerStart !== null && timerLimitMs !== null) {
      const remainingMs = Math.max(0, timerLimitMs - (Date.now() - timerStart))
      if (remainingMs > 0) {
        const today = new Date().toISOString().slice(0, 10)
        writeTimerState({ startTime: timerStart, limitMs: timerLimitMs, date: today, pausedRemainingMs: remainingMs })
      } else {
        clearTimerState()
      }
    }
    pauseTimerInternals()
    hideToTray()
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
  spawnWatchdog()

  mainWindow?.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      const resumed = tryResumeTimer()
      if (!resumed) mainWindow?.hide()
    }, 500)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 트레이에서 계속 실행 — 종료하지 않음
})
