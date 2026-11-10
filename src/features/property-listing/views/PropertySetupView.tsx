import { usePropertyFormFocus } from '../components/usePropertyFormFocus';
import { PropertyReadinessNotice } from '../components/PropertyProgressFooter';
import { PropertyFloorFields } from '../components/PropertyFloorFields';
import { FieldLabel } from '../components/FieldLabel';
import { PropertyLocationToolView } from './PropertyLocationToolView';
import { formatVerificationDate } from '../../../shared/utils/formatVerificationDate';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { typography } from '../../../shared/theme/typography';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { ListingField, ChoiceChip } from '../components/ListingControls';
import { ListingButton } from '../components/ListingButton';
import { hasConfirmedPropertyLocation, furnishingOptions, propertyCityOptions, propertyTypeOptions } from '../models/DraftProperty';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

export function PropertySetupView({ viewModel: vm, onClose }: { viewModel: PropertyListingViewModel; onClose: () => void }) {
  const focus=usePropertyFormFocus(vm.propertyValidationTarget);
  const state = vm.propertyState;
  const flow = vm.propertyCreation;
  const d = state.draft;
  const feedback=(field:string)=>vm.propertyVisibleValidationIssues?.find(issue=>issue.field===field)?.message??null;
  const locationAccepted = hasConfirmedPropertyLocation(d);
  const location = vm.locationState;
  if (state.step === 'address' && ['searching', 'candidates', 'map'].includes(location.stage)) return <PropertyLocationToolView viewModel={vm} onClose={onClose} />;
  const title = state.step === 'details' ? 'Your physical property' : state.step === 'address' ? 'Where is the property?' : state.step === 'created' ? 'Property confirmed' : 'Review property setup';
  return <ListingWizardScaffold formFocus={focus} title={title} onBack={vm.goBack} onClose={onClose} description="Property setup is separate from a rental listing. Tier 3 approval is not needed to add a property.">
    <FeedbackNotice message={vm.propertyValidationIssues?.some(issue=>issue.message===state.error)?null:state.error} tone="error" />
    {state.busy ? <Text accessibilityLiveRegion="polite" style={styles.copy}>Please wait. Checking your property setup...</Text> : null}
    {!state.loaded && !state.uncertain && !state.busy ? <ListingButton label="Retry setup check" onPress={() => void flow.initialize()} /> : null}
    {state.step === 'details' ? <View collapsable={false} ref={focus.section('property')}>
      <FieldLabel label="Property type" required />
      {feedback('propertyType')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('propertyType')}</Text>:null}
      <View style={[styles.choices,feedback('propertyType')&&styles.invalidGroup]}>{propertyTypeOptions.map(o => <ChoiceChip key={o.value} label={o.label} selected={d.propertyType === o.value} onPress={() => flow.updateField('propertyType', o.value)} />)}</View>
      <View style={styles.fields}>
        <View style={styles.cell}><ListingField error={vm.propertyVisibleValidationIssues?.find(issue=>issue.field==='bedrooms')?.message??null} inputRef={focus.field('bedrooms')} label="Bedrooms" placeholder="Enter count" keyboardType="numeric" value={d.bedrooms} onChangeText={v => flow.updateField('bedrooms', v)} /></View>
        <View style={styles.cell}><ListingField error={vm.propertyVisibleValidationIssues?.find(issue=>issue.field==='bathrooms')?.message??null} inputRef={focus.field('bathrooms')} label="Bathrooms" placeholder="Enter count" keyboardType="numeric" value={d.bathrooms} onChangeText={v => flow.updateField('bathrooms', v)} /></View>
      </View>
      <Text style={styles.copy}>Enter 0 only when the property truly has none.</Text>
      <ListingField error={vm.propertyVisibleValidationIssues?.find(issue=>issue.field==='floorAreaSqm')?.message??null} inputRef={focus.field('floorAreaSqm')} label="Floor area (sqm, optional)" placeholder="Floor area, not land area" keyboardType="numeric" value={d.floorAreaSqm} onChangeText={v => flow.updateField('floorAreaSqm', v)} />
      {vm.propertyMeasurementWarnings?.map(message=><Text key={message} style={styles.copy}>{message}</Text>)}
      <PropertyFloorFields propertyType={d.propertyType} focus={focus} floorNumber={d.floorNumber} totalFloors={d.totalFloors} editable={!state.busy} errors={vm.propertyFloorIssues} onChange={(field,value)=>flow.updateField(field,value)} />
      <ListingField error={vm.propertyVisibleValidationIssues?.find(issue=>issue.field==='maxOccupants')?.message??null} inputRef={focus.field('maxOccupants')} label="Maximum occupants (optional)" placeholder="Number of people" keyboardType="numeric" value={d.maxOccupants} onChangeText={v => flow.updateField('maxOccupants', v)} />
      <Text accessibilityRole="header" style={styles.heading}>Furnishing</Text>
      {feedback('furnishingStatus')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('furnishingStatus')}</Text>:null}
      <View style={[styles.choices,feedback('furnishingStatus')&&styles.invalidGroup]}>{furnishingOptions.map(o => <ChoiceChip key={o.value} label={o.label} selected={d.furnishingStatus === o.value} onPress={() => flow.updateField('furnishingStatus', o.value)} />)}</View>
      <FeedbackNotice message="Photos can be managed after the property is saved. No rental listing will be created automatically." />
      {vm.propertyValidationIssues?.length?<PropertyReadinessNotice viewModel={vm}/>:null}
      <ListingButton disabled={!state.loaded || state.busy} label="Continue to address" onPress={flow.next} />
    </View> : null}
    {state.step === 'address' ? <View collapsable={false} ref={focus.section('address')}>
      <FieldLabel label="City" required />
      {feedback('city')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('city')}</Text>:null}
      <View style={[styles.choices,feedback('city')&&styles.invalidGroup]}>{propertyCityOptions.map(o => <ChoiceChip key={o.value} label={o.label} selected={d.city === o.value} onPress={() => flow.updateField('city', o.value)} />)}</View>
      <ListingField required error={vm.propertyVisibleValidationIssues?.find(issue=>issue.field==='barangay')?.message??null} inputRef={focus.field('barangay')} label="Barangay" placeholder="Barangay" value={d.barangay} onChangeText={v => flow.updateField('barangay', v)} />
      <ListingField required error={vm.propertyVisibleValidationIssues?.find(issue=>issue.field==='addressLine1')?.message??null} inputRef={focus.field('addressLine1')} label="Address line 1" placeholder="House/unit number and street" value={d.addressLine1} onChangeText={v => flow.updateField('addressLine1', v)} />
      <ListingField label="Address line 2 (optional)" placeholder="Building, subdivision or other details" value={d.addressLine2} onChangeText={v => flow.updateField('addressLine2', v)} />
      <ListingField label="Postal code (optional)" placeholder="Postal code" value={d.postalCode} onChangeText={v => flow.updateField('postalCode', v)} />
      <ListingField label="Access instructions (private, optional)" placeholder="How to find the entrance" multiline value={d.accessInstructions} onChangeText={v => flow.updateField('accessInstructions', v)} />
      <View collapsable={false} ref={focus.section('location')} style={[styles.location,feedback('location')&&styles.invalidGroup]}>
      <FieldLabel label="Location" required />
      {feedback('location')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('location')}</Text>:null}
      <ListingButton disabled={state.busy || !state.loaded || !d.city || !d.barangay.trim() || !d.addressLine1.trim()} label={location.confirmedPoint ? 'Review exact location on map' : 'Find and confirm location'} tone="outline" onPress={vm.openPropertyLocation} />
      <Text accessibilityLiveRegion="polite" style={styles.copy}>Exact location: {locationAccepted ? 'Confirmed on map' : 'Confirm the current address and location before saving.'}</Text>
      <Text style={styles.copy}>Public map point: {locationAccepted ? 'Approximate discovery location ready' : 'Waiting for location confirmation'}</Text>
      </View>
      <ListingButton disabled={state.busy} label="Review property" onPress={flow.next} />
    </View> : null}
    {state.step === 'review' ? <>
      {!state.uncertain ? <>
        <Text style={styles.heading}>{propertyTypeOptions.find(o => o.value === d.propertyType)?.label} in {propertyCityOptions.find(o => o.value === d.city)?.label}</Text>
        <Text style={styles.copy}>{d.addressLine1}{d.addressLine2 ? `, ${d.addressLine2}` : ''}, {d.barangay}</Text>
        <Text style={styles.copy}>{d.bedrooms} bedrooms / {d.bathrooms} bathrooms / {furnishingOptions.find(o => o.value === d.furnishingStatus)?.label}</Text>
        {d.floorAreaSqm ? <Text style={styles.copy}>Floor area: {d.floorAreaSqm} sqm</Text> : null}
        <PropertyFloorFields propertyType={d.propertyType} focus={focus} floorNumber={d.floorNumber} totalFloors={d.totalFloors} editable={!state.busy} errors={vm.propertyFloorIssues} onChange={(field,value)=>flow.updateField(field,value)} />
        {[['Maximum occupants', d.maxOccupants], ['Postal code', d.postalCode], ['Private access instructions', d.accessInstructions]].filter(([, value]) => !!value).map(([label, value]) => <Text key={label} style={styles.copy}>{label}: {value}</Text>)}
        <Text accessibilityLiveRegion="polite" style={styles.copy}>Exact location: {locationAccepted ? 'Confirmed on map' : 'Confirm the current address and location before saving.'}</Text>
        <Text style={styles.copy}>Public map point: {locationAccepted ? 'Approximate discovery location ready' : 'Waiting for location confirmation'}</Text>
        {feedback('location')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('location')}</Text>:null}
        {vm.propertyValidationIssues?.length?<PropertyReadinessNotice viewModel={vm}/>:null}
        <ListingButton disabled={state.busy || !state.loaded} label="Confirm and save property" onPress={() => void vm.submitProperty()} />
      </> : <>
        <FeedbackNotice tone="warning" message="Do not submit again while the outcome is unknown. Check your most recent owned properties and select one only if you recognize this setup. If none matches, contact support/backend administration before retrying." />
        <ListingButton disabled={state.busy} label="Check recent owned properties" onPress={() => void flow.checkRecent()} />
        {state.recent.map(property => <ListingButton key={property.id} disabled={state.busy} label={`Use existing ${property.property_type} / ${property.barangay}, ${property.city} / ${formatVerificationDate(property.created_at)} / ${property.id}`} tone="outline" onPress={() => void flow.confirmExisting(property.id)} />)}
      </>}
    </> : null}
    {state.step === 'created' ? <>
      <FeedbackNotice tone="success" message="The physical property is confirmed in Supabase. No listing was created or published." />
      <Text selectable style={styles.copy}>Property ID: {state.propertyId}</Text>
      <Text style={styles.copy}>Continue with this saved property to manage photos and prepare its listing. Tier 3 approval is required for publication, not for these next steps.</Text>
      <ListingButton label="Continue with this property" onPress={vm.continueListingPreview} />
    </> : null}
  </ListingWizardScaffold>;
}
const styles = StyleSheet.create({
  error:{...ui.supporting,color:colors.restricted},invalidGroup:{borderWidth:1,borderColor:colors.restricted,borderRadius:8,padding:spacing.sm},location:{gap:spacing.sm},
  heading: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '600' },
  copy: { color: colors.trustedText, fontFamily: typography.family, fontSize: 16, lineHeight: 24 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: 130, minWidth: 0 },
});
