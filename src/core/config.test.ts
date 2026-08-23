import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, ENDLESS_CONFIG } from './config';

describe('ENDLESS_CONFIG (heat economy flipped on)', () => {
  it('turns the locked heat-economy bundle on', () => {
    // The dark launch is over: Endless now runs the tuned economy. Asserting the
    // exact owner-locked bundle means a stray dial tweak trips this guard instead
    // of silently reshaping shipped gameplay. Change these numbers only behind a
    // fresh on-device feel check.
    expect(ENDLESS_CONFIG).toEqual({
      ...DEFAULT_CONFIG,
      lineLength: 6,
      heatCap: 3,
      heatStep: 0.5,
      sweepExclusionWeight: 1,
    });
  });

  it('leaves DEFAULT_CONFIG and every Journey config inert (dials off)', () => {
    // Only Endless enables the economy. The default keeps the dials off, and
    // every Journey config is built fresh without them — so both stay
    // byte-identical to the shipped game.
    expect(DEFAULT_CONFIG.heatCap).toBeUndefined();
    expect(DEFAULT_CONFIG.heatStep).toBeUndefined();
    expect(DEFAULT_CONFIG.sweepExclusionWeight).toBeUndefined();
    expect(DEFAULT_CONFIG.lineLength).toBe(5);
    expect(ENDLESS_CONFIG.lineLength).toBe(6);
  });
});
