# Changelog

모든 주요 변경 사항을 이 파일에 기록합니다.  
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)을 따르며, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

---

## [Unreleased]

---

## [0.60.6] — 2026-06-02

### 보안/하드닝
- Electron을 `42.3.0`으로 올려 런타임 보안 권고 항목을 해소했습니다.
- electron-builder를 `26.8.1`, electron-vite를 `5.0.0`, Vite를 `7.3.5`, Vitest를 `4.1.8`로 올렸습니다.
- 런타임 `uuid` 의존성을 제거하고 Node 내장 `crypto.randomUUID()`를 사용하도록 변경했습니다.
- stale `bun.lock`을 제거하고 npm lockfile 기준으로 정리했습니다.

### 수정
- `daily:get-remaining`에서 정규화된 사용량 저장이 실패해도 복구된 결과는 UI에 반환하도록 방어했습니다.
- 메인 화면 버전 문자열을 `package.json` 버전에서 빌드 시 자동 주입하도록 수정했습니다.
- electron-vite 5 타입 정의에 맞게 main/preload entry 설정을 정리했습니다.

### 테스트
- daily-usage 정규화 저장 필요 여부 helper의 회귀 테스트를 추가했습니다.
- `npm test`, `npm run typecheck`, `npm run build`, `npm audit`, `npm run package:win`을 통과했습니다.

### 빌드/릴리스
- 버전을 `0.60.6`으로 올렸습니다.
- 릴리즈: https://github.com/toughCSB/roblox-playtime-guardian/releases/tag/v0.60.6
- 최종 검증 설치본: `My Pact Setup 0.60.6.exe`
- SHA256: `61BA370504B780396BA0C277E48782D8418FB1117FA9F9CA4A96880ADA1AD0C5`

---

## [0.60.5] — 2026-06-01

### 수정
- 패키징된 앱이 플래그 없이 자동 실행되어도 메인 화면을 띄우지 않고 시스템 트레이에만 남도록 시작 표시 정책을 보강했습니다.
- `daily-usage.json`이 없거나 오래된 상태여도 `sessions.json` 완료 기록을 함께 사용해 당일 세션 소진 여부를 복구하도록 수정했습니다.
- 재부팅 후 평일 60분 × 2회 사용 기록이 0회처럼 보이며 3회차 실행이 가능해질 수 있는 경로를 차단했습니다.

### 테스트
- 패키징 앱의 무인자 자동 실행이 숨김 시작으로 처리되는 회귀 테스트를 추가했습니다.
- 당일 완료 세션 수를 세션 기록에서 복구하는 회귀 테스트를 추가했습니다.

### 빌드/릴리스
- 버전을 `0.60.5`로 올렸습니다.
- 불필요한 GitHub Actions Windows 빌드 워크플로우를 제거했습니다.
- 릴리즈: https://github.com/toughCSB/roblox-playtime-guardian/releases/tag/v0.60.5
- 최종 검증 설치본: `My Pact Setup 0.60.5.exe`
- SHA256: `17177D9178E1039C0176AB4EDF99FD20DA561C33CAE6725D3E7526307C9EF501`

---

## [0.60.0] — 2026-05-31

### 추가
- 최초 코드리뷰 항목 기준으로 현재 조치 완료/후속 과제를 README에 정리했습니다.
- `src/shared/robloxSync.ts`와 `tests/robloxSync.test.mjs`를 추가해 Roblox 프로세스 유무와 타이머 시작/일시정지 정책을 테스트 가능하게 분리했습니다.
- `src/shared/startupVisibility.ts`와 `tests/startupVisibility.test.mjs`를 추가해 자동실행 숨김 시작과 수동 실행 창 표시 정책을 회귀 테스트로 고정했습니다.

