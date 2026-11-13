/**
 * Plain-language errors for Admin-only operations (verification review, report moderation, review moderation).
 * Framework-free. Match on the backend message first (the migrations raise stable literals), then SQLSTATE as a fallback.
 * Output is always a static string; raw SQL, provider text and identifiers are never copied into it.
 * Never use this for tenant, landlord or reporter paths: those messages must stay non-revealing.
 */
export type AdminErrorCode =
  | 'tenancy_open' | 'pending_identity_review' | 'review_context_changed' | 'correction_changed' | 'identity_changed'
  | 'same_property_confirmation_required' | 'qualifying_proof_required' | 'owner_evidence_required'
  | 'invalid_review_transition' | 'rejection_reason_required' | 'admin_required' | 'access_unavailable'
  | 'report_changed' | 'invalid_report_transition' | 'operation_changed'
  // Admin actions (suspend, restore, remove) and the audit log, migration 20261113180000.
  | 'action_not_supported' | 'action_reason_length' | 'action_target_shape' | 'action_end_date_past' | 'action_end_date_not_suspension'
  | 'action_self_target' | 'action_admin_target' | 'action_target_unavailable' | 'action_account_not_active' | 'action_account_not_restricted'
  | 'action_listing_not_removable' | 'action_listing_tenancy_open'
  | 'action_report_required' | 'action_report_unavailable' | 'action_report_not_upheld' | 'action_report_target_mismatch' | 'action_conflicting_retry'
  | 'action_not_applied' | 'audit_unavailable' | 'audit_filter_invalid' | 'transaction_mode'
  | 'permission_denied' | 'conflict' | 'invalid_request' | 'backend_update_required'
  | 'network' | 'timeout' | 'unknown';

export interface AdminOperationErrorInfo {
  code: AdminErrorCode;
  title: string;
  message: string;
  nextStep: string;
  /** True when the screen's data may be stale or the decision cannot continue, so the Admin should reload. False when the Admin can fix it in place. */
  reload: boolean;
  /** Short support reference for unknown errors (for example AD-42P01). Never raw text. */
  reference: string | null;
}

type Rule = { match: string; info: Omit<AdminOperationErrorInfo, 'reference'> };
const rule = (match: string, code: AdminErrorCode, title: string, message: string, nextStep: string, reload = true): Rule => ({ match, info: { code, title, message, nextStep, reload } });

