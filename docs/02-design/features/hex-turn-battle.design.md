# Design: 헥스 격자 턴제 전투 (hex-turn-battle)

> Plan 참조: `docs/01-plan/features/hex-turn-battle.plan.md`

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 헥스 격자 연합군 vs 추축군 턴제 전투 (진영 선택 화면 + AI 대결 + Fog of War) |
| Design Date | 2026-03-14 |
| Level | Dynamic |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| **Problem** | 고정 진영 배정으로 플레이 다양성이 없었고, 3진영 구조는 밸런스가 복잡 |
| **Solution** | 2진영 단순화 + 진영 선택 화면으로 플레이어가 연합군·추축군 중 하나를 선택, 나머지를 AI 조종 |
| **Function UX Effect** | 진영 선택 → 전투 전환의 명확한 플로우 / Fog of War 플레이어 기준 적용 |
| **Core Value** | 양측 진영 경험 가능한 1:1 WWII 전략 대결 |

---

## 1. 아키텍처 개요

```
[Browser]
  └── http://localhost:3000
        │
[Node.js server.js]  ← http 모듈, 정적 파일 서빙
        │
[public/]
  ├── index.html       ← 진영 선택 화면(#faction-select) + 게임 화면(#game-screen)
  ├── style.css        ← 진영 선택 카드 UI + 게임 전체 스타일
  └── js/              ← ES Modules (type="module")
      ├── main.js      ← 진입점: 진영 선택 → 게임 전환, AI 턴 자동 실행, Fog 토글
      ├── units.js     ← 상수: FACTIONS(2개), UNIT_TYPES, BASE_POSITIONS(좌우 중앙)
      ├── hex.js       ← 순수 함수: 좌표 변환, BFS, 거리 계산
      ├── game.js      ← 상태 관리: initState(playerFaction), playerFaction/aiFaction 포함
      ├── combat.js    ← 전투 로직: calcDamage(), attack(), heal()
      ├── render.js    ← Canvas 렌더링: render() + Fog 오버레이 레이어
      ├── ui.js        ← DOM 업데이트: updateHeader(), updateSidebar(), addLog()
      ├── ai.js        ← AI 엔진: runAiTurn(aiFaction), aiActUnit()
      └── fog.js       ← Fog of War: computeVisibleHexes(state, playerFaction)
```

### 모듈 의존 관계

```
main.js
  ├── units.js   (상수만, 의존 없음)
  ├── hex.js     (순수 함수만, 의존 없음)
  ├── game.js    ← units.js, hex.js
  ├── combat.js  ← units.js, game.js
  ├── render.js  ← units.js, hex.js, game.js
  ├── ui.js      ← units.js, game.js
  ├── ai.js      ← units.js, hex.js, game.js, combat.js
  └── fog.js     ← units.js, hex.js
```

**원칙**: 순환 의존 금지. `units.js`·`hex.js`는 리프 모듈. `fog.js`도 단방향 의존.

---

## 2. 파일별 상세 설계

### 2.1 `server.js`

**역할**: Node.js 내장 `http` 모듈로 `public/` 정적 파일 서빙 (변경 없음)

```javascript
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

### 2.2 `public/js/units.js` [수정]

**역할**: 게임 상수 정의 — 소련군 제거, 기지 위치 좌우 중앙으로 변경

```javascript
// 2개 진영만 (소련군 제거)
export const FACTIONS = [
  { id: 0, name: '연합군', color: '#3a7fd5', lightColor: '#6af', baseColor: '#1a4a8a' },
  { id: 1, name: '추축군', color: '#b03030', lightColor: '#f66', baseColor: '#6a1010' },
];

export const UNIT_TYPES = {
  TANK:  { symbol:'T',  label:'탱크',       hp:80, atk:35, move:3, range:1, special:'anti_tank_bonus' },
  ARTY:  { symbol:'A',  label:'야포',       hp:40, atk:50, move:1, range:3, special:'no_move_fire'   },
  INF:   { symbol:'I',  label:'보병',       hp:50, atk:20, move:2, range:1, special:null              },
  AT:    { symbol:'AT', label:'대전차보병', hp:40, atk:45, move:2, range:1, special:'anti_tank'       },
  MEDIC: { symbol:'M',  label:'의무병',     hp:30, atk:5,  move:2, range:1, special:'heal'            },
};

export const MAP_COLS = 17;
export const MAP_ROWS = 11;
export const HEX_SIZE = 32;

