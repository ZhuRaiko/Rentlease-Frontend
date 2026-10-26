import { PropertyLocationMapView } from './PropertyLocationMapView';
import { formatVerificationDate } from '../../../shared/utils/formatVerificationDate';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { ListingField, ChoiceChip } from '../components/ListingControls';
import { ListingButton } from '../components/ListingButton';
import { draftPropertyError, hasConfirmedPropertyLocation, propertyLocationNotice, furnishingOptions, propertyCityOptions, propertyTypeOptions } from '../models/DraftProperty';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

export function PropertySetupView({ viewModel: vm, onClose }: { viewModel: PropertyListingViewModel; onClose: () => void }) {
  const state = vm.propertyState;
  const flow = vm.propertyCreation;
  const d = state.draft;
  const location = vm.locationState;
  const locationFlow = vm.propertyLocation;
  const token = locationFlow.generationToken();
  if (state.step === 'address' && location.stage === 'map' && location.workingPoint && location.selected && location.styleUrl) return <PropertyLocationMapView key={token} styleUrl={location.styleUrl} point={location.workingPoint} initialPoint={location.selected} ready={location.mapReady} error={location.error} onMove={point => locationFlow.movePoint(point, token)} onLoaded={() => locationFlow.mapLoaded(token)} onFailed={() => locationFlow.mapFailed(token)} onCancel={locationFlow.cancel} onConfirm={() => locationFlow.confirmExact(token)} />;
  if (state.step === 'address' && (location.stage === 'searching' || location.stage === 'candidates')) return <ListingWizardScaffold title="Find your property" description="Search the address, then choose a result to adjust its exact pin." onBack={locationFlow.cancel} onClose={onClose}>
    <ListingField label="Property address search" placeholder="Street, barangay and city" value={location.query} onChangeText={locationFlow.updateQuery} />
    <ListingButton label={location.busy ? 'Search again' : 'Search address'} onPress={() => void locationFlow.search()} />
    <FeedbackNotice message={location.error} tone="error" />
    {location.busy ? <Text accessibilityLiveRegion="polite" style={styles.copy}>Searching locations...</Text> : null}
    {!location.busy && !location.error && !location.candidates.length ? <Text style={styles.copy}>No locations found. Check the address and search again.</Text> : null}
    {location.candidates.map(candidate => <ListingButton key={candidate.id} label={candidate.label} tone="outline" onPress={() => locationFlow.chooseCandidate(candidate.id, token)} />)}
    <ListingButton label="Cancel" tone="outline" onPress={locationFlow.cancel} />
  </ListingWizardScaffold>;
  const title = state.step === 'details' ? 'Your physical property' : state.step === 'address' ? 'Where is the property?' : state.step === 'created' ? 'Property confirmed' : 'Review property setup';
  return <ListingWizardScaffold title={title} onBack={vm.goBack} onClose={onClose} description="Property setup is separate from a rental listing. Tier 3 approval is not needed to add a property.">
    <FeedbackNotice message={state.error} tone="error" />
    {state.busy ? <Text accessibilityLiveRegion="polite" style={styles.copy}>Please wait. Checking your property setup...</Text> : null}
    {!state.loaded && !state.uncertain && !state.busy ? <ListingButton label="Retry setup check" onPress={() => void flow.initialize()} /> : null}
    {state.step === 'details' ? <>
      <Text accessibilityRole="header" style={styles.heading}>Property type</Text>
      <View style={styles.choices}>{propertyTypeOptions.map(o => <ChoiceChip key={o.value} label={o.label} selected={d.propertyType === o.value} onPress={() => flow.updateField('propertyType', o.value)} />)}</View>
      <View style={styles.fields}>
        <View style={styles.cell}><ListingField label="Bedrooms" placeholder="0" keyboardType="numeric" value={d.bedrooms} onChangeText={v => flow.updateField('bedrooms', v)} /></View>
        <View style={styles.cell}><ListingField label="Bathrooms" placeholder="0" keyboardType="numeric" value={d.bathrooms} onChangeText={v => flow.updateField('bathrooms', v)} /></View>
      </View>
      <ListingField label="Floor area (sqm, optional)" placeholder="Floor area, not land area" keyboardType="numeric" value={d.floorAreaSqm} onChangeText={v => flow.updateField('floorAreaSqm', v)} />
      <View style={styles.fields}>
        <View style={styles.cell}><ListingField label="Floor number (optional)" placeholder="0" keyboardType="numeric" value={d.floorNumber} onChangeText={v => flow.updateField('floorNumber', v)} /></View>
        <View style={styles.cell}><ListingField label="Total floors (optional)" placeholder="1" keyboardType="numeric" value={d.totalFloors} onChangeText={v => flow.updateField('totalFloors', v)} /></View>
      </View>
      <ListingField label="Maximum occupants (optional)" placeholder="Number of people" keyboardType="numeric" value={d.maxOccupants} onChangeText={v => flow.updateField('maxOccupants', v)} />
      <Text accessibilityRole="header" style={styles.heading}>Furnishing</Text>
      <View style={styles.choices}>{furnishingOptions.map(o => <ChoiceChip key={o.value} label={o.label} selected={d.furnishingStatus === o.value} onPress={() => flow.updateField('furnishingStatus', o.value)} />)}</View>
      <FeedbackNotice message="Amenities are not saved in this phase. Photos can be managed after the property is saved. No rental listing will be created." />
      <ListingButton disabled={!state.loaded || state.busy} label="Continue to address" onPress={flow.next} />
    </> : null}
    {state.step === 'address' ? <>
      <Text accessibilityRole="header" style={styles.heading}>City</Text>
      <View style={styles.choices}>{propertyCityOptions.map(o => <ChoiceChip key={o.value} label={o.label} selected={d.city === o.value} onPress={() => flow.updateField('city', o.value)} />)}</View>
      <ListingField label="Barangay" placeholder="Barangay" value={d.barangay} onChangeText={v => flow.updateField('barangay', v)} />
      <ListingField label="Address line 1" placeholder="House/unit number and street" value={d.addressLine1} onChangeText={v => flow.updateField('addressLine1', v)} />
      <ListingField label="Address line 2 (optional)" placeholder="Building, subdivision or other details" value={d.addressLine2} onChangeText={v => flow.updateField('addressLine2', v)} />
      <ListingField label="Postal code (optional)" placeholder="Postal code" value={d.postalCode} onChangeText={v => flow.updateField('postalCode', v)} />
      <ListingField label="Access instructions (private, optional)" placeholder="How to find the entrance" multiline value={d.accessInstructions} onChangeText={v => flow.updateField('accessInstructions', v)} />
      <FeedbackNotice message={propertyLocationNotice} />
      <ListingButton disabled={state.busy || !state.loaded || !d.city || !d.barangay.trim() || !d.addressLine1.trim()} label={location.confirmedPoint ? 'Review exact location on map' : 'Find and confirm location'} tone="outline" onPress={vm.openPropertyLocation} />
      <Text style={styles.copy}>Exact location: {location.confirmedPoint ? 'Confirmed on map' : 'Not confirmed yet'}</Text>
      <Text style={styles.copy}>Public map point is still awaiting the approved privacy rule.</Text>
      <ListingButton disabled={state.busy} label="Review property" onPress={flow.next} />
    </> : null}
    {state.step === 'review' ? <>
      {!state.uncertain ? <>
        <Text style={styles.heading}>{propertyTypeOptions.find(o => o.value === d.propertyType)?.label} in {propertyCityOptions.find(o => o.value === d.city)?.label}</Text>
        <Text style={styles.copy}>{d.addressLine1}{d.addressLine2 ? `, ${d.addressLine2}` : ''}, {d.barangay}</Text>
        <Text style={styles.copy}>{d.bedrooms} bedrooms / {d.bathrooms} bathrooms / {furnishingOptions.find(o => o.value === d.furnishingStatus)?.label}</Text>
        {d.floorAreaSqm ? <Text style={styles.copy}>Floor area: {d.floorAreaSqm} sqm</Text> : null}
        {[['Floor number', d.floorNumber], ['Total floors', d.totalFloors], ['Maximum occupants', d.maxOccupants], ['Postal code', d.postalCode], ['Private access instructions', d.accessInstructions]].filter(([, value]) => !!value).map(([label, value]) => <Text key={label} style={styles.copy}>{label}: {value}</Text>)}
        <Text style={styles.copy}>Exact location: {location.confirmedPoint ? 'Confirmed on map' : 'Awaiting location confirmation'}</Text>
        <Text style={styles.copy}>Public map point: {hasConfirmedPropertyLocation(d) ? 'Approved public point supplied separately' : 'Awaiting approved privacy strategy'}</Text>
        <FeedbackNotice message={!hasConfirmedPropertyLocation(d) ? propertyLocationNotice : null} />
        <FeedbackNotice message={draftPropertyError(d, false)} tone="error" />
        <ListingButton disabled={state.busy || !state.loaded || !!draftPropertyError(d)} label="Confirm and save property" onPress={() => void flow.submit()} />
      </> : <>
        <FeedbackNotice tone="warning" message="Do not submit again while the outcome is unknown. Check your most recent owned properties and select one only if you recognize this setup. If none matches, contact support/backend administration before retrying." />
        <ListingButton disabled={state.busy} label="Check recent owned properties" onPress={() => void flow.checkRecent()} />
        {state.recent.map(property => <ListingButton key={property.id} disabled={state.busy} label={`Use existing ${property.property_type} / ${property.barangay}, ${property.city} / ${formatVerificationDate(property.created_at)} / ${property.id}`} tone="outline" onPress={() => void flow.confirmExisting(property.id)} />)}
      </>}
    </> : null}
    {state.step === 'created' ? <>
      <FeedbackNotice tone="success" message="The physical property is confirmed in Supabase. No listing was created or published." />
      <Text selectable style={styles.copy}>Property ID: {state.propertyId}</Text>
      <Text style={styles.copy}>Open Profile ? Verification ? Tier 3 to select this owned property when you are ready. Nothing is submitted automatically.</Text>
      <ListingButton label="Manage property photos" onPress={() => vm.navigate('photoManager')} />
      <ListingButton label="Continue to listing draft" onPress={vm.continueListingPreview} />
      <FeedbackNotice message="Listing details stay local until title, description and rent are ready and you explicitly save the listing draft to your account. Amenities remain local; property photos are managed separately." />
      <ListingButton disabled={state.busy} label="Set up another property" tone="outline" onPress={() => void flow.startNew()} />
    </> : null}
  </ListingWizardScaffold>;
}
const styles = StyleSheet.create({
  heading: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '600' },
  copy: { color: colors.trustedText, fontFamily: typography.family, fontSize: 16, lineHeight: 24 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: 130, minWidth: 0 },
});
