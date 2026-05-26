import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { Settings, Session, TimerState } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

const MYPACT_DIR = join(homedir(), '.mypact')
const SETTINGS_PATH = join(MYPACT_DIR, 'settings.json')
const SETTINGS_BAK_PATH = join(MYPACT_DIR, 'settings.json.bak')
const SESSIONS_PATH = join(MYPACT_DIR, 'sessions.json')
const TIMER_STATE_PATH = join(MYPACT_DIR, 'timer-state.json')

function ensureDir(): void {
  mkdirSync(MYPACT_DIR, { recursive: true })
}

export function readSettings(): Settings {
  ensureDir()
  try {
    const raw = readFileSync(SETTINGS_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
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
    return JSON.parse(raw) as TimerState
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
  } catch {
    // 무시
  }
}
