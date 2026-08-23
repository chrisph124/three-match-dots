import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, ENDLESS_CONFIG } from '../config';
import { hasLegalMove } from '../deadlock';
import { applyResolution, newGame } from '../game';
import { shuffleBoard } from '../shuffle';
import type { Board, Chain, Color, GameConfig, GameState, Resolution } from '../types';
import { classifyChain } from './classify-chain';
import { resolveChain } from './resolve-chain';
import { scoreFor } from './scoring';

/**
 * Seeded Monte-Carlo gate for the Endless combo-heat economy. It plays the
 * TARGET flipped bundle (heatCap 3, heatStep 0.5, sweepExclusionWeight w,
 * lineLength 6) against the shipped DEFAULT_CONFIG baseline over many fixed
 * seeds, and refuses to let a degenerate economy merge.
 *
 * Two things make this a real gate and not a rubber stamp (red-team F4):
 *  - The bounds below are PRE-COMMITTED in the plan; changing one is a visible
 *    user decision, never a mid-implementation "tune until green".
 *  - Three adversaries run, including farm-then-cash — the exact worst case the
 *    user's F5 override (heat multiplies plain commits too) opens up.
 *
 * There is no chain enumerator in the core (hasLegalMove is only a
 * component-size check), so move generation here is bounded test infrastructure:
 * loops and lines are found exhaustively (both cheap, O(cells)), while the
 * longest plain chain is a Warnsdorff-style greedy snake — a heuristic, not a
 * guaranteed maximum. That makes farm-then-cash a slightly conservative worst
 * case, which is the safe direction for a bound.
 */

// ---- Acceptance bounds (owner-decided; see plan open-Q3) --------------------
// Endless is no-fail and has no leaderboard, so a high-value farm-then-cash line
// reads as skill, not an exploit to design out. The owner shipped the "full
// send" flip: full color exclusion on a hot heat curve, with the ceiling set
// above the farm-then-cash cash-in rather than the bundle softened to fit it.
const MAX_SCORE_RATE_RATIO = 3.0; // flipped/baseline, max across greedy + farm-then-cash
// Normal-play collapse guard: how much MORE a myopic score-maximizer sweeps
// under the flip than in the shipped game. This measures whether the economy
// forces degenerate play — not whether a dedicated farmer CAN sweep.
const MAX_SWEEP_SHARE_DELTA = 0.2;
const EXCLUSION_WEIGHTS = [1] as const; // owner pinned full exclusion (w=1)

// ---- Runtime budget (runs on every husky pre-push) -------------------------
const SEEDS = 24;
const MOVES = 45;

const BASELINE: GameConfig = { ...DEFAULT_CONFIG };
const flipped = (w: number): GameConfig => ({
  ...DEFAULT_CONFIG,
  heatCap: 3,
  heatStep: 0.5,
  sweepExclusionWeight: w,
  lineLength: 6,
});

// The sim hand-rolls `flipped()` so it can sweep `w`. Guard that the bundle the
// app actually ships — ENDLESS_CONFIG at the owner-pinned w=1 — is exactly what
// this gate proves. Without it, a later dial tweak in config.ts could leave the
// sim vouching for a stale bundle the game no longer runs.
describe('flip bundle matches the shipped Endless config', () => {
  it('flipped(1) equals ENDLESS_CONFIG', () => {
    expect(flipped(1)).toEqual(ENDLESS_CONFIG);
  });
});

// ---------------------------------------------------------------------------
// Move generation (bounded test infrastructure)
// ---------------------------------------------------------------------------

const countColor = (board: Board, color: Color): number =>
  board.reduce((n, c) => (c === color ? n + 1 : n), 0);

/** Every monochrome 2×2 block, encoded as a closing loop chain [tl,tr,br,bl,tl]. */
function collectLoops(board: Board, rows: number, cols: number): Chain[] {
  const loops: Chain[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = r * cols + c;
      const tr = tl + 1;
      const bl = tl + cols;
      const br = bl + 1;
      const color = board[tl];
      if (color === board[tr] && color === board[bl] && color === board[br]) {
        loops.push([tl, tr, br, bl, tl]);
      }
    }
  }
  return loops;
}

const LINE_DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

