import type { ReactNode } from 'react';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

// A pulsing dot. A CSS animation: on web the browser runs it with no script per frame.
const pulse = css.create({
  dot: {
    animationName: css.keyframes({ from: { opacity: 0.35 }, to: { opacity: 1 } }),
    animationDuration: '900ms',
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: 'ease-in-out',
  },
});
export const LiveSignal = memo(function LiveSignal() {
  return <Animated.View style={[styles.liveSignal, pulse.dot]} />;
});

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