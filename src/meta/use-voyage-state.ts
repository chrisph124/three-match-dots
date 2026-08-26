import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { constraintOf, levelToConfig, type LevelScript } from '../core/level/level-script';
import { toMask } from '../core/obstacles/anchor';
import { resolveAnchorChain } from '../core/resolve-anchor-chain';
import type { Board, CellIndex, ClearedCell, Resolution } from '../core/types';
import {
  applyVoyageResolution,
  newVoyage,
  registerVoyageMistake,
  settleVoyage,
  tickVoyage,
  type VoyageState,
} from '../core/voyage/voyage-state';
import {
  FALL_MS,
  playClear,
  playMove,
  resetClear,
  SHUFFLE_MS,
  type BoardAnimation,
} from '../effects/use-board-animation';
import type { ChainState } from '../input/use-board-gesture';
import type { BoardLayout } from '../render/geometry';
import { buildMoveOffsets } from '../render/move-offsets';

/** How often a timed budget samples elapsed time. Display-grade, not authority:
 *  the reducer is fed a real timestamp delta, so a coarse tick can't drift. */
const TICK_MS = 100;

type Options = {
  readonly level: LevelScript;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
  readonly chainState: ChainState;
};

/**
 * A committed clear, surfaced so the render layer can fire matching juice
 * (shards per pop, a ripple on a colour-sweep). `seq` increments per clear so
 * an identical back-to-back clear still re-triggers the effect; `sweep` is true
 * for a 2×2-loop or ≥line clear (`kind !== 'plain'`). `chipped` carries the
 * multi-layer caged cells that were HIT but not freed this commit (from
 * `resolution.protectedHits`) — a separate channel from `cleared` because a chip
 * decrements a cage's layer without popping its dot. Read-only signal — the
 * effects never feed back into the reducer.
 */
export type VoyageClearEvent = {
  readonly seq: number;
  readonly cleared: readonly ClearedCell[];
  readonly sweep: boolean;
  readonly chipped?: readonly ClearedCell[];
};

// Plain module-level writers for the Reanimated shared values on `chainState`.
// Same reason as use-journey-state.ts: react-hooks/immutability forbids `.value`
// writes lexically inside a hook body, so the mutation lives out here.
function writeBoardMirror(chainState: ChainState, board: Board): void {
  chainState.board.value = [...board];
}
function writeAnchorMask(
  chainState: ChainState,
  anchors: ReadonlySet<CellIndex>,
  cellCount: number,
): void {
  chainState.anchors.value = toMask(anchors, cellCount);
}
function unlock(chainState: ChainState): void {
  chainState.isResolving.value = 0;
}
function lock(chainState: ChainState): void {
  chainState.isResolving.value = 1;
}

/**
 * Voyage's game hook — a sibling of `useJourneyState` that drives the same
 * commit → clear → drop → settle loop over `VoyageState` instead of
 * `JourneyState`. The one behavioral difference is the fail-state: Voyage plays
 * under a pluggable `VoyageBudget` (moves / timed / mistakes) rather than a fixed
 * countdown, so `registerVoyageMistake` and `applyVoyageResolution` fold the
 * budget, and the countdown interval runs ONLY for a `timed` level.
 *
 * ── Countdown & background pause (AppState, timed levels only) ───────────────
 * Identical semantics to Journey: the reducer (`tickVoyage`) is authoritative
 * and fed a clamped timestamp delta, so the display interval can be coarse
 * without drifting, and it PAUSES while the app is backgrounded (the foreground
 * handler resets `lastTick` to now so the backgrounded gap is DISCARDED, never
 * subtracted in one burst). A moves/mistakes level creates no interval at all.
 * Verify ON-DEVICE (Vitest cannot reach any of this):
 *   1. Timed level: background mid-play 10s+, foreground → time unchanged, no
 *      jump, no snap-to-lose.
 *   2. Moves/mistakes level: no timer ticks; the HUD budget only changes on a
 *      commit (moves) or a wasted attempt (mistakes).
 *   3. Kill-and-relaunch while backgrounded → route re-mounts fresh (no crash,
 *      no leaked timer).
 *   4. Leave to the title screen and re-enter → exactly one live timer on a
 *      timed level, none on a moves/mistakes level.
 */
