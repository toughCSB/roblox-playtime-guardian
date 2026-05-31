/// <reference types="vite/client" />

import type { DailyRemaining, PublicSettings, Session, TimerStartResult, TimerStatus } from '../../shared/types'

declare global {
  interface Window {
    api?: {
      readSettings(): Promise<PublicSettings>
      writeSettings(s: PublicSettings): Promise<void>
      readSessions(): Promise<Session[]>

      startTimer(limitMinutes: number): Promise<TimerStartResult>
      killRoblox(): Promise<void>
      minimizeMainWindow(): Promise<void>
      hideMainWindow(): Promise<void>
      hideMainWindowNow(): void
      showMainWindow(): Promise<void>

      timerGetStatus(): Promise<TimerStatus>
      timerAdjustTime(minutes: number): Promise<{ remainingSeconds: number }>
      timerAdminStop(): Promise<void>

      adminVerifyPassword(pin: string): Promise<boolean>
      adminUnlockSettings(pin: string): Promise<boolean>
      adminChangePassword(currentPin: string, newPin: string): Promise<void>
      adminCloseWindow(): Promise<void>
      adminGetResumeOption(): Promise<boolean>
      adminSetResumeOption(enabled: boolean): Promise<void>
      shutdownApp(): Promise<void>

      dailyGetRemaining(): Promise<DailyRemaining>

      onTimerTick(cb: (d: { remainingSeconds: number }) => void): () => void
      onTimerWarning(cb: (d: { minutesLeft: number }) => void): () => void
      onTimerExpired(cb: () => void): () => void
      onTimerMode(cb: (d: { mode: string }) => void): () => void
      onTimerResumed(cb: (d: { remainingSeconds: number }) => void): () => void
      onTimerAdminStopped(cb: () => void): () => void
      onRobloxDetected(cb: () => void): () => void
      onRobloxClosed(cb: () => void): () => void
      onRobloxBlocked(cb: (d: { reason: 'outside-hours' | 'daily-exhausted'; message: string }) => void): () => void
    }
  }
}
