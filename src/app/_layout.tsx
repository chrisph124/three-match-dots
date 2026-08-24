import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'three-match-dots' }} />
        <Stack.Screen name="game" options={{ title: 'Game' }} />
        <Stack.Screen name="journey" options={{ title: 'Journey' }} />
        <Stack.Screen name="voyage" options={{ headerShown: false }} />
        <Stack.Screen name="voyage-game" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
