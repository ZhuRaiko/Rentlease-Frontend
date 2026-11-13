import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { portfolioFilters, type PortfolioFilter } from '../models/LandlordPortfolio';

/** Status filter tabs. Counts and the active filter are owned by the ViewModel; this only renders and reports taps. */
export function PortfolioFilterTabs({ active, counts, onSelect }: { active: PortfolioFilter; counts: Record<PortfolioFilter, number>; onSelect: (filter: PortfolioFilter) => void }) {
  return <ScrollView horizontal accessibilityRole="tablist" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
    {portfolioFilters.map(({ key, label }) => {
      const selected = key === active;
      return <Pressable key={key} accessibilityRole="tab" accessibilityLabel={`${label}, ${counts[key]}`} accessibilityState={{ selected }} hitSlop={{ top: 4, bottom: 4 }} onPress={() => onSelect(key)} style={({ pressed }) => [styles.tab, selected && styles.selected, pressed && styles.pressed]}>
        <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
        <Text style={[styles.count, selected && styles.selectedLabel]}>{counts[key]}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingVertical: 2 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background },
  selected: { backgroundColor: colors.primaryAction, borderColor: colors.primaryAction },
  pressed: { opacity: 0.8 },
  label: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  count: { color: colors.ink, fontFamily: typography.family, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  selectedLabel: { color: colors.white },
});
