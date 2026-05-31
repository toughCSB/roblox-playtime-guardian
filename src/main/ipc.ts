import { ipcMain } from 'electron'
import { createHash } from 'crypto'
import { exec } from 'child_process'
import { readAdminPasswordHash, readSettings, writeAdminPasswordHash, writeSettings, readSessions, readDailyUsage } from './fileStore'
import { grantAdminSession, requireAdminSession } from './adminAuth'
import { redactSettings } from '../shared/policy'
import type { DailyRemaining, PublicSettings } from '../shared/types'

const MAX_PIN_ATTEMPTS = 5
const PIN_LOCK_MS = 30_000

type PinThrottle = { attempts: number; lockedUntil: number }
let pinThrottle: PinThrottle = { attempts: 0, lockedUntil: 0 }

function assertPinAllowed(): void {
  if (pinThrottle.lockedUntil > Date.now()) throw new Error('too many attempts')
}

function recordPinAttempt(ok: boolean): void {
  if (ok) {
    pinThrottle = { attempts: 0, lockedUntil: 0 }
    return
  }
  const now = Date.now()
  const attempts = pinThrottle.lockedUntil <= now ? pinThrottle.attempts + 1 : pinThrottle.attempts
  pinThrottle = {
    attempts,
    lockedUntil: attempts >= MAX_PIN_ATTEMPTS ? now + PIN_LOCK_MS : 0,
  }
}

function verifyAdminPin(pin: string): boolean {
  assertPinAllowed()
  if (!/^\d{4}$/.test(pin)) {
    recordPinAttempt(false)
    return false
  }
  const ok = hashPassword(pin) === readAdminPasswordHash()
  recordPinAttempt(ok)
  return ok
}

function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function killRoblox(): void {
  if (process.platform === 'darwin') {
    exec('pkill -x "Roblox"')
  } else if (process.platform === 'win32') {
    for (const imageName of ['RobloxPlayer.exe', 'RobloxPlayerBeta.exe']) {
      exec(`taskkill /F /IM ${imageName}`, { windowsHide: true })
    }
  }
}

export function registerIpcHandlers(callbacks: { approveNextSession?: () => boolean | void } = {}): void {
  ipcMain.handle('settings:read', async () => redactSettings(readSettings()))

  ipcMain.handle('settings:write', async (event, settings: PublicSettings) => {
    requireAdminSession(event)
    const current = readSettings()
    writeSettings({ ...current, ...settings, adminPasswordHash: current.adminPasswordHash })
  })

  ipcMain.handle('sessions:read', async () => readSessions())

  ipcMain.handle('roblox:kill', async () => {
    killRoblox()
  })

  ipcMain.handle('admin:verify-password', async (event, { pin }: { pin: string }) => {
    const ok = verifyAdminPin(pin)
    if (ok) grantAdminSession(event)
    return ok
  })

  ipcMain.handle('admin:unlock-settings', async (event, { pin }: { pin: string }) => {
    const ok = verifyAdminPin(pin)
    if (ok) grantAdminSession(event)
    return ok
  })

  ipcMain.handle('admin:approve-next-session', async (_event, { pin }: { pin: string }) => {
    const ok = verifyAdminPin(pin)
    const launchedPendingRoblox = ok ? callbacks.approveNextSession?.() === true : false
    return { ok, launchedPendingRoblox }
  })

  ipcMain.handle('admin:change-password', async (event, { currentPin, newPin }: { currentPin: string; newPin: string }) => {
    requireAdminSession(event)
    if (!/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) throw new Error('invalid pin')
    if (hashPassword(currentPin) !== readAdminPasswordHash()) throw new Error('invalid current password')
    writeAdminPasswordHash(hashPassword(newPin))
  })

  ipcMain.handle('admin:set-resume-option', async (event, { enabled }: { enabled: boolean }) => {
    requireAdminSession(event)
    const settings = readSettings()
    settings.resumeTimerOnRestart = enabled
    settings.updatedAt = new Date().toISOString()
    writeSettings(settings)
  })

  // 오늘 남은 세션 정보 조회
  ipcMain.handle('daily:get-remaining', async (): Promise<DailyRemaining> => {
    const today = getLocalDateString()
    const usage = readDailyUsage()
    const settings = readSettings()
    const dow = new Date().getDay()
    const isWeekend = dow === 0 || dow === 6
    const perSessionMinutes = isWeekend ? settings.weekendLimit : settings.weekdayLimit
    const sessionsPerDay = isWeekend ? settings.weekendSessionCount : settings.weekdaySessionCount

    if (!usage || usage.date !== today) {
      // 새 날 또는 첫 실행
      return {
        remainingSeconds: perSessionMinutes * 60,
        exhausted: false,
        totalSeconds: perSessionMinutes * 60,
        sessionsCompleted: 0,
        sessionsPerDay,
        currentSessionActive: false,
      }
    }

    const exhausted = usage.sessionsCompleted >= sessionsPerDay && usage.currentSessionRemainingMs <= 0

    // 표시할 남은 시간: 진행 중인 세션이 있으면 그 잔여 시간, 없으면 세션 한 번의 전체 시간
    const remainingSeconds = usage.currentSessionRemainingMs > 0
      ? Math.ceil(usage.currentSessionRemainingMs / 1000)
      : perSessionMinutes * 60

    return {
      remainingSeconds: exhausted ? 0 : remainingSeconds,
      exhausted,
      totalSeconds: perSessionMinutes * 60,
      sessionsCompleted: usage.sessionsCompleted,
      sessionsPerDay,
      currentSessionActive: usage.currentSessionRemainingMs > 0,
    }
  })
}

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}
