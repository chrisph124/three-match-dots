/**
 * Shared constants and types for the Voyage difficulty model (Phases 3–5). One
 * source of truth: the curve, the budget spender, and the generator all import
 * from here, so tuning a price or a curve constant is a single edit. Pure TS —
 * no RN/Skia, no RNG state of its own (the spender threads the core PRNG).
 *
 * The numbers here are a *draft* calibration. Real values come from the Phase 5
 * solver sweep and on-device playtest, not from this file — but they all live
 * here so that tuning never means hunting through generator logic.
 */

/** The base board's colour count; the colour dial spends UP from here. */
export const BASE_COLORS = 3;
/** The base minimum chain length; the minChain dial can raise it one step. */
export const BASE_MIN_CHAIN = 3;
/** The hardest legal minimum chain — a design/scope ceiling, the schema's `[2,4]`
 *  envelope. (`deadlock.ts` is a sound path search at every minChain, not the cap.) */
export const MAX_MIN_CHAIN = 4;

/**
 * Point prices for each difficulty dial (approved model). A level's budget `D`
 * is spent across these; the spender never exceeds `D` and never buys an illegal
 * dial. Colours cost most (they reshape the whole board), a minChain step is a
 * one-time premium, obstacles and move-tightening are the cheap fine-grain dials.
 */
export const DIAL_PRICES = {
  /** Per colour added above `BASE_COLORS`. */
  color: 2,
  /** Per caged-dot obstacle. */
  obstacle: 1,
  /** Per one-step tightening of the move budget. */
  movesTighten: 1,
  /** One-time, to raise minChain from 3 to 4. */
  minChain: 3,
} as const;

/** The move budget a moves-constrained level starts from before tightening. */
export const BASE_MOVE_BUDGET = 30;
/** How many moves one tighten step removes from `BASE_MOVE_BUDGET`. */
export const MOVE_TIGHTEN_STEP = 2;
/** The floor a tightened move budget can never drop below (kept winnable). */
export const MIN_MOVE_BUDGET = 8;
/** Derived cap on tighten steps so the move budget stays at/above the floor. */
export const MAX_MOVES_TIGHTEN = Math.floor(
  (BASE_MOVE_BUDGET - MIN_MOVE_BUDGET) / MOVE_TIGHTEN_STEP,
);

/** Absolute ceiling on caged-dot obstacles per level (a fairness bound). */
export const MAX_OBSTACLES = 12;

// ── Curve shape (difficulty-curve.ts) ───────────────────────────────────────
/** The plateau the saturating base ramp approaches as `index → ∞`. */
export const PLATEAU_HEIGHT = 1.2;
/** Ramp time-constant: `base = PLATEAU_HEIGHT · (1 − e^(−index/RAMP_TAU))`. */
export const RAMP_TAU = 60;
/** Difficulty added on a boss level (`index % 10 === 0`). */
export const BOSS_BUMP = 0.35;
/** Difficulty removed on the post-boss relief level (`index % 10 === 1`). */
export const RELIEF_DIP = 0.15;
/** Gentle intra-block rise per position for `index % 10 ∈ 2..9`. */
export const INTRA_BLOCK_STEP = 0.03;

/** A concrete difficulty shaping vector — the output of `spend`. */
export type DialVector = {
  /** Final colour count, in `[BASE_COLORS, paletteSize]`. */
  readonly colors: number;
  /** Final minimum chain length, in `[BASE_MIN_CHAIN, MAX_MIN_CHAIN]`. */
  readonly minChain: number;
  /** Number of caged-dot obstacles. */
  readonly obstacleCount: number;
  /** Number of move-budget tighten steps applied. */
  readonly movesTighten: number;
};

/**
 * Biases how a budget is spent so equal-`D` levels feel different. `bigSpend`
 * orders the two priced (>1pt) axes; `obstacleBias` is the probability a cheap
 * (1pt) leftover point buys an obstacle rather than tightening the move budget.
 */
export type DifficultyProfile = {
  readonly name: string;
  readonly bigSpend: readonly ('colors' | 'minChain')[];
  readonly obstacleBias: number;
};

/** The board dimensions the spender clamps its dial vector against. */
export type BoardLimits = {
  /** Render palette length — the hard cap on `colors`. */
  readonly paletteSize: number;
  readonly rows: number;
  readonly cols: number;
};

/** The shipped spend profiles. Different order/bias ⇒ different feel at equal D. */
export const PROFILES: Readonly<Record<string, DifficultyProfile>> = {
  balanced: { name: 'balanced', bigSpend: ['colors', 'minChain'], obstacleBias: 0.5 },
  obstacleHeavy: { name: 'obstacle-heavy', bigSpend: ['minChain', 'colors'], obstacleBias: 0.8 },
  tightMoves: { name: 'tight-moves', bigSpend: ['colors', 'minChain'], obstacleBias: 0.15 },
  colorRich: { name: 'color-rich', bigSpend: ['colors', 'minChain'], obstacleBias: 0.35 },
};

/** The move budget a level plays under, given its tighten-step count. */
export function moveBudgetForTighten(movesTighten: number): number {
  return Math.max(MIN_MOVE_BUDGET, BASE_MOVE_BUDGET - movesTighten * MOVE_TIGHTEN_STEP);
}

