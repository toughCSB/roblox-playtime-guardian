import { useState } from 'react'
import Timer from './pages/Timer'
import Settings from './pages/Settings'
import AdminPanel from './pages/AdminPanel'

type Page = 'timer' | 'settings'

const isAdminWindow = window.location.hash === '#admin'

export default function App() {
  const [page, setPage] = useState<Page>('timer')

  if (isAdminWindow) {
    return <AdminPanel />
  }

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
