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
 *
 * `layerCounts[k]` is the layer depth of the k-th cage (absent ⇒ 1). A 1-layer
 * cage omits the `layers` field entirely, so a pre-layers layout stays
 * byte-identical — only a genuinely multi-layer cage carries the key.
 */
export function bottomAnchoredCages(
  count: number,
  layerCounts: readonly number[],
  cols: number,
  rows: number,
): Obstacle[] {
  const cages: Obstacle[] = [];
  for (let k = 0; k < count; k += 1) {
    const row = rows - 1 - Math.floor(k / cols);
    const col = k % cols;
    const layers = layerCounts[k] ?? 1;
    cages.push({ type: 'cagedDot', cell: { col, row }, ...(layers > 1 ? { layers } : {}) });
  }
  return cages;
}