export function useVoyageState({ level, layout, anim, chainState }: Options) {
  const cellCount = useMemo(() => {
    const config = levelToConfig(level);
    return config.rows * config.cols;
  }, [level]);

  // The countdown interval exists only for a timed budget; moves/mistakes levels
  // change their budget solely on commit / wasted-attempt, never on a clock.
  const isTimed = useMemo(() => constraintOf(level).type === 'timed', [level]);

  const [vstate, setVoyage] = useState<VoyageState>(() => newVoyage(level, Date.now() >>> 0));
  const latest = useRef(vstate);

  // A per-clear pulse the render layer watches to fire shards/ripple juice. It's
  // a pure output of `commit` (never read back by the reducer), so it lives as
  // display state beside `vstate` rather than inside the core machine.
  const clearSeq = useRef(0);
  const [clearEvent, setClearEvent] = useState<VoyageClearEvent | null>(null);

  // Updates React state and the gesture callback's snapshot together. Board
  // mirror is written separately (only when the board actually changes), so
  // 10 timer ticks/sec don't re-copy an unchanged board to the worklet.
  const advance = useCallback((next: VoyageState) => {
    latest.current = next;
    setVoyage(next);
  }, []);

  const publish = useCallback(
    (next: VoyageState) => {
      advance(next);
      writeBoardMirror(chainState, next.game.board);
      // Anchors only ever change here (a clear removed one, gravity moved one);
      // settle preserves the set in place. Mirror them on the same cadence as
      // the board so the worklet's link-suppression stays in step.
      writeAnchorMask(chainState, next.anchors, cellCount);
    },
    [advance, chainState, cellCount],
  );

  // Seed the board mirror once with the real dealt board (chainState is built
  // with a placeholder). Guarded by a ref so it fires exactly once.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) {
      return;
    }
    seeded.current = true;
    writeBoardMirror(chainState, latest.current.game.board);
    writeAnchorMask(chainState, latest.current.anchors, cellCount);
  }, [chainState, cellCount]);

  const settle = useCallback(() => {
    // Re-read the freshest state instead of trusting a snapshot captured when
    // this settle was scheduled: a timed budget's interval mutates status/time
    // concurrently during the ~FALL_MS drop animation. If the run ENDED in that
    // window (timer hit 0, or this very commit won), the status effect now owns
    // the lock — do not unlock (re-enabling input on a finished board) and do
    // not republish a stale 'playing' snapshot (which, on a post-drop board that
    // happens to deadlock, would reshuffle and RESURRECT the ended run).
    const current = latest.current;
    if (current.status !== 'playing') {
      return;
    }
    const { vstate: settled, moves } = settleVoyage(current);
    if (moves.length === 0) {
      unlock(chainState);
      return;
    }
    const { offsetX, offsetY } = buildMoveOffsets({ moves }, layout, cellCount);
    publish(settled);
    // Re-check status at fire time, same as the FALL_MS→settle and commit
    // null-branch paths: a timed budget can flip the run to 'lost' during this
    // ~SHUFFLE_MS reshuffle window, in which case the status effect now owns the
    // lock — unlocking here would stomp it back open on a finished board. (The
    // moves===0 branch above unlocks synchronously right after the top guard, so
    // no time elapses there.)
    playMove(anim, offsetX, offsetY, SHUFFLE_MS, 0, () => {
      if (latest.current.status === 'playing') {
        unlock(chainState);
      }
    });
  }, [anim, cellCount, chainState, layout, publish]);

  const applyAndDrop = useCallback(
    (resolution: Resolution) => {
      const next = applyVoyageResolution(latest.current, resolution);
      const { offsetX, offsetY } = buildMoveOffsets(
        { moves: resolution.falls, spawns: resolution.spawns },
        layout,
        cellCount,
      );
      resetClear(anim);
      publish(next);
      playMove(anim, offsetX, offsetY, FALL_MS, 0, settle);
    },
    [anim, cellCount, layout, publish, settle],
  );

  const commit = useCallback(
    (chain: number[]) => {
      // Route through the shared obstacle bridge: it protects every multi-layer
      // cage so a hit chips a layer instead of popping the dot, and removes any
      // weight a cleared cell is 8-way adjacent to in the same pass (echoed on
      // `expandedCleared`). A board with neither yields empty overlays ⇒ the
      // byte-identical classic resolve.
      const resolution = resolveAnchorChain(
        latest.current.game,
        chain,
        latest.current.caged,
        latest.current.anchors,
      );
      if (resolution === null) {
        // A wasted attempt can cost the budget (timed/mistakes) — and the
        // penalty can itself end the run. For a moves budget it's a no-op.
        const penalized = registerVoyageMistake(latest.current);
        advance(penalized);
        // Only re-enable input if the run survived; if the penalty ended it the
        // status effect locks it, and unlocking here would race that lock.
        if (penalized.status === 'playing') {
          unlock(chainState);
        }
        return;
      }
      // Surface the clear for the render layer's juice before the pop plays, so
      // shards burst in time with the dots shrinking. A sweep (loop/line) also
      // gets a ripple — see `voyage-juice.ts`. `chipped` (multi-layer cages hit
      // but not freed) rides the same event on its own channel. A chip-only
      // commit still takes this identical path — no empty-`cleared` fast-path —
      // so `playClear`'s unconditional onDone always unlocks input.
      clearSeq.current += 1;
      setClearEvent({
        seq: clearSeq.current,
        cleared: resolution.cleared,
        sweep: resolution.kind !== 'plain',
        ...(resolution.protectedHits ? { chipped: resolution.protectedHits } : {}),
      });
      playClear(anim, resolution.cleared, () => applyAndDrop(resolution));
    },
    [advance, anim, applyAndDrop, chainState],
  );

  // Countdown clock (timed levels only). See the block comment above for the
  // pause semantics; the effect creates no interval for a moves/mistakes budget.
  const lastTick = useRef(0);
  const appActive = useRef(true);
  useEffect(() => {
    if (!isTimed) {
      return;
    }
    lastTick.current = Date.now();
    appActive.current = AppState.currentState === 'active';

    const id = setInterval(() => {
      if (!appActive.current || latest.current.status !== 'playing') {
        return;
      }
      const now = Date.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      advance(tickVoyage(latest.current, dt));
    }, TICK_MS);

    const sub = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      if (active) {
        lastTick.current = Date.now(); // discard the backgrounded gap
      }
      appActive.current = active;
    });

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [advance, isTimed]);

  // Freeze input the moment the run ends, so no chain can commit post-result.
  useEffect(() => {
    if (vstate.status !== 'playing') {
      lock(chainState);
    }
  }, [vstate.status, chainState]);

  return useMemo(
    () => ({
      board: vstate.game.board,
      budget: vstate.budget,
      objectives: vstate.objectives,
      // Live caged-cell set — the boss HP bar reads it (with the board) to drain
      // each colour segment as its cages are freed, off the same state the
      // reducer owns (no parallel counter).
      caged: vstate.caged,
      // Live anchor overlay (cells holding a weight) — the render layer reads it
      // to draw the weights; it shrinks as adjacent clears remove them.
      anchors: vstate.anchors,
      status: vstate.status,
      // The last committed clear (or null) — the render layer fires shards/ripple
      // off it; see VoyageClearEvent.
      event: clearEvent,
      commit,
    }),
    [
      vstate.game.board,
      vstate.budget,
      vstate.objectives,
      vstate.caged,
      vstate.anchors,
      vstate.status,
      clearEvent,
      commit,
    ],
  );
}
