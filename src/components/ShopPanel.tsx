import { StyleSheet, Text, View } from 'react-native';
import { PRODUCTS, PRODUCT_IDS } from '../game/shop';
import { privacyChoices } from './ads';
import { GameButton, SectionLabel } from './GameUI';
import { buy, restorePurchases, useShop } from './purchases';

// The shop (in the Menu): No more ads and the resource packs, at the store's prices (the planned euro
// prices where the store can't be reached), restoring purchases, and — where the law asks — the ads
// consent choices.
export default function ShopPanel({ adsRemoved }: { adsRemoved: boolean }) {
  const shop = useShop();
  const privacy = privacyChoices();
  return (
    <View style={styles.block}>
      <SectionLabel>SHOP</SectionLabel>
      {PRODUCT_IDS.map((id) => {
        const owned = id === 'remove_ads' && adsRemoved;
        const { name, detail, price } = PRODUCTS[id];
        return (
          <GameButton
            key={id}
            label={owned ? 'NO MORE ADS ✓' : name.toUpperCase()}
            detail={owned ? 'bought — thank you' : `${shop.prices[id] ?? price} · ${detail}`}
            onPress={() => void buy(id)}
            disabled={owned || !shop.ready || shop.busy}
            secondary={id !== 'remove_ads'}
          />
        );
      })}
      {shop.message ? <Text style={styles.note}>{shop.message.toUpperCase()}</Text> : null}
      {shop.ready ? <GameButton label="RESTORE PURCHASES" detail="No more ads, on a new phone or after reinstalling" onPress={() => void restorePurchases()} secondary /> : null}
      {privacy ? <GameButton label="PRIVACY CHOICES" detail="what the ads may use" onPress={() => void privacy()} secondary /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  note: { color: '#858d7c', fontFamily: 'monospace', fontSize: 8 },
});