### 수정
- 패키지 앱에서 Roblox가 실행 중이 아닌데 타이머가 시작되는 경로를 차단했습니다.
- 타이머 실행 중 Roblox 프로세스가 사라지면 2초 주기 확인으로 즉시 타이머를 일시정지하고 잔여 시간을 보존합니다.
- 타이머 실행 중 허용 종료 시간이 지나면 Roblox를 강제 종료하고 `outside-hours` 차단 메시지를 표시합니다.
- 앱 시작 시 Roblox가 이미 실행 중인 경우에도 허용 시간, 세션 쿼터, 부모 승인 정책을 검사하도록 했습니다.
- 부모 PIN 승인이 필요한 Roblox 실행을 차단할 때 원래 Roblox 실행 커맨드를 저장하고, 승인 성공 후 자동 재실행하도록 수정했습니다.
- 부모 승인 IPC 결과를 단순 boolean에서 구조화된 결과로 바꿔 승인 성공과 Roblox 재실행 여부를 구분합니다.
- 관리자 중지/앱 종료/만료 경로에서 Roblox 종료 처리를 보강했습니다.
- 트레이 아이콘 로딩 실패가 앱 시작 실패로 이어지지 않도록 icon 후보 탐색, `nativeImage.isEmpty()` 검증, fallback 아이콘, 예외 처리를 추가했습니다.
- `--start-hidden` 자동실행과 일반 수동 실행을 구분해 수동 실행 시 메인 창이 표시되도록 수정했습니다.

### 보안/하드닝
- 기본 PIN `0000`의 해시가 전체 SHA-256 값인지 검증하는 테스트를 유지합니다.
- watchdog disable flag를 `%ProgramData%\MyPact\Admin\watchdog-disabled.flag` 보호 경로 기준으로 통일했습니다.
- installer ACL에서 `Admin`은 표준 사용자 읽기/실행만 허용하고, `Data` 직접 변조 방지는 추후 Windows Service/SYSTEM 구조 개선 과제로 명시했습니다.

### 문서
- README에 v0.60.0 안정화 요약과 추가 개선 필요 사항을 추가했습니다.
- PIN 보안 하드닝, Data JSON 변조 방지, startup/watchdog 로그, `main.ts` 책임 분리 항목을 차기 과제로 정리했습니다.

### 빌드/릴리스
- 버전을 `0.60.0`으로 올렸습니다.
- Windows installer GitHub Actions가 `main` push와 `v*` 태그에서도 실행되도록 조정했습니다.
- 릴리즈: https://github.com/toughCSB/roblox-playtime-guardian/releases/tag/v0.60.0
- GitHub Actions tag build: `26714223299`
- 최종 검증 설치본: `My.Pact.Setup.0.60.0.exe`
- SHA256: `680e7051c1f9be6dd8dd48eb1d06e970ab36abadff9b7d44cd14a19d45d24d48`

---

## [0.50.1] — 2026-05-31

### 수정
- 관리자 비밀번호 변경 시 보호된 `admin-secret.json` 쓰기 권한 때문에 실패하던 문제를 수정했습니다.
- 비밀번호 변경 입력 3칸이 모두 4자리가 되는 순간 자동 변경을 시도하지 않고, `변경` 버튼 클릭 때만 실행되도록 수정했습니다.

### 보안/하드닝
- 보호된 관리자 PIN 파일 갱신이 필요할 때 사용자 쓰기 가능 임시 스크립트를 관리자 권한으로 실행하지 않고, PowerShell `-EncodedCommand` 경로로 승격 실행하도록 보강했습니다.

### 빌드/릴리스
- 최종 검증 설치본: `dist\My Pact Setup 0.50.1.exe`
- SHA256: `A4DD9984FC261DEF647D17E9A268F1D49FC23542B8B375F20903755F0F3F2786`

---

## [0.50.0] — 2026-05-31

### 추가
- 관리자 패널에서 실행 중 타이머를 `+5/+10/+15/+30/+60분` 추가하거나 `-5/-10/-15/-30/-60분` 차감할 수 있게 했습니다.
- 관리자 패널에 직접 입력 시간 조정(예: `25`, `-10`)을 추가했습니다.
- 설정 화면에 `앱 실행 종료 (워치독 종료)` 버튼을 추가했습니다.
- `resources/start-watch-loop.vbs`를 추가해 watchdog PowerShell을 숨김 실행하도록 했습니다.
- `tests/policy.test.mjs`에 정책/관리자 세션/시간 조정 검증 테스트를 추가했습니다.

