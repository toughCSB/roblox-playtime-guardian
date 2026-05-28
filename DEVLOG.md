# My Pact for My Future - 개발 로그

AI 코딩 도구와 함께 진행한 개발 작업 기록입니다.

---

## 2026-05-23 (Day 1)

### 1. Claude Code alias 세팅

```
alias 세팅했잖아...작동이 전혀 안되고 있어 ..ccd, ccr
```

**Claude Code 작업:**
- `~/.zshrc`에 alias 두 개 추가
  - `ccd` = `claude --dangerously-skip-permissions` (권한 프롬프트 없이 실행)
  - `ccr` = `claude --resume --dangerously-skip-permissions` (이전 대화 이어받기 + 권한 생략)
- 어느 디렉토리에서든 글로벌로 동작하도록 설정

---

## 2026-05-24 (Day 2)

### 1. 기획 — 아이디어 인터뷰 (10라운드)

**[기획 Q&A]**

| 질문 | 선택 |
|------|------|
| 오늘 어디서 시작할까요? | 처음부터 |
| 아이디어를 어떤 자료에서 시작할까요? | 예시에서 고르기 |
| 어떤 유형의 웹앱을 만들고 싶으세요? | **자녀의 로블록스 게임 시간을 관리하고 통제하는 앱** (직접 입력) |
| 이 앱은 주로 누가 쓰게 될까요? | 둘 다 (부모가 설정 → 자녀 화면으로 표시) |
| 로블록스 관리에서 가장 잘 안 되는 부분? | 약속한 시간을 지키지 않음 |
| 이 앱을 주로 언제 쓰게 될까요? | 전체 흐름 (시작-알림-종료) |
| 첫 화면 핵심 행동? | 시간 세팅 + 타이머 표시 + 경고 알림 + 강제 종료 + 대시보드 (직접 입력) |
| 부모가 입력하는 값? | 하루 허용 시간 / 요일별 다른 시간 / 시작 시간 제한 |
| MVP 기능 TOP 3? | 허용 시간 설정 / 카운트다운 타이머 / 5분·1분·15초 경고 팝업 |
| 앱 형식? | Electron 데스크탑 앱 (게임 오버레이 + 강제 종료 필요) |

---

### 2. 기획 — PRD 및 범위 확정

**[기획 Q&A]**

| 질문 | 선택 |
|------|------|
| 데이터 공유 방식? | 같은 PC에서만 (로컬 JSON 파일) |
| 기능 조합? | 풀 (Phase 1+2+3 — 타이머 + 대시보드 + 주간/월간 통계) |
| 로컬 JSON 파일 구조 확인 | 좋아요 |
| Phase 분리 계획? | 좋아요 |
| 기술 스택? | Electron + React + Vite |
| 오늘 완성할 범위? | Phase 1만 (Electron 타이머 앱) |
| 코드 검토? | 네, 검토해주세요 |
| 팀 구성 시작? | 네, 시작해주세요 |

**Claude Code 작업:**
- `01-idea-brief.md` — 앱 개요, 사용자, 문제, 완료 기준 정리
- `PRD/01_PRD.md` — 기능 명세 작성
- `PRD/02_DATA_MODEL.md` — 로컬 JSON 데이터 구조 설계
- `PRD/03_PHASES.md` — Phase 1/2/3 단계별 구현 계획
- `PRD/04_PROJECT_SPEC.md` — 기술 스택 및 빌드 설정

---

### 3. Electron 앱 초기 세팅 및 기본 화면 구현

**Claude Code 작업:**
- `electron-app/` 프로젝트 초기화 (electron-vite + React + TypeScript + Tailwind)
- `src/main/main.ts` — Electron 메인 프로세스 (창 생성, IPC 통신)
- `src/main/fileStore.ts` — 로컬 JSON 파일 I/O (설정 저장/불러오기, 게임 세션 기록)
- `src/main/ipc.ts` — IPC 핸들러 (타이머 이벤트, 경고, Roblox 프로세스 종료)
- `src/renderer/src/pages/Settings.tsx` — 부모 설정 화면 (요일별 허용 시간, 시작 가능 시간대)
- `src/renderer/src/pages/Timer.tsx` — 자녀 타이머 화면
- `src/renderer/src/components/WarningPopup.tsx` — 경고 팝업 컴포넌트

---

### 4. 버그 수정 — 화면 깨짐, 포트 미스매치

```
실제 사용할 타이머 화면을 보여줘야하는거 아냐?? 저런 화면이 게임 중간에 뜨면 화면이 가려서 아들이 엄청 화낼꺼 같은데? 오버레이 화면으로 반투명으로 띄우기로 했었잖아!!
```

