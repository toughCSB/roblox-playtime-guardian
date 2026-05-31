import { contextBridge, ipcRenderer } from 'electron'
import type { AdminApprovalResult, DailyRemaining, PublicSettings, Session, TimerStartResult, TimerStatus } from '../shared/types'

const api = {
  readSettings: (): Promise<PublicSettings> => ipcRenderer.invoke('settings:read'),
  writeSettings: (s: PublicSettings): Promise<void> => ipcRenderer.invoke('settings:write', s),
  readSessions: (): Promise<Session[]> => ipcRenderer.invoke('sessions:read'),

  startTimer: (limitMinutes: number): Promise<TimerStartResult> =>
    ipcRenderer.invoke('timer:start', { limitMinutes }),
  killRoblox: (): Promise<void> => ipcRenderer.invoke('roblox:kill'),
  minimizeMainWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize-main'),
  hideMainWindow: (): Promise<void> => ipcRenderer.invoke('window:hide-main'),
  hideMainWindowNow: (): void => ipcRenderer.send('window:hide-main-now'),
  showMainWindow: (): Promise<void> => ipcRenderer.invoke('window:show-main'),

  timerGetStatus: (): Promise<TimerStatus> =>
    ipcRenderer.invoke('timer:get-status'),
  timerAdjustTime: (minutes: number): Promise<{ remainingSeconds: number }> =>
    ipcRenderer.invoke('timer:adjust-time', { minutes }),
  timerAdminStop: (): Promise<void> => ipcRenderer.invoke('timer:admin-stop'),

  adminVerifyPassword: (pin: string): Promise<boolean> =>
    ipcRenderer.invoke('admin:verify-password', { pin }),
  adminUnlockSettings: (pin: string): Promise<boolean> =>
    ipcRenderer.invoke('admin:unlock-settings', { pin }),
  adminApproveNextSession: (pin: string): Promise<AdminApprovalResult> =>
    ipcRenderer.invoke('admin:approve-next-session', { pin }),
  adminChangePassword: (currentPin: string, newPin: string): Promise<void> =>
    ipcRenderer.invoke('admin:change-password', { currentPin, newPin }),
  adminCloseWindow: (): Promise<void> => ipcRenderer.invoke('admin:close-window'),
  adminGetResumeOption: (): Promise<boolean> => ipcRenderer.invoke('admin:get-resume-option'),
  adminSetResumeOption: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('admin:set-resume-option', { enabled }),
  shutdownApp: (): Promise<void> => ipcRenderer.invoke('app:shutdown'),

  dailyGetRemaining: (): Promise<DailyRemaining> =>
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
  onRobloxBlocked: (cb: (d: { reason: 'outside-hours' | 'daily-exhausted' | 'approval-required'; message: string }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, d: { reason: 'outside-hours' | 'daily-exhausted' | 'approval-required'; message: string }) => cb(d)
    ipcRenderer.on('roblox:blocked', handler)
    return () => ipcRenderer.removeListener('roblox:blocked', handler)
  },
}

contextBridge.exposeInMainWorld('api', api)