/** The straight monochrome run of length `len` from (r,c) along (dr,dc), or null. */
function straightRun(
  board: Board,
  rows: number,
  cols: number,
  r: number,
  c: number,
  dr: number,
  dc: number,
  len: number,
): number[] | null {
  const color = board[r * cols + c];
  const run: number[] = [];
  for (let k = 0; k < len; k++) {
    const nr = r + dr * k;
    const nc = c + dc * k;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) return null;
    if (board[nr * cols + nc] !== color) return null;
    run.push(nr * cols + nc);
  }
  return run;
}

/** Straight monochrome runs of exactly `lineLength`, over the four axes. */
function collectLines(board: Board, rows: number, cols: number, lineLength: number): Chain[] {
  const lines: Chain[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [dr, dc] of LINE_DIRS) {
        const run = straightRun(board, rows, cols, r, c, dr, dc, lineLength);
        if (run) lines.push(run);
      }
    }
  }
  return lines;
}

/** Same-colour 8-neighbours of a cell. */
function sameColorNeighbors(board: Board, rows: number, cols: number, cell: number): number[] {
  const row = Math.floor(cell / cols);
  const col = cell % cols;
  const color = board[cell];
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const n = nr * cols + nc;
      if (board[n] === color) out.push(n);
    }
  }
  return out;
}

// The whole board: a snake can in principle cover every cell of one color. A
// low cap would truncate exactly the long post-exclusion cash-in snake that the
// F5 plain-multiplier exploit relies on, understating inflation (anti-safe).
const MAX_SNAKE = 36;

/**
 * One Warnsdorff greedy snake from `start`: always step to the same-colour
 * neighbour with the fewest onward options, so the path snakes rather than
 * dead-ends early. Deterministic (fixed neighbour order, lowest-index tie-break).
 */
function snakeFrom(board: Board, rows: number, cols: number, start: number): number[] {
  const visited = new Set<number>([start]);
  const path = [start];
  while (path.length < MAX_SNAKE) {
    const options = sameColorNeighbors(board, rows, cols, path[path.length - 1]).filter(
      (n) => !visited.has(n),
    );
    if (options.length === 0) break;
    let pick = options[0];
    let pickDegree = Infinity;
    for (const n of options) {
      const degree = sameColorNeighbors(board, rows, cols, n).filter((m) => !visited.has(m)).length;
      if (degree < pickDegree) {
        pickDegree = degree;
        pick = n;
      }
    }
    visited.add(pick);
    path.push(pick);
  }
  return path;
}

/**
 * Longest plain chain: the best Warnsdorff snake over every start. Trims a
 * trailing cell if the run came out collinear, so the result classifies plain,
 * never an accidental line.
 */
function bestPlainChain(
  board: Board,
  rows: number,
  cols: number,
  minChain: number,
  lineLength: number,
): Chain | null {
  let best: number[] = [];
  for (let start = 0; start < board.length; start++) {
    const path = snakeFrom(board, rows, cols, start);
    if (path.length > best.length) best = path;
  }

  let chain = best;
  // Never hand back a run that would classify as a line — cash-in wants plain.
  while (chain.length >= minChain && classifyChain(chain, cols, lineLength) !== 'plain') {
    chain = chain.slice(0, -1);
  }
  if (chain.length >= minChain) return chain;

  // Fallback: any cell with two same-colour neighbours yields a 3-chain, which
  // must exist whenever hasLegalMove is true for minChain 3.
  for (let cell = 0; cell < board.length; cell++) {
    const n = sameColorNeighbors(board, rows, cols, cell);
    if (n.length >= 2) return [n[0], cell, n[1]];
  }
  return null;
}

type Candidates = {
  readonly loops: Chain[];
  readonly lines: Chain[];
  readonly plain: Chain | null;
  readonly sweepByColor: Map<Color, Chain>;
};

function generate(board: Board, config: GameConfig): Candidates {
  const { rows, cols, minChain, lineLength } = config;
  const loops = collectLoops(board, rows, cols);
  const lines = collectLines(board, rows, cols, lineLength);
  const sweepByColor = new Map<Color, Chain>();
  for (const chain of [...loops, ...lines]) {
    const color = board[chain[0]];
    if (!sweepByColor.has(color)) sweepByColor.set(color, chain);
  }
  return {
    loops,
    lines,
    plain: bestPlainChain(board, rows, cols, minChain, lineLength),
    sweepByColor,
  };
}

// ---------------------------------------------------------------------------
// Bots — each returns the chain to commit, or null to force a reshuffle
// ---------------------------------------------------------------------------