// Order matters: the first matching literal wins. Literals are lowercase substrings of the migration messages.
const rules: Rule[] = [
  rule('identity cannot change while a tenancy is open', 'tenancy_open', 'Tenancy is open', "This property's identity can't change while a tenancy is proposed, pending or active.", 'Wait until the tenancy ends, then reload this review.'),
  rule('resolve the pending identity review first', 'pending_identity_review', 'Identity review pending', "A tenancy can't be proposed while an identity review is pending for this property.", 'Resolve or withdraw the pending identity review, then try again.'),
  rule('review context changed', 'review_context_changed', 'Review changed', 'The submission, property or correction changed after you opened it.', 'Reload the queue and read the latest details before deciding.'),
  rule('correction changed', 'correction_changed', 'Correction changed', "The owner's correction request was changed or withdrawn after you opened it.", 'Reload the review and check the current correction.'),
  rule('identity changed', 'identity_changed', 'Property identity changed', "The property's identity was updated after this evidence was submitted.", 'Reload the review. The owner may need to submit new proof.'),
  rule('confirm evidence corrects the same physical property', 'same_property_confirmation_required', 'Confirmation needed', 'Confirm that the evidence shows the same physical property being corrected.', 'Turn on the confirmation in the review dialog, then approve again.', false),
  rule('qualifying private proof required', 'qualifying_proof_required', 'Qualifying proof missing', 'Approval needs a qualifying private document: a land title, tax declaration, HOA document or authorization to lease.', 'Ask the owner to upload one, or reject with a reason.'),
  rule('eligible owner and finalized evidence required', 'owner_evidence_required', 'Owner or evidence not eligible', 'The property must be active and owned by a Tier 1 verified landlord, and the evidence must be finalized for review.', "Check the owner's account and that the proof was finalized, then reload."),
  rule('invalid review transition', 'invalid_review_transition', 'Review step not allowed', "A submission must be started before it can be approved or rejected, and it can't be decided twice.", 'Reload the queue to see its current status.'),
  rule('reason required', 'rejection_reason_required', 'Reason needed', 'A rejection needs a written reason.', 'Enter a reason, then reject again.', false),
  rule('admin required', 'admin_required', 'Admin access needed', 'This action is only available to Admin accounts.', 'Sign in with an Admin account and try again.'),
  rule('access unavailable', 'access_unavailable', 'Access unavailable', "This account can't use this moderation action right now.", 'Check that your Admin account is active, then try again. If it keeps happening, ask the backend owner to review Admin access.'),
  rule('report changed', 'report_changed', 'Report changed', 'The report was updated after you opened it.', 'Reload the report and review the latest details.'),
  rule('invalid transition', 'invalid_report_transition', 'Status change not allowed', "A report can't move to that status from its current one.", 'Reload the report to see its current status.'),
  rule('operation changed', 'operation_changed', 'Decision changed', 'This decision was already started with different details.', 'Reload and make the decision again.'),
  // Admin actions and audit log. Literals are lowercase substrings of the messages raised in 20261113180000_admin_actions_audit.sql;
  // tests/adminActionsErrorDrift.test.ts fails if a message there has no rule here or a rule here matches nothing there.
  rule('action not supported', 'action_not_supported', 'Action not available', "That action isn't available from the app.", 'Choose one of the listed actions.', false),
  rule('reason must be 10 to 500 characters', 'action_reason_length', 'Reason needed', 'A reason of 10 to 500 characters is required.', 'Update the reason, then confirm again.', false),
  rule('choose exactly one target', 'action_target_shape', 'Choose one target', 'An action applies to one account or one listing.', 'Go back, pick the account or listing, and try again.', false),
  rule('end date must be in the future', 'action_end_date_past', 'End date has passed', 'The end date must be in the future.', 'Choose a later end date or no end date, then confirm again.', false),
  rule('end date applies only to suspensions', 'action_end_date_not_suspension', 'End date not allowed', 'Only a suspension can have an end date.', 'Remove the end date, then confirm again.', false),
  rule('cannot take action on their own account', 'action_self_target', 'Not allowed', "Admins can't take action on their own account or listings.", 'Ask another Admin to handle this.'),
  rule('admin accounts cannot be targeted', 'action_admin_target', 'Not allowed', "Admin accounts and their listings can't be suspended, restored or removed from the app.", 'Ask the backend owner to handle Admin accounts.'),
  rule('target unavailable', 'action_target_unavailable', 'Account or listing unavailable', 'That account or listing no longer exists or is not eligible.', 'Reload and check its current state.'),
  rule('account is already restricted or suspended', 'action_account_not_active', 'Already restricted', 'This account is already suspended or restricted.', 'Reload the list. Restore the account first if you need to change it.'),
  rule('account is not suspended or restricted', 'action_account_not_restricted', 'Nothing to restore', 'This account is not suspended or restricted.', 'Reload to see its current status.'),
  rule('listing cannot be removed from its current status', 'action_listing_not_removable', "Can't remove this listing", 'Only an active or paused listing can be removed.', 'Reload to see its current status.'),
  rule('listing cannot be removed while a tenancy is open', 'action_listing_tenancy_open', 'Tenancy is open', 'This property has a tenancy that is proposed, awaiting confirmation or active, so the listing cannot be removed.', 'Wait until the tenancy ends, then remove the listing.'),
  rule('a report is required for this action', 'action_report_required', 'Report needed', 'Suspending an account or removing a listing needs an upheld report.', 'Open the upheld report and choose the action from there.', false),
  rule('report unavailable', 'action_report_unavailable', 'Report unavailable', 'The report for this action could not be found.', 'Go back and reopen the report.'),
  rule('report must be upheld first', 'action_report_not_upheld', 'Report not upheld', 'Actions from a report need the report to be upheld first.', 'Resolve the report as upheld, then take action.'),
  rule('report does not match the target', 'action_report_target_mismatch', "Doesn't match the report", "That account or listing isn't the one this report is about.", 'Go back and reopen the report.'),
  rule('conflicting retry', 'action_conflicting_retry', 'Action changed', 'This action was already started with different details.', 'Reload and take the action again.'),
  rule('action was not applied', 'action_not_applied', 'Nothing was changed', "The action didn't take effect, so nothing was changed.", 'Try again. If it keeps failing, ask the backend owner to check the moderation setup.', false),
  rule('audit entry was not written', 'audit_unavailable', 'Not recorded', "The action couldn't be recorded in the audit log, so nothing was changed.", 'Try again. If it keeps failing, ask the backend owner to check the audit log.', false),
  rule('invalid audit filter', 'audit_filter_invalid', 'Filter not available', "That audit filter or page isn't available.", 'Go back to the first page of the list.', false),
  rule('read committed required', 'transaction_mode', 'Try again', "The server couldn't run this action safely.", 'Try again. If it keeps failing, ask the backend owner to check the connection settings.', false),
];

