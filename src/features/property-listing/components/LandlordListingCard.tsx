import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { LandlordListingPreview } from '../models/PropertyListing';
import { FigmaReferenceCrop } from './FigmaReferenceCrop';

interface LandlordListingCardProps {
  listing: LandlordListingPreview;
  onManage: () => void;
  onOpen: () => void;
}

export function LandlordListingCard({ listing, onManage, onOpen }: LandlordListingCardProps) {
  return (
    <View style={styles.card}>
      <Pressable accessibilityLabel={`Open ${listing.title}`} accessibilityRole="button" onPress={onOpen} style={styles.imageArea}>
        <FigmaReferenceCrop crop={listing.imageCrop} />
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>{listing.tenancyLabel}</Text>
        </View>
        <View style={styles.photoBadge}>
          <Text style={styles.photoBadgeText}>{listing.photoCount} photos</Text>
        </View>
      </Pressable>

      <View style={styles.details}>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₱{listing.rent}<Text style={styles.perMonth}>/mo</Text></Text>
          <View style={[styles.rentBadge, listing.rentOverdue ? styles.rentBadgeOverdue : styles.rentBadgeCurrent]}>
            <Text style={[styles.rentBadgeText, listing.rentOverdue ? styles.rentTextOverdue : styles.rentTextCurrent]}>{listing.rentLabel}</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={onOpen}>
          <Text numberOfLines={1} style={styles.title}>{listing.title}</Text>
        </Pressable>
        <View style={styles.addressRow}>
          <View style={styles.locationPin}><View style={styles.locationDot} /></View>
          <Text style={styles.address}>{listing.address}</Text>
        </View>
        <Text style={styles.specs}>{listing.bedrooms} bed  ·  {listing.bathrooms} bath  ·  {listing.landArea} sqm</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.metrics}>
          <Text style={styles.metric}>{listing.views} views</Text>
          <Text style={styles.metric}>{listing.inquiries} inquiries</Text>
          <Text style={styles.ratingMetric}>{listing.rating.toFixed(1)}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onManage} style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}>
          <View style={styles.editMark} />
          <Text style={styles.manageLabel}>Manage</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  imageArea: { overflow: 'hidden', position: 'relative' },
  liveBadge: { backgroundColor: '#EFF8E7', borderRadius: radius.pill, left: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, position: 'absolute', top: spacing.sm },
  liveBadgeText: { color: '#176B22', fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  photoBadge: { backgroundColor: 'rgba(28, 50, 43, 0.76)', borderRadius: radius.pill, bottom: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 4, position: 'absolute', right: spacing.sm },
  photoBadgeText: { color: colors.white, fontFamily: typography.family, fontSize: 9 },
  details: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  priceRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  price: { color: colors.text, fontFamily: typography.family, fontSize: 19, fontWeight: '900' },
  perMonth: { fontSize: 10, fontWeight: '700' },
  rentBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  rentBadgeOverdue: { backgroundColor: '#FFE8E8' },
  rentBadgeCurrent: { backgroundColor: '#ECF8E2' },
  rentBadgeText: { fontFamily: typography.family, fontSize: 9, fontWeight: '800' },
  rentTextOverdue: { color: '#B52A2A' },
  rentTextCurrent: { color: '#2E7A22' },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '900', marginTop: 3 },
  addressRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 4 },
  locationPin: { alignItems: 'center', borderColor: '#28A76A', borderRadius: 6, borderWidth: 1.4, height: 10, justifyContent: 'center', transform: [{ rotate: '45deg' }], width: 10 },
  locationDot: { backgroundColor: '#28A76A', borderRadius: 2, height: 3, transform: [{ rotate: '-45deg' }], width: 3 },
  address: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10 },
  specs: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, marginBottom: spacing.sm, marginTop: spacing.sm, textAlign: 'center' },
  footer: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 45, paddingHorizontal: spacing.sm },
  metrics: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  metric: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9 },
  ratingMetric: { color: '#A66A00', fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  manageButton: { alignItems: 'center', backgroundColor: '#F0F9E6', borderColor: '#A8D884', borderRadius: radius.sm, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 6 },
  editMark: { borderBottomColor: '#2E7A22', borderBottomWidth: 1.5, borderRightColor: '#2E7A22', borderRightWidth: 1.5, height: 7, transform: [{ rotate: '-45deg' }], width: 7 },
  manageLabel: { color: '#246D20', fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
