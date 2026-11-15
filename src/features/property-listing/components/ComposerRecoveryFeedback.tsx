import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { ListingButton } from './ListingButton';
import { savedLineText } from '../models/ListingCheck';
import { PropertyRecoveryCard } from './PropertyRecoveryCard';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';
export function ComposerRecoveryFeedback({ viewModel: vm, slimSaved = false }: { viewModel: PropertyListingViewModel; /** the Listing step shows the plain saved status as a slim line of its own */ slimSaved?: boolean }) {
  return <>
    {!vm.workspacePropertyActive ? <FeedbackNotice message="This property is inactive. Listing draft edits are unavailable." tone="warning" /> : null}
    <FeedbackNotice message={vm.propertyState.uncertain || vm.propertyValidationIssues?.some(issue=>issue.message===vm.propertyState.error)?null:vm.propertyState.error} tone="error" />
    <FeedbackNotice message={slimSaved && savedLineText(vm.composerNotice) ? null : vm.composerNotice} />
    {vm.propertyState.uncertain ? <PropertyRecoveryCard state={vm.propertyState} onCheck={() => void vm.propertyCreation.checkRecent()} onUse={id => void vm.propertyCreation.confirmExisting(id)} onStartFresh={() => void vm.propertyCreation.startFresh()} /> : null}
    {!vm.workspacePropertyId && !vm.propertyState.loaded && !vm.propertyState.busy && !vm.propertyState.uncertain ? <ListingButton label="Retry setup check" tone="outline" onPress={() => void vm.propertyCreation.startNew()} /> : null}
  </>;
}
