import { ipcMain } from 'electron'
import { createHash } from 'crypto'
import { exec } from 'child_process'
import { readSettings, writeSettings, readSessions, appendSession, readDailyUsage } from './fileStore'
import type { Settings, Session } from '../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('settings:read', async () => readSettings())

  ipcMain.handle('settings:write', async (_e, settings: Settings) => {
    writeSettings(settings)
  })

  ipcMain.handle('sessions:read', async () => readSessions())

  ipcMain.handle('sessions:append', async (_e, sessionData: Omit<Session, 'id'>) => {
    appendSession(sessionData)
  })

  ipcMain.handle('roblox:kill', async () => {
    if (process.platform === 'darwin') {
      exec('pkill -x "Roblox"')
    } else if (process.platform === 'win32') {
      exec('taskkill /F /IM RobloxPlayer.exe', (err) => {
        if (err) exec('taskkill /F /IM RobloxPlayerBeta.exe')
      })
    }
  })

  ipcMain.handle('admin:verify-password', async (_e, { hash }: { hash: string }) => {
    const settings = readSettings()
    return hash === settings.adminPasswordHash
  })

  ipcMain.handle('admin:change-password', async (_e, { hash, plain }: { hash: string; plain?: string }) => {
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('invalid hash')
    const settings = readSettings()
    settings.adminPasswordHash = hash
    settings.updatedAt = new Date().toISOString()
    writeSettings(settings)
    if (plain && process.platform === 'win32') {
      const safe = plain.replace(/['"\\&|;`<>]/g, '')
      exec(`reg add "HKLM\\Software\\MyPact" /v UninstallPin /t REG_SZ /d "${safe}" /f`,
        { windowsHide: true })
    }
  })

  ipcMain.handle('admin:set-resume-option', async (_e, { enabled }: { enabled: boolean }) => {
    const settings = readSettings()
    settings.resumeTimerOnRestart = enabled
    settings.updatedAt = new Date().toISOString()
    writeSettings(settings)
  })

  // 오늘 남은 세션 정보 조회
  ipcMain.handle('daily:get-remaining', async () => {
    const today = new Date().toISOString().slice(0, 10)
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
