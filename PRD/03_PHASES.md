# My Pact for My Future — Phase 분리 계획

> 한 번에 다 만들면 복잡해져서 품질이 떨어집니다.
> Phase별로 나눠서 각각 "진짜 동작하는 제품"을 만듭니다.

---

## Phase 1: Electron 타이머 코어 (오늘 목표)

### 목표
자녀가 시작 버튼을 누르면 카운트다운이 돌고, 경고 팝업이 뜨고, 시간이 만료되면 로블록스가 종료된다.

### 기능
- [ ] 설정 화면: 평일/주말 허용 시간, 게임 가능 시간대 입력 + settings.json 저장
- [ ] 메인 화면: 오늘 남은 허용 시간 표시 + [시작] 버튼
- [ ] 카운트다운 타이머: 1초 단위 실시간 업데이트
- [ ] 경고 팝업: 5분/3분/1분/15초 전 앱 내 팝업 (3초 후 자동 소멸)
- [ ] 시간 만료: Roblox 프로세스 강제 종료 (macOS: `pkill Roblox`, Windows: taskkill)
- [ ] 세션 기록: 종료 시 sessions.json에 append
- [ ] 시간대 제한: allowedStartHour 전이면 시작 버튼 비활성화

### 데이터
- settings.json (읽기 + 쓰기)
- sessions.json (쓰기)

### 인증
- 없음 (로컬 전용)

### "진짜 제품" 체크리스트
- [ ] 실제 시스템 시간 기반 카운트다운 (setTimeout 누적 오차 X)
- [ ] 실제 Roblox 프로세스 감지 및 종료
- [ ] 실제 파일 I/O (메모리 상 임시 데이터 X)
- [ ] 앱 최소화 상태에서도 타이머 계속 동작

### Phase 1 시작 프롬프트
```
이 PRD를 읽고 Phase 1을 구현해주세요.
@PRD/01_PRD.md
@PRD/02_DATA_MODEL.md
@PRD/04_PROJECT_SPEC.md

Phase 1 범위:
- Electron 30+ + React + Vite + TypeScript + Tailwind CSS
- 설정 화면 (settings.json 읽기/쓰기)
- 메인 화면 (오늘 남은 시간 표시 + 시작 버튼)
- 카운트다운 타이머 (백그라운드에서도 동작)
- 경고 팝업 (5분/3분/1분/15초 전)
- Roblox 프로세스 강제 종료
- 세션 기록 (sessions.json append)
- 데이터 저장 경로: ~/.mypact/

반드시 지켜야 할 것:
- 04_PROJECT_SPEC.md의 "절대 하지 마" 목록 준수
- 로컬 JSON 파일 I/O (메모리 임시 데이터 X)
- 타이머는 Date.now() 기반 (setTimeout 누적 오차 방지)
- Roblox 프로세스 이름: macOS=Roblox, Windows=RobloxPlayerBeta.exe
```

---

## Phase 2: 웹 대시보드 (오늘 또는 다음)

### 전제 조건
- Phase 1 Electron 앱이 안정적으로 동작 중
- sessions.json이 실제 데이터로 채워진 상태

### 목표
부모가 브라우저에서 자녀의 플레이 통계를 확인하고 설정을 조정할 수 있다.

### 기능
- [ ] 오늘 현황 카드: 플레이 분 / 허용 분 / 남은 분
- [ ] 설정 관리 UI: settings.json 읽기 + 저장 폼
- [ ] 주간 바 그래프: 최근 7일 일별 플레이 시간 (Recharts)
- [ ] 세션 이력 테이블: 날짜/시작/종료/플레이 분/강제종료 여부

### 기술 스택
- Next.js 15 (App Router)
- Tailwind CSS
- Recharts (그래프)
- Node.js fs API (로컬 JSON 읽기, next.config.js 경로 설정)

### 실행 방법
```bash
cd dashboard
npm run dev
# 브라우저: http://localhost:3000
```

### Phase 2 시작 프롬프트
```
Phase 1 Electron 앱이 완성됐습니다.
이제 웹 대시보드(Phase 2)를 구현해주세요.
@PRD/01_PRD.md
@PRD/02_DATA_MODEL.md
@PRD/04_PROJECT_SPEC.md

Phase 2 범위:
- Next.js 15 App Router + Tailwind CSS + Recharts
- 데이터 소스: ~/.mypact/sessions.json, ~/.mypact/settings.json (로컬 파일)
- 오늘 현황 카드
- 설정 관리 폼 (settings.json 저장)
- 주간 바 그래프 (최근 7일)
- 세션 이력 테이블

로컬 실행만 (Vercel 배포는 나중에 검토)
```

---

## Phase 3: 고도화 (추후)

### 전제 조건
- Phase 1 + 2가 안정적으로 로컬 운영 중

### 목표
장기 통계와 세부 설정으로 더 정교한 시간 관리 도구가 된다.

### 기능
- [ ] 월간 누적 그래프 (Recharts 라인 차트)
- [ ] 전체 세션 이력 테이블 (날짜 필터, 정렬)
- [ ] 요일별 개별 시간 설정 전용 UI
- [ ] 선택적: Vercel 배포 (부모가 외부에서 통계 확인)
- [ ] 선택적: Supabase 연동 (멀티 디바이스 동기화)

### 주의사항
- Vercel 배포 시 로컬 파일 접근 불가 → Supabase 마이그레이션 필요
- 외부 배포 전 보안 검토 (설정 노출 위험)

---

## Phase 로드맵 요약

| Phase | 핵심 기능 | 상태 |
|-------|----------|------|
| Phase 1 (오늘 MVP) | 타이머 + 경고 + Roblox 종료 + 기록 | 시작 전 |
| Phase 2 | 웹 대시보드 + 설정 UI + 주간 그래프 | Phase 1 완료 후 |
| Phase 3 | 월간 통계 + 세부 설정 + 선택적 Vercel | Phase 2 완료 후 |
