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
 * The canvas is exactly the board, so canvas coordinates and the geometry
 * module's coordinates are the same space — the gesture handler needs no
 * offset correction.
 */
export function BoardCanvas({ board, layout, anim, chainState }: BoardCanvasProps) {
  const style = useMemo(
    () => ({ width: layout.cellSize * layout.cols, height: layout.cellSize * layout.rows }),
    [layout.cellSize, layout.cols, layout.rows],
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
      <DotLayer board={board} layout={layout} anim={anim} />
    </Canvas>
  );
}
