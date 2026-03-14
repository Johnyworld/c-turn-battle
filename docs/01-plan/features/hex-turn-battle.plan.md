# Plan: 헥스 격자 턴제 전투 (hex-turn-battle)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 헥스 격자 3진영 턴제 전투 게임 |
| Date | 2026-03-14 |
| Level | Dynamic (Node.js 서버 + Canvas 프론트엔드) |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| **Problem** | 복잡한 전략 게임 엔진 없이도 브라우저에서 바로 실행되는 턴제 전투 시뮬레이션이 필요함 |
| **Solution** | Node.js 정적 파일 서버로 구동하고, 프론트엔드는 Canvas API 기반 헥스 격자 맵과 턴제 전투 시스템으로 구현 |
| **Function UX Effect** | 세 진영이 각자의 색상으로 구분되고, 유닛을 클릭하여 이동/공격하는 직관적인 턴제 인터페이스 제공 |
| **Core Value** | 2차 세계대전 배경의 전략적 판단이 필요한 3자 대전 경험, 기지 방어/공격 중심의 승패 결정 |

---

## 1. Feature Overview

### 1.1 Feature Name
`hex-turn-battle` — 헥스 격자 턴제 3진영 전투 게임

### 1.2 Goal
Node.js 서버가 정적 파일을 서빙하고, 웹 브라우저에서 Canvas API로 동작하는 2차 세계대전 배경의 턴제 전략 게임.
세 진영이 헥스 격자 맵에서 유닛을 운용하며 상대 기지를 파괴하는 것이 목표.

### 1.3 Background / Motivation
- `npm start` 한 줄로 로컬 서버를 띄워 브라우저에서 접속하는 방식
- 파일 분리로 게임 로직(JS 모듈), 스타일(CSS), 마크업(HTML)을 명확히 분리
- 향후 서버 기능(세이브, 점수판 API 등) 확장에 용이한 구조
- 2차 세계대전의 실제 유닛 유형(탱크, 야포, 보병 등)으로 역사적 분위기 구현

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-01 | 헥스 격자 맵 (약 15×10 크기) Canvas 렌더링 | Must |
| FR-02 | 3개 진영 (연합군/추축군/소련군) 각자 기지 보유 | Must |
| FR-03 | 5종 유닛: 탱크, 야포, 보병, 대전차보병, 의무병 | Must |
| FR-04 | 턴제 시스템: 진영별 순서대로 모든 유닛 행동 | Must |
| FR-05 | 유닛 이동: 클릭으로 선택 → 이동 가능 헥스 하이라이트 → 클릭 이동 | Must |
| FR-06 | 유닛 공격: 이동 후 또는 대신 인접 적 공격 가능 | Must |
| FR-07 | 기지 HP 시스템: 기지가 0이 되면 해당 진영 패배 | Must |
| FR-08 | 전투 결과 로그 패널 (우측 또는 하단) | Should |
| FR-09 | 게임 오버/승리 화면 | Should |
| FR-10 | 유닛 정보 패널 (선택 시 HP, 공격력, 이동력 표시) | Should |
| FR-11 | 턴 종료 버튼 | Must |
| FR-12 | 새 게임 버튼 | Should |

### 2.2 Non-Functional Requirements

| ID | 요구사항 |
|----|---------|
| NFR-01 | Node.js 서버로 정적 파일 서빙 (`npm start`로 실행) |
| NFR-02 | 프론트엔드는 ES 모듈(`.js`) 분리 — 바닐라 JS, 외부 라이브러리 없음 |
| NFR-03 | 최신 Chrome/Firefox/Safari 지원 |
| NFR-04 | 1024×768 이상 해상도 권장 |
| NFR-05 | 그래픽은 기호/텍스트/도형으로 단순하게 구현 (픽셀 아트 수준) |

---

## 3. Scope

### 3.1 In Scope
- 헥스 격자 맵 렌더링 및 좌표 시스템
- 3개 진영 색상 구분 및 기지 배치
- 5종 유닛의 이동/공격 로직
- 턴제 진행 시스템 (진영 순환)
- 유닛 간 전투 (데미지 계산, HP 감소, 사망 처리)
- 기지 공격 및 패배 조건
- 전투 로그 표시

### 3.2 Out of Scope
- AI (모든 진영은 플레이어가 조작 — 호트시트 방식)
- 네트워크 멀티플레이
- 유닛 생산/경제 시스템
- 세이브/로드 기능
- 사운드/BGM

---

## 4. Technical Stack

| 영역 | 기술 |
|------|------|
| 서버 | Node.js (내장 `http` 모듈, 별도 프레임워크 없음) |
| 렌더링 | HTML5 Canvas API |
| 언어 | Vanilla JavaScript ES Modules (프론트), CommonJS (서버) |
| 프로젝트 구조 | `server.js` + `public/` 디렉터리 분리 |
| 스타일 | `public/style.css` 외부 파일 |
| 실행 | `npm start` → `http://localhost:3000` |
| 배포 | 로컬 서버 / 향후 클라우드(Railway, Render 등) 가능 |