const timeoutPattern = /timed? ?out|timeout|aborted|aborterror/;
const networkPattern = /network|failed to fetch|fetch failed|offline|connection|econn|enotfound|socket/;
const sqlState = /^[0-9A-Z]{5}$/;

function fields(error: unknown): { message: string; code: string; name: string } {
  const e = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>;
  return { message: typeof e.message === 'string' ? e.message : typeof error === 'string' ? error : '', code: typeof e.code === 'string' ? e.code : '', name: typeof e.name === 'string' ? e.name : '' };
}

export function classifyAdminError(error: unknown, options: { decision?: boolean } = {}): AdminOperationErrorInfo {
  if (error instanceof AdminOperationError) return error.info;
  const { message, code, name } = fields(error), text = message.toLowerCase();
  const hit = rules.find(r => text.includes(r.match));
  if (hit) return { ...hit.info, reference: null };
  const saved = options.decision ? ' Reload to see whether your decision was saved before trying again.' : '';
  if (name === 'AbortError' || (!sqlState.test(code) && timeoutPattern.test(`${name} ${text}`.toLowerCase()))) return { code: 'timeout', title: 'Request timed out', message: "The server didn't answer in time.", nextStep: `Check your connection and try again.${saved}`, reload: !!options.decision, reference: null };
  if (!sqlState.test(code) && (error instanceof TypeError || networkPattern.test(text))) return { code: 'network', title: 'Connection problem', message: "RentLease couldn't reach the server.", nextStep: `Check your connection and try again.${saved}`, reload: !!options.decision, reference: null };
  switch (code) {
    case '42501': return { code: 'permission_denied', title: 'Not permitted', message: "This account isn't allowed to do that.", nextStep: 'Reload, check that your Admin account is active, then try again.', reload: true, reference: null };
    case '40001': return { code: 'conflict', title: 'Changed by someone else', message: 'This item changed after you opened it.', nextStep: 'Reload and review the latest details before deciding.', reload: true, reference: null };
    case '22023': return { code: 'invalid_request', title: 'Request not accepted', message: "The backend didn't accept this action for the item's current state.", nextStep: 'Reload to see its current state, then try again.', reload: true, reference: null };
    case 'PGRST202': return { code: 'backend_update_required', title: 'Backend update needed', message: "The server doesn't have the update this action needs.", nextStep: 'Ask the backend owner to apply the pending update.', reload: false, reference: null };
  }
  const reference = `AD-${sqlState.test(code) ? code : 'UNKNOWN'}`;
  return { code: 'unknown', title: 'Something went wrong', message: "This action couldn't be completed.", nextStep: `Reload and try again.${saved} If it keeps happening, report code ${reference}.`, reload: true, reference };
}

/** A typed error carrying the plain-language fields. `message` is the safe summary plus the next step (so code that only reads `.message` still tells the Admin what to do), never raw backend text. */
export class AdminOperationError extends Error {
  readonly code: AdminErrorCode; readonly title: string; readonly nextStep: string;
  constructor(readonly info: AdminOperationErrorInfo) { super(`${info.message} ${info.nextStep}`); this.name = 'AdminOperationError'; this.code = info.code; this.title = info.title; this.nextStep = info.nextStep; }
}
export const toAdminOperationError = (error: unknown, options: { decision?: boolean } = {}) => error instanceof AdminOperationError ? error : new AdminOperationError(classifyAdminError(error, options));

/** Title, message and next step as one string for the existing FeedbackNotice. */
export const adminErrorText = (info: AdminOperationErrorInfo) => `${info.title}\n${info.message} ${info.nextStep}`;
export const adminErrorMessage = (error: unknown, options: { decision?: boolean } = {}) => adminErrorText(classifyAdminError(error, options));
