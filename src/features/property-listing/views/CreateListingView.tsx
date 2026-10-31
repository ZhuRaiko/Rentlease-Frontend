import { AvailabilityDateField } from '../components/AvailabilityDateField';
import { rentalTermOptions } from '../models/PersistedListingDraft';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { PropertyPhotosView } from './PropertyPhotosView';
import { PropertySetupView } from './PropertySetupView';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { FigmaReferenceCrop } from '../components/FigmaReferenceCrop';
import { ListingButton } from '../components/ListingButton';
import { ChoiceChip, CounterRow, ListingField, SectionCard } from '../components/ListingControls';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { amenities, propertyRules, propertyTypes } from '../models/PropertyListing';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

interface CreateListingViewProps {
  viewModel: PropertyListingViewModel;
  onClose: () => void;
}

function SaveDraftAction({ viewModel }: { viewModel: PropertyListingViewModel }) {
  return <ListingButton label={viewModel.saveDraftLabel} disabled={viewModel.listingDraftState.busy} onPress={() => void viewModel.saveDraft()} tone="outline" />;
}

export function CreateListingView({ viewModel, onClose }: CreateListingViewProps) {
  const { screen, draft } = viewModel;

  if (screen === 'propertySetup') return <PropertySetupView viewModel={viewModel} onClose={onClose} />;

  if (screen === 'postingType') {
    return (
      <View style={styles.postingRoot}>
      <ScreenHeader title="Create" onClose={onClose} />
      <ScrollView contentContainerStyle={styles.postingScreen} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.postingTitle}>What would you like to post?</Text>
        <View style={styles.postingChoices}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Property Listing. List a property for rent"
            disabled={viewModel.propertyState.busy}
            accessibilityState={{ disabled: viewModel.propertyState.busy }}
            onPress={viewModel.beginPropertySetup}
            style={({ pressed }) => [styles.postingChoice, pressed && styles.pressed]}
          >
            <Text style={styles.postingLabel}>Property Listing</Text>
            <Text style={styles.postingOptionCopy}>List a property for rent</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Community Post. Share with the RentLease community. Coming soon" accessibilityState={{disabled:true}} disabled style={[styles.postingChoice, styles.postingChoiceDisabled]}>
            <Text style={styles.postingLabel}>Community Post</Text>
            <Text style={styles.postingOptionCopy}>Share with the RentLease community</Text>
            <Text style={styles.disabledCopy}>Coming soon</Text>
          </Pressable>
        </View>
      </ScrollView>
      </View>
    );
  }

  if (screen === 'photoUpload' || screen === 'photoManager') return <PropertyPhotosView viewModel={viewModel} onClose={onClose} />;

  if (screen === 'basicInfo') {
    return (
      <ListingWizardScaffold
        {...(viewModel.isEditing ? { title: 'Edit listing details' } : {})}
        onBack={viewModel.goBack}
        onClose={onClose}
        onNext={() => viewModel.navigate('specifications')}
        step={2}
        stepLabel="Details"
      >
        <ListingField
          label="Listing Title"
          onChangeText={(value) => viewModel.updateDraft('title', value)}
          placeholder="e.g. 2BR House in Imus near SM"
          value={draft.title}
        />
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldTitle}>Property type</Text>
          <View style={styles.chips}>
            {propertyTypes.map((propertyType) => (
              <ChoiceChip
                key={propertyType}
                label={propertyType}
                onPress={() => viewModel.choosePropertyType(propertyType)}
                selected={draft.propertyType === propertyType}
              />
            ))}
          </View>
        </View>
        <ListingField
          label="Description"
          multiline
          onChangeText={(value) => viewModel.updateDraft('description', value)}
          placeholder="What makes this place special?"
          value={draft.description}
        />
        <View style={styles.furnishingRow}>
          <Text style={styles.fieldTitle}>Furnishing status</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: draft.furnished }}
            onPress={viewModel.toggleFurnished}
            style={styles.furnishedChoice}
          >
            <View style={[styles.checkbox, draft.furnished && styles.checkboxSelected]}>
              {draft.furnished ? <View style={styles.checkMark} /> : null}
            </View>
            <Text style={styles.furnishedLabel}>Furnished</Text>
          </Pressable>
        </View>
        <ListingButton label="Continue" onPress={() => viewModel.navigate('specifications')} tone="dark" />
        <SaveDraftAction viewModel={viewModel} />
      </ListingWizardScaffold>
    );
  }

  if (screen === 'specifications') {
    return (
      <ListingWizardScaffold
        onBack={viewModel.goBack}
        onClose={onClose}
        onNext={() => viewModel.navigate('amenities')}
        step={3}
        stepLabel="Amenities and Unit Specifications"
        title="Unit specifications"
      >
        <View style={styles.chips}>
          {['Land Area', 'Bedrooms', 'Bathrooms', 'Floors', 'Kitchen'].map((item) => (
            <ChoiceChip key={item} label={item} onPress={() => undefined} selected />
          ))}
        </View>
        <ListingField
          keyboardType="numeric"
          label="Land Area (sqm)"
          onChangeText={(value) => viewModel.updateDraft('landArea', value.replace(/[^0-9.]/g, ''))}
          placeholder="e.g. 430"
          value={draft.landArea}
        />
        <CounterRow
          label="Bedrooms"
          onDecrease={() => viewModel.changeCounter('bedrooms', -1)}
          onIncrease={() => viewModel.changeCounter('bedrooms', 1)}
          value={draft.bedrooms}
        />
        <CounterRow
          label="Bathrooms"
          onDecrease={() => viewModel.changeCounter('bathrooms', -1)}
          onIncrease={() => viewModel.changeCounter('bathrooms', 1)}
          value={draft.bathrooms}
        />
        <CounterRow
          label="Parking Spaces"
          onDecrease={() => viewModel.changeCounter('parkingSpaces', -1)}
          onIncrease={() => viewModel.changeCounter('parkingSpaces', 1)}
          value={draft.parkingSpaces}
        />
        <ListingButton label="Choose amenities" onPress={() => viewModel.navigate('amenities')} tone="dark" />
        <SaveDraftAction viewModel={viewModel} />
      </ListingWizardScaffold>
    );
  }

  if (screen === 'amenities') {
    return (
      <ListingWizardScaffold
        onBack={viewModel.goBack}
        onClose={onClose}
        onNext={() => viewModel.navigate('address')}
        step={3}
        stepLabel="Amenities and Unit Specifications"
        title="Amenities"
        description="Select everything currently available at the property."
      >
        <View style={styles.completionRow}>
          <Text style={styles.sectionTitle}>Included amenities</Text>
          <Text style={styles.completion}>{`${draft.amenities.length} sample choices selected`}</Text>
        </View>
        <View style={styles.chips}>
          {amenities.map((amenity) => (
            <ChoiceChip
              key={amenity}
              label={amenity}
              onPress={() => viewModel.toggleAmenity(amenity)}
              selected={draft.amenities.includes(amenity)}
              tone="orange"
            />
          ))}
        </View>
        <ListingButton label="Add More Amenities" onPress={() => undefined} tone="orange" />
        <Text style={styles.localOnly}>Legacy sample choices are local only. Real property creation uses the live amenity catalogue.</Text>
        <ListingButton label="Continue to location" onPress={() => viewModel.navigate('address')} tone="dark" />
        <SaveDraftAction viewModel={viewModel} />
      </ListingWizardScaffold>
    );
  }

  if (screen === 'address') {
    return (
      <ListingWizardScaffold
        onBack={viewModel.goBack}
        onClose={onClose}
        onNext={() => viewModel.navigate('mapConfirm')}
        step={4}
        stepLabel="Location"
      >
        <FigmaReferenceCrop borderRadius={radius.sm} crop={{ x: 14, y: 576, width: 199, height: 131 }} />
        <ListingField
          helper="You can search an address manually if MapTiler is connected later."
          label="Address"
          onChangeText={(value) => viewModel.updateDraft('address', value)}
          placeholder="Brgy. Alapan II-B, Imus, Cavite"
          value={draft.address}
        />
        <Text style={styles.localOnly}>Static Figma map preview · geocoding is not connected.</Text>
        <ListingButton label="Review map pin" onPress={() => viewModel.navigate('mapConfirm')} tone="dark" />
        <SaveDraftAction viewModel={viewModel} />
      </ListingWizardScaffold>
    );
  }

  if (screen === 'mapConfirm') {
    return (
      <ListingWizardScaffold
        onBack={viewModel.goBack}
        onClose={onClose}
        step={4}
        stepLabel="Location"
        title="Confirm property pin"
        description="Check that the pin represents the property entrance before continuing."
      >
        <View style={styles.mapShell}>
          <FigmaReferenceCrop crop={{ x: 14, y: 576, width: 199, height: 131 }} />
          <View style={styles.pinPulse}><View style={styles.pinCore} /></View>
        </View>
        <SectionCard>
          <Text style={styles.sectionTitle}>{draft.address || 'Brgy. Alapan II-B, Imus, Cavite, Philippines'}</Text>
          <Text style={styles.sectionCopy}>Pin movement and coordinates remain local until the approved map renderer is installed.</Text>
        </SectionCard>
        <ListingButton label="Confirm Location" onPress={viewModel.confirmPin} tone="dark" />
      </ListingWizardScaffold>
    );
  }

  if (screen === 'rentTerms') {
    return (
      <ListingWizardScaffold
        onBack={viewModel.goBack}
        onClose={onClose}
        onNext={() => viewModel.navigate('description')}
        step={5}
        stepLabel="Pricing"
        title="Payment terms"
      >
        <ListingField required label="Listing title" placeholder="Describe the rental space" value={draft.title} onChangeText={value => viewModel.updateDraft('title', value)} />
        <Text style={styles.fieldTitle}>Rental term</Text>
        <View style={styles.chips}>{rentalTermOptions.map(option => <ChoiceChip key={option.value} label={option.label} selected={draft.rentalTerm === option.value} onPress={() => viewModel.updateDraft('rentalTerm', option.value)} />)}</View>
        <ListingField label="Security deposit (months)" placeholder="1" keyboardType="numeric" value={draft.securityDepositMonths} onChangeText={value => viewModel.updateDraft('securityDepositMonths', value)} />
        <ListingField label="Advance rent (months)" placeholder="1" keyboardType="numeric" value={draft.advanceRentMonths} onChangeText={value => viewModel.updateDraft('advanceRentMonths', value)} />
        <ListingField label="Minimum stay (months, optional)" placeholder="Leave blank if not specified" keyboardType="numeric" value={draft.minimumStayMonths} onChangeText={value => viewModel.updateDraft('minimumStayMonths', value)} />
        <FeedbackNotice message="Price estimates are not connected here. Enter your own monthly asking rent." />
        <ListingField
          keyboardType="numeric"
          required
          label="Asking Rent"
          onChangeText={(value) => viewModel.updateDraft('askingRent', value)}
          placeholder="Enter amount"
          prefix="₱"
          value={draft.askingRent}
        />
        <ListingButton label="Continue" onPress={() => viewModel.navigate('description')} tone="dark" />
        <SaveDraftAction viewModel={viewModel} />
      </ListingWizardScaffold>
    );
  }

  if (screen === 'description') {
    return (
      <ListingWizardScaffold
        onBack={viewModel.goBack}
        onClose={onClose}
        step={5}
        stepLabel="Listing Description"
        title="Describe your property"
        description="Help prospective tenants understand the space and what makes it a good home."
      >
        <ListingField
          label="Listing description"
          multiline
          onChangeText={(value) => viewModel.updateDraft('description', value)}
          placeholder="Describe the layout, nearby places, and ideal tenant."
          value={draft.description}
        />
        <ListingButton label="Continue to property rules" onPress={() => viewModel.navigate('rules')} tone="dark" />
        <SaveDraftAction viewModel={viewModel} />
      </ListingWizardScaffold>
    );
  }

  if (screen === 'rules') {
    return (
      <ListingWizardScaffold
        onBack={viewModel.goBack}
        onClose={onClose}
        step={5}
        stepLabel="Property Rules"
        title="Set property rules"
      >
        <View style={styles.ruleList}>
          {propertyRules.map((rule) => (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draft.rules.includes(rule) }}
              key={rule}
              onPress={() => viewModel.toggleRule(rule)}
              style={styles.ruleRow}
            >
              <View style={[styles.checkbox, draft.rules.includes(rule) && styles.checkboxSelected]}>
                {draft.rules.includes(rule) ? <View style={styles.checkMark} /> : null}
              </View>
              <Text style={styles.ruleLabel}>{rule}</Text>
            </Pressable>
          ))}
        </View>
        <ListingField label="House rules (optional)" placeholder="Add any rules for the rental" multiline value={draft.houseRules} onChangeText={value => viewModel.updateDraft('houseRules', value)} />
        <ListingButton label="Continue to availability" onPress={() => viewModel.navigate('availability')} tone="dark" />
        <SaveDraftAction viewModel={viewModel} />
      </ListingWizardScaffold>
    );
  }

  return (
    <ListingWizardScaffold
      onBack={viewModel.goBack}
      onClose={onClose}
      step={5}
      stepLabel="Availability"
      title="When is the property available?"
      description="Choose a date, or leave it unset until it is known."
    >
      <AvailabilityDateField value={draft.availableDate} onChange={(value) => viewModel.updateDraft('availableDate', value)} />
      <ListingButton label="Preview listing" onPress={() => viewModel.navigate('preview')} tone="dark" />
      <SaveDraftAction viewModel={viewModel} />
    </ListingWizardScaffold>
  );
}

