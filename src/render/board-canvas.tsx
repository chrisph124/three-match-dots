import { Canvas } from '@shopify/react-native-skia';
import type { Board } from '../core/types';
import type { BoardAnimation } from '../effects/use-board-animation';
import { DotLayer } from './dot-layer';
import type { BoardLayout } from './geometry';

type BoardCanvasProps = {
  readonly board: Board;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
};

/**
 * The canvas is exactly the board, so canvas coordinates and the geometry
 * module's coordinates are the same space — the gesture handler needs no
 * offset correction.
 */
export function BoardCanvas({ board, layout, anim }: BoardCanvasProps) {
  return (
    <Canvas style={{ width: layout.cellSize * layout.cols, height: layout.cellSize * layout.rows }}>
      <DotLayer board={board} layout={layout} anim={anim} />
    </Canvas>
  );
}
