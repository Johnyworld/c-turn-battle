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
  updateHeader, updateSidebar,
  addLog, renderLog, showOverlay, hideOverlay,
} from './ui.js';
import { runAiTurn } from './ai.js';
import { computeVisibleHexes } from './fog.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── 로컬 상태 ──
let fogEnabled = true;
let isAiTurn = false;

// ── Canvas 리사이즈 ──
function resizeCanvas() {
  const container = document.getElementById('canvas-container');
  canvas.width  = container.clientWidth;
  canvas.height = container.clientHeight;
  redraw();
}

// ── 렌더링 헬퍼 ──
function redraw() {
  const visibleSet = fogEnabled ? computeVisibleHexes(state) : null;
  render(canvas, ctx, state, fogEnabled, visibleSet);
}

// ── 새 게임 ──
function newGame() {
  hideOverlay();
  isAiTurn = false;
  initState();
  updateFogButton();
  addLog(state, '=== 새 게임 시작 ===', 'system');
  addLog(state, `${FACTIONS[0].name}의 턴`, 'system');
  updateHeader(state);
  updateSidebar(null, state);
  redraw();
}

// ── 턴 종료 ──
async function endTurn() {
  if (state.winner !== null) return;
  if (isAiTurn) return;

  gameEndTurn();
  clearSelection();
  updateHeader(state);
  updateSidebar(null, state);

  // AI 진영 턴이면 자동 실행
  if (state.currentFaction !== 0 && !state.defeated.includes(state.currentFaction)) {
    isAiTurn = true;
    updateAiTurnUI(true);
    addLog(state, `--- ${FACTIONS[state.currentFaction].name} AI 턴 (Turn ${state.turn}) ---`, 'system');
    redraw();

    await runAiTurn(state.currentFaction, (unit) => {
      renderLog(state);
      redraw();
    });

    isAiTurn = false;
    updateAiTurnUI(false);

    const winner = checkWinCondition();
    if (winner !== null) {
      handleGameEnd(winner);
      redraw();
      return;
    }

    // 다음 턴이 또 AI면 연속 진행, 아니면 플레이어 턴
    await endTurn();
  } else {
    addLog(state, `--- ${FACTIONS[state.currentFaction].name}의 턴 (Turn ${state.turn}) ---`, 'system');
    redraw();
  }
}

// ── 클릭 처리 ──
function handleClick(e) {
  if (state.winner !== null) return;
  if (isAiTurn) return;

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

  const winner = checkWinCondition();
  if (winner !== null) {
    handleGameEnd(winner);
  }

  updateSidebar(
    state.selected !== null ? state.units.find(u => u.id === state.selected) : null,
    state
  );
  redraw();
}

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

  clearSelection();
}

function _handleClickNoSelection(col, row) {
  const unit = getUnitAt(col, row);
  if (!unit) return;
  if (unit.factionId !== state.currentFaction) return;
  if (state.defeated.includes(unit.factionId)) return;
  if (unit.moved && unit.attacked) return;
  selectUnit(unit);
}

// ── 게임 종료 처리 ──
function handleGameEnd(winner) {
  if (winner === -1) {
    showOverlay('무승부', '모든 진영의 기지가 함락되었습니다.');
  } else {
    showOverlay(`${FACTIONS[winner].name} 승리!`, '모든 적 기지가 함락되었습니다.');
  }
}

// ── Fog 토글 ──
function toggleFog() {
  fogEnabled = !fogEnabled;
  updateFogButton();
  redraw();
}

function updateFogButton() {
  const btn = document.getElementById('btn-fog-toggle');
  if (!btn) return;
  btn.textContent = fogEnabled ? 'FOG ON' : 'FOG OFF';
  btn.style.background = fogEnabled ? '#2a3a2a' : '#3a3a1a';
  btn.style.color = fogEnabled ? '#8e8' : '#aa8';
  btn.style.borderColor = fogEnabled ? '#4a8a4a' : '#888';
}

function updateAiTurnUI(active) {
  const btn = document.getElementById('btn-end-turn');
  if (btn) btn.disabled = active;
  const phase = document.getElementById('phase-info');
  if (phase && active) phase.textContent = `${FACTIONS[state.currentFaction].name} AI 진행 중...`;
}

// ── 이벤트 바인딩 ──
canvas.addEventListener('click', handleClick);
window.addEventListener('resize', resizeCanvas);
document.getElementById('btn-end-turn').addEventListener('click', endTurn);
document.getElementById('btn-new-game').addEventListener('click', newGame);
document.getElementById('btn-overlay-new').addEventListener('click', newGame);
document.getElementById('btn-fog-toggle').addEventListener('click', toggleFog);

// ── 초기 실행 ──
resizeCanvas();
newGame();
