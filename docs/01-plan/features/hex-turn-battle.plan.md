# Plan: 헥스 격자 턴제 전투 (hex-turn-battle)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 헥스 격자 연합군 vs 추축군 턴제 전투 (진영 선택 화면 + AI 대결 + Fog of War) |
| Date | 2026-03-14 |
| Level | Dynamic (Node.js 서버 + Canvas 프론트엔드) |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| **Problem** | 고정된 진영 배정으로 플레이 다양성이 없고, 3진영 구조는 밸런스가 복잡함 |
| **Solution** | 연합군·추축군 2진영으로 단순화, 게임 시작 전 진영 선택 화면에서 플레이어 진영을 고르면 상대 진영을 AI가 조종 |
| **Function UX Effect** | 진영 선택 → 전투 화면 전환의 명확한 플로우, 선택한 진영의 시야로 Fog of War 적용 |
| **Core Value** | 연합군 또는 추축군으로 번갈아 경험할 수 있는 2차 세계대전 1:1 전략 대결 |

---

## 1. Feature Overview

### 1.1 Feature Name
`hex-turn-battle` — 헥스 격자 연합군 vs 추축군 턴제 전투 게임

### 1.2 Goal
- **진영 선택 화면**: 게임 시작 시 연합군 / 추축군 중 하나를 선택
- **플레이어 진영**: 선택한 진영을 직접 클릭으로 조작
- **AI 진영**: 선택하지 않은 진영을 AI가 자동으로 턴 진행
- **Fog of War**: 플레이어 유닛의 시야 범위 밖은 어둡게 가려 적 위치 미표시

### 1.3 Background / Motivation
- 소련군 제거 → 2진영 대결로 밸런스 및 전략 집중도 향상
- 진영 선택 화면으로 리플레이 가치 증가 (연합군·추축군 양측 경험 가능)
- Fog of War는 선택한 플레이어 진영 기준으로 적용

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-01 | 헥스 격자 맵 Canvas 렌더링 (17×11) | Must |
| FR-02 | **진영 선택 화면**: 게임 시작 시 연합군 / 추축군 카드 선택 UI 표시 | Must |
| FR-03 | 선택 후 전투 화면으로 전환 (선택 화면 숨김, 게임 캔버스 표시) | Must |
| FR-04 | 2개 진영 (연합군/추축군) 각자 기지 보유, 기지 파괴 시 패배 | Must |
| FR-05 | 5종 유닛: 탱크, 야포, 보병, 대전차보병, 의무병 | Must |
| FR-06 | 턴제 시스템: 연합군 → 추축군 → (반복) | Must |
| FR-07 | 플레이어 턴: 클릭으로 유닛 선택 → 이동/공격 | Must |
| FR-08 | AI 턴: 상대 진영 자동 행동 (300ms/유닛 딜레이, 시각화) | Must |
| FR-09 | AI 행동 원칙: 공격 가능 타깃 → 공격(최저 HP 우선), 없으면 → 적 기지 방향 이동 | Must |
| FR-10 | 의무병 AI: 인접 아군 HP 50% 이하면 회복 | Should |
| FR-11 | 야포 AI: 이동 없이 사거리 내 적 공격, 없으면 전진 | Should |
| FR-12 | AI 턴 진행 중 플레이어 클릭 입력 차단 | Must |
| FR-13 | Fog of War: 플레이어 유닛 시야 반경(3헥스) 기반 가시 영역 계산 | Must |
| FR-14 | 시야 밖 헥스: 어두운 오버레이, 적 유닛·기지 렌더링 생략 | Must |
| FR-15 | Fog 토글 버튼 (ON/OFF) | Should |
| FR-16 | 전투 결과 로그 패널 | Should |
| FR-17 | 게임 오버/승리 화면 (재도전 / 진영 재선택 버튼) | Should |
| FR-18 | 유닛 정보 패널 | Should |
| FR-19 | 턴 종료 버튼 | Must |

### 2.2 Non-Functional Requirements

