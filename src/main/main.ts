import { app, BrowserWindow, ipcMain, screen, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { exec, execFileSync, spawn } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { registerIpcHandlers } from './ipc'
import { requireAdminSession } from './adminAuth'
import {
  readSettings, writeTimerState, clearTimerState, readTimerState,
  readDailyUsage, writeDailyUsage, appendSession, readSessions,
} from './fileStore'
import { isHourAllowed } from '../shared/policy'
import { shouldRequireApprovalForStart } from '../shared/startPolicy'
import { shouldBlockTimerStartWithoutRoblox, shouldPauseTimerWhenRobloxMissing } from '../shared/robloxSync'
import { normalizeTimerAdjustmentMinutes } from '../shared/timerAdjust'
import { decideStartupWindowAction, shouldStartHiddenFromLaunch } from '../shared/startupVisibility'
import { isDailyUsageExhausted, normalizeDailyUsage, shouldPersistNormalizedDailyUsage } from '../shared/dailyUsage'
import type { DailyUsage, Session, TimerState } from '../shared/types'

// Packaged app must run once per Windows user/session. Electron's single instance
// lock can block a standard-user session when another account already has My Pact
// running, so keep the lock only for local development. The watchdog already
// prevents duplicate packaged instances inside the same session.
if (!app.isPackaged && !app.requestSingleInstanceLock()) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let adminWindow: BrowserWindow | null = null
let tray: Tray | null = null
let allowQuit = false

let timerStart: number | null = null
let timerLimitMs: number | null = null
let timerSessionStartTime = ''
let timerLimitAtSession = 0
let timerInterval: ReturnType<typeof setInterval> | null = null
const warnedMinutes = new Set<number>()
let inCenterMode = false
let timerUiMode: 'corner' | 'center-popup' | 'center-countdown' | 'shutdown' = 'corner'

let trayClicks: number[] = []
let trayClickTimer: ReturnType<typeof setTimeout> | null = null

let robloxDetectInterval: ReturnType<typeof setInterval> | null = null
let robloxRunning = false
let lastRobloxBlockedReason = ''
let lastRobloxPresenceCheck = 0
type RobloxLaunchCommand = { executablePath: string; args: string[] }
let pendingApprovalRobloxLaunch: RobloxLaunchCommand | null = null
let pendingApprovalRobloxLaunchAt = 0
const PENDING_APPROVAL_LAUNCH_TTL_MS = 2 * 60 * 1000

let timerDisplay: Electron.Display | null = null
let volatileDailyUsage: DailyUsage | null = null
const startHidden = shouldStartHiddenFromLaunch({ argv: process.argv, isPackaged: app.isPackaged })
let robloxBaselineCaptured = false
let parentApprovalGrantedForNextSession = false
const COMMON_APP_DATA_DIR = process.platform === 'win32' ? 'C:\\ProgramData' : app.getPath('userData')
const WATCHDOG_DISABLED_PATH = join(COMMON_APP_DATA_DIR, 'MyPact', 'Admin', 'watchdog-disabled.flag')
const FALLBACK_TRAY_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAB6ElEQVR4nI2SQUgUYRTHX0TdI9jd2R0NPARRLCYliLDe1Et2iDCo9KQiwSJ0CDYFPdimwmIYKOwcEiMS6RLoJaKCiKFZamfDgohaRGgCq6MwY/7j/+3OsO1uWw+Gx/f+v//73nzfJ9IgHNG/OaKDuRFXE6aEEjkJXy2b/e/I/5oPmBJyTQnhk0S/b4vubkmMkyw6onf8s4Ej+rwlYbw6HEP+8ihujaaQH7iG59op5CXCSeYbmY2XEsLGzduYnMyAMTKSUtkwVlWdOrl65iuvJYziXQM7Oz8QjcaRTt+BH5ZVUJk6OfJ/NPgiMftF90Ukk1PwvD309PSjpeUsKoN16uTIV+6u2aJhK7sSwK7rorm5DclzA6gOcuTp8xu0c6zU9WksLz8KwIUzvdh9+BjTxzuDGnVy5d9o9xu05iSC9aUVFIvbAfxz/SnsC0PoO3oCTU2nkc3eVzq5XOlGWv0Gh96L9uvj1BxM823NyOPjaXUeY2MTSidHnr7gHL6K/uDJsTbMzSzVNKgM6uTIV19jfFM0vLk0BM/zkMkYymDbH1TmmnXqm6UDjNd7C4MF0bCROA/r3iqwv4/h4ZTKXLNeKJkHG73G7s8SfWdJBM8Oalg7mVCZa9ap/9Vc1ajLEf2GI/psOXfV434Du+O1a17Rx5AAAAAASUVORK5CYII='

function getDailyUsage(): DailyUsage {
  const today = getLocalDateString()
  const storedUsage = volatileDailyUsage?.date === today ? volatileDailyUsage : readDailyUsage()
  if (volatileDailyUsage?.date !== today) {
    volatileDailyUsage = null
  }
  const usage = normalizeDailyUsage({
    storedUsage,
    sessions: readSessions(),
    dateKey: today,
  })
  volatileDailyUsage = usage
  if (shouldPersistNormalizedDailyUsage(storedUsage, usage)) {
    try {
      writeDailyUsage(usage)
    } catch (err) {
      console.error('daily-usage normalization write failed; continuing enforcement in memory', err)
    }
  }
  return usage
}

function safeWriteTimerState(state: TimerState): void {
  try {
    writeTimerState(state)
  } catch (err) {
    console.error('timer-state write failed; continuing enforcement in memory', err)
  }
}

function safeClearTimerState(): void {
  try {
    clearTimerState()
  } catch (err) {
    console.error('timer-state clear failed', err)
  }
}

function safeWriteDailyUsage(usage: DailyUsage): void {
  volatileDailyUsage = usage
  try {
    writeDailyUsage(usage)
  } catch (err) {
    console.error('daily-usage write failed; continuing enforcement in memory', err)
  }
}

function safeAppendSession(session: Omit<Session, 'id'>): void {
  try {
    appendSession(session)
  } catch (err) {
    console.error('session append failed; continuing enforcement', err)
  }
}

function disableWatchdog(): void {
  try {
    mkdirSync(join(COMMON_APP_DATA_DIR, 'MyPact'), { recursive: true })
    writeFileSync(WATCHDOG_DISABLED_PATH, new Date().toISOString(), 'utf-8')
  } catch (err) {
    console.error('watchdog disable flag write failed', err)
  }
}

function stopWatchdogProcesses(): void {
  if (process.platform !== 'win32') return
  exec('schtasks /delete /tn "MyPact" /f', { windowsHide: true })
  exec('schtasks /delete /tn "MyPactForMyFuture" /f', { windowsHide: true })
  exec('schtasks /delete /tn "PactWatchdog" /f', { windowsHide: true })
  exec('reg delete "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v MyPact /f', { windowsHide: true })
  exec('reg delete "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v MyPactForMyFuture /f', { windowsHide: true })
  exec('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v MyPact /f', { windowsHide: true })
  exec('taskkill /F /IM powershell.exe /FI "WINDOWTITLE eq MyPactWatchdog" /T', { windowsHide: true })
  exec('powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq \'powershell.exe\' -or $_.Name -eq \'wscript.exe\') -and ($_.CommandLine -like \'*watch-loop.ps1*\' -or $_.CommandLine -like \'*start-watch-loop.vbs*\') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"', { windowsHide: true })
}

function getResourcesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(process.cwd(), 'resources')
}


