import { contextBridge, ipcRenderer } from 'electron'
import type { Settings, Session } from '../shared/types'

const api = {
  readSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:read'),
  writeSettings: (s: Settings): Promise<void> => ipcRenderer.invoke('settings:write', s),
  readSessions: (): Promise<Session[]> => ipcRenderer.invoke('sessions:read'),
  appendSession: (s: Omit<Session, 'id'>): Promise<void> => ipcRenderer.invoke('sessions:append', s),

  startTimer: (limitMinutes: number): Promise<{ resumed: boolean; remainingSeconds: number; exhausted?: boolean }> =>
    ipcRenderer.invoke('timer:start', { limitMinutes }),
  stopTimer: (): Promise<void> => ipcRenderer.invoke('timer:stop'),
  pauseTimer: (): Promise<void> => ipcRenderer.invoke('timer:pause'),
  killRoblox: (): Promise<void> => ipcRenderer.invoke('roblox:kill'),

  timerGetStatus: (): Promise<{ running: boolean; remainingSeconds: number }> =>
    ipcRenderer.invoke('timer:get-status'),
  timerAddTime: (minutes: number): Promise<void> =>
    ipcRenderer.invoke('timer:add-time', { minutes }),
  timerAdminStop: (): Promise<void> => ipcRenderer.invoke('timer:admin-stop'),

  adminVerifyPassword: (hash: string): Promise<boolean> =>
    ipcRenderer.invoke('admin:verify-password', { hash }),
  adminChangePassword: (hash: string, plain?: string): Promise<void> =>
    ipcRenderer.invoke('admin:change-password', { hash, plain }),
  adminCloseWindow: (): Promise<void> => ipcRenderer.invoke('admin:close-window'),
  adminGetResumeOption: (): Promise<boolean> => ipcRenderer.invoke('admin:get-resume-option'),
  adminSetResumeOption: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('admin:set-resume-option', { enabled }),

  dailyGetRemaining: (): Promise<{ remainingSeconds: number; exhausted: boolean; totalSeconds: number }> =>
    ipcRenderer.invoke('daily:get-remaining'),

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
  onTimerResumed: (cb: (d: { remainingSeconds: number }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, d: { remainingSeconds: number }) => cb(d)
    ipcRenderer.on('timer:resumed', handler)
    return () => ipcRenderer.removeListener('timer:resumed', handler)
  },
  onTimerAdminStopped: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('timer:admin-stopped', handler)
    return () => ipcRenderer.removeListener('timer:admin-stopped', handler)
  },
  onRobloxDetected: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('roblox:detected', handler)
    return () => ipcRenderer.removeListener('roblox:detected', handler)
  },
  onRobloxClosed: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('roblox:closed', handler)
    return () => ipcRenderer.removeListener('roblox:closed', handler)
  },
}

contextBridge.exposeInMainWorld('api', api)
