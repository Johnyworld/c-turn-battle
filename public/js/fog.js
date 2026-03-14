import { MAP_COLS, MAP_ROWS } from './units.js';
import { hexDistance } from './hex.js';

const SIGHT_RADIUS = 3;

// ── 연합군 시야 계산 → 가시 헥스 Set<"col,row"> 반환 ──
export function computeVisibleHexes(state) {
  const visible = new Set();

  // 연합군 살아있는 유닛 시야
  state.units
    .filter(u => u.factionId === 0 && u.hp > 0)
    .forEach(u => addSightCircle(visible, u.col, u.row));

  // 연합군 기지는 항상 가시
  const base = state.bases[0];
  if (base) addSightCircle(visible, base.col, base.row);

  return visible;
}

function addSightCircle(set, centerCol, centerRow) {
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (hexDistance(centerCol, centerRow, c, r) <= SIGHT_RADIUS) {
        set.add(`${c},${r}`);
      }
    }
  }
}
