# My Pact — 데이터 모델

> 이 문서는 앱에서 다루는 핵심 데이터의 구조를 정의합니다.
> 공용 ProgramData JSON 파일로 설정, 세션, 타이머 상태, 당일 사용량을 관리합니다.

---

## 전체 구조

```
%ProgramData%\MyPact\
├── settings.json   ← 부모가 설정한 허용 시간 규칙
├── Admin\
│   └── admin-secret.json  ← 관리자 PIN 검증자
└── Data\
    ├── sessions.json      ← 자녀의 플레이 세션 기록 배열
    ├── timer-state.json   ← 재부팅 복원 상태 (관리자/SYSTEM 쓰기 가능 시)
    └── daily-usage.json   ← 당일 세션 쿼터와 잔여 시간
```

Electron 앱이 동일한 공용 파일을 읽고 씁니다. 설정은 관리자 인증 후 main process에서만 변경합니다. 설치 ACL은 표준 자녀 계정의 `settings.json`과 `Admin\admin-secret.json` 직접 수정을 막습니다. `Data\`는 부모/자녀 계정이 같은 타이머/쿼터 상태로 동작하도록 표준 계정에서도 쓰기 가능하게 둡니다. `Data\`까지 표준 사용자 직접 변조를 막으려면 Windows Service/SYSTEM 보조가 필요합니다.

```
[Settings] ──1:N──> [Session]
  (허용 시간 규칙)      (플레이 기록)
```

---

## 엔티티 상세

### Settings (settings.json)
부모가 설정한 허용 시간 규칙. 파일 전체가 하나의 설정 객체입니다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| weekdayLimit | 평일 세션당 허용 시간 (분) | 30 | O |
| weekendLimit | 주말 세션당 허용 시간 (분) | 60 | O |
| weekdaySessionCount | 평일 하루 허용 세션 수 | 1 | O |
| weekendSessionCount | 주말 하루 허용 세션 수 | 1 | O |
| allowedStartHour | 게임 시작 가능 시각 (0~23) | 16 | O |
| allowedEndHour | 게임 종료 시각 (0~24, 24는 자정 종료) | 21 | O |
| resumeTimerOnRestart | 관리자/SYSTEM 쓰기 권한이 있을 때 재시작 후 타이머 복원 | true | O |
| updatedAt | 마지막 수정 시각 | "2026-05-23T16:00:00" | O |

**예시 파일:**
```json
{
  "weekdayLimit": 30,
  "weekendLimit": 60,
  "weekdaySessionCount": 1,
  "weekendSessionCount": 2,
  "allowedStartHour": 16,
  "allowedEndHour": 21,
  "resumeTimerOnRestart": true,
  "updatedAt": "2026-05-23T16:00:00"
}
```

---

### Session (sessions.json 배열)
자녀의 게임 세션 하나하나를 기록합니다. 배열로 누적됩니다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 (UUID v4) | "a1b2c3d4-..." | O |
| date | 플레이 날짜 (YYYY-MM-DD) | "2026-05-23" | O |
| startTime | 시작 시각 (HH:mm) | "16:05" | O |
| endTime | 종료 시각 (HH:mm) | "16:35" | O |
| duration | 실제 플레이 시간 (분) | 30 | O |
| limitAtSession | 세션 시작 시 허용 시간 스냅샷 (분) | 30 | O |
| terminated | 앱이 강제 종료했는지 여부 | true | O |

**예시 파일:**
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "date": "2026-05-23",
    "startTime": "16:05",
    "endTime": "16:35",
    "duration": 30,
    "limitAtSession": 30,
    "terminated": true
  },
  {
    "id": "b2c3d4e5-f6a7-8901-bcde-f01234567891",
    "date": "2026-05-22",
    "startTime": "16:10",
    "endTime": "16:38",
    "duration": 28,
    "limitAtSession": 30,
    "terminated": false
  }
]
```

---

## 왜 이 구조인가

- **단순성**: DB 서버 없이 ProgramData 로컬 JSON 파일로 완결. 설치하면 바로 동작.
- **공유**: 부모 관리자 계정과 자녀 표준 계정이 같은 `%ProgramData%\MyPact\` 데이터를 사용합니다.
- **확장성**: Phase 3에서 Supabase 연동이 필요하면 동일한 스키마를 DB 테이블로 마이그레이션 가능.
- **limitAtSession 필드**: 설정이 바뀌어도 과거 세션의 허용 시간 기준을 보존해 통계 왜곡 방지.

---

## 파일 읽기/쓰기 규칙

| 앱 | settings.json | sessions.json / timer-state.json / daily-usage.json |
|---|---|---|
| Electron 앱 | 읽기, 관리자 인증 후 main process 쓰기 | main process 쓰기. 부모/자녀 계정이 같은 상태 공유 |
| 웹 대시보드 | 추후 main-process/API 경유 필요 | 읽기 전용 (통계 표시) |

### TimerState (Data/timer-state.json)
재부팅 복원용 상태입니다. 같은 날짜이고 남은 시간이 있을 때만 유효합니다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| startTime | 타이머 시작 epoch ms | 1770000000000 | O |
| limitMs | 세션 전체 제한 ms | 1800000 | O |
| date | 적용 날짜 (YYYY-MM-DD) | "2026-05-23" | O |
| pausedRemainingMs | Roblox 종료/일시정지 시 남은 ms | 1200000 | X |
| sessionStartTime | 세션 시작 시각 (HH:mm) | "16:05" | X |
| limitAtSession | 세션 시작 시 제한 분 | 30 | X |

### DailyUsage (Data/daily-usage.json)
당일 세션 쿼터와 현재 세션 잔여 시간을 저장합니다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| date | 적용 날짜 (YYYY-MM-DD) | "2026-05-23" | O |
| sessionsCompleted | 만료 완료된 세션 수 | 1 | O |
| currentSessionRemainingMs | Roblox 종료 후 이어서 쓸 남은 ms | 1200000 | O |

---

## [NEEDS CLARIFICATION]

- [ ] 동시 쓰기 충돌: Electron 앱과 대시보드가 동시에 settings.json을 쓰면 충돌 가능 — 파일 lock 또는 순차 처리 필요 여부 검토
- [ ] sessions.json 최대 크기: 수년치 기록이 쌓이면 파일이 커질 수 있음 — 연도별 분리 여부 추후 검토
