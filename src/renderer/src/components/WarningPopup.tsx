import { useEffect, useRef } from 'react'

interface Props {
  minutesLeft: number  // 0 = 15초 경고
  onClose: () => void
}

export default function WarningPopup({ minutesLeft, onClose }: Props) {
  const onCloseRef = useRef(onClose)

  // 3초 후 자동 소멸 — ref로 onClose 캡처해서 tick 재렌더링에 영향받지 않음
  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), 3000)
    return () => clearTimeout(timer)
  }, [])

  const message =
    minutesLeft === 0
      ? '⏰ 15초 남았어!'
      : `⚠️ ${minutesLeft}분 남았어!`

  const subMessage = '약속 기억하지? My Pact!'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl shadow-2xl px-8 py-6 mx-6 relative max-w-xs w-full">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
        >
          ×
        </button>
        <div className="text-center">
          <p className="text-2xl font-bold text-indigo-700 mb-1">{message}</p>
          <p className="text-gray-500 text-sm">{subMessage}</p>
        </div>
      </div>
    </div>
  )
}
