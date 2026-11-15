import type { LandlordPortfolioItem } from './LandlordPortfolio';
import { portfolioLocation, portfolioType } from './LandlordPortfolio';
import type { UnfinishedPostStatus } from './UnfinishedPostDeletion';

/** Presentation decisions for deleting an unfinished post. Eligibility itself stays with the existing workflow and server check. */
export const deleteCardMenuLabel = 'Delete unfinished post…';
export const deleteEditorMenuLabel = 'Delete this unfinished post…';

/** Same rule the workspace uses (deletionCandidate): no listing, or only never-published drafts. */
export function offersUnfinishedDelete(item: Pick<LandlordPortfolioItem, 'listings'>): boolean {
  return item.listings.every(listing => listing.status === 'draft' && listing.published_at === null);
}

/** The name shown in the confirmation: the listing title, else "Type in City". */
export function unfinishedPostName(item: LandlordPortfolioItem | undefined, draftTitle?: string | null): string {
  const title = item?.currentListing?.title?.trim() || draftTitle?.trim();
  if (title) return title;
  return item ? `${portfolioType(item.property)} in ${portfolioLocation(item.property).split(', ').at(-1)}` : 'this unfinished post';
}

export const deleteDialogTitle = (name: string) => `Delete "${name}"?`;

/** What is removed, in the order a person thinks of it. The photo count appears only when the caller already has it. */
export function deleteDialogBody(photoCount: number | null): string {
  const photos = photoCount === null ? 'its photos' : `its ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`;
  return `This permanently removes the unfinished property, its draft listing and ${photos}.`;
}

/** The existing server reason, only for the post that was checked and only when it blocks deletion. */
export function deleteBlockedReason(state: { propertyId: string | null; status: UnfinishedPostStatus | null } | undefined, propertyId: string | null): string | null {
  const status = state?.status;
  return propertyId && state?.propertyId === propertyId && status?.state === 'live' && !status.eligible ? status.reason : null;
}

export interface EditorMenuItem { key: 'exit' | 'delete'; label: string; onPress: () => void; disabled?: boolean; danger?: boolean; note?: string | null }

/** Posting editor header menu: leave the editor, and (only for a post that can be deleted) delete it. */
export function editorMenuItems(args: { exitLabel: string; onExit: () => void; exitDisabled?: boolean | undefined; status: UnfinishedPostStatus | null; deleteDisabled: boolean; onDelete: () => void }): EditorMenuItem[] {
  const items: EditorMenuItem[] = [{ key: 'exit', label: args.exitLabel, onPress: args.onExit, disabled: !!args.exitDisabled }];
  const status = args.status;
  if (status?.state === 'live') items.push({ key: 'delete', label: deleteEditorMenuLabel, onPress: args.onDelete, danger: true, disabled: args.deleteDisabled || !status.eligible, note: status.eligible ? null : status.reason });
  return items;
}

/** The posting editor's header menu from view-model fields. Only offered where there is something to delete (a saved unfinished post). */
export function postingEditorMenu(vm: { postingWizard: boolean; workspacePropertyId: string | null; unfinishedPostState: { status: UnfinishedPostStatus | null }; unfinishedPostDeletionDisabled: boolean; requestUnfinishedPostDeletion: () => void }, onClose: () => void, exit?: { label: string; onPress: () => void; disabled: boolean }): EditorMenuItem[] | undefined {
  const status = vm.unfinishedPostState?.status;
  if (!vm.postingWizard || !status || status.propertyId !== vm.workspacePropertyId) return undefined;
  const items = editorMenuItems({ exitLabel: exit?.label ?? 'Close posting', onExit: exit?.onPress ?? onClose, exitDisabled: exit?.disabled, status, deleteDisabled: vm.unfinishedPostDeletionDisabled, onDelete: vm.requestUnfinishedPostDeletion });
  return items.length > 1 ? items : undefined;
}