| ID | 요구사항 |
|----|---------|
| NFR-01 | Node.js 서버로 정적 파일 서빙 (`npm start`로 실행) |
| NFR-02 | 프론트엔드는 ES 모듈(`.js`) 분리 — 바닐라 JS, 외부 라이브러리 없음 |
| NFR-03 | 최신 Chrome/Firefox/Safari 지원 |
| NFR-04 | 1024×768 이상 해상도 권장 |
| NFR-05 | 그래픽은 기호/텍스트/도형으로 단순하게 구현 |

---

## 3. Scope

### 3.1 In Scope
- **진영 선택 화면** (연합군 / 추축군 카드 UI)
- 헥스 격자 맵 렌더링 및 좌표 시스템
- **2개 진영** (연합군·추축군) 색상 구분 및 기지 배치
- 5종 유닛의 이동/공격 로직
- 턴제 진행 시스템 (2진영 순환)
- 유닛 간 전투 (데미지 계산, HP 감소, 사망 처리)
- 기지 공격 및 패배 조건
- 규칙 기반 AI 자동 조종 (`ai.js`)
- Fog of War 시야 계산 및 렌더링 (`fog.js`)
- 전투 로그 표시

### 3.2 Out of Scope
- 소련군 진영 (제거)
- 3진영 이상 구도
- AI 고급 전략 (A* 경로 탐색 등)
- 네트워크 멀티플레이
- 유닛 생산/경제 시스템
- 세이브/로드 기능
- 사운드/BGM

---

## 4. Technical Stack

| 영역 | 기술 |
|------|------|
| 서버 | Node.js (내장 `http` 모듈, 별도 프레임워크 없음) |
| 렌더링 | HTML5 Canvas API + DOM (진영 선택 화면) |
| 언어 | Vanilla JavaScript ES Modules (프론트), CommonJS (서버) |
| 프로젝트 구조 | `server.js` + `public/` 디렉터리 분리 |
| 스타일 | `public/style.css` 외부 파일 |
| 실행 | `npm start` → `http://localhost:3000` |

### 4.1 디렉터리 구조

```
/
├── package.json
├── server.js              # Node.js 정적 파일 서버
└── public/
    ├── index.html         # 진영 선택 화면 + 게임 화면 통합
    ├── style.css          # 전체 스타일 (선택 화면 + 게임 UI)
    └── js/
        ├── main.js        # 진입점 (진영 선택 → 게임 전환, AI 턴 훅)
        ├── hex.js         # 헥스 좌표 수학
        ├── game.js        # 게임 상태 관리 (playerFaction 포함)
        ├── units.js       # 유닛/팩션 정의 (2진영)
        ├── combat.js      # 전투 로직
        ├── render.js      # Canvas 렌더링 (Fog 오버레이 포함)
        ├── ui.js          # UI 업데이트 (사이드바, 로그)
        ├── ai.js          # AI 엔진 (상대 진영 자동 조종)
        └── fog.js         # Fog of War 시야 계산
```

---

## 5. 화면 플로우

```
[접속]
  │
  ▼
[진영 선택 화면]  ← index.html 내 #faction-select 섹션
  │
  ├── 연합군 카드 클릭  → playerFaction = 0, aiFaction = 1
  └── 추축군 카드 클릭  → playerFaction = 1, aiFaction = 0
  │
  ▼
[전투 화면]  ← #game-screen 섹션 표시, #faction-select 숨김
  │
  ├── 게임 진행 ...
  │
  ▼
[게임 오버 오버레이]
  ├── 재도전 버튼  → 같은 진영으로 새 게임
  └── 진영 재선택 버튼  → 진영 선택 화면으로 복귀
```

---

## 6. Unit Specifications

| 유닛 | 기호 | HP | 공격력 | 이동력 | 사거리 | 특성 |
|------|------|----|-------|-------|-------|------|
| 탱크 | T | 80 | 35 | 3 | 1 | 높은 HP와 공격력 |
| 야포 | A | 40 | 50 | 1 | 3 | 원거리 공격, 이동 후 공격 불가 |
| 보병 | I | 50 | 20 | 2 | 1 | 균형형 |
| 대전차보병 | AT | 40 | 45 | 2 | 1 | 탱크에 추가 데미지 (×1.5) |
| 의무병 | M | 30 | 5 | 2 | 1 | 인접 아군 HP 회복 (15/턴) |

