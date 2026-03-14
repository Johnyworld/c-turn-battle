import { FACTIONS, UNIT_TYPES, MAP_COLS, MAP_ROWS, HEX_SIZE } from './units.js';
import { hexCenter, hexNeighbors } from './hex.js';
import { getHealTargets } from './game.js';

// ── 전체 렌더링 진입점 ──
export function render(canvas, ctx, state) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 배경
  ctx.fillStyle = '#1e2010';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const reachableSet = new Set(state.reachable.map(h => `${h.col},${h.row}`));
  const attackableUnitIds = new Set(
    state.attackable.filter(t => t.kind === 'unit').map(t => t.id)
  );
  const attackableBaseFactions = new Set(
    state.attackable.filter(t => t.kind === 'base').map(t => t.factionId)
  );

  // 의무병 회복 대상
  let healTargetIds = new Set();
  if (state.selected !== null) {
    const sel = state.units.find(u => u.id === state.selected);
    if (sel) {
      getHealTargets(sel).forEach(u => healTargetIds.add(u.id));
    }
  }

  // 1. 헥스 타일
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const { x, y } = hexCenter(c, r);
      const key = `${c},${r}`;
      const isReachable = reachableSet.has(key);
      const fillColor = isReachable ? '#1a3a1a' : '#2a3020';
      const strokeColor = isReachable ? '#5aaa5a' : '#3a4030';
      drawHex(ctx, x, y, HEX_SIZE - 1, fillColor, strokeColor, isReachable ? 1.5 : 1);
    }
  }

  // 이동 가능 헥스 점 오버레이
  state.reachable.forEach(h => {
    const { x, y } = hexCenter(h.col, h.row);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80,200,80,0.6)';
    ctx.fill();
  });

  // 2. 기지
  state.bases.forEach(base => {
    const { x, y } = hexCenter(base.col, base.row);
    const faction = FACTIONS[base.factionId];
    const isDefeated = state.defeated.includes(base.factionId);
    const isTarget = attackableBaseFactions.has(base.factionId);

    const fill = isDefeated ? '#282828' : (isTarget ? '#6a2200' : faction.baseColor);
    const stroke = isTarget ? '#ff8800' : (isDefeated ? '#444' : faction.color);
    drawHex(ctx, x, y, HEX_SIZE - 1, fill, stroke, isTarget ? 3 : 2);

    // 기지 아이콘
    ctx.fillStyle = isDefeated ? '#444' : faction.lightColor;
    ctx.font = 'bold 18px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', x, y - 5);

    ctx.fillStyle = isDefeated ? '#555' : '#fff';
    ctx.font = '9px Courier New';
    ctx.fillText(faction.name.slice(0, 2), x, y + 10);

    // 기지 HP 바
    if (!isDefeated) {
      drawHpBar(ctx, x, y + HEX_SIZE * 0.58, HEX_SIZE * 1.4, base.hp / base.maxHp);
    }
  });

  // 3. 유닛
  state.units.filter(u => u.hp > 0).forEach(unit => {
    const { x, y } = hexCenter(unit.col, unit.row);
    const faction = FACTIONS[unit.factionId];
    const type = UNIT_TYPES[unit.type];
    const isSelected = state.selected === unit.id;
    const isAttackTarget = attackableUnitIds.has(unit.id);
    const isHealTarget = healTargetIds.has(unit.id);
    const isCurrentFaction = unit.factionId === state.currentFaction;
    const isDone = unit.moved && unit.attacked;

    let fill = faction.color;
    if (isDone && isCurrentFaction) fill = darken(faction.color, 0.45);
    if (isAttackTarget) fill = '#5a1010';

    const stroke = isSelected ? '#ffffff'
      : isAttackTarget ? '#ff4400'
      : isHealTarget ? '#00ff88'
      : faction.color;
    const lineW = (isSelected || isAttackTarget || isHealTarget) ? 3 : 1.5;

    drawHex(ctx, x, y, HEX_SIZE * 0.72, fill, stroke, lineW);

    // 유닛 기호
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${type.symbol.length > 1 ? 9 : 12}px Courier New`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type.symbol, x, y - 3);

    // HP 바
    drawHpBar(ctx, x, y + HEX_SIZE * 0.4, HEX_SIZE * 1.2, unit.hp / unit.maxHp);

    // 행동 완료 어두운 오버레이
    if (isDone && isCurrentFaction) {
      drawHex(ctx, x, y, HEX_SIZE * 0.72, 'rgba(0,0,0,0.4)', 'transparent', 0);
    }
  });
}

// ── 헥스 도형 그리기 ──
function drawHex(ctx, x, y, size, fill, stroke, lineWidth) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (lineWidth > 0 && stroke !== 'transparent') {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

// ── HP 바 그리기 ──
function drawHpBar(ctx, cx, y, width, ratio) {
  const x = cx - width / 2;
  const barColor = ratio > 0.5 ? '#4d4' : ratio > 0.25 ? '#dd4' : '#d44';
  ctx.fillStyle = '#222';
  ctx.fillRect(x, y, width, 4);
  ctx.fillStyle = barColor;
  ctx.fillRect(x, y, width * ratio, 4);
}

// ── 색상 어둡게 ──
function darken(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}
