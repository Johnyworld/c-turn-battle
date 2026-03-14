# Design: 헥스 격자 턴제 전투 (hex-turn-battle)

> Plan 참조: `docs/01-plan/features/hex-turn-battle.plan.md`

---

## 1. 아키텍처 개요

```
[Browser]
  └── http://localhost:3000
        │
[Node.js server.js]  ← http 모듈, 정적 파일 서빙
        │
[public/]
  ├── index.html       ← 레이아웃 뼈대, <canvas>, 사이드바 DOM
  ├── style.css        ← 전체 스타일
  └── js/              ← ES Modules (type="module")
      ├── main.js      ← 진입점: 이벤트 바인딩, 게임 루프 통합
      ├── units.js     ← 상수: FACTIONS, UNIT_TYPES, INIT_LAYOUT
      ├── hex.js       ← 순수 함수: 좌표 변환, BFS, 거리 계산
      ├── game.js      ← 상태 관리: initState(), endTurn(), defeat()
      ├── combat.js    ← 전투 로직: calcDamage(), attack(), heal()
      ├── render.js    ← Canvas 렌더링: render(), drawHex(), drawUnit()
      └── ui.js        ← DOM 업데이트: updateHeader(), updateSidebar(), addLog()
```

### 모듈 의존 관계

```
main.js
  ├── units.js   (상수만, 의존 없음)
  ├── hex.js     (순수 함수만, 의존 없음)
  ├── game.js    ← units.js, hex.js
  ├── combat.js  ← units.js, game.js
  ├── render.js  ← units.js, hex.js, game.js
  └── ui.js      ← units.js, game.js
```

**원칙**: 순환 의존 금지. `units.js`·`hex.js`는 어떤 모듈도 import하지 않는 리프 모듈.

---

## 2. 파일별 상세 설계

### 2.1 `server.js`

**역할**: Node.js 내장 `http` 모듈로 `public/` 정적 파일 서빙

```javascript
// 핵심 로직
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
};

http.createServer((req, res) => {
  // URL → 파일 경로 매핑
  // 루트 '/' → 'public/index.html'
  // 그 외 → 'public' + pathname
  // 파일 없으면 404
}).listen(3000);
```

**export**: 없음 (standalone 스크립트)

---

### 2.2 `public/js/units.js`

**역할**: 게임 상수 정의 (변경 없는 데이터)

```javascript
// export const FACTIONS
export const FACTIONS = [
  { id: 0, name: '연합군', color: '#3a7fd5', lightColor: '#6af',
    baseColor: '#1a4a8a' },
  { id: 1, name: '추축군', color: '#b03030', lightColor: '#f66',
    baseColor: '#6a1010' },
  { id: 2, name: '소련군', color: '#c8a020', lightColor: '#fb0',
    baseColor: '#7a5a00' },
];

// export const UNIT_TYPES
export const UNIT_TYPES = {
  TANK:  { symbol:'T',  label:'탱크',       hp:80, atk:35, move:3, range:1, special:'anti_tank_bonus' },
  ARTY:  { symbol:'A',  label:'야포',       hp:40, atk:50, move:1, range:3, special:'no_move_fire' },
  INF:   { symbol:'I',  label:'보병',       hp:50, atk:20, move:2, range:1, special:null },
  AT:    { symbol:'AT', label:'대전차보병', hp:40, atk:45, move:2, range:1, special:'anti_tank' },
  MEDIC: { symbol:'M',  label:'의무병',     hp:30, atk:5,  move:2, range:1, special:'heal' },
};

// export const MAP_COLS, MAP_ROWS, HEX_SIZE
export const MAP_COLS = 17;
export const MAP_ROWS = 11;
export const HEX_SIZE = 32;

// export const BASE_POSITIONS  — [factionId]: {col, row}
export const BASE_POSITIONS = [
  { col: 1,  row: 1 },   // 연합군
  { col: 14, row: 9 },   // 추축군
  { col: 14, row: 1 },   // 소련군
];

// export const INIT_UNITS — 기지 기준 상대 오프셋
export const INIT_UNITS = [
  { type:'TANK',  dc:2, dr:0  },
  { type:'TANK',  dc:1, dr:1  },
  { type:'ARTY',  dc:3, dr:0  },
  { type:'INF',   dc:2, dr:1  },
  { type:'INF',   dc:2, dr:-1 },
  { type:'INF',   dc:1, dr:0  },
  { type:'AT',    dc:3, dr:1  },
  { type:'MEDIC', dc:1, dr:-1 },
];
```

