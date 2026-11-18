import {StyleSheet, View} from 'react-native';
import {SkeletonBlock} from '../../../shared/components/RefreshHint';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';

/**
 * The designed placeholder under the three tiles: one large card (photo, chip, title, two lines, a button) and one small card (thumbnail and two
 * lines). Fixed sizes, so nothing jumps when the real cards arrive. Shown only on the first load with nothing cached.
 */
export function TenancyLoadingCards() {
  const fill = {backgroundColor: colors.outline};
  return <View accessible accessibilityLabel="Loading rentals" accessibilityLiveRegion="polite" style={styles.stack}>
    <View style={styles.card}>
      <SkeletonBlock height={140} radius={0} style={fill} />
      <View style={styles.body}>
        <SkeletonBlock width={72} height={24} radius={12} style={fill} />
        <SkeletonBlock width="70%" height={16} radius={8} style={fill} />
        <SkeletonBlock width="45%" height={12} radius={6} style={fill} />
        <SkeletonBlock height={8} radius={4} style={fill} />
        <SkeletonBlock height={48} radius={24} style={fill} />
      </View>
    </View>
    <View style={[styles.card, styles.small]}>
      <SkeletonBlock width={56} height={56} radius={12} style={fill} />
      <View style={styles.lines}>
        <SkeletonBlock width="80%" height={14} radius={7} style={fill} />
        <SkeletonBlock width="50%" height={12} radius={6} style={fill} />
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  stack: {gap: spacing.sm},
  card: {backgroundColor: colors.background, borderColor: colors.outline, borderWidth: 1, borderRadius: radius.card, overflow: 'hidden'},
  body: {padding: spacing.md, gap: spacing.sm},
  small: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2},
  lines: {flex: 1, gap: spacing.xs},
});
