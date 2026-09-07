import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import {
  ComparisonSummaryCard,
  EstimateHeroCard,
  EstimatePropertyCard,
  SuggestedRangeCard,
  formatPhilippinePeso,
} from '../components/PriceEstimationCards';
import { PriceEstimationScaffold } from '../components/PriceEstimationScaffold';
import {
  previousEstimatePreviews,
  previewRentalEstimate,
} from '../models/RentalPriceEstimate';
import type { RentalPriceEstimationViewModel } from '../viewModels/useRentalPriceEstimationViewModel';

interface RentalPriceEstimationViewProps {
  onClose: () => void;
  viewModel: RentalPriceEstimationViewModel;
}

function EstimatorGraphic({ warning = false }: { warning?: boolean }) {
  return (
    <View style={[styles.graphic, warning && styles.graphicWarning]}>
      <View style={[styles.graphicHouse, warning && styles.graphicLineWarning]}>
        <View style={[styles.graphicRoof, warning && styles.graphicRoofWarning]} />
        <View style={[styles.graphicDoor, warning && styles.graphicFillWarning]} />
      </View>
      <View style={[styles.graphicPulse, warning && styles.graphicFillWarning]} />
      <View style={[styles.graphicPulse, styles.graphicPulseShort, warning && styles.graphicFillWarning]} />
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

function InformationCard({
  title,
  body,
  tone = 'neutral',
}: {
  title: string;
  body: string;
  tone?: 'neutral' | 'green' | 'warning';
}) {
  return (
    <View style={[styles.informationCard, styles[`${tone}InformationCard`]]}>
      <View style={styles.informationIcon}><Text style={styles.informationIconText}>i</Text></View>
      <View style={styles.informationCopy}>
        <Text style={styles.informationTitle}>{title}</Text>
        <Text style={styles.informationBody}>{body}</Text>
      </View>
    </View>
  );
}

function PreviewStateLinks({ viewModel }: { viewModel: RentalPriceEstimationViewModel }) {
  return (
    <View style={styles.previewStates}>
      <Text style={styles.previewTitle}>Frontend state previews</Text>
      <View style={styles.previewActions}>
        <Pressable accessibilityRole="button" onPress={viewModel.showUnavailablePreview}>
          <Text style={styles.previewLink}>Estimate unavailable</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={viewModel.showErrorPreview}>
          <Text style={styles.previewLink}>Estimate error</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function RentalPriceEstimationView({
  onClose,
  viewModel,
}: RentalPriceEstimationViewProps) {
  const { screen, selectedProperty } = viewModel;
  const estimate = viewModel.estimateState.data ?? {
    ...previewRentalEstimate,
    askingRent: selectedProperty?.askingRent ?? previewRentalEstimate.askingRent,
    propertyId: selectedProperty?.id ?? previewRentalEstimate.propertyId,
  };

  if (screen === 'introduction') {
    const isLandlord = viewModel.actor === 'landlord';
    return (
      <PriceEstimationScaffold
        description={
          isLandlord
            ? 'Review a data-informed rent range before setting or updating your listing price.'
            : 'Compare a property’s listed rent with a data-informed rental range before you inquire.'
        }
        eyebrow="Rental Price Estimation"
        onClose={onClose}
        title={isLandlord ? 'Price your property with context' : 'Check whether the rent is fair'}
      >
        <View style={styles.introductionHero}>
          <EstimatorGraphic />
          <Text style={styles.introductionTitle}>A practical monthly estimate</Text>
          <Text style={styles.introductionBody}>
            RENTLEASE considers property location, type, size, rooms, furnishing, parking, and amenities.
          </Text>
        </View>
        <View style={styles.featureList}>
          <DataRow label="What you receive" value="Center estimate and range" />
          <DataRow label="Comparison" value={isLandlord ? 'Estimate vs asking rent' : 'Estimate vs listed rent'} />
          <DataRow label="Coverage" value="Imus, Dasmariñas, Tagaytay" />
        </View>
        <InformationCard
          body="This is guidance, not a valuation or guarantee. Actual rent can vary with condition, demand, utilities, and lease terms."
          title="Estimate responsibly"
          tone="green"
        />
        <AppButton
          label={isLandlord ? 'Select one of my listings' : 'Select a property'}
          onPress={() => viewModel.navigate('selectProperty')}
        />
        <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('estimateInformation')}>
          <Text style={styles.centerLink}>How the estimate works</Text>
        </Pressable>
      </PriceEstimationScaffold>
    );
  }

  if (screen === 'selectProperty') {
    return (
      <PriceEstimationScaffold
        description={
          viewModel.actor === 'landlord'
            ? 'Choose a listing whose details you want to review.'
            : 'Choose the listing you want to compare with the suggested rental range.'
        }
        eyebrow="Step 1 of 2"
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Select a property"
      >
        <View style={styles.propertyList}>
          {viewModel.properties.map((property) => (
            <EstimatePropertyCard
              key={property.id}
              onPress={() => viewModel.selectProperty(property)}
              property={property}
            />
          ))}
        </View>
        <InformationCard
          body="Only local presentation records are shown. Supabase listing retrieval is not connected."
          title="Frontend preview"
        />
      </PriceEstimationScaffold>
    );
  }

  if (screen === 'propertyReview' && selectedProperty) {
    return (
      <PriceEstimationScaffold
        description="Confirm that the property details are complete and accurate before requesting guidance."
        eyebrow="Step 2 of 2"
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Review property information"
      >
        <EstimatePropertyCard onPress={() => viewModel.navigate('selectProperty')} property={selectedProperty} />
        <View style={styles.reviewCard}>
          <DataRow label="Property type" value={selectedProperty.propertyType} />
          <DataRow label="Location" value={`${selectedProperty.city}, Cavite`} />
          <DataRow label="Land area" value={selectedProperty.landArea === null ? 'Missing' : `${selectedProperty.landArea} sqm`} />
          <DataRow label="Bedrooms" value={String(selectedProperty.bedrooms)} />
          <DataRow label="Bathrooms" value={String(selectedProperty.bathrooms)} />
          <DataRow label="Parking" value={`${selectedProperty.parkingSpaces} space${selectedProperty.parkingSpaces === 1 ? '' : 's'}`} />
          <DataRow label="Furnishing" value={selectedProperty.furnished ? 'Furnished' : 'Unfurnished'} />
          <DataRow label="Amenities" value={selectedProperty.amenities.length > 0 ? selectedProperty.amenities.join(', ') : 'None provided'} />
        </View>
        {!selectedProperty.estimateAvailable ? (
          <InformationCard
            body="Land area, a valid asking rent, and basic property details are required before an estimate can be prepared."
            title="Missing required information"
            tone="warning"
          />
        ) : null}
        <AppButton
          label={selectedProperty.estimateAvailable ? 'Preview rental estimate' : 'Check estimate availability'}
          onPress={viewModel.requestEstimate}
        />
        <AppButton label="Choose another property" onPress={() => viewModel.navigate('selectProperty')} variant="secondary" />
      </PriceEstimationScaffold>
    );
  }

  if (screen === 'loading') {
    return (
      <PriceEstimationScaffold centered onBack={viewModel.goBack} onClose={onClose} title="Preparing your estimate">
        <View style={styles.loadingState}>
          <View style={styles.loadingCircle}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
          <Text style={styles.loadingTitle}>Reviewing property factors</Text>
          <Text style={styles.loadingBody}>
            Location, size, rooms, furnishing, parking, and amenities are being arranged for the result preview.
          </Text>
          <View style={styles.loadingSteps}>
            <Text style={styles.loadingStep}>Property details checked</Text>
            <Text style={styles.loadingStep}>Rental range prepared</Text>
            <Text style={styles.loadingStepMuted}>Comparison being calculated</Text>
          </View>
          <Text style={styles.localOnly}>No FastAPI request is sent in this frontend preview.</Text>
        </View>
      </PriceEstimationScaffold>
    );
  }

  if (screen === 'landlordResult') {
    return (
      <PriceEstimationScaffold
        description={`Prepared for ${selectedProperty?.title ?? 'your selected listing'}.`}
        eyebrow="Landlord estimate"
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Your rental estimate"
      >
        {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
        <EstimateHeroCard estimate={estimate} />
        <SuggestedRangeCard estimate={estimate} />
        <ComparisonSummaryCard estimate={estimate} perspective="landlord" />
        <AppButton label="Explore suggested range" onPress={() => viewModel.navigate('suggestedRange')} />
        <AppButton label="Compare my asking rent" onPress={() => viewModel.navigate('landlordComparison')} variant="secondary" />
        <View style={styles.resultLinks}>
          <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('estimateInformation')}>
            <Text style={styles.inlineLink}>Estimate information</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('estimateHistory')}>
            <Text style={styles.inlineLink}>Previous estimates</Text>
          </Pressable>
        </View>
      </PriceEstimationScaffold>
    );
  }

  if (screen === 'suggestedRange') {
    return (
      <PriceEstimationScaffold
        description="A reasonable monthly interval based on the information currently available."
        eyebrow="Estimate detail"
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Suggested rental range"
      >
        <SuggestedRangeCard estimate={estimate} />
        <SectionTitle>Factors reflected in this preview</SectionTitle>
        <View style={styles.factorList}>
          <DataRow label="Location" value={`${selectedProperty?.city ?? 'Imus'}, Cavite`} />
          <DataRow label="Property profile" value={`${selectedProperty?.propertyType ?? 'House'} · ${selectedProperty?.landArea ?? 110} sqm`} />
          <DataRow label="Rooms" value={`${selectedProperty?.bedrooms ?? 2} bed · ${selectedProperty?.bathrooms ?? 2} bath`} />
          <DataRow label="Furnishing" value={selectedProperty?.furnished ? 'Furnished' : 'Unfurnished'} />
          <DataRow label="Amenities" value={`${selectedProperty?.amenities.length ?? 0} provided`} />
        </View>
        <InformationCard
          body="The lower and upper values are guidance for comparison. They are not minimum or maximum prices enforced by RENTLEASE."
          title="About the range"
        />
        <AppButton label="View asking-rent comparison" onPress={() => viewModel.navigate('landlordComparison')} />
      </PriceEstimationScaffold>
    );
  }

  if (screen === 'landlordComparison') {
    return (
      <PriceEstimationScaffold
        description="See how your current monthly asking rent relates to the estimate."
        eyebrow="Landlord comparison"
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Asking-rent comparison"
      >
        <ComparisonSummaryCard estimate={estimate} perspective="landlord" />
        <SuggestedRangeCard estimate={estimate} />
        <InformationCard
          body="Being inside the range does not guarantee inquiries or tenancy. Property condition, included utilities, lease length, and market changes still matter."
          title="Use the comparison as guidance"
          tone="green"
        />
        <AppButton
          label="Return to estimate result"
          onPress={() => viewModel.navigate('landlordResult')}
          variant="secondary"
        />
      </PriceEstimationScaffold>
    );
  }

  if (screen === 'tenantComparison') {
    return (
      <PriceEstimationScaffold
        description={`Comparison for ${selectedProperty?.title ?? 'the selected listing'}.`}
        eyebrow="Tenant fair-rent check"
        onBack={viewModel.goBack}
        onClose={onClose}
        title="How fair is the listed rent?"
      >
        {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
        <View style={styles.fairRentBadge}>
          <View style={styles.fairRentCheck} />
          <Text style={styles.fairRentTitle}>The listed rent is within the suggested range</Text>
          <Text style={styles.fairRentBody}>It is close to the center estimate for the supplied property details.</Text>
        </View>
        <ComparisonSummaryCard estimate={estimate} perspective="tenant" />
        <SuggestedRangeCard estimate={estimate} />
        <InformationCard
          body="Ask which utilities, association dues, parking, deposits, and maintenance responsibilities are included before deciding."
          title="Review the full rental cost"
          tone="green"
        />
        <View style={styles.resultLinks}>
          <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('estimateInformation')}>
            <Text style={styles.inlineLink}>Estimate information</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('estimateHistory')}>
            <Text style={styles.inlineLink}>Dated estimate</Text>
          </Pressable>
        </View>
      </PriceEstimationScaffold>
    );
  }

  if (screen === 'estimateInformation') {
    return (
      <PriceEstimationScaffold
        description="What this feature can and cannot tell you."
        eyebrow="Estimate information"
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Understanding the estimate"
      >
        <InformationCard body="The future service will use structured property details prepared by RENTLEASE and return a center estimate with a suggested range." title="Data-informed guidance" tone="green" />
        <View style={styles.explanationList}>
          <SectionTitle>Information considered</SectionTitle>
          <Text style={styles.bullet}>Location and city</Text>
          <Text style={styles.bullet}>Property type, floor area, rooms, and parking</Text>
          <Text style={styles.bullet}>Furnishing and selected amenities</Text>
          <Text style={styles.bullet}>The available estimation model contract</Text>
        </View>
        <View style={styles.explanationList}>
          <SectionTitle>Information not guaranteed</SectionTitle>
          <Text style={styles.bullet}>Exact market value or future rental demand</Text>
          <Text style={styles.bullet}>Property condition not represented in the supplied fields</Text>
          <Text style={styles.bullet}>Utility, deposit, association, or maintenance costs</Text>
          <Text style={styles.bullet}>Approval of any rental application</Text>
        </View>
        <InformationCard
          body="This estimate is informational and should not replace an independent appraisal, legal advice, or direct negotiation between tenant and landlord."
          title="Disclaimer"
          tone="warning"
        />
        <AppButton label="View previous estimates" onPress={() => viewModel.navigate('estimateHistory')} variant="secondary" />
        <PreviewStateLinks viewModel={viewModel} />
      </PriceEstimationScaffold>
    );
  }

  if (screen === 'estimateHistory') {
    return (
      <PriceEstimationScaffold
        description="Dated results help identify when the property information was last evaluated."
        eyebrow="Estimate history"
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Previous estimates"
      >
        {previousEstimatePreviews.map((item, index) => (
          <View key={item.id} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyDate}>{item.estimatedAt}</Text>
              {index === 0 ? <Text style={styles.currentBadge}>Current</Text> : null}
            </View>
            <Text style={styles.historyValue}>{formatPhilippinePeso(item.estimatedMonthlyRent)} /mo</Text>
            <Text style={styles.historyRange}>
              Range {formatPhilippinePeso(item.suggestedMinimum)}–{formatPhilippinePeso(item.suggestedMaximum)}
            </Text>
          </View>
        ))}
        <InformationCard
          body="Dates indicate when each preview was prepared. A newer result can change when property inputs or the future model change."
          title="Estimates can change"
        />
      </PriceEstimationScaffold>
    );
  }

  if (screen === 'unavailable') {
    return (
      <PriceEstimationScaffold centered onBack={viewModel.goBack} onClose={onClose} title="Estimate unavailable">
        <View style={styles.emptyState}>
          <EstimatorGraphic warning />
          <Text style={styles.emptyTitle}>There is not enough information yet</Text>
          <Text style={styles.emptyBody}>
            Add a valid location, property type, land area, rooms, and rental price before requesting an estimate.
          </Text>
          <View style={styles.missingList}>
            <Text style={styles.missingItem}>Land area is required</Text>
            <Text style={styles.missingItem}>Asking or listed rent is required</Text>
            <Text style={styles.missingItem}>Complete property details improve the result</Text>
          </View>
        </View>
        <AppButton label="Choose another property" onPress={() => viewModel.navigate('selectProperty')} />
        <AppButton label="Back" onPress={viewModel.goBack} variant="secondary" />
      </PriceEstimationScaffold>
    );
  }

  return (
    <PriceEstimationScaffold centered onBack={viewModel.goBack} onClose={onClose} title="We couldn’t prepare the estimate">
      <View style={styles.emptyState}>
        <EstimatorGraphic warning />
        <Text style={styles.emptyTitle}>The estimator could not be reached</Text>
        <Text style={styles.emptyBody}>
          {viewModel.estimateState.status === 'error'
            ? viewModel.estimateState.error.message
            : 'Check your connection and try again.'}
        </Text>
      </View>
      <AppButton label="Retry preview" onPress={viewModel.retryEstimate} />
      <AppButton label="Review property details" onPress={() => viewModel.navigate('propertyReview')} variant="secondary" />
    </PriceEstimationScaffold>
  );
}