### 수정
- 메인/설정 화면 우측 상단 최소화 버튼의 드래그 영역 충돌을 제거하고 트레이 숨김 IPC를 즉시 호출하도록 수정했습니다.
- 타이머 조정 IPC를 signed minute 방식으로 통합하고 main-process 관리자 세션 검증과 입력 검증을 적용했습니다.
- 관리자 패널에서 시간 변경 후 `메인`을 눌렀을 때 실행 중 타이머가 일반 메인창 크기/화면 중앙으로 복원되던 문제를 수정했습니다.
- 관리자 시간 변경 직후 이미 지난 경고 임계값 때문에 타이머가 다시 중앙 경고 팝업으로 이동하던 문제를 수정했습니다.
- watchdog 또는 작업 관리자 강제 종료 후 앱이 복구될 때 Roblox가 실행 중이 아니면 타이머가 자동으로 흐르지 않도록 수정했습니다.
- Windows 시작 시 이미 실행 중이던 Roblox를 새 실행으로 오탐해 타이머가 즉시 시작되는 문제를 baseline 처리로 완화했습니다.
- `atomicWrite()`가 Windows EPERM rename 실패 시 재시도/fallback을 수행하도록 보강했습니다.
- 설치/업데이트 시 기존 Run 키, Scheduled Task, watchdog 프로세스를 정리해 설치 실패와 중복 실행을 줄였습니다.
- 제거 시 watchdog disable flag를 먼저 작성하고 watchdog/app 프로세스를 정리하도록 보강했습니다.

