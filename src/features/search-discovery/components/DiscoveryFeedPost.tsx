import type { ImageSourcePropType } from 'react-native';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/theme/ui';
import { spacing } from '../../../shared/theme/spacing';
import { radius } from '../../../shared/theme/radius';
import { typography } from '../../../shared/theme/typography';
import type { DiscoveryProperty, ImageCrop } from '../models/SearchDiscovery';
import { DiscoveryIcon } from './DiscoveryIcon';
import { DiscoveryPropertyImage } from './DiscoveryPropertyImage';

const verificationMark = require('../../../assets/verification/verification-mark.png');
const propertyBadge = require('../../../assets/verification/property.png');

interface DiscoveryFeedPostProps {
  avatar: ImageSourcePropType;
  avatarLabel?: string | undefined;
  description: string;
  landlordName: string;
  onViewListing: () => void;
  property: DiscoveryProperty;
  tierLabel?: string;
  heroCrop?: ImageCrop;
  showGallery?: boolean;
  showMetrics?: boolean;
  displayedMatchScore?: number;
  galleryMoreCount?: number;
}

function formatRent(rent: number) {
  return rent.toLocaleString('en-PH');
}

export function DiscoveryFeedPost({
  avatar,
  avatarLabel,
  description,
  landlordName,
  onViewListing,
  property,
  tierLabel,
  heroCrop = property.imageCrop,
  showGallery = false,
  showMetrics = true,
  displayedMatchScore = property.matchScore,
  galleryMoreCount = 4,
}: DiscoveryFeedPostProps) {
  const { width, fontScale } = useWindowDimensions();
  const largeText = width / fontScale < 280;
  return (
    <View style={styles.post}>
      <View style={styles.landlordRow}>
        {avatarLabel ? (
          <View style={styles.avatarFallback}><Text style={styles.avatarFallbackText}>{avatarLabel}</Text></View>
        ) : (
          <Image resizeMode="cover" source={avatar} style={styles.avatar} />
        )}
        <View style={styles.landlordCopy}>
          <View style={styles.nameRow}>
            <Text style={styles.landlordName}>{landlordName}</Text>
            <Image resizeMode="contain" source={verificationMark} style={styles.verificationBadge} />
            <Image resizeMode="contain" source={propertyBadge} style={styles.propertyBadge} />
          </View>
          {tierLabel ? <Text style={styles.tierLabel}>{tierLabel}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" onPress={onViewListing} style={[styles.viewAction, largeText && styles.wideAction]}>
          <Text style={styles.viewListing}>View listing</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Pressable accessibilityLabel={`View ${property.title}`} accessibilityRole="button" onPress={onViewListing}>
          <DiscoveryPropertyImage crop={heroCrop} />
        </Pressable>
        {showGallery ? <Pressable accessibilityLabel={`View ${galleryMoreCount} more images`} accessibilityRole="button" onPress={onViewListing} style={styles.galleryAction}>
          <DiscoveryIcon color={colors.white} name="gallery" size={20} />
          <Text style={styles.moreImages}>+{galleryMoreCount}</Text>
        </Pressable> : null}
      </View>
      <Pressable accessibilityRole="button" onPress={onViewListing}>
        <Text style={styles.description}>{description}{' '}<Text style={styles.seeMore}>See more</Text></Text>
      </Pressable>

      {showMetrics ? (
        <View style={styles.metricsRow}>
          <View style={styles.rentMetric}>
            <Text style={styles.rentLine}>
              <Text style={styles.currency}>₱{formatRent(property.rent)}</Text>
              <Text style={styles.perMonth}> /mo</Text>
            </Text>
            <View style={styles.locationRow}>
              <DiscoveryIcon color={colors.text} name="location" size={10} />
              <Text style={styles.location}>{property.city} City, Cavite</Text>
            </View>
          </View>
          <View style={styles.matchMetric}>
            <Text style={styles.matchScore}>{displayedMatchScore}%</Text>
            <Text style={styles.matchLabel}>Pref. Match</Text>
          </View>
          <View style={styles.ratingMetric}>
            <DiscoveryIcon color={colors.warning} name="rating" size={18} />
            <Text style={styles.rating}>{property.rating.toFixed(1)}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: spacing.xs, borderRadius: radius.control, overflow: 'hidden' },
  galleryAction: { position: 'absolute', bottom: spacing.xs, right: spacing.xs, minHeight: 48, minWidth: 48, padding: spacing.xs, backgroundColor: colors.overlay, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', gap: spacing.xxs },
  wideAction: { flexBasis: '100%' },
  viewAction: { minHeight: 48, minWidth: 48, justifyContent: 'center' },
  post: { ...ui.panel, paddingBottom: spacing.sm },
  landlordRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  avatar: { borderRadius: 18, height: 34, width: 34 },
  avatarFallback: { alignItems: 'center', backgroundColor: colors.surfaceStrong, borderRadius: 18, minHeight: 36, minWidth: 36, padding: spacing.xxs, justifyContent: 'center' },
  avatarFallbackText: { color: colors.text, fontFamily: typography.family, fontSize: 11, fontWeight: '900' },
  landlordCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 130, minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs },
  landlordName: { color: colors.ink, fontFamily: typography.family, fontSize: 14, lineHeight: 20, flexShrink: 1, fontWeight: '600' },
  verificationBadge: { height: 14, tintColor: '#67B957', width: 14 },
  propertyBadge: { height: 14, tintColor: '#EF7477', width: 14 },
  tierLabel: { ...ui.supporting, fontSize: 12, lineHeight: 18 },
  viewListing: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  description: { ...ui.body, fontSize: 14, lineHeight: 21, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  seeMore: { color: colors.text, fontWeight: '700' },
  moreImages: { color: colors.white, fontFamily: typography.family, fontSize: 12, fontWeight: '600' },
  metricsRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  rentMetric: { flexGrow: 1, flexBasis: 145, minWidth: 0 },
  rentLine: { color: colors.text, fontFamily: typography.family },
  currency: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  perMonth: { fontSize: 12, fontWeight: '400' },
  locationRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4 },
  location: { ...ui.supporting, fontSize: 12, flexShrink: 1 },
  matchMetric: { alignItems: 'center', gap: spacing.xxs, flexShrink: 1 },
  matchScore: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 20, fontWeight: '700' },
  matchLabel: { ...ui.supporting, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  ratingMetric: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs },
  rating: { color: colors.ink, fontFamily: typography.family, fontSize: 16, lineHeight: 22, fontWeight: '600' },
});