### 4.1 디렉터리 구조

```
/
├── package.json
├── server.js              # Node.js 정적 파일 서버
└── public/
    ├── index.html         # 게임 HTML 진입점
    ├── style.css          # 게임 스타일
    └── js/
        ├── main.js        # 진입점 (게임 초기화)
        ├── hex.js         # 헥스 좌표 수학
        ├── game.js        # 게임 상태 관리
        ├── units.js       # 유닛/팩션 정의
        ├── combat.js      # 전투 로직
        ├── render.js      # Canvas 렌더링
        └── ui.js          # UI 업데이트 (사이드바, 로그)
```

---

## 5. Unit Specifications

| 유닛 | 기호 | HP | 공격력 | 이동력 | 사거리 | 특성 |
|------|------|----|-------|-------|-------|------|
| 탱크 | T | 80 | 35 | 3 | 1 | 높은 HP와 공격력, 야포에 취약 |
| 야포 | A | 40 | 50 | 1 | 3 | 원거리 공격, 이동 후 공격 불가 |
| 보병 | I | 50 | 20 | 2 | 1 | 균형형, 기지 점령 가능 |
| 대전차보병 | AT | 40 | 45 | 2 | 1 | 탱크에 추가 데미지 (×1.5) |
| 의무병 | M | 30 | 5 | 2 | 1 | 인접 아군 HP 회복 (15/턴) |

---

## 6. Map Layout

```
맵 크기: 15 × 10 헥스
진영 기지 위치:
  - 연합군 (파란색): 좌상단 (1, 1)
  - 추축군 (회색):   우하단 (13, 8)
  - 소련군 (빨간색): 우상단 (13, 1)

초기 유닛 배치:
  각 진영: 탱크×2, 야포×1, 보병×3, 대전차보병×1, 의무병×1
```

---

## 7. Turn System

```
턴 순서: 연합군 → 추축군 → 소련군 → (반복)

각 진영 턴:
  1. 유닛 선택 (클릭)
  2. 이동 또는 공격 (각 유닛 1회씩)
  3. 모든 유닛 행동 완료 또는 "턴 종료" 버튼 클릭
  4. 다음 진영으로 전환

승리 조건:
  - 마지막 1개 진영만 기지가 살아있으면 승리
```

---

## 8. Implementation Plan

### Phase 1: 서버 & 프로젝트 기반 구조
- [ ] `package.json` 생성 (`npm init`)
- [ ] `server.js` — Node.js http 모듈 정적 파일 서버 (MIME 타입 지원)
- [ ] `public/index.html` 기본 구조 (Canvas + 사이드바 레이아웃)
- [ ] `public/style.css` 기본 스타일

### Phase 2: 헥스 & 렌더링 모듈
- [ ] `public/js/hex.js` — 헥스 좌표 수학 (center, neighbors, distance, BFS)
- [ ] `public/js/render.js` — Canvas 렌더링 (헥스, 유닛, 기지, 하이라이트)
- [ ] Canvas 초기화 및 리사이즈 처리

### Phase 3: 게임 상태 & 유닛 모듈
- [ ] `public/js/units.js` — 유닛/팩션 상수 정의
- [ ] `public/js/game.js` — 게임 상태 초기화, 턴 시스템
- [ ] `public/js/combat.js` — 전투/회복 로직, 승패 판정

### Phase 4: 상호작용 & UI
- [ ] `public/js/ui.js` — 사이드바 업데이트, 전투 로그
- [ ] `public/js/main.js` — 클릭 이벤트 처리, 모듈 연결
- [ ] 게임 오버 오버레이

### Phase 5: 통합 & 검증
- [ ] `npm start` 실행 확인
- [ ] 브라우저 접속 (`http://localhost:3000`) 및 기능 검증

---

## 9. Risks

| 위험 | 대응 |
|------|------|
| 헥스 좌표 변환 복잡도 | Offset 좌표 방식 사용, `hex.js`에 단위 테스트 수준 검증 |
| ES 모듈 CORS 오류 | 서버 없이 파일 직접 열면 CORS 발생 → `npm start` 필수 안내 |
| 3진영 AI 부재 | 호트시트 방식으로 플레이어가 모두 조작 |
| Canvas 성능 | 이벤트 발생 시에만 `render()` 호출 (requestAnimationFrame 불필요) |

---

## 10. Success Criteria
- [ ] `npm start` 실행 후 `http://localhost:3000` 접속 성공
- [ ] 헥스 맵이 올바르게 렌더링됨
- [ ] 3개 진영의 유닛이 구분되어 표시됨
- [ ] 클릭으로 유닛 선택 → 이동 가능
- [ ] 공격 및 HP 감소가 정상 동작
- [ ] 기지 파괴 시 해당 진영 패배 처리됨
- [ ] 턴 전환이 올바르게 동작함
