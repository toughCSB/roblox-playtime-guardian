import { useState, useEffect } from 'react'
import type { Settings } from '../../../shared/types'
import { DEFAULT_SETTINGS } from '../../../shared/types'
import robloxCharacters from '../assets/roblox-characters.jpg'

interface Props {
  onBack: () => void
}

export default function SettingsPage({ onBack }: Props) {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api?.readSettings().then(setSettings)
  }, [])

  const handleSave = async () => {
    const api = window.api
    if (!api) return
    try {
      await api.writeSettings({ ...settings, updatedAt: new Date().toISOString() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('저장에 실패했어요.')
      setTimeout(() => setError(''), 3000)
    }
  }

  const Row = ({ label, unit, children }: { label: string; unit: string; children: React.ReactNode }) => (
    <div style={{
      background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)',
      borderRadius: '14px', padding: '14px 18px',
      border: '1px solid rgba(255,255,255,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>{label}</span>
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {children}
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="app-drag flex flex-col h-screen w-screen overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #4FC3F7 0%, #0288D1 100%)',
        borderRadius: '12px',
        position: 'relative',
      }}>

      {/* 헤더 */}
      <div className="app-drag flex items-center gap-3 px-5 pt-6 pb-3">
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: '#E8001C',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: '15px' }}>R</span>
        </div>
        <span style={{
          fontFamily: 'system-ui, Arial Black, sans-serif',
          fontWeight: 900, fontSize: '18px',
          color: '#fff', letterSpacing: '2px',
        }}>ROBLOX</span>
      </div>

      <div className="app-drag text-center pb-4">
        <h2 style={{
          fontFamily: "'Black Han Sans', sans-serif",
          fontSize: '28px', color: '#1a1a2e',
        }}>게임 시간 설정</h2>
      </div>

      {/* 설정 항목들 */}
      <div className="no-drag flex flex-col gap-3 px-5 flex-1 overflow-y-auto pb-32">
        <p style={{ color: '#E8001C', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '2px' }}>
          하루 허용 시간
        </p>

        <Row label="평일" unit="분">
          <input
            type="number" min={5} max={240}
            value={settings.weekdayLimit}
            onChange={(e) => setSettings(s => ({ ...s, weekdayLimit: Number(e.target.value) }))}
            className="setting-input"
          />
        </Row>

        <Row label="주말" unit="분">
          <input
            type="number" min={5} max={480}
            value={settings.weekendLimit}
            onChange={(e) => setSettings(s => ({ ...s, weekendLimit: Number(e.target.value) }))}
            className="setting-input"
          />
        </Row>

        <p style={{ color: '#E8001C', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', marginTop: '8px', marginBottom: '2px' }}>
          게임 가능 시간대
        </p>

        <Row label="시작 가능 시각" unit="시">
          <input
            type="number" min={0} max={23}
            value={settings.allowedStartHour}
            onChange={(e) => setSettings(s => ({ ...s, allowedStartHour: Number(e.target.value) }))}
            className="setting-input"
          />
        </Row>

        <Row label="종료 시각" unit="시">
          <input
            type="number" min={0} max={23}
            value={settings.allowedEndHour}
            onChange={(e) => setSettings(s => ({ ...s, allowedEndHour: Number(e.target.value) }))}
            className="setting-input"
          />
        </Row>
      </div>

      {/* 저장 버튼 */}
      <div className="no-drag absolute left-0 right-0 flex flex-col gap-2 px-5"
        style={{ bottom: '120px' }}>
        {saved && (
          <p style={{ color: '#fff', fontSize: '13px', textAlign: 'center', fontWeight: 700 }}>
            ✓ 저장됐어요!
          </p>
        )}
        {error && (
          <p style={{ color: '#ffcccc', fontSize: '13px', textAlign: 'center' }}>{error}</p>
        )}
        <button
          onClick={handleSave}
          className="btn-start"
          style={{
            border: 'none', borderRadius: '14px',
            padding: '13px', fontSize: '16px', fontWeight: 900,
            color: '#fff', cursor: 'pointer', letterSpacing: '1px',
          }}
        >
          저장
        </button>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '14px', padding: '10px',
            color: 'rgba(255,255,255,0.85)', fontSize: '14px',
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          ← 돌아가기
        </button>
      </div>

      {/* 로블록스 캐릭터 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '110px', overflow: 'hidden', pointerEvents: 'none',
      }}>
        <img src={robloxCharacters} alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', opacity: 0.85 }} />
      </div>
    </div>
  )
}
