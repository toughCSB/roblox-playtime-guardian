# My Pact for My Future — 데이터 모델

> 이 문서는 앱에서 다루는 핵심 데이터의 구조를 정의합니다.
> 로컬 JSON 파일 2개로 모든 데이터를 관리합니다.

---

## 전체 구조

```
~/.mypact/
├── settings.json   ← 부모가 설정한 허용 시간 규칙
└── sessions.json   ← 자녀의 플레이 세션 기록 배열
```

Electron 앱과 웹 대시보드가 동일한 파일을 읽고 씁니다.

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
| weekdayLimit | 평일 기본 허용 시간 (분) | 30 | O |
| weekendLimit | 주말 기본 허용 시간 (분) | 60 | O |
| customDays | 요일별 개별 설정 (덮어쓰기) | `{"MON": 30, "SAT": 90}` | X |
| allowedStartHour | 게임 시작 가능 시각 (0~23) | 16 | O |
| allowedEndHour | 게임 종료 시각 (0~23) | 21 | O |
| updatedAt | 마지막 수정 시각 | "2026-05-23T16:00:00" | O |

**예시 파일:**
```json
{
  "weekdayLimit": 30,
  "weekendLimit": 60,
  "customDays": {
    "MON": 30,
    "TUE": 30,
    "WED": 30,
    "THU": 30,
    "FRI": 30,
    "SAT": 60,
    "SUN": 60
  },
  "allowedStartHour": 16,
  "allowedEndHour": 21,
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

- **단순성**: DB 서버 없이 로컬 파일 2개로 완결. 설치하면 바로 동작.
- **공유**: Electron 앱과 Next.js 웹 대시보드가 같은 경로(`~/.mypact/`)를 읽으므로 별도 API 불필요.
- **확장성**: Phase 3에서 Supabase 연동이 필요하면 동일한 스키마를 DB 테이블로 마이그레이션 가능.
- **limitAtSession 필드**: 설정이 바뀌어도 과거 세션의 허용 시간 기준을 보존해 통계 왜곡 방지.

---

## 파일 읽기/쓰기 규칙

| 앱 | settings.json | sessions.json |
|---|---|---|
| Electron 앱 | 읽기 (타이머 시작 시) | 읽기 + 쓰기 (세션 종료 시 append) |
| 웹 대시보드 | 읽기 + 쓰기 (설정 저장 시) | 읽기 전용 (통계 표시) |

---

## [NEEDS CLARIFICATION]

- [ ] 동시 쓰기 충돌: Electron 앱과 대시보드가 동시에 settings.json을 쓰면 충돌 가능 — 파일 lock 또는 순차 처리 필요 여부 검토
- [ ] sessions.json 최대 크기: 수년치 기록이 쌓이면 파일이 커질 수 있음 — 연도별 분리 여부 추후 검토
