import { FACTIONS, UNIT_TYPES } from './units.js';

// ── 헤더 업데이트 ──
export function updateHeader(state) {
  const faction = FACTIONS[state.currentFaction];

  const turnInfo = document.getElementById('turn-info');
  turnInfo.textContent = `Turn ${state.turn}`;
  turnInfo.style.background = faction.color + '44';
  turnInfo.style.color = faction.lightColor;
  turnInfo.style.border = `1px solid ${faction.color}`;

  document.getElementById('phase-info').textContent = `${faction.name}의 턴`;
}

// ── 사이드바 유닛 정보 업데이트 ──
export function updateSidebar(unit, state) {
  const nameEl = document.getElementById('unit-name');
  const statsEl = document.getElementById('unit-stats');

  if (!unit) {
    nameEl.textContent = '유닛을 선택하세요';
    nameEl.style.color = '#777';
    statsEl.innerHTML = '';
  } else {
    const type = UNIT_TYPES[unit.type];
    const faction = FACTIONS[unit.factionId];
    nameEl.textContent = `[${faction.name}] ${type.label}`;
    nameEl.style.color = faction.lightColor;

    const ratio = unit.hp / unit.maxHp;
    const barColor = ratio > 0.5 ? '#4d4' : ratio > 0.25 ? '#dd4' : '#d44';
    const statusText = unit.moved && unit.attacked ? '✓ 행동완료'
      : unit.moved ? '이동완료'
      : '대기중';

    statsEl.innerHTML = `
      <div>HP: ${unit.hp} / ${unit.maxHp}</div>
      <div class="hp-bar-bg"><div class="hp-bar" style="width:${ratio * 100}%;background:${barColor}"></div></div>
      <div>공격력: ${type.atk}</div>
      <div>이동력: ${type.move}</div>
      <div>사거리: ${type.range}</div>
      <div>특성: ${specialLabel(type.special)}</div>
      <div style="color:#777;margin-top:4px">상태: ${statusText}</div>
    `;
  }

  updateFactionStatus(state);
}

// ── 진영 상태 업데이트 ──
export function updateFactionStatus(state) {
  const el = document.getElementById('faction-rows');
  el.innerHTML = FACTIONS.map(f => {
    const base = state.bases[f.id];
    const defeated = state.defeated.includes(f.id);
    const ratio = base.hp / base.maxHp;
    const alive = state.units.filter(u => u.factionId === f.id && u.hp > 0).length;
    const opacity = defeated ? '0.3' : '1';
    const labelColor = defeated ? '#555' : f.lightColor;
    const fillColor = defeated ? '#333' : f.color;

    return `
      <div class="faction-row">
        <div class="faction-dot" style="background:${f.color};opacity:${opacity}"></div>
        <span class="faction-label" style="color:${labelColor}">${f.name.slice(0, 3)}</span>
        <div class="faction-hp-track">
          <div class="faction-hp-fill" style="width:${ratio * 100}%;background:${fillColor}"></div>
        </div>
        <span class="faction-meta">${defeated ? '✗' : base.hp} / ${alive}u</span>
      </div>
    `;
  }).join('');
}

// ── 로그 추가 ──
export function addLog(state, msg, type = '') {
  state.logs.unshift({ msg, type });
  if (state.logs.length > 100) state.logs.length = 100;
  renderLog(state);
}

// ── 로그 DOM 렌더링 ──
export function renderLog(state) {
  const el = document.getElementById('log-list');
  el.innerHTML = state.logs.slice(0, 60).map(l =>
    `<div class="log-entry ${l.type}">${l.msg}</div>`
  ).join('');
}

// ── 오버레이 표시/숨김 ──
export function showOverlay(title, msg) {
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-msg').textContent = msg;
  document.getElementById('overlay').classList.add('show');
}

export function hideOverlay() {
  document.getElementById('overlay').classList.remove('show');
}

// ── 내부 헬퍼 ──
function specialLabel(s) {
  switch (s) {
    case 'anti_tank':    return '대전차 (×1.5)';
    case 'no_move_fire': return '이동 후 사격불가';
    case 'heal':         return '아군 회복 +15';
    default:             return '—';
  }
}
