import { useState } from 'react'
import Timer from './pages/Timer'
import Settings from './pages/Settings'

type Page = 'timer' | 'settings'

export default function App() {
  const [page, setPage] = useState<Page>('timer')

  return (
    <div className="h-screen w-screen overflow-hidden">
      {page === 'timer' ? (
        <Timer onOpenSettings={() => setPage('settings')} />
      ) : (
        <Settings onBack={() => setPage('timer')} />
      )}
    </div>
  )
}
