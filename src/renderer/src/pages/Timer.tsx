import { useState, useEffect, useRef } from 'react'
import type { PublicSettings } from '../../../shared/types'
import { DEFAULT_PUBLIC_SETTINGS } from '../../../shared/types'
import { isHourAllowed } from '../../../shared/policy'
import robloxCharacters from '../assets/roblox-characters.jpg'

interface Props {
  onOpenSettings: () => void
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function formatLimitDisplay(minutes: number): string {
  if (!isFinite(minutes) || minutes < 0) return '--:--'
  const m = Math.floor(minutes)
  return `${String(m).padStart(2, '0')}:00`
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--'
  const s = Math.round(seconds)
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function getTodayAllowedMinutes(settings: PublicSettings): number {
  const limit = isWeekend(new Date()) ? settings.weekendLimit : settings.weekdayLimit
  return isFinite(limit) && limit > 0 ? limit : DEFAULT_PUBLIC_SETTINGS.weekdayLimit
}

function ledColors(remainingSeconds: number): { color: string; glow: string } {
  if (remainingSeconds <= 60)  return { color: '#ff1744', glow: 'rgba(255,23,68,0.80)' }
  if (remainingSeconds <= 180) return { color: '#ff6600', glow: 'rgba(255,102,0,0.95)' }
  if (remainingSeconds <= 300) return { color: '#ffea00', glow: 'rgba(255,234,0,0.70)' }
  return                              { color: '#00e676', glow: 'rgba(0,230,118,0.65)' }
}

export default function Timer({ onOpenSettings }: Props) {
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState('')
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  const [overlayMode, setOverlayMode] = useState<'corner' | 'center-popup' | 'center-countdown' | 'shutdown'>('corner')
  const [autoStartBanner, setAutoStartBanner] = useState(false)
  const [approvalPin, setApprovalPin] = useState('')
  const [approvalError, setApprovalError] = useState('')
  const [approvalPending, setApprovalPending] = useState(false)
  const isRunningRef = useRef(false)
  const dailyExhaustedRef = useRef(false)

  const hideMainWindow = (event?: React.MouseEvent<HTMLButtonElement> | React.PointerEvent<HTMLButtonElement>) => {
    event?.preventDefault()
    event?.stopPropagation()
    window.api?.hideMainWindowNow()
    void window.api?.hideMainWindow()
  }

  // 당일 세션 상태
  const [dailyRemainingSeconds, setDailyRemainingSeconds] = useState<number | null>(null)
  const [dailyExhausted, setDailyExhausted] = useState(false)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const [sessionsPerDay, setSessionsPerDay] = useState(1)
  const [currentSessionActive, setCurrentSessionActive] = useState(false)

  useEffect(() => { isRunningRef.current = isRunning }, [isRunning])
  useEffect(() => { dailyExhaustedRef.current = dailyExhausted }, [dailyExhausted])

  useEffect(() => {
    window.api?.readSettings().then(setSettings)
    refreshDailyUsage()
  }, [])

  function refreshDailyUsage() {
    window.api?.dailyGetRemaining().then(r => {
      setDailyRemainingSeconds(r.remainingSeconds)
      setDailyExhausted(r.exhausted)
      setSessionsCompleted(r.sessionsCompleted)
      setSessionsPerDay(r.sessionsPerDay)
      setCurrentSessionActive(r.currentSessionActive)
    })
  }

  function syncTimerStatus() {
    window.api?.timerGetStatus().then(status => {
      if (status.running && isFinite(status.remainingSeconds) && status.remainingSeconds > 0) {
        setIsRunning(true)
        setOverlayMode(status.mode ?? 'corner')
        setRemainingSeconds(status.remainingSeconds)
      }
    })
  }

  useEffect(() => {
    syncTimerStatus()
  }, [])

  const handleStartTimer = async (limitMinutes?: number) => {
    const api = window.api
    if (!api) return
    const s = settings ?? DEFAULT_PUBLIC_SETTINGS
    const limit = limitMinutes ?? getTodayAllowedMinutes(s)
    if (!isFinite(limit) || limit <= 0) return

    const now = new Date()
    setSessionStartTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    setOverlayMode('corner')

    const result = await api.startTimer(limit)

    if (result?.blocked) {
      setSessionStartTime('')
      setBlockedMessage(result.blocked === 'outside-hours'
        ? `${s.allowedStartHour}시 ~ ${s.allowedEndHour}시에만 Roblox를 실행할 수 있어요.`
        : result.blocked === 'approval-required'
          ? '부모님 PIN 승인 후 Roblox를 시작할 수 있어요.'
          : result.blocked === 'roblox-not-running'
            ? 'Roblox가 실행 중일 때만 타이머가 시작돼요.'
            : 'Roblox를 시작할 수 없어요.')
      refreshDailyUsage()
      return
    }

    // 당일 쿼터 소진으로 거부된 경우
    if (result?.exhausted) {
      setDailyExhausted(true)
      setDailyRemainingSeconds(0)
      setSessionStartTime('')
      setBlockedMessage('오늘 Roblox 게임 시간을 모두 사용했어요.')
      refreshDailyUsage()
      return
    }

    const rs = result?.remainingSeconds
    if (!isFinite(rs) || rs <= 0) {
      setSessionStartTime('')
      return
    }

    setApprovalPin('')
    setApprovalError('')
    setIsRunning(true)
    setRemainingSeconds(rs)
  }

  const handleParentApprovalAndStart = async (limitMinutes?: number) => {
    const api = window.api
    if (!api || approvalPending) return
    if (!/^\d{4}$/.test(approvalPin)) {
      setApprovalError('PIN 4자리를 입력해주세요.')
      return
    }
    try {
      setApprovalPending(true)
      setApprovalError('')
      const approval = await api.adminApproveNextSession(approvalPin)
      if (!approval.ok) {
        setApprovalError('PIN이 올바르지 않아요.')
        return
      }
      setApprovalPin('')
      setApprovalError('')
      if (approval.launchedPendingRoblox) {
        setBlockedMessage(null)
        setAutoStartBanner(true)
        setTimeout(() => setAutoStartBanner(false), 3000)
        return
      }
      await handleStartTimer(limitMinutes)
    } catch {
      setApprovalError('승인에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setApprovalPending(false)
    }
  }

  // Roblox 자동 감지 → 타이머 자동 시작
  useEffect(() => {
    const api = window.api
    if (!api) return
    const removeDetected = api.onRobloxDetected(() => {
      if (isRunningRef.current || dailyExhaustedRef.current) return
      const now = new Date()
      setSessionStartTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
      api.timerGetStatus().then(status => {
        if (status.running && isFinite(status.remainingSeconds) && status.remainingSeconds > 0) {
          setIsRunning(true)
          setOverlayMode(status.mode ?? 'corner')
          setRemainingSeconds(status.remainingSeconds)
        }
        setAutoStartBanner(true)
        setTimeout(() => setAutoStartBanner(false), 3000)
      })
    })
    const removeClosed = api.onRobloxClosed(() => {
      setIsRunning(false)
      setOverlayMode('corner')
      setRemainingSeconds(0)
      setSessionStartTime('')
      refreshDailyUsage()
    })
    return () => { removeDetected(); removeClosed() }
  }, [])

  // 재부팅 후 타이머 복원
  useEffect(() => {
    const api = window.api
    if (!api) return
    return api.onTimerResumed(({ remainingSeconds: rs }) => {
      if (!isFinite(rs) || rs <= 0) return
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
      // 관리자가 추가 시간을 줬을 수도 있으므로 쿼터 재조회
      refreshDailyUsage()
    })
  }, [])

  useEffect(() => {
    const api = window.api
    if (!api) return
    return api.onTimerTick(({ remainingSeconds: rs }) => {
      if (isFinite(rs)) {
        setIsRunning(true)
        setRemainingSeconds(rs)
      }
    })
  }, [])

  useEffect(() => {
    const api = window.api
    if (!api) return
    return api.onTimerWarning(({ minutesLeft }) => {
      setIsRunning(true)
      const msg = minutesLeft === 0 ? '⏰ 30초 남았어!' : `⚠️ ${minutesLeft}분 남았어!`
      setWarningMessage(msg)
    })
  }, [])

  useEffect(() => {
    const api = window.api
    if (!api) return
    return api.onTimerExpired(() => {
      setIsRunning(false)
      setOverlayMode('corner')
      setWarningMessage(null)
      refreshDailyUsage()

      setRemainingSeconds(0)
      setSessionStartTime('')
    })
  }, [])

  useEffect(() => {
    const api = window.api
    if (!api) return
    return api.onRobloxBlocked(({ message }) => {
      setBlockedMessage(message)
      refreshDailyUsage()
      setTimeout(() => setBlockedMessage(null), 6000)
    })
  }, [])

  useEffect(() => {
    const api = window.api
    if (!api) return
    return api.onTimerMode(({ mode }) => {
      if (mode !== 'shutdown') setIsRunning(true)
      setOverlayMode(mode as typeof overlayMode)
    })
  }, [])

  useEffect(() => {
    if (!warningMessage) return
    const t = setTimeout(() => setWarningMessage(null), 4000)
    return () => clearTimeout(t)
  }, [warningMessage])

  const displaySettings = settings ?? DEFAULT_PUBLIC_SETTINGS
  const todayLimitMinutes = getTodayAllowedMinutes(displaySettings)
  const dayType = isWeekend(new Date()) ? '주말' : '평일'
  const now = new Date()
  const hour = now.getHours()
  const isStartable = isHourAllowed(hour, displaySettings.allowedStartHour, displaySettings.allowedEndHour)

  // 표시할 남은 시간 (분 단위)
  const displayRemainingSeconds = dailyRemainingSeconds ?? (todayLimitMinutes * 60)
  const displayRemainingMinutes = Math.ceil(displayRemainingSeconds / 60)
  const canStart = isStartable && !dailyExhausted
  const requiresParentApproval = displaySettings.requireApprovalBeforeStart && !currentSessionActive

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
      <div className="no-drag flex flex-col h-screen w-screen overflow-hidden select-none"
      style={{
        background: 'linear-gradient(180deg, #4FC3F7 0%, #0288D1 100%)',
        borderRadius: '12px',
        position: 'relative',
      }}>

      <button
        type="button"
        className="no-drag window-hide-button"
        onPointerDown={hideMainWindow}
        onClick={hideMainWindow}
        aria-label="창 숨기기"
        style={{
          position: 'fixed', top: 8, right: 8, zIndex: 2147483647,
          width: 52, height: 52, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.45)',
          background: 'rgba(0,0,0,0.35)', color: '#fff',
          fontSize: '22px', lineHeight: '48px', cursor: 'pointer', pointerEvents: 'auto',
        }}
      >
        –
      </button>

      {/* 자동 감지 배너 */}
      {autoStartBanner && (
        <div className="no-drag absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-2"
          style={{ background: 'rgba(0,0,0,0.7)' }}>
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>
            🎮 로블록스 감지! 타이머 자동 시작...
          </span>
        </div>
      )}

      {blockedMessage && (
        <div className="no-drag absolute top-12 left-4 right-4 z-10 flex items-center justify-center rounded-xl px-3 py-2"
          style={{ background: 'rgba(232,0,28,0.86)' }}>
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: 800, textAlign: 'center' }}>
            {blockedMessage}
          </span>
        </div>
      )}

