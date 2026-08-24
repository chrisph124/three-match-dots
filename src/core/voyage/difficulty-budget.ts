import { next } from '../rng';
import {
  BASE_COLORS,
  BASE_MIN_CHAIN,
  DIAL_PRICES,
  MAX_MIN_CHAIN,
  MAX_MOVES_TIGHTEN,
  MAX_OBSTACLES,
  type BoardLimits,
  type DialVector,
  type DifficultyProfile,
} from './voyage-config';

/**
 * Turns a difficulty target `d` into a point budget, and spends that budget
 * across the difficulty dials. Pure TS. `budget` is deterministic; `spend`
 * threads the core PRNG state explicitly (like `rng.ts`) so a level is
 * reproducible from its index alone.
 *
 * The spender is a greedy priced allocator: it funds the profile's priced (>1pt)
 * axes in order, then distributes every leftover 1-pt point across the two cheap
 * axes (obstacles / move-tightening) biased by the profile, with the PRNG
 * breaking each cheap choice so equal `(D, profile)` levels still diverge by
 * seed. Every increment is guarded against the board's legality envelope, so the
 * emitted vector is always schema-legal (`colors ≤ paletteSize`,
 * `minChain ∈ [3,4]`, `colors × minChain ≤ rows × cols`).
 */

/** The integer point budget for a difficulty target: `D = round(10 · d)`. */
export function budget(d: number): number {
  return Math.max(0, Math.round(10 * d));
}

/** The point cost of a dial vector — the inverse of what `spend` allocated. */
export function dialPointCost(dials: DialVector): number {
  const colorCost = (dials.colors - BASE_COLORS) * DIAL_PRICES.color;
  const minChainCost = dials.minChain > BASE_MIN_CHAIN ? DIAL_PRICES.minChain : 0;
  const obstacleCost = dials.obstacleCount * DIAL_PRICES.obstacle;
  const movesCost = dials.movesTighten * DIAL_PRICES.movesTighten;
  return colorCost + minChainCost + obstacleCost + movesCost;
}

/** Obstacle ceiling for a board: the global cap, two floor rows, or every cell. */
function maxObstaclesFor(limits: BoardLimits): number {
  return Math.min(MAX_OBSTACLES, limits.cols * 2, limits.rows * limits.cols);
}

/** True when adding one more colour (from `colors`) keeps the board legal. */
function canAddColor(colors: number, minChain: number, limits: BoardLimits): boolean {
  const raised = colors + 1;
  return raised <= limits.paletteSize && raised * minChain <= limits.rows * limits.cols;
}

/** True when raising minChain to its max keeps the board legal at `colors`. */
function canRaiseMinChain(colors: number, minChain: number, limits: BoardLimits): boolean {
  return minChain < MAX_MIN_CHAIN && colors * MAX_MIN_CHAIN <= limits.rows * limits.cols;
}

export type SpendResult = {
  readonly dials: DialVector;
  readonly rngState: number;
};

/** The priced (>1pt) axes funded, plus the points left for the cheap axes. */
type PricedSpend = {
  readonly colors: number;
  readonly minChain: number;
  readonly remaining: number;
};

/** Funds colours and the minChain step in the profile's order, legality-clamped. */
function fundPricedAxes(D: number, profile: DifficultyProfile, limits: BoardLimits): PricedSpend {
  let remaining = D;
  let colors = BASE_COLORS;
  let minChain = BASE_MIN_CHAIN;
  for (const axis of profile.bigSpend) {
    if (axis === 'colors') {
      while (remaining >= DIAL_PRICES.color && canAddColor(colors, minChain, limits)) {
        colors += 1;
        remaining -= DIAL_PRICES.color;
      }
    } else if (remaining >= DIAL_PRICES.minChain && canRaiseMinChain(colors, minChain, limits)) {
      minChain = MAX_MIN_CHAIN;
      remaining -= DIAL_PRICES.minChain;
    }
  }
  return { colors, minChain, remaining };
}

/** The cheap (1pt) axes funded from the leftover points, plus the advanced PRNG state. */
type CheapSpend = {
  readonly obstacleCount: number;
  readonly movesTighten: number;
  readonly rngState: number;
};

/**
 * Spreads every leftover 1-pt point across obstacles / move-tightening, the PRNG
 * breaking each choice (biased by `profile.obstacleBias`) so equal `(D, profile)`
 * levels still diverge by seed. Stops when no legal cheap dial can absorb a point.
 */
function distributeCheapPoints(
  points: number,
  profile: DifficultyProfile,
  rngState: number,
  limits: BoardLimits,
): CheapSpend {
  let remaining = points;
  let state = rngState;
  let obstacleCount = 0;
  let movesTighten = 0;
  const obstacleCap = maxObstaclesFor(limits);
  for (;;) {
    const canObstacle = remaining >= DIAL_PRICES.obstacle && obstacleCount < obstacleCap;
    const canMoves = remaining >= DIAL_PRICES.movesTighten && movesTighten < MAX_MOVES_TIGHTEN;
    if (!canObstacle && !canMoves) {
      break;
    }
    let buyObstacle = canObstacle;
    if (canObstacle && canMoves) {
      const step = next(state);
      state = step.state;
      buyObstacle = step.value < profile.obstacleBias;
    }
    if (buyObstacle) {
      obstacleCount += 1;
    } else {
      movesTighten += 1;
    }
    remaining -= 1;
  }
  return { obstacleCount, movesTighten, rngState: state };
}

/**
 * Distributes `D` points across the dials for a profile. Never overspends and
 * never emits an illegal dial vector; leftover points that no legal dial can
 * absorb are simply not spent.
 */
export function spend(
  D: number,
  profile: DifficultyProfile,
  rngState: number,
  limits: BoardLimits,
): SpendResult {
  const priced = fundPricedAxes(Math.max(0, D), profile, limits);
  const cheap = distributeCheapPoints(priced.remaining, profile, rngState, limits);
  return {
    dials: {
      colors: priced.colors,
      minChain: priced.minChain,
      obstacleCount: cheap.obstacleCount,
      movesTighten: cheap.movesTighten,
    },
    rngState: cheap.rngState,
  };
}
