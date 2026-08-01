import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function GameScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Game board goes here.</Text>
      <Link href="/game-over" style={styles.link}>
        End game
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  text: { fontSize: 18 },
  link: { fontSize: 18, color: '#4f8cff' },
});
