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

  // 오늘 남은 플레이 시간 조회 — 렌더러 대기 화면 표시용
  ipcMain.handle('daily:get-remaining', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const usage = readDailyUsage()
    const settings = readSettings()
    const dow = new Date().getDay()
    const isWeekend = dow === 0 || dow === 6
    const totalMinutes = isWeekend ? settings.weekendLimit : settings.weekdayLimit

    if (!usage || usage.date !== today) {
      return { remainingSeconds: totalMinutes * 60, exhausted: false, totalSeconds: totalMinutes * 60 }
    }

    const remainingMs = Math.max(0, usage.remainingMs)
    return {
      remainingSeconds: Math.ceil(remainingMs / 1000),
      exhausted: usage.remainingMs <= 0,
      totalSeconds: totalMinutes * 60,
    }
  })
}

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}
