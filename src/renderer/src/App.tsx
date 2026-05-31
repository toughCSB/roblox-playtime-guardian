import { useEffect, useState } from 'react'
import Timer from './pages/Timer'
import Settings from './pages/Settings'
import AdminPanel from './pages/AdminPanel'

type Page = 'timer' | 'settings'

const isAdminWindow = window.location.hash === '#admin'

export default function App() {
  const [page, setPage] = useState<Page>('timer')
  const [settingsPinOpen, setSettingsPinOpen] = useState(false)
  const [settingsPin, setSettingsPin] = useState('')
  const [settingsPinError, setSettingsPinError] = useState('')
  const [settingsPinSubmitting, setSettingsPinSubmitting] = useState(false)

  const submitSettingsPin = async (candidate = settingsPin) => {
    if (settingsPinSubmitting) return
    if (!/^\d{4}$/.test(candidate)) {
      setSettingsPinError('PIN 4자리를 입력하세요.')
      return
    }
    setSettingsPinSubmitting(true)
    try {
      const ok = await window.api?.adminUnlockSettings(candidate)
      setSettingsPin('')
      if (ok) setPage('settings')
      if (ok) setSettingsPinOpen(false)
      else setSettingsPinError('PIN이 틀렸어요.')
    } finally {
      setSettingsPinSubmitting(false)
    }
  }

  useEffect(() => {
    if (settingsPinOpen && /^\d{4}$/.test(settingsPin)) {
      void submitSettingsPin(settingsPin)
    }
  }, [settingsPin, settingsPinOpen])

  if (isAdminWindow) {
    return <AdminPanel />
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      {page === 'timer' ? (
        <Timer onOpenSettings={() => { setSettingsPinError(''); setSettingsPinOpen(true) }} />
      ) : (
        <Settings onBack={() => setPage('timer')} />
      )}
      {settingsPinOpen && (
        <div className="no-drag" style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 300, borderRadius: 18, padding: 22,
            background: 'linear-gradient(160deg, #0f0f1e 0%, #1a1a3e 100%)',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
          }}>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 900, marginBottom: 12 }}>부모 PIN</h2>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={settingsPin}
              onChange={e => setSettingsPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => { if (e.key === 'Enter') void submitSettingsPin() }}
              style={{
                width: '100%', borderRadius: 12, border: '1px solid rgba(255,255,255,0.28)',
                background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 24,
                padding: '10px 12px', textAlign: 'center', letterSpacing: 8, outline: 'none',
              }}
            />
            {settingsPinError && <p style={{ color: '#ff8a80', fontSize: 13, marginTop: 8 }}>{settingsPinError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => { setSettingsPinOpen(false); setSettingsPin('') }} style={{
                flex: 1, borderRadius: 10, border: '1px solid rgba(255,255,255,0.25)',
                background: 'transparent', color: 'rgba(255,255,255,0.85)', padding: 10, cursor: 'pointer',
              }}>취소</button>
              <button type="button" onClick={() => void submitSettingsPin()} disabled={settingsPinSubmitting} style={{
                flex: 1, borderRadius: 10, border: 'none',
                background: '#E8001C', color: '#fff', padding: 10,
                cursor: settingsPinSubmitting ? 'wait' : 'pointer', fontWeight: 800,
              }}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
