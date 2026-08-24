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
 * Endless mode's config. Runs the tuned combo-heat economy: heat multiplies
 * every commit (heatCap/heatStep), a colour-sweep's own refill wave fully bans
 * the swept colour (sweepExclusionWeight 1), and the sweep line is retuned
 * Endless-only from 5 → 6 so a straight sweep stays earned with three colours.
 * The seeded sim (`heat-economy.sim.test.ts`) holds this bundle under its score
 * -rate and sweep-share ceilings; the numbers are owner-locked. If play feels
 * degenerate on device, tune `sweepExclusionWeight` or `heatStep` DOWN — the sim
 * is a floor, not a ceiling, on the farm-then-cash line.
 *
 * Endless is the only consumer that enables these dials; `DEFAULT_CONFIG` and
 * every Journey config keep them off, so both stay byte-identical to the
 * shipped game.
 */
export const ENDLESS_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  lineLength: 6,
  heatCap: 3,
  heatStep: 0.5,
  sweepExclusionWeight: 1,
};
