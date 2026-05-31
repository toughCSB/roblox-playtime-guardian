import { useState, useEffect } from 'react'

type Stage = 'pin' | 'admin'

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── PIN 입력 화면 ─────────────────────────────────────────────────────────
function PinStage({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (lockoutSeconds <= 0) return
    const t = setInterval(() => {
      setLockoutSeconds(s => {
        if (s <= 1) { clearInterval(t); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [lockoutSeconds])

  const handleDigit = (d: string) => {
    if (lockoutSeconds > 0 || verifying || pin.length >= 4) return
    setPin(p => p + d)
  }

  const handleBack = () => { if (!verifying) setPin(p => p.slice(0, -1)) }

  const handleConfirm = async (candidate = pin) => {
    if (candidate.length !== 4 || lockoutSeconds > 0 || verifying) return
    setVerifying(true)
    try {
      const ok = await window.api?.adminVerifyPassword(candidate)
      if (ok) {
        onSuccess()
      } else {
        const next = attempts + 1
        setAttempts(next)
        setPin('')
        if (next >= 5) {
          setAttempts(0)
          setLockoutSeconds(30)
          setError('5회 실패. 30초 후 재시도.')
        } else {
          setError(`비밀번호가 틀렸어요. (${next}/5)`)
          setTimeout(() => setError(''), 2000)
        }
      }
    } catch {
      setPin('')
      setError('인증에 실패했어요. 잠시 후 다시 시도하세요.')
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    if (pin.length === 4 && lockoutSeconds <= 0 && !verifying) {
      void handleConfirm(pin)
    }
  }, [pin, lockoutSeconds, verifying])

  // 물리 키보드 숫자패드 입력 지원
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (lockoutSeconds > 0 || verifying) return
      if (/^[0-9]$/.test(e.key)) {
        if (pin.length < 4) setPin(p => p + e.key)
      } else if (e.key === 'Backspace') {
        setPin(p => p.slice(0, -1))
      } else if (e.key === 'Enter' && pin.length === 4) {
        void handleConfirm()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lockoutSeconds, pin, attempts, onSuccess, verifying])

  const isLocked = lockoutSeconds > 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: '24px',
    }}>
      <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 800, letterSpacing: '1px' }}>
        관리자 인증
      </h1>

      {/* 4자리 점 표시 */}
      <div style={{ display: 'flex', gap: '16px' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            background: i < pin.length ? '#E8001C' : 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.3)',
            transition: 'background 0.15s',
          }} />
        ))}
      </div>

      {/* 에러/잠금 메시지 */}
      <div style={{ height: '24px' }}>
        {isLocked && (
          <span style={{ color: '#ff6b6b', fontSize: '14px', fontWeight: 600 }}>
            {lockoutSeconds}초 후 재시도 가능
          </span>
        )}
        {!isLocked && error && (
          <span style={{ color: '#ff6b6b', fontSize: '14px', fontWeight: 600 }}>{error}</span>
        )}
      </div>

      {/* 숫자 패드 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px', width: '216px',
      }}>
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button key={d} onClick={() => handleDigit(d)} disabled={isLocked || verifying}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px', height: '56px',
              color: '#fff', fontSize: '22px', fontWeight: 700,
              cursor: isLocked || verifying ? 'not-allowed' : 'pointer',
              opacity: isLocked || verifying ? 0.4 : 1,
              transition: 'background 0.1s',
            }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.22)' }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)' }}
          >
            {d}
          </button>
        ))}
        {/* 마지막 줄: 지우기 / 0 / 확인 */}
        <button onClick={handleBack} disabled={isLocked || verifying}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '12px', height: '56px',
            color: 'rgba(255,255,255,0.7)', fontSize: '20px',
            cursor: isLocked || verifying ? 'not-allowed' : 'pointer',
            opacity: isLocked || verifying ? 0.4 : 1,
          }}>
          ⌫
        </button>
        <button onClick={() => handleDigit('0')} disabled={isLocked || verifying}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '12px', height: '56px',
            color: '#fff', fontSize: '22px', fontWeight: 700,
            cursor: isLocked || verifying ? 'not-allowed' : 'pointer',
            opacity: isLocked || verifying ? 0.4 : 1,
          }}>
          0
        </button>
        <button onClick={() => void handleConfirm()} disabled={isLocked || verifying || pin.length !== 4}
          style={{
            background: pin.length === 4 && !isLocked && !verifying ? '#E8001C' : 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '12px', height: '56px',
            color: '#fff', fontSize: '20px', fontWeight: 700,
            cursor: (isLocked || verifying || pin.length !== 4) ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}>
          ✓
        </button>
      </div>

      {/* 닫기 */}
      <button onClick={() => window.api?.adminCloseWindow()}
        style={{
          background: 'transparent', border: 'none',
          color: 'rgba(255,255,255,0.4)', fontSize: '13px',
          cursor: 'pointer', marginTop: '4px',
        }}>
        닫기
      </button>
    </div>
  )
}

