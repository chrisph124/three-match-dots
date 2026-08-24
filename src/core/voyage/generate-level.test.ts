import { describe, expect, it } from 'vitest';
import type { LevelScript } from '../level/level-script';
import { generateLadder, generateVoyageLevel } from './generate-level';
import { signatureOf, varietyReport } from './level-signature';
import {
  BOSS_EVERY,
  EPISODE_1_LAST,
  VARIETY_MAX_SHORTFALL_RATE,
  VARIETY_SIMILARITY_MAX,
  VARIETY_WINDOW,
} from './voyage-config';

const PALETTE = 5;
const LADDER = generateLadder(200, PALETTE);

const isBoss = (level: LevelScript) => level.order % BOSS_EVERY === 0;
const isGenerated = (level: LevelScript) => level.order > EPISODE_1_LAST && !isBoss(level);

describe('generateVoyageLevel', () => {
  it('is deterministic in (index, paletteSize)', () => {
    expect(generateVoyageLevel(37, PALETTE)).toEqual(generateVoyageLevel(37, PALETTE));
    expect(generateVoyageLevel(88, PALETTE)).toEqual(generateVoyageLevel(88, PALETTE));
  });

  it('agrees with the full ladder pass at the same index', () => {
    for (const index of [11, 15, 20, 47, 100, 150]) {
      expect(generateVoyageLevel(index, PALETTE)).toEqual(LADDER[index - 1]);
    }
  });
});

describe('generateLadder', () => {
  it('emits a valid, correctly-located voyage level at every index', () => {
    // parseLevelScript runs inside generation, so reaching here means each level
    // is schema-valid; assert the ladder is aligned and voyage-shaped.
    expect(LADDER).toHaveLength(200);
    LADDER.forEach((level, i) => {
      expect(level.mode).toBe('voyage');
      expect(level.schemaVersion).toBe(2);
      expect(level.order).toBe(i + 1);
      expect(level.voyage?.index).toBe(i + 1);
      expect(level.objectives.length).toBeGreaterThan(0);
    });
  });

  it('places a boss on every 10th index and nowhere else', () => {
    LADDER.forEach((level) => {
      const boss = level.order % BOSS_EVERY === 0;
      expect(level.voyage?.isBoss).toBe(boss);
      expect(level.theme?.boss).toBe(boss);
    });
  });

  it('makes level 10 the Caged Core: 8 bottom cages, freeCaged', () => {
    const core = LADDER[9];
    expect(core.id).toContain('caged-core');
    expect(core.obstacles).toHaveLength(8);
    expect(core.objectives).toEqual([{ type: 'freeCaged' }]);
  });

  it('keeps generated neighbours distinct within the variety window (≥40% differ)', () => {
    // The window carries only generated (non-curated, non-boss) signatures, in
    // order — exactly the levels compared here, matching the generator's logic.
    const generated = LADDER.filter(isGenerated).map(signatureOf);
    const report = varietyReport(generated, VARIETY_WINDOW, VARIETY_SIMILARITY_MAX);

    // Hard guarantee: no two window neighbours are ever identical. The re-roll
    // always leaves at least one signature field different (worst < 1).
    expect(report.worst).toBeLessThan(1);

    // The ≥40%-different rule holds for all but a small, *counted* shortfall.
    // With 6 archetypes and a window of 8, some window must repeat an archetype
    // (pigeonhole); once difficulty plateaus that repeat can differ in only the
    // obstacle/constraint fields. The Phase-4 variety plan sanctions accepting
    // the least-similar candidate and counting the shortfall (no silent cap);
    // this asserts it stays within the documented ceiling.
    const rate = report.shortfall / report.windowPairs;
    expect(rate).toBeLessThanOrEqual(VARIETY_MAX_SHORTFALL_RATE);
  });

  it('varies the constraint kind across the ladder (not all one kind)', () => {
    const kinds = new Set(LADDER.filter(isGenerated).map((l) => l.constraint?.type));
    expect(kinds.size).toBeGreaterThan(1);
  });
});