---

### 2.3 `public/js/hex.js`

**역할**: 헥스 좌표 관련 순수 함수 모음

#### 좌표 방식: Offset (odd-r)

- 짝수 행: 왼쪽 정렬
- 홀수 행: 오른쪽으로 0.5칸 오프셋

#### 함수 목록

```javascript
// 헥스 중심 픽셀 좌표
export function hexCenter(col, row): { x, y }

// 픽셀 → 가장 가까운 헥스 (brute force, 맵 크기 작으므로 허용)
export function pixelToHex(px, py): { col, row } | null

// 인접 6개 헥스 반환 (맵 경계 클리핑)
export function hexNeighbors(col, row): Array<{col, row}>

// 큐브 좌표 변환 후 체비쇼프 거리
export function hexDistance(c1, r1, c2, r2): number

// BFS로 이동 가능 헥스 목록 반환
// blockedFn(col, row): boolean — 통과 불가 조건
export function getReachable(col, row, maxSteps, blockedFn): Array<{col, row}>
```

#### `hexCenter` 공식

```
w = HEX_SIZE * sqrt(3)
h = HEX_SIZE * 2
x = col * w + (row % 2 === 1 ? w/2 : 0) + padding
y = row * h * 0.75 + HEX_SIZE + padding
```

#### `hexDistance` 공식 (Offset → Cube 변환)

```
cube_x = col - (row - (row & 1)) / 2
cube_z = row
cube_y = -cube_x - cube_z
distance = max(|Δx|, |Δy|, |Δz|)
```

---

### 2.4 `public/js/game.js`

**역할**: 게임 전체 상태(State) 관리

#### State 구조

```javascript
// game.js가 export하는 단일 상태 객체
export let state = {
  turn: 1,                  // 현재 라운드 번호
  currentFaction: 0,        // 현재 행동 중인 진영 id
  bases: [                  // 진영별 기지
    { factionId, col, row, hp, maxHp }
  ],
  units: [                  // 전체 유닛 배열
    { id, factionId, type, col, row, hp, maxHp, moved, attacked }
  ],
  selected: null,           // 선택된 유닛 id (null = 없음)
  reachable: [],            // 이동 가능 헥스 [{col,row}]
  attackable: [],           // 공격 가능 타깃 [{kind:'unit'|'base', id|factionId}]
  defeated: [],             // 패배한 진영 id 배열
  winner: null,             // 승자 factionId (null = 진행중)
  logs: [],                 // 전투 로그 [{msg, type}]
};
```

#### 주요 함수

```javascript
export function initState()
// 상태를 초기화. units/bases 생성, 모든 필드 리셋.

export function endTurn()
// 현재 진영 유닛 moved/attacked 리셋 → 다음 살아있는 진영으로 전환

export function getUnitAt(col, row): Unit | null
export function getBaseAt(col, row): Base | null

export function selectUnit(unit)
// state.selected 설정, reachable/attackable 계산

export function clearSelection()
// state.selected = null, reachable = [], attackable = []

export function defeatFaction(factionId)
// defeated 배열에 추가, 해당 진영 유닛 hp = 0

export function checkWinCondition()
// alive 진영 1개 남으면 state.winner 설정
```

---

### 2.5 `public/js/combat.js`

**역할**: 전투·회복 계산 및 실행

#### 데미지 공식

```
baseDmg = UNIT_TYPES[attacker.type].atk
if (attacker.type === 'AT' && target.type === 'TANK') baseDmg *= 1.5
finalDmg = round(baseDmg * uniform(0.8, 1.2))   // ±20% 랜덤 분산
```

