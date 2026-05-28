import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { Settings, Session, TimerState, DailyUsage } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

const MYPACT_DIR = join(homedir(), '.mypact')
const SETTINGS_PATH = join(MYPACT_DIR, 'settings.json')
const SETTINGS_BAK_PATH = join(MYPACT_DIR, 'settings.json.bak')
const SESSIONS_PATH = join(MYPACT_DIR, 'sessions.json')
const TIMER_STATE_PATH = join(MYPACT_DIR, 'timer-state.json')
const DAILY_USAGE_PATH = join(MYPACT_DIR, 'daily-usage.json')

const MAX_DAILY_MS = 24 * 60 * 60 * 1000

function ensureDir(): void {
  mkdirSync(MYPACT_DIR, { recursive: true })
}

function safeInt(val: unknown, fallback: number, min: number, max: number): number {
  const n = Number(val)
  if (!isFinite(n) || n < min || n > max) return fallback
  return Math.round(n)
}

export function readSettings(): Settings {
  ensureDir()
  try {
    const raw = readFileSync(SETTINGS_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    const merged = { ...DEFAULT_SETTINGS, ...parsed }
    // 수치 필드 전체 검증 — NaN/Infinity/범위 초과 시 기본값으로 교체
    merged.weekdayLimit        = safeInt(merged.weekdayLimit,        DEFAULT_SETTINGS.weekdayLimit,        1, 480)
    merged.weekendLimit        = safeInt(merged.weekendLimit,        DEFAULT_SETTINGS.weekendLimit,        1, 480)
    merged.weekdaySessionCount = safeInt(merged.weekdaySessionCount, DEFAULT_SETTINGS.weekdaySessionCount, 1,  10)
    merged.weekendSessionCount = safeInt(merged.weekendSessionCount, DEFAULT_SETTINGS.weekendSessionCount, 1,  10)
    merged.allowedStartHour    = safeInt(merged.allowedStartHour,    DEFAULT_SETTINGS.allowedStartHour,    0,  23)
    merged.allowedEndHour      = safeInt(merged.allowedEndHour,      DEFAULT_SETTINGS.allowedEndHour,      0,  23)
    if (typeof merged.adminPasswordHash !== 'string' || merged.adminPasswordHash.length !== 64) {
      merged.adminPasswordHash = DEFAULT_SETTINGS.adminPasswordHash
    }
    if (typeof merged.resumeTimerOnRestart !== 'boolean') {
      merged.resumeTimerOnRestart = DEFAULT_SETTINGS.resumeTimerOnRestart
    }
    return merged
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function writeSettings(settings: Settings): void {
  ensureDir()
  if (existsSync(SETTINGS_PATH)) {
    copyFileSync(SETTINGS_PATH, SETTINGS_BAK_PATH)
  }
  try {
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
  } catch (err) {
    if (existsSync(SETTINGS_BAK_PATH)) {
      copyFileSync(SETTINGS_BAK_PATH, SETTINGS_PATH)
    }
    throw err
  }
}

export function readSessions(): Session[] {
  ensureDir()
  try {
    const raw = readFileSync(SESSIONS_PATH, 'utf-8')
    return JSON.parse(raw) as Session[]
  } catch {
    return []
  }
}

export function appendSession(sessionData: Omit<Session, 'id'>): void {
  ensureDir()
  const sessions = readSessions()
  const newSession: Session = { id: uuidv4(), ...sessionData }
  sessions.push(newSession)
  writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2), 'utf-8')
}

export function readTimerState(): TimerState | null {
  try {
    const raw = readFileSync(TIMER_STATE_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as TimerState
    if (!isFinite(parsed.startTime) || !isFinite(parsed.limitMs) ||
        parsed.limitMs <= 0 || parsed.limitMs > MAX_DAILY_MS) return null
    if (parsed.pausedRemainingMs !== undefined) {
      if (!isFinite(parsed.pausedRemainingMs) ||
          parsed.pausedRemainingMs < 0 || parsed.pausedRemainingMs > MAX_DAILY_MS) {
        delete parsed.pausedRemainingMs
      }
    }
    return parsed
  } catch {
    return null
  }
}

export function writeTimerState(state: TimerState): void {
  ensureDir()
  writeFileSync(TIMER_STATE_PATH, JSON.stringify(state), 'utf-8')
}

export function clearTimerState(): void {
  try {
    if (existsSync(TIMER_STATE_PATH)) unlinkSync(TIMER_STATE_PATH)
  } catch { /* ignore */ }
}

export function readDailyUsage(): DailyUsage | null {
  try {
    const raw = readFileSync(DAILY_USAGE_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as DailyUsage
    if (typeof parsed.date !== 'string' || parsed.date.length !== 10) return null
    const sessionsCompleted = isFinite(parsed.sessionsCompleted) && parsed.sessionsCompleted >= 0
      ? Math.floor(parsed.sessionsCompleted) : 0
    const currentSessionRemainingMs = isFinite(parsed.currentSessionRemainingMs) && parsed.currentSessionRemainingMs >= 0
      ? Math.min(parsed.currentSessionRemainingMs, MAX_DAILY_MS) : 0
    return { date: parsed.date, sessionsCompleted, currentSessionRemainingMs }
  } catch {
    return null
  }
}

export function writeDailyUsage(usage: DailyUsage): void {
  ensureDir()
  writeFileSync(DAILY_USAGE_PATH, JSON.stringify(usage), 'utf-8')
}

export function clearDailyUsage(): void {
  try {
    if (existsSync(DAILY_USAGE_PATH)) unlinkSync(DAILY_USAGE_PATH)
  } catch { /* ignore */ }
}
