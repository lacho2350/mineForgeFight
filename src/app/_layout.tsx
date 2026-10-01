import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { startSimulation } from '../../gameStore';

export default function RootLayout() {
  useEffect(() => startSimulation(), []);

  return (
    <SafeAreaProvider>
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#111410' },
        animation: 'fade',
      }}
    />
    </SafeAreaProvider>
  );
}