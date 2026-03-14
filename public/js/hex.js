import { HEX_SIZE, MAP_COLS, MAP_ROWS } from './units.js';

// ── 헥스 중심 픽셀 좌표 (odd-r offset) ──
export function hexCenter(col, row) {
  const w = HEX_SIZE * Math.sqrt(3);
  const h = HEX_SIZE * 2;
  const offsetX = row % 2 === 1 ? w / 2 : 0;
  const x = col * w + offsetX + w / 2 + 8;
  const y = row * h * 0.75 + HEX_SIZE + 8;
  return { x, y };
}

// ── 픽셀 → 헥스 좌표 (가장 가까운 헥스 반환) ──
export function pixelToHex(px, py) {
  let best = null;
  let bestDist = Infinity;
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const { x, y } = hexCenter(c, r);
      const d = Math.hypot(px - x, py - y);
      if (d < bestDist) {
        bestDist = d;
        best = { col: c, row: r };
      }
    }
  }
  return bestDist <= HEX_SIZE * 1.1 ? best : null;
}

// ── 인접 6 헥스 반환 (맵 경계 클리핑) ──
export function hexNeighbors(col, row) {
  const parity = row % 2;
  const dirs = parity === 0
    ? [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1]]
    : [[-1, 0], [1, 0], [0, -1], [0, 1], [1, -1],  [1,  1]];
  return dirs
    .map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
    .filter(h => h.col >= 0 && h.col < MAP_COLS && h.row >= 0 && h.row < MAP_ROWS);
}

// ── 헥스 거리 (offset → cube 좌표 변환 후 체비쇼프) ──
export function hexDistance(c1, r1, c2, r2) {
  const toCube = (col, row) => {
    const x = col - (row - (row & 1)) / 2;
    const z = row;
    const y = -x - z;
    return { x, y, z };
  };
  const a = toCube(c1, r1);
  const b = toCube(c2, r2);
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

// ── BFS 이동 가능 헥스 ──
// blockedFn(col, row): boolean — true면 해당 헥스로 진입 불가
export function getReachable(col, row, maxSteps, blockedFn) {
  const visited = new Map();
  visited.set(`${col},${row}`, 0);
  const queue = [{ col, row, steps: 0 }];
  const result = [];

  while (queue.length) {
    const cur = queue.shift();
    if (cur.steps > 0) result.push({ col: cur.col, row: cur.row });
    if (cur.steps >= maxSteps) continue;

    for (const nb of hexNeighbors(cur.col, cur.row)) {
      const key = `${nb.col},${nb.row}`;
      if (visited.has(key)) continue;
      visited.set(key, cur.steps + 1);
      if (blockedFn(nb.col, nb.row)) continue;
      queue.push({ col: nb.col, row: nb.row, steps: cur.steps + 1 });
    }
  }
  return result;
}
