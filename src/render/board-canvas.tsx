import { Canvas } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import type { Board } from '../core/types';
import type { BoardAnimation } from '../effects/use-board-animation';
import type { ChainState } from '../input/use-board-gesture';
import { DotLayer } from './dot-layer';
import type { BoardLayout } from './geometry';
import { LinkPath } from './link-path';

type BoardCanvasProps = {
  readonly board: Board;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
  readonly chainState: ChainState;
};

/**
 * Coordinate invariant: the canvas is sized exactly to the board and `layout`
 * origin is (0,0), so canvas coordinates and the geometry module's coordinates
 * are the same space — the gesture handler needs no offset correction. Both
 * Endless (`game.tsx`) and Journey (`journey.tsx`) draw through this one path.
 */
export function BoardCanvas({ board, layout, anim, chainState }: BoardCanvasProps) {
  const boardWidth = layout.cellSize * layout.cols;
  const boardHeight = layout.cellSize * layout.rows;

  const style = useMemo(
    () => ({ width: boardWidth, height: boardHeight }),
    [boardWidth, boardHeight],
  );

  return (
    <Canvas style={style}>
      <LinkPath
        chain={chainState.chain}
        finger={chainState.finger}
        linkColor={chainState.linkColor}
        layout={layout}
        anim={anim}
      />
      {/* Dead-flat discs on the dark `SCREEN_BACKGROUND` in both modes; the frozen
          fills clear contrast on the dark ground, and identity is colour alone. */}
      <DotLayer board={board} layout={layout} anim={anim} />
    </Canvas>
  );
}
