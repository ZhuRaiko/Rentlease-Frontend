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
      <FeedbackNotice message={draft.busy ? vm.publishedEditing?'Checking or saving your listing changes...':'Checking or saving your listing draft…' : draft.error ?? draft.notice} tone={draft.error ? 'error' : 'info'} />
      {!draft.busy && (draft.error || draft.uncertain || draft.conflict) && !publication.uncertain ? <ListingButton label={draft.conflict ? 'Load latest saved version' : draft.uncertain ? vm.publishedEditing?'Check saved changes':'Check draft save status' : draft.errorSource === 'save' && draft.loaded ? vm.publishedEditing?'Retry saving changes':'Retry saving draft' : 'Retry loading draft'} tone="outline" onPress={() => void ((draft.uncertain || draft.conflict) ? vm.listingDraftPersistence.reconcile() : draft.errorSource === 'save' && draft.loaded ? vm.saveComposerDraft() : vm.listingDraftPersistence.load(false, vm.workspaceListingId))} /> : null}
    </> : null}
    {ownPublication && (scope !== 'draft' || publication.uncertain || !!publication.error) ? <>
      <FeedbackNotice message={publication.busy ? 'Checking publication…' : publication.error} tone={publication.error ? 'error' : 'info'} />
      {!publication.busy && (publication.error || publication.uncertain) ? <ListingButton label="Check publication status" tone="outline" onPress={() => void vm.checkPublication()} /> : null}
    </> : null}
    {scope === 'management' && ownLifecycle ? <>
      <FeedbackNotice message={lifecycle.busy ? 'Checking or updating listing status…' : lifecycle.error ?? lifecycle.notice} tone={lifecycle.error ? 'error' : 'info'} />
      {!lifecycle.busy && (lifecycle.error || lifecycle.uncertain) ? <ListingButton label="Check listing status" tone="outline" onPress={() => void vm.lifecycle.reconcile()} /> : null}
    </> : null}
  </>;
}
