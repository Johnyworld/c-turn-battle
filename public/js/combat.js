import { UNIT_TYPES, FACTIONS } from './units.js';
import { state, defeatFaction, checkWinCondition } from './game.js';

// ── 데미지 계산 ──
function calcDamage(attacker, targetType) {
  let dmg = UNIT_TYPES[attacker.type].atk;
  // 대전차보병 vs 탱크 보너스 ×1.5
  if (attacker.type === 'AT' && targetType === 'TANK') {
    dmg = Math.round(dmg * 1.5);
  }
  // ±20% 랜덤 분산
  dmg = Math.round(dmg * (0.8 + Math.random() * 0.4));
  return dmg;
}

// ── 유닛 공격 ──
export function attackUnit(attacker, targetId) {
  const defender = state.units.find(u => u.id === targetId);
  if (!defender || defender.hp <= 0) return;

  const dmg = calcDamage(attacker, defender.type);
  defender.hp = Math.max(0, defender.hp - dmg);
  attacker.attacked = true;

  const atkName = FACTIONS[attacker.factionId].name;
  const defName = FACTIONS[defender.factionId].name;
  const atkLabel = UNIT_TYPES[attacker.type].label;
  const defLabel = UNIT_TYPES[defender.type].label;

  addLog(`${atkName} ${atkLabel} → ${defName} ${defLabel} : ${dmg} 피해 (남은HP ${defender.hp})`, 'combat');

  if (defender.hp <= 0) {
    addLog(`${defName} ${defLabel} 전멸!`, 'combat');
  }

  checkWinCondition();
}

// ── 기지 공격 ──
export function attackBase(attacker, targetFactionId) {
  const base = state.bases.find(b => b.factionId === targetFactionId);
  if (!base || base.hp <= 0) return;

  const dmg = calcDamage(attacker, 'BASE');
  base.hp = Math.max(0, base.hp - dmg);
  attacker.attacked = true;

  const atkName = FACTIONS[attacker.factionId].name;
  const defName = FACTIONS[targetFactionId].name;
  const atkLabel = UNIT_TYPES[attacker.type].label;

  addLog(`${atkName} ${atkLabel} → ${defName} 기지 : ${dmg} 피해 (기지HP ${base.hp})`, 'combat');

  if (base.hp <= 0) {
    addLog(`★ ${defName} 기지 함락! ${defName} 패배! ★`, 'system');
    defeatFaction(targetFactionId);
    checkWinCondition();
  }
}

// ── 회복 ──
export function performHeal(healer, target) {
  const amount = 15;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  healer.attacked = true;

  const name = FACTIONS[healer.factionId].name;
  const targetLabel = UNIT_TYPES[target.type].label;
  addLog(`${name} 의무병 → ${targetLabel} ${amount} 회복 (HP ${target.hp})`, 'heal');
}

// ── 로그 추가 (game.state 직접 접근) ──
function addLog(msg, type) {
  state.logs.unshift({ msg, type });
  if (state.logs.length > 100) state.logs.length = 100;
}
