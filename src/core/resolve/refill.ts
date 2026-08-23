import { next, nextInt, type RngStep } from '../rng';
import type { Board, Color, Spawn } from '../types';
import { EMPTY } from '../types';

/**
 * Draws one spawn colour. With exclusion off (the default) this is the literal
 * uniform `nextInt(state, colors)` the seeded tests contract on — the off branch
 * must never diverge from it. A colour-sweep's own refill wave can down-weight
 * the swept colour so the board does not immediately re-offer what was cleared:
 *
 * - weight 1  → full ban: draw uniformly over the OTHER colours, then step the
 *   index past the banned one. One RNG advance, zero swept-colour dots.
 * - 0<w<1     → partial: a single weighted draw giving the swept colour relative
 *   weight (1 - w) against 1 for every other colour. One RNG advance.
 *
 * Every branch consumes exactly one RNG step, so the stream stays legible.
 */
function drawSpawnColor(
  state: number,
  colors: number,
  excludeColor: Color | undefined,
  exclusionWeight: number | undefined,
): RngStep {
  const weight = exclusionWeight ?? 0;
  if (excludeColor === undefined || weight <= 0) {
    return nextInt(state, colors);
  }
  if (weight >= 1) {
    const step = nextInt(state, colors - 1);
    return { value: step.value >= excludeColor ? step.value + 1 : step.value, state: step.state };
  }
  const step = next(state);
  const total = colors - weight; // (colors - 1) * 1 + (1 - weight)
  let x = step.value * total;
  // Walk the cumulative weights; the last colour is the remainder bucket and
  // needs no comparison. That also absorbs any float drift that could otherwise
  // leave x a hair short of the final weight after the subtractions.
  for (let c = 0; c < colors - 1; c++) {
    const w = c === excludeColor ? 1 - weight : 1;
    if (x < w) return { value: c, state: step.state };
    x -= w;
  }
  return { value: colors - 1, state: step.state };
}

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
  excludeColor?: Color,
  exclusionWeight?: number,
): { board: Color[]; spawns: Spawn[]; rngState: number } {
  const filled: Color[] = [...board];
  const spawns: Spawn[] = [];
  let state = rngState;

  for (let col = 0; col < cols; col++) {
    let holes = 0;
    for (let row = 0; row < rows; row++) {
      if (filled[row * cols + col] === EMPTY) {
        holes++;
      }
    }
    // `holeIndex` counts up from the top of the column, not a grid row: it
    // only equals one because holes are contiguous there (see precondition
    // above), and using the name `row` invited reading it as a grid row.
    for (let holeIndex = 0; holeIndex < holes; holeIndex++) {
      const step = drawSpawnColor(state, colors, excludeColor, exclusionWeight);
      state = step.state;
      const to = holeIndex * cols + col;
      filled[to] = step.value;
      spawns.push({ to, color: step.value, heightAbove: holes - holeIndex });
    }
  }

  return { board: filled, spawns, rngState: state };
}
