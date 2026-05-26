import { ipcMain } from 'electron'
import { createHash } from 'crypto'
import { exec } from 'child_process'
import { readSettings, writeSettings, readSessions, appendSession } from './fileStore'
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

  // 비밀번호 검증
  ipcMain.handle('admin:verify-password', async (_e, { hash }: { hash: string }) => {
    const settings = readSettings()
    return hash === settings.adminPasswordHash
  })

  // 비밀번호 변경
  ipcMain.handle('admin:change-password', async (_e, { hash }: { hash: string }) => {
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('invalid hash')
    const settings = readSettings()
    settings.adminPasswordHash = hash
    settings.updatedAt = new Date().toISOString()
    writeSettings(settings)
  })

  // 재부팅 후 타이머 유지 설정
  ipcMain.handle('admin:set-resume-option', async (_e, { enabled }: { enabled: boolean }) => {
    const settings = readSettings()
    settings.resumeTimerOnRestart = enabled
    settings.updatedAt = new Date().toISOString()
    writeSettings(settings)
  })
}

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}