// ── Generation (Phase 4) ────────────────────────────────────────────────────
/** Candidate constraint values the generator emits; the Phase 5 solver retunes. */
export const TIMED_START_MS = 60000;
export const TIMED_MISTAKE_PENALTY_MS = 2000;
export const TIMED_CLEAR_BONUS_MS = 500;
export const MISTAKES_CAP = 5;

/** clearColor target = clamp(BASE + D·PER_D) — a candidate the solver may retune. */
export const BASE_CLEAR_COUNT = 8;
export const CLEAR_COUNT_PER_D = 0.4;
export const MIN_CLEAR_COUNT = 4;
export const MAX_CLEAR_COUNT = 30;

/** A candidate clearColor target for a difficulty budget `D` (the solver retunes). */
export function clearCountFor(D: number): number {
  const raw = Math.round(BASE_CLEAR_COUNT + D * CLEAR_COUNT_PER_D);
  return Math.min(MAX_CLEAR_COUNT, Math.max(MIN_CLEAR_COUNT, raw));
}

/** Variety: within this sliding window, non-boss neighbours must stay distinct. */
export const VARIETY_WINDOW = 8;
/**
 * Max signature similarity allowed between window neighbours. With the 5-field
 * signature, `≤ 0.6` means at least 2 of 5 fields (≥40%) differ — the plan's rule.
 */
export const VARIETY_SIMILARITY_MAX = 0.6;
/** How many archetype/seed re-rolls to try before accepting the least-similar. */
export const VARIETY_MAX_RETRIES = 16;
/**
 * The accepted ceiling on the variety *shortfall rate* — the fraction of window
 * neighbour pairs that exceed `VARIETY_SIMILARITY_MAX` after the re-roll settles.
 *
 * A shortfall floor is structural, not a bug: with 6 archetypes and a window of
 * 8, some window must repeat an archetype (pigeonhole), and once difficulty
 * plateaus the colour/minChain axes pin, so a repeat can only differ in the
 * obstacle/constraint fields — sometimes just one. The Phase-4 variety risk plan
 * sanctions this: accept the least-similar candidate and *count* the shortfall
 * (no silent cap). The re-roll still guarantees no two window neighbours are
 * identical (`worst < 1`); this bounds how often a pair may be one-field-apart.
 * Measured ≈0.038 over the first 200 levels; the ceiling leaves tuning headroom.
 */
export const VARIETY_MAX_SHORTFALL_RATE = 0.06;

/** The curated Episode-1 teaching ramp occupies levels 1..EPISODE_1_LAST. */
export const EPISODE_1_LAST = 10;
/** Bosses land on every BOSS_EVERY-th level. */
export const BOSS_EVERY = 10;

/** The Voyage board footprint (base 6×6, matching the shipped Endless board). */
export const VOYAGE_ROWS = 6;
export const VOYAGE_COLS = 6;

// ── Solver calibration (Phase 5) ─────────────────────────────────────────────
/**
 * The headless solver plays each generated level to derive a fair budget instead
 * of guessing one. These are the only tuning knobs; on-device playtest retunes
 * them here, never in the solver logic.
 */
/** Percentile of the sampled `movesUsed` distribution the budget is drawn from. */
export const SOLVER_PERCENTILE = 0.75;
/** Head-room added over the p75 move count for an ordinary level (0.5 ⇒ +50%). */
export const SOLVER_SLACK = 0.5;
/** Wider head-room for a boss, targeting the ~80%-first-attempt-pass boss feel. */
export const SOLVER_BOSS_SLACK = 0.8;
/** Board deals sampled per level when calibrating (p75 over this many plays). */
export const SOLVER_SAMPLES = 5;
/**
 * Max committed moves the solver plays before declaring a level unbeaten. A
 * guard against a churn loop, not an expected path: the board is ≤64 cells and a
 * competent line wins well inside this. A level the solver can't beat within the
 * cap is flagged by the winnability sweep (never silently shipped).
 *
 * It does triple duty in `solver.ts`: the `runGreedy` step bound, the relaxed
 * budget a measurement play runs under (`relaxConstraint`, so calibration never
 * loses on the clock), and the worst-case value `percentile` returns for an
 * empty sample. Retune all three by moving this one number.
 */
export const SOLVER_STEP_CAP = 40;
/**
 * Modeled wall-clock a competent player spends finding and drawing one move.
 * Converts a solver `movesUsed` count into a `timed` level's `startMs` budget.
 */
export const SOLVER_MS_PER_MOVE = 3000;
/** Floor a calibrated `timed` budget never drops below, so short levels breathe. */
export const SOLVER_TIMED_FLOOR_MS = 15000;

/** The episode a level index belongs to (1-based, one episode per boss block). */
export function episodeOf(index: number): number {
  return Math.ceil(index / BOSS_EVERY);
}

/**
 * A stable, well-spread board seed for a level index (Knuth multiplicative hash).
 * `>>> 0` keeps it a non-negative 32-bit int, as the schema's `seed` requires.
 */
export function seedForIndex(index: number): number {
  return (Math.imul(index, 2654435761) ^ 0x9e3779b9) >>> 0;
}

/** Deterministically mixes a base seed with a re-roll attempt number. */
export function mixSeed(seed: number, attempt: number): number {
  return (Math.imul(seed ^ attempt, 2246822519) + 0x9e3779b9) >>> 0;
}