const styles = StyleSheet.create({
  postingRoot: { flex: 1 },
  postingScreen: { flexGrow: 1, padding: spacing.lg },
  postingClose: { height: 34, justifyContent: 'center', marginTop: 17, width: 34 },
  postingCloseLine: { backgroundColor: colors.textMuted, height: 2, left: 5, opacity: 0.55, position: 'absolute', width: 24 },
  postingCloseLineOne: { transform: [{ rotate: '45deg' }] },
  postingCloseLineTwo: { transform: [{ rotate: '-45deg' }] },
  postingTitle: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '700', lineHeight: 32 },
  postingChoices: { gap: spacing.md, marginTop: spacing.lg },
  postingChoice: {
    alignItems: 'flex-start',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  postingChoiceDisabled: { backgroundColor: colors.surface },
  postingLabel: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '700' },
  postingOptionCopy: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight:21 },
  disabledCopy: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, fontWeight:'600', marginTop: spacing.xs },
  homeMark: { height: 57, marginTop: 46, width: 57 },
  homeRoof: { borderBottomColor: colors.border, borderBottomWidth: 3, borderLeftColor: 'transparent', borderLeftWidth: 25, borderRightColor: 'transparent', borderRightWidth: 25, height: 0, width: 0 },
  homeBody: { alignSelf: 'center', borderColor: colors.border, borderWidth: 3, height: 30, width: 38 },
  peopleMark: { flexDirection: 'row', gap: spacing.xxs, marginTop: 46 },
  personDot: { backgroundColor: colors.border, borderRadius: radius.pill, height: 22, width: 22 },
  localOnly: { color: colors.textMuted, fontFamily: typography.family, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 17, padding: spacing.sm },
  sectionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '800' },
  sectionCopy: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19 },
  fieldGroup: { gap: spacing.sm },
  fieldTitle: { color: colors.text, fontFamily: typography.family, fontSize: 17, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  furnishingRow: { gap: spacing.sm },
  furnishedChoice: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  furnishedLabel: { color: colors.text, fontFamily: typography.family, fontSize: 14 },
  checkbox: { alignItems: 'center', borderColor: colors.textSecondary, borderRadius: 4, borderWidth: 1.5, height: 22, justifyContent: 'center', width: 22 },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { borderBottomColor: colors.white, borderBottomWidth: 2, borderRightColor: colors.white, borderRightWidth: 2, height: 10, transform: [{ rotate: '45deg' }], width: 6 },
  completionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  completion: { color: colors.primary, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  mapShell: { borderRadius: radius.sm, overflow: 'hidden', position: 'relative' },
  pinPulse: { alignItems: 'center', backgroundColor: 'rgba(33,150,243,0.22)', borderRadius: radius.pill, height: 38, justifyContent: 'center', left: '46%', position: 'absolute', top: '42%', width: 38 },
  pinCore: { backgroundColor: '#2196F3', borderColor: colors.white, borderRadius: radius.pill, borderWidth: 3, height: 18, width: 18 },
  priceEstimate: { backgroundColor: '#ECFFF0', borderColor: '#70D788', borderRadius: radius.card, borderWidth: 1.5, gap: spacing.xs, padding: spacing.md },
  estimateEyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  estimateRange: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '800' },
  estimateLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, marginTop: spacing.sm },
  estimatePrice: { color: colors.text, fontFamily: typography.family, fontSize: 28, fontWeight: '800' },
  estimateSource: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, textAlign: 'right' },
  ruleList: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  ruleRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 58, paddingHorizontal: spacing.md },
  ruleLabel: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
