import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { readSettings, writeSettings, readSessions, appendSession } from './fileStore'
import type { Settings, Session } from '../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('settings:read', async () => {
    return readSettings()
  })

  ipcMain.handle('settings:write', async (_e, settings: Settings) => {
    writeSettings(settings)
  })

  ipcMain.handle('sessions:read', async () => {
    return readSessions()
  })

  ipcMain.handle('sessions:append', async (_e, sessionData: Omit<Session, 'id'>) => {
    appendSession(sessionData)
  })

  ipcMain.handle('roblox:kill', async () => {
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
  })
}