function spawnSessionWatchdog(): void {
  if (process.platform !== 'win32' || !app.isPackaged) return
  if (process.argv.includes('--no-watchdog')) return
  const launcherPath = join(getResourcesDir(), 'start-watch-loop.vbs')
  exec(`wscript.exe //B //Nologo "${launcherPath}"`, { windowsHide: true }, (err) => {
    if (err) console.error('session watchdog spawn failed', err)
  })
}

function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getLocalTimeString(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function isAllowedHour(): boolean {
  const settings = readSettings()
  const hour = new Date().getHours()
  return isHourAllowed(hour, settings.allowedStartHour, settings.allowedEndHour)
}

function killRoblox(retries = 2): void {
  if (process.platform === 'win32') {
    for (const imageName of ['RobloxPlayer.exe', 'RobloxPlayerBeta.exe']) {
      exec(`taskkill /F /IM ${imageName}`, { windowsHide: true })
    }
    if (retries > 0) setTimeout(() => killRoblox(retries - 1), 1500)
  } else if (process.platform === 'darwin') {
    exec('pkill -x "Roblox"')
  }
}

function splitWindowsCommandLine(commandLine: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < commandLine.length; i++) {
    const ch = commandLine[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (/\s/.test(ch) && !inQuotes) {
      if (current) {
        result.push(current)
        current = ''
      }
      continue
    }
    current += ch
  }

  if (current) result.push(current)
  return result
}

function getRobloxLaunchCommand(): RobloxLaunchCommand | null {
  if (process.platform !== 'win32') return null
  try {
    const ps = "$p=Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('RobloxPlayer.exe','RobloxPlayerBeta.exe') } | Select-Object -First 1 ExecutablePath,CommandLine; if ($p) { $p | ConvertTo-Json -Compress }"
    const stdout = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim()
    if (!stdout) return null
    const parsed = JSON.parse(stdout) as { ExecutablePath?: string; CommandLine?: string }
    if (!parsed.ExecutablePath) return null
    const parts = splitWindowsCommandLine(parsed.CommandLine ?? '')
    const args = parts.length > 0 ? parts.slice(1) : []
    return { executablePath: parsed.ExecutablePath, args }
  } catch (err) {
    console.error('capture Roblox launch command failed', err)
    return null
  }
}

function rememberPendingApprovalRobloxLaunch(): void {
  pendingApprovalRobloxLaunch = getRobloxLaunchCommand()
  pendingApprovalRobloxLaunchAt = pendingApprovalRobloxLaunch ? Date.now() : 0
}

function launchPendingApprovalRoblox(): boolean {
  const pending = pendingApprovalRobloxLaunch
  pendingApprovalRobloxLaunch = null
  if (!pending) return false
  if (Date.now() - pendingApprovalRobloxLaunchAt > PENDING_APPROVAL_LAUNCH_TTL_MS) return false
  try {
    const child = spawn(pending.executablePath, pending.args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    child.unref()
    robloxRunning = false
    robloxBaselineCaptured = true
    return true
  } catch (err) {
    console.error('launch pending Roblox after approval failed', err)
    return false
  }
}

function isRobloxProcessRunning(): boolean {
  if (process.platform !== 'win32') return false
  try {
    const stdout = execFileSync('tasklist.exe', ['/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
    })
    return /RobloxPlayer(Beta)?\.exe/i.test(stdout)
  } catch {
    return false
  }
}

// 세션 카운트 헬퍼
function getTodaySessionCount(): { sessionsPerDay: number; perSessionMinutes: number } {
  const settings = readSettings()
  const dow = new Date().getDay()
  const isWeekend = dow === 0 || dow === 6
  return {
    sessionsPerDay: isWeekend ? settings.weekendSessionCount : settings.weekdaySessionCount,
    perSessionMinutes: isWeekend ? settings.weekendLimit : settings.weekdayLimit,
  }
}

function isSessionExhausted(today: string): boolean {
  const usage = getDailyUsage()
  const { sessionsPerDay } = getTodaySessionCount()
  return usage.date === today && isDailyUsageExhausted(usage, sessionsPerDay)
}

function pauseTimerInternals(): void {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  timerStart = null
  timerLimitMs = null
  timerSessionStartTime = ''
  timerLimitAtSession = 0
  warnedMinutes.clear()
  inCenterMode = false
  timerUiMode = 'corner'
  timerDisplay = null
}

function stopTimerInternals(): void {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  timerStart = null
  timerLimitMs = null
  timerSessionStartTime = ''
  timerLimitAtSession = 0
  warnedMinutes.clear()
  inCenterMode = false
  timerUiMode = 'corner'
  timerDisplay = null
  safeClearTimerState()
}

function persistPausedTimer(): void {
  if (timerStart === null || timerLimitMs === null) return
  const remainingMs = Math.max(0, timerLimitMs - (Date.now() - timerStart))
  const today = getLocalDateString()
  const usage = getDailyUsage()
  safeWriteDailyUsage({
    date: today,
    sessionsCompleted: (usage?.date === today ? usage.sessionsCompleted : 0),
    currentSessionRemainingMs: remainingMs,
  })
  if (remainingMs > 0) {
    safeWriteTimerState({
      startTime: timerStart,
      limitMs: timerLimitMs,
      date: today,
      pausedRemainingMs: remainingMs,
      sessionStartTime: timerSessionStartTime,
      limitAtSession: timerLimitAtSession,
    })
  } else {
    safeClearTimerState()
  }
}

function pauseActiveTimer(): void {
  persistPausedTimer()
  pauseTimerInternals()
  hideToTray()
}

function pauseTimerBecauseRobloxClosed(): void {
  if (!shouldPauseTimerWhenRobloxMissing(timerStart !== null, false)) return
  robloxRunning = false
  pauseActiveTimer()
  mainWindow?.webContents.send('roblox:closed')
}

function approveNextSession(): boolean {
  parentApprovalGrantedForNextSession = true
  return launchPendingApprovalRoblox()
}

function consumeParentApprovalForFreshSession(): void {
  parentApprovalGrantedForNextSession = false
}

function hasParentApprovalForFreshSession(settings = readSettings()): boolean {
  return !shouldRequireApprovalForStart(settings, { hasActiveSession: false }) || parentApprovalGrantedForNextSession
}

function startTimerForDetectedRoblox(): boolean {
  if (!mainWindow || timerStart !== null) return false
  if (shouldBlockTimerStartWithoutRoblox(app.isPackaged, isRobloxProcessRunning())) return false
  const today = getLocalDateString()
  const { perSessionMinutes, sessionsPerDay } = getTodaySessionCount()
  const usage = getDailyUsage()
  const usageToday = usage && usage.date === today ? usage : null
  if (usageToday && usageToday.currentSessionRemainingMs > 0) {
    startTimer(mainWindow, perSessionMinutes, usageToday.currentSessionRemainingMs)
    return true
  }
  if ((usageToday?.sessionsCompleted ?? 0) >= sessionsPerDay) {
    killRoblox()
    return false
  }
  const settings = readSettings()
  if (!hasParentApprovalForFreshSession(settings)) {
    rememberPendingApprovalRobloxLaunch()
    killRoblox()
    showRobloxBlocked('approval-required')
    return false
  }
  consumeParentApprovalForFreshSession()
  startTimer(mainWindow, perSessionMinutes)
  return true
}

function getActiveDisplay(): Electron.Display {
  if (timerDisplay) return timerDisplay
  const cursor = screen.getCursorScreenPoint()
  return screen.getDisplayNearestPoint(cursor)
}

function getCornerInfo(): { w: number; h: number; x: number; y: number } {
  const display = getActiveDisplay()
  const { x: wx, y: wy, width: ww } = display.workArea
  const scale = ww / 1920
  const w = Math.round(Math.min(360, Math.max(200, 200 * scale)))
  const h = Math.round(w * 0.42)
  return { w, h, x: wx + ww - w - 16, y: wy + 16 }
}

// 경고 팝업: 화면 상단 30% (게임 캐릭터/마우스 미침범)
function getCenterInfo(): { w: number; h: number; x: number; y: number } {
  const display = getActiveDisplay()
  const { x: wx, y: wy, width: ww, height: wh } = display.workArea
  const scale = ww / 1920
  const w = Math.round(Math.min(480, Math.max(320, 320 * scale)))
  const h = Math.round(Math.min(200, Math.max(140, 140 * scale)))
  return {
    w, h,
    x: wx + Math.round((ww - w) / 2),
    y: wy + Math.round(wh * 0.30),
  }
}

function hideToTray(): void {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(false)
    mainWindow.hide()
  }
}

function showRobloxBlocked(reason: 'outside-hours' | 'daily-exhausted' | 'approval-required'): void {
  if (!mainWindow) return
  const settings = readSettings()
  const message = reason === 'outside-hours'
    ? `지금은 Roblox 허용 시간이 아닙니다. (${settings.allowedStartHour}시 ~ ${settings.allowedEndHour}시)`
    : reason === 'approval-required'
      ? '부모님 PIN 승인 후 Roblox를 시작할 수 있습니다.'
      : '오늘 Roblox 게임 시간을 모두 사용했습니다.'
  const key = `${reason}:${getLocalDateString()}:${new Date().getHours()}:${new Date().getMinutes()}`
  if (lastRobloxBlockedReason === key) return
  lastRobloxBlockedReason = key
  restoreWindow(mainWindow)
  mainWindow.webContents.send('roblox:blocked', { reason, message })
}

function moveToCenterPopup(win: BrowserWindow): void {
  win.hide()
  const { w, h, x, y } = getCenterInfo()
  win.setSize(w, h, false)
  win.setPosition(x, y)
  timerUiMode = 'center-popup'
  win.webContents.send('timer:mode', { mode: 'center-popup' })
  setTimeout(() => win.show(), 40)
}

function moveToCorner(win: BrowserWindow): void {
  win.hide()
  const { w, h, x, y } = getCornerInfo()
  win.setSize(w, h, false)
  win.setPosition(x, y)
  timerUiMode = 'corner'
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

function completeActiveTimer(win: BrowserWindow): void {
  if (timerLimitMs === null) return
  const today = getLocalDateString()
  const usage = getDailyUsage()
  safeWriteDailyUsage({
    date: today,
    sessionsCompleted: (usage?.date === today ? usage.sessionsCompleted : 0) + 1,
    currentSessionRemainingMs: 0,
  })
  safeAppendSession({
    date: today,
    startTime: timerSessionStartTime || getLocalTimeString(),
    endTime: getLocalTimeString(),
    duration: timerLimitAtSession || Math.round(timerLimitMs / 60000),
    limitAtSession: timerLimitAtSession || Math.round(timerLimitMs / 60000),
    terminated: true,
  })
  stopTimerInternals()
  timerUiMode = 'shutdown'
  win.webContents.send('timer:mode', { mode: 'shutdown' })
  setTimeout(() => {
    killRoblox()
    hideToTray()
    win.webContents.send('timer:expired')
  }, 3000)
}

function adjustActiveTimer(deltaMinutes: number): number {
  if (!mainWindow || timerStart === null || timerLimitMs === null) return 0
  const normalizedDeltaMinutes = normalizeTimerAdjustmentMinutes(deltaMinutes)

  const now = Date.now()
  const elapsed = now - timerStart
  const remainingMs = Math.max(0, timerLimitMs - elapsed)
  const nextRemainingMs = remainingMs + normalizedDeltaMinutes * 60 * 1000

  timerLimitAtSession = Math.max(0, timerLimitAtSession + normalizedDeltaMinutes)

  if (nextRemainingMs <= 0) {
    completeActiveTimer(mainWindow)
    return 0
  }

  timerLimitMs = elapsed + nextRemainingMs
  warnedMinutes.clear()
  const adjustedMinutesLeft = Math.ceil(nextRemainingMs / 60000)
  for (const warnAt of [5, 3, 1]) {
    if (adjustedMinutesLeft <= warnAt) warnedMinutes.add(warnAt)
  }
  if (nextRemainingMs <= 30_000) warnedMinutes.add(0)
  if (nextRemainingMs <= 10_000) warnedMinutes.add(-1)

  inCenterMode = false
  if (timerUiMode !== 'corner' || nextRemainingMs <= 10_000) {
    moveToCorner(mainWindow)
  } else {
    timerUiMode = 'corner'
    mainWindow.webContents.send('timer:mode', { mode: 'corner' })
  }

  const today = getLocalDateString()
  const usage = getDailyUsage()
  safeWriteDailyUsage({
    date: today,
    sessionsCompleted: (usage?.date === today ? usage.sessionsCompleted : 0),
    currentSessionRemainingMs: nextRemainingMs,
  })
  const settings = readSettings()
  if (settings.resumeTimerOnRestart) {
    safeWriteTimerState({
      startTime: timerStart,
      limitMs: timerLimitMs,
      date: today,
      sessionStartTime: timerSessionStartTime,
      limitAtSession: timerLimitAtSession,
    })
  }
  mainWindow.webContents.send('timer:tick', { remainingSeconds: Math.ceil(nextRemainingMs / 1000) })
  return Math.ceil(nextRemainingMs / 1000)
}

function startTimer(win: BrowserWindow, limitMinutes: number, resumeRemainingMs?: number, sessionStartTime?: string, limitAtSession?: number): void {
  stopTimerInternals()

  const cursor = screen.getCursorScreenPoint()
  timerDisplay = screen.getDisplayNearestPoint(cursor)

  const limitMs = Math.round(limitMinutes * 60 * 1000)
  timerLimitMs = limitMs
  timerSessionStartTime = sessionStartTime || getLocalTimeString()
  timerLimitAtSession = limitAtSession || limitMinutes

  if (resumeRemainingMs !== undefined) {
    timerStart = Date.now() - (limitMs - resumeRemainingMs)
  } else {
    timerStart = Date.now()
  }

  warnedMinutes.clear()
  inCenterMode = false

  robloxRunning = process.platform === 'win32' ? isRobloxProcessRunning() : robloxRunning

  const settings = readSettings()
  if (settings.resumeTimerOnRestart) {
    const today = getLocalDateString()
    safeWriteTimerState({
      startTime: timerStart,
      limitMs: timerLimitMs,
      date: today,
      sessionStartTime: timerSessionStartTime,
      limitAtSession: timerLimitAtSession,
    })
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

    const now = Date.now()
    if (process.platform === 'win32' && now - lastRobloxPresenceCheck >= 2000) {
      lastRobloxPresenceCheck = now
      if (!isRobloxProcessRunning()) {
        pauseTimerBecauseRobloxClosed()
        return
      }
      robloxRunning = true
    }

    if (!isAllowedHour()) {
      completeActiveTimer(win)
      showRobloxBlocked('outside-hours')
      return
    }

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
      timerUiMode = 'center-countdown'
      win.webContents.send('timer:mode', { mode: 'center-countdown' })
      setTimeout(() => win.show(), 40)
    }

    if (remaining <= 0) completeActiveTimer(win)
  }, 1000)
}

