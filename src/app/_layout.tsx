import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'three-match-dots' }} />
      <Stack.Screen name="game" options={{ title: 'Game' }} />
      <Stack.Screen name="game-over" options={{ title: 'Game Over' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
