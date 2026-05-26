import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { Settings, Session } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

const MYPACT_DIR = join(homedir(), '.mypact')
const SETTINGS_PATH = join(MYPACT_DIR, 'settings.json')
const SETTINGS_BAK_PATH = join(MYPACT_DIR, 'settings.json.bak')
const SESSIONS_PATH = join(MYPACT_DIR, 'sessions.json')

function ensureDir(): void {
  mkdirSync(MYPACT_DIR, { recursive: true })
}

export function readSettings(): Settings {
  ensureDir()
  try {
    const raw = readFileSync(SETTINGS_PATH, 'utf-8')
    return JSON.parse(raw) as Settings
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function writeSettings(settings: Settings): void {
  ensureDir()
  // 백업 먼저
  if (existsSync(SETTINGS_PATH)) {
    copyFileSync(SETTINGS_PATH, SETTINGS_BAK_PATH)
  }
  try {
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
  } catch (err) {
    // 실패 시 백업 복구
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
