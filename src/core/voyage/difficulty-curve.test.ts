import { describe, expect, it } from 'vitest';
import { curve } from './difficulty-curve';

describe('curve', () => {
  it('is deterministic — same index, same difficulty', () => {
    expect(curve(50)).toBe(curve(50));
    expect(curve(137)).toBe(curve(137));
  });

  it('rises gently across the intra-block positions 2..9', () => {
    // Indices 42..49 are block positions 2..9 (no boss, no dip in this span).
    for (let index = 42; index < 49; index += 1) {
      expect(curve(index)).toBeLessThan(curve(index + 1));
    }
  });

  it('spikes on the boss level — a local maximum in its block', () => {
    const boss = 30; // index % 10 === 0
    expect(curve(boss)).toBeGreaterThan(curve(boss - 1)); // > position 9
    expect(curve(boss)).toBeGreaterThan(curve(boss + 1)); // > post-boss relief
  });

  it('dips on the post-boss relief level below both its neighbours in feel', () => {
    const relief = 31; // index % 10 === 1
    expect(curve(relief)).toBeLessThan(curve(relief - 1)); // below the boss
    expect(curve(relief)).toBeLessThan(curve(29)); // below the pre-boss position 9
  });

  it('saturates: the per-100-level rise shrinks as the ramp plateaus', () => {
    // Same block position (2) each time, so only the base ramp is compared.
    const early = curve(112) - curve(12);
    const mid = curve(212) - curve(112);
    const late = curve(312) - curve(212);
    expect(early).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(late);
    expect(early).toBeGreaterThan(0.3); // a real early climb
    expect(late).toBeLessThan(0.05); // nearly flat by late game
  });

  it('never goes negative even when an early relief dip hits a low base', () => {
    expect(curve(1)).toBeGreaterThanOrEqual(0);
    expect(curve(11)).toBeGreaterThanOrEqual(0);
  });
});
