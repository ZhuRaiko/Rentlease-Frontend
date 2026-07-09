import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { formatPeso, PrimaryAction } from '@/features/listings/components';
import { PriceEstimateResponse } from '@/features/pricing/price-service';
import { useTheme } from '@/hooks/use-theme';

export function PriceEstimateCard({
  estimate,
  onUsePrice,
  compact = false,
}: {
  estimate: PriceEstimateResponse;
  onUsePrice?: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { borderColor: theme.pricePanelBorder, backgroundColor: theme.pricePanel }]}>
      <View style={styles.header}>
        <View>
          <ThemedText style={[styles.eyebrow, { color: theme.success }]}>RentLease estimate</ThemedText>
          <ThemedText style={[styles.price, { color: theme.success }]}>
            {formatPeso(estimate.predictedRent)}
          </ThemedText>
        </View>
        <View style={[styles.aiPill, { borderColor: theme.pricePanelBorder }]}>
          <ThemedText style={[styles.aiText, { color: theme.success }]}>AI</ThemedText>
        </View>
      </View>
      <ThemedText style={[styles.range, { color: theme.success }]}>
        Typical {formatPeso(estimate.typicalRange[0])} - {formatPeso(estimate.typicalRange[1])}
      </ThemedText>
      {!compact ? (
        <ThemedText style={[styles.range, { color: theme.success }]}>
          Safe range {formatPeso(estimate.safeRange[0])} - {formatPeso(estimate.safeRange[1])}
        </ThemedText>
      ) : null}
      {onUsePrice ? (
        <PrimaryAction label="Use Suggested Price" tone="green" onPress={onUsePrice} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  price: {
    marginTop: 4,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  aiPill: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiText: {
    fontSize: 14,
    fontWeight: '900',
  },
  range: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  action: {
    minHeight: 46,
    marginTop: 4,
  },
});
