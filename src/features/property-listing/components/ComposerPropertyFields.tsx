import { colors } from '../../../shared/theme/colors';
import type { PropertyFormFocus } from './usePropertyFormFocus';
import { PropertyFloorFields } from './PropertyFloorFields';
import { CompletenessHint } from './CompletenessHint';
import { FieldLabel } from './FieldLabel';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { propertyTypeOptions, propertyCityOptions, furnishingOptions, hasConfirmedPropertyLocation } from '../models/DraftProperty';
import { ChoiceChip, ListingField } from './ListingControls';
import { ListingButton } from './ListingButton';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

export function ComposerPropertyFields({ viewModel: vm, children, focus }: { viewModel: PropertyListingViewModel; children?: ReactNode; focus?:PropertyFormFocus }) {
  const state = vm.propertyState, flow = vm.propertyCreation, d = state.draft, summary = vm.propertySummary;
  const saved = !!vm.workspacePropertyId, editable = !saved && !state.busy && !state.uncertain && !vm.composerPhase;
  const issue=vm.propertyValidationIssue;
  const feedback=(field:string)=>(vm.propertyVisibleValidationIssues??vm.propertyValidationIssues)?.find(item=>item.field===field)?.message??(issue?.field===field?issue.message:null);
  if (saved) return <>
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>{summary.type}</Text>
      <Text style={styles.body}>{summary.bedrooms} bedrooms · {summary.bathrooms} bathrooms · {summary.furnishing}</Text>
      {summary.floorAreaSqm ? <Text style={styles.body}>{summary.floorAreaSqm} sqm floor area</Text> : null}
      <Text style={styles.body}>{summary.floorNumber ? `Floor ${summary.floorNumber}. ` : ''}{summary.totalFloors ? `${summary.totalFloors} ${summary.floorTotalLabel??'floors in building'}. ` : ''}{summary.maxOccupants ? `Up to ${summary.maxOccupants} occupants.` : ''}</Text>
      <Text style={styles.body}>{summary.location || 'Loading saved property details...'}</Text>
      <Text style={styles.supporting}>This summary is read-only. Use Edit Property Details for routine changes. Property identity stays protected.</Text>
    </View>
    {children}
  </>;
  return <>
    <View style={styles.section}>
      <View collapsable={false} ref={focus?.section('property')} />
      <Text accessibilityRole="header" style={styles.heading}>Property</Text>
      {saved ? <Text style={styles.supporting}>Property saved. Physical details are now read-only.</Text> : null}
      <FieldLabel label="Property type" required />
      {feedback('propertyType')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('propertyType')}</Text>:null}
      <View style={[styles.chips,feedback('propertyType')&&styles.invalidGroup]}>{propertyTypeOptions.map(o => <ChoiceChip key={o.value} label={o.label} selected={d.propertyType === o.value} disabled={!editable} onPress={() => flow.updateField('propertyType', o.value)} />)}</View>
      <View style={styles.columns}>{([
        ['bedrooms', 'Bedrooms', '0'], ['bathrooms', 'Bathrooms', '0'], ['floorAreaSqm', 'Floor area (sqm, optional)', 'Floor area, not land area'], ['maxOccupants', 'Maximum occupants (optional)', 'Number of people'],
      ] as const).map(([field, label, placeholder]) => <View key={field} style={styles.cell}><ListingField inputRef={focus?.field(field)} label={label} helper={field==='floorAreaSqm'?<CompletenessHint value={vm.completeness} factor="floorArea" hidden={saved} />:field==='maxOccupants'?<CompletenessHint value={vm.completeness} factor="maxOccupants" hidden={saved} />:null} error={feedback(field)} placeholder={placeholder} keyboardType="numeric" editable={editable} value={d[field]} onChangeText={v => flow.updateField(field, v)} /></View>)}</View>
      <PropertyFloorFields propertyType={d.propertyType} focus={focus} floorNumber={d.floorNumber} totalFloors={d.totalFloors} editable={editable} errors={vm.propertyFloorIssues} onChange={(field,value)=>flow.updateField(field,value)} />
      <Text style={styles.body}>Furnishing</Text>
      {feedback('furnishingStatus')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('furnishingStatus')}</Text>:null}
      <View style={[styles.chips,feedback('furnishingStatus')&&styles.invalidGroup]}>{furnishingOptions.map(o => <ChoiceChip key={o.value} label={o.label} selected={d.furnishingStatus === o.value} disabled={!editable} onPress={() => flow.updateField('furnishingStatus', o.value)} />)}</View>
    </View>
    {children}
    <View style={styles.section}>
      <View collapsable={false} ref={focus?.section('address')} />
      <Text accessibilityRole="header" style={styles.heading}>Location</Text>
      <FieldLabel label="City" required />
      {feedback('city')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('city')}</Text>:null}
      <View style={[styles.chips,feedback('city')&&styles.invalidGroup]}>{propertyCityOptions.map(o => <ChoiceChip key={o.value} label={o.label} selected={d.city === o.value} disabled={!editable} onPress={() => flow.updateField('city', o.value)} />)}</View>
      {([
        ['barangay', 'Barangay', 'Barangay'], ['addressLine1', 'Address line 1', 'House/unit number and street'], ['addressLine2', 'Address line 2 (optional)', 'Building or subdivision'], ['postalCode', 'Postal code (optional)', 'Postal code'], ['accessInstructions', 'Access instructions (private, optional)', 'How to find the entrance'],
      ] as const).map(([field, label, placeholder]) => <ListingField inputRef={focus?.field(field)} key={field} label={label} required={field==='barangay'||field==='addressLine1'} error={feedback(field)} placeholder={placeholder} value={d[field]} editable={editable} multiline={field === 'accessInstructions'} onChangeText={v => flow.updateField(field, v)} />)}
      <View collapsable={false} ref={focus?.section('location')} style={[styles.section,feedback('location')&&styles.invalidGroup]}>
      <FieldLabel label="Location" required /><CompletenessHint value={vm.completeness} factor="location" hidden={saved} /><Text accessibilityLiveRegion="polite" style={styles.body}>{hasConfirmedPropertyLocation(d)?'Confirmed':'Confirm the current address and location before saving.'}</Text>
      {feedback('location')?<Text accessibilityLiveRegion="polite" style={styles.error}>{feedback('location')}</Text>:null}
      <Text style={styles.body}>Public discovery location: {hasConfirmedPropertyLocation(d) ? 'Ready' : 'Waiting for confirmation'}</Text>
      {!saved ? <ListingButton label={hasConfirmedPropertyLocation(d) ? 'Confirm / adjust on map' : 'Confirm location on map'} tone="outline" disabled={!editable || !state.loaded || !d.city || !d.barangay.trim() || !d.addressLine1.trim()} onPress={vm.openPropertyLocation} /> : null}
      <Text style={styles.supporting}>The exact pin stays private. Public discovery uses the approved approximate location.</Text>
      </View>
    </View>
  </>;
}
const styles = StyleSheet.create({ error:{...ui.supporting,color:colors.restricted},invalidGroup:{borderWidth:1,borderColor:colors.restricted,borderRadius:8,padding:spacing.sm}, section: { gap: spacing.sm }, heading: { ...ui.sectionTitle }, body: { ...ui.body }, supporting: { ...ui.supporting }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, cell: { flexBasis: 135, flexGrow: 1, minWidth: 0 } });
