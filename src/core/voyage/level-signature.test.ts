import { describe, expect, it } from 'vitest';
import { parseLevelScript, type LevelScript } from '../level/level-script';
import { signatureOf, similarity, type Signature } from './level-signature';

const PALETTE = 5;

/** Builds a minimal valid voyage level with the given overrides. */
function voyageLevel(overrides: Record<string, unknown>): LevelScript {
  return parseLevelScript(
    {
      schemaVersion: 2,
      id: 'sig-test',
      order: 1,
      board: { cols: 6, rows: 6, colors: 3, minChain: 3 },
      mode: 'voyage',
      constraint: { type: 'moves', budget: 20 },
      voyage: { index: 1, episode: 1, isBoss: false },
      theme: {
        biome: 'harbor',
        variant: 'dawn',
        particle: 'spray',
        trim: 'brass',
        parallaxSeed: 1,
        boss: false,
      },
      objectives: [{ type: 'clearColor', color: 0, count: 8 }],
      obstacles: [],
      ...overrides,
    },
    PALETTE,
  );
}

describe('signatureOf', () => {
  it('reads the five feature fields off a level', () => {
    const sig = signatureOf(voyageLevel({}));
    expect(sig).toEqual<Signature>({
      constraint: 'moves',
      colors: 3,
      minChain: 3,
      obstacles: 'none',
      objective: 'color',
    });
  });

  it('buckets obstacle counts none/few/many', () => {
    const cage = (col: number) => ({ type: 'cagedDot', cell: { col, row: 5 } });
    expect(signatureOf(voyageLevel({ obstacles: [] })).obstacles).toBe('none');
    expect(signatureOf(voyageLevel({ obstacles: [cage(0), cage(1), cage(2)] })).obstacles).toBe(
      'few',
    );
    expect(
      signatureOf(voyageLevel({ obstacles: [cage(0), cage(1), cage(2), cage(3)] })).obstacles,
    ).toBe('many');
  });

  it('classifies the objective templates', () => {
    expect(signatureOf(voyageLevel({})).objective).toBe('color');
    expect(
      signatureOf(
        voyageLevel({
          objectives: [
            { type: 'clearColor', color: 0, count: 8 },
            { type: 'clearColor', color: 1, count: 8 },
          ],
        }),
      ).objective,
    ).toBe('twoColors');
    expect(
      signatureOf(
        voyageLevel({
          objectives: [{ type: 'freeCaged' }],
          obstacles: [{ type: 'cagedDot', cell: { col: 0, row: 5 } }],
        }),
      ).objective,
    ).toBe('caged');
    expect(
      signatureOf(
        voyageLevel({
          objectives: [{ type: 'clearColor', color: 0, count: 8 }, { type: 'freeCaged' }],
          obstacles: [{ type: 'cagedDot', cell: { col: 0, row: 5 } }],
        }),
      ).objective,
    ).toBe('colorAndCaged');
  });
});

describe('similarity', () => {
  it('is 1 for identical signatures and 0 for wholly disjoint ones', () => {
    const a: Signature = {
      constraint: 'moves',
      colors: 3,
      minChain: 3,
      obstacles: 'none',
      objective: 'color',
    };
    const b: Signature = {
      constraint: 'timed',
      colors: 5,
      minChain: 4,
      obstacles: 'many',
      objective: 'caged',
    };
    expect(similarity(a, a)).toBe(1);
    expect(similarity(a, b)).toBe(0);
  });

  it('counts shared fields as a fraction of five', () => {
    const a: Signature = {
      constraint: 'moves',
      colors: 3,
      minChain: 3,
      obstacles: 'none',
      objective: 'color',
    };
    // Shares constraint + minChain + obstacles (3 of 5); differs on colors + objective.
    const c: Signature = {
      constraint: 'moves',
      colors: 5,
      minChain: 3,
      obstacles: 'none',
      objective: 'twoColors',
    };
    expect(similarity(a, c)).toBeCloseTo(3 / 5, 10);
  });
});
