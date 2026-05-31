import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync, renameSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { Settings, Session, TimerState, DailyUsage } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

const LEGACY_MYPACT_DIR = join(homedir(), '.mypact')
const COMMON_APP_DATA_DIR = process.platform === 'win32' ? 'C:\\ProgramData' : homedir()
const MYPACT_DIR = join(COMMON_APP_DATA_DIR, 'MyPact')
const ADMIN_DIR = join(MYPACT_DIR, 'Admin')
const DATA_DIR = join(MYPACT_DIR, 'Data')
const SETTINGS_PATH = join(MYPACT_DIR, 'settings.json')
const SETTINGS_BAK_PATH = join(MYPACT_DIR, 'settings.json.bak')
const ADMIN_SECRET_PATH = join(ADMIN_DIR, 'admin-secret.json')
const SESSIONS_PATH = join(DATA_DIR, 'sessions.json')
const TIMER_STATE_PATH = join(DATA_DIR, 'timer-state.json')
const DAILY_USAGE_PATH = join(DATA_DIR, 'daily-usage.json')
const LOCKED_ADMIN_PASSWORD_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

const MAX_DAILY_MS = 24 * 60 * 60 * 1000

function ensureDir(): void {
  tryMkdir(MYPACT_DIR)
  tryMkdir(ADMIN_DIR)
  tryMkdir(DATA_DIR)
  migrateLegacyFile('settings.json')
  migrateLegacyFile('sessions.json', DATA_DIR)
  migrateLegacyFile('timer-state.json', DATA_DIR)
  migrateLegacyFile('daily-usage.json', DATA_DIR)
}

function tryMkdir(path: string): void {
  try {
    mkdirSync(path, { recursive: true })
  } catch {}
}

function migrateLegacyFile(fileName: string, targetDir = MYPACT_DIR): void {
  const target = join(targetDir, fileName)
  const legacy = join(LEGACY_MYPACT_DIR, fileName)
  const previousShared = join(MYPACT_DIR, fileName)
  for (const source of [previousShared, legacy]) {
    if (source !== target && !existsSync(target) && existsSync(source)) {
      try { copyFileSync(source, target) } catch { return }
    }
  }
}

function atomicWrite(path: string, data: string): void {
  const tmpPath = `${path}.${process.pid}.tmp`
  writeFileSync(tmpPath, data, 'utf-8')
  try {
    renameSync(tmpPath, path)
  } catch {
    try {
      if (existsSync(path)) unlinkSync(path)
      renameSync(tmpPath, path)
    } catch {
      try { unlinkSync(tmpPath) } catch {}
      writeFileSync(path, data, 'utf-8')
    }
  }
}

function readJsonFile<T>(path: string): T {
  const raw = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '')
  return JSON.parse(raw) as T
}

function safeInt(val: unknown, fallback: number, min: number, max: number): number {
  const n = Number(val)
  if (!isFinite(n) || n < min || n > max) return fallback
  return Math.round(n)
}

function normalizeSettings(settings: Partial<Settings>): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...settings }
  // 수치 필드 전체 검증 — NaN/Infinity/범위 초과 시 기본값으로 교체
  merged.weekdayLimit        = safeInt(merged.weekdayLimit,        DEFAULT_SETTINGS.weekdayLimit,        1, 480)
  merged.weekendLimit        = safeInt(merged.weekendLimit,        DEFAULT_SETTINGS.weekendLimit,        1, 480)
  merged.weekdaySessionCount = safeInt(merged.weekdaySessionCount, DEFAULT_SETTINGS.weekdaySessionCount, 1,  10)
  merged.weekendSessionCount = safeInt(merged.weekendSessionCount, DEFAULT_SETTINGS.weekendSessionCount, 1,  10)
  merged.allowedStartHour    = safeInt(merged.allowedStartHour,    DEFAULT_SETTINGS.allowedStartHour,    0,  23)
  merged.allowedEndHour      = safeInt(merged.allowedEndHour,      DEFAULT_SETTINGS.allowedEndHour,      0,  24)
  if (merged.allowedStartHour === merged.allowedEndHour) {
    merged.allowedStartHour = DEFAULT_SETTINGS.allowedStartHour
    merged.allowedEndHour = DEFAULT_SETTINGS.allowedEndHour
  }
  merged.adminPasswordHash = normalizeAdminPasswordHash(merged.adminPasswordHash)
  if (typeof merged.resumeTimerOnRestart !== 'boolean') {
    merged.resumeTimerOnRestart = DEFAULT_SETTINGS.resumeTimerOnRestart
  }
  if (typeof merged.updatedAt !== 'string') {
    merged.updatedAt = new Date().toISOString()
  }
  return merged
}

function normalizeAdminPasswordHash(hash: unknown): string {
  return isAdminPasswordHash(hash)
    ? hash
    : DEFAULT_SETTINGS.adminPasswordHash
}

function isAdminPasswordHash(hash: unknown): hash is string {
  return typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash)
}

