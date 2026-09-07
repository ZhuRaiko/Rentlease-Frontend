import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ReferenceImageCrop } from '../../../shared/components/ReferenceImageCrop';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type {
  EstimatePropertyPreview,
  RentalPriceEstimate,
} from '../models/RentalPriceEstimate';

const listingReference = require('../../../assets/property-listing/listing-detail-reference.png');
const sourceWidth = 229;
const sourceHeight = 878;

export function formatPhilippinePeso(value: number) {
  return `₱${new Intl.NumberFormat('en-PH').format(value)}`;
}

export function EstimatePropertyCard({
  property,
  onPress,
}: {
  property: EstimatePropertyPreview;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.propertyCard, pressed && styles.pressed]}
    >
      <View style={styles.propertyImage}>
        <ReferenceImageCrop
          borderRadius={radius.md}
          crop={property.imageCrop}
          source={listingReference}
          sourceHeight={sourceHeight}
          sourceWidth={sourceWidth}
        />
      </View>
      <View style={styles.propertyCopy}>
        <View style={styles.propertyTitleRow}>
          <Text numberOfLines={2} style={styles.propertyTitle}>{property.title}</Text>
          <View style={styles.chevron} />
        </View>
        <Text numberOfLines={1} style={styles.propertyAddress}>{property.address}</Text>
        <Text style={styles.propertySpecs}>
          {property.bedrooms} bed · {property.bathrooms} bath · {property.landArea ?? '—'} sqm
        </Text>
        <Text style={styles.propertyRent}>
          {property.askingRent > 0 ? `${formatPhilippinePeso(property.askingRent)} /mo` : 'Rent not set'}
        </Text>
        {!property.estimateAvailable ? (
          <Text style={styles.incomplete}>More property details required</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function EstimateHeroCard({ estimate }: { estimate: RentalPriceEstimate }) {
  return (
    <View style={styles.heroCard}>
      <Text style={styles.heroEyebrow}>Estimated monthly rent</Text>
      <Text style={styles.heroValue}>{formatPhilippinePeso(estimate.estimatedMonthlyRent)}</Text>
      <Text style={styles.heroMonth}>per month</Text>
      <View style={styles.confidencePill}>
        <View style={styles.confidenceDot} />
        <Text style={styles.confidenceText}>{estimate.confidenceLabel} estimate confidence</Text>
      </View>
    </View>
  );
}

export function SuggestedRangeCard({ estimate }: { estimate: RentalPriceEstimate }) {
  const range = estimate.suggestedMaximum - estimate.suggestedMinimum;
  const estimatePosition = ((estimate.estimatedMonthlyRent - estimate.suggestedMinimum) / range) * 100;
  const askingPosition = Math.max(
    0,
    Math.min(100, ((estimate.askingRent - estimate.suggestedMinimum) / range) * 100),
  );

  return (
    <View style={styles.rangeCard}>
      <Text style={styles.cardEyebrow}>Suggested rental range</Text>
      <Text style={styles.rangeValue}>
        {formatPhilippinePeso(estimate.suggestedMinimum)}–{formatPhilippinePeso(estimate.suggestedMaximum)}
      </Text>
      <View style={styles.rangeTrackShell}>
        <View style={styles.rangeTrack} />
        <View style={[styles.estimateMarker, { left: `${estimatePosition}%` }]} />
        <View style={[styles.askingMarker, { left: `${askingPosition}%` }]} />
      </View>
      <View style={styles.rangeLegend}>
        <View style={styles.legendItem}><View style={styles.legendEstimate} /><Text style={styles.legendText}>Estimate</Text></View>
        <View style={styles.legendItem}><View style={styles.legendAsking} /><Text style={styles.legendText}>Listed rent</Text></View>
      </View>
      <View style={styles.rangeLabels}>
        <Text style={styles.rangeLabel}>{formatPhilippinePeso(estimate.suggestedMinimum)}</Text>
        <Text style={styles.rangeLabel}>{formatPhilippinePeso(estimate.suggestedMaximum)}</Text>
      </View>
    </View>
  );
}

export function ComparisonSummaryCard({
  estimate,
  perspective,
}: {
  estimate: RentalPriceEstimate;
  perspective: 'tenant' | 'landlord';
}) {
  const isWithinRange = estimate.comparison === 'within-range';
  return (
    <View style={styles.comparisonCard}>
      <View style={styles.comparisonHeader}>
        <View style={[styles.statusDot, !isWithinRange && styles.statusDotWarning]} />
        <Text style={styles.comparisonStatus}>
          {isWithinRange ? 'Within the suggested range' : 'Outside the suggested range'}
        </Text>
      </View>
      <View style={styles.comparisonValues}>
        <View style={styles.comparisonColumn}>
          <Text style={styles.comparisonLabel}>
            {perspective === 'landlord' ? 'Your asking rent' : 'Listed rent'}
          </Text>
          <Text style={styles.comparisonValue}>{formatPhilippinePeso(estimate.askingRent)}</Text>
        </View>
        <View style={styles.comparisonDivider} />
        <View style={styles.comparisonColumn}>
          <Text style={styles.comparisonLabel}>RentLease estimate</Text>
          <Text style={styles.comparisonValue}>{formatPhilippinePeso(estimate.estimatedMonthlyRent)}</Text>
        </View>
      </View>
      <Text style={styles.comparisonNote}>
        The listed rent is {formatPhilippinePeso(estimate.differenceAmount)} ({estimate.differencePercent.toFixed(1)}%) above the center estimate and remains inside the suggested range.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.74 },
  propertyCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  propertyImage: { justifyContent: 'center', overflow: 'hidden', width: 106 },
  propertyCopy: { flex: 1, gap: spacing.xxs, justifyContent: 'center' },
  propertyTitleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  propertyTitle: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 14, fontWeight: '900' },
  propertyAddress: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10 },
  propertySpecs: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10 },
  propertyRent: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '800' },
  incomplete: { color: colors.warning, fontFamily: typography.family, fontSize: 9, fontWeight: '700' },
  chevron: { borderRightColor: colors.textMuted, borderRightWidth: 2, borderTopColor: colors.textMuted, borderTopWidth: 2, height: 9, transform: [{ rotate: '45deg' }], width: 9 },
  heroCard: { alignItems: 'center', backgroundColor: colors.primaryPale, borderColor: colors.trustedBorder, borderRadius: radius.card, borderWidth: 1, padding: spacing.lg },
  heroEyebrow: { color: colors.trustedText, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  heroValue: { color: '#24975F', fontFamily: typography.family, fontSize: 40, fontWeight: '900', letterSpacing: -1.2, marginTop: spacing.xs },
  heroMonth: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12 },
  confidencePill: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.pill, flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  confidenceDot: { backgroundColor: colors.primary, borderRadius: radius.pill, height: 7, width: 7 },
  confidenceText: { color: colors.trustedText, fontFamily: typography.family, fontSize: 10, fontWeight: '700' },
  rangeCard: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, padding: spacing.md },
  cardEyebrow: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, fontWeight: '800' },
  rangeValue: { color: colors.text, fontFamily: typography.family, fontSize: 20, fontWeight: '900', marginTop: spacing.xxs },
  rangeTrackShell: { height: 24, justifyContent: 'center', marginHorizontal: spacing.xs, marginTop: spacing.lg, position: 'relative' },
  rangeTrack: { backgroundColor: '#BFE5C5', borderRadius: radius.pill, height: 8, width: '100%' },
  estimateMarker: { backgroundColor: '#176E3F', borderColor: colors.white, borderRadius: radius.pill, borderWidth: 2, height: 18, marginLeft: -9, position: 'absolute', width: 18 },
  askingMarker: { backgroundColor: '#DF9415', borderColor: colors.white, borderRadius: radius.pill, borderWidth: 2, height: 14, marginLeft: -7, position: 'absolute', width: 14 },
  rangeLegend: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center', marginTop: spacing.xs },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs },
  legendEstimate: { backgroundColor: '#176E3F', borderRadius: radius.pill, height: 7, width: 7 },
  legendAsking: { backgroundColor: '#DF9415', borderRadius: radius.pill, height: 7, width: 7 },
  legendText: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9 },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  rangeLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10 },
  comparisonCard: { backgroundColor: colors.surface, borderRadius: radius.card, gap: spacing.md, padding: spacing.md },
  comparisonHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  statusDot: { backgroundColor: colors.primary, borderRadius: radius.pill, height: 9, width: 9 },
  statusDotWarning: { backgroundColor: colors.warning },
  comparisonStatus: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '900' },
  comparisonValues: { flexDirection: 'row' },
  comparisonColumn: { flex: 1, gap: spacing.xxs },
  comparisonLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10 },
  comparisonValue: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '900' },
  comparisonDivider: { backgroundColor: colors.border, marginHorizontal: spacing.sm, width: 1 },
  comparisonNote: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16 },
});