// 좌측 중앙(연합군) / 우측 중앙(추축군)
export const BASE_POSITIONS = [
  { col: 1,  row: 5 },   // 연합군 기지
  { col: 15, row: 5 },   // 추축군 기지
];

// 기지 기준 초기 유닛 배치 오프셋
// 연합군: dc 양수(오른쪽), 추축군: dc 음수(왼쪽)로 각자 적용
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

> **Note**: 추축군 유닛 배치 시 `dc`에 `-1`을 곱해 기지 왼쪽으로 전개.

---

### 2.3 `public/js/hex.js`

**역할**: 헥스 좌표 관련 순수 함수 모음 (변경 없음)

#### 좌표 방식: Offset (odd-r)

- 짝수 행: 왼쪽 정렬
- 홀수 행: 오른쪽으로 0.5칸 오프셋

#### 함수 목록

```javascript
export function hexCenter(col, row): { x, y }
export function pixelToHex(px, py): { col, row } | null
export function hexNeighbors(col, row): Array<{col, row}>
export function hexDistance(c1, r1, c2, r2): number
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

### 2.4 `public/js/game.js` [수정]

**역할**: 게임 전체 상태(State) 관리 — `playerFaction` / `aiFaction` 추가

#### State 구조

```javascript
export let state = {
  turn: 1,
  currentFaction: 0,
  playerFaction: 0,     // [신규] 플레이어가 선택한 진영 id
  aiFaction: 1,         // [신규] AI가 조종하는 진영 id (= 1 - playerFaction)
  bases: [
    { factionId, col, row, hp, maxHp }
  ],
  units: [
    { id, factionId, type, col, row, hp, maxHp, moved, attacked }
  ],
  selected: null,
  reachable: [],
  attackable: [],
  defeated: [],
  winner: null,
  logs: [],
};
```

#### 주요 함수

```javascript
// playerFaction 파라미터 추가 (기본값 0 = 연합군)
export function initState(playerFaction = 0)
// - state.playerFaction = playerFaction
// - state.aiFaction = 1 - playerFaction
// - 유닛/기지 생성 시 추축군(id=1) dc 방향 반전 적용
// - currentFaction = 0 (연합군부터 시작, 순서 고정)

export function endTurn()
// 현재 진영 유닛 moved/attacked 리셋 → 다음 진영(0↔1)으로 전환

export function getUnitAt(col, row): Unit | null
export function getBaseAt(col, row): Base | null
export function getAliveUnits(factionId): Unit[]

export function selectUnit(unit)
export function clearSelection()

export function defeatFaction(factionId)
export function checkWinCondition(): number | null
// 반환: 승자 factionId, null(진행중)

export function getHealTargets(unit): Unit[]
// 인접 아군 중 HP < maxHp인 유닛 목록
```

#### 초기 배치 로직 (initState 내부)

```
연합군(id=0): BASE_POSITIONS[0] 기준, dc 방향 +1 (오른쪽)
추축군(id=1): BASE_POSITIONS[1] 기준, dc 방향 -1 (왼쪽)

각 유닛 col = base.col + dc * dirMultiplier
           row = base.row + dr
```

---

### 2.5 `public/js/combat.js`

**역할**: 전투·회복 계산 및 실행 (변경 없음)

#### 데미지 공식

```
baseDmg = UNIT_TYPES[attacker.type].atk
if (attacker.type === 'AT' && target.type === 'TANK') baseDmg *= 1.5
finalDmg = round(baseDmg * uniform(0.8, 1.2))   // ±20% 랜덤 분산
```

#### 함수 목록

```javascript
export function attackUnit(attacker, targetId)
export function attackBase(attacker, targetFactionId)
export function performHeal(healer, target)
// target.hp += 15 (maxHp 초과 불가)
```

#### 행동 제약

| 유닛 | 이동 후 공격 | 공격 후 이동 |
|------|------------|------------|
| 탱크, 보병, AT, 의무병 | 가능 | 불가 |
| 야포 | **불가** (`no_move_fire`) | 불가 |

---

### 2.6 `public/js/render.js`

**역할**: Canvas 전체 재렌더링 (Fog 로직에서 playerFaction 반영)

#### 렌더링 레이어 순서

```
1. 배경 fill (전체 canvas)
2. 헥스 타일 (전체 맵) — 기본 / 이동 가능(녹색)
3. 기지 (★ 아이콘 + HP 바)
   - fogEnabled && base.factionId !== playerFaction && !isVisible → 스킵