#### 함수 목록

```javascript
// 공격 대상 목록 반환 (유닛 + 기지)
export function getAttackTargets(unit): Array<Target>

// 회복 대상 목록 반환 (인접 아군)
export function getHealTargets(unit): Array<Unit>

// 공격 실행 (상태 변경 포함)
export function performAttack(attacker, target)
// → target.hp 감소 → 사망 처리 → 기지 파괴 시 defeatFaction() 호출

// 회복 실행
export function performHeal(healer, target)
// → target.hp += 15 (maxHp 초과 불가)
```

#### 행동 제약

| 유닛 | 이동 후 공격 | 공격 후 이동 |
|------|------------|------------|
| 탱크, 보병, AT, 의무병 | 가능 | 불가 |
| 야포 | **불가** (`no_move_fire`) | 불가 |

---

### 2.6 `public/js/render.js`

**역할**: Canvas 전체 재렌더링 (`render()` 호출 시 전체 다시 그림)

#### 렌더링 레이어 순서

```
1. 배경 fill (전체 canvas)
2. 헥스 타일 (전체 맵)
   - 기본 / 이동 가능(녹색) / 이동 불가
3. 기지 (★ 아이콘 + HP 바)
4. 유닛 (작은 헥사곤 + 기호 + HP 바)
   - 선택됨: 흰 테두리
   - 공격 가능: 주황 테두리
   - 행동 완료: 어두운 오버레이
5. 이동 가능 헥스 점(dot) 오버레이
6. 회복 가능 아군 녹색 글로우
```

#### 함수 목록

```javascript
export function render(canvas, ctx, state)

// 내부 헬퍼 (export 불필요)
function drawHex(ctx, x, y, size, fill, stroke, lineWidth)
function drawUnit(ctx, unit, isSelected, isAttackTarget, isCurrentFaction)
function drawBase(ctx, base, isAttackTarget)
function drawHpBar(ctx, x, y, width, ratio)
```

---

### 2.7 `public/js/ui.js`

**역할**: 사이드바 DOM 조작, 전투 로그 관리

#### 함수 목록

```javascript
export function updateHeader(state)
// #turn-info, #phase-info 텍스트·색상 업데이트

export function updateSidebar(unit, state)
// #unit-name, #unit-stats (HP 바 포함), #faction-rows 업데이트

export function addLog(state, msg, type)
// type: 'combat' | 'move' | 'heal' | 'system'
// state.logs 맨 앞에 삽입, 최대 100개 유지

export function renderLog(state)
// #log-list DOM 재렌더링 (최신 50개만 표시)

export function showOverlay(title, msg)
// #overlay .show 클래스 추가

export function hideOverlay()
```

---

### 2.8 `public/js/main.js`

**역할**: 진입점. 모듈 연결, 이벤트 바인딩, 게임 초기화

#### 클릭 처리 흐름

```
canvas.click(e)
  │
  ├─ pixelToHex(px, py) → hex
  │
  ├─ [유닛 선택 중]
  │    ├─ 클릭 = 공격 가능 타깃?  → performAttack() → clearSelection() → render()
  │    ├─ 클릭 = 회복 가능 아군?  → performHeal()   → clearSelection() → render()
  │    ├─ 클릭 = 이동 가능 헥스?  → unit.col/row 이동 → 공격 타깃 재계산 → render()
  │    ├─ 클릭 = 다른 아군 유닛?  → selectUnit() → render()
  │    └─ 그 외                  → clearSelection() → render()
  │
  └─ [선택 없음]
       └─ 클릭 = 현재 진영 유닛?  → selectUnit() → render()
```

#### 초기화 순서

```javascript
window.onload = () => {
  resizeCanvas();
  newGame();
};

function newGame() {
  initState();          // game.js
  hideOverlay();        // ui.js
  updateHeader(state);  // ui.js
  updateSidebar(null, state); // ui.js
  addLog(state, '새 게임 시작', 'system');
  render(canvas, ctx, state); // render.js
}
```

