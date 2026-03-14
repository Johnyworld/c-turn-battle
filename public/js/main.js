import { FACTIONS, UNIT_TYPES } from './units.js';
import { pixelToHex } from './hex.js';
import {
  state, initState,
  getUnitAt, getBaseAt, getHealTargets,
  selectUnit, clearSelection, moveUnit,
  endTurn as gameEndTurn, checkWinCondition,
} from './game.js';
import { attackUnit, attackBase, performHeal } from './combat.js';
import { render } from './render.js';
import {
  updateHeader, updateSidebar, updateFactionStatus,
  addLog, renderLog, showOverlay, hideOverlay,
} from './ui.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── Canvas 리사이즈 ──
function resizeCanvas() {
  const container = document.getElementById('canvas-container');
  canvas.width  = container.clientWidth;
  canvas.height = container.clientHeight;
  render(canvas, ctx, state);
}

// ── 새 게임 ──
function newGame() {
  hideOverlay();
  initState();
  addLog(state, '=== 새 게임 시작 ===', 'system');
  addLog(state, `${FACTIONS[0].name}의 턴`, 'system');
  updateHeader(state);
  updateSidebar(null, state);
  render(canvas, ctx, state);
}

// ── 턴 종료 ──
function endTurn() {
  if (state.winner !== null) return;
  gameEndTurn();
  clearSelection();
  addLog(state, `--- ${FACTIONS[state.currentFaction].name}의 턴 (Turn ${state.turn}) ---`, 'system');
  updateHeader(state);
  updateSidebar(null, state);
  render(canvas, ctx, state);
}

// ── 클릭 처리 ──
function handleClick(e) {
  if (state.winner !== null) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top)  * scaleY;

  const hex = pixelToHex(px, py);
  if (!hex) return;

  const { col, row } = hex;

  if (state.selected !== null) {
    _handleClickWithSelection(col, row);
  } else {
    _handleClickNoSelection(col, row);
  }

  // 승리 판정
  const winner = checkWinCondition();
  if (winner !== null) {
    if (winner === -1) {
      showOverlay('무승부', '모든 진영의 기지가 동시에 함락되었습니다.');
    } else {
      showOverlay(`${FACTIONS[winner].name} 승리!`, '모든 적 기지가 함락되었습니다.');
    }
  }

  updateSidebar(
    state.selected !== null ? state.units.find(u => u.id === state.selected) : null,
    state
  );
  render(canvas, ctx, state);
}

// ── 유닛 선택 중 클릭 ──
function _handleClickWithSelection(col, row) {
  const sel = state.units.find(u => u.id === state.selected);
  if (!sel) { clearSelection(); return; }

  // 1. 공격 가능 유닛?
  const unitTarget = state.attackable.find(t => {
    if (t.kind !== 'unit') return false;
    const u = state.units.find(u2 => u2.id === t.id);
    return u && u.col === col && u.row === row;
  });
  if (unitTarget) {
    attackUnit(sel, unitTarget.id);
    clearSelection();
    renderLog(state);
    return;
  }

  // 2. 공격 가능 기지?
  const base = getBaseAt(col, row);
  const baseTarget = base
    ? state.attackable.find(t => t.kind === 'base' && t.factionId === base.factionId)
    : null;
  if (baseTarget) {
    attackBase(sel, baseTarget.factionId);
    clearSelection();
    renderLog(state);
    return;
  }

  // 3. 의무병 회복?
  if (UNIT_TYPES[sel.type].special === 'heal' && !sel.attacked) {
    const healTarget = getHealTargets(sel).find(u => u.col === col && u.row === row);
    if (healTarget) {
      performHeal(sel, healTarget);
      clearSelection();
      renderLog(state);
      return;
    }
  }

  // 4. 이동 가능 헥스?
  const canMove = state.reachable.find(h => h.col === col && h.row === row);
  if (canMove && !sel.moved) {
    moveUnit(sel, col, row);
    addLog(state, `${FACTIONS[sel.factionId].name} ${UNIT_TYPES[sel.type].label} 이동`, 'move');
    // 이동 후 공격/회복 대상 없으면 선택 해제
    if (state.attackable.length === 0 && getHealTargets(sel).length === 0) {
      clearSelection();
    }
    return;
  }

  // 5. 다른 아군 유닛 선택?
  const unit = getUnitAt(col, row);
  if (unit && unit.factionId === state.currentFaction && !(unit.moved && unit.attacked)) {
    selectUnit(unit);
    return;
  }

  // 6. 그 외: 선택 해제
  clearSelection();
}

// ── 선택 없을 때 클릭 ──
function _handleClickNoSelection(col, row) {
  const unit = getUnitAt(col, row);
  if (!unit) return;
  if (unit.factionId !== state.currentFaction) return;
  if (state.defeated.includes(unit.factionId)) return;
  if (unit.moved && unit.attacked) return; // 행동 완료
  selectUnit(unit);
}

// ── 이벤트 바인딩 ──
canvas.addEventListener('click', handleClick);
window.addEventListener('resize', resizeCanvas);
document.getElementById('btn-end-turn').addEventListener('click', endTurn);
document.getElementById('btn-new-game').addEventListener('click', newGame);
document.getElementById('btn-overlay-new').addEventListener('click', newGame);

// ── 초기 실행 ──
resizeCanvas();
newGame();
