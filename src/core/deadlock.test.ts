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

  // A 4-cell same-colour STAR: centre R at (1,1) with three mutually
  // non-adjacent arms — N (0,1), SW (2,0), SE (2,2). The component has 4 cells
  // but its longest simple chain is only 3, so no legal 4-chain exists. A
  // size-only check (component size >= minChain) wrongly reports a move here
  // and soft-locks the player at minChain 4; the path search must not.
  it('is false on a 4-cell star that has no 4-chain (minChain 4)', () => {
    expect(check('GRB/BRG/RBR', 4)).toBe(false);
  });

  it('still finds the star as a legal 3-chain (minChain 3)', () => {
    expect(check('GRB/BRG/RBR', 3)).toBe(true);
  });

  it('finds diagonal adjacency at width 2', () => {
    // At width 2, cells 1 and 2 (indices for (0,1) and (1,0)) are genuine
    // diagonal neighbours and have raw-index difference 1. This test confirms
    // 8-way adjacency works, but cannot discriminate wrap-adjacency bugs.
    expect(check('GR/RG', 2)).toBe(true); // the diagonal G-G and R-R do touch
    expect(check('GR/BG', 3)).toBe(false);
  });

  it('does not treat a row wrap as adjacency', () => {
    // Cells 2 and 3 are (0,2) and (1,0): raw-index neighbours (difference of 1)
    // but two columns apart, so not adjacent. An implementation that treats
    // index +/- 1 as adjacent merges them with the R at (2,1) into a component
    // of 3 and wrongly reports a legal move.
    expect(check('GGR/RBB/GRG')).toBe(false);
  });
});

describe('hasLegalMove — anchors', () => {
  // 'RRR/GBG' has exactly one legal chain: the top R triple 0-1-2. The two Gs
  // (3, 5) are not adjacent, so no other 3-path exists.
  const parse = (art: string) => parseBoard(art);

  it('treats an anchored cell as non-linkable, breaking the sole legal chain', () => {
    const { board, rows, cols } = parse('RRR/GBG');
    expect(hasLegalMove(board, rows, cols, 3)).toBe(true); // 0-1-2 is legal
    // Anchoring the middle OR an end of the only triple leaves no legal move.
    expect(hasLegalMove(board, rows, cols, 3, new Set([1]))).toBe(false); // mid-path
    expect(hasLegalMove(board, rows, cols, 3, new Set([0]))).toBe(false); // start cell
  });

  it('is byte-identical to passing no set when the anchor set is empty', () => {
    const { board, rows, cols } = parse('RRR/GBG');
    expect(hasLegalMove(board, rows, cols, 3, new Set())).toBe(hasLegalMove(board, rows, cols, 3));
  });

  it('ignores an anchor that is not part of any chain', () => {
    const { board, rows, cols } = parse('RRR/GBG');
    // Cell 4 (the lone B) belongs to no triple; anchoring it leaves 0-1-2 legal.
    expect(hasLegalMove(board, rows, cols, 3, new Set([4]))).toBe(true);
  });
});
