import { useState, useEffect } from 'react'
import type { Settings } from '../../../shared/types'
import { DEFAULT_SETTINGS } from '../../../shared/types'
import robloxCharacters from '../assets/roblox-characters.jpg'

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

function ledColors(remainingSeconds: number): { color: string; glow: string } {
  if (remainingSeconds <= 60)  return { color: '#ff1744', glow: 'rgba(255,23,68,0.80)' }
  if (remainingSeconds <= 180) return { color: '#ff6600', glow: 'rgba(255,102,0,0.95)' }
  if (remainingSeconds <= 300) return { color: '#ffea00', glow: 'rgba(255,234,0,0.70)' }
  return                              { color: '#00e676', glow: 'rgba(0,230,118,0.65)' }
}

export default function Timer({ onOpenSettings }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState('')
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [overlayMode, setOverlayMode] = useState<'corner' | 'center-popup' | 'center-countdown' | 'shutdown'>('corner')
  const [autoStartBanner, setAutoStartBanner] = useState(false)

  useEffect(() => {
    window.api?.readSettings().then(setSettings)
  }, [])

  const handleStartTimer = async (limitMinutes?: number) => {
    const api = window.api
    if (!api) return
    const s = settings ?? DEFAULT_SETTINGS
    const limit = limitMinutes ?? getTodayAllowedMinutes(s)
    const now = new Date()
    setSessionStartTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    setOverlayMode('corner')
    await api.startTimer(limit)
    setIsRunning(true)
    setRemainingSeconds(limit * 60)
  }

  // Roblox 자동 감지 → 타이머 자동 시작
  useEffect(() => {
    const api = window.api
    if (!api) return
    const removeDetected = api.onRobloxDetected(() => {
      if (isRunning) return
      const s = settings ?? DEFAULT_SETTINGS
      const now = new Date()
      const hour = now.getHours()
      if (hour >= s.allowedStartHour && hour < s.allowedEndHour) {
        setAutoStartBanner(true)
        setTimeout(() => setAutoStartBanner(false), 3000)
        handleStartTimer()
      }
    })
    const removeClosed = api.onRobloxClosed(() => {
      if (!isRunning) return
      api.stopTimer()
      setIsRunning(false)
      setOverlayMode('corner')
      setRemainingSeconds(0)
      setSessionStartTime('')
    })
    return () => { removeDetected(); removeClosed() }
  }, [isRunning, settings])

  // 재부팅 후 타이머 복원
  useEffect(() => {
    const api = window.api
    if (!api) return
    return api.onTimerResumed(({ remainingSeconds: rs }) => {
      setIsRunning(true)
      setRemainingSeconds(rs)
      setOverlayMode('corner')
    })
  }, [])

  // 관리자 강제 중지
  useEffect(() => {
    const api = window.api
    if (!api) return
    return api.onTimerAdminStopped(() => {
      setIsRunning(false)
      setOverlayMode('corner')
      setRemainingSeconds(0)
      setSessionStartTime('')
    })
  }, [])

  useEffect(() => {
    const api = window.api
    if (!isRunning || !api) return
    return api.onTimerTick(({ remainingSeconds: rs }) => setRemainingSeconds(rs))
  }, [isRunning])

  useEffect(() => {
    const api = window.api
    if (!isRunning || !api) return
    return api.onTimerWarning(({ minutesLeft }) => {
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
      setWarningMessage(null)
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

  useEffect(() => {
    const api = window.api
    if (!isRunning || !api) return
    return api.onTimerMode(({ mode }) => {
      setOverlayMode(mode as typeof overlayMode)
    })
  }, [isRunning])

  useEffect(() => {
    if (!warningMessage) return
    const t = setTimeout(() => setWarningMessage(null), 4000)
    return () => clearTimeout(t)
  }, [warningMessage])

  const displaySettings = settings ?? DEFAULT_SETTINGS
  const todayLimitMinutes = getTodayAllowedMinutes(displaySettings)
  const dayType = isWeekend(new Date()) ? '주말' : '평일'
  const now = new Date()
  const hour = now.getHours()
  const isStartable = hour >= displaySettings.allowedStartHour && hour < displaySettings.allowedEndHour

  // ── 타이머 실행 중: 오버레이 모드들 ─────────────────────────────────────
  if (isRunning) {
    const { color, glow } = ledColors(remainingSeconds)

    if (overlayMode === 'shutdown') {
      return (
        <div className="h-screen w-screen flex items-center justify-center select-none"
          style={{ background: 'transparent' }}>
          <div style={{
            background: 'rgba(0,0,0,0.88)', borderRadius: '16px',
            padding: '14px 28px',
            display: 'flex', alignItems: 'center',
          }}>
            <span style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: '20px', fontWeight: 700,
              color: '#ff1744',
              textShadow: '0 0 16px rgba(255,23,68,0.9)',
              letterSpacing: '1px',
            }}>
              🚫 게임 셧다운...
            </span>
          </div>
        </div>
      )
    }

    if (overlayMode === 'center-countdown') {
      return (
        <div className="h-screen w-screen flex items-center justify-center select-none"
          style={{ background: 'transparent' }}>
          <div style={{
            background: 'rgba(0,0,0,0.85)', borderRadius: '16px',
            padding: '12px 28px',
            display: 'flex', alignItems: 'center',
          }}>
            <span style={{
              fontFamily: "'DSEG7', 'Courier New', monospace",
              fontSize: '64px', fontWeight: 'bold', letterSpacing: '4px',
              color: '#ff1744',
              textShadow: '0 0 24px rgba(255,23,68,0.9), 0 0 10px rgba(255,23,68,0.9)',
              lineHeight: 1, userSelect: 'none',
            }}>
              {formatTime(remainingSeconds)}
            </span>
          </div>
        </div>
      )
    }

    if (overlayMode === 'center-popup') {
      return (
        <div className="h-screen w-screen flex items-center justify-center select-none"
          style={{ background: 'transparent' }}>
          <div style={{
            background: 'rgba(0,0,0,0.85)', borderRadius: '16px',
            padding: '14px 28px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          }}>
            {warningMessage && (
              <span style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: '17px', fontWeight: 700,
                color: '#ff1744',
                textShadow: '0 0 10px rgba(255,23,68,0.8)',
                letterSpacing: '0.5px',
              }}>{warningMessage}</span>
            )}
            <span style={{
              fontFamily: "'DSEG7', 'Courier New', monospace",
              fontSize: '48px', fontWeight: 'bold', letterSpacing: '4px',
              color, textShadow: `0 0 20px ${glow}, 0 0 8px ${glow}`,
              lineHeight: 1, userSelect: 'none',
            }}>
              {formatTime(remainingSeconds)}
            </span>
          </div>
        </div>
      )
    }

    // 코너 타이머
    return (
      <div className="app-drag h-screen w-screen flex flex-col items-end justify-end select-none"
        style={{ cursor: 'move' }}>
        {warningMessage && (
          <div style={{
            background: 'rgba(0,0,0,0.30)', padding: '1.5% 4%',
            marginBottom: '2%', borderRadius: '5px 0 0 5px',
          }}>
            <span style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: '5.5vw', fontWeight: 700,
              color: '#ff1744',
              textShadow: '0 0 8px rgba(255,23,68,0.7)',
              letterSpacing: '0.5px', userSelect: 'none',
            }}>{warningMessage}</span>
          </div>
        )}
        <div style={{
          background: 'rgba(0,0,0,0.30)',
          padding: '0 4%',
          height: '46%',
          display: 'flex', alignItems: 'center',
          borderRadius: '6px 0 0 6px',
        }}>
          <span style={{
            fontFamily: "'DSEG7', 'Courier New', monospace",
            fontSize: '12vw', fontWeight: 'bold', letterSpacing: '0.06em',
            color, textShadow: `0 0 12px ${glow}, 0 0 5px ${glow}`,
            userSelect: 'none', lineHeight: 1,
          }}>
            {formatTime(remainingSeconds)}
          </span>
        </div>
      </div>
    )
  }

  // ── 대기 모드: 메인 화면 ─────────────────────────────────────────────────
  return (
    <div className="app-drag flex flex-col h-screen w-screen overflow-hidden select-none"
      style={{
        background: 'linear-gradient(180deg, #4FC3F7 0%, #0288D1 100%)',
        borderRadius: '12px',
      }}>

      {/* 자동 감지 배너 */}
      {autoStartBanner && (
        <div className="no-drag absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-2"
          style={{ background: 'rgba(0,0,0,0.7)' }}>
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>
            🎮 로블록스 감지! 타이머 자동 시작...
          </span>
        </div>
      )}

      {/* 상단: 로블록스 헤더 */}
      <div className="app-drag flex items-center justify-center gap-2 pt-5 pb-1" style={{ flexShrink: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: '#E8001C',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(232,0,28,0.5)',
          flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: '18px', lineHeight: 1 }}>R</span>
        </div>
        <span style={{
          fontFamily: 'system-ui, Arial Black, sans-serif',
          fontWeight: 900, fontSize: '22px',
          color: '#fff',
          letterSpacing: '2px',
          textShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}>ROBLOX</span>
      </div>

      {/* 타이틀 */}
      <div className="app-drag text-center pt-1 pb-2" style={{ flexShrink: 0 }}>
        <h1 style={{
          fontFamily: "'Black Han Sans', sans-serif",
          fontSize: '40px',
          color: '#1a1a2e',
          lineHeight: 1.1,
          textShadow: '0 2px 4px rgba(0,0,0,0.15)',
        }}>
          나와의 서약
        </h1>
        <p style={{
          fontFamily: 'Georgia, serif',
          fontSize: '13px',
          fontStyle: 'italic',
          color: 'rgba(255,255,255,0.75)',
          letterSpacing: '0.5px',
          margin: '3px 0 0 0',
        }}>
          My Pact for My Future
        </p>
      </div>

      {/* 오늘 제한 정보 */}
      <div className="no-drag flex items-center justify-center gap-2 mb-2" style={{ flexShrink: 0 }}>
        <span style={{
          background: 'rgba(255,255,255,0.25)',
          color: '#fff', fontSize: '13px', fontWeight: 700,
          padding: '3px 12px', borderRadius: '20px',
        }}>{dayType}</span>
        <span style={{
          background: 'rgba(255,255,255,0.25)',
          color: '#fff', fontSize: '13px', fontWeight: 700,
          padding: '3px 12px', borderRadius: '20px',
        }}>하루 {todayLimitMinutes}분</span>
      </div>

      {/* 허용 시간 표시 카드 */}
      <div className="no-drag flex justify-center mb-3" style={{ flexShrink: 0 }}>
        <div style={{
          background: 'rgba(255,255,255,0.22)',
          backdropFilter: 'blur(8px)',
          borderRadius: '16px',
          padding: '11px 28px',
          border: '1px solid rgba(255,255,255,0.4)',
          textAlign: 'center',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', marginBottom: '4px', letterSpacing: '1px', fontWeight: 600 }}>
            오늘 허용 시간
          </p>
          <div style={{
            fontFamily: "'DSEG7', 'Courier New', monospace",
            fontSize: '42px', fontWeight: 'bold',
            color: '#fff',
            textShadow: '0 0 20px rgba(255,255,255,0.6)',
            letterSpacing: '3px',
            lineHeight: 1,
          }}>
            {formatTime(todayLimitMinutes * 60)}
          </div>
        </div>
      </div>

      {/* 시작 버튼 영역 */}
      <div className="no-drag flex flex-col items-center gap-2 mb-2" style={{ flexShrink: 0 }}>
        {!isStartable ? (
          <>
            <button disabled style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.5)',
              border: 'none', borderRadius: '14px',
              padding: '13px 48px', fontSize: '18px', fontWeight: 900,
              cursor: 'not-allowed', letterSpacing: '1px',
            }}>
              ▶ 게임 시작
            </button>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontWeight: 600, margin: 0 }}>
              {hour < displaySettings.allowedStartHour
                ? `${displaySettings.allowedStartHour}시 이후에 시작할 수 있어`
                : `오늘 게임 시간이 끝났어 (${displaySettings.allowedEndHour}시 이후)`}
            </p>
          </>
        ) : (
          <button
            className="no-drag btn-start"
            onClick={() => handleStartTimer()}
            style={{
              border: 'none', borderRadius: '14px',
              padding: '13px 48px', fontSize: '18px', fontWeight: 900,
              color: '#fff', letterSpacing: '1px',
              cursor: 'pointer',
            }}
          >
            ▶ 게임 시작
          </button>
        )}

        <button
          className="no-drag"
          onClick={() => handleStartTimer(2)}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '10px', padding: '5px 18px',
            color: 'rgba(255,255,255,0.7)', fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          🧪 테스트 (2분)
        </button>
      </div>

      {/* 하단: 허용 시간대 + 설정 */}
      <div className="no-drag flex flex-col items-center gap-1 pb-2" style={{ flexShrink: 0 }}>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', margin: 0 }}>
          {displaySettings.allowedStartHour}시 ~ {displaySettings.allowedEndHour}시
        </p>
        <button
          onClick={onOpenSettings}
          style={{
            background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.8)', fontSize: '13px',
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          ⚙️ 설정 변경
        </button>
      </div>

      {/* 로블록스 캐릭터 이미지 — flex-1으로 남은 공간 채움 (absolute 제거) */}
      <div style={{
        flex: '1 1 0',
        minHeight: 50,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        <img
          src={robloxCharacters}
          alt=""
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'top',
            opacity: 0.9,
          }}
        />
      </div>
    </div>
  )
}
