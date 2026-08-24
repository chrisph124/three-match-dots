import type { Obstacle } from '../level/level-script';

/**
 * Bottom-anchored cage placement. Caged dots ride gravity, so a cage that is
 * not seeded at the board floor would immediately fall and drift — the schema
 * lets them sit anywhere, but a playable cluster starts at the bottom row and
 * fills upward, left to right. Shared by the generator, the boss pool, and the
 * curated Episode-1 ladder so every Voyage cage layout is placed one way.
 *
 * Pure TS (no RN/Skia). Cells are distinct by construction (each `k` maps to a
 * unique `(row, col)`), so the placement never trips the schema's duplicate-cell
 * guard as long as `count ≤ rows × cols`.
 */
export function bottomAnchoredCages(count: number, cols: number, rows: number): Obstacle[] {
  const cages: Obstacle[] = [];
  for (let k = 0; k < count; k += 1) {
    const row = rows - 1 - Math.floor(k / cols);
    const col = k % cols;
    cages.push({ type: 'cagedDot', cell: { col, row } });
  }
  return cages;
}
