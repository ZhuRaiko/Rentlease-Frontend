import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { RangeEstimateCard } from '../../../shared/components/RangeEstimateCard';
import { SHOW_RANGE_LABEL, rangeRelation, RELATION_TEXT } from '../../../shared/models/RentalRange';
import { useInlineRentalEstimate } from '../../../shared/viewModels/useInlineRentalEstimate';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { StatusButton, StatusChip } from '../../../shared/components/StatusParts';

/**
 * Price check for the Manage screen. It reuses the shared range card and the shared estimate hook, so the range-only rules (rounded
 * outward, no point value, the ball stays hidden until touched) apply unchanged. Hidden for properties that are not eligible.
 */
export function ManagePriceCheck({ accountId, listingId, property, rent }: { accountId: string | undefined; listingId: string; property?: Record<string, unknown> | null | undefined; rent: number | null | undefined }) {
  const vm = useInlineRentalEstimate(accountId, { listingId }, property);
  if (vm.eligibility?.eligible === false) return null;
  const result = vm.result, range = result?.illustrativeRange ?? null, relation = rangeRelation(rent, range);
  const chip = relation ? { label: relation === 'within' ? 'In range' : relation === 'above' ? 'Above range' : 'Below range', tone: relation === 'within' ? 'positive' as const : 'warning' as const } : null;
  return <View style={styles.card}>
    <View style={styles.head}><Text accessibilityRole="header" style={[ui.sectionTitle, styles.grow]}>Price check</Text>{chip ? <StatusChip chip={chip} /> : null}</View>
    {range ? <>
      <Text style={ui.supporting}>{relation ? RELATION_TEXT[relation] : 'Typical rent range for similar places'}</Text>
      <RangeEstimateCard range={range} rent={rent} subject="listing" showTitle={false} />
    </> : <Text style={ui.supporting}>See the typical rent range for similar places.</Text>}
    {vm.busy ? <ActivityIndicator accessibilityLabel="Estimating rental price" color={colors.primaryAction} /> : null}
    {vm.error ? <Text accessibilityRole="alert" style={ui.supporting}>{vm.error}</Text> : null}
    {!(vm.error && vm.retryable === false) ? <StatusButton label={vm.busy ? 'Estimating...' : vm.error ? 'Retry estimate' : range ? 'Estimate again' : SHOW_RANGE_LABEL} disabled={vm.busy} onPress={() => void vm.workflow.predict()} /> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { ...ui.panel, padding: spacing.sm, gap: spacing.sm, borderRadius: radius.panel },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
});
