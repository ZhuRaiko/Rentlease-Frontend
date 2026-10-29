import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { propertyTypeOptions, propertyCityOptions, furnishingOptions, hasConfirmedPropertyLocation } from '../models/DraftProperty';
import { ChoiceChip, ListingField } from './ListingControls';
import { ListingButton } from './ListingButton';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

export function ComposerPropertyFields({ viewModel: vm, children }: { viewModel: PropertyListingViewModel; children?: ReactNode }) {
  const state = vm.propertyState, flow = vm.propertyCreation, d = state.draft, summary = vm.propertySummary;
  const saved = !!vm.workspacePropertyId, editable = !saved && !state.busy && !state.uncertain && !vm.composerPhase;
  const localDetails = !saved || state.propertyId === vm.workspacePropertyId && !!d.propertyType;
  if (!localDetails) return <><View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>Property</Text><Text style={styles.heading}>{summary.type}</Text><Text style={styles.body}>{summary.bedrooms} bedrooms · {summary.bathrooms} bathrooms · {summary.furnishing}</Text>{summary.floorAreaSqm ? <Text style={styles.body}>{summary.floorAreaSqm} sqm floor area</Text> : null}<Text style={styles.body}>{summary.floorNumber ? `Floor number: ${summary.floorNumber}. ` : ""}{summary.totalFloors ? `Total floors: ${summary.totalFloors}. ` : ""}{summary.maxOccupants ? `Maximum occupants: ${summary.maxOccupants}.` : ""}</Text><Text style={styles.body}>{summary.location}</Text><Text style={styles.supporting}>Saved physical property. Property details are retained.</Text></View>{children}<View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>Location</Text><Text style={styles.body}>{summary.location}</Text><Text style={styles.supporting}>Saved property location.</Text></View></>;
  return <>
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Property</Text>
      {saved ? <Text style={styles.supporting}>Property saved. Physical details are now read-only.</Text> : null}
      <Text style={styles.body}>Property type</Text>
      <View style={styles.chips}>{propertyTypeOptions.map(o => <ChoiceChip key={o.value} label={o.label} selected={d.propertyType === o.value} disabled={!editable} onPress={() => flow.updateField('propertyType', o.value)} />)}</View>
      <View style={styles.columns}>{([
        ['bedrooms', 'Bedrooms', '0'], ['bathrooms', 'Bathrooms', '0'], ['floorAreaSqm', 'Floor area (sqm, optional)', 'Floor area, not land area'], ['floorNumber', 'Floor number (optional)', '0'], ['totalFloors', 'Total floors (optional)', '1'], ['maxOccupants', 'Maximum occupants (optional)', 'Number of people'],
      ] as const).map(([field, label, placeholder]) => <View key={field} style={styles.cell}><ListingField label={label} placeholder={placeholder} keyboardType="numeric" editable={editable} value={d[field]} onChangeText={v => flow.updateField(field, v)} /></View>)}</View>
      <Text style={styles.body}>Furnishing</Text>
      <View style={styles.chips}>{furnishingOptions.map(o => <ChoiceChip key={o.value} label={o.label} selected={d.furnishingStatus === o.value} disabled={!editable} onPress={() => flow.updateField('furnishingStatus', o.value)} />)}</View>
    </View>
    {children}
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Location</Text>
      <Text style={styles.body}>City</Text>
      <View style={styles.chips}>{propertyCityOptions.map(o => <ChoiceChip key={o.value} label={o.label} selected={d.city === o.value} disabled={!editable} onPress={() => flow.updateField('city', o.value)} />)}</View>
      {([
        ['barangay', 'Barangay', 'Barangay'], ['addressLine1', 'Address line 1', 'House/unit number and street'], ['addressLine2', 'Address line 2 (optional)', 'Building or subdivision'], ['postalCode', 'Postal code (optional)', 'Postal code'], ['accessInstructions', 'Access instructions (private, optional)', 'How to find the entrance'],
      ] as const).map(([field, label, placeholder]) => <ListingField key={field} label={label} placeholder={placeholder} value={d[field]} editable={editable} multiline={field === 'accessInstructions'} onChangeText={v => flow.updateField(field, v)} />)}
      <Text style={styles.body}>Exact location: {hasConfirmedPropertyLocation(d) ? 'Confirmed' : 'Not confirmed'}</Text>
      <Text style={styles.body}>Public discovery location: {hasConfirmedPropertyLocation(d) ? 'Ready' : 'Waiting for confirmation'}</Text>
      {!saved ? <ListingButton label={hasConfirmedPropertyLocation(d) ? 'Confirm / adjust on map' : 'Confirm location on map'} tone="outline" disabled={!editable || !state.loaded || !d.city || !d.barangay.trim() || !d.addressLine1.trim()} onPress={vm.openPropertyLocation} /> : null}
      <FeedbackNotice message="The exact pin stays private. Public discovery uses the approved approximate location." />
    </View>
  </>;
}
const styles = StyleSheet.create({ section: { gap: spacing.sm }, heading: { ...ui.sectionTitle }, body: { ...ui.body }, supporting: { ...ui.supporting }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, cell: { flexBasis: 135, flexGrow: 1, minWidth: 0 } });