4. 유닛 (작은 헥사곤 + 기호 + HP 바)
   - fogEnabled && unit.factionId !== playerFaction && !isVisible → 스킵
5. 이동 가능 헥스 점(dot) 오버레이
6. Fog 오버레이 — 비가시 헥스에 rgba(0,0,0,0.78)
```

> **변경**: 기존 `factionId !== 0` 하드코딩 → `factionId !== state.playerFaction` 으로 교체.

#### 함수 시그니처

```javascript
// fogEnabled: boolean, visibleSet: Set<"col,row"> | null
export function render(canvas, ctx, state, fogEnabled = false, visibleSet = null)

// 내부 헬퍼
function drawHex(ctx, x, y, size, fill, stroke, lineWidth)
function drawHpBar(ctx, cx, y, width, ratio)
function darken(hex, factor): string
```

---

### 2.7 `public/js/ui.js`

**역할**: 사이드바 DOM 조작, 전투 로그 관리 (변경 없음)

```javascript
export function updateHeader(state)
// #turn-info, #phase-info 텍스트·색상 업데이트

export function updateSidebar(unit, state)
// #unit-name, #unit-stats, #faction-rows 업데이트

export function addLog(state, msg, type)
// type: 'combat' | 'move' | 'heal' | 'system'

export function renderLog(state)
export function showOverlay(title, msg)
export function hideOverlay()
```

---

### 2.8 `public/js/main.js` [수정]

**역할**: 진입점 — 진영 선택 화면 제어, AI 턴 자동 실행, Fog 토글

#### 주요 상태 변수 (main.js 로컬)

```javascript
let fogEnabled = true;
let isAiTurn  = false;
```

#### 진영 선택 → 게임 전환 흐름

```
[페이지 로드]
  │
  ▼
showFactionSelect()   ← #faction-select 표시, #game-screen 숨김
  │
  ├─ 연합군 카드 클릭 → startGame(0)   playerFaction=0, aiFaction=1
  └─ 추축군 카드 클릭 → startGame(1)   playerFaction=1, aiFaction=0
        │
        ▼
hideFactionSelect()   ← #faction-select 숨김, #game-screen 표시
initState(playerFaction)
isAiTurn = false
addLog / updateHeader / updateSidebar / redraw()

  [게임 오버]
    ├─ 재도전 버튼    → startGame(playerFaction)   같은 진영 유지
    └─ 진영 재선택    → showFactionSelect()         선택 화면 복귀
```

#### 클릭 처리 흐름 (전투 중)

```
canvas.click(e)
  │
  ├─ isAiTurn === true → 즉시 return (클릭 차단)
  ├─ pixelToHex(px, py) → hex
  │
  ├─ [유닛 선택 중]
  │    ├─ 공격 가능 타깃   → attackUnit/attackBase() → clearSelection() → redraw()
  │    ├─ 회복 가능 아군   → performHeal()           → clearSelection() → redraw()
  │    ├─ 이동 가능 헥스   → moveUnit() → 재계산     → redraw()
  │    ├─ 다른 아군 유닛   → selectUnit()            → redraw()
  │    └─ 그 외            → clearSelection()         → redraw()
  │
  └─ [선택 없음]
       └─ 현재 진영 유닛   → selectUnit() → redraw()
```

#### AI 턴 자동 실행 흐름

```
endTurn() 호출
  │
  ├─ gameEndTurn()  ← game.js (currentFaction 전환)
  │
  └─ state.currentFaction === state.aiFaction?
       ├─ YES → isAiTurn = true
       │         updateAiTurnUI(true)
       │         runAiTurn(aiFaction, onUnitDone)  ← ai.js (async)
       │           └─ 완료 → isAiTurn = false → updateAiTurnUI(false)
       │                     checkWinCondition() → handleGameEnd (필요 시)
       │                     await endTurn()      (다음 턴 자동 전환)
       └─ NO  → 플레이어 턴, 입력 대기
```

#### `redraw()` 헬퍼

```javascript
function redraw() {
  const visibleSet = fogEnabled ? computeVisibleHexes(state) : null;
  render(canvas, ctx, state, fogEnabled, visibleSet);
}
```

#### 이벤트 바인딩 목록

```javascript
// 진영 선택 화면
document.getElementById('btn-allied').addEventListener('click', () => startGame(0));
document.getElementById('btn-axis').addEventListener('click', () => startGame(1));

