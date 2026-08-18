import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  applyJourneyResolution,
  newJourney,
  registerMistake,
  settleJourney,
  tick,
  type JourneyState,
} from '../core/journey/journey-state';
import { levelToConfig, type LevelScript } from '../core/level/level-script';
import { resolveChain } from '../core/resolve/resolve-chain';
import type { Board, Resolution } from '../core/types';
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

/** How often the countdown samples elapsed time. Display-grade, not authority:
 *  the reducer is fed a real timestamp delta, so a coarse tick can't drift. */
const TICK_MS = 100;

type Options = {
  readonly level: LevelScript;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
  readonly chainState: ChainState;
};

// Plain module-level writers for the Reanimated shared values on `chainState`.
// Same reason as use-game-state.ts: react-hooks/immutability forbids `.value`
// writes lexically inside a hook body, so the mutation lives out here.
function writeBoardMirror(chainState: ChainState, board: Board): void {
  chainState.board.value = [...board];
}
function unlock(chainState: ChainState): void {
  chainState.isResolving.value = 0;
}
function lock(chainState: ChainState): void {
  chainState.isResolving.value = 1;
}

/**
 * Journey's game hook — independent of `useGameState` (which hardcodes
 * `newGame(DEFAULT_CONFIG, …)` and has no config param). It deals the LEVEL's
 * board, drives the same commit → clear → drop → settle loop over `JourneyState`,
 * penalizes a null commit with `registerMistake`, and owns the countdown.
 *
 * ── Countdown & background pause (AppState) ────────────────────────────────
 * The reducer (`tick`) is authoritative and fed a clamped timestamp delta, so
 * the display interval can be coarse without drifting. Crucially the timer
 * PAUSES while the app is backgrounded: the interval body early-returns when
 * inactive, and on foreground `lastTick` is reset to now so the backgrounded
 * gap is DISCARDED rather than subtracted in one burst (which would snap the
 * board straight to 'lost'). AppState is wired here for the first time in this
 * repo — verify ON-DEVICE (Vitest cannot reach any of this):
 *   1. Background mid-play, wait 10s+, foreground → time unchanged, no jump,
 *      no snap-to-lose.
 *   2. Kill-and-relaunch while backgrounded → route re-mounts fresh (no crash,
 *      no leaked timer).
 *   3. Rapidly toggle background/foreground → no double-subtraction, no freeze.
 *   4. Leave to the title screen and re-enter Journey → exactly one live timer
 *      (the subscription + interval are cleaned up on unmount).
 */
export function useJourneyState({ level, layout, anim, chainState }: Options) {
  const cellCount = useMemo(() => {
    const config = levelToConfig(level);
    return config.rows * config.cols;
  }, [level]);

  const [jstate, setJourney] = useState<JourneyState>(() => newJourney(level, Date.now() >>> 0));
  const latest = useRef(jstate);

  // Updates React state and the gesture callback's snapshot together. Board
  // mirror is written separately (only when the board actually changes), so
  // 10 timer ticks/sec don't re-copy an unchanged board to the worklet.
  const advance = useCallback((next: JourneyState) => {
    latest.current = next;
    setJourney(next);
  }, []);

  const publish = useCallback(
    (next: JourneyState) => {
      advance(next);
      writeBoardMirror(chainState, next.game.board);
    },
    [advance, chainState],
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
  }, [chainState]);

  const settle = useCallback(() => {
    // Re-read the freshest state instead of trusting a snapshot captured when
    // this settle was scheduled: the countdown interval mutates status/time
    // concurrently during the ~FALL_MS drop animation. If the run ENDED in that
    // window (timer hit 0, or this very commit won), the status effect now owns
    // the lock — do not unlock (re-enabling input on a finished board) and do
    // not republish a stale 'playing' snapshot (which, on a post-drop board that
    // happens to deadlock, would reshuffle and RESURRECT the ended run).
    const current = latest.current;
    if (current.status !== 'playing') {
      return;
    }
    const { jstate: settled, moves } = settleJourney(current);
    if (moves.length === 0) {
      unlock(chainState);
      return;
    }
    const { offsetX, offsetY } = buildMoveOffsets({ moves }, layout, cellCount);
    publish(settled);
    // Re-check status at fire time, same as the FALL_MS→settle and commit
    // null-branch paths: the countdown can flip the run to 'lost' during this
    // ~SHUFFLE_MS reshuffle window, in which case the status effect now owns the
    // lock — unlocking here would stomp it back open on a finished board. (The
    // moves===0 branch above unlocks synchronously right after the top guard, so
    // no time elapses there.) Endless's twin line needs no guard — it has no
    // terminal state.
    playMove(anim, offsetX, offsetY, SHUFFLE_MS, 0, () => {
      if (latest.current.status === 'playing') {
        unlock(chainState);
      }
    });
  }, [anim, cellCount, chainState, layout, publish]);

  const applyAndDrop = useCallback(
    (resolution: Resolution) => {
      const next = applyJourneyResolution(latest.current, resolution);
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
      const resolution = resolveChain(latest.current.game, chain);
      if (resolution === null) {
        // A wasted attempt costs time — and the penalty can itself end the run.
        const penalized = registerMistake(latest.current);
        advance(penalized);
        // Only re-enable input if the run survived; if the penalty hit 0 the
        // status effect locks it, and unlocking here would race that lock.
        if (penalized.status === 'playing') {
          unlock(chainState);
        }
        return;
      }
      playClear(anim, resolution.cleared, () => applyAndDrop(resolution));
    },
    [advance, anim, applyAndDrop, chainState],
  );

  // Countdown clock. See the block comment above for the pause semantics.
  const lastTick = useRef(0);
  const appActive = useRef(true);
  useEffect(() => {
    lastTick.current = Date.now();
    appActive.current = AppState.currentState === 'active';

    const id = setInterval(() => {
      if (!appActive.current || latest.current.status !== 'playing') {
        return;
      }
      const now = Date.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      advance(tick(latest.current, dt));
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
  }, [advance]);

  // Freeze input the moment the run ends, so no chain can commit post-result.
  useEffect(() => {
    if (jstate.status !== 'playing') {
      lock(chainState);
    }
  }, [jstate.status, chainState]);

  return useMemo(
    () => ({
      board: jstate.game.board,
      timeRemainingMs: jstate.timeRemainingMs,
      objectives: jstate.objectives,
      status: jstate.status,
      commit,
    }),
    [jstate.game.board, jstate.timeRemainingMs, jstate.objectives, jstate.status, commit],
  );
}