### 보안/하드닝
- Renderer로 전달되는 설정에서 `adminPasswordHash`를 제거했습니다.
- 관리자 IPC는 main-process의 짧은 인증 세션을 요구하도록 변경했습니다.
- 설정 파일은 `%ProgramData%\MyPact\settings.json`, 런타임 파일은 `%ProgramData%\MyPact\Data\`로 분리했습니다.
- 작업 관리자 종료 방지 설명을 사용자 모드 Electron 구조의 한계에 맞게 조정했습니다.
- 관리자 PIN 원문을 `HKLM\Software\MyPact\UninstallPin`에 저장하지 않도록 제거하고, 언인스톨러가 보호된 `admin-secret.json` 해시로 검증하도록 변경했습니다.
- 표준 사용자 세션에서 `Data\` 쓰기가 실패해도 실행 중 쿼터/타이머 집행은 메모리 상태를 우선 사용하도록 보강했습니다.

### 빌드/릴리스
- 최종 검증 설치본: `dist\My Pact Setup 0.50.0.exe`
- SHA256: `3D4DC1D060638C042A1C5842EF1F75E1F0E77C04C9826BB05AA9C5D4ADAC26DA`
- 중복 `dist-*` 산출물은 정리하고 `.gitignore`에 생성 산출물 패턴을 추가했습니다.

---

## [0.4.0] — 2026-05-29

### 추가

#### 세션 횟수 설정 (XX분 × X회)
- **의도**: 하루에 여러 번 나눠서 플레이할 수 있도록 설정 — 예: 60분×2회, 30분×3회
- Settings에 `weekdaySessionCount` / `weekendSessionCount` 필드 추가
- 설정 화면: `[60] 분 × [2] 회` 입력 UI + 우측에 합계 분 실시간 표시
- 메인 화면 뱃지: `60분 × 2회` + `0/2회 완료` 세션 진행 표시

#### 데일리 세션 쿼터 관리 (`daily-usage.json`)
- **의도**: 하루 허용 세션이 모두 완료된 후 로블록스 재실행 차단
- `~/.mypact/daily-usage.json`: `{ sessionsCompleted, currentSessionRemainingMs }` 구조
- 타이머 만료(자연 종료) 시에만 세션 완료 카운트 증가
- 로블록스를 닫으면 현재 세션 잔여 시간 저장 → 재실행 시 이어서 재개
- 세션 완료 수 ≥ 설정 횟수이면 로블록스 감지 즉시 강제종료
- 자정이 지나면 당일 기록 리셋 → 새 날 새 쿼터 자동 적용
- 관리자 중지: 잔여 시간 보존 (나중에 이어서 플레이 가능)
- 관리자 시간 추가(+15/30/60분): `daily-usage` 잔여 시간에도 반영

### 수정

#### 경고 팝업 위치 (`main.ts`)
- **의도**: 경고 팝업이 화면 정중앙에 표시되면 게임 캐릭터·마우스를 가려 플레이 불가
- `getCenterInfo()` y 좌표: `(wh-h)/2` (정중앙) → `wh * 0.30` (화면 상단 30%)

#### 표준 계정 타이머 표시 버그 수정 (이슈 #4)
- **의도**: 자녀 계정 등 표준(비관리자) 계정에서 타이머가 `99999.9999` 등 이상값 표시
- `readSettings()`: 모든 수치 필드 `isFinite` + 범위 검증, 비정상 값은 기본값으로 교체
- `readTimerState()`: `limitMs` / `pausedRemainingMs` 비정상값(NaN, Infinity, 음수, 24h 초과) 차단
- `formatTime()` / `formatLimitDisplay()`: `isFinite` 가드 추가 — 비정상 입력 시 `--:--` 표시
- `timer:start` IPC: `limitMinutes` NaN/Infinity/음수 입력 방어

---

## [0.3.1] — 2026-05-28

### 추가

#### 앱 삭제 방지 (NSIS 언인스톨러 PIN 잠금)
- **의도**: 아이가 제어판/설정에서 앱을 직접 삭제하는 경로 차단
- 제거 시작 전(`un.onInit`) PowerShell VB InputBox로 부모 PIN 입력 요구
- PIN 불일치 또는 입력 취소 시 `Abort`로 파일 삭제 전 완전 차단
- 설치 시 초기 PIN `0000`을 `HKLM\Software\MyPact\UninstallPin` 레지스트리에 기록
- 관리자 PIN 변경 시 레지스트리 값도 자동 동기화 (`ipc.ts` → `reg add`)

#### 작업 관리자 강제 종료 방지 (NSIS Scheduled Task)
- **의도**: 아이가 작업 관리자에서 프로세스를 강제로 종료하는 경로 차단
- 설치 시 `schtasks /create /rl HIGHEST`로 로그온 시 HIGHEST 권한으로 앱 실행 등록
- 표준 사용자는 높은 권한 프로세스를 작업 관리자에서 종료 불가
- 제거 시 Scheduled Task 자동 삭제, 레지스트리 정리

### 변경

#### 프로젝트 구조 통합
- `electron-app/` 하위 디렉터리를 루트로 이전 — `cd electron-app` 없이 루트에서 `npm run dev` / `npm run package:win` 바로 실행 가능

#### 해상도 독립 레이아웃 (`Timer.tsx`)
- **의도**: HD 모니터(1920×1080)에서 빨간 시작 버튼·설정 버튼이 가려지는 문제 수정
- 캐릭터 이미지를 `position: absolute` → `flex: '1 1 0'` 으로 변경 — 콘텐츠 영역이 먼저 확보된 뒤 남은 공간을 채우는 방식
- 모든 콘텐츠 섹션에 `flexShrink: 0` 추가 — flex 압축으로 버튼이 밀리는 현상 방지
- `<p>` 태그 브라우저 기본 margin(`1em 0`) 을 명시적으로 `margin: 0`으로 초기화 — 여백 넘침 방지
- 서브타이틀 "My Pact for My Future" 복원 (이탤릭 · `Georgia` 폰트)
- 전체 패딩 최적화: HD ~620px 창 높이에서 모든 요소 표시 보장

#### Roblox 자동 감지 개선 (`main.ts`)
- **의도**: 허용 시간 외에 로블록스가 실행될 경우 타이머 시작 없이 즉시 강제 종료
- 로블록스 감지 후 허용 시간대(allowedStartHour ~ allowedEndHour) 확인을 main 프로세스에서 직접 처리
- 허용 시간 외 감지 시 `killRoblox()` 즉시 호출 (렌더러 IPC 거치지 않음)
- 기존: 허용 시간 외에도 타이머가 시작되거나 무시되는 버그 수정

#### PIN 입력 키보드 지원 (`AdminPanel.tsx`)
- 물리 숫자키(0–9), `Backspace`, `Enter`로 PIN 입력 가능 (기존 버튼 클릭 전용)

#### 타이머 표시 모니터 고정 (`main.ts`)
- 타이머 시작 시점의 커서 위치 기준 모니터를 `timerDisplay`에 저장
- 팝업 이동·코너 복귀 시 항상 동일 모니터 사용 (`getActiveDisplay()`)
- 다중 모니터 환경에서 타이머가 다른 화면으로 튀는 문제 방지

#### 동적 코너 창 크기 (`main.ts`)
- `getCornerInfo()`, `getCenterInfo()`: 화면 해상도 비례 계산 — 4K에서도, HD에서도 적정 크기로 표시

---

## [0.3.0] — 2026-05-27

### 추가

#### 트레이 3클릭 → 관리자 PIN 패널
- **의도**: 아이가 앱을 임의로 조작할 수 없도록 모든 관리자 기능을 비밀번호로 잠금. 부모만 트레이 아이콘을 1.5초 안에 3번 클릭하면 PIN 입력 창이 열림
- 트레이 아이콘 3회 클릭(1.5초 이내)으로 관리자 창 오픈
- 400ms 단일/더블 클릭은 기존대로 메인 창 표시
- 잘못된 PIN 5회 입력 시 30초 잠금(카운트다운 표시)
- 초기 비밀번호: `0000`

#### 관리자 패널 (`AdminPanel.tsx`)
- **의도**: 부모가 예외 상황(학원 빠진 날, 방학 등)에 타이머를 유연하게 조정할 수 있는 공간 제공
- 4자리 숫자 PIN 패드 UI (점 4개 표시)
- **타이머 조정**: 실행 중인 타이머에 +15분 / +30분 / +60분 추가
- **타이머 중지**: 관리자 권한으로 타이머 즉시 중지 → 메인 화면 복귀
- **재부팅 후 타이머 유지 토글**: 컴퓨터를 강제 종료하거나 재부팅해도 남은 타이머가 이어지도록 설정
- **비밀번호 변경**: 현재 비밀번호 확인 후 새 비밀번호로 변경 (SHA-256 해시 저장)

#### 재부팅 후 타이머 복원
- **의도**: 아이가 타이머를 피하기 위해 컴퓨터를 강제 재시작하는 상황 방지
- 타이머 시작 시 `~/.mypact/timer-state.json`에 시작 시각·제한 시간·날짜 저장
- 앱 재시작 시 당일 유효한 타이머 상태가 있으면 남은 시간부터 자동 재개
- 날짜가 다르면(자정 이후) 자동 파기
- 관리자 설정에서 이 기능을 ON/OFF 가능

#### Roblox 자동 감지 + 타이머 자동 시작
- **의도**: 아이가 타이머 앱을 직접 실행하지 않아도(또는 숨기더라도) 로블록스를 켜는 순간 자동으로 타이머가 작동하게 함
- 3초마다 `tasklist`로 `RobloxPlayer(Beta).exe` 실행 여부 폴링
- 로블록스 감지 → 허용 시간대 내에 있으면 타이머 자동 시작 + 배너 표시
- 로블록스 종료 → 타이머 자동 중지 및 대기 화면으로 복귀

#### 시스템 트레이 상시 유지
- **의도**: 아이가 작업 표시줄에서 앱을 찾아 종료하는 경로 차단
- `skipTaskbar: true` — 작업 표시줄에 아이콘 없음
- 창 닫기(X버튼 / Alt+F4) → 앱 종료 대신 트레이로 숨김 (`e.preventDefault()` + `win.hide()`)
- 트레이 메뉴에 종료 버튼 없음 — 트레이에서 앱을 절대 닫을 수 없음
- 트레이 단일 클릭 → 메인 창 표시

### 변경

#### `shared/types.ts`
- `Settings`에 `adminPasswordHash: string`, `resumeTimerOnRestart: boolean` 필드 추가
- `TimerState` 인터페이스 신규 추가 (재부팅 복원용)
- `DEFAULT_SETTINGS`에 기본 비밀번호 해시(SHA-256 of `'0000'`) 및 `resumeTimerOnRestart: true` 포함

#### `main/fileStore.ts`
- `readSettings()`: 기존 저장 파일에 없는 신규 필드를 `DEFAULT_SETTINGS`로 병합 (구버전 호환)
- `readTimerState()`, `writeTimerState()`, `clearTimerState()` 추가

#### `main/ipc.ts`
- `admin:verify-password`, `admin:change-password`, `admin:set-resume-option` IPC 핸들러 추가

#### `main/main.ts` — 전면 재작성
- 윈도우 전환 시 `setOpacity(0 → 1)` 적용 → 깜빡임(flicker) 완전 제거
- `startTimer()`: 재개 시 남은 시간(`resumeRemainingMs`) 파라미터로 정확한 시간 복원
- `restoreWindow()`: 항상 `skipTaskbar: true` 유지
- `timer:get-status`, `timer:add-time`, `timer:admin-stop`, `admin:close-window`, `admin:get-resume-option` IPC 핸들러 추가
- Windows 패키지 빌드 시 자동 시작(`setLoginItemSettings`) 적용

#### UI 디자인 — Roblox 테마 전면 적용
- **의도**: 아이가 거부감 없이 앱을 자연스럽게 받아들이도록 로블록스 브랜딩과 일치시킴
- 배경: 하늘색 그라데이션 (`#4FC3F7 → #0288D1`)
- 타이틀: `Black Han Sans` 폰트, 40px "나와의 서약"
- 시작 버튼: 로블록스 레드 그라데이션 (`#FF2233 → #AA0012`)
- 하단: `roblox-characters.jpg` 캐릭터 이미지
- 설정 화면도 동일 테마 적용

