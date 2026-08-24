import { describe, expect, it } from 'vitest';
import { bottomAnchoredCages } from './cage-layout';

describe('bottomAnchoredCages', () => {
  it('anchors cages at the bottom row, filling left-to-right', () => {
    const cages = bottomAnchoredCages(3, [], 6, 6);
    expect(cages.map((c) => c.cell)).toEqual([
      { col: 0, row: 5 },
      { col: 1, row: 5 },
      { col: 2, row: 5 },
    ]);
  });

  it('wraps to the row above once the floor row is full', () => {
    const cages = bottomAnchoredCages(8, [], 6, 6);
    expect(cages[6].cell).toEqual({ col: 0, row: 4 });
    expect(cages[7].cell).toEqual({ col: 1, row: 4 });
  });

  it('omits the layers field for a 1-layer cage (byte-identical to pre-layers output)', () => {
    const cages = bottomAnchoredCages(2, [1, 1], 6, 6);
    expect(cages.every((c) => !('layers' in c))).toBe(true);
  });

  it('omits layers when the layerCounts entry is missing (defaults to 1)', () => {
    const cages = bottomAnchoredCages(2, [], 6, 6);
    expect(cages.every((c) => !('layers' in c))).toBe(true);
  });

  it('stamps an explicit layers count above 1', () => {
    const cages = bottomAnchoredCages(2, [2, 3], 6, 6);
    expect(cages[0].layers).toBe(2);
    expect(cages[1].layers).toBe(3);
  });
});
