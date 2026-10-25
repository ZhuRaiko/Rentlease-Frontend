import type { Database } from '../../../shared/services/supabase/database.types';
import type { PublicationListing } from './ListingPublication';
export type LifecycleListing = PublicationListing;
export type LifecycleStatus = Database['public']['Enums']['listing_status'];
export type LifecycleOperation = 'pause' | 'reactivate' | 'archive';
export const lifecycleOperations: readonly LifecycleOperation[] = ['pause', 'reactivate', 'archive'];
export const lifecycleRpc = { pause: 'pause_listing', reactivate: 'reactivate_listing', archive: 'archive_listing' } as const;
export const lifecycleTarget = { pause: 'paused', reactivate: 'active', archive: 'archived' } as const;
export const lifecycleLabel = { pause: 'Pause listing', reactivate: 'Reactivate listing', archive: 'Archive listing' } as const;
export const lifecycleStatusLabel: Record<LifecycleStatus, string> = { draft: 'Draft', active: 'Published', paused: 'Paused', rented: 'Rented', archived: 'Archived', removed: 'Removed' };
export function lifecycleActions(status: LifecycleStatus): readonly LifecycleOperation[] {
  return status === 'active' ? ['pause', 'archive'] : status === 'paused' ? ['reactivate', 'archive'] : [];
}
export const isLifecycleStatus = (status: unknown): status is LifecycleStatus => typeof status === 'string' && Object.hasOwn(lifecycleStatusLabel, status);
export class LifecycleError extends Error {
  constructor(message: string, public readonly kind: 'rejected' | 'uncertain' | 'identity' = 'rejected') { super(message); }
}
export function lifecycleBackendError(error: { code?: string; message?: string }): LifecycleError {
  const message = error.message ?? '';
  if (/controlled by an active tenancy/i.test(message)) return new LifecycleError('This listing is controlled by an active tenancy and cannot be changed manually.');
  if (/Only an active listing can be paused/i.test(message)) return new LifecycleError('This listing can only be paused while it is published.');
  if (/Only a paused listing can be reactivated/i.test(message)) return new LifecycleError('Only a paused listing can be reactivated.');
  if (/Only an active or paused listing can be archived/i.test(message)) return new LifecycleError('Only a published or paused listing can be archived.');
  if (/Approved Tier 3 verification for this property/i.test(message)) return new LifecycleError('This property needs approved Tier 3 ownership verification before the listing can be reactivated.');
  if (/80%+ completeness/i.test(message)) return new LifecycleError('This listing no longer meets the requirements to return to Published status.');
  if (/already has a live listing/i.test(message)) return new LifecycleError('This property already has another live listing. It cannot be reactivated.');
  return new LifecycleError('The listing change was not allowed. Check your account, ownership and current listing status.');
}
export const lifecycleMessage = (error: unknown): string => error instanceof LifecycleError ? error.message : 'The listing change could not be confirmed. Check listing status before trying again.';
export const validTimestamp = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
const nullableTimestamp = (value: unknown) => value === null || validTimestamp(value);
const sameTime = (a: string | null, b: string | null) => a === null ? b === null : validTimestamp(b) && Date.parse(a) === Date.parse(b);
export type LifecycleReceipt = Database['public']['Functions']['pause_listing']['Returns'][number];
export function validLifecycleReceipt(receipt: LifecycleReceipt, before: LifecycleListing, operation: LifecycleOperation): boolean {
  return receipt.listing_id === before.id && receipt.listing_status === lifecycleTarget[operation]
    && Number.isFinite(receipt.completeness_score) && validTimestamp(receipt.updated_at)
    && nullableTimestamp(receipt.published_at) && sameTime(before.published_at, receipt.published_at)
    && nullableTimestamp(receipt.paused_at) && nullableTimestamp(receipt.archived_at)
    && (operation !== 'pause' || validTimestamp(receipt.paused_at))
    && (operation !== 'archive' || validTimestamp(receipt.archived_at))
    && (operation !== 'reactivate' || (receipt.paused_at === null && validTimestamp(receipt.published_at) && receipt.completeness_score >= .80));
}
export const lifecycleReceiptFromRow = (row: LifecycleListing): LifecycleReceipt => ({ listing_id: row.id, listing_status: row.status, completeness_score: row.completeness_score, published_at: row.published_at, paused_at: row.paused_at, archived_at: row.archived_at, updated_at: row.updated_at });