const heatFactor = (isSweep: boolean, heat: number, config: GameConfig): number => {
  const cap = config.heatCap ?? 0;
  const step = config.heatStep ?? 0;
  const nextHeat = isSweep ? Math.min(cap, heat + 1) : Math.max(0, heat - 1);
  return 1 + nextHeat * step;
};

/** Myopic: play whichever single move scores highest right now, heat included. */
function greedyScoreBot(state: GameState, cand: Candidates): Chain | null {
  const { board, config } = state;
  const heat = state.heat ?? 0;
  let bestChain: Chain | null = null;
  let bestScore = -1;

  for (const [color, chain] of cand.sweepByColor) {
    const kind = classifyChain(chain, config.cols, config.lineLength);
    const score = scoreFor(kind, countColor(board, color), config) * heatFactor(true, heat, config);
    if (score > bestScore) {
      bestScore = score;
      bestChain = chain;
    }
  }
  if (cand.plain) {
    const score = scoreFor('plain', cand.plain.length, config) * heatFactor(false, heat, config);
    if (score > bestScore) bestChain = cand.plain;
  }
  return bestChain;
}

/** Worst-case escalator: always take a sweep, loops first, to farm the board. */
function sweepWheneverBot(_state: GameState, cand: Candidates): Chain | null {
  if (cand.loops.length > 0) return cand.loops[0];
  if (cand.lines.length > 0) return cand.lines[0];
  return cand.plain;
}

/** Build heat to the cap with sweeps, then cash it in on the longest plain snake. */
function farmThenCashBot(state: GameState, cand: Candidates): Chain | null {
  const cap = state.config.heatCap ?? 0;
  const heat = state.heat ?? 0;
  const sweep = cand.loops[0] ?? cand.lines[0] ?? null;
  if (heat < cap) return sweep ?? cand.plain; // still farming
  return cand.plain ?? sweep; // at cap → cash in
}

type Bot = (state: GameState, cand: Candidates) => Chain | null;

// ---------------------------------------------------------------------------
// Driver + metrics
// ---------------------------------------------------------------------------

type GameMetrics = {
  score: number;
  scoredMoves: number;
  loopMoves: number;
  sweepCommits: number;
  followUpLoop: number;
  followUpLine: number;
  plainLenSum: number;
  plainCommits: number;
};

/** Fold one committed resolution into the running metrics. */
function recordResolution(m: GameMetrics, res: Resolution, chain: Chain, config: GameConfig): void {
  m.scoredMoves++;
  if (res.kind === 'square-loop') m.loopMoves++;
  if (res.kind === 'plain') {
    m.plainCommits++;
    m.plainLenSum += chain.length;
    return;
  }
  m.sweepCommits++;
  const { rows, cols, lineLength } = config;
  if (collectLoops(res.board, rows, cols).length > 0) m.followUpLoop++;
  if (collectLines(res.board, rows, cols, lineLength).length > 0) m.followUpLine++;
}

function runGame(config: GameConfig, seed: number, bot: Bot): GameMetrics {
  let state = newGame(config, seed);
  const m: GameMetrics = {
    score: 0,
    scoredMoves: 0,
    loopMoves: 0,
    sweepCommits: 0,
    followUpLoop: 0,
    followUpLine: 0,
    plainLenSum: 0,
    plainCommits: 0,
  };
  const { rows, cols, minChain } = config;

  for (let move = 0; move < MOVES; move++) {
    if (!hasLegalMove(state.board, rows, cols, minChain)) {
      const s = shuffleBoard(state.board, config, state.rngState);
      state = { ...state, board: s.board, rngState: s.rngState };
      continue;
    }
    const chain = bot(state, generate(state.board, config));
    if (chain === null) break;
    const res = resolveChain(state, chain);
    if (res === null) break; // a well-formed candidate should never be rejected
    recordResolution(m, res, chain, config);
    state = applyResolution(state, res);
  }

  m.score = state.score;
  return m;
}

function aggregate(config: GameConfig, bot: Bot, seeds: number = SEEDS): GameMetrics {
  const total: GameMetrics = {
    score: 0,
    scoredMoves: 0,
    loopMoves: 0,
    sweepCommits: 0,
    followUpLoop: 0,
    followUpLine: 0,
    plainLenSum: 0,
    plainCommits: 0,
  };
  for (let seed = 1; seed <= seeds; seed++) {
    const g = runGame(config, seed, bot);
    total.score += g.score;
    total.scoredMoves += g.scoredMoves;
    total.loopMoves += g.loopMoves;
    total.sweepCommits += g.sweepCommits;
    total.followUpLoop += g.followUpLoop;
    total.followUpLine += g.followUpLine;
    total.plainLenSum += g.plainLenSum;
    total.plainCommits += g.plainCommits;
  }
  return total;
}

