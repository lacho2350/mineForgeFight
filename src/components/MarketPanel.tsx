import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RESOURCES, RESOURCE_INFO, RESOURCE_PRICE, type Resource, type Stock } from '../game/resources';

// The trading post market: every resource in the warehouse can be sold for gold at a fixed price.
export default function MarketPanel({
  warehouse,
  onSell,
}: {
  warehouse: Stock;
  onSell: (resource: Resource, amount: number | 'all') => void;
}) {
  const total = RESOURCES.reduce((sum, resource) => sum + Math.floor(warehouse[resource]) * RESOURCE_PRICE[resource], 0);

  return (
    <View style={styles.market}>
      <View style={styles.header}>
        <Text style={styles.heading}>MARKET · SELL FROM THE WAREHOUSE</Text>
        <Text style={styles.total}>WORTH {total.toLocaleString()} G</Text>
      </View>
      {RESOURCES.map((resource) => {
        const info = RESOURCE_INFO[resource];
        const units = Math.floor(warehouse[resource]);
        const price = RESOURCE_PRICE[resource];
        return (
          <View key={resource} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: info.color, borderColor: info.light }]} />
            <View style={styles.copy}>
              <Text style={styles.name}>{info.name}</Text>
              <Text style={styles.detail}>
                {units.toLocaleString()} in stock · {String(price)} G each
              </Text>
            </View>
            <SellButton label="10" disabled={units < 1} onPress={() => onSell(resource, 10)} accessibilityLabel={`Sell 10 ${info.name}`} />
            <SellButton
              label={`ALL +${(units * price).toLocaleString()}`}
              disabled={units < 1}
              onPress={() => onSell(resource, 'all')}
              accessibilityLabel={`Sell all ${info.name} for ${String(units * price)} gold`}
              wide
            />
          </View>
        );
      })}
    </View>
  );
}

function SellButton({
  label,
  disabled,
  onPress,
  accessibilityLabel,
  wide = false,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  wide?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, wide && styles.buttonWide, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}
    >
      <Text style={[styles.buttonText, wide && styles.buttonTextWide]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  market: { gap: 8, marginTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  heading: { color: '#c98c5d', fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.5 },
  total: { color: '#e5ae69', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  row: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: '#2f352d' },
  swatch: { width: 12, height: 12, borderWidth: 1 },
  copy: { flex: 1, gap: 2 },
  name: { color: '#e8e3d1', fontFamily: 'Georgia', fontSize: 13 },
  detail: { color: '#898f7e', fontFamily: 'monospace', fontSize: 8 },
  button: {
    minWidth: 40,
    minHeight: 30,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d2a45f',
  },
  buttonWide: { minWidth: 86, backgroundColor: '#d2a45f' },
  buttonDisabled: { opacity: 0.35 },
  buttonPressed: { opacity: 0.68 },
  buttonText: { color: '#eee9d9', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  buttonTextWide: { color: '#20231b' },
});
