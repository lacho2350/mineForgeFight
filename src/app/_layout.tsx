// Must come first: gives iOS/Android a `localStorage` (backed by SQLite) for the save. A no-op on web.
import 'expo-sqlite/localStorage/install';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { AppState, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadGame, startSimulation } from '../game/gameStore';
import { flushSave } from '../game/save';

// Load the save before anything renders (this localStorage is synchronous on every platform).
void loadGame();

export default function RootLayout() {
  useEffect(() => startSimulation(), []);

  // Saves are batched; write the latest one when the app goes to the background or the page closes.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushSave();
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('pagehide', flushSave);
      window.addEventListener('beforeunload', flushSave);
    }
    return () => {
      subscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('pagehide', flushSave);
        window.removeEventListener('beforeunload', flushSave);
      }
    };
  }, []);

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