function tryResumeTimer(): boolean {
  const win = mainWindow
  if (!win) return false

  const settings = readSettings()
  if (!settings.resumeTimerOnRestart) return false

  const state = readTimerState()
  if (!state) return false

  const today = getLocalDateString()
  if (state.date !== today) {
    safeClearTimerState()
    return false
  }

  // 모든 세션이 완료됐으면 복원 불가
  if (isSessionExhausted(today)) {
    safeClearTimerState()
    return false
  }

  // timer-state와 daily-usage 중 더 작은 값 사용 (가장 최신 상태 기준)
  const stateRemaining = state.pausedRemainingMs !== undefined
    ? state.pausedRemainingMs
    : Math.max(0, state.limitMs - (Date.now() - state.startTime))

  const usage = getDailyUsage()
  const dailyRemaining = (usage && usage.date === today && usage.currentSessionRemainingMs > 0)
    ? usage.currentSessionRemainingMs
    : stateRemaining

  const remaining = Math.min(stateRemaining, dailyRemaining)
  if (remaining <= 0) {
    safeClearTimerState()
    return false
  }

  if (shouldBlockTimerStartWithoutRoblox(app.isPackaged, isRobloxProcessRunning())) {
    robloxRunning = false
    safeWriteDailyUsage({
      date: today,
      sessionsCompleted: (usage?.date === today ? usage.sessionsCompleted : 0),
      currentSessionRemainingMs: remaining,
    })
    safeWriteTimerState({
      startTime: Date.now(),
      limitMs: remaining,
      date: today,
      pausedRemainingMs: remaining,
      sessionStartTime: state.sessionStartTime,
      limitAtSession: state.limitAtSession,
    })
    return false
  }

  const limitMinutes = Math.max(1, state.limitMs / 60000)
  startTimer(win, limitMinutes, remaining, state.sessionStartTime, state.limitAtSession)
  win.webContents.send('timer:resumed', { remainingSeconds: Math.ceil(remaining / 1000) })
  return true
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

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    adminWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#admin`)
  } else {
    adminWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'admin' })
  }

  adminWindow.on('closed', () => { adminWindow = null })
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

