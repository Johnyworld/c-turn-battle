// ── 맵 상수 ──
export const MAP_COLS = 17;
export const MAP_ROWS = 11;
export const HEX_SIZE = 32; // 헥스 외접원 반지름(px)

// ── 진영 정의 (2진영: 소련군 제거) ──
export const FACTIONS = [
  { id: 0, name: '연합군', color: '#3a7fd5', lightColor: '#6af', baseColor: '#1a4a8a' },
  { id: 1, name: '추축군', color: '#b03030', lightColor: '#f66', baseColor: '#6a1010' },
];

// ── 유닛 타입 정의 ──
export const UNIT_TYPES = {
  TANK:  { symbol: 'T',  label: '탱크',       hp: 80, atk: 35, move: 3, range: 1, special: null },
  ARTY:  { symbol: 'A',  label: '야포',       hp: 40, atk: 50, move: 1, range: 3, special: 'no_move_fire' },
  INF:   { symbol: 'I',  label: '보병',       hp: 50, atk: 20, move: 2, range: 1, special: null },
  AT:    { symbol: 'AT', label: '대전차보병', hp: 40, atk: 45, move: 2, range: 1, special: 'anti_tank' },
  MEDIC: { symbol: 'M',  label: '의무병',     hp: 30, atk: 5,  move: 2, range: 1, special: 'heal' },
};

// ── 기지 위치 [factionId] — 좌우 대칭 중앙 ──
export const BASE_POSITIONS = [
  { col: 1,  row: 5 }, // 연합군 — 좌측 중앙
  { col: 15, row: 5 }, // 추축군 — 우측 중앙
];

// ── 초기 유닛 배치 (기지 기준 상대 오프셋) ──
// dir = +1(연합군) 또는 -1(추축/소련) 로 col 방향 반전
export const INIT_UNITS = [
  { type: 'TANK',  dc: 2, dr:  0 },
  { type: 'TANK',  dc: 1, dr:  1 },
  { type: 'ARTY',  dc: 3, dr:  0 },
  { type: 'INF',   dc: 2, dr:  1 },
  { type: 'INF',   dc: 2, dr: -1 },
  { type: 'INF',   dc: 1, dr:  0 },
  { type: 'AT',    dc: 3, dr:  1 },
  { type: 'MEDIC', dc: 1, dr: -1 },
];
