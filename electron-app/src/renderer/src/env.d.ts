/// <reference types="vite/client" />

import type { Settings, Session } from '../../shared/types'

declare global {
  interface Window {
    api?: {
      readSettings(): Promise<Settings>
      writeSettings(s: Settings): Promise<void>
      readSessions(): Promise<Session[]>
      appendSession(s: Omit<Session, 'id'>): Promise<void>
      startTimer(limitMinutes: number): Promise<void>
      stopTimer(): Promise<void>
      killRoblox(): Promise<void>
      onTimerTick(cb: (d: { remainingSeconds: number }) => void): () => void
      onTimerWarning(cb: (d: { minutesLeft: number }) => void): () => void
      onTimerExpired(cb: () => void): () => void
      onTimerMode(cb: (d: { mode: string }) => void): () => void
    }
  }
}
