import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { PropertyListingSummary } from '../models/PropertyListing';
import { FigmaReferenceCrop } from './FigmaReferenceCrop';

interface PropertySummaryCardProps {
  listing: PropertyListingSummary;
  onPress: () => void;
}

const statusBackground = {
  draft: '#EEE7DA',
  published: '#DDF6E3',
  paused: '#FFF1D3',
  unavailable: '#F1E5E5',
  archived: '#E8E8E8',
} as const;

export function PropertySummaryCard({ listing, onPress }: PropertySummaryCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <FigmaReferenceCrop borderRadius={radius.md} crop={{ x: 2, y: 25, width: 225, height: 105 }} />
      <View style={styles.copy}>
        <View style={styles.statusRow}>
          <Text style={styles.price}>₱{listing.rent}<Text style={styles.perMonth}> /mo</Text></Text>
          <View style={[styles.status, { backgroundColor: statusBackground[listing.status] }]}>
            <Text style={styles.statusText}>{listing.status}</Text>
          </View>
        </View>
        <Text style={styles.title}>{listing.title}</Text>
        <Text style={styles.address}>{listing.address}</Text>
        <Text style={styles.specs}>
          {listing.bedrooms} bedrooms · {listing.bathrooms} bathrooms · {listing.landArea} sqm
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    elevation: 2,
    overflow: 'hidden',
    shadowColor: colors.text,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  copy: { gap: spacing.xs, padding: spacing.md },
  statusRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  price: { color: colors.text, fontFamily: typography.family, fontSize: 22, fontWeight: '800' },
  perMonth: { fontSize: 12, fontWeight: '700' },
  status: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  statusText: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '800' },
  address: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13 },
  specs: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.76 },
});
