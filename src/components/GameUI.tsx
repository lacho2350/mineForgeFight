import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export function LiveSignal() {
  const opacity = useSharedValue(0.35);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }), [opacity]);

  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [opacity]);

  return <Animated.View style={[styles.liveSignal, animatedStyle]} />;
}

export function GameButton({
  label,
  detail,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  detail: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${detail}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.gameButton,
        secondary ? styles.gameButtonSecondary : styles.gameButtonPrimary,
        disabled && styles.gameButtonDisabled,
        pressed && !disabled && styles.gameButtonPressed,
      ]}
    >
      <Text style={[styles.gameButtonLabel, secondary && styles.gameButtonLabelSecondary]}>{label}</Text>
      <Text style={[styles.gameButtonDetail, secondary && styles.gameButtonDetailSecondary]}>{detail}</Text>
    </Pressable>
  );
}

export function ResourceValue({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={styles.resourceValue}>
      <Text style={styles.resourceLabel}>{label}</Text>
      <Text style={[styles.resourceNumber, { color: tone }]}>{value}</Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  liveSignal: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c1cf7b',
  },
  gameButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  gameButtonPrimary: {
    borderColor: '#d2a45f',
    backgroundColor: '#d2a45f',
  },
  gameButtonSecondary: {
    borderColor: '#3a4439',
    backgroundColor: '#1a211b',
  },
  gameButtonDisabled: {
    opacity: 0.4,
  },
  gameButtonPressed: {
    opacity: 0.68,
  },
  gameButtonLabel: {
    flexShrink: 1,
    color: '#20231b',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
  },
  gameButtonLabelSecondary: {
    color: '#eee9d9',
  },
  gameButtonDetail: {
    flexShrink: 1,
    color: '#4d4433',
    fontFamily: 'monospace',
    fontSize: 9,
    textAlign: 'right',
  },
  gameButtonDetailSecondary: {
    color: '#9da28d',
  },
  resourceValue: {
    minWidth: 70,
    gap: 3,
  },
  resourceLabel: {
    color: '#89907f',
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.5,
  },
  resourceNumber: {
    fontFamily: 'Georgia',
    fontSize: 21,
    fontWeight: 'bold',
  },
  sectionLabel: {
    color: '#c98c5d',
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.5,
  },
});