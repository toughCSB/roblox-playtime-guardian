import { useState, useEffect } from 'react'
import type { Settings } from '../../../shared/types'
import { DEFAULT_SETTINGS } from '../../../shared/types'

interface Props {
  onOpenSettings: () => void
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function getTodayAllowedMinutes(settings: Settings): number {
  return isWeekend(new Date()) ? settings.weekendLimit : settings.weekdayLimit
}

function getIsStartableNow(settings: Settings): boolean {
  const currentHour = new Date().getHours()
  return currentHour >= settings.allowedStartHour && currentHour < settings.allowedEndHour
}

// 남은 초 기반으로 LED 색상 결정 (경고 이벤트와 무관하게 항상 정확)
function ledColors(remainingSeconds: number): { color: string; glow: string } {
  if (remainingSeconds <= 60)  return { color: '#ff1744', glow: 'rgba(255,23,68,0.80)'   }
  if (remainingSeconds <= 180) return { color: '#ff6600', glow: 'rgba(255,102,0,0.95)'   }
  if (remainingSeconds <= 300) return { color: '#ffea00', glow: 'rgba(255,234,0,0.70)'   }
  return                              { color: '#00e676', glow: 'rgba(0,230,118,0.65)'   }
}

export default function Timer({ onOpenSettings }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState('')
  const [warningMinutesLeft, setWarningMinutesLeft] = useState<number | null>(null)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [overlayMode, setOverlayMode] = useState<'corner' | 'center-popup' | 'center-countdown' | 'shutdown'>('corner')

  useEffect(() => {
    const api = window.api
    if (!api) return
    api.readSettings().then(setSettings)
  }, [])

  const handleStartTimer = async () => {
    const api = window.api
    if (!settings || !api) return
    const limitMinutes = getTodayAllowedMinutes(settings)
    const now = new Date()
    setSessionStartTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    setOverlayMode('corner')
    await api.startTimer(limitMinutes)
    setIsRunning(true)
    setRemainingSeconds(limitMinutes * 60)
  }

  // 빠른 테스트: 2분 타이머 (30초 경고 → 10초 카운트다운 → 셧다운 확인용)
  const handleTestMode = async () => {
    const api = window.api
    if (!api) return
    const now = new Date()
    setSessionStartTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    setOverlayMode('corner')
    await api.startTimer(2)
    setIsRunning(true)
    setRemainingSeconds(2 * 60)
  }

  useEffect(() => {
    const api = window.api
    if (!isRunning || !api) return
    return api.onTimerTick(({ remainingSeconds }) => setRemainingSeconds(remainingSeconds))
  }, [isRunning])

  useEffect(() => {
    const api = window.api
    if (!isRunning || !api) return
    return api.onTimerWarning(({ minutesLeft }) => {
      setWarningMinutesLeft(minutesLeft)
      const msg = minutesLeft === 0 ? '⏰ 30초 남았어!' : `⚠️ ${minutesLeft}분 남았어!`
      setWarningMessage(msg)
    })
  }, [isRunning])

  useEffect(() => {
    const api = window.api
    if (!isRunning || !api) return
    return api.onTimerExpired(async () => {
      setIsRunning(false)
      setOverlayMode('corner')
      setWarningMinutesLeft(null)
      if (settings && sessionStartTime) {
        const now = new Date()
        const endTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        const dateStr = now.toISOString().slice(0, 10)
        const limitMinutes = getTodayAllowedMinutes(settings)
        await api.appendSession({
          date: dateStr,
          startTime: sessionStartTime,
          endTime,
          duration: limitMinutes,
          limitAtSession: limitMinutes,
          terminated: true,
        })
      }
      setRemainingSeconds(0)
      setSessionStartTime('')
    })
  }, [isRunning, settings, sessionStartTime])

  // timer:mode 이벤트 수신
  useEffect(() => {
    const api = window.api
    if (!isRunning || !api) return
    return api.onTimerMode(({ mode }) => {
      setOverlayMode(mode as 'corner' | 'center-popup' | 'center-countdown' | 'shutdown')
    })
  }, [isRunning])

  // 경고 메시지 4초 후 자동 소멸
  useEffect(() => {
    if (!warningMessage) return
    const t = setTimeout(() => setWarningMessage(null), 4000)
    return () => clearTimeout(t)
  }, [warningMessage])

  const displaySettings = settings ?? DEFAULT_SETTINGS
  const todayLimitMinutes = getTodayAllowedMinutes(displaySettings)
  const dayType = isWeekend(new Date()) ? '주말' : '평일'

  // ── 오버레이 모드 ────────────────────────────────────────────────────
  if (isRunning) {
    const { color, glow } = ledColors(remainingSeconds)

    // 셧다운 화면
    if (overlayMode === 'shutdown') {
      return (
        <div
          className="h-screen w-screen flex items-center justify-center select-none"
          style={{ background: 'rgba(0,0,0,0.88)' }}
        >
          <span
            style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: '20px',
              fontWeight: 700,
              color: '#ff1744',
              textShadow: '0 0 16px rgba(255,23,68,0.9)',
              letterSpacing: '1px',
            }}
          >
            🚫 게임 셧다운...
          </span>
        </div>
      )
    }

