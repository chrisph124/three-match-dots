import { hasLegalMove } from '../deadlock';
import { applyResolution, newGame } from '../game';
import { anchorCells, cagedCells, levelToConfig, type LevelScript } from '../level/level-script';
import { buildAnchors, dropAnchors, remapAnchors } from '../obstacles/anchor';
import { buildCaged, chipLayers, remapMoves } from '../obstacles/caged-dot';
import { shuffleBoard } from '../shuffle';
import type { CellIndex, CellMove, GameState, Resolution } from '../types';
import { foldObjectives, initObjectives, type ObjectiveProgress } from './objectives';

/**
 * The Journey layer: a pure wrapper around the color-board core that adds a
 * countdown, objective tracking, and a caged-cell overlay. It never touches the
 * tested core (`resolve/**`, `hot/**`, `game.ts`) — it folds over the
 * `Resolution` the core already produces. Endless is unaffected.
 */

export type JourneyStatus = 'playing' | 'won' | 'lost';

export type JourneyState = {
  readonly game: GameState;
  readonly level: LevelScript;
  readonly timeRemainingMs: number;
  readonly objectives: readonly ObjectiveProgress[];
  readonly caged: ReadonlyMap<CellIndex, number>;
  /** Cells holding a non-linkable weight (an anchor overlay, sibling to `caged`). */
  readonly anchors: ReadonlySet<CellIndex>;
  readonly status: JourneyStatus;
};

/**
 * Opens a level. Deals the board deterministically from `level.seed` when the
 * author pinned one (so a level's winnability and caged-cell colors are provable
 * at authoring time), otherwise from the caller's session seed — matching
 * Endless's seeding. Time, cages, and objective targets all come from the level.
 */
export function newJourney(level: LevelScript, sessionSeed: number): JourneyState {
  const seed = level.seed ?? sessionSeed;
  const game = newGame(levelToConfig(level), seed);
  const caged = buildCaged(cagedCells(level));
  const anchors = buildAnchors(anchorCells(level));
  return {
    game,
    level,
    timeRemainingMs: level.timer?.startMs ?? 0,
    objectives: initObjectives(level.objectives, caged.size, anchors.size),
    caged,
    anchors,
    status: 'playing',
  };
}

/** Advances the timer to reflect `dtMs` elapsed since the last tick. */
export function tick(jstate: JourneyState, dtMs: number): JourneyState {
  if (jstate.status !== 'playing') {
    return jstate;
  }
  // Clamp the delta: the meta hook feeds a timestamp difference, and a queued
  // burst on foreground-return must never over-subtract or run time backwards.
  const elapsed = Math.max(0, dtMs);
  return advanceClock(jstate, jstate.timeRemainingMs - elapsed);
}

/**
 * Penalizes an invalid attempt (a chain that resolves to nothing) by removing
 * the level's mistake penalty — the GDD's "a mistake reduces your time".
 */
export function registerMistake(jstate: JourneyState): JourneyState {
  if (jstate.status !== 'playing') {
    return jstate;
  }
  const penalty = jstate.level.timer?.mistakePenaltyMs ?? 0;
  return advanceClock(jstate, jstate.timeRemainingMs - penalty);
}

/**
 * Folds one accepted resolution into the Journey. Order matters: chip the cages
 * this resolution touched (a 1-layer cage pops, a multi-layer cage sheds one
 * layer) BEFORE remapping the survivors through gravity, THEN objectives read the
 * settled overlay. The clear bonus is added once per accepted commit — never
 * scaled by cleared-cell count, or a single board-wide sweep (which frees 20+
 * dots at once) would make the timer meaningless.
 *
 * Anchors ride the same fold: the resolve seam already decided which weights an
 * adjacent clear removed and echoed them on `resolution.expandedCleared`, so the
 * fold just consumes that echo (never re-running adjacency) and remaps the
 * survivors through gravity — mirroring the caged spine.
 */
export function applyJourneyResolution(jstate: JourneyState, resolution: Resolution): JourneyState {
  if (jstate.status !== 'playing') {
    return jstate;
  }
  const game = applyResolution(jstate.game, resolution);
  const caged = remapMoves(chipLayers(jstate.caged, resolution), resolution.falls);
  const anchors = remapAnchors(
    dropAnchors(jstate.anchors, resolution.expandedCleared),
    resolution.falls,
  );
  const objectives = foldObjectives(jstate.objectives, resolution, caged, anchors);
  const bonusMs = jstate.level.timer?.clearBonusMs ?? 0;
  const won = objectives.every((entry) => entry.done);
  return {
    game,
    level: jstate.level,
    timeRemainingMs: jstate.timeRemainingMs + bonusMs,
    objectives,
    caged,
    anchors,
    status: won ? 'won' : 'playing',
  };
}

/** The outcome of a settle: the next state plus the slides the renderer animates. */
export type JourneySettlement = {
  readonly jstate: JourneyState;
  /** Shuffle slides to animate; empty when no reshuffle was needed. */
  readonly moves: readonly CellMove[];
};

/**
 * Resolves a deadlock the same way Endless does — reusing the shipped
 * `shuffleBoard` — and remaps the caged overlay through the shuffle's `moves`
 * so cages never desync from their dots (Decision A). A board that already has
 * a legal move is returned unchanged with no moves. The `moves` are surfaced so
 * the render layer can slide dots to their new cells instead of teleporting;
 * the same array drives the caged-overlay remap, so board and cages can never
 * animate out of step.
 *
 * Anchors are weights that stay put: only the colours beneath the un-anchored
 * cells shuffle. Both the deadlock check and the shuffle are anchor-aware (a
 * reshuffle must leave a move that routes around the weights), and the overlay
 * itself is carried through unchanged by the `...jstate` spread — never remapped
 * through `shuffle.moves`.
 */
export function settleJourney(jstate: JourneyState): JourneySettlement {
  if (jstate.status !== 'playing') {
    return { jstate, moves: [] };
  }
  const { config, board, score, rngState } = jstate.game;
  if (hasLegalMove(board, config.rows, config.cols, config.minChain, jstate.anchors)) {
    return { jstate, moves: [] };
  }
  const shuffle = shuffleBoard(board, config, rngState, jstate.anchors);
  return {
    jstate: {
      ...jstate,
      game: { config, board: shuffle.board, score, rngState: shuffle.rngState },
      caged: remapMoves(jstate.caged, shuffle.moves),
    },
    moves: shuffle.moves,
  };
}

/** Sets remaining time (floored at 0) and flips to `'lost'` when it hits zero. */
function advanceClock(jstate: JourneyState, nextMs: number): JourneyState {
  const timeRemainingMs = Math.max(0, nextMs);
  return {
    ...jstate,
    timeRemainingMs,
    status: timeRemainingMs === 0 ? 'lost' : 'playing',
  };
}
