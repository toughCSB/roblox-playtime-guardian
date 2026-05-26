import { contextBridge, ipcRenderer } from 'electron'
import type { Settings, Session } from '../shared/types'

const api = {
  readSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:read'),
  writeSettings: (s: Settings): Promise<void> => ipcRenderer.invoke('settings:write', s),
  readSessions: (): Promise<Session[]> => ipcRenderer.invoke('sessions:read'),
  appendSession: (s: Omit<Session, 'id'>): Promise<void> => ipcRenderer.invoke('sessions:append', s),
  startTimer: (limitMinutes: number): Promise<void> =>
    ipcRenderer.invoke('timer:start', { limitMinutes }),
  stopTimer: (): Promise<void> => ipcRenderer.invoke('timer:stop'),
  killRoblox: (): Promise<void> => ipcRenderer.invoke('roblox:kill'),
  onTimerTick: (cb: (d: { remainingSeconds: number }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, d: { remainingSeconds: number }) => cb(d)
    ipcRenderer.on('timer:tick', handler)
    return () => ipcRenderer.removeListener('timer:tick', handler)
  },
  onTimerWarning: (cb: (d: { minutesLeft: number }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, d: { minutesLeft: number }) => cb(d)
    ipcRenderer.on('timer:warning', handler)
    return () => ipcRenderer.removeListener('timer:warning', handler)
  },
  onTimerExpired: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('timer:expired', handler)
    return () => ipcRenderer.removeListener('timer:expired', handler)
  },
  onTimerMode: (cb: (d: { mode: string }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, d: { mode: string }) => cb(d)
    ipcRenderer.on('timer:mode', handler)
    return () => ipcRenderer.removeListener('timer:mode', handler)
  },
}

contextBridge.exposeInMainWorld('api', api)
