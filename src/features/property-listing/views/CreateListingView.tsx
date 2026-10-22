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

function CameraMark() {
  return (
    <View style={styles.camera}>
      <View style={styles.cameraTop} />
      <View style={styles.cameraLens} />
    </View>
  );
}

function SaveDraftAction({ viewModel }: { viewModel: PropertyListingViewModel }) {
  return <ListingButton label="Save as draft" onPress={viewModel.saveDraft} tone="outline" />;
}

export function CreateListingView({ viewModel, onClose }: CreateListingViewProps) {
  const { screen, draft } = viewModel;

  if (screen === 'postingType') {
    return (
      <ScrollView contentContainerStyle={styles.postingScreen} showsVerticalScrollIndicator={false}>
        <FeedbackNotice message="Local draft preview only. This does not create a backend property ID. Real Tier 3 verification needs a saved property record." />
        <Pressable
          accessibilityLabel="Close posting selection"
          accessibilityRole="button"
          hitSlop={12}
          onPress={viewModel.goBack}
          style={styles.postingClose}
        >
          <View style={[styles.postingCloseLine, styles.postingCloseLineOne]} />
          <View style={[styles.postingCloseLine, styles.postingCloseLineTwo]} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.postingTitle}>What are you posting?</Text>
        <View style={styles.postingChoices}>
          <Pressable
            accessibilityRole="button"
            onPress={() => viewModel.navigate('photoUpload')}
            style={({ pressed }) => [styles.postingChoice, pressed && styles.pressed]}
          >
            <Text style={styles.postingLabel}>A Listing</Text>
            <View style={styles.homeMark}>
              <View style={styles.homeRoof} />
              <View style={styles.homeBody} />
            </View>
          </Pressable>
          <View style={[styles.postingChoice, styles.postingChoiceDisabled]}>
            <Text style={styles.postingLabel}>A Community Post</Text>
            <View style={styles.peopleMark}>
              <View style={styles.personDot} />
              <View style={styles.personDot} />
              <View style={styles.personDot} />
            </View>
            <Text style={styles.disabledCopy}>(no function yet)</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (screen === 'photoUpload') {
    return (
      <ListingWizardScaffold
        onBack={viewModel.goBack}
        onClose={onClose}
        onNext={() => viewModel.navigate('photoManager')}
        step={1}
        stepLabel="Photos"
        title="Add Photos or videos to your listing."
      >
        <Pressable
          accessibilityRole="button"
          onPress={viewModel.selectSamplePhotos}
          style={({ pressed }) => [styles.photoPicker, pressed && styles.pressed]}
        >
          <CameraMark />
          <Text style={styles.photoPickerLabel}>
            {draft.photoCount > 0 ? `${draft.photoCount} local samples selected` : 'Add Photos/videos'}
          </Text>
          <Text style={styles.localOnly}>Local preview only · no upload</Text>
        </Pressable>
        {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
        <ListingButton
          label={draft.photoCount > 0 ? 'Manage selected photos' : 'Continue without photos'}
          onPress={() => viewModel.navigate('photoManager')}
          tone="dark"
        />
        <SaveDraftAction viewModel={viewModel} />
      </ListingWizardScaffold>
    );
  }

  if (screen === 'photoManager') {
    const crops = [
      { x: 14, y: 154, width: 44, height: 33 },
      { x: 61, y: 154, width: 44, height: 33 },
      { x: 108, y: 154, width: 44, height: 33 },
      { x: 155, y: 154, width: 44, height: 33 },
    ];
    return (
      <ListingWizardScaffold
        onBack={viewModel.goBack}
        onClose={onClose}
        onNext={() => viewModel.navigate('basicInfo')}
        step={1}
        stepLabel="Photos"
        title="Choose your cover photo"
        description="The cover photo appears first in search results and listing details."
      >
        {draft.photoCount > 0 ? (
          <>
            <FigmaReferenceCrop borderRadius={radius.md} crop={{ x: 2, y: 2, width: 225, height: 132 }} />
            <View style={styles.thumbnailRow}>
              {crops.map((crop, index) => (
                <Pressable
                  accessibilityLabel={`Select photo ${index + 1} as cover`}
                  key={`${crop.x}-${crop.y}`}
                  onPress={() => viewModel.selectCoverPhoto(index)}
                  style={[styles.thumbnail, draft.coverPhotoIndex === index && styles.thumbnailSelected]}
                >
                  <FigmaReferenceCrop crop={crop} />
                  {draft.coverPhotoIndex === index ? <Text style={styles.coverLabel}>Cover</Text> : null}
                </Pressable>
              ))}
            </View>
            <ListingButton label="Remove local samples" onPress={viewModel.removeSamplePhotos} tone="outline" />
          </>
        ) : (
          <SectionCard>
            <Text style={styles.sectionTitle}>No photos selected</Text>
            <Text style={styles.sectionCopy}>You can continue and resolve this requirement before publishing.</Text>
            <ListingButton label="Select Figma samples" onPress={viewModel.selectSamplePhotos} />
          </SectionCard>
        )}
        <ListingButton label="Continue to property details" onPress={() => viewModel.navigate('basicInfo')} tone="dark" />
        <SaveDraftAction viewModel={viewModel} />
      </ListingWizardScaffold>
    );
  }

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
          <Text style={styles.completion}>{draft.amenities.length === amenities.length ? '100% complete' : `${draft.amenities.length} selected`}</Text>
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
        <Text style={styles.localOnly}>Additional amenity catalog is not connected yet.</Text>
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
        <ListingField
          label="Advance payment and deposit"
          onChangeText={(value) => viewModel.updateDraft('advancePayment', value)}
          placeholder="e.g. 1 month advance + 2 months deposit"
          value={draft.advancePayment}
        />
        <View style={styles.priceEstimate}>
          <Text style={styles.estimateEyebrow}>Suggested rent range price</Text>
          <Text style={styles.estimateRange}>₱28,000 – ₱38,000 / mo</Text>
          <Text style={styles.estimateLabel}>Suggested Exact Price</Text>
          <Text style={styles.estimatePrice}>₱32,000 / mo</Text>
          <Text style={styles.estimateSource}>Suggestion by RentLease</Text>
        </View>
        <ListingButton
          label="Yes, use suggested price"
          onPress={() => viewModel.updateDraft('askingRent', '32,000')}
          tone="dark"
        />
        <ListingButton label="No thanks, I have my own" onPress={() => undefined} tone="dark" />
        <ListingField
          keyboardType="numeric"
          label="Asking Rent"
          onChangeText={(value) => viewModel.updateDraft('askingRent', value.replace(/[^0-9,]/g, ''))}
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
      description="Use a readable date for this frontend preview. A native date picker can replace this boundary later."
    >
      <ListingField
        label="Availability date"
        onChangeText={(value) => viewModel.updateDraft('availableDate', value)}
        placeholder="e.g. September 15, 2026"
        value={draft.availableDate}
      />
      <ListingButton label="Preview listing" onPress={() => viewModel.navigate('preview')} tone="dark" />
      <SaveDraftAction viewModel={viewModel} />
    </ListingWizardScaffold>
  );
}

const styles = StyleSheet.create({
  postingScreen: { flexGrow: 1, paddingBottom: spacing.xl, paddingHorizontal: 18 },
  postingClose: { height: 34, justifyContent: 'center', marginTop: 17, width: 34 },
  postingCloseLine: { backgroundColor: colors.textMuted, height: 2, left: 5, opacity: 0.55, position: 'absolute', width: 24 },
  postingCloseLineOne: { transform: [{ rotate: '45deg' }] },
  postingCloseLineTwo: { transform: [{ rotate: '-45deg' }] },
  postingTitle: { color: colors.text, fontFamily: typography.family, fontSize: 48, fontWeight: '900', letterSpacing: -1.4, lineHeight: 52, marginTop: 126, maxWidth: 376 },
  postingChoices: { flexDirection: 'row', gap: 10, marginTop: 38 },
  postingChoice: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    aspectRatio: 183 / 299,
    padding: spacing.sm,
    paddingTop: 70,
  },
  postingChoiceDisabled: { opacity: 0.42 },
  postingLabel: { color: colors.text, fontFamily: typography.family, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  disabledCopy: { color: colors.textMuted, fontFamily: typography.family, fontSize: 11, marginTop: 'auto', textAlign: 'center' },
  homeMark: { height: 57, marginTop: 46, width: 57 },
  homeRoof: { borderBottomColor: colors.border, borderBottomWidth: 3, borderLeftColor: 'transparent', borderLeftWidth: 25, borderRightColor: 'transparent', borderRightWidth: 25, height: 0, width: 0 },
  homeBody: { alignSelf: 'center', borderColor: colors.border, borderWidth: 3, height: 30, width: 38 },
  peopleMark: { flexDirection: 'row', gap: spacing.xxs, marginTop: 46 },
  personDot: { backgroundColor: colors.border, borderRadius: radius.pill, height: 22, width: 22 },
  photoPicker: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1.5, height: 270, justifyContent: 'center' },
  camera: { borderColor: colors.textMuted, borderRadius: 3, borderWidth: 2, height: 34, justifyContent: 'center', width: 44 },
  cameraTop: { alignSelf: 'center', borderColor: colors.textMuted, borderBottomWidth: 2, height: 5, marginTop: -8, width: 16 },
  cameraLens: { alignSelf: 'center', borderColor: colors.textMuted, borderRadius: radius.pill, borderWidth: 2, height: 12, width: 12 },
  photoPickerLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, marginTop: spacing.md },
  localOnly: { color: colors.textMuted, fontFamily: typography.family, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 17, padding: spacing.sm },
  thumbnailRow: { flexDirection: 'row', gap: spacing.xs },
  thumbnail: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 2, flex: 1, overflow: 'hidden', position: 'relative' },
  thumbnailSelected: { borderColor: colors.primary },
  coverLabel: { backgroundColor: colors.primary, bottom: 0, color: colors.white, fontFamily: typography.family, fontSize: 8, fontWeight: '700', left: 0, paddingHorizontal: spacing.xs, paddingVertical: 2, position: 'absolute' },
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
