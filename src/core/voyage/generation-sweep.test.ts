import { describe, expect, it } from 'vitest';
import { generateLadder } from './generate-level';
import { solve } from './solver';

/**
 * The winnability gate. Every level the generator ships must be beatable by the
 * headless solver at its shipped (calibrated) budget — a level the bot can't win
 * is strictly worse than Endless's no-fail design and must never reach a player.
 * The sweep plays the whole ladder and fails loudly with the offending indices;
 * there is no silent cap or sampling — all N levels are checked.
 */

// Mirror the shipped runtime palette (`DOT_COLORS.length` = 6, passed into
// `voyageLevelAt`). A literal, not an import, keeps this core test RN-free — the
// palette lives in the render layer. Proving winnability at any smaller palette
// would verify a ladder the player never sees.
const PALETTE = 6;
const N = 200;
const LADDER = generateLadder(N, PALETTE);

describe('generation winnability sweep', () => {
  it(`solves every ladder level at its shipped budget (1..${N})`, () => {
    expect(LADDER).toHaveLength(N);

    const failures = LADDER.filter((level) => !solve(level, level.seed ?? level.order).won).map(
      (level) => ({ order: level.order, id: level.id }),
    );

    if (failures.length > 0) {
      console.error('Unwinnable levels:', failures);
    }
    expect(failures).toEqual([]);
  });

  it('wins the level-10 Caged Core within its calibrated budget', () => {
    const core = LADDER[9];
    expect(core.id).toContain('caged-core');
    expect(core.objectives).toEqual([{ type: 'freeCaged' }]);
    expect(solve(core, core.seed ?? core.order).won).toBe(true);
  });
});
