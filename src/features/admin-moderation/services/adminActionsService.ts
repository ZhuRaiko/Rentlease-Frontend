import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { AdminOperationError, toAdminOperationError } from '../../../shared/models/AdminOperationError';
import {
  AdminActionsFormatError, parseActionResult, parseAuditPage, parseRemovedListings, parseRestrictions,
  type AdminActionInput, type AdminActionResult, type AdminAuditPage, type AdminRemovedListingPage, type AdminRestrictionPage, type AuditKind,
} from '../models/AdminActions';

export interface AdminActionsService {
  fetchRestrictions(): Promise<AdminRestrictionPage>;
  /** Optional so older fakes of this service still type-check; the real service always provides it. */
  fetchRemovedListings?(): Promise<AdminRemovedListingPage>;
  fetchAuditLog(kind: AuditKind, offset: number): Promise<AdminAuditPage>;
  applyAction(input: AdminActionInput): Promise<AdminActionResult>;
}

/** Plain-language, non-revealing failure for a response that does not match the contract. */
const malformed = (decision: boolean) => toAdminOperationError(new Error('The server response could not be verified.'), { decision });

/**
 * Admin-only data access. Authorization is enforced by the RPCs (active Admin required; clients have no table access);
 * nothing here, and no View, is an authorization decision. Failures become typed AdminOperationError values.
 */
export function createAdminActionsService(getClient: () => SupabaseClient<Database>): AdminActionsService {
  const guard = async <T,>(work: () => Promise<T>, decision: boolean): Promise<T> => {
    try { return await work(); }
    catch (error) {
      if (error instanceof AdminOperationError) throw error;
      if (error instanceof AdminActionsFormatError) throw malformed(decision);
      throw toAdminOperationError(error, { decision });
    }
  };
  return {
    fetchRestrictions: () => guard(async () => {
      const { data, error } = await getClient().rpc('get_admin_restrictions');
      if (error) throw error;
      return parseRestrictions(data);
    }, false),
    fetchRemovedListings: () => guard(async () => {
      const { data, error } = await getClient().rpc('get_admin_removed_listings');
      if (error) throw error;
      return parseRemovedListings(data);
    }, false),
    fetchAuditLog: (kind, offset) => guard(async () => {
      const { data, error } = await getClient().rpc('get_admin_audit_log', { p_kind: kind, p_offset: offset });
      if (error) throw error;
      return parseAuditPage(data);
    }, false),
    applyAction: (input) => guard(async () => {
      const { data, error } = await getClient().rpc('apply_admin_moderation_action', {
        p_operation_id: input.operationId, p_action: input.action, p_target_user_id: input.targetUserId, p_target_listing_id: input.targetListingId,
        p_report_id: input.reportId, p_reason: input.reason, p_ends_at: input.endsAt,
      });
      if (error) throw error;
      const result = parseActionResult(data);
      if (result.action !== input.action) throw new AdminActionsFormatError();
      return result;
    }, true),
  };
}