---

## 3. HTML 구조

```html
<body>
  <div id="header">
    <h1>WW2 HEX BATTLE</h1>
    <div id="turn-info"></div>
    <div id="phase-info"></div>
    <button onclick="endTurn()">턴 종료</button>
    <button onclick="newGame()">새 게임</button>
  </div>

  <div id="main">
    <div id="canvas-container">
      <canvas id="gameCanvas"></canvas>
      <div id="overlay">  <!-- 게임 오버 오버레이 -->
        <h2 id="overlay-title"></h2>
        <p id="overlay-msg"></p>
        <button onclick="newGame()">새 게임</button>
      </div>
    </div>

    <div id="sidebar">
      <section id="unit-info">   <!-- 유닛 정보 -->
      <section id="faction-status"> <!-- 진영별 기지 HP -->
      <section id="legend">      <!-- 범례 -->
      <section id="battle-log">  <!-- 전투 로그 -->
    </div>
  </div>

  <script type="module" src="/js/main.js"></script>
</body>
```

---

## 4. CSS 레이아웃

```
body (flex, column, 100vh)
  ├── #header (flex, 고정 높이 ~40px)
  └── #main (flex, row, flex:1)
        ├── #canvas-container (flex:1, position:relative)
        │     └── canvas (width/height = container 크기)
        └── #sidebar (width:220px, flex-column)
              ├── #unit-info     (flex-shrink:0)
              ├── #faction-status (flex-shrink:0)
              ├── #legend        (flex-shrink:0)
              └── #battle-log    (flex:1, overflow-y:auto)
```

---

## 5. 데이터 흐름 다이어그램

```
사용자 클릭
    │
main.js (handleClick)
    │
    ├─[이동]──→ game.js (unit 위치 변경)
    │                │
    ├─[공격]──→ combat.js (performAttack)
    │                │
    │           game.js (hp 감소, defeatFaction, checkWinCondition)
    │
    ├─[회복]──→ combat.js (performHeal)
    │
    └─[공통]──→ render.js (render)     ← Canvas 재렌더
              → ui.js    (updateSidebar, addLog, renderLog)
```

---

## 6. 유닛 행동 상태 머신

```
[대기] ──선택──→ [선택됨]
                    │
          ┌─────────┼─────────┐
          ↓         ↓         ↓
        [이동]    [공격]    [회복]
          │         │         │
          │    [이동+공격]   attacked=true
          │         │
          └────→ [행동완료] (moved=true, attacked=true)
                    │
              턴 종료 시 리셋
```

---

## 7. 파일 목록 및 역할 요약

| 파일 | 줄 수 목표 | 역할 |
|------|-----------|------|
| `server.js` | ~40 | http 정적 서버 |
| `public/index.html` | ~60 | DOM 뼈대 |
| `public/style.css` | ~150 | 전체 스타일 |
| `public/js/units.js` | ~50 | 상수 정의 |
| `public/js/hex.js` | ~80 | 좌표 수학 |
| `public/js/game.js` | ~120 | 상태 관리 |
| `public/js/combat.js` | ~80 | 전투 로직 |
| `public/js/render.js` | ~150 | Canvas 렌더링 |
| `public/js/ui.js` | ~100 | DOM UI |
| `public/js/main.js` | ~100 | 진입점·이벤트 |

---

## 8. 구현 순서 (Do Phase 기준)

1. `server.js` + `package.json` → `npm start` 동작 확인
2. `index.html` + `style.css` → 레이아웃 뼈대 확인
3. `units.js` → 상수 정의
4. `hex.js` → 좌표 함수, `hexCenter`·`hexDistance` 검증
5. `game.js` → `initState()`, 쿼리 함수
6. `render.js` → 헥스 맵 + 기지 + 유닛 렌더링
7. `main.js` → 클릭 이벤트, 선택·이동 동작
8. `combat.js` → 공격·회복 로직
9. `ui.js` → 사이드바, 로그 패널
10. 통합 테스트 → 턴 전환, 승패 판정
