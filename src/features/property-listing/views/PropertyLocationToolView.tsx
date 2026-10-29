import { PropertyLocationMapView } from './PropertyLocationMapView';
import { Text } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { ui } from '../../../shared/theme/ui';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { ListingField } from '../components/ListingControls';
import { ListingButton } from '../components/ListingButton';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

export function PropertyLocationToolView({ viewModel: vm, onClose }: { viewModel: PropertyListingViewModel; onClose: () => void }) {
  const location = vm.locationState, locationFlow = vm.propertyLocation;
  const token = locationFlow.generationToken();
  if (location.stage === 'map' && location.workingPoint && location.selected && location.styleUrl) return <PropertyLocationMapView key={token} styleUrl={location.styleUrl} point={location.workingPoint} initialPoint={location.selected} ready={location.mapReady} error={location.error} onMove={point => locationFlow.movePoint(point, token)} onLoaded={() => locationFlow.mapLoaded(token)} onFailed={() => locationFlow.mapFailed(token)} onCancel={locationFlow.cancel} onConfirm={() => locationFlow.confirmExact(token)} />;
  if ((location.stage === 'searching' || location.stage === 'candidates')) return <ListingWizardScaffold title="Find your property" description="Search the address, then choose a result to adjust its exact pin." onBack={locationFlow.cancel} onClose={onClose}>
    <ListingField label="Property address search" placeholder="Street, barangay and city" value={location.query} onChangeText={locationFlow.updateQuery} />
    <ListingButton label={location.busy ? 'Search again' : 'Search address'} onPress={() => void locationFlow.search()} />
    <FeedbackNotice message={location.error} tone="error" />
    {location.busy ? <Text accessibilityLiveRegion="polite" style={ui.body}>Searching locations...</Text> : null}
    {!location.busy && !location.error && !location.candidates.length ? <Text style={ui.body}>No locations found. Check the address and search again.</Text> : null}
    {location.candidates.map(candidate => <ListingButton key={candidate.id} label={candidate.label} tone="outline" onPress={() => locationFlow.chooseCandidate(candidate.id, token)} />)}
    <ListingButton label="Cancel" tone="outline" onPress={locationFlow.cancel} />
  </ListingWizardScaffold>;
  return null;
}
