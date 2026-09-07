import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DiscoveryButton, DiscoveryChip } from '../components/DiscoveryControls';
import { DiscoveryIcon } from '../components/DiscoveryIcon';
import { DiscoveryMapPlaceholder } from '../components/DiscoveryMapPlaceholder';
import { DiscoveryPropertyImage } from '../components/DiscoveryPropertyImage';
import type { SearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';

const backIcon = require('../../../assets/verification/back.png');
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
      <View style={styles.detailLinkIcon}><DiscoveryIcon color={colors.primary} name={icon} size={21} /></View>
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
  const property = viewModel.selectedProperty;
  if (!property) return null;
  const saved = viewModel.isSaved(property.id);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <DiscoveryPropertyImage crop={property.id === 'preview-imus-house' ? { x: 2, y: 2, width: 225, height: 132 } : property.imageCrop} />
          <Pressable accessibilityLabel="Back to results" accessibilityRole="button" onPress={viewModel.goBack} style={styles.backButton}>
            <Image resizeMode="contain" source={backIcon} style={styles.backIcon} />
          </Pressable>
          <Pressable accessibilityLabel={saved ? 'Remove saved listing' : 'Save listing'} accessibilityRole="button" accessibilityState={{ selected: saved }} onPress={() => viewModel.toggleSaved(property.id)} style={[styles.saveButton, saved && styles.saveButtonActive]}>
            <DiscoveryIcon color={saved ? colors.white : colors.text} name="bookmark" size={22} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('photoGallery')} style={styles.galleryAction}>
          <DiscoveryIcon color={colors.text} name="gallery" size={19} />
          <Text style={styles.galleryActionText}>View all photos</Text>
        </Pressable>
        <View style={styles.content}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.price}>₱{formatRent(property.rent)}<Text style={styles.perMonth}> /mo</Text></Text>
              <Text style={styles.city}>{property.city}, Cavite</Text>
            </View>
            <View style={styles.ratingCard}>
              <Text style={styles.rating}>{property.rating.toFixed(1)}</Text>
              <Text style={styles.reviews}>{property.reviewCount} reviews</Text>
            </View>
          </View>
          <Text accessibilityRole="header" style={styles.title}>{property.title}</Text>
          <View style={styles.chips}>
            <DiscoveryChip label={property.propertyKind} onPress={() => undefined} selected />
            <DiscoveryChip label={property.furnished ? 'Furnished' : 'Unfurnished'} onPress={() => undefined} selected={false} />
          </View>
          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <Text style={styles.description}>{property.description}</Text>
          <Text style={styles.sectionLabel}>LANDLORD</Text>
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
          <View style={styles.specGrid}>
            <View style={styles.specCard}><Text style={styles.specValue}>{property.bedrooms}</Text><Text style={styles.specLabel}>Bedrooms</Text></View>
            <View style={styles.specCard}><Text style={styles.specValue}>{property.bathrooms}</Text><Text style={styles.specLabel}>Bathrooms</Text></View>
            <View style={styles.specCard}><Text style={styles.specValue}>{property.landArea}</Text><Text style={styles.specLabel}>sqm</Text></View>
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
  screen: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  hero: { position: 'relative' },
  backButton: { left: spacing.sm, position: 'absolute', top: spacing.sm },
  backIcon: { height: 42, width: 42 },
  saveButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.pill, height: 42, justifyContent: 'center', position: 'absolute', right: 72, top: spacing.sm, width: 42 },
  saveButtonActive: { backgroundColor: colors.primary },
  closeButton: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, position: 'absolute', right: spacing.sm, top: spacing.sm },
  closeLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  galleryAction: { alignItems: 'center', alignSelf: 'flex-end', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, marginRight: spacing.lg, marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  galleryActionText: { color: colors.text, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  content: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  priceRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  price: { color: colors.text, fontFamily: typography.family, fontSize: 27, fontWeight: '900' },
  perMonth: { fontSize: 12 },
  city: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12 },
  ratingCard: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, minWidth: 74, padding: spacing.xs },
  rating: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '800' },
  reviews: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9 },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 22, fontWeight: '900', lineHeight: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sectionLabel: { color: colors.text, fontFamily: typography.family, fontSize: 10, fontWeight: '900', marginTop: spacing.md },
  description: { color: colors.text, fontFamily: typography.family, fontSize: 12, lineHeight: 18 },
  landlordRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  avatar: { borderRadius: radius.pill, height: 46, width: 46 },
  landlordCopy: { flex: 1 },
  landlordName: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '800' },
  landlordMeta: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10 },
  verifiedDot: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, height: 13, width: 13 },
  matchCard: { alignItems: 'center', backgroundColor: colors.primaryPale, borderColor: '#70D788', borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, padding: spacing.md },
  matchCircle: { alignItems: 'center', borderColor: colors.primary, borderRadius: radius.pill, borderWidth: 3, height: 56, justifyContent: 'center', width: 56 },
  matchValue: { color: colors.primary, fontFamily: typography.family, fontSize: 13, fontWeight: '900' },
  matchCopy: { flex: 1 },
  matchTitle: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  matchMeta: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: spacing.xxs },
  specGrid: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  specCard: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, minHeight: 68, justifyContent: 'center' },
  specValue: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '900' },
  specLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10 },
  sectionHeading: { color: colors.text, fontFamily: typography.family, fontSize: 17, fontWeight: '900', marginTop: spacing.lg },
  detailLinks: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  detailLink: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 66, paddingHorizontal: spacing.md },
  detailLinkIcon: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.pill, height: 40, justifyContent: 'center', width: 40 },
  detailLinkCopy: { flex: 1 },
  detailLinkTitle: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '800' },
  detailLinkBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: spacing.xxs },
  chevron: { borderRightColor: colors.textMuted, borderRightWidth: 2, borderTopColor: colors.textMuted, borderTopWidth: 2, height: 9, transform: [{ rotate: '45deg' }], width: 9 },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16, padding: spacing.sm },
  pressed: { opacity: 0.72 },
});
