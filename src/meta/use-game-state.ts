import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CONFIG } from '../core/config';
import { hasLegalMove } from '../core/deadlock';
import { applyResolution, newGame } from '../core/game';
import { resolveChain } from '../core/resolve/resolve-chain';
import { shuffleBoard } from '../core/shuffle';
import type { Board, GameState, Resolution } from '../core/types';
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

type Options = {
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
  readonly chainState: ChainState;
  /** Score to resume from. Task 20 supplies this from storage. */
  readonly initialScore?: number;
  /** Called whenever the score changes. Task 20 supplies the persister. */
  readonly onScoreChange?: (score: number) => void;
};

const CELL_COUNT = DEFAULT_CONFIG.rows * DEFAULT_CONFIG.cols;

/**
 * Plain, non-hook mutators for the Reanimated shared values living on
 * `chainState`. `react-hooks/immutability` (the React Compiler lint rule
 * bundled with eslint-config-expo) treats any `.value` write lexically
 * inside a hook body — including inside a `useCallback`/`useEffect`
 * callback — as "modifying a hook argument after render", because
 * `chainState` is a parameter of `useGameState`. Reanimated's API is built
 * on exactly that kind of mutation, so the fix mirrors the one already used
 * by `use-board-animation.ts` and `use-board-gesture.ts`: move the writes
 * into plain module-level functions the hook merely calls.
 */
function writeBoardMirror(chainState: ChainState, board: Board): void {
  chainState.board.value = [...board];
}

function unlock(chainState: ChainState): void {
  chainState.isResolving.value = 0;
}

export function useGameState({
  layout,
  anim,
  chainState,
  initialScore = 0,
  onScoreChange,
}: Options) {
  const [state, setState] = useState<GameState>(() => ({
    ...newGame(DEFAULT_CONFIG, Date.now() >>> 0),
    score: initialScore,
  }));

  // The gesture callback closes over this once; React state would be stale.
  // Only `publish` ever calls `setState`, and it updates this ref in the same
  // breath, so `latest.current` never needs a separate render-time sync.
  const latest = useRef(state);

  const publish = useCallback(
    (next: GameState) => {
      latest.current = next;
      setState(next);
      writeBoardMirror(chainState, next.board);
      onScoreChange?.(next.score);
    },
    [chainState, onScoreChange],
  );

  // Seeds the mirror with the real dealt board before the first gesture.
  // `useChainState` is constructed with a placeholder board because
  // `useGameState` deals the real one; without this, the first drag would
  // validate against that placeholder. Guarded by a ref (mutated only inside
  // the effect, never during render) so it fires exactly once regardless of
  // how many times `state.board` changes afterwards.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) {
      return;
    }
    seeded.current = true;
    writeBoardMirror(chainState, state.board);
  }, [chainState, state.board]);

  const settle = useCallback(
    (next: GameState) => {
      const { rows, cols, minChain } = next.config;
      if (hasLegalMove(next.board, rows, cols, minChain)) {
        unlock(chainState);
        return;
      }
      const shuffled = shuffleBoard(next.board, next.config, next.rngState);
      const { offsetX, offsetY } = buildMoveOffsets({ moves: shuffled.moves }, layout, CELL_COUNT);
      publish({ ...next, board: shuffled.board, rngState: shuffled.rngState });
      playMove(anim, offsetX, offsetY, SHUFFLE_MS, () => unlock(chainState));
    },
    [anim, chainState, layout, publish],
  );

  const applyAndDrop = useCallback(
    (resolution: Resolution) => {
      const next = applyResolution(latest.current, resolution);
      const { offsetX, offsetY } = buildMoveOffsets(
        { moves: resolution.falls, spawns: resolution.spawns },
        layout,
        CELL_COUNT,
      );
      resetClear(anim);
      publish(next);
      playMove(anim, offsetX, offsetY, FALL_MS, () => settle(next));
    },
    [anim, layout, publish, settle],
  );

  const commit = useCallback(
    (chain: number[]) => {
      const resolution = resolveChain(latest.current, chain);
      if (resolution === null) {
        unlock(chainState);
        return;
      }
      playClear(anim, resolution.cleared, () => applyAndDrop(resolution));
    },
    [anim, applyAndDrop, chainState],
  );

  return useMemo(
    () => ({ board: state.board, score: state.score, commit }),
    [state.board, state.score, commit],
  );
}
