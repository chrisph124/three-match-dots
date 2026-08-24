// The one-time layered-cage teaching popup. A static, restrained paper-craft
// card (creative-bible §2.4 tone — no guided demo, no over-animation) shown the
// first time a player meets a MULTI-layer cage. It reuses the cage overlay's
// visual vocabulary (kraft square frame + square pips over a round dot) so the
// illustration reads as the exact thing on the board. The screen owns the
// trigger + persistence; this component is presentational, taking only a dismiss
// callback that carries the "don't show again" choice. Fully unmounted by the
// parent once dismissed, so it can never swallow a board gesture afterwards.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colorFor } from './palette';

/** A muted demo hue for the diagram — a warm paper-pigment, not a board dot. */
const DEMO_COLOR = colorFor(3);

type CageIntroPopupProps = {
  readonly onDismiss: (dontShowAgain: boolean) => void;
};

/** A single cage glyph: a round dot behind the kraft square frame with `pips`
 *  layer markers. `freed` drops the frame to show the dot escaping. */
function CageGlyph({ pips, freed }: { pips: number; freed?: boolean }) {
  return (
    <View style={styles.glyph}>
      <View style={[styles.glyphDot, { backgroundColor: DEMO_COLOR }]} />
      {freed ? null : (
        <View style={styles.glyphFrame}>
          <View style={styles.glyphPips}>
            {Array.from({ length: pips }, (_, i) => (
              <View key={i} style={styles.glyphPip} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export function CageIntroPopup({ onDismiss }: CageIntroPopupProps) {
  // Default ON: one dismissal is the common path, so "Got it" alone retires it.
  const [dontShowAgain, setDontShowAgain] = useState(true);

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>Layered Cages</Text>

        <View style={styles.diagram}>
          <CageGlyph pips={3} />
          <Text style={styles.arrow}>›</Text>
          <CageGlyph pips={2} />
          <Text style={styles.arrow}>›</Text>
          <CageGlyph pips={0} freed />
        </View>

        <Text style={styles.copy}>
          Clear its colour to peel a layer — it breaks when the paper&apos;s gone.
        </Text>

        <Pressable style={styles.checkRow} onPress={() => setDontShowAgain((v) => !v)}>
          <View style={[styles.checkbox, dontShowAgain && styles.checkboxOn]}>
            {dontShowAgain ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkLabel}>Don&apos;t show again</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={() => onDismiss(dontShowAgain)}>
          <Text style={styles.buttonText}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}

const PAPER = '#efe3c8';
const INK = '#3a3228';
const KRAFT = '#d9c7a3';
const PIP = '#8a7a5c';

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 12, 20, 0.72)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: PAPER,
    padding: 24,
    alignItems: 'center',
    gap: 18,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  title: { fontSize: 22, fontWeight: '800', color: INK, letterSpacing: 1 },
  diagram: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow: { fontSize: 24, color: PIP, fontWeight: '700' },
  glyph: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  glyphDot: { position: 'absolute', width: 30, height: 30, borderRadius: 15 },
  glyphFrame: {
    width: 42,
    height: 42,
    borderWidth: 2.5,
    borderColor: KRAFT,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
    backgroundColor: 'rgba(217, 199, 163, 0.18)',
  },
  glyphPips: { flexDirection: 'row', gap: 3 },
  glyphPip: { width: 6, height: 6, borderRadius: 1, backgroundColor: PIP },
  copy: { fontSize: 15, lineHeight: 21, color: INK, textAlign: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: PIP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: PIP },
  checkMark: { color: PAPER, fontSize: 14, fontWeight: '900' },
  checkLabel: { fontSize: 15, color: INK },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 12,
    backgroundColor: INK,
  },
  buttonText: { fontSize: 17, fontWeight: '700', color: PAPER },
});
