# My Pact — 디자인 문서

> Show Me The PRD로 생성됨 (2026-05-23)
> "스스로와의 약속, 내 미래를 위해"

---

## 한 줄 요약

자녀의 로블록스 게임 시간을 부모가 설정하고, 자녀 스스로 약속을 지키도록 돕는
**Electron 타이머 앱**. 로컬 웹 대시보드는 Phase 2 이후 확장 범위입니다.

---

## 문서 구성

| 문서 | 내용 | 언제 읽나 |
|------|------|----------|
| [01_PRD.md](./01_PRD.md) | 뭘 만드는지, 누가 쓰는지, 화면 구성 | 프로젝트 시작 전 |
| [02_DATA_MODEL.md](./02_DATA_MODEL.md) | settings.json / sessions.json 구조 | 파일 I/O 구현할 때 |
| [03_PHASES.md](./03_PHASES.md) | Phase 1~3 기능 목록 + 시작 프롬프트 | 개발 순서 정할 때 |
| [04_PROJECT_SPEC.md](./04_PROJECT_SPEC.md) | 기술 스택, 절대 하지 마, 프로세스 종료 코드 | AI에게 코드 시킬 때마다 |

---

## 다음 단계

현재 구현은 Phase 1 Electron 앱 중심입니다. 웹 대시보드는 [03_PHASES.md](./03_PHASES.md)의 Phase 2 예정 범위입니다.

```
Phase 1 핵심:
Electron 앱 → 타이머 + 경고 + Roblox 종료 + 기록
```

---

## 미결 사항 (NEEDS CLARIFICATION)

- [x] Roblox 프로세스 이름 플랫폼 확인 (Windows: `RobloxPlayer.exe`, `RobloxPlayerBeta.exe`)
- [x] 앱 최소화 상태 타이머 동작 확인
- [x] 부모 설정 화면 PIN 보호 적용
- [x] 앱 자동 시작 (Windows HKLM Run + Scheduled Task)
- [ ] sessions.json 최대 크기 / 연도별 분리 여부

---

## 기술 스택 요약

| 구성 | 스택 |
|------|------|
| Electron 앱 | Electron 30+ + React + Vite + TypeScript + Tailwind |
| 웹 대시보드 | Phase 2 예정: Next.js 15 + Tailwind + Recharts |
| 데이터 저장 | `%ProgramData%\MyPact\settings.json` + `%ProgramData%\MyPact\Data\*.json` |
| 배포 | 로컬 실행 (추후 Vercel 검토) |
