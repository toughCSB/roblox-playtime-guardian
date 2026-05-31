# My Pact — 프로젝트 스펙

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
roblox-playtime-guardian/
├── src/
│   ├── main/               # Electron main process
│   │   ├── main.ts         # 트레이, 창, 타이머, Roblox 감지/종료
│   │   ├── ipc.ts          # IPC 핸들러 (설정, 세션, 관리자 PIN)
│   │   ├── adminAuth.ts    # main-process 관리자 세션
│   │   └── fileStore.ts    # ProgramData JSON 읽기/쓰기
│   ├── preload/            # 안전한 renderer API 노출
│   └── renderer/src/       # React UI (Vite)
│       ├── App.tsx
│       └── pages/
│           ├── Timer.tsx
│           ├── Settings.tsx
│           └── AdminPanel.tsx
├── build/installer.nsh     # NSIS 커스텀 설치/ACL/자동시작
├── resources/              # 아이콘, watchdog 스크립트
├── tests/                  # Vitest 정책 테스트
├── PRD/                    # 이 문서들
├── package.json
└── electron.vite.config.ts
```

---

## 데이터 저장 경로

```
%ProgramData%\MyPact\
├── settings.json
├── Admin\
│   └── admin-secret.json
└── Data\
    ├── sessions.json
    ├── timer-state.json
    └── daily-usage.json
```

- Windows: `%ProgramData%\MyPact\`
- 설정 파일과 `Data\` 런타임 파일은 표준 사용자 읽기 전용, 관리자/SYSTEM 쓰기 가능
- 표준 사용자 세션에서 상태 저장이 실패해도 실행 중인 타이머 집행은 메모리 상태로 계속 진행
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
- [ ] 경고 팝업은 4초 후 자동으로 코너 위치로 복귀
- [ ] 시간 표시는 MM:SS 또는 HH:MM:SS 형식으로 명확하게
- [ ] 강제 종료 전 30초 경고와 10초 중앙 카운트다운 표시
- [ ] sessions.json append 시 uuid 자동 생성

---

## 테스트 방법

```bash
# Electron 앱 개발 모드 실행
npm install
npm run dev

# 정책 헬퍼 테스트
npm test

# 타입 체크
npm run typecheck

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
    for (const imageName of ['RobloxPlayer.exe', 'RobloxPlayerBeta.exe']) {
      exec(`taskkill /F /IM ${imageName}`)
    }
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

- [x] 앱 자동 시작: Windows HKLM Run + Scheduled Task 등록
- [x] 트레이 아이콘: 앱 닫아도 트레이에서 타이머 확인 가능
- [x] 부모 설정 PIN 보호: main-process 관리자 세션으로 설정 변경 보호