#### `preload/index.ts` / `env.d.ts`
- 신규 API 10개 추가: `timerGetStatus`, `timerAddTime`, `timerAdminStop`, `adminVerifyPassword`, `adminChangePassword`, `adminCloseWindow`, `adminGetResumeOption`, `adminSetResumeOption`, `onTimerResumed`, `onTimerAdminStopped`, `onRobloxDetected`, `onRobloxClosed`

---

## [0.2.0] — 2025 초기

### 추가
- Roblox 강제 종료 (`taskkill`) 구현
- 시스템 트레이 아이콘 (스톱워치 디자인, PNG 프로그래매틱 생성)
- Windows NSIS 인스톨러 패키징 (`electron-builder`)
- 타이머 깜빡임 버그 수정 (`setOpacity` 전환)

---

## [0.1.0] — 2025 초기

### 추가 (최초 구현)
- Electron + React + TypeScript + Tailwind CSS 프로젝트 초기 설정
- FPS 오버레이 스타일 코너 타이머 (우측 상단, DSEG7 폰트)
- 단계별 경고 팝업 (5분·3분·30초·10초 카운트다운)
- 타이머 만료 → 로블록스 강제 종료 + 메인 화면 복귀
- 설정 화면: 평일/주말 허용 시간, 게임 가능 시간대
- 게임 세션 기록 (JSON 로컬 저장)
- `~/.mypact/` 디렉터리에 설정·세션 데이터 저장
