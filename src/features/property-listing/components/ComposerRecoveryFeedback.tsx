import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { ListingButton } from './ListingButton';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';
export function ComposerRecoveryFeedback({ viewModel: vm }: { viewModel: PropertyListingViewModel }) {
  return <>
    {!vm.workspacePropertyActive ? <FeedbackNotice message="This property is inactive. Listing draft edits are unavailable." tone="warning" /> : null}
    <FeedbackNotice message={vm.propertyState.error} tone="error" />
    <FeedbackNotice message={vm.composerNotice} />
    {vm.propertyState.uncertain ? <>
      <FeedbackNotice message="Property creation needs checking. Do not create another copy. Select a recent property only if you recognize this setup." tone="warning" />
      <ListingButton label="Check recent owned properties" disabled={vm.propertyState.busy} tone="outline" onPress={() => void vm.propertyCreation.checkRecent()} />
      {vm.propertyState.recent.map(item => <ListingButton key={item.id} label={`Use existing ${item.property_type} in ${item.barangay}, ${item.city}`} tone="outline" disabled={vm.propertyState.busy} onPress={() => void vm.propertyCreation.confirmExisting(item.id)} />)}
    </> : null}
    {!vm.workspacePropertyId && !vm.propertyState.loaded && !vm.propertyState.busy && !vm.propertyState.uncertain ? <ListingButton label="Retry setup check" tone="outline" onPress={() => void vm.propertyCreation.startNew()} /> : null}
  </>;
}
