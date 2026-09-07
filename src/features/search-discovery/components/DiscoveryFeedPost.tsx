import type { ImageSourcePropType } from 'react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { DiscoveryProperty, ImageCrop } from '../models/SearchDiscovery';
import { DiscoveryIcon } from './DiscoveryIcon';
import { DiscoveryPropertyImage } from './DiscoveryPropertyImage';

const verificationMark = require('../../../assets/verification/verification-mark.png');
const propertyBadge = require('../../../assets/verification/property.png');

const galleryCrops: ImageCrop[] = [
  { x: 14, y: 154, width: 44, height: 33 },
  { x: 61, y: 154, width: 44, height: 33 },
  { x: 108, y: 154, width: 44, height: 33 },
];

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
            <Text numberOfLines={1} style={styles.landlordName}>{landlordName}</Text>
            <Image resizeMode="contain" source={verificationMark} style={styles.verificationBadge} />
            <Image resizeMode="contain" source={propertyBadge} style={styles.propertyBadge} />
          </View>
          {tierLabel ? <Text style={styles.tierLabel}>{tierLabel}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" onPress={onViewListing} hitSlop={8}>
          <Text style={styles.viewListing}>View listing</Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={onViewListing}>
        <Text style={styles.description}>
          {description}{' '}
          <Text style={styles.seeMore}>See more</Text>
        </Text>
      </Pressable>

      <Pressable accessibilityLabel={`View ${property.title}`} accessibilityRole="button" onPress={onViewListing}>
        <DiscoveryPropertyImage crop={heroCrop} />
      </Pressable>

      {showGallery ? (
        <View style={styles.galleryRow}>
          {galleryCrops.map((crop, index) => (
            <Pressable
              accessibilityLabel={index === 2 ? `View ${galleryMoreCount} more images` : `View property image ${index + 1}`}
              accessibilityRole="button"
              key={`${crop.x}-${crop.y}`}
              onPress={onViewListing}
              style={styles.galleryItem}
            >
              <DiscoveryPropertyImage crop={crop} />
              {index === 2 ? (
                <View style={styles.galleryOverlay}>
                  <DiscoveryIcon color={colors.white} name="gallery" size={22} />
                  <Text style={styles.moreImages}>+{galleryMoreCount}</Text>
                  <Text style={styles.moreImagesLabel}>Images</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {showMetrics ? (
        <View style={styles.metricsRow}>
          <View style={styles.rentMetric}>
            <Text numberOfLines={1} style={styles.rentLine}>
              <Text style={styles.currency}>₱{formatRent(property.rent)}</Text>
              <Text style={styles.perMonth}> /mo</Text>
            </Text>
            <View style={styles.locationRow}>
              <DiscoveryIcon color={colors.text} name="location" size={10} />
              <Text numberOfLines={1} style={styles.location}>{property.city} City, Cavite</Text>
            </View>
          </View>
          <View style={styles.matchMetric}>
            <Text style={styles.matchScore}>{displayedMatchScore}%</Text>
            <Text style={styles.matchLabel}>Pref.{`\n`}Match</Text>
          </View>
          <View style={styles.ratingMetric}>
            <DiscoveryIcon color={colors.text} name="rating" size={18} />
            <Text style={styles.rating}>{property.rating.toFixed(1)}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  post: { backgroundColor: colors.background, borderBottomColor: colors.surfaceStrong, borderBottomWidth: 6, paddingBottom: spacing.sm },
  landlordRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.xs, paddingTop: spacing.sm },
  avatar: { borderRadius: 18, height: 34, width: 34 },
  avatarFallback: { alignItems: 'center', backgroundColor: '#E4B969', borderRadius: 18, height: 34, justifyContent: 'center', width: 34 },
  avatarFallbackText: { color: colors.text, fontFamily: typography.family, fontSize: 11, fontWeight: '900' },
  landlordCopy: { flex: 1, minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  landlordName: { color: colors.text, flexShrink: 1, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  verificationBadge: { height: 14, tintColor: '#67B957', width: 14 },
  propertyBadge: { height: 14, tintColor: '#EF7477', width: 14 },
  tierLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, marginTop: 2 },
  viewListing: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  description: { color: '#444444', fontFamily: typography.family, fontSize: 10.5, lineHeight: 15, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  seeMore: { color: colors.text, fontWeight: '700' },
  galleryRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 4, paddingTop: 4 },
  galleryItem: { flex: 1, overflow: 'hidden', position: 'relative' },
  galleryOverlay: { alignItems: 'center', backgroundColor: colors.overlay, bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  moreImages: { color: colors.white, fontFamily: typography.family, fontSize: 12, fontWeight: '900', marginTop: 2 },
  moreImagesLabel: { color: colors.white, fontFamily: typography.family, fontSize: 9 },
  metricsRow: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.md },
  rentMetric: { flex: 1.35, minWidth: 0 },
  rentLine: { color: colors.text, fontFamily: typography.family },
  currency: { fontSize: 20, fontWeight: '900' },
  perMonth: { fontSize: 10, fontWeight: '800' },
  locationRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4 },
  location: { color: colors.text, flexShrink: 1, fontFamily: typography.family, fontSize: 8 },
  matchMetric: { alignItems: 'center', flex: 0.95, flexDirection: 'row', justifyContent: 'center' },
  matchScore: { color: '#5BB06A', fontFamily: typography.family, fontSize: 35, fontWeight: '700', letterSpacing: -2 },
  matchLabel: { color: colors.text, fontFamily: typography.family, fontSize: 7, fontWeight: '800', lineHeight: 8, marginLeft: 3 },
  ratingMetric: { alignItems: 'center', flex: 0.55, flexDirection: 'row', gap: 3, justifyContent: 'flex-end' },
  rating: { color: colors.text, fontFamily: typography.family, fontSize: 21, fontWeight: '800' },
});