function loadTrayIcon(): Electron.NativeImage {
  const resourcesDir = getResourcesDir()
  const candidatePaths = process.platform === 'win32'
    ? [
        join(resourcesDir, 'icon.ico'),
        join(resourcesDir, 'tray-icon.png'),
        join(resourcesDir, 'icon-256.png'),
      ]
    : [
        join(resourcesDir, 'tray-icon.png'),
        join(resourcesDir, 'icon-256.png'),
        join(resourcesDir, 'icon.ico'),
      ]

  for (const iconPath of candidatePaths) {
    if (!existsSync(iconPath)) continue
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) {
      return process.platform === 'win32' ? icon : icon.resize({ width: 16, height: 16 })
    }
    console.error('tray icon image was empty', iconPath)
  }

  const fallback = nativeImage.createFromDataURL(FALLBACK_TRAY_ICON_DATA_URL)
  if (!fallback.isEmpty()) return fallback

  throw new Error(`No usable tray icon found in ${resourcesDir}`)
}

function createTray(): void {
  try {
    const icon = loadTrayIcon()
    tray = new Tray(icon)
    tray.setToolTip('My Pact')
    tray.on('click', () => addTrayClick(1))
    tray.on('double-click', () => addTrayClick(2))
  } catch (err) {
    console.error('tray creation failed; continuing without crashing startup', err)
  }
}

