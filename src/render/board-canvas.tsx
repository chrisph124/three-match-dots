import { Canvas } from '@shopify/react-native-skia';
import type { Board } from '../core/types';
import { DotLayer } from './dot-layer';
import type { BoardLayout } from './geometry';

type BoardCanvasProps = {
  readonly board: Board;
  readonly layout: BoardLayout;
};

/**
 * The canvas is exactly the board, so canvas coordinates and the geometry
 * module's coordinates are the same space — the gesture handler needs no
 * offset correction.
 */
export function BoardCanvas({ board, layout }: BoardCanvasProps) {
  const size = layout.cellSize * layout.cols;
  return (
    <Canvas style={{ width: size, height: layout.cellSize * layout.rows }}>
      <DotLayer board={board} layout={layout} />
    </Canvas>
  );
}