function readLegacyAdminPasswordHash(): string | null {
  for (const path of [SETTINGS_PATH]) {
    try {
      const parsed = readJsonFile<Partial<Settings>>(path)
      if (isAdminPasswordHash(parsed.adminPasswordHash)) {
        return parsed.adminPasswordHash
      }
    } catch {}
  }
  return null
}

export function readAdminPasswordHash(): string {
  ensureDir()
  try {
    const parsed = readJsonFile<{ adminPasswordHash?: unknown }>(ADMIN_SECRET_PATH)
    return isAdminPasswordHash(parsed.adminPasswordHash) ? parsed.adminPasswordHash : LOCKED_ADMIN_PASSWORD_HASH
  } catch {
    if (existsSync(ADMIN_SECRET_PATH)) return LOCKED_ADMIN_PASSWORD_HASH
    const legacyHash = readLegacyAdminPasswordHash()
    if (legacyHash) {
      try {
        writeAdminPasswordHash(legacyHash)
        return legacyHash
      } catch {}
    }
    try {
      writeAdminPasswordHash(DEFAULT_SETTINGS.adminPasswordHash)
    } catch {}
    return DEFAULT_SETTINGS.adminPasswordHash
  }
}

export function writeAdminPasswordHash(hash: string): void {
  ensureDir()
  atomicWrite(ADMIN_SECRET_PATH, JSON.stringify({ adminPasswordHash: normalizeAdminPasswordHash(hash) }, null, 2))
}

function toPersistedSettings(settings: Settings): Omit<Settings, 'adminPasswordHash'> {
  const { adminPasswordHash: _adminPasswordHash, ...persisted } = normalizeSettings(settings)
  return persisted
}

export function readSettings(): Settings {
  ensureDir()
  try {
    return { ...normalizeSettings(readJsonFile<Partial<Settings>>(SETTINGS_PATH)), adminPasswordHash: readAdminPasswordHash() }
  } catch {
    return { ...DEFAULT_SETTINGS, adminPasswordHash: readAdminPasswordHash() }
  }
}

export function writeSettings(settings: Settings): void {
  ensureDir()
  if (existsSync(SETTINGS_PATH)) {
    copyFileSync(SETTINGS_PATH, SETTINGS_BAK_PATH)
  }
  try {
    atomicWrite(SETTINGS_PATH, JSON.stringify(toPersistedSettings(settings), null, 2))
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
    return readJsonFile<Session[]>(SESSIONS_PATH)
  } catch {
    return []
  }
}

export function appendSession(sessionData: Omit<Session, 'id'>): void {
  ensureDir()
  const sessions = readSessions()
  const newSession: Session = { id: uuidv4(), ...sessionData }
  sessions.push(newSession)
  atomicWrite(SESSIONS_PATH, JSON.stringify(sessions, null, 2))
}

export function readTimerState(): TimerState | null {
  try {
    const parsed = readJsonFile<TimerState>(TIMER_STATE_PATH)
    if (!isFinite(parsed.startTime) || !isFinite(parsed.limitMs) ||
        parsed.limitMs <= 0 || parsed.limitMs > MAX_DAILY_MS) return null
    if (parsed.pausedRemainingMs !== undefined) {
      if (!isFinite(parsed.pausedRemainingMs) ||
          parsed.pausedRemainingMs < 0 || parsed.pausedRemainingMs > MAX_DAILY_MS) {
        delete parsed.pausedRemainingMs
      }
    }
    if (parsed.sessionStartTime !== undefined && typeof parsed.sessionStartTime !== 'string') {
      delete parsed.sessionStartTime
    }
    if (parsed.limitAtSession !== undefined && (!isFinite(parsed.limitAtSession) || parsed.limitAtSession <= 0)) {
      delete parsed.limitAtSession
    }
    return parsed
  } catch {
    return null
  }
}

export function writeTimerState(state: TimerState): void {
  ensureDir()
  atomicWrite(TIMER_STATE_PATH, JSON.stringify(state, null, 2))
}

export function clearTimerState(): void {
  try {
    if (existsSync(TIMER_STATE_PATH)) unlinkSync(TIMER_STATE_PATH)
  } catch { /* ignore */ }
}

export function readDailyUsage(): DailyUsage | null {
  try {
    const parsed = readJsonFile<DailyUsage>(DAILY_USAGE_PATH)
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
  const sessionsCompleted = safeInt(usage.sessionsCompleted, 0, 0, 1000)
  const currentSessionRemainingMs = Math.min(MAX_DAILY_MS, Math.max(0, Number(usage.currentSessionRemainingMs) || 0))
  atomicWrite(DAILY_USAGE_PATH, JSON.stringify({
    date: usage.date,
    sessionsCompleted,
    currentSessionRemainingMs,
  }, null, 2))
}

export function clearDailyUsage(): void {
  try {
    if (existsSync(DAILY_USAGE_PATH)) unlinkSync(DAILY_USAGE_PATH)
  } catch { /* ignore */ }
}