const styles = StyleSheet.create({
  introductionHero: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.lg },
  introductionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '900', marginTop: spacing.md, textAlign: 'center' },
  introductionBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 18, marginTop: spacing.xs, textAlign: 'center' },
  graphic: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.pill, height: 96, justifyContent: 'center', position: 'relative', width: 96 },
  graphicWarning: { backgroundColor: colors.warningSurface },
  graphicHouse: { borderColor: colors.primary, borderTopWidth: 0, borderWidth: 3, height: 35, marginLeft: -17, marginTop: 10, position: 'relative', width: 42 },
  graphicLineWarning: { borderColor: colors.warning },
  graphicRoof: { borderBottomColor: colors.primary, borderBottomWidth: 20, borderLeftColor: 'transparent', borderLeftWidth: 24, borderRightColor: 'transparent', borderRightWidth: 24, height: 0, left: -6, position: 'absolute', top: -21, width: 0 },
  graphicRoofWarning: { borderBottomColor: colors.warning },
  graphicDoor: { backgroundColor: colors.primary, bottom: 0, height: 18, left: 14, position: 'absolute', width: 10 },
  graphicFillWarning: { backgroundColor: colors.warning },
  graphicPulse: { backgroundColor: colors.primary, borderRadius: radius.pill, height: 3, position: 'absolute', right: 14, top: 38, width: 23 },
  graphicPulseShort: { top: 50, width: 15 },
  featureList: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, paddingHorizontal: spacing.md },
  dataRow: { alignItems: 'flex-start', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', minHeight: 48, paddingVertical: spacing.sm },
  dataLabel: { color: colors.textSecondary, flex: 1, fontFamily: typography.family, fontSize: 12 },
  dataValue: { color: colors.text, flex: 1.3, fontFamily: typography.family, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  informationCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  neutralInformationCard: {},
  greenInformationCard: { backgroundColor: colors.primaryPale, borderColor: colors.trustedBorder },
  warningInformationCard: { backgroundColor: colors.warningSurface, borderColor: '#E7C78E' },
  informationIcon: { alignItems: 'center', borderColor: colors.textSecondary, borderRadius: radius.pill, borderWidth: 1.5, height: 22, justifyContent: 'center', width: 22 },
  informationIconText: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, fontWeight: '900' },
  informationCopy: { flex: 1, gap: spacing.xxs },
  informationTitle: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '900' },
  informationBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16 },
  centerLink: { color: colors.primary, fontFamily: typography.family, fontSize: 12, fontWeight: '800', textAlign: 'center', textDecorationLine: 'underline' },
  propertyList: { gap: spacing.sm },
  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: spacing.md },
  loadingState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  loadingCircle: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.pill, height: 110, justifyContent: 'center', width: 110 },
  loadingTitle: { color: colors.text, fontFamily: typography.family, fontSize: 19, fontWeight: '900', marginTop: spacing.sm },
  loadingBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 18, maxWidth: 300, textAlign: 'center' },
  loadingSteps: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.md, gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  loadingStep: { color: colors.primary, fontFamily: typography.family, fontSize: 11, fontWeight: '800' },
  loadingStepMuted: { color: colors.textMuted, fontFamily: typography.family, fontSize: 11, fontWeight: '800' },
  localOnly: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, marginTop: spacing.xs, textAlign: 'center' },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 15, padding: spacing.sm },
  resultLinks: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.xs },
  inlineLink: { color: colors.primary, fontFamily: typography.family, fontSize: 11, fontWeight: '800', textDecorationLine: 'underline' },
  sectionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '900' },
  factorList: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: spacing.md },
  fairRentBadge: { alignItems: 'center', backgroundColor: colors.primaryPale, borderColor: colors.trustedBorder, borderRadius: radius.card, borderWidth: 1, padding: spacing.lg },
  fairRentCheck: { borderBottomColor: colors.primary, borderBottomWidth: 3, borderRightColor: colors.primary, borderRightWidth: 3, height: 18, transform: [{ rotate: '45deg' }], width: 10 },
  fairRentTitle: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '900', marginTop: spacing.md, textAlign: 'center' },
  fairRentBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16, marginTop: spacing.xs, textAlign: 'center' },
  explanationList: { backgroundColor: colors.surface, borderRadius: radius.card, gap: spacing.sm, padding: spacing.md },
  bullet: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16, paddingLeft: spacing.sm },
  previewStates: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.sm, marginTop: spacing.sm, paddingTop: spacing.md },
  previewTitle: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' },
  previewActions: { flexDirection: 'row', justifyContent: 'space-around' },
  previewLink: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, textDecorationLine: 'underline' },
  historyCard: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  historyHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  historyDate: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  currentBadge: { backgroundColor: colors.primaryPale, borderRadius: radius.pill, color: colors.primary, fontFamily: typography.family, fontSize: 9, fontWeight: '900', paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  historyValue: { color: colors.text, fontFamily: typography.family, fontSize: 22, fontWeight: '900' },
  historyRange: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11 },
  emptyState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  emptyTitle: { color: colors.text, fontFamily: typography.family, fontSize: 19, fontWeight: '900', marginTop: spacing.sm, textAlign: 'center' },
  emptyBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 18, maxWidth: 310, textAlign: 'center' },
  missingList: { alignSelf: 'stretch', backgroundColor: colors.warningSurface, borderRadius: radius.md, gap: spacing.xs, marginTop: spacing.sm, padding: spacing.md },
  missingItem: { color: colors.warning, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
});