// 게임 화면
canvas.addEventListener('click', handleClick);
window.addEventListener('resize', resizeCanvas);
document.getElementById('btn-end-turn').addEventListener('click', endTurn);
document.getElementById('btn-new-game').addEventListener('click', () => startGame(state.playerFaction));
document.getElementById('btn-fog-toggle').addEventListener('click', toggleFog);

// 게임 오버 오버레이
document.getElementById('btn-overlay-retry').addEventListener('click', () => startGame(state.playerFaction));
document.getElementById('btn-overlay-reselect').addEventListener('click', showFactionSelect);
```

---

### 2.9 `public/js/ai.js` [수정]

**역할**: `aiFaction` 기준 AI 턴 자동 실행 엔진

> **변경**: 기존 `factionId !== 0` 하드코딩 제거. `runAiTurn(factionId, onUnitDone)` 호출 시 전달받은 `factionId`(= `state.aiFaction`)를 그대로 사용.

#### 함수 목록

```javascript
// AI 턴 진입점 — async, 유닛별 300ms 딜레이
export async function runAiTurn(factionId, onUnitDone)

// 단일 유닛 행동 결정 및 실행
function aiActUnit(unit, enemyFactionId)
// enemyFactionId = 1 - factionId (항상 상대 진영)

function pickLowestHpTarget(targets): Target | null
function bestMoveToward(unit, targetCol, targetRow): {col, row} | null
function delay(ms): Promise<void>
```

#### AI 행동 우선순위

```
1. [의무병] 인접 아군 HP < 50% → 회복 (performHeal)
2. [야포]   사거리 내 적 존재 → 이동 없이 공격
3. [일반]   공격 가능 타깃 → 최저 HP 타깃 공격
4. [일반]   공격 불가 → bestMoveToward(적 기지) → 이동 후 재공격 시도
5. 없음 → idle
```

#### 딜레이 처리

```javascript
export async function runAiTurn(factionId, onUnitDone) {
  const units = getAliveUnits(factionId);
  for (const unit of units) {
    await delay(300);
    aiActUnit(unit, 1 - factionId);
    onUnitDone(unit);   // → main.js: redraw() + renderLog()
  }
}
```

---

### 2.10 `public/js/fog.js` [수정]

**역할**: 플레이어 진영 기준 Fog of War 가시 헥스 계산

> **변경**: 기존 연합군(factionId === 0) 고정 → `state.playerFaction` 기준으로 변경.

#### 함수 목록

```javascript
// playerFaction 유닛 시야 합집합 + playerFaction 기지 → Set<"col,row">
export function computeVisibleHexes(state): Set<string>

function addSightCircle(set, centerCol, centerRow, radius)
```

#### 시야 상수

```javascript
const SIGHT_RADIUS = 3;
```

#### 계산 방식

```
const pf = state.playerFaction

visibleSet = new Set()

살아있는 playerFaction 유닛 각각:
  for r in MAP_ROWS, c in MAP_COLS:
    if hexDistance(unit, {c,r}) <= SIGHT_RADIUS:
      visibleSet.add(`${c},${r}`)

playerFaction 기지 (항상 가시):
  addSightCircle(visibleSet, base.col, base.row, SIGHT_RADIUS)