**Claude Code 작업:**
- DevTools 자동 실행(`openDevTools()`) 제거 → 화면 절반 잠식 문제 해결
- `localhost:5173` 하드코딩 → `ELECTRON_RENDERER_URL` 환경변수로 교체 → Vite 포트 변경 시 연결 끊김 문제 해결
- `WarningPopup`의 `useEffect` 재실행 버그 수정 → 3초 타이머가 계속 리셋되던 문제 해결

---

### 5. 오버레이 위젯 구현 — FPS 카운터 스타일

```
오버레이 타이머 화면이 더 작고 숫자만 보여줘야해. 그리고 정지 화면이 있으면 안되잖아. 아들이 멋대로 정지를 하는게 말이 안되잖아. 좀더 투명하게 해주고....게임에서 FPS 오버레이 화면처럼 숫자만 반투명으로 보여지는게 좋을꺼 같아
```

**Claude Code 작업:**
- 창 설정: `transparent: true, frame: false, alwaysOnTop` 적용
- 타이머 실행 중 → 창 크기 220×80으로 축소, 화면 우상단 고정
- 정지 버튼 제거 (자녀가 임의로 멈출 수 없도록)
- 배경 제거, 숫자만 반투명으로 표시

---

### 6. 전자시계 폰트(DSEG7) 적용 및 가독성 개선

```
폰트를 전자시계 폰트로 해줘봐. 그리고 박스 배경은 더 투명해야해...
```

**Claude Code 작업:**
- DSEG7 Classic 폰트 다운로드 및 내장 (`@font-face` 등록)
- 배경 투명도 50% → 28% 감소
- 색상별 네온 글로우 효과 (정상 초록 → 5분 전 노랑 → 3분 전 주황 → 1분 이하 빨강)

```
가로 선이 여전히 숫자를 따라서 울퉁불퉁해...
```

- 박스 고정 높이 34px 적용 → 숫자와 무관하게 직사각형 유지

---

### 7. 경고 팝업 — 화면 중앙 이동 + 카운트다운 + Roblox 강제 종료

```
실제 구동은...원래 오버레이 화면은 우측 상단에 떠있게 해주고...해당 경고 시간이 되면, 화면이 정 가운데로 이동해서 4초간 보여지고 다시 원 위치로 돌아가서, 지금 경고로 인해 변경된 색상이 유지되는 카운터로 돌아가도록 해줘. 그리고 15초를 30초로 탐았어..로 변경해주고...10초부터는 화면 가운데서 카운트다운 해주고 ...게임 셧다운....메시지와 함께 실제 게임이 셧다운되는 걸로 최종 세팅해줘
```

**Claude Code 작업:**
- 타이머 동작 흐름 완성:

| 시점 | 창 위치 | 표시 내용 | 지속 |
|------|---------|----------|------|
| 타이머 시작 | 우측 상단 (172×72) | 초록 숫자 카운터 | 계속 |
| 5분 / 3분 / 30초 경고 | 화면 중앙 (320×140) | 경고 메시지 + 큰 타이머 | 4초 후 우상단 복귀 |
| 10초부터 | 화면 중앙 | 빨간 카운트다운 | 0까지 |
| 0초 | 화면 중앙 | "게임 셧다운..." | Roblox 강제 종료 |

- `ipc.ts` — `roblox:kill` IPC 핸들러 (macOS: `killall`, Windows: `taskkill` 두 프로세스명 시도)

---

### 8. Windows 11 호환성 체크

**Claude Code 작업:**
- `fileStore.ts` — `os.homedir() + path.join()` 크로스플랫폼 경로 적용 확인
- `transparent: true` + `backgroundColor` 명시 (Windows 투명창 지원)
- Roblox 프로세스명 양쪽 시도: `RobloxPlayer.exe` + `RobloxPlayerBeta.exe`
- `package.json` — `electron-builder` Windows `.exe` 빌드 설정 추가

---

### 9. 주황색 가시성 개선 및 첫 커밋

```
밝은 화면에서는 주황색 불빛이 가시성에 많이 떨어지네. 좀만 더 진한 색으로 해주고...일단 현재상태까지 커밋해줘봐
```

**Claude Code 작업:**
- 주황색 `#ff9100` → `#ff6600` (밝은 배경에서 가시성 향상)
- git init + 첫 커밋

---

---

## 2026-05-27 (Day 3)

### 1. UI 전면 리디자인 — 로블록스 테마

```
UI 디자인 — Roblox 테마 전면 적용. 아이가 거부감 없이 앱을 자연스럽게 받아들이도록 로블록스 브랜딩과 일치시킴
```

**Claude Code 작업:**
- 배경: 하늘색 그라데이션 (`#4FC3F7 → #0288D1`)
- 타이틀: `Black Han Sans` 폰트 40px "나와의 서약" + "My Pact for My Future" 서브타이틀
- 시작 버튼: 로블록스 레드 그라데이션 (`#FF2233 → #AA0012`)
- 하단: `roblox-characters.jpg` 캐릭터 이미지

