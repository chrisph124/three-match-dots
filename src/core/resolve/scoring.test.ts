import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { scoreFor } from './scoring';

describe('scoreFor', () => {
  it('scores a plain chain on the triangular curve', () => {
    expect(scoreFor('plain', 3, DEFAULT_CONFIG)).toBe(60);
    expect(scoreFor('plain', 4, DEFAULT_CONFIG)).toBe(100);
    expect(scoreFor('plain', 5, DEFAULT_CONFIG)).toBe(150);
  });

  it('makes each extra dot worth more than the last', () => {
    const gaps: number[] = [];
    for (let n = 3; n < 12; n++) {
      gaps.push(scoreFor('plain', n + 1, DEFAULT_CONFIG) - scoreFor('plain', n, DEFAULT_CONFIG));
    }
    expect(gaps.every((gap, i) => i === 0 || gap > gaps[i - 1])).toBe(true);
  });

  it('scores a square-loop per dot swept, with the multiplier', () => {
    expect(scoreFor('square-loop', 8, DEFAULT_CONFIG)).toBe(240);
  });

  it('scores a line the same way as a square-loop', () => {
    expect(scoreFor('line', 8, DEFAULT_CONFIG)).toBe(scoreFor('square-loop', 8, DEFAULT_CONFIG));
  });

  it('makes a sweep worth far more than the chain that triggered it', () => {
    // A 2x2 loop is a 4-dot drag; on a 6x6 board with 3 colours it sweeps
    // roughly 12 dots. That payoff, not a same-count comparison, is the
    // incentive the sweep mechanic exists to create.
    expect(scoreFor('square-loop', 12, DEFAULT_CONFIG)).toBeGreaterThan(
      scoreFor('plain', 4, DEFAULT_CONFIG),
    );
  });

  it('lets a long plain chain out-score a sweep of the same cleared count', () => {
    // The triangular curve grows quadratically, the sweep linearly, so they
    // cross at 5 and plain wins above it. That is intended: reaching a plain
    // chain of 6 takes six linked dots, while a sweep of 6 would mean only six
    // dots of that colour remained on the whole board.
    expect(scoreFor('plain', 6, DEFAULT_CONFIG)).toBeGreaterThan(
      scoreFor('square-loop', 6, DEFAULT_CONFIG),
    );
  });

  it('honours config overrides', () => {
    const config = { ...DEFAULT_CONFIG, baseScore: 1, sweepMultiplier: 10 };
    expect(scoreFor('plain', 4, config)).toBe(10);
    expect(scoreFor('line', 4, config)).toBe(40);
  });

  it('returns an integer', () => {
    for (let n = 3; n < 40; n++) {
      expect(Number.isInteger(scoreFor('plain', n, DEFAULT_CONFIG))).toBe(true);
    }
  });
});