return visibleSet
```

---

## 3. HTML 구조 [수정]

```html
<body>
  <!-- ① 진영 선택 화면 -->
  <div id="faction-select">
    <div class="fs-title">WW2 HEX BATTLE</div>
    <div class="fs-subtitle">진영을 선택하세요</div>
    <div class="fs-cards">
      <button id="btn-allied" class="fs-card allied">
        <div class="fs-card-icon">⚔</div>
        <div class="fs-card-name">연합군</div>
        <div class="fs-card-desc">ALLIES</div>
      </button>
      <button id="btn-axis" class="fs-card axis">
        <div class="fs-card-icon">⚔</div>
        <div class="fs-card-name">추축군</div>
        <div class="fs-card-desc">AXIS</div>
      </button>
    </div>
  </div>

  <!-- ② 전투 화면 (진영 선택 후 표시) -->
  <div id="game-screen" style="display:none; flex-direction:column; height:100vh;">
    <div id="header">
      <h1>⚔ WW2 HEX BATTLE ⚔</h1>
      <div id="turn-info">Turn 1</div>
      <div id="phase-info">연합군의 턴</div>
      <button id="btn-fog-toggle">FOG ON</button>
      <button id="btn-end-turn">턴 종료</button>
      <button id="btn-new-game">새 게임</button>
    </div>

    <div id="main">
      <div id="canvas-container">
        <canvas id="gameCanvas"></canvas>
        <div id="overlay">
          <h2 id="overlay-title"></h2>
          <p id="overlay-msg"></p>
          <button id="btn-overlay-retry">재도전</button>
          <button id="btn-overlay-reselect">진영 재선택</button>
        </div>
      </div>

      <div id="sidebar">
        <section class="sidebar-section" id="unit-info">
          <h3>유닛 정보</h3>
          <div id="unit-name">유닛을 선택하세요</div>
          <div id="unit-stats"></div>
        </section>
        <section class="sidebar-section" id="faction-status">
          <h3>진영 상태</h3>
          <div id="faction-rows"></div>
        </section>
        <section class="sidebar-section" id="legend-section">
          <h3>범례</h3>
          <div id="legend">
            <span style="color:#6af">■ 연합군</span>
            <span style="color:#f66">■ 추축군</span><br>
            T=탱크 &nbsp;A=야포 &nbsp;I=보병<br>
            AT=대전차 &nbsp;M=의무병<br>
            ★=기지 &nbsp;녹=이동 &nbsp;주=공격
          </div>
        </section>
        <section id="battle-log-section">
          <h3>전투 기록</h3>
          <div id="log-list"></div>
        </section>
      </div>
    </div>
  </div>

  <script type="module" src="/js/main.js"></script>
</body>
```

---

## 4. CSS 레이아웃 [수정]

### 진영 선택 화면

```css
/* #faction-select: 전체 화면 중앙 정렬 */
#faction-select {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #111;
  gap: 32px;
}