const scoreRate = (m: GameMetrics): number => (m.scoredMoves === 0 ? 0 : m.score / m.scoredMoves);

const loopFrac = (m: GameMetrics): number =>
  m.scoredMoves === 0 ? 0 : m.loopMoves / m.scoredMoves;

/** Honest policy-collapse metric (kongming): a score-maximizer's sweep share. */
const sweepShare = (m: GameMetrics): number =>
  m.scoredMoves === 0 ? 0 : m.sweepCommits / m.scoredMoves;

const meanPlainLen = (m: GameMetrics): number =>
  m.plainCommits === 0 ? 0 : m.plainLenSum / m.plainCommits;

describe('Endless heat economy — seeded Monte-Carlo merge gate', () => {
  // Baselines computed once per bot (dials off, lineLength 5).
  const baseGreedy = aggregate(BASELINE, greedyScoreBot);
  const baseFarm = aggregate(BASELINE, farmThenCashBot);
  const baseSweep = aggregate(BASELINE, sweepWheneverBot);
  const baseShare = sweepShare(baseGreedy);

  type Row = {
    w: number;
    inflation: number;
    shareDelta: number;
    meanCashSnake: number;
    pFollowLoop: number;
    passes: boolean;
  };

  const table: Row[] = EXCLUSION_WEIGHTS.map((w) => {
    const cfg = flipped(w);
    const greedy = aggregate(cfg, greedyScoreBot);
    const farm = aggregate(cfg, farmThenCashBot);

    // Inflation is the worst case across normal play (greedy) and the dedicated
    // farm-then-cash exploit — the exact worst case the F5 override opens up.
    const inflation = Math.max(
      scoreRate(greedy) / scoreRate(baseGreedy),
      scoreRate(farm) / scoreRate(baseFarm),
    );
    const shareDelta = sweepShare(greedy) - baseShare;
    const pFollowLoop = farm.sweepCommits === 0 ? 0 : farm.followUpLoop / farm.sweepCommits;
    return {
      w,
      inflation,
      shareDelta,
      meanCashSnake: meanPlainLen(farm),
      pFollowLoop,
      passes: inflation <= MAX_SCORE_RATE_RATIO && shareDelta <= MAX_SWEEP_SHARE_DELTA,
    };
  });

  const selected = table.find((r) => r.passes);

  it('reports the metric table for the record', () => {
    console.info(
      `BASELINE (dials off, lineLength 5): greedy sweepShare=${baseShare.toFixed(2)} ` +
        `sweep-bot loopFrac=${loopFrac(baseSweep).toFixed(2)}`,
    );
    for (const r of table) {
      // meanCashSnake + P(follow-up loop) are diagnostics, not gates: at full
      // exclusion the farm bot inherently draws long snakes and follow-up loops
      // (that IS the mechanic the owner chose), so they are logged, not asserted.
      console.info(
        `w=${r.w}: inflation=${r.inflation.toFixed(2)}x sweepShareΔ=${r.shareDelta.toFixed(2)} ` +
          `farm meanCashSnake=${r.meanCashSnake.toFixed(1)} P(follow-up loop)=${r.pFollowLoop.toFixed(2)} ` +
          `${r.passes ? 'PASS' : 'fail'}`,
      );
    }
    console.info(
      selected ? `confirmed sweepExclusionWeight = ${selected.w}` : 'FLIP BUNDLE FAILS ITS CEILING',
    );
    expect(table).toHaveLength(EXCLUSION_WEIGHTS.length);
  });

  it('clears the raised ceiling at the owner-pinned exclusion weight', () => {
    // If this fails, the shipped flip bundle no longer clears its own ceiling —
    // re-open the bound decision with the owner; do NOT quietly soften the bundle.
    expect(selected).toBeDefined();
  });

  it('keeps the score-rate ratio within the ceiling', () => {
    expect(selected).toBeDefined();
    expect(selected?.inflation).toBeLessThanOrEqual(MAX_SCORE_RATE_RATIO);
  });

  it('does not collapse a score-maximizer into always-sweeping', () => {
    expect(selected).toBeDefined();
    expect(selected?.shareDelta).toBeLessThanOrEqual(MAX_SWEEP_SHARE_DELTA);
  });
});