// ── 관리자 제어판 ──────────────────────────────────────────────────────────
function AdminStage() {
  const [timerRunning, setTimerRunning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [resumeEnabled, setResumeEnabled] = useState(true)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState(false)
  const [addMsg, setAddMsg] = useState('')
  const [manualMinutes, setManualMinutes] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    const api = window.api
    if (!api) return
    api.timerGetStatus().then(s => {
      setTimerRunning(s.running)
      setRemainingSeconds(s.remainingSeconds)
    })
    api.adminGetResumeOption().then(setResumeEnabled)
  }, [])

  // 타이머 틱 갱신
  useEffect(() => {
    const api = window.api
    if (!api || !timerRunning) return
    return api.onTimerTick(({ remainingSeconds: rs }) => setRemainingSeconds(rs))
  }, [timerRunning])

  const refreshTimerStatus = async () => {
    const status = await window.api?.timerGetStatus()
    if (!status) return
    setTimerRunning(status.running)
    setRemainingSeconds(status.remainingSeconds)
  }

  const handleAdjustTime = async (minutes: number) => {
    if (!Number.isInteger(minutes) || minutes === 0) {
      setAddMsg('0이 아닌 분 단위로 입력해주세요')
      setTimeout(() => setAddMsg(''), 2000)
      return
    }
    try {
      const result = await window.api?.timerAdjustTime(minutes)
      if (result && isFinite(result.remainingSeconds)) {
        setRemainingSeconds(result.remainingSeconds)
        setTimerRunning(result.remainingSeconds > 0)
      } else {
        await refreshTimerStatus()
      }
      setAddMsg(minutes > 0 ? `+${minutes}분 추가됐어요` : `${minutes}분 차감됐어요`)
      setManualMinutes('')
      setTimeout(() => setAddMsg(''), 2000)
    } catch {
      setAddMsg('시간 변경에 실패했어요')
      setTimeout(() => setAddMsg(''), 2000)
    }
  }

  const handleManualAdjust = async () => {
    const minutes = Number(manualMinutes)
    await handleAdjustTime(minutes)
  }

  const handleStopTimer = async () => {
    await window.api?.timerAdminStop()
    setTimerRunning(false)
    setRemainingSeconds(0)
  }

  const handleToggleResume = async () => {
    const next = !resumeEnabled
    setResumeEnabled(next)
    await window.api?.adminSetResumeOption(next)
  }

  const handleChangePassword = async () => {
    if (changingPassword) return
    if (!pwNew || pwNew !== pwConfirm) {
      setPwMsg('새 비밀번호가 일치하지 않아요')
      setPwError(true)
      setTimeout(() => setPwMsg(''), 2500)
      return
    }
    if (!/^\d{4}$/.test(pwNew)) {
      setPwMsg('새 비밀번호는 숫자 4자리여야 해요')
      setPwError(true)
      setTimeout(() => setPwMsg(''), 2500)
      return
    }
    setChangingPassword(true)
    try {
      const ok = await window.api?.adminVerifyPassword(pwCurrent)
      if (!ok) {
        setPwMsg('현재 비밀번호가 틀렸어요')
        setPwError(true)
        setTimeout(() => setPwMsg(''), 2500)
        return
      }
      await window.api?.adminChangePassword(pwCurrent, pwNew)
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setPwMsg('비밀번호가 변경됐어요')
      setPwError(false)
      setTimeout(() => setPwMsg(''), 3000)
    } catch {
      setPwMsg('비밀번호 변경에 실패했어요')
      setPwError(true)
      setTimeout(() => setPwMsg(''), 2500)
    } finally {
      setChangingPassword(false)
    }
  }

  useEffect(() => {
    if (/^\d{4}$/.test(pwCurrent) && /^\d{4}$/.test(pwNew) && /^\d{4}$/.test(pwConfirm)) {
      void handleChangePassword()
    }
  }, [pwCurrent, pwNew, pwConfirm])

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px', padding: '8px 12px',
    color: '#fff', fontSize: '14px', outline: 'none',
    width: '100%',
  }

  const sectionLabel: React.CSSProperties = {
    color: 'rgba(255,255,255,0.5)', fontSize: '11px',
    fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
    marginBottom: '8px', marginTop: '4px',
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: '20px', gap: '0', overflowY: 'auto',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: 800 }}>관리자 설정</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => { window.api?.showMainWindow(); window.api?.adminCloseWindow() }}
            style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '8px', height: '32px', padding: '0 10px',
              color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            }}>
            메인
          </button>
          <button type="button" onClick={() => window.api?.adminCloseWindow()}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: '8px', width: '32px', height: '32px',
              color: '#fff', fontSize: '18px', cursor: 'pointer',
            }}>
            ×
          </button>
        </div>
      </div>

      {/* 타이머 상태 */}
      <p style={sectionLabel}>타이머 상태</p>
      <div style={{
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '12px', padding: '14px 16px',
        marginBottom: '12px',
      }}>
        {timerRunning ? (
          <>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '4px' }}>남은 시간</p>
            <p style={{
              fontFamily: "'DSEG7', 'Courier New', monospace",
              fontSize: '32px', color: '#00e676',
              textShadow: '0 0 12px rgba(0,230,118,0.7)',
              letterSpacing: '3px', lineHeight: 1,
            }}>
              {formatTime(remainingSeconds)}
            </p>
            {addMsg && <p style={{ color: '#00e676', fontSize: '13px', marginTop: '6px' }}>{addMsg}</p>}

            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 700, marginTop: '12px', marginBottom: '6px' }}>
              시간 추가
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {[5, 10, 15, 30, 60].map(m => (
                <button key={m} onClick={() => handleAdjustTime(m)}
                  style={{
                    background: 'rgba(0,230,118,0.15)',
                    border: '1px solid rgba(0,230,118,0.3)',
                    borderRadius: '8px', padding: '8px 0',
                    color: '#00e676', fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                  +{m}분
                </button>
              ))}
            </div>

            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 700, marginTop: '10px', marginBottom: '6px' }}>
              시간 차감
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {[5, 10, 15, 30, 60].map(m => (
                <button key={m} onClick={() => handleAdjustTime(-m)}
                  style={{
                    background: 'rgba(255,193,7,0.14)',
                    border: '1px solid rgba(255,193,7,0.32)',
                    borderRadius: '8px', padding: '8px 0',
                    color: '#ffd54f', fontSize: '12px', fontWeight: 800,
                    cursor: 'pointer',
                  }}>
                  -{m}분
                </button>
              ))}
            </div>

            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 700, marginTop: '10px', marginBottom: '6px' }}>
              직접 입력
            </p>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="number"
                value={manualMinutes}
                placeholder="예: 25 또는 -10"
                onChange={e => setManualMinutes(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleManualAdjust() }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={() => void handleManualAdjust()}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  borderRadius: '8px', padding: '0 12px',
                  color: '#fff', fontSize: '13px', fontWeight: 800,
                  cursor: 'pointer',
                }}>
                적용
              </button>
            </div>

            {/* 타이머 중지 */}
            <button onClick={handleStopTimer}
              style={{
                width: '100%', marginTop: '8px',
                background: 'rgba(232,0,28,0.15)',
                border: '1px solid rgba(232,0,28,0.3)',
                borderRadius: '8px', padding: '9px',
                color: '#E8001C', fontSize: '14px', fontWeight: 700,
                cursor: 'pointer',
              }}>
              타이머 중지
            </button>
          </>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>타이머가 실행 중이 아닙니다</p>
        )}
      </div>

      {/* 구분선 */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }} />

      {/* 재부팅 후 타이머 유지 */}
      <p style={sectionLabel}>재부팅 설정</p>
      <div style={{
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '12px', padding: '14px 16px',
        marginBottom: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>재부팅 후 타이머 유지</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', marginTop: '2px' }}>
            컴퓨터를 다시 켜도 타이머가 이어집니다
          </p>
        </div>
        {/* 토글 */}
        <button onClick={handleToggleResume}
          style={{
            width: '48px', height: '26px',
            background: resumeEnabled ? '#E8001C' : 'rgba(255,255,255,0.15)',
            border: 'none', borderRadius: '13px',
            cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            flexShrink: 0,
          }}>
          <div style={{
            position: 'absolute', top: '3px',
            left: resumeEnabled ? '25px' : '3px',
            width: '20px', height: '20px',
            background: '#fff', borderRadius: '50%',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* 구분선 */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }} />

      {/* 비밀번호 변경 */}
      <p style={sectionLabel}>비밀번호 변경</p>
      <div style={{
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '12px', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: '8px',
        marginBottom: '8px',
      }}>
        <input
          type="password" placeholder="현재 비밀번호"
          value={pwCurrent}
          maxLength={4}
          inputMode="numeric"
          onChange={e => setPwCurrent(e.target.value.replace(/\D/g, '').slice(0, 4))}
          style={inputStyle}
        />
        <input
          type="password" placeholder="새 비밀번호"
          value={pwNew}
          maxLength={4}
          inputMode="numeric"
          onChange={e => setPwNew(e.target.value.replace(/\D/g, '').slice(0, 4))}
          style={inputStyle}
        />
        <input
          type="password" placeholder="새 비밀번호 확인"
          value={pwConfirm}
          maxLength={4}
          inputMode="numeric"
          onChange={e => setPwConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
          style={inputStyle}
        />
        {pwMsg && (
          <p style={{ color: pwError ? '#ff6b6b' : '#00e676', fontSize: '13px', fontWeight: 600 }}>
            {pwMsg}
          </p>
        )}
        <button onClick={() => void handleChangePassword()} disabled={changingPassword}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px', padding: '9px',
            color: '#fff', fontSize: '14px', fontWeight: 700,
            cursor: changingPassword ? 'wait' : 'pointer',
          }}>
          변경
        </button>
      </div>
    </div>
  )
}

// ── 최상위 컴포넌트 ────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [stage, setStage] = useState<Stage>('pin')

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(160deg, #0f0f1e 0%, #1a1a3e 100%)',
      overflow: 'hidden',
    }}>
      {stage === 'pin' ? (
        <PinStage onSuccess={() => setStage('admin')} />
      ) : (
        <AdminStage />
      )}
    </div>
  )
}
