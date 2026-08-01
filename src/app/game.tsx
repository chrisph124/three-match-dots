import { Canvas, Circle } from '@shopify/react-native-skia';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function GameScreen() {
  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <Circle cx={120} cy={120} r={60} color="#4f8cff" />
      </Canvas>
      <Text style={styles.text}>Skia canvas above (proof of render).</Text>
      <Link href="/game-over" style={styles.link}>
        End game
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  canvas: { width: 240, height: 240 },
  text: { fontSize: 16 },
  link: { fontSize: 18, color: '#4f8cff' },
});