    // 10초 이하 중앙 카운트다운
    if (overlayMode === 'center-countdown') {
      return (
        <div
          className="h-screen w-screen flex items-center justify-center select-none"
          style={{ background: 'rgba(0,0,0,0.80)' }}
        >
          <span
            style={{
              fontFamily: "'DSEG7', 'Courier New', monospace",
              fontSize: '64px',
              fontWeight: 'bold',
              letterSpacing: '4px',
              color: '#ff1744',
              textShadow: '0 0 24px rgba(255,23,68,0.9), 0 0 10px rgba(255,23,68,0.9)',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            {formatTime(remainingSeconds)}
          </span>
        </div>
      )
    }

    // 중앙 경고 팝업 (4초간)
    if (overlayMode === 'center-popup') {
      return (
        <div
          className="h-screen w-screen flex flex-col items-center justify-center gap-3 select-none"
          style={{ background: 'rgba(0,0,0,0.80)' }}
        >
          {warningMessage && (
            <span
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: '17px',
                fontWeight: 700,
                color: '#ff1744',
                textShadow: '0 0 10px rgba(255,23,68,0.8)',
                letterSpacing: '0.5px',
              }}
            >
              {warningMessage}
            </span>
          )}
          <span
            style={{
              fontFamily: "'DSEG7', 'Courier New', monospace",
              fontSize: '48px',
              fontWeight: 'bold',
              letterSpacing: '4px',
              color,
              textShadow: `0 0 20px ${glow}, 0 0 8px ${glow}`,
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            {formatTime(remainingSeconds)}
          </span>
        </div>
      )
    }

    // 기본: 코너 타이머
    return (
      <div
        className="app-drag h-screen w-screen flex flex-col items-end justify-end select-none"
        style={{ cursor: 'move' }}
      >
        {warningMessage && (
          <div
            style={{
              background: 'rgba(0,0,0,0.55)',
              padding: '3px 8px',
              marginBottom: '3px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: '12px',
                fontWeight: 700,
                color: '#ff1744',
                textShadow: '0 0 8px rgba(255,23,68,0.7)',
                letterSpacing: '0.5px',
                userSelect: 'none',
              }}
            >
              {warningMessage}
            </span>
          </div>
        )}
        <div
          style={{
            background: 'rgba(0,0,0,0.18)',
            padding: '0 8px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: "'DSEG7', 'Courier New', monospace",
              fontSize: '22px',
              fontWeight: 'bold',
              letterSpacing: '2px',
              color,
              textShadow: `0 0 12px ${glow}, 0 0 5px ${glow}`,
              userSelect: 'none',
              lineHeight: 1,
            }}
          >
            {formatTime(remainingSeconds)}
          </span>
        </div>
      </div>
    )
  }

  // ── 대기 모드: 설정/시작 화면 ────────────────────────────────────────
  const isStartable = getIsStartableNow(displaySettings)

  return (
    <div className="flex flex-col items-center justify-between h-screen px-6 py-8 bg-gradient-to-b from-blue-50 to-indigo-100 rounded-2xl shadow-2xl">
      {/* 타이틀 — 드래그 핸들 역할 */}
      <div className="app-drag text-center pt-4 w-full">
        <h1 className="text-2xl font-bold text-indigo-900 leading-tight">🎮 나의 약속</h1>
        <p className="text-sm text-indigo-400 mt-1">My Pact for My Future</p>
      </div>

      {/* 타이머 + 버튼 */}
      <div className="flex flex-col items-center gap-6 flex-1 justify-center">
        <div className="flex gap-2">
          <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full">{dayType}</span>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full">하루 {todayLimitMinutes}분</span>
        </div>

        <div className="bg-white rounded-3xl px-10 py-7 shadow-xl border-2 border-indigo-100">
          <p className="text-xs text-center text-gray-400 mb-2 font-medium tracking-widest uppercase">오늘 허용 시간</p>
          <div className="text-6xl font-mono font-black text-indigo-700 tracking-tight text-center">
            {formatTime(todayLimitMinutes * 60)}
          </div>
        </div>

        {!isStartable ? (
          <div className="text-center">
            <button disabled className="no-drag bg-gray-200 text-gray-400 font-bold rounded-2xl py-4 px-10 text-lg cursor-not-allowed">
              ▶ 게임 시작
            </button>
            <p className="text-orange-500 text-sm mt-3 font-medium">
              오후 {displaySettings.allowedStartHour}시 이후에 시작할 수 있어요
            </p>
          </div>
        ) : (
          <button
            onClick={handleStartTimer}
            disabled={!settings}
            className="no-drag bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black rounded-2xl py-4 px-10 text-xl transition-all shadow-lg disabled:opacity-50"
          >
            ▶ 게임 시작
          </button>
        )}
      </div>

      {/* 하단 */}
      <div className="text-center pb-2">
        <p className="text-gray-500 text-xs mb-2">{displaySettings.allowedStartHour}시 ~ {displaySettings.allowedEndHour}시</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={onOpenSettings}
            className="no-drag text-indigo-500 hover:text-indigo-700 font-medium text-sm transition-colors"
          >
            ⚙️ 설정 변경
          </button>
          <button
            onClick={handleTestMode}
            className="no-drag text-orange-400 hover:text-orange-600 font-medium text-sm transition-colors"
          >
            🧪 테스트 (2분)
          </button>
        </div>
      </div>
    </div>
  )
}
