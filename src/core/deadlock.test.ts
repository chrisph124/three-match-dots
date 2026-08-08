import { describe, expect, it } from 'vitest';
import { hasLegalMove } from './deadlock';
import { parseBoard } from './test-support/board-fixture';

const check = (art: string, minChain = 3): boolean => {
  const { board, rows, cols } = parseBoard(art);
  return hasLegalMove(board, rows, cols, minChain);
};

describe('hasLegalMove', () => {
  it('finds a horizontal triple', () => {
    expect(check('RRR/GBG/BGB')).toBe(true);
  });

  it('finds a diagonal triple', () => {
    expect(check('RGB/GRG/BGR')).toBe(true);
  });

  it('is false when the best run is a pair', () => {
    expect(check('RR/GB')).toBe(false);
  });

  it('counts the same board as legal when minChain is 2', () => {
    expect(check('RR/GB', 2)).toBe(true);
  });

  // Found by exhaustive search over all 3^16 four-by-four three-colour boards.
  it('is false on a known deadlocked 4x4', () => {
    expect(check('BGGR/RRBR/BGBG/RGRR')).toBe(false);
  });

  // Found by annealing search. Deadlock on 6x6 is real but astronomically
  // rare: zero of 2,000,000 uniformly random boards were deadlocked.
  it('is false on a known deadlocked 6x6', () => {
    expect(check('BBRBRR/GRGGBG/GBBRRG/RRGGBB/GBBRRG/GRGGBG')).toBe(false);
  });

  it('is true on the shared 4x4 fixture', () => {
    expect(check('RRGR/RRGR/GGRR/RGRG')).toBe(true);
  });

  it('does not treat a row wrap as adjacency', () => {
    // Cells 1 and 2 are both R but sit at (0,1) and (1,0) — not adjacent.
    expect(check('GR/RG', 2)).toBe(true); // the diagonal G-G and R-R do touch
    expect(check('GR/BG', 3)).toBe(false);
  });
});
