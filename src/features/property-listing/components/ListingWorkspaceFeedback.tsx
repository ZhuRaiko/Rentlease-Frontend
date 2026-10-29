import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { ListingButton } from './ListingButton';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';
export function ListingWorkspaceFeedback({ viewModel: vm, scope }: { viewModel: PropertyListingViewModel; scope: 'draft' | 'publication' | 'management' }) {
  const id = vm.workspacePropertyId;
  if (!id) return null;
  const draft = vm.listingDraftState, publication = vm.publicationState, lifecycle = vm.lifecycleState;
  const ownDraft = draft.propertyId === id && (!vm.workspaceListingId || !draft.listingId || draft.listingId === vm.workspaceListingId);
  const ownPublication = publication.propertyId === id && (!vm.workspaceListingId || publication.listingId === vm.workspaceListingId);
  const ownLifecycle = lifecycle.propertyId === id && lifecycle.listingId === vm.workspaceListingId;
  return <>
    {scope !== 'management' && ownDraft ? <>
      <FeedbackNotice message={draft.busy ? 'Checking or saving your listing draft…' : draft.error ?? draft.notice} tone={draft.error ? 'error' : 'info'} />
      {!draft.busy && (draft.error || draft.uncertain) && !publication.uncertain ? <ListingButton label={draft.uncertain ? 'Check draft save status' : 'Retry loading draft'} tone="outline" onPress={() => void (draft.uncertain ? vm.listingDraftPersistence.reconcile() : vm.listingDraftPersistence.load(false, vm.workspaceListingId))} /> : null}
    </> : null}
    {ownPublication && (scope !== 'draft' || publication.uncertain) ? <>
      <FeedbackNotice message={publication.busy ? 'Checking publication…' : publication.error} tone={publication.error ? 'error' : 'info'} />
      {!publication.busy && (publication.error || publication.uncertain) ? <ListingButton label="Check publication status" tone="outline" onPress={() => void vm.checkPublication()} /> : null}
    </> : null}
    {scope === 'management' && ownLifecycle ? <>
      <FeedbackNotice message={lifecycle.busy ? 'Checking or updating listing status…' : lifecycle.error ?? lifecycle.notice} tone={lifecycle.error ? 'error' : 'info'} />
      {!lifecycle.busy && (lifecycle.error || lifecycle.uncertain) ? <ListingButton label="Check listing status" tone="outline" onPress={() => void vm.lifecycle.reconcile()} /> : null}
    </> : null}
  </>;
}
