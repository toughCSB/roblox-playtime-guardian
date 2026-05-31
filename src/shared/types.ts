export interface Settings {
  weekdayLimit: number           // 세션당 허용 시간 (분)
  weekendLimit: number
  weekdaySessionCount: number    // 평일 하루 최대 세션 수
  weekendSessionCount: number    // 주말 하루 최대 세션 수
  allowedStartHour: number
  allowedEndHour: number
  adminPasswordHash: string
  resumeTimerOnRestart: boolean
  requireApprovalBeforeStart: boolean // 새 게임 타임 시작 전 부모 PIN 승인 필요
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
  pausedRemainingMs?: number  // 일시정지 시 잔여 ms 스냅샷
  sessionStartTime?: string
  limitAtSession?: number
}

export type PublicSettings = Omit<Settings, 'adminPasswordHash'>

export interface DailyUsage {
  date: string
  sessionsCompleted: number      // 타이머가 만료된 완료 세션 수
  currentSessionRemainingMs: number  // 현재 진행/일시정지 중인 세션의 잔여 ms (0이면 없음)
}

export interface TimerStartResult {
  resumed: boolean
  remainingSeconds: number
  exhausted?: boolean
  blocked?: 'outside-hours' | 'invalid-limit' | 'approval-required' | 'roblox-not-running'
}

export interface TimerStatus {
  running: boolean
  remainingSeconds: number
  mode?: 'corner' | 'center-popup' | 'center-countdown' | 'shutdown'
}

export interface DailyRemaining {
  remainingSeconds: number
  exhausted: boolean
  totalSeconds: number
  sessionsCompleted: number
  sessionsPerDay: number
  currentSessionActive: boolean
}

// SHA-256('0000')
const DEFAULT_PASSWORD_HASH = '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0'

export const DEFAULT_SETTINGS: Settings = {
  weekdayLimit: 60,
  weekendLimit: 60,
  weekdaySessionCount: 1,
  weekendSessionCount: 1,
  allowedStartHour: 16,
  allowedEndHour: 22,
  adminPasswordHash: DEFAULT_PASSWORD_HASH,
  resumeTimerOnRestart: true,
  requireApprovalBeforeStart: true,
  updatedAt: new Date().toISOString(),
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  weekdayLimit: 60,
  weekendLimit: 60,
  weekdaySessionCount: 1,
  weekendSessionCount: 1,
  allowedStartHour: 16,
  allowedEndHour: 22,
  resumeTimerOnRestart: true,
  requireApprovalBeforeStart: true,
  updatedAt: new Date().toISOString(),
}
