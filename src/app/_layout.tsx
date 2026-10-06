import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { startSimulation } from '../game/gameStore';

export default function RootLayout() {
  useEffect(() => startSimulation(), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            // Screens under the top one stop re-rendering (the simulation keeps running in the store).
            freezeOnBlur: true,
            contentStyle: { backgroundColor: '#111410' },
            animation: 'fade',
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
});
