import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { readScore } from '../meta/score-storage';
import { SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';

export default function TitleScreen() {
  const [score, setScore] = useState(readScore);

  // Re-read on focus so the score is current after returning from a session.
  useFocusEffect(
    useCallback(() => {
      setScore(readScore());
    }, []),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>three-match-dots</Text>
      <Text style={styles.score}>{score}</Text>
      <Link href="/game" style={styles.link}>
        Play
      </Link>
      <Link href="/settings" style={styles.link}>
        Settings
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: SCREEN_BACKGROUND,
  },
  title: { fontSize: 28, fontWeight: '600', color: TEXT_COLOR },
  score: { fontSize: 48, fontWeight: '700', color: TEXT_COLOR, fontVariant: ['tabular-nums'] },
  link: { fontSize: 18, color: '#4f8cff' },
});
