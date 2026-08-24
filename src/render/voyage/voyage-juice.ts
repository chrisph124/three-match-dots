// Maps observable Voyage state deltas onto the pooled effect fires. Kept out of
// the route so the route stays a thin composition: the route just hands this the
// clear event and the before/after caged sets, and this decides what pops.
//
// Pool-budget discipline: at most two `fireShards` calls per event (≤ 16 of the
// 18-slot spark pool), so one burst never overwrites its own still-flying sparks.

import type { CellIndex, ClearedCell } from '../../core/types';
import { centerX, centerY, type BoardLayout } from '../geometry';
import { colorFor } from '../palette';
import { fireRipple, fireSealThud, fireShards, type VoyageEffects } from './voyage-effects';

/** The centroid of a set of cells in board pixel space. */
function centroid(
  cells: Iterable<CellIndex>,
  layout: BoardLayout,
): { x: number; y: number; n: number } {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const idx of cells) {
    x += centerX(idx, layout);
    y += centerY(idx, layout);
    n += 1;
  }
  return n > 0 ? { x: x / n, y: y / n, n } : { x: 0, y: 0, n: 0 };
}

/**
 * A committed clear → shards at the terminal (collapse) cell, plus, on a sweep,
 * a ripple and a second shard burst at the swept colour's centroid so the
 * whole-board pop reads as one event.
 */
export function fireClearJuice(
  fx: VoyageEffects,
  cleared: readonly ClearedCell[],
  sweep: boolean,
  layout: BoardLayout,
  reduced: boolean,
): void {
  if (cleared.length === 0) {
    return;
  }
  const terminal = cleared[cleared.length - 1];
  fireShards(
    fx,
    centerX(terminal.index, layout),
    centerY(terminal.index, layout),
    colorFor(terminal.color),
    reduced,
  );
  if (sweep) {
    const c = centroid(
      cleared.map((cell) => cell.index),
      layout,
    );
    const hue = colorFor(cleared[0].color);
    fireRipple(fx, c.x, c.y, hue, reduced);
    fireShards(fx, c.x, c.y, hue, reduced);
  }
}

/**
 * A cage freeing → a pale seal-thud at the freed cells' centroid. Gated strictly
 * on the caged set SHRINKING, so a mere gravity-remap of a still-caged dot (same
 * size, different indices) never fires a spurious ring.
 */
export function fireCageJuice(
  fx: VoyageEffects,
  prev: ReadonlySet<CellIndex>,
  next: ReadonlySet<CellIndex>,
  layout: BoardLayout,
  reduced: boolean,
): void {
  if (next.size >= prev.size) {
    return;
  }
  const freed: CellIndex[] = [];
  for (const idx of prev) {
    if (!next.has(idx)) {
      freed.push(idx);
    }
  }
  const c = centroid(freed, layout);
  if (c.n === 0) {
    return;
  }
  fireSealThud(fx, c.x, c.y, reduced);
}
