import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { FigmaReferenceCrop } from '../components/FigmaReferenceCrop';
import { ListingButton } from '../components/ListingButton';
import { ChoiceChip } from '../components/ListingControls';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

const backIcon = require('../../../assets/verification/back.png');
const landlordAvatar = require('../../../assets/authentication/profile-avatar.png');

interface ListingDetailViewProps {
  viewModel: PropertyListingViewModel;
  onClose: () => void;
  onOpenPriceEstimate: () => void;
}

export function ListingDetailView({
  viewModel,
  onClose,
  onOpenPriceEstimate,
}: ListingDetailViewProps) {
  const { draft, listing } = viewModel;
  const thumbnails = [
    { x: 14, y: 154, width: 44, height: 33 },
    { x: 61, y: 154, width: 44, height: 33 },
    { x: 108, y: 154, width: 44, height: 33 },
    { x: 155, y: 154, width: 44, height: 33 },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <FigmaReferenceCrop crop={{ x: 2, y: 2, width: 225, height: 132 }} />
          <Pressable
            accessibilityLabel="Back to My Properties"
            accessibilityRole="button"
            onPress={viewModel.goDashboard}
            style={styles.backButton}
          >
            <Image resizeMode="contain" source={backIcon} style={styles.backIcon} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
        <Text style={styles.swipeHint}>Swipe horizontally to see more pictures.</Text>
        <View style={styles.thumbnailRow}>
          {thumbnails.map((crop) => (
            <View key={`${crop.x}-${crop.y}`} style={styles.thumbnail}>
              <FigmaReferenceCrop crop={crop} />
            </View>
          ))}
        </View>
        <View style={styles.content}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.price}>₱{listing.rent}<Text style={styles.perMonth}> /mo</Text></Text>
              <Text style={styles.city}>Imus City, Cavite</Text>
            </View>
            <View style={styles.rating}><Text style={styles.ratingText}>4.6 See Reviews</Text></View>
          </View>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.title}>{listing.title}</Text>
            <View style={styles.infoCircle}><Text style={styles.infoLabel}>i</Text></View>
          </View>
          <View style={styles.chips}>
            <ChoiceChip label={draft.propertyType ?? 'House'} onPress={() => undefined} selected />
            <ChoiceChip label={draft.furnished ? 'Furnished' : 'Unfurnished'} onPress={() => undefined} selected={false} />
          </View>
          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <Text style={styles.description}>{draft.description}</Text>
          <Text style={styles.sectionLabel}>LANDLORD</Text>
          <View style={styles.landlordRow}>
            <Image resizeMode="cover" source={landlordAvatar} style={styles.avatar} />
            <View style={styles.landlordCopy}>
              <Text style={styles.landlordName}>Samuel Feliciano</Text>
              <Text style={styles.landlordMeta}>Tier 3 verified Landlord · 12 listings</Text>
            </View>
            <View style={styles.verifiedDot} />
          </View>
          <View style={styles.estimationCard}>
            <View style={styles.estimatePriceColumn}>
              <Text style={styles.estimateEyebrow}>Price estimation by RentLease</Text>
              <Text style={styles.estimatePrice}>₱{listing.rent}<Text style={styles.estimateMonth}> /mo</Text></Text>
              <Text style={styles.range}>Range ₱49,000–₱67,800</Text>
            </View>
            <View style={styles.estimateChecks}>
              <Text style={styles.estimateCheck}>Listed price is within RentLease’s estimated range.</Text>
              <Text style={styles.estimateCheck}>Landlord used RentLease’s exact price estimation.</Text>
            </View>
          </View>
          {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
          <ListingButton label="Open rental price estimate" onPress={onOpenPriceEstimate} tone="outline" />
          <ListingButton label="Manage this listing" onPress={viewModel.openManagement} />
          <View style={styles.specGrid}>
            <View style={styles.specCard}><Text style={styles.specValue}>{draft.bedrooms}</Text><Text style={styles.specLabel}>Bedrooms</Text></View>
            <View style={styles.specCard}><Text style={styles.specValue}>{draft.bathrooms}</Text><Text style={styles.specLabel}>Bathrooms</Text></View>
            <View style={[styles.specCard, styles.landAreaCard]}><Text style={styles.specValue}>{draft.landArea}</Text><Text style={styles.specLabel}>sqm Land Area</Text></View>
          </View>
          <Text style={styles.sectionHeading}>LOCATION</Text>
          <FigmaReferenceCrop borderRadius={radius.sm} crop={{ x: 14, y: 576, width: 199, height: 131 }} />
          <Text style={styles.sectionLabel}>ADDRESS</Text>
          <View style={styles.addressField}>
            <Text style={styles.address}>{draft.address}</Text>
            <View style={styles.locationDot} />
          </View>
          <Text style={styles.sectionHeading}>AMENITIES</Text>
          <View style={styles.chips}>
            {draft.amenities.map((amenity) => (
              <ChoiceChip key={amenity} label={amenity} onPress={() => undefined} selected tone="purple" />
            ))}
          </View>
          <Text style={styles.sectionHeading}>MATCH SCORE</Text>
          <View style={styles.matchRow}>
            <View style={styles.matchCircle}><Text style={styles.matchValue}>87%</Text></View>
            <View style={styles.matchCopy}>
              <Text style={styles.matchTitle}>Strong match for your preferences</Text>
              <Text style={styles.matchMeta}>Budget · Location · Specs · Amenities</Text>
            </View>
          </View>
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
  closeButton: { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, position: 'absolute', right: spacing.sm, top: spacing.sm },
  closeLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  swipeHint: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, paddingVertical: spacing.xs, textAlign: 'center' },
  thumbnailRow: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md },
  thumbnail: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, overflow: 'hidden' },
  content: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  priceRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  price: { color: colors.text, fontFamily: typography.family, fontSize: 27, fontWeight: '800' },
  perMonth: { fontSize: 12 },
  city: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12 },
  rating: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  ratingText: { color: colors.text, fontFamily: typography.family, fontSize: 10, fontWeight: '700' },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  title: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 21, fontWeight: '800' },
  infoCircle: { alignItems: 'center', borderColor: colors.text, borderRadius: radius.pill, borderWidth: 1.5, height: 22, justifyContent: 'center', width: 22 },
  infoLabel: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sectionLabel: { color: colors.text, fontFamily: typography.family, fontSize: 10, fontWeight: '800', marginTop: spacing.sm },
  sectionHeading: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '800', marginTop: spacing.lg },
  description: { color: colors.text, fontFamily: typography.family, fontSize: 12, lineHeight: 18 },
  landlordRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  avatar: { borderRadius: radius.pill, height: 44, width: 44 },
  landlordCopy: { flex: 1 },
  landlordName: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '800' },
  landlordMeta: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10 },
  verifiedDot: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, height: 12, width: 12 },
  estimationCard: { backgroundColor: '#ECFFF0', borderColor: '#70D788', borderRadius: radius.card, borderWidth: 1.5, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  estimatePriceColumn: { flex: 1 },
  estimateEyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 9, fontWeight: '700' },
  estimatePrice: { color: colors.primary, fontFamily: typography.family, fontSize: 23, fontWeight: '800', marginTop: spacing.xs },
  estimateMonth: { fontSize: 9 },
  range: { backgroundColor: '#D9F4DF', borderRadius: radius.sm, color: colors.primary, fontFamily: typography.family, fontSize: 8, marginTop: spacing.xs, padding: spacing.xxs },
  estimateChecks: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  estimateCheck: { color: colors.primary, fontFamily: typography.family, fontSize: 9, lineHeight: 13 },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 17, padding: spacing.sm },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  specCard: { alignItems: 'center', borderColor: colors.textSecondary, borderRadius: radius.sm, borderWidth: 1, flex: 1, minHeight: 64, justifyContent: 'center' },
  landAreaCard: { flexBasis: '100%' },
  specValue: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '800' },
  specLabel: { color: colors.text, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  addressField: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: 'row', padding: spacing.sm },
  address: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 11 },
  locationDot: { backgroundColor: '#2196F3', borderRadius: radius.pill, height: 13, width: 13 },
  matchRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  matchCircle: { alignItems: 'center', borderColor: '#22B573', borderRadius: radius.pill, borderWidth: 3, height: 54, justifyContent: 'center', width: 54 },
  matchValue: { color: '#22B573', fontFamily: typography.family, fontSize: 14, fontWeight: '800' },
  matchCopy: { flex: 1 },
  matchTitle: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  matchMeta: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: spacing.xxs },
});