      {/* 상단: 로블록스 헤더 */}
      <div className="no-drag flex items-center justify-center gap-2 pt-5 pb-1" style={{ flexShrink: 0 }}>
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
      <div className="no-drag text-center pt-1 pb-2" style={{ flexShrink: 0 }}>
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
          fontFamily: "'Impact', 'Arial Black', sans-serif",
          fontSize: '18px',
          fontWeight: 'normal',
          color: '#FFE500',
          letterSpacing: '2px',
          textShadow: '0 0 12px rgba(255,229,0,0.7), 0 1px 3px rgba(0,0,0,0.5)',
          margin: '4px 0 0 0',
          textTransform: 'uppercase',
        }}>
          My Pact
        </p>
        <p style={{
          color: 'rgba(255,255,255,0.72)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '1px',
          margin: '2px 0 0 0',
          textShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }}>
          ver {__APP_VERSION__}
        </p>
      </div>

      {/* 오늘 정보 뱃지 */}
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
        }}>{todayLimitMinutes}분 × {sessionsPerDay}회</span>
        {sessionsPerDay > 1 && (
          <span style={{
            background: sessionsCompleted >= sessionsPerDay
              ? 'rgba(255,23,68,0.35)' : 'rgba(255,255,255,0.18)',
            color: '#fff', fontSize: '12px', fontWeight: 700,
            padding: '3px 10px', borderRadius: '20px',
          }}>
            {sessionsCompleted}/{sessionsPerDay}회 완료
          </span>
        )}
      </div>

      {/* 오늘 남은 시간 카드 */}
      <div className="no-drag flex justify-center mb-3" style={{ flexShrink: 0 }}>
        <div style={{
          background: dailyExhausted ? 'rgba(255,23,68,0.18)' : 'rgba(255,255,255,0.22)',
          backdropFilter: 'blur(8px)',
          borderRadius: '16px',
          padding: '11px 28px',
          border: dailyExhausted ? '1px solid rgba(255,23,68,0.5)' : '1px solid rgba(255,255,255,0.4)',
          textAlign: 'center',
        }}>
          <p style={{
            color: dailyExhausted ? '#ff8a80' : 'rgba(255,255,255,0.8)',
            fontSize: '11px', marginBottom: '4px', letterSpacing: '1px', fontWeight: 600,
          }}>
            {dailyExhausted
              ? '오늘 게임 시간 소진 ✋'
              : currentSessionActive
                ? '이번 세션 남은 시간'
                : '세션당 시간'}
          </p>
          <div style={{
            fontFamily: "'DSEG7', 'Courier New', monospace",
            fontSize: '42px', fontWeight: 'bold',
            color: dailyExhausted ? '#ff5252' : '#fff',
            textShadow: dailyExhausted
              ? '0 0 20px rgba(255,82,82,0.6)'
              : '0 0 20px rgba(255,255,255,0.6)',
            letterSpacing: '3px',
            lineHeight: 1,
          }}>
            {formatLimitDisplay(displayRemainingMinutes)}
          </div>
        </div>
      </div>

      {/* 시작 버튼 영역 */}
      <div className="no-drag flex flex-col items-center gap-2 mb-2" style={{ flexShrink: 0 }}>
        {!canStart ? (
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
              {dailyExhausted
                ? '오늘 게임 시간을 모두 썼어 😊'
                : hour < displaySettings.allowedStartHour
                  ? `${displaySettings.allowedStartHour}시 이후에 시작할 수 있어`
                  : `오늘 게임 시간이 끝났어 (${displaySettings.allowedEndHour}시 이후)`}
            </p>
          </>
        ) : requiresParentApproval ? (
          <div className="no-drag" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 700, margin: 0 }}>
              부모님 PIN 승인 후 이번 게임 타임을 시작해요.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={approvalPin}
              onChange={(e) => setApprovalPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="PIN"
              className="setting-input"
              style={{ width: '96px', textAlign: 'center', letterSpacing: '4px' }}
            />
            {approvalError && (
              <p style={{ color: '#ffcccc', fontSize: '12px', fontWeight: 700, margin: 0 }}>{approvalError}</p>
            )}
            <button
              className="no-drag btn-start"
              disabled={approvalPending}
              onClick={() => handleParentApprovalAndStart()}
              style={{
                border: 'none', borderRadius: '14px',
                padding: '13px 40px', fontSize: '18px', fontWeight: 900,
                color: '#fff', letterSpacing: '1px',
                cursor: approvalPending ? 'wait' : 'pointer',
                opacity: approvalPending ? 0.75 : 1,
              }}
            >
              {approvalPending ? '확인 중...' : '🔐 승인 후 시작'}
            </button>
          </div>
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

        {import.meta.env.DEV && !dailyExhausted && (
          <button
            className="no-drag"
            onClick={() => requiresParentApproval ? handleParentApprovalAndStart(2) : handleStartTimer(2)}
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
        )}
      </div>

      {/* 하단: 허용 시간대 + 설정 */}
      <div className="no-drag flex flex-col items-center gap-1 pb-2" style={{ flexShrink: 0 }}>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', margin: 0 }}>
          {displaySettings.allowedStartHour}시 ~ {displaySettings.allowedEndHour}시
        </p>
        <button
          onClick={onOpenSettings}
          style={{
            background: 'rgba(255,255,255,0.18)',
            border: '1.5px solid rgba(255,255,255,0.55)',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 700,
            padding: '7px 22px',
            cursor: 'pointer',
            letterSpacing: '0.5px',
          }}
        >
          ⚙️ 설정 변경
        </button>
      </div>

      {/* 로블록스 캐릭터 이미지 */}
      <div style={{ flex: '1 1 0', minHeight: 50, overflow: 'hidden', pointerEvents: 'none' }}>
        <img
          src={robloxCharacters}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', opacity: 0.9 }}
        />
      </div>
    </div>
  )
}