function startRobloxDetection(): void {
  if (robloxDetectInterval) return

  robloxDetectInterval = setInterval(() => {
    exec('tasklist /FO CSV /NH', { windowsHide: true }, (err, stdout) => {
      if (err) return
      const isRunning = /RobloxPlayer(Beta)?\.exe/i.test(stdout)

      if (!robloxBaselineCaptured) {
        robloxBaselineCaptured = true
        robloxRunning = false
        if (!isRunning) return
      }

      if (isRunning && !robloxRunning) {
        if (!isAllowedHour()) {
          killRoblox()
          showRobloxBlocked('outside-hours')
          return
        }

        const today = getLocalDateString()
        if (isSessionExhausted(today)) {
          killRoblox()
          showRobloxBlocked('daily-exhausted')
          return
        }

        const started = startTimerForDetectedRoblox()
        robloxRunning = started
        if (started) mainWindow?.webContents.send('roblox:detected')
      } else if (!isRunning && (robloxRunning || timerStart !== null)) {
        pauseTimerBecauseRobloxClosed()
      }
    })
  }, 3000)
}

function createWindow(): void {
  const preloadPath = join(__dirname, '../preload/index.js')

  mainWindow = new BrowserWindow({
    width: 380,
    height: 620,
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
    if (allowQuit) return
    e.preventDefault()
    mainWindow?.hide()
  })

  // ── 타이머 IPC ────────────────────────────────────────────────────────────

  ipcMain.handle('timer:start', async (_e, { limitMinutes }: { limitMinutes: number }) => {
    if (!mainWindow) return { resumed: false, remainingSeconds: 0, exhausted: false }
    if (timerStart !== null && timerLimitMs !== null) {
      const remaining = Math.max(0, timerLimitMs - (Date.now() - timerStart))
      return { resumed: true, remainingSeconds: Math.ceil(remaining / 1000), exhausted: false }
    }

    if (shouldBlockTimerStartWithoutRoblox(app.isPackaged, isRobloxProcessRunning())) {
      return { resumed: false, remainingSeconds: 0, exhausted: false, blocked: 'roblox-not-running' }
    }

    const trustedLimit = getTodaySessionCount().perSessionMinutes
    const requestedLimit = Number(limitMinutes)
    const limitMins = app.isPackaged ? trustedLimit : requestedLimit
    if (!isFinite(limitMins) || limitMins <= 0) {
      return { resumed: false, remainingSeconds: 0, exhausted: false, blocked: 'invalid-limit' }
    }

    if (!isAllowedHour()) {
      killRoblox()
      showRobloxBlocked('outside-hours')
      return { resumed: false, remainingSeconds: 0, exhausted: false, blocked: 'outside-hours' }
    }

    const today = getLocalDateString()
    const { sessionsPerDay } = getTodaySessionCount()
    const usage = getDailyUsage()
    const usageToday = usage && usage.date === today ? usage : null

    // 현재 진행 중인 세션 재개 (같은 날, 잔여 시간 있음)
    if (usageToday && usageToday.currentSessionRemainingMs > 0) {
      const remaining = usageToday.currentSessionRemainingMs
      startTimer(mainWindow, limitMins, remaining)
      return { resumed: true, remainingSeconds: Math.ceil(remaining / 1000), exhausted: false }
    }

    // 모든 세션 완료 — 거부
    const sessionsCompleted = usageToday ? usageToday.sessionsCompleted : 0
    if (sessionsCompleted >= sessionsPerDay) {
      killRoblox()
      showRobloxBlocked('daily-exhausted')
      return { resumed: false, remainingSeconds: 0, exhausted: true }
    }

    const settings = readSettings()
    if (!hasParentApprovalForFreshSession(settings)) {
      rememberPendingApprovalRobloxLaunch()
      killRoblox()
      showRobloxBlocked('approval-required')
      return { resumed: false, remainingSeconds: 0, exhausted: false, blocked: 'approval-required' }
    }

    // 새 세션 시작 (fresh) — daily-usage는 세션 완료 시 업데이트
    consumeParentApprovalForFreshSession()
    startTimer(mainWindow, limitMins)
    return {
      resumed: false,
      remainingSeconds: Math.round(limitMins * 60),
      exhausted: false,
    }
  })

  ipcMain.handle('timer:stop', async (event) => {
    requireAdminSession(event)
    pauseActiveTimer()
    killRoblox()
  })

  ipcMain.handle('timer:get-status', async () => {
    if (timerStart === null || timerLimitMs === null) {
      return { running: false, remainingSeconds: 0, mode: timerUiMode }
    }
    const elapsed = Date.now() - timerStart
    const remaining = Math.max(0, timerLimitMs - elapsed)
    return { running: true, remainingSeconds: Math.ceil(remaining / 1000), mode: timerUiMode }
  })

  ipcMain.handle('timer:adjust-time', async (event, { minutes }: { minutes: number }) => {
    requireAdminSession(event)
    return { remainingSeconds: adjustActiveTimer(Number(minutes)) }
  })

  ipcMain.handle('timer:admin-stop', async (event) => {
    requireAdminSession(event)
    if (timerStart !== null && timerLimitMs !== null) {
      const remainingMs = Math.max(0, timerLimitMs - (Date.now() - timerStart))
      const today = getLocalDateString()
      const usage = getDailyUsage()
      // 관리자 중지: 세션 잔여 시간 보존 (나중에 이어서 가능)
      safeWriteDailyUsage({
        date: today,
        sessionsCompleted: (usage?.date === today ? usage.sessionsCompleted : 0),
        currentSessionRemainingMs: remainingMs,
      })
    }
    stopTimerInternals()
    killRoblox()
    if (mainWindow) {
      restoreWindow(mainWindow)
      mainWindow.webContents.send('timer:admin-stopped')
    }
  })

  ipcMain.handle('admin:close-window', async () => { adminWindow?.close() })
  ipcMain.handle('admin:get-resume-option', async (event) => {
    requireAdminSession(event)
    return readSettings().resumeTimerOnRestart
  })

  ipcMain.handle('window:hide-main', async () => {
    hideToTray()
    return true
  })

  ipcMain.handle('window:minimize-main', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? mainWindow
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(false)
      win.hide()
    }
    return true
  })

  ipcMain.on('window:hide-main-now', () => {
    hideToTray()
  })

  ipcMain.handle('window:show-main', async () => {
    if (mainWindow) {
      if (timerStart !== null && timerLimitMs !== null) {
        moveToCorner(mainWindow)
      } else {
        restoreWindow(mainWindow)
      }
      mainWindow.focus()
    }
  })

  ipcMain.handle('app:shutdown', async (event) => {
    requireAdminSession(event)
    disableWatchdog()
    stopWatchdogProcesses()
    killRoblox()
    allowQuit = true
    app.quit()
    return true
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
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
  registerIpcHandlers({ approveNextSession })
  spawnSessionWatchdog()
  createWindow()
  createTray()
  startRobloxDetection()

  mainWindow?.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      const resumed = tryResumeTimer()
      const action = decideStartupWindowAction({ startHidden, resumedTimer: resumed })
      if (action === 'show-main-window' && mainWindow) {
        restoreWindow(mainWindow)
        mainWindow.focus()
      } else if (action === 'hide-to-tray') {
        mainWindow?.hide()
      }
    }, 500)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 트레이에서 계속 실행
})
