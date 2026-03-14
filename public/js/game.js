import { FACTIONS, UNIT_TYPES, BASE_POSITIONS, INIT_UNITS } from './units.js';
import { getReachable, hexDistance, hexNeighbors } from './hex.js';

// ── 단일 공유 상태 객체 ──
export const state = {
  turn: 1,
  currentFaction: 0,
  playerFaction: 0,   // 플레이어가 선택한 진영 id
  aiFaction: 1,       // AI가 조종하는 진영 id
  bases: [],
  units: [],
  selected: null,     // 선택된 유닛 id
  reachable: [],      // [{col, row}]
  attackable: [],     // [{kind:'unit'|'base', id|factionId}]
  defeated: [],       // 패배한 factionId 배열
  winner: null,       // 승자 factionId (null=진행중)
  logs: [],           // [{msg, type}]
};

let _unitIdSeq = 0;

// ── 상태 초기화 ──
export function initState(playerFaction = 0) {
  _unitIdSeq = 0;

  state.turn = 1;
  state.currentFaction = 0;
  state.playerFaction = playerFaction;
  state.aiFaction = 1 - playerFaction;
  state.selected = null;
  state.reachable = [];
  state.attackable = [];
  state.defeated = [];
  state.winner = null;
  state.logs = [];

  // 기지 생성
  state.bases = BASE_POSITIONS.map((pos, fi) => ({
    factionId: fi,
    col: pos.col,
    row: pos.row,
    hp: 200,
    maxHp: 200,
  }));

  // 유닛 생성
  state.units = [];
  FACTIONS.forEach((_, fi) => {
    const base = state.bases[fi];
    const dir = fi === 0 ? 1 : -1; // 연합군은 우측으로, 나머지는 좌측으로 전개
    INIT_UNITS.forEach(def => {
      const col = Math.max(0, Math.min(16, base.col + def.dc * dir));
      const row = Math.max(0, Math.min(10, base.row + def.dr));
      const type = UNIT_TYPES[def.type];
      state.units.push({
        id: _unitIdSeq++,
        factionId: fi,
        type: def.type,
        col, row,
        hp: type.hp,
        maxHp: type.hp,
        moved: false,
        attacked: false,
      });
    });
  });
}

// ── 쿼리 헬퍼 ──
export function getUnitAt(col, row) {
  return state.units.find(u => u.col === col && u.row === row && u.hp > 0) ?? null;
}

export function getBaseAt(col, row) {
  return state.bases.find(b => b.col === col && b.row === row) ?? null;
}

export function getAliveUnits(factionId) {
  return state.units.filter(u => u.factionId === factionId && u.hp > 0);
}

// ── 유닛 선택 ──
export function selectUnit(unit) {
  state.selected = unit.id;

  if (!unit.moved && !unit.attacked) {
    // 이동 + 공격 모두 가능
    state.reachable = _computeReachable(unit);
    state.attackable = _computeAttackable(unit);
  } else if (unit.moved && !unit.attacked) {
    // 이동 완료, 공격만 가능
    state.reachable = [];
    state.attackable = _computeAttackable(unit);
  } else {
    state.reachable = [];
    state.attackable = [];
  }
}

export function clearSelection() {
  state.selected = null;
  state.reachable = [];
  state.attackable = [];
}

// ── 이동 후 상태 업데이트 ──
export function moveUnit(unit, col, row) {
  unit.col = col;
  unit.row = row;
  unit.moved = true;
  // 이동 후 공격 대상 재계산
  state.reachable = [];
  state.attackable = _computeAttackable(unit);
  // 야포는 이동 후 공격 불가
  if (UNIT_TYPES[unit.type].special === 'no_move_fire') {
    unit.attacked = true;
    state.attackable = [];
  }
}

// ── 턴 종료 ──
export function endTurn() {
  if (state.winner !== null) return;

  // 현재 진영 유닛 리셋
  state.units
    .filter(u => u.factionId === state.currentFaction)
    .forEach(u => { u.moved = false; u.attacked = false; });

  clearSelection();

  // 2진영 전환 (0↔1)
  const next = 1 - state.currentFaction;
  if (next === 0) state.turn++;
  state.currentFaction = next;
}

// ── 진영 패배 처리 ──
export function defeatFaction(factionId) {
  if (state.defeated.includes(factionId)) return;
  state.defeated.push(factionId);
  // 해당 진영 유닛 전멸
  state.units.filter(u => u.factionId === factionId).forEach(u => { u.hp = 0; });
}

// ── 승리 조건 확인 ──
export function checkWinCondition() {
  const alive = FACTIONS.filter(f => !state.defeated.includes(f.id));
  if (alive.length === 1) {
    state.winner = alive[0].id;
    return alive[0].id;
  }
  if (alive.length === 0) {
    state.winner = -1; // 무승부
    return -1;
  }
  return null;
}

// ── 내부: 이동 가능 헥스 계산 ──
function _computeReachable(unit) {
  const type = UNIT_TYPES[unit.type];
  return getReachable(unit.col, unit.row, type.move, (col, row) => {
    // 다른 유닛이 있으면 통과/정지 불가
    const blocker = getUnitAt(col, row);
    if (blocker) return true;
    // 적 기지는 진입 불가
    const base = getBaseAt(col, row);
    if (base && base.factionId !== unit.factionId) return true;
    return false;
  });
}

// ── 내부: 공격 가능 타깃 계산 ──
function _computeAttackable(unit) {
  const type = UNIT_TYPES[unit.type];
  const targets = [];

  // 의무병은 공격 대신 회복 (별도 처리)
  if (type.special === 'heal') return [];

  // 적 유닛
  state.units
    .filter(u => u.factionId !== unit.factionId && u.hp > 0 && !state.defeated.includes(u.factionId))
    .forEach(enemy => {
      if (hexDistance(unit.col, unit.row, enemy.col, enemy.row) <= type.range) {
        targets.push({ kind: 'unit', id: enemy.id });
      }
    });

  // 적 기지 (range 1 이상이면 공격 가능)
  state.bases
    .filter(b => b.factionId !== unit.factionId && b.hp > 0 && !state.defeated.includes(b.factionId))
    .forEach(base => {
      if (hexDistance(unit.col, unit.row, base.col, base.row) <= type.range) {
        targets.push({ kind: 'base', factionId: base.factionId });
      }
    });

  return targets;
}

// ── 의무병 회복 대상 계산 ──
export function getHealTargets(unit) {
  if (UNIT_TYPES[unit.type].special !== 'heal') return [];
  return hexNeighbors(unit.col, unit.row)
    .map(nb => getUnitAt(nb.col, nb.row))
    .filter(u => u && u.factionId === unit.factionId && u.hp < u.maxHp);
}
