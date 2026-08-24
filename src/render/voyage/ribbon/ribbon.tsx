import { useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { LevelProgress } from '../../../meta/voyage-progress-storage';
import { NODE_SIZE, RibbonNode } from './ribbon-node';

/** Vertical distance between consecutive level nodes. */
const ROW_SPACING = 104;
/** Extra rows rendered above/below the viewport so a fast fling shows no gaps. */
const BUFFER_ROWS = 3;
/** Boss cadence — every 10th level. Mirrors the generator's `isBoss`. */
const BOSS_EVERY = 10;

type RibbonProps = {
  readonly count: number;
  readonly progress: readonly LevelProgress[];
  readonly trim: string;
  readonly onSelect: (index: number) => void;
};

/** Serpentine x for a 1-based ladder index — a gentle winding path, clamped so
 *  a node never clips the screen edge. */
function nodeX(index: number, width: number): number {
  const amplitude = Math.max(0, (width - NODE_SIZE) / 2 - 16);
  const centre = (width - NODE_SIZE) / 2;
  return centre + amplitude * Math.sin(index * 0.7);
}

/**
 * The virtualized pop-up-book ribbon. A tall ScrollView holds the full ladder's
 * height, but only the on-screen window of nodes (plus a small buffer) is ever
 * built — so it scrolls smoothly across an unbounded ladder without materializing
 * thousands of nodes. The visible window is quantized to whole rows, so a scroll
 * frame only re-renders when a new node actually enters or leaves.
 */
export function Ribbon({ count, progress, trim, onSelect }: RibbonProps) {
  const { width, height: windowHeight } = useWindowDimensions();
  const [viewportH, setViewportH] = useState(windowHeight);
  const [topRow, setTopRow] = useState(0);

  const contentHeight = count * ROW_SPACING + NODE_SIZE;

  const onLayout = (e: LayoutChangeEvent) => setViewportH(e.nativeEvent.layout.height);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const row = Math.floor(e.nativeEvent.contentOffset.y / ROW_SPACING);
    if (row !== topRow) setTopRow(row);
  };

  const visible = useMemo(() => {
    const first = Math.max(0, topRow - BUFFER_ROWS);
    const rowsOnScreen = Math.ceil(viewportH / ROW_SPACING) + BUFFER_ROWS * 2;
    const last = Math.min(count - 1, first + rowsOnScreen);
    const nodes: LevelProgress[] = [];
    for (let i = first; i <= last; i += 1) {
      nodes.push(progress[i]);
    }
    return nodes;
  }, [topRow, viewportH, count, progress]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ height: contentHeight }}
      onLayout={onLayout}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.layer}>
        {visible.map((entry) => (
          <RibbonNode
            key={entry.index}
            progress={entry}
            isBoss={entry.index % BOSS_EVERY === 0}
            trim={trim}
            x={nodeX(entry.index, width)}
            y={(entry.index - 1) * ROW_SPACING + NODE_SIZE / 2}
            onPress={onSelect}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, width: '100%' },
  layer: { flex: 1 },
});
