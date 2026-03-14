import { UNIT_TYPES } from './units.js';
import { hexDistance } from './hex.js';
import {
  state, getUnitAt, getHealTargets,
  moveUnit, selectUnit, clearSelection,
} from './game.js';
import { attackUnit, attackBase, performHeal } from './combat.js';

const AI_DELAY_MS = 300;

// ── AI 턴 진입점 ──
// onUnitDone(unit): 각 유닛 행동 후 호출 → main.js에서 redraw + log 갱신
export async function runAiTurn(factionId, onUnitDone) {
  const units = state.units.filter(u => u.factionId === factionId && u.hp > 0);
  for (const unit of units) {
    await delay(AI_DELAY_MS);
    aiActUnit(unit);
    onUnitDone(unit);
  }
}

// ── 단일 유닛 행동 결정 ──
function aiActUnit(unit) {
  const type = UNIT_TYPES[unit.type];

  // 1. 의무병: 인접 아군 HP < 50% 이면 회복
  if (type.special === 'heal') {
    const healTargets = getHealTargets(unit).filter(u => u.hp / u.maxHp < 0.5);
    if (healTargets.length > 0) {
      performHeal(unit, healTargets[0]);
      return;
    }
  }

  // 2. 야포: 이동 없이 사거리 내 적 공격
  if (type.special === 'no_move_fire') {
    const target = pickBestAttackTarget(unit);
    if (target) {
      doAttack(unit, target);
      return;
    }
    // 적 없으면 전진 (이동만, 공격 플래그 세팅)
    aiMove(unit);
    unit.attacked = true; // 야포는 이동 후 공격 불가
    return;
  }

  // 3. 일반 유닛: 공격 가능 타깃 → 공격
  const target = pickBestAttackTarget(unit);
  if (target) {
    doAttack(unit, target);
    return;
  }

  // 4. 이동 → 이동 후 재공격 시도
  const moved = aiMove(unit);
  if (moved) {
    const target2 = pickBestAttackTarget(unit);
    if (target2) doAttack(unit, target2);
  }

  // 행동 미완료 처리
  if (!unit.attacked) unit.attacked = true;
}

// ── 최저 HP 타깃 선택 ──
function pickBestAttackTarget(unit) {
  const type = UNIT_TYPES[unit.type];

  // 적 유닛
  const enemyUnits = state.units
    .filter(u => u.factionId !== unit.factionId && u.hp > 0 && !state.defeated.includes(u.factionId))
    .filter(u => hexDistance(unit.col, unit.row, u.col, u.row) <= type.range)
    .sort((a, b) => a.hp - b.hp); // 최저 HP 우선

  if (enemyUnits.length > 0) {
    return { kind: 'unit', id: enemyUnits[0].id };
  }

  // 적 기지
  const enemyBases = state.bases
    .filter(b => b.factionId !== unit.factionId && b.hp > 0 && !state.defeated.includes(b.factionId))
    .filter(b => hexDistance(unit.col, unit.row, b.col, b.row) <= type.range)
    .sort((a, b) => a.hp - b.hp);

  if (enemyBases.length > 0) {
    return { kind: 'base', factionId: enemyBases[0].factionId };
  }

  return null;
}

// ── 공격 실행 ──
function doAttack(unit, target) {
  if (target.kind === 'unit') {
    attackUnit(unit, target.id);
  } else {
    attackBase(unit, target.factionId);
  }
}

// ── 적 기지 방향으로 이동 ──
// 적 진영(= 플레이어 진영) 기지를 목표로, 이동 가능 헥스 중 목표와 가장 가까운 위치 선택
function aiMove(unit) {
  const playerFaction = state.playerFaction;
  const targetBase =
    state.bases.find(b => b.factionId === playerFaction && b.hp > 0) ||
    state.bases.find(b => b.factionId !== unit.factionId && b.hp > 0 && !state.defeated.includes(b.factionId));

  if (!targetBase) return false;

  selectUnit(unit); // reachable 계산
  const reachable = state.reachable.slice();
  clearSelection();

  if (reachable.length === 0) return false;

  // 목표 기지와 거리 기준 정렬 → 가장 가까운 헥스로 이동
  reachable.sort((a, b) =>
    hexDistance(a.col, a.row, targetBase.col, targetBase.row) -
    hexDistance(b.col, b.row, targetBase.col, targetBase.row)
  );

  const dest = reachable[0];
  moveUnit(unit, dest.col, dest.row);
  return true;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