---

## 7. Map Layout

```
맵 크기: 17 × 11 헥스

진영 기지 위치:
  - 연합군 (파란색): 좌측 중앙 (1, 5)
  - 추축군 (빨간색): 우측 중앙 (15, 5)

초기 유닛 배치:
  각 진영: 탱크×2, 야포×1, 보병×3, 대전차보병×1, 의무병×1 (총 8유닛)
  연합군: 기지 우측으로 전개
  추축군: 기지 좌측으로 전개
```

---

## 8. Turn System

```
턴 순서: 연합군 → 추축군 → (반복)
※ playerFaction이 어느 쪽이든 동일한 순서

플레이어 턴:
  1. 유닛 클릭으로 선택
  2. 이동 가능 헥스 → 클릭으로 이동
  3. 공격 가능 타깃 → 클릭으로 공격
  4. "턴 종료" 버튼 또는 모든 유닛 행동 완료 시 전환

AI 턴:
  1. 상대 진영 살아있는 유닛 순회
  2. 각 유닛 300ms 딜레이로 자동 행동
  3. 완료 후 다음 턴 자동 전환
  4. AI 턴 중 플레이어 클릭 차단

승리 조건:
  - 상대 기지 HP = 0 → 승리 화면 표시
```

## 8.1 Fog of War

```
가시 영역 = 플레이어 진영 유닛 각각의 시야(반경 3헥스) 합집합
           + 플레이어 기지 위치 (항상 가시)

비가시 영역:
  - 헥스 타일: 어두운 오버레이 표시
  - 적 유닛·기지: 렌더링 생략
  - 아군 유닛: 항상 표시

Fog 토글: 헤더 버튼으로 ON/OFF 전환
```

---

## 9. Implementation Plan

### Phase 1 (완료)
- [x] `server.js`, `package.json`
- [x] `index.html`, `style.css`
- [x] `units.js`, `hex.js`, `game.js`, `combat.js`, `render.js`, `ui.js`, `main.js`
- [x] `ai.js`, `fog.js`

### Phase 2: 2진영 전환 및 진영 선택 화면
- [ ] `units.js` — 소련군 제거, 2진영으로 수정, 기지 위치 좌우 중앙으로 변경
- [ ] `game.js` — `playerFaction`, `aiFaction` 상태 추가, `initState(playerFaction)` 수정
- [ ] `fog.js` — 연합군 고정 → `playerFaction` 기준으로 수정
- [ ] `ai.js` — `aiFaction` 기준으로 동작하도록 수정
- [ ] `index.html` — 진영 선택 화면(`#faction-select`) + 전투 화면(`#game-screen`) 구조 추가
- [ ] `style.css` — 진영 선택 카드 UI 스타일
- [ ] `main.js` — 진영 선택 → 게임 전환 로직, 재도전/재선택 버튼 처리

---

## 10. Risks

| 위험 | 대응 |
|------|------|
| 진영 선택에 따른 Fog 기준 변경 | `fog.js`가 `playerFaction`을 파라미터로 받도록 설계 |
| 추축군 선택 시 AI가 연합군 조종 | `aiFaction = 1 - playerFaction` 단순 반전으로 처리 |
| 기지 위치 변경에 따른 초기 배치 충돌 | 좌우 중앙 배치로 대칭 구성, 오프셋 방향 반전 |
| AI 행동 품질 | 규칙 기반 단순 AI (공격 우선, 기지 방향 이동) |
| Canvas 성능 | 이벤트 발생 시에만 `render()` 호출 |

---

## 11. Success Criteria
- [x] `npm start` 실행 후 접속 성공
- [ ] 게임 접속 시 진영 선택 화면 표시
- [ ] 연합군 / 추축군 선택 후 전투 화면으로 전환
- [ ] 플레이어 진영 클릭 조작 정상 동작
- [ ] AI 진영 자동 행동 및 시각화 정상 동작
- [ ] Fog of War 플레이어 진영 기준 적용
- [ ] 승리/패배 시 재도전 + 진영 재선택 버튼 표시
- [ ] 기지 파괴 시 해당 진영 패배 처리
