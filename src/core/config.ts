import type { GameConfig } from './types';

/**
 * Three colours plus a 3-dot minimum is what makes the board feel dense.
 * lineLength and sweepMultiplier are the tuning dials: with only three
 * colours a straight five is easy to draw, so expect to raise lineLength
 * or lower sweepMultiplier after playing on device.
 */
export const DEFAULT_CONFIG: GameConfig = {
  rows: 6,
  cols: 6,
  colors: 3,
  minChain: 3,
  lineLength: 5,
  baseScore: 10,
  sweepMultiplier: 3,
};

/**
 * Endless mode's config. DARK-LAUNCHED: it currently mirrors `DEFAULT_CONFIG`
 * exactly, so Endless is byte-identical to the shipped game. The heat economy
 * (heatCap/heatStep), post-sweep refill exclusion (sweepExclusionWeight), and
 * the Endless-only sweep retune (lineLength 5 → 6) are turned on in ONE gated
 * flip commit — after the seeded sim proves the tuned bundle non-degenerate and
 * an on-device feel check passes. Until then this stays a spread of the default.
 *
 * Endless is the only consumer that ever enables these dials; `DEFAULT_CONFIG`
 * and every Journey config keep them off.
 */
export const ENDLESS_CONFIG: GameConfig = { ...DEFAULT_CONFIG };
