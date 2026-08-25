import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { readScore } from '../meta/score-storage';
import { RiveTitle } from '../render/rive-title';
import { fontSize, labelTracking, radius, space, ui } from '../render/ui-theme';

type NavButton = {
  href: '/game' | '/journey' | '/voyage' | '/settings';
  label: string;
  primary?: boolean;
};

const BUTTONS: readonly NavButton[] = [
  { href: '/game', label: 'Play', primary: true },
  { href: '/journey', label: 'Journey' },
  { href: '/voyage', label: 'Voyage' },
  { href: '/settings', label: 'Settings' },
];

export default function TitleScreen() {
  const [score, setScore] = useState(readScore);

  // Re-read on focus so the score is current after returning from a session.
  useFocusEffect(
    useCallback(() => {
      setScore(readScore());
    }, []),
  );

  // The paper-craft lockup is also the Reduce-Motion / no-art fallback for the
  // animated Rive title, so build it once and hand it to <RiveTitle>.
  const lockup = (
    <View style={styles.lockup}>
      <Text style={styles.kanji}>三</Text>
      <Text style={styles.title}>Three Dots</Text>
      <Text style={styles.subtitle}>ENDLESS</Text>
      <View style={styles.seal} />
    </View>
  );

  return (
    <View style={styles.container}>
      <RiveTitle fallback={lockup} />

      <View style={styles.scoreCard}>
        <Text style={styles.scoreValue}>{score}</Text>
        <Text style={styles.scoreLabel}>SCORE</Text>
      </View>

      <View style={styles.buttons}>
        {BUTTONS.map(({ href, label, primary }) => (
          <Link key={href} href={href} asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.btn,
                primary ? styles.btnPrimary : styles.btnSecondary,
                pressed && (primary ? styles.btnPrimaryPressed : styles.btnSecondaryPressed),
              ]}
            >
              <Text style={primary ? styles.btnPrimaryLabel : styles.btnSecondaryLabel}>
                {label}
              </Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}

const card = {
  backgroundColor: ui.paper,
  borderWidth: 1,
  borderColor: ui.paperEdge,
  borderRadius: radius.md,
  shadowColor: ui.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 1,
  shadowRadius: 14,
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
    paddingHorizontal: space.xxl,
    backgroundColor: ui.night,
  },
  lockup: {
    ...card,
    width: '100%',
    alignItems: 'center',
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
  },
  kanji: { position: 'absolute', top: space.md, right: space.lg, fontSize: 16, color: ui.shu },
  title: { fontSize: fontSize.title, fontWeight: '800', color: ui.ink, letterSpacing: 0.3 },
  subtitle: {
    marginTop: space.xs,
    fontSize: 12,
    letterSpacing: 2.2,
    color: ui.inkSoft,
    fontWeight: '600',
  },
  seal: {
    position: 'absolute',
    bottom: -10,
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    backgroundColor: ui.shu,
  },
  scoreCard: { ...card, width: '78%', alignItems: 'center', paddingVertical: space.md },
  scoreValue: {
    fontSize: fontSize.score,
    fontWeight: '800',
    color: ui.ink,
    fontVariant: ['tabular-nums'],
  },
  scoreLabel: {
    marginTop: space.xs,
    fontSize: fontSize.label,
    letterSpacing: labelTracking,
    color: ui.inkSoft,
    fontWeight: '600',
  },
  buttons: { width: '100%', gap: space.md },
  btn: { borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1 },
  btnPrimary: { backgroundColor: ui.shu, borderColor: ui.shuEdge },
  btnPrimaryPressed: { backgroundColor: ui.shuEdge },
  btnPrimaryLabel: { fontSize: fontSize.body, fontWeight: '700', color: '#fff' },
  btnSecondary: { backgroundColor: ui.paper, borderColor: ui.paperEdge },
  btnSecondaryPressed: { backgroundColor: ui.paperPressed },
  btnSecondaryLabel: { fontSize: fontSize.body, fontWeight: '600', color: ui.ai },
});
