import { useState, useEffect } from 'react'
import type { Settings } from '../../../shared/types'

interface Props {
  onBack: () => void
}

export default function SettingsPage({ onBack }: Props) {
  const [settings, setSettings] = useState<Settings>({
    weekdayLimit: 30,
    weekendLimit: 60,
    allowedStartHour: 16,
    allowedEndHour: 21,
    updatedAt: new Date().toISOString(),
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const api = window.api
    if (!api) return
    api.readSettings().then(setSettings)
  }, [])

  const handleSave = async () => {
    const api = window.api
    if (!api) return
    try {
      await api.writeSettings({ ...settings, updatedAt: new Date().toISOString() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('저장에 실패했어요. 다시 시도해 주세요.')
      setTimeout(() => setError(''), 3000)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-blue-50 to-indigo-100 rounded-2xl shadow-2xl">
      {/* 헤더 — 드래그 핸들 */}
      <div className="app-drag flex items-center gap-3 px-6 pt-6 pb-4 border-b border-indigo-100">
        <button onClick={onBack} className="no-drag text-indigo-600 hover:text-indigo-800 font-medium">
          ← 돌아가기
        </button>
        <h2 className="text-xl font-bold text-gray-800">게임 시간 설정</h2>
      </div>

      <div className="flex flex-col gap-5 flex-1 overflow-y-auto px-6 py-5">
        <label className="flex flex-col gap-1">
          <span className="text-gray-600 font-medium">평일 허용 시간</span>
          <div className="flex items-center gap-2">
            <input
              type="number" min={5} max={240}
              value={settings.weekdayLimit}
              onChange={(e) => setSettings((s) => ({ ...s, weekdayLimit: Number(e.target.value) }))}
              className="no-drag border border-gray-300 rounded-xl px-4 py-2 w-24 text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
            <span className="text-gray-500">분</span>
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-gray-600 font-medium">주말 허용 시간</span>
          <div className="flex items-center gap-2">
            <input
              type="number" min={5} max={480}
              value={settings.weekendLimit}
              onChange={(e) => setSettings((s) => ({ ...s, weekendLimit: Number(e.target.value) }))}
              className="no-drag border border-gray-300 rounded-xl px-4 py-2 w-24 text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
            <span className="text-gray-500">분</span>
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-gray-600 font-medium">게임 시작 가능 시각 (이후)</span>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={23}
              value={settings.allowedStartHour}
              onChange={(e) => setSettings((s) => ({ ...s, allowedStartHour: Number(e.target.value) }))}
              className="no-drag border border-gray-300 rounded-xl px-4 py-2 w-24 text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
            <span className="text-gray-500">시</span>
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-gray-600 font-medium">게임 종료 시각 (이전)</span>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={23}
              value={settings.allowedEndHour}
              onChange={(e) => setSettings((s) => ({ ...s, allowedEndHour: Number(e.target.value) }))}
              className="no-drag border border-gray-300 rounded-xl px-4 py-2 w-24 text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
            <span className="text-gray-500">시</span>
          </div>
        </label>
      </div>

      <div className="flex flex-col gap-2 px-6 pb-6">
        {saved && <p className="text-green-600 text-sm text-center font-medium">✓ 저장됐어요!</p>}
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        <button
          onClick={handleSave}
          className="no-drag bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl py-4 text-lg transition-all active:scale-95"
        >
          저장
        </button>
      </div>
    </div>
  )
}
