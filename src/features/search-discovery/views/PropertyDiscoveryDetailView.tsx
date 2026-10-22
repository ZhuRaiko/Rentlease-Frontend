import { Image, Pressable, ScrollView, Text, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/theme/ui';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DiscoveryButton } from '../components/DiscoveryControls';
import { DiscoveryIcon } from '../components/DiscoveryIcon';
import { DiscoveryMapPlaceholder } from '../components/DiscoveryMapPlaceholder';
import { DiscoveryPropertyImage } from '../components/DiscoveryPropertyImage';
import type { SearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';

const landlordAvatar = require('../../../assets/authentication/profile-avatar.png');

interface PropertyDiscoveryDetailViewProps {
  viewModel: SearchDiscoveryViewModel;
  onClose: () => void;
  onOpenPriceEstimate: () => void;
  onStartInquiry: () => void;
}

function formatRent(rent: number) {
  return new Intl.NumberFormat('en-PH').format(rent);
}

function DetailLink({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: 'gallery' | 'filter' | 'location' | 'map';
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.detailLink, pressed && styles.pressed]}>
      <View style={styles.detailLinkIcon}><DiscoveryIcon color={colors.textSecondary} name={icon} size={21} /></View>
      <View style={styles.detailLinkCopy}>
        <Text style={styles.detailLinkTitle}>{title}</Text>
        <Text style={styles.detailLinkBody}>{detail}</Text>
      </View>
      <View style={styles.chevron} />
    </Pressable>
  );
}

