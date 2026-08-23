import { nextInt } from './rng';
import type { Color, GameConfig, GameState, Resolution } from './types';

/**
 * Builds an opening board from a seed. Throws on invalid config: that is a
 * startup-time programmer error, not something reachable mid-drag.
 */
export function newGame(config: GameConfig, seed: number): GameState {
  if (config.rows < 2) {
    throw new Error(`config.rows must be at least 2, got ${config.rows}`);
  }
  if (config.cols < 2) {
    throw new Error(`config.cols must be at least 2, got ${config.cols}`);
  }
  if (config.colors < 2) {
    throw new Error(`config.colors must be at least 2, got ${config.colors}`);
  }
  if (config.minChain < 2) {
    throw new Error(`config.minChain must be at least 2, got ${config.minChain}`);
  }

  const board: Color[] = [];
  let state = seed;
  for (let i = 0; i < config.rows * config.cols; i++) {
    const step = nextInt(state, config.colors);
    state = step.state;
    board.push(step.value);
  }

  return { config, board, score: 0, rngState: state, heat: 0, lastKind: null };
}

/** Folds a resolution into the next immutable game state. */
export function applyResolution(state: GameState, resolution: Resolution): GameState {
  return {
    config: state.config,
    board: resolution.board,
    score: state.score + resolution.scoreDelta,
    rngState: resolution.rngState,
    // Inert when heat is off: a heatless resolution reads as 0, and lastKind is
    // just carried metadata the multiplier only consults on a heat-enabled config.
    heat: resolution.heat ?? 0,
    lastKind: resolution.kind,
  };
}
