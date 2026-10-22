import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/theme/ui';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { DiscoveryProperty } from '../models/SearchDiscovery';
import { DiscoveryIcon } from './DiscoveryIcon';
import { DiscoveryPropertyImage } from './DiscoveryPropertyImage';

interface DiscoveryPropertyCardProps {
  property: DiscoveryProperty;
  saved: boolean;
  onPress: () => void;
  onToggleSaved: () => void;
  compact?: boolean;
}

function formatRent(rent: number) {
  return new Intl.NumberFormat('en-PH').format(rent);
}

export function DiscoveryPropertyCard({
  property,
  saved,
  onPress,
  onToggleSaved,
  compact = false,
}: DiscoveryPropertyCardProps) {
  return (
    <Pressable
      accessibilityLabel={`${property.title}, ${property.city}, ${formatRent(property.rent)} pesos per month`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, compact && styles.compactCard, pressed && styles.pressed]}
    >
      <View style={[styles.imageWrap, compact && styles.compactImage]}>
        <DiscoveryPropertyImage borderRadius={radius.panel} crop={property.imageCrop} />
        <View style={styles.matchBadge}>
          <Text style={styles.matchText}>{property.matchScore}% match</Text>
        </View>
        <Pressable
          accessibilityLabel={saved ? 'Remove from saved listings' : 'Save listing'}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          onPress={onToggleSaved}
          style={[styles.saveButton, saved && styles.saveButtonActive]}
        >
          <DiscoveryIcon color={saved ? colors.white : colors.text} name="bookmark" size={20} />
        </Pressable>
      </View>
      <View style={styles.copy}>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₱{formatRent(property.rent)}<Text style={styles.perMonth}> /mo</Text></Text>
          <Text style={styles.rating}>{property.rating.toFixed(1)} · {property.reviewCount} reviews</Text>
        </View>
        <Text style={styles.title}>{property.title}</Text>
        <Text style={styles.location}>{property.city}, Cavite</Text>
        <Text style={styles.specs}>
          {property.bedrooms} bed · {property.bathrooms} bath · {property.landArea} sqm
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { ...ui.panel, overflow: 'hidden' },
  compactCard: { width: '100%', maxWidth: 420 },
  imageWrap: { minHeight: 142, overflow: 'hidden', position: 'relative' },
  compactImage: { minHeight: 124 },
  matchBadge: { backgroundColor: colors.background, borderRadius: radius.sm, left: spacing.sm, maxWidth: '65%', paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, position: 'absolute', top: spacing.sm },
  matchText: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 13, fontWeight: '700' },
  saveButton: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.pill, minHeight: 48, justifyContent: 'center', position: 'absolute', right: spacing.sm, top: spacing.sm, minWidth: 48 },
  saveButtonActive: { backgroundColor: colors.primaryAction },
  copy: { gap: spacing.xxs, padding: spacing.md },
  priceRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'space-between' },
  price: { color: colors.ink, fontFamily: typography.family, fontSize: 20, fontWeight: '700' },
  perMonth: { fontSize: 11, fontWeight: '700' },
  rating: { ...ui.supporting },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  location: { ...ui.supporting },
  specs: { ...ui.supporting, color: colors.ink },
  pressed: { opacity: 0.78 },
});