export function PropertyDiscoveryDetailView({
  viewModel,
  onClose,
  onOpenPriceEstimate,
  onStartInquiry,
}: PropertyDiscoveryDetailViewProps) {
  const { width, fontScale } = useWindowDimensions();
  const largeText = width / fontScale < 280;
  const property = viewModel.selectedProperty;
  if (!property) return null;
  const saved = viewModel.isSaved(property.id);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <DiscoveryPropertyImage crop={property.id === 'preview-imus-house' ? { x: 2, y: 2, width: 225, height: 132 } : property.imageCrop} />
          <View style={styles.heroControls}>
          <Pressable accessibilityLabel="Back to results" accessibilityRole="button" onPress={viewModel.goBack} style={styles.backButton}>
            <Text accessible={false} style={styles.backIcon}>{'\u2039'}</Text>
          </Pressable>
          <View style={styles.heroActions}>
          <Pressable accessibilityLabel={saved ? 'Remove saved listing' : 'Save listing'} accessibilityRole="button" accessibilityState={{ selected: saved }} onPress={() => viewModel.toggleSaved(property.id)} style={[styles.saveButton, saved && styles.saveButtonActive]}>
            <DiscoveryIcon color={saved ? colors.white : colors.text} name="bookmark" size={22} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
          </View>
          </View>
        <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('photoGallery')} style={styles.galleryAction}>
          <DiscoveryIcon color={colors.text} name="gallery" size={19} />
          <Text style={styles.galleryActionText}>View all photos</Text>
        </Pressable>
        </View>
        <View style={styles.content}>
          <View style={styles.priceRow}>
            <View style={[styles.priceCopy, largeText && styles.widePrice]}>
              <Text style={styles.price}>₱{formatRent(property.rent)}<Text style={styles.perMonth}> /mo</Text></Text>
            </View>
            <View style={styles.ratingCard}>
              <View style={styles.ratingValue}><DiscoveryIcon color={colors.warning} name="rating" size={16} /><Text style={styles.rating}>{property.rating.toFixed(1)}</Text></View>
              <Text style={styles.reviews}>{property.reviewCount} reviews</Text>
            </View>
          </View>
          <Text accessibilityRole="header" style={styles.title}>{property.title}</Text>
          <View style={styles.chips}>
            <View style={[styles.propertyTag, styles.selectedTag]}><Text style={[styles.tagLabel, styles.selectedTagLabel]}>{property.propertyKind}</Text></View>
            <View style={styles.propertyTag}><Text style={styles.tagLabel}>{property.furnished ? 'Furnished' : 'Unfurnished'}</Text></View>
          </View>
          <Text style={styles.city}>{property.city}, Cavite</Text>
          <View style={styles.specGrid}>
            <View style={styles.specCard}><Text style={styles.specValue}>{property.bedrooms}</Text><Text style={styles.specLabel}>Bedrooms</Text></View>
            <View style={styles.specCard}><Text style={styles.specValue}>{property.bathrooms}</Text><Text style={styles.specLabel}>Bathrooms</Text></View>
            <View style={styles.specCard}><Text style={styles.specValue}>{property.landArea}</Text><Text style={styles.specLabel}>sqm</Text></View>
          </View>
          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.description}>{property.description}</Text>
          <Text style={styles.sectionLabel}>Landlord</Text>
          <View style={styles.landlordRow}>
            <Image resizeMode="cover" source={landlordAvatar} style={styles.avatar} />
            <View style={styles.landlordCopy}>
              <Text style={styles.landlordName}>Samuel Feliciano</Text>
              <Text style={styles.landlordMeta}>Tier 3 verified Landlord · 12 listings</Text>
            </View>
            <View style={styles.verifiedDot} />
          </View>
          <View style={styles.matchCard}>
            <View style={styles.matchCircle}><Text style={styles.matchValue}>{property.matchScore}%</Text></View>
            <View style={styles.matchCopy}>
              <Text style={styles.matchTitle}>Strong match for your preferences</Text>
              <Text style={styles.matchMeta}>Budget · Location · Property details · Amenities</Text>
            </View>
          </View>
          <Text style={styles.sectionHeading}>Explore this property</Text>
          <View style={styles.detailLinks}>
            <DetailLink detail={`${property.amenities.length} available features`} icon="filter" onPress={() => viewModel.navigate('propertyAmenities')} title="Property amenities" />
            <DetailLink detail={`${property.nearbyPlaces.length} nearby essentials`} icon="location" onPress={() => viewModel.navigate('nearbyPlaces')} title="Nearby places" />
            <DetailLink detail={property.address} icon="map" onPress={() => viewModel.navigate('propertyLocation')} title="Map location" />
          </View>
          <Text style={styles.sectionHeading}>Location preview</Text>
          <DiscoveryMapPlaceholder onSelectProperty={() => undefined} properties={[property]} />
          {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
          <DiscoveryButton
            label="Message landlord"
            onPress={onStartInquiry}
            tone="green"
          />
          <DiscoveryButton
            label="Check fair rental price"
            onPress={onOpenPriceEstimate}
            tone="outline"
          />
          <DiscoveryButton
            label={saved ? 'Remove from saved listings' : 'Save this listing'}
            onPress={() => viewModel.toggleSaved(property.id)}
            tone={saved ? 'outline' : 'green'}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  propertyTag: { borderColor: colors.outline, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  selectedTag: { backgroundColor: colors.primaryAction, borderColor: colors.primaryAction },
  tagLabel: { ...ui.supporting },
  selectedTagLabel: { color: colors.white },
  ratingValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  widePrice: { flexBasis: '100%', flexShrink: 0 },
  screen: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  heroControls: { position: 'absolute', left: spacing.sm, right: spacing.sm, top: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  hero: { position: 'relative' },
  backButton: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.pill, justifyContent: 'center', minHeight: 48, width: 48 },
  backIcon: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 28, fontWeight: '600' },
  saveButton: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.pill, justifyContent: 'center', minHeight: 48, minWidth: 48 },
  saveButtonActive: { backgroundColor: colors.primaryAction },
  closeButton: { backgroundColor: colors.background, borderRadius: radius.control, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, justifyContent: 'center', minHeight: 48, minWidth: 48, flexShrink: 1 },
  closeLabel: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  galleryAction: { position: 'absolute', bottom: spacing.sm, right: spacing.sm, backgroundColor: colors.background, borderRadius: radius.control, alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minHeight: 48, paddingHorizontal: spacing.sm, maxWidth: '90%' },
  galleryActionText: { ...ui.supporting, color: colors.ink, fontWeight: '700', flexShrink: 1 },
  content: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  priceRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  priceCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 155, minWidth: 0 },
  price: { ...ui.pageTitle, fontSize: 24, lineHeight: 30 },
  perMonth: { fontSize: 12 },
  city: { ...ui.supporting },
  ratingCard: { alignItems: 'center', backgroundColor: colors.canvas, borderRadius: radius.sm, minWidth: 72, padding: spacing.xs },
  rating: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '800' },
  reviews: { ...ui.supporting },
  title: { ...ui.sectionTitle, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sectionLabel: { ...ui.sectionTitle, marginTop: spacing.md },
  description: { ...ui.body },
  landlordRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  avatar: { borderRadius: radius.pill, height: 46, width: 46 },
  landlordCopy: { flex: 1, minWidth: 0 },
  landlordName: { ...ui.body, fontWeight: '600' },
  landlordMeta: { ...ui.supporting },
  verifiedDot: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, height: 13, width: 13 },
  matchCard: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.panel, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, padding: spacing.sm },
  matchCircle: { alignItems: 'center', borderColor: colors.controlBorder, borderWidth: 1, borderRadius: radius.sm, minHeight: 44, minWidth: 60, padding: spacing.xs, justifyContent: 'center' },
  matchValue: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 20, fontWeight: '800' },
  matchCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 145, minWidth: 0 },
  matchTitle: { ...ui.supporting, color: colors.ink, fontWeight: '600' },
  matchMeta: { ...ui.supporting, marginTop: spacing.xxs },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginVertical: spacing.sm },
  specCard: { alignItems: 'center', backgroundColor: colors.canvas, borderRadius: radius.control, flexGrow: 1, flexShrink: 1, flexBasis: 85, padding: spacing.sm, minHeight: 68, justifyContent: 'center' },
  specValue: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '900' },
  specLabel: { ...ui.supporting },
  sectionHeading: { ...ui.sectionTitle, marginTop: spacing.md },
  detailLinks: { borderTopColor: colors.outline, borderTopWidth: 1 },
  detailLink: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 66, paddingHorizontal: spacing.md },
  detailLinkIcon: { alignItems: 'center', minHeight: 40, justifyContent: 'center', width: 32 },
  detailLinkCopy: { flex: 1, minWidth: 0 },
  detailLinkTitle: { ...ui.body, fontWeight: '700' },
  detailLinkBody: { ...ui.supporting, marginTop: spacing.xxs },
  chevron: { borderRightColor: colors.textMuted, borderRightWidth: 2, borderTopColor: colors.textMuted, borderTopWidth: 2, height: 9, transform: [{ rotate: '45deg' }], width: 9 },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16, padding: spacing.sm },
  pressed: { opacity: 0.72 },
});
