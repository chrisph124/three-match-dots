import { nextInt } from '../rng';
import type { Board, Color, Spawn } from '../types';
import { EMPTY } from '../types';

/**
 * Fills the holes gravity left at the top of each column.
 *
 * Randomness is consumed columns left to right, rows top to bottom. That
 * order is contractual: change it and every seeded test changes with it.
 *
 * PRECONDITION: holes in each column are contiguous and start at row 0 —
 * true of any board `applyGravity` has already settled, which is the only
 * kind of board this is ever called with. Handed a non-canonical board (a
 * hole below a filled cell), the loop below would overwrite that settled
 * cell instead of the hole and leave a deeper hole unfilled, silently.
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
    // `holeIndex` counts up from the top of the column, not a grid row: it
    // only equals one because holes are contiguous there (see precondition
    // above), and using the name `row` invited reading it as a grid row.
    for (let holeIndex = 0; holeIndex < holes; holeIndex++) {
      const step = nextInt(state, colors);
      state = step.state;
      const to = holeIndex * cols + col;
      next[to] = step.value;
      spawns.push({ to, color: step.value, heightAbove: holes - holeIndex });
    }
  }

  return { board: next, spawns, rngState: state };
}