---

### 2. Roblox 자동 감지 + 타이머 자동 시작

```
로블록스가 실행되면 타이머 앱을 직접 실행하지 않아도 타이머가 자동으로 작동하게 해줘. 아이가 앱을 숨기더라도.
```

**Claude Code 작업:**
- `main.ts`: 3초마다 `tasklist`로 `RobloxPlayer(Beta).exe` 실행 여부 폴링
- 로블록스 감지 → 허용 시간대 확인 → 타이머 자동 시작 + 배너 표시
- 로블록스 종료 → 타이머 자동 중지 및 대기 화면 복귀
- 허용 시간 외 로블록스 실행 시: `killRoblox()` 즉시 호출

---

### 3. 시스템 트레이 상시 유지 + 종료 방지

```
아이가 작업 표시줄에서 앱을 찾아 종료하는 경로 차단해줘
```

**Claude Code 작업:**
- `skipTaskbar: true` — 작업 표시줄에 아이콘 없음
- 창 닫기(X버튼 / Alt+F4) → 앱 종료 대신 트레이로 숨김
- 트레이 메뉴에 종료 버튼 없음
- 트레이 단일 클릭 → 메인 창 표시

---

### 4. 관리자 PIN 패널 (트레이 3연타)

```
모든 관리자 기능을 비밀번호로 잠가줘. 부모만 트레이 아이콘을 1.5초 안에 3번 클릭하면 PIN 입력 창이 열리게 해줘
```

**Claude Code 작업:**
- 트레이 3클릭(1.5초 이내) → 관리자 PIN 패널 오픈
- PIN 패드 UI (4자리, 점 4개 표시)
- 타이머 조정 (+15분/+30분/+60분)
- 타이머 강제 중지
- 재부팅 복원 토글
- 비밀번호 변경 (SHA-256 해시 저장)
- 5회 오입력 시 30초 잠금 / 물리 키보드 지원
- 초기 비밀번호: `0000`

---

### 5. 재부팅 후 타이머 자동 복원

```
아이가 타이머를 피하기 위해 컴퓨터를 강제 재시작하는 상황을 방지해줘
```

**Claude Code 작업:**
- 타이머 시작 시 `~/.mypact/timer-state.json`에 시작 시각·제한 시간·날짜 저장
- 앱 재시작 시 당일 유효한 타이머 상태가 있으면 남은 시간부터 자동 재개
- 날짜가 다르면(자정 이후) 자동 파기
- `resumeTimerOnRestart` 설정으로 ON/OFF 가능

---

## 2026-05-28 (Day 4)

### 1. GitHub Release + 스크린샷 제작

```
실제 설치할 exe 파일도 깃허브에 같이 릴리즈 해줘
```

**Claude Code 작업:**
- Playwright + React Fiber 주입으로 앱 각 상태 스크린샷 자동 촬영
  - 메인 화면, 설정 화면, 타이머 색상 4종, 경고 팝업, 카운트다운
- `npm run package:win` → NSIS 인스톨러 `.exe` 빌드
- GitHub Release v0.3.1 생성 및 exe 첨부

---

### 2. 작업 관리자 강제 종료 방지 + 앱 삭제 방지

```
작업관리자에서 앱 강제 종료 못하는거 맞아? 앱 삭제도 임의로 못하도록도 추가 패치해줘
```

**Claude Code 작업:**
- NSIS `customInstall`: `schtasks /rl HIGHEST`로 로그온 시 HIGHEST 권한 앱 등록
  → 표준 사용자는 작업 관리자에서 높은 권한 프로세스 종료 불가
- NSIS `customUnInit`: 제거 전 PowerShell VBInputBox로 부모 PIN 입력 요구
  → 틀리거나 취소 시 파일 삭제 없이 완전 차단
- `ipc.ts`: PIN 변경 시 `HKLM\Software\MyPact\UninstallPin` 레지스트리 자동 동기화

---

### 3. 실제 설치 후 문제 발견 — 자녀 표준 계정에서 자동 시작 안 됨

```
자녀 계정에서는 앱이 자동 시작되지 않고, 심지어 수동으로 실행해도 앱이 제대로 시작되지 않습니다
```

**원인 분석:**
- `schtasks` without `/ru` → admin 계정 컨텍스트로만 실행됨
- 자녀 세션에선 앱이 invisible (다른 세션에서 실행)

**Claude Code 작업:**
- `installer.nsh`: `HKLM\Run` 추가 → 모든 사용자 로그온 시 각자 세션에서 자동 시작
- `resources/watch-loop.ps1`: 앱 자체 세션에서 스폰하는 30초 루프 워치독
- `main.ts`: `spawnWatchdog()` — 앱이 직접 자기 세션에 워치독 스폰

