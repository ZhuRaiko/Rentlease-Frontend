import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
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
        <DiscoveryPropertyImage borderRadius={radius.md} crop={property.imageCrop} />
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
        <Text numberOfLines={2} style={styles.title}>{property.title}</Text>
        <Text numberOfLines={1} style={styles.location}>{property.city}, Cavite</Text>
        <Text style={styles.specs}>
          {property.bedrooms} bed · {property.bathrooms} bath · {property.landArea} sqm
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, elevation: 2, overflow: 'hidden', shadowColor: colors.text, shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.09, shadowRadius: 5 },
  compactCard: { width: 282 },
  imageWrap: { minHeight: 142, overflow: 'hidden', position: 'relative' },
  compactImage: { minHeight: 124 },
  matchBadge: { backgroundColor: colors.primaryPale, borderRadius: radius.pill, left: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, position: 'absolute', top: spacing.sm },
  matchText: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  saveButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.pill, height: 38, justifyContent: 'center', position: 'absolute', right: spacing.sm, top: spacing.sm, width: 38 },
  saveButtonActive: { backgroundColor: colors.primary },
  copy: { gap: spacing.xxs, padding: spacing.md },
  priceRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  price: { color: colors.text, fontFamily: typography.family, fontSize: 20, fontWeight: '800' },
  perMonth: { fontSize: 11, fontWeight: '700' },
  rating: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10 },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  location: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12 },
  specs: { color: colors.text, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
