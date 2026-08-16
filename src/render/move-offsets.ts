import type { CellMove, Spawn } from '../core/types';
import { moveOffsetX, moveOffsetY, spawnOffsetY, type BoardLayout } from './geometry';

export type MoveOffsetInput = {
  /** A fall and a shuffle slide are both `CellMove`s to the render layer. */
  readonly moves?: readonly CellMove[];
  readonly spawns?: readonly Spawn[];
};

/**
 * Builds the per-cell pixel offsets `playMove` animates from: where a moved
 * dot came from (`moves`) and where a freshly-dealt dot starts above the
 * board (`spawns`). Cells that are neither moving nor spawning stay at 0.
 *
 * This is the only glue between `Resolution`/`shuffleBoard` and the animation
 * layer, and it encodes the `refill.heightAbove` <-> `spawnOffsetY` contract:
 * `heightAbove = holes - row` in `refill.ts` and
 * `-(heightAbove + row(to))` in `spawnOffsetY` cancel to exactly
 * `-holes * cellSize` for every dot in a column, which is why every spawn
 * landing in the same column ends up with an identical offset — refilling
 * dots slide in as one stack rather than popping in at staggered heights.
 */
export function buildMoveOffsets(
  input: MoveOffsetInput,
  layout: BoardLayout,
  cellCount: number,
): { offsetX: number[]; offsetY: number[] } {
  const offsetX = new Array<number>(cellCount).fill(0);
  const offsetY = new Array<number>(cellCount).fill(0);

  for (const move of input.moves ?? []) {
    offsetX[move.to] = moveOffsetX(move.from, move.to, layout);
    offsetY[move.to] = moveOffsetY(move.from, move.to, layout);
  }
  for (const spawn of input.spawns ?? []) {
    offsetY[spawn.to] = spawnOffsetY(spawn.to, spawn.heightAbove, layout);
  }

  return { offsetX, offsetY };
}
