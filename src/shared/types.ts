export interface Settings {
  weekdayLimit: number
  weekendLimit: number
  customDays?: Record<string, number>
  allowedStartHour: number
  allowedEndHour: number
  adminPasswordHash: string
  resumeTimerOnRestart: boolean
  updatedAt: string
}

export interface Session {
  id: string
  date: string
  startTime: string
  endTime: string
  duration: number
  limitAtSession: number
  terminated: boolean
}

export interface TimerState {
  startTime: number        // Date.now() at timer start
  limitMs: number          // total limit in ms
  date: string             // YYYY-MM-DD — 날짜 다르면 무효
  pausedRemainingMs?: number  // 로블록스 종료로 일시정지 시 잔여 ms 스냅샷
}

// SHA-256('0000')
const DEFAULT_PASSWORD_HASH = '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0'

export const DEFAULT_SETTINGS: Settings = {
  weekdayLimit: 60,
  weekendLimit: 60,
  allowedStartHour: 16,
  allowedEndHour: 22,
  adminPasswordHash: DEFAULT_PASSWORD_HASH,
  resumeTimerOnRestart: true,
  updatedAt: new Date().toISOString(),
}
