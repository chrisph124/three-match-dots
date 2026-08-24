import { describe, expect, it } from 'vitest';
import { CAGE_LAYERS, cageLayersForIndex, isBossIndex } from './voyage-config';

describe('isBossIndex', () => {
  it('is true on every 10th index and false elsewhere', () => {
    expect(isBossIndex(10)).toBe(true);
    expect(isBossIndex(20)).toBe(true);
    expect(isBossIndex(9)).toBe(false);
    expect(isBossIndex(11)).toBe(false);
    expect(isBossIndex(1)).toBe(false);
  });
});

describe('CAGE_LAYERS', () => {
  it('names the three difficulty bands', () => {
    expect(CAGE_LAYERS).toEqual({ teach: 1, mid: 2, boss: 3 });
  });
});

describe('cageLayersForIndex — the single band authority', () => {
  it('returns teach (1) for a non-boss Episode-1 level', () => {
    expect(cageLayersForIndex(4)).toBe(CAGE_LAYERS.teach);
    expect(cageLayersForIndex(5)).toBe(CAGE_LAYERS.teach);
    expect(cageLayersForIndex(9)).toBe(CAGE_LAYERS.teach);
  });

  it('returns boss (3) for a boss index — boss beats Episode-1 at level 10', () => {
    // L10 is BOTH a boss index and inside the Episode-1 range; boss must win the
    // tie or the Caged Core would be mislabelled a 1-layer teach cage.
    expect(cageLayersForIndex(10)).toBe(CAGE_LAYERS.boss);
    expect(cageLayersForIndex(20)).toBe(CAGE_LAYERS.boss);
  });

  it('returns mid (2) for a generated non-boss index past Episode 1', () => {
    expect(cageLayersForIndex(11)).toBe(CAGE_LAYERS.mid);
    expect(cageLayersForIndex(15)).toBe(CAGE_LAYERS.mid);
    expect(cageLayersForIndex(19)).toBe(CAGE_LAYERS.mid);
  });
});