---

### 4. 부팅 시 메인 화면 노출 → 트레이 숨김으로 변경

```
컴퓨터를 부팅하면 앱이 화면 가운데 뜨지 않고, 시스템 트레이에 숨어 있도록 수정해 주세요. 게임이 시작되면 즉시 타이머가 실행되도록.
```

**Claude Code 작업:**
- `main.ts`: `show: false`로 창 생성 → 부팅 시 트레이에만 상주
- `tryResumeTimer()` boolean 반환 — 타이머 없으면 `hide()`
- Roblox 감지 시만 코너 타이머 표시, 그 외 모두 트레이 상주

---

### 5. 앱 이름 변경 (나의 약속 → My Pact for My Future)

```
앱 이름을.."나의 약속"이라고 되어있는거 고쳐! My Pact for My future 라고 했잖아.
```

**Claude Code 작업:**
- `package.json`: productName / shortcutName / uninstallDisplayName 전부 변경
- exe 파일명: `나의 약속.exe` → `My Pact for My Future.exe`
- NSIS schtasks 명령어 내 exe 경로 업데이트

---

### 6. 게임 종료 시 타이머 리셋 버그 수정

```
게임을 시작한 지 10분 만에 종료하고 나중에 다시 실행하면, 타이머가 이전 시간을 유지하지 못하고 다시 60분으로 돌아가고 있습니다.
```

**원인 분석:**
- `onRobloxClosed` → `api.stopTimer()` → `clearTimerState()` 호출로 상태 파일 삭제
- Roblox 재실행 시 저장된 잔여 시간 없음 → 60분 신규 타이머 시작

**Claude Code 작업:**
- `TimerState`에 `pausedRemainingMs` 필드 추가
- `timer:pause` IPC 신설: 잔여 시간을 파일에 저장 후 인터벌만 정지
- `timer:start` IPC 수정: `pausedRemainingMs` 감지 시 해당 시간으로 재개
- `onRobloxClosed`: `stopTimer()` → `pauseTimer()` 변경
- 결과: 10분 플레이 후 종료 → 재실행 시 50분 이어서 시작

---

## 커밋 히스토리

| 날짜 | 커밋 | 설명 |
|------|------|------|
| 05/24 | `81f2573` | 기능: My Pact for My Future — 로블록스 타이머 앱 초기 구현 |
| 05/27 | `8967860` | 기능: v0.3.0 — 관리자 PIN 패널, Roblox 자동 감지, 재부팅 타이머 복원, UI 리디자인 |
| 05/28 | `ccb40b3` | 기능: v0.3.1 — 작업관리자 종료방지, 앱 삭제방지, HD 해상도 호환 |
| 05/28 | `890108b` | 기능: v0.3.1 최종 릴리즈 — 기본값·UI·README 정비 |
| 05/28 | `4ed2f64` | 수정: 앱 이름 변경 + 워치독 추가 + NSIS exe 경로 수정 |
| 05/28 | `30df099` | 수정: 자녀 표준계정 자동시작·트레이 숨김·인프로세스 워치독 |
| 05/28 | `340f1fa` | 수정: 로블록스 종료 시 타이머 일시정지 (stopTimer → pauseTimer) |

---

## 기술 스택

- **Runtime**: Electron + React + Vite + TypeScript
- **UI**: Tailwind CSS, DSEG7 Classic (전자시계 폰트)
- **Data**: 로컬 JSON 파일 (`os.homedir()` 기반 크로스플랫폼)
- **Package Manager**: Bun
- **Build**: electron-vite + electron-builder (Windows `.exe` 타겟)
- **개발 환경**: macOS (떡배님) → 배포 타겟: Windows 11 (아들 PC)

---

## 주요 기능

1. **허용 시간 설정**
   - 하루 허용 시간, 요일별 다른 시간, 게임 시작 가능 시간대 입력

2. **FPS 카운터 스타일 오버레이 타이머**
   - 우측 상단에 반투명으로 표시, DSEG7 전자시계 폰트
   - 잔여 시간에 따라 색상 변환 (초록 → 노랑 → 주황 → 빨강)
   - 자녀가 임의로 정지할 수 없음

3. **경고 팝업 — 화면 중앙 이동**
   - 5분·3분·30초 전: 중앙으로 이동 → 4초 표시 → 복귀
   - 10초부터 0초까지: 중앙에서 카운트다운 유지

4. **Roblox 강제 종료**
   - 타이머 만료 시 "게임 셧다운..." 메시지 후 Roblox 프로세스 종료

5. **게임 세션 기록**
   - 플레이 시간 로컬 JSON 저장 (주간/월간 통계 대시보드용)

6. **Windows 11 호환성**
   - 크로스플랫폼 경로, 투명창 설정, Roblox 프로세스명 다중 대응
