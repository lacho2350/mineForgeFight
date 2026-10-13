import { StyleSheet, View } from 'react-native';

// A mining cart for the mine's toolbar (there's no emoji for one — 🛒 is a shopping trolley): a wooden
// tub heaped with coal and a gold nugget, on two wheels on a rail. Plain views, so it looks the same on
// every platform; about the size of a toolbar emoji (30 × 22).
export default function MineCartIcon() {
  return (
    <View style={styles.box}>
      <View style={styles.ore}>
        <View style={[styles.lump, styles.coal]} />
        <View style={[styles.lump, styles.lumpBig, styles.coalDark]} />
        <View style={[styles.lump, styles.gold]} />
      </View>
      <View style={styles.rim} />
      <View style={styles.tub} />
      <View style={styles.wheels}>
        <View style={styles.wheel} />
        <View style={styles.wheel} />
      </View>
      <View style={styles.rail} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 30, height: 22, alignItems: 'center', justifyContent: 'flex-end' },
  ore: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: -2 },
  lump: { width: 7, height: 6, marginHorizontal: -0.5, borderRadius: 3 },
  lumpBig: { width: 9, height: 8, borderRadius: 4 },
  coal: { backgroundColor: '#3d3934' },
  coalDark: { backgroundColor: '#24211e' },
  gold: { backgroundColor: '#e2b14a' },
  rim: { width: 26, height: 2, backgroundColor: '#5c4330' },
  // A trapezoid: the top border is the tub, the clear side borders slope its ends in.
  tub: {
    width: 26,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: '#b0743f',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  wheels: { width: 18, flexDirection: 'row', justifyContent: 'space-between', marginTop: -1 },
  wheel: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#cfc6b0', backgroundColor: '#3b3a36' },
  rail: { width: 30, height: 2, marginTop: -1, backgroundColor: '#8b9086' },
});
