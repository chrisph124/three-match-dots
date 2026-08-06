import { nextInt } from '../rng';
import type { Board, Color, Spawn } from '../types';
import { EMPTY } from '../types';

/**
 * Fills the holes gravity left at the top of each column.
 *
 * Randomness is consumed columns left to right, rows top to bottom. That
 * order is contractual: change it and every seeded test changes with it.
 */
export function refill(
  board: Board,
  rows: number,
  cols: number,
  colors: number,
  rngState: number,
): { board: Color[]; spawns: Spawn[]; rngState: number } {
  const next: Color[] = [...board];
  const spawns: Spawn[] = [];
  let state = rngState;

  for (let col = 0; col < cols; col++) {
    let holes = 0;
    for (let row = 0; row < rows; row++) {
      if (next[row * cols + col] === EMPTY) {
        holes++;
      }
    }
    for (let row = 0; row < holes; row++) {
      const step = nextInt(state, colors);
      state = step.state;
      const to = row * cols + col;
      next[to] = step.value;
      spawns.push({ to, color: step.value, heightAbove: holes - row });
    }
  }

  return { board: next, spawns, rngState: state };
}
