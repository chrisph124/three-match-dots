import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { PANEL_BASE, PANEL_EDGE } from './contrast-tokens';

type BoardPanelProps = {
  readonly children: ReactNode;
  /** Biome trim colour — a faint accent on the card edge tying it to the scene. */
  readonly trim?: string;
};

/**
 * The shadow-box inset card the board draws on. An opaque `PANEL_BASE` fill
 * (L ≈ 0.017) guarantees every dot hue keeps its 3:1 contrast floor regardless
 * of the biome behind it — the diorama never touches a dot. It's a plain RN View
 * (not part of the board Canvas), so wrapping the board here cannot perturb the
 * gesture worklet's touch→cell math: the board Canvas stays origin-(0,0).
 */
export function BoardPanel({ children, trim }: BoardPanelProps) {
  return (
    <View style={[styles.panel, trim ? { borderColor: trim } : null]}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: PANEL_BASE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PANEL_EDGE,
    padding: 14,
    // A soft drop shadow reads the card as raised off the diorama (iOS; Android
    // uses elevation). Cosmetic only — never touches dot luminance.
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  inner: {
    borderRadius: 12,
    overflow: 'hidden',
  },
});
