# My Pact for My Future — 프로젝트 스펙

> AI가 코드를 짤 때 지켜야 할 규칙과 절대 하면 안 되는 것.
> 이 문서를 AI에게 항상 함께 공유하세요.

---

## 기술 스택

### Electron 앱 (타이머 코어)

| 영역 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Electron 30+ | 로블록스 프로세스 제어 + 로컬 파일 I/O 가능한 유일한 방식 |
| 언어 | TypeScript | 타입 안전성, AI 코딩 품질 향상 |
| UI | React 18 + Vite | 생태계 풍부, AI 코딩 지원 최고 |
| 스타일 | Tailwind CSS | 빠른 UI 구성 |
| 로컬 저장 | Node.js fs (JSON) | 서버 불필요, 설치 즉시 동작 |
| 프로세스 제어 | Node.js child_process | pkill (macOS) / taskkill (Windows) |

### 웹 대시보드

| 영역 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Next.js 15 (App Router) | 로컬 파일 읽기 API 라우트 지원, 추후 Vercel 배포 가능 |
| 스타일 | Tailwind CSS | Electron 앱과 동일 스타일 시스템 |
| 그래프 | Recharts | React 친화적, 설치 간단 |
| 데이터 소스 | 로컬 JSON 파일 (fs 읽기) | 별도 DB/서버 불필요 |

---

## 프로젝트 구조

```
my-pact-for-my-future/
├── electron-app/           # Electron 타이머 앱
│   ├── src/
│   │   ├── main/           # Electron main process
│   │   │   ├── main.ts     # 앱 진입점, 창 생성
│   │   │   ├── ipc.ts      # IPC 핸들러 (파일 I/O, 프로세스 제어)
│   │   │   └── fileStore.ts # settings.json, sessions.json 읽기/쓰기
│   │   └── renderer/       # React UI (Vite)
│   │       ├── App.tsx
│   │       ├── pages/
│   │       │   ├── Timer.tsx    # 메인 타이머 화면
│   │       │   └── Settings.tsx # 설정 화면
│   │       └── components/
│   │           └── WarningPopup.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── dashboard/              # Next.js 웹 대시보드
│   ├── app/
│   │   ├── page.tsx        # 오늘 현황
│   │   ├── settings/
│   │   │   └── page.tsx    # 설정 관리
│   │   └── api/
│   │       ├── sessions/
│   │       │   └── route.ts # sessions.json 읽기
│   │       └── settings/
│   │           └── route.ts # settings.json 읽기/쓰기
│   ├── components/
│   │   └── WeeklyChart.tsx  # Recharts 주간 바 그래프
│   └── package.json
│
├── PRD/                    # 이 문서들
└── 01-idea-brief.md
```

---

## 데이터 저장 경로

```
~/.mypact/
├── settings.json
└── sessions.json
```

- macOS: `/Users/{username}/.mypact/`
- Windows: `C:\Users\{username}\.mypact\`
- 앱 최초 실행 시 폴더 자동 생성

---

## 절대 하지 마 (DO NOT)

- [ ] 타이머를 `setInterval`만으로 구현하지 마 — `Date.now()` 기반 경과 시간 계산 사용 (드리프트 방지)
- [ ] sessions.json 전체를 매 tick마다 쓰지 마 — 세션 종료 시에만 append
- [ ] Roblox 프로세스 이름을 하드코딩하지 마 — 플랫폼별 분기 처리 (`process.platform`)
- [ ] IPC 없이 renderer에서 직접 fs를 호출하지 마 — main process의 IPC 핸들러를 통해서만
- [ ] settings.json을 덮어쓰기 전 백업 없이 쓰지 마 — write 실패 시 복구 가능하게
- [ ] 타이머 카운트다운을 화면에서 벗어나도 멈추게 하지 마 — 백그라운드 동작 필수
- [ ] API 키나 비밀번호를 코드에 직접 쓰지 마 (현재 없지만, 추후 Supabase 연동 시)
- [ ] 목업/하드코딩 데이터로 완성이라고 하지 마

---

## 항상 해 (ALWAYS DO)

- [ ] 변경하기 전에 계획을 먼저 보여줘
- [ ] 파일 읽기 실패 시 기본값으로 폴백 (weekdayLimit: 30, weekendLimit: 60)
- [ ] 경고 팝업은 사용자가 닫을 수 있게 하되, 3초 후 자동 소멸도 지원
- [ ] 시간 표시는 MM:SS 또는 HH:MM:SS 형식으로 명확하게
- [ ] 강제 종료 전 마지막 경고 팝업 (15초) 표시 후 카운트다운
- [ ] sessions.json append 시 uuid 자동 생성

---

## 테스트 방법

```bash
# Electron 앱 개발 모드 실행
cd electron-app
npm install
npm run dev

# 웹 대시보드 개발 모드 실행
cd dashboard
npm install
npm run dev
# http://localhost:3000

# 타입 체크
npx tsc --noEmit

# Electron 앱 빌드
npm run build
```

---

## Roblox 프로세스 종료 구현 가이드

```typescript
import { exec } from 'child_process'

function killRoblox() {
  if (process.platform === 'darwin') {
    // macOS
    exec('pkill -x "Roblox"', (err) => {
      if (err) console.log('Roblox not running or already closed')
    })
  } else if (process.platform === 'win32') {
    // Windows
    exec('taskkill /F /IM RobloxPlayerBeta.exe', (err) => {
      if (err) console.log('Roblox not running or already closed')
    })
  }
}
```

---

## 환경변수

현재 없음 (로컬 파일 기반, 서버 불필요).
추후 Supabase 연동 시:

| 변수명 | 설명 | 어디서 발급 |
|--------|------|------------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase 프로젝트 URL | supabase.com 대시보드 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 공개 API 키 | supabase.com 대시보드 |

---

## [NEEDS CLARIFICATION]

- [ ] 앱 자동 시작: 부팅 시 Electron 앱 자동 실행 여부 (Login Item 등록)
- [ ] 트레이 아이콘: 앱 닫아도 트레이에서 타이머 확인 가능 여부
- [ ] 부모 설정 PIN 보호: 자녀가 설정을 바꾸는 것을 막을 PIN 필요 여부