.fs-title { font-size: 28px; color: #c8a84b; letter-spacing: 4px; }
.fs-subtitle { font-size: 14px; color: #777; }

/* 카드 컨테이너: 가로 배열 */
.fs-cards { display: flex; gap: 40px; }

/* 개별 카드 */
.fs-card {
  width: 180px; height: 220px;
  border: 2px solid #444;
  border-radius: 8px;
  background: #1a1a1a;
  cursor: pointer;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px;
  transition: border-color 0.2s, background 0.2s;
}
.fs-card:hover { background: #222; }

/* 연합군 카드 강조 색 */
.fs-card.allied { border-color: #3a7fd5; }
.fs-card.allied:hover { border-color: #6af; background: #0d1a2d; }

/* 추축군 카드 강조 색 */
.fs-card.axis { border-color: #b03030; }
.fs-card.axis:hover { border-color: #f66; background: #2d0d0d; }

.fs-card-icon { font-size: 36px; }
.fs-card-name { font-size: 18px; font-weight: bold; color: #ddd; }
.fs-card-desc { font-size: 11px; color: #666; letter-spacing: 2px; }
```

### 전투 화면 레이아웃

```
#game-screen (flex, column, 100vh)
  ├── #header (flex, 고정 높이 ~40px)
  └── #main (flex, row, flex:1)
        ├── #canvas-container (flex:1, position:relative)
        │     ├── canvas
        │     └── #overlay (position:absolute, z-index:10)
        │           ├── #btn-overlay-retry
        │           └── #btn-overlay-reselect
        └── #sidebar (width:220px, flex-column)
              ├── #unit-info
              ├── #faction-status
              ├── #legend-section
              └── #battle-log-section (flex:1)
```

#### 오버레이 버튼 추가 스타일

```css
/* 재도전 / 진영 재선택 버튼 나란히 배치 */
#overlay { gap: 10px; }

#btn-overlay-retry {
  padding: 9px 24px;
  background: #c8a84b; color: #111;
  border: none; border-radius: 4px;
  font-size: 15px; font-family: inherit; font-weight: bold;
  cursor: pointer;
}
#btn-overlay-reselect {
  padding: 8px 20px;
  background: transparent; color: #999;
  border: 1px solid #555; border-radius: 4px;
  font-size: 13px; font-family: inherit;
  cursor: pointer;
}
#btn-overlay-reselect:hover { border-color: #999; color: #ccc; }
```

---

## 5. 데이터 흐름 다이어그램

### 5.1 진영 선택 → 게임 시작

```
[페이지 로드]
    │
showFactionSelect()    ← DOM: #faction-select 표시
    │
사용자 클릭
    ├─ 연합군 → startGame(0)
    └─ 추축군 → startGame(1)
        │
        ├─ hideFactionSelect() + showGameScreen()
        ├─ initState(playerFaction)  ← game.js
        ├─ updateHeader(state) / updateSidebar / addLog
        └─ redraw()
```

### 5.2 플레이어 턴

```
사용자 클릭
    │
main.js (handleClick) — isAiTurn 체크 → 차단
    │
    ├─[이동]──→ game.js (moveUnit)
    ├─[공격]──→ combat.js (attackUnit / attackBase)
    │               └─ game.js (defeatFaction, checkWinCondition)
    ├─[회복]──→ combat.js (performHeal)
    └─[공통]──→ redraw()
                  ├─ fog.js (computeVisibleHexes, playerFaction 기준)
                  └─ render.js (render)
              → ui.js (updateSidebar, addLog, renderLog)
```

### 5.3 AI 턴

```
endTurn() → gameEndTurn() → currentFaction = aiFaction
    │
    └─ isAiTurn = true
         │
         ai.js (runAiTurn(aiFaction) — async)
           └─ 유닛별 300ms 딜레이
                └─ aiActUnit(unit, playerFaction)
                     ├─ combat.js (attackUnit / attackBase / performHeal)
                     └─ game.js (moveUnit, defeatFaction, checkWinCondition)
                └─ onUnitDone → redraw() + renderLog()
         │
         완료 → isAiTurn = false → endTurn() 재호출 (플레이어 턴 전환)
```

### 5.4 게임 종료

```
checkWinCondition() → winner !== null
    │
handleGameEnd(winner)
    ├─ showOverlay(title, msg)
    │   ├─ btn-overlay-retry    → startGame(state.playerFaction)
    │   └─ btn-overlay-reselect → showFactionSelect()
    └─ redraw()
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

| 파일 | 상태 | 주요 변경 사항 |
|------|------|--------------|
| `server.js` | 완료 | 변경 없음 |
| `public/index.html` | **수정** | `#faction-select` 카드 화면 + `#game-screen` 래퍼 + 오버레이 버튼 2개 |
| `public/style.css` | **수정** | 진영 선택 카드 UI 스타일, 오버레이 버튼 추가 |
| `public/js/units.js` | **수정** | 소련군 제거, `BASE_POSITIONS` 좌우 중앙으로 변경 |
| `public/js/hex.js` | 완료 | 변경 없음 |
| `public/js/game.js` | **수정** | `playerFaction`/`aiFaction` 상태 추가, `initState(playerFaction)` |
| `public/js/combat.js` | 완료 | 변경 없음 |
| `public/js/render.js` | **수정** | `factionId !== playerFaction` 비가시 판정 |
| `public/js/ui.js` | 완료 | 변경 없음 |
| `public/js/main.js` | **수정** | 진영 선택 전환 로직, `startGame()`, 재도전/재선택 버튼 |
| `public/js/ai.js` | **수정** | `aiFaction` 동적 사용 (하드코딩 제거) |
| `public/js/fog.js` | **수정** | `state.playerFaction` 기준으로 시야 계산 |

---

## 8. 구현 순서 (Do Phase 기준)

### Phase 1 완료 (기존 구현)
1. ~~`server.js`, `package.json`~~
2. ~~`index.html`, `style.css` (기본 레이아웃)~~
3. ~~`units.js`, `hex.js`, `game.js`, `combat.js`, `render.js`, `ui.js`, `main.js`~~
4. ~~`ai.js`, `fog.js` (AI + Fog of War)~~

### Phase 2 구현 (2진영 전환 + 진영 선택 화면)
5. `units.js` — 소련군 제거, `FACTIONS` 2개, `BASE_POSITIONS` 좌우 중앙
6. `game.js` — `playerFaction`/`aiFaction` 상태, `initState(playerFaction)` 파라미터
7. `fog.js` — `state.playerFaction` 기준으로 시야 계산
8. `ai.js` — `aiFaction` 동적 사용, `enemyFactionId = 1 - factionId`
9. `render.js` — `unit.factionId !== state.playerFaction` 비가시 판정
10. `index.html` — `#faction-select` + `#game-screen` 구조, 오버레이 버튼 2개
11. `style.css` — 진영 선택 카드 스타일, 오버레이 버튼 추가
12. `main.js` — `startGame()`, `showFactionSelect()`, 재도전/재선택 이벤트
13. 통합 검증 — 양 진영 선택 → 전투 → AI 턴 → Fog → 게임 오버 → 재선택
