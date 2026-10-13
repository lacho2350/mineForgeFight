import { memo, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

// The pieces both full-screen maps (the stronghold and the mine) float over the map: the latest news and
// the toolbar's buttons.

/** The latest notice, shown for a few seconds whenever it changes; `fresh` skips the one there on arrival. */
export const Toast = memo(function Toast({ notice, fresh = false }: { notice: string; fresh?: boolean }) {
  const [expired, setExpired] = useState<string | null>(() => (fresh ? notice : null));
  useEffect(() => {
    const timer = setTimeout(() => setExpired(notice), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (expired === notice) return null;
  return (
    <Animated.View key={notice} entering={FadeIn.duration(150)} exiting={FadeOut.duration(300)} style={[styles.toast, { pointerEvents: 'none' }]}>
      <Text style={styles.toastText}>{notice}</Text>
    </Animated.View>
  );
});

/** A toolbar button, redrawn only when what it shows changes; `active` lights a mode that's on. The icon is
 * an emoji, or a drawn one (e.g. `MineCartIcon`) — keep a drawn one's identity stable so the memo holds. */
export const ToolButton = memo(function ToolButton({
  icon,
  label,
  onPress,
  badge,
  active = false,
  disabled = false,
  accessibilityLabel,
}: {
  icon: string | ReactNode;
  label: string;
  onPress: () => void;
  badge?: string;
  active?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.tool, active && styles.toolActive, disabled && styles.toolDisabled, pressed && styles.pressed]}
    >
      {typeof icon === 'string' ? <Text style={styles.toolIcon}>{icon}</Text> : <View style={styles.toolIconBox}>{icon}</View>}
      <Text style={[styles.toolLabel, active && styles.toolLabelActive]}>{label}</Text>
      {badge && <Text style={styles.toolBadge}>{badge}</Text>}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  toast: { width: '100%', maxWidth: 720, paddingHorizontal: 12, paddingVertical: 8, borderLeftWidth: 2, borderLeftColor: '#c98959', backgroundColor: 'rgba(27, 32, 25, 0.92)' },
  toastText: { color: '#d8d2c0', fontFamily: 'monospace', fontSize: 10 },
  tool: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderWidth: 1, borderColor: '#3a4439', backgroundColor: 'rgba(17, 20, 16, 0.92)' },
  toolActive: { borderColor: '#d2a45f', backgroundColor: '#d2a45f' },
  toolDisabled: { opacity: 0.6 },
  toolIcon: { fontSize: 18, lineHeight: 22 },
  toolIconBox: { height: 22, justifyContent: 'center' },
  toolLabel: { color: '#e6dfcb', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  toolLabelActive: { color: '#20231b' },
  toolBadge: { position: 'absolute', top: 4, right: 6, minWidth: 16, paddingHorizontal: 3, textAlign: 'center', backgroundColor: '#d2a45f', color: '#20231b', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
});
