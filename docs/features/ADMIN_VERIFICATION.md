# Admin Verification

## Current status and boundary

Date: 2026-10-21. Tier 2 submission/upload/metadata, Admin queue/detail/private image viewing and approval are **USER-REPORTED Android development-build RUNTIME-VERIFIED**. The earlier checkpoint also verified close/reopen, unchanged Pending after viewing, and Philippine Standard Time timestamp display. Tier 3 review compatibility is now **IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**. Tier 2 rejection and broader negative cases are not runtime-verified; no new Tier 2 rejection/resubmission work is included. Non-image viewing and other Admin report/enforcement/audit integrations remain DEFERRED or PREVIEW.

The user explicitly approved the queue migration, which was applied with generated types refreshed. This frontend pass changes no migration or backend function. The existing Tier 2 test submission is now approved by prior user testing; read-only inspection in this pass confirmed that state and made no changes.

## Architecture and source ownership

Existing authenticated Admin route remains unchanged. Views invoke the existing Admin ViewModel; it composes `adminVerificationQueue` and `adminVerificationService` through the typed singleton. The service uses the deployed queue RPC, selected-submission document SELECT, on-demand signed Storage URL and existing review RPC. It does not download bytes itself, query another user's profile or auth.users, generate public URLs, directly update submissions or mutate profiles/trust values.

Sources: `src/features/admin-moderation/models/AdminVerification.ts`, `services/adminVerificationService.ts`, `viewModels/adminVerificationQueue.ts`, `viewModels/useAdminModerationViewModel.ts`; existing AdminCards, Dashboard, Queue, VerificationModeration and Audit Views.

## Backend contract

Migration: `supabase/migrations/20261020134152_get_admin_verification_queue.sql`.

`public.get_admin_verification_queue()` takes no arguments and returns a table with:

| Field | SQL type |
| --- | --- |
| submission_id, user_id | uuid |
| display_name | text |
| tier | public.verification_tier |
| property_id | uuid, nullable |
| status | public.verification_status |
| submitted_note | text, nullable |
| submitted_at, updated_at | timestamptz |
| trust_score | numeric, nullable |
| tier1_verified_at, tier2_verified_at, tier3_verified_at | timestamptz, nullable |
| document_count | bigint |
| document_id | uuid, nullable |
| document_type | public.verification_document_type, nullable |
| file_name, mime_type, storage_path | text, nullable |
| document_created_at | timestamptz, nullable |

The function is STABLE, SECURITY DEFINER with `search_path = public`. It rejects missing auth.uid() and non-Admin public.is_admin() callers with SQLSTATE 42501, revokes PUBLIC/anon execution and grants authenticated execution. This is a narrow privileged summary, not a broad profiles SELECT policy. It reads only pending/under_review submissions, oldest submitted_at then id first. One row per submission: document_count is a correlated count; representative document is newest created_at then greatest id via a lateral limit-one selection. No auth.users, email, secrets or Storage URLs are returned. storage_path remains Admin-only.

Live read-only inspection confirmed the existing self-only profile SELECT, own-or-Admin verification SELECT, Admin document policy and is_admin helper. No RLS or review RPC changes were made. Read-only SQL checks using the authenticated role and transaction-local Auth identity confirmed: Admin returns the real pending test row and document metadata; ordinary user and missing identity are rejected with 42501; anon has no EXECUTE grant; direct other-profile SELECT still returns zero rows. The RPC returned one row per submission. All checks rolled back transaction-local settings and made no status mutations.

## UI and refresh behavior

### UI refinement Phase 1 (2026-10-22)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Real verification queue cards emphasize applicant name, tier, document metadata, status and Philippine-time dates. Submission UUIDs remain secondary detail fields. Verification detail uses readable metadata rows and grouped applicant/document sections; approval/rejection confirmations have readable text, safe spacing and the existing required rejection input. Errors use error notices; confirmed review outcomes use success notices. Queue filters have selected accessibility state and 48dp targets.

The ViewModel owns return-to-queue plus refresh coordination. Review transitions, confirmation requirements, duplicate prevention, refresh/error lockout and backend operations remain unchanged. The private viewer still requests only on-demand 90-second signed URLs through the existing service and retains all close/Back/expiry/image-failure/stale-request cleanup. No public URL, persistence, logging, policy or service changes were introduced. All displayed verification timestamps continue to use `Asia/Manila`.

Dashboard copy no longer incorrectly says review is disconnected. Existing report/restriction/decision metrics and activity fixtures are explicitly labelled preview; no new metric or record was invented and those modules were not integrated or redesigned. Existing Tier 2 runtime acceptance above applies to its earlier revision, not this new UI.

Manual Android acceptance: queue filters -> real detail -> readable applicant/document metadata and PHT dates -> private image zoom/Close/Back/reopen -> Start review confirmation/Cancel -> existing approval/rejection confirmations. Use separate suitable test records for writes; preserve the already-approved Tier 2 record. Check offline/expired-link errors and reopening/refresh cleanup. New layouts and interactions remain RUNTIME-UNVERIFIED.

On Admin mount, load the active queue. Dashboard pending count is derived only from actual pending rows; queue summaries include all pending/under_review rows. Loading/error displays no invented count. Queue filters use actual tier values. Refresh replaces stale rows and clears stale selection. Request generations/disposal suppress obsolete responses.

Cards use applicant display name, actual tier/status/document type/filename and submitted timestamp. Detail rechecks active RPC membership and reads matching document metadata. Missing metadata displays No document attached; null values are not replaced with fake identities/documents. There is no fake priority, role, property name/address, email, approval or preview image. Image documents retain View private document, including while Under review. Tier 2 decision controls follow the lifecycle below. Errors show safe messages; empty responses show a genuine empty queue. No sample fallback exists.

### Verification timestamps and timezone

Timestamp display is IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED after the 2026-10-21 fix. Read-only ADB inspection confirmed emulator-5554 uses persist.sys.timezone = GMT. The previous formatVerificationDate used new Date(value).toLocaleString() without a timezone, so it correctly parsed the UTC instant but displayed it in the emulator's GMT zone. This explains 11:41 AM for 2026-10-21T11:41:27.883577+00:00 rather than the required 7:41 PM Philippine time. The earlier Philippine-time display checkpoint depended on device configuration; it was not an explicit application timezone guarantee.

No shared date formatter existed. The existing Admin formatter was extracted to src/shared/utils/formatVerificationDate.ts and re-exported through its original Admin model entry point, preserving queue/detail callers. One Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour12: true, ... }) formats month/day/year and time through seconds, with a PHT suffix. Invalid values show Date unavailable; optional verification dates retain their existing Not verified presentation.

Queue/detail submitted_at, updated_at, attached-document created_at and tier1/2/3_verified_at all use this one formatter. The active queue projection does not expose reviewed_at and terminal records leave that queue, so no new Admin reviewed field/RPC was invented. Existing Tier 2/Tier 3 user status Views use the same helper for submitted_at and reviewed_at. Values remain unmodified UTC instants in Supabase and application data; conversion happens only for display. No backend, workflow, dependency or emulator-setting changes were made. The Dashboard uses neutral overview copy; displayed submission/verification timestamps remain explicitly Philippine time.

Seven regression tests cover the reported instant, AM/PM including noon/midnight, next-day/year rollover, equivalent UTC/+08 offsets, device-timezone independence, invalid values and reuse of the same formatter. Full suite: 166/166 passed; typecheck passed. Actual corrected native rendering still needs testing: reload Admin with the emulator deliberately still on GMT and expect Oct 21, 2026, 7:41:27 PM PHT for the supplied instant. Compare updated/attached/Tier timestamps and user submitted/reviewed dates with their UTC source values; check a UTC timestamp at/after 16:00 moves to the next Philippine date. Repeat on a Manila-configured device and confirm the same result. No review or submission action is needed for these checks.

Hardcoded verification submissions/types were removed from AdminModeration.ts. Local approval/rejection/additional-information mutations were removed from the ViewModel. The fake verification audit entry was removed; unrelated report/enforcement fixtures remain clearly preview behavior.

## Private image viewing

`createVerificationDocumentViewUrl(storagePath)` extends the existing Admin verification service, using the typed singleton's authenticated Storage client. No signed-URL helper previously existed. It calls `storage.from('verification-documents').createSignedUrl(storagePath, 90)`: exactly **90 seconds**, no public URL, download option or transform. Signing happens only after explicit View action, never on queue/detail loading. The View supplies only a document ID; the coordinator resolves loaded metadata and checks its submission_id against the currently selected submission. Missing/foreign documents and empty paths cannot open a preview.

Supported MIME types are image/jpeg, image/jpg, image/png and image/webp. The existing metadata card keeps the real type, filename, MIME and attached date. Unsupported types, including PDFs, display Preview is not available for this file type and do not request a URL. No PDF dependency was added.

The detail View now uses the shared FullscreenDocumentImage component also used by Tier 2/Tier 3 local previews. It shows real document type/filename/MIME, signing/image-loading progress, safe errors and Close. React Native Modal onRequestClose forwards Android Back to the existing closePrivateDocument action. The contained image supports pinch 1x-8x, bounded one-finger panning, double-tap 3x/fit and Reset zoom. Source changes, closing and reopening reset image/gesture state. No raw URL, sharing/download control or gallery-save operation is exposed; URLs are not used as React debug keys or logged. No custom persistent image cache is implemented.

Zoom status: **IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**. Previous user-reported private viewing PASS applies to the earlier nonzoom viewer. The shared component adds Expo-compatible react-native-gesture-handler ~2.32.0 with core Animated and JS-thread gesture callbacks; no Reanimated/Babel plugin is added. Its GestureHandlerRootView is inside the Modal. Rebuild/reinstall the development build to include the native dependency before testing; Metro/OTA alone is insufficient. High-resolution image memory, readability, gesture performance and actual hardware Back delivery still need device testing. Source resolution limits useful magnification.

The coordinator owns transient documentPreview state. It prevents concurrent signing, clears the URL on close, selection change, queue refresh, navigation and disposal, and ignores late signing responses. Stale image-error callbacks cannot clear a reopened preview. Signing/network/expiry/image errors show fixed safe copy, clear the URL and allow close/reopen; raw errors and token-bearing causes are not exposed or logged. Reopening always requests a fresh URL. There is no background refresh or Postgres/queue-RPC URL persistence. Closing clears frontend state but does not revoke an issued link before its 90-second expiry.

This zoom pass preserves that coordinator/service behavior and the private bucket's existing policies. The shared viewer only consumes the already-issued URL and reports image failure through privateDocumentFailed(requestId); it never signs links or calls review/upload/metadata operations. Viewing and zooming cannot start a review or change submission status. The shared MIME predicate retains the previous Admin JPEG/JPG/PNG/WebP allowlist and honest unsupported-file behavior.

Bucket verification-documents remains private. Existing storage_verification_read_owner_admin SELECT policy remains unchanged: bucket match plus owner namespace or public.is_admin(). Read-only live SQL role-context checks confirmed one visible test object for Admin and zero for an ordinary non-owner. No actual signed URL or document bytes were generated/read in those SQL checks, and no review fields/status were modified. The user subsequently reported successful Android private image viewing and close/reopen.

## Tier 2 and Tier 3 review lifecycle

A loaded Tier 2 or Tier 3 detail exposes the existing review actions. Pending shows Start review, with no active Approve/Reject. Under review shows Approve verification and Reject verification. Confirmation titles/descriptions and success notices use the actual tier; Tier 3 displays the real property ID and qualifying ownership/authorization metadata. Each first tap opens a confirmation Modal; no RPC runs before confirmation. Rejection requires a trimmed, nonblank reason. Optional review notes are not exposed; unused note/reason arguments use SQL NULL defaults. Queue filters, private-image lifecycle, duplicate/cleanup guards and RPC calls are reused.

`reviewSubmission({ submissionId, status, reviewNote?, rejectionReason? })` calls only `review_verification_submission`. Generated Args are `requested_submission_id: string`, `requested_status: verification_status`, `requested_review_note?: string`, `requested_rejection_reason?: string`; return is one verification_submissions row. The service awaits the RPC result and then refreshes rather than locally applying that row. Frontend statuses are narrowed to under_review/approved/rejected. Optional text arguments omit absent values, preserving the live SQL `DEFAULT NULL` contract without casting generated types. Approval/Start review omit rejection reason; rejection sends the trimmed reason. Current UI sends no review note.

Read-only live inspection on 2026-10-21 confirms authentication and public.is_admin() checks before row locking, then pending -> under_review -> approved/rejected. The existing require_qualifying_tier3_document_on_approval migration now requires Tier 3 metadata of land_title, tax_declaration, hoa_document or authorization_to_lease; identity documents and other do not qualify. Tier 2 retains its document-existence requirement. Rejection requires a nonblank reason. The backend sets reviewed_by from auth.uid(), reviewed_at for terminal decisions, and clears rejection_reason outside rejection. The frontend route is only a presentation gate. No review RPC was invoked by the agent during this implementation.

Existing backend trigger refresh_profile_verification_timestamps derives tier2_verified_at and tier3_verified_at from approved submissions' reviewed_at; trust_score is database-generated (0.40 Tier 1 + 0.40 Tier 2 + 0.20 Tier 3). Tier 3 grants no landlord role and does not require Tier 2. No client update touches profiles, verification timestamps, trust, roles or review audit fields. This pass changes no backend function, schema, policy or Storage operation.

The coordinator synchronously blocks duplicate confirmations, selection/refresh/preview opening and feature navigation while saving and refreshing. Review opening clears the private preview; confirmation invalidates older queue/detail requests. Cancel clears the local reason. Unmount clears drafts/previews and ignores late results, but cannot cancel a write already sent.

After Start review, queue and selected detail reload from the backend; Under review is never assigned locally. After approval/rejection, the queue reloads and the ViewModel returns to it with success feedback. Terminal records disappearing is normal. Dashboard Pending retains pending-only semantics; the queue summary counts all pending/under_review work. If another Admin finishes the item during refresh, disappearance is handled by returning to the queue. A detail-fetch race can instead show a safe refresh error.

RPC failure leaves the last authoritative detail intact, closes the dialog, shows fixed safe copy and blocks further decisions until a successful queue refresh. An uncertain network result may already have committed; there is no automatic retry. If the RPC succeeds but reload fails, stale detail is cleared and the queue shows that review was saved but refresh is required. Raw SQL/errors and signed URLs are not shown or logged.

## Validation and next steps

Queue tests cover real-row mapping, document labels/null metadata, pending versus under_review, one-item results, service query boundaries, loading/empty/error states, replacement refresh, obsolete responses and disposal. Thirteen additional private-viewing tests cover MIME support, correct bucket/path/90-second expiry, lazy URL creation, identity/submission validation, open/close/reopen, stale/concurrent requests, selection/refresh/disposal cleanup, safe service failures, image failure and stale image events. Existing user-side Tier 2 tests remain in the full suite.

Automated coverage includes action/confirmation gating, backend-driven transitions without optimistic statuses, terminal blocking, Tier 3 lifecycle/notice compatibility, required trimmed reason, duplicates, uncertain-write lockout, refresh failure, disposal, image viewing and exact RPC arguments. Preserved queue/private-image/user-side Tier 2 tests are run alongside the new Tier 3 workflow/service tests. Read-only database inspection confirms the attached timestamp trigger, generated trust expression and qualifying Tier 3 approval rule. The existing Tier 2 test record is already approved and was not mutated by this pass. Read-only evidence and automated tests do not establish Tier 3 Android acceptance or formal security compliance. Current final command results are recorded in User Verification.

Manual Android tests still needed: create a new Tier 3 property submission as an eligible landlord, then Admin -> Queues -> Tier 3 -> confirm property ID/qualifying metadata -> inspect private image -> Start review -> confirm. Expect under_review with Admin reviewed_by and null reviewed_at. Reopen/continue -> Approve -> Cancel once -> Approve and confirm. Expect terminal queue removal and backend-derived tier3_verified_at/trust, then real landlord status after refresh. Test rejection only with a separate test record. Identity/other-only Tier 3 proof must fail approval at the backend. Controlled denied/offline/stale/no-document cases and expired-link/navigation cleanup remain unverified; do not infer them from Tier 2 approval. Preserve the existing approved Tier 2 record.

Historical verification record (2026-10-21). Commit baseline: `6578b6e` plus uncommitted work; the baseline does not contain this implementation. Verification Status: Tier 2 queue/detail/private image viewing/approval USER-REPORTED Android development-build PASS; Tier 3 review compatibility IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Queue migration version remains 20261020134152; this pass changes no migration. Preserve the already-approved Tier 2 test record and use a new Tier 3 record for manual tests.

Shared zoom validation is recorded in User Verification. Added model/callback-wiring/no-write regressions do not establish native pinch/pan/Back behavior. Manual zoom acceptance: rebuild the development client, open either tier's private image, inspect small text with pinch/pan/double-tap, Close or hardware Back, reopen and verify reset/fresh-link behavior. Test expiry/image-load/offline failure and navigation/account cleanup without reviewing or mutating the existing approved Tier 2 record. The new zoom viewer remains RUNTIME-UNVERIFIED for both tiers.

### UI Phase 1 validation record

Last Verified Date: 2026-10-22. Last Verified Commit baseline: `c2a1b9f` plus uncommitted UI refinements; these changes are not in that commit. Verification Status: **IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**. `npm run typecheck` passed; `npm test` passed **188/188**, zero failures/skips/cancellations. Eight additional tests cover status/role/applicability mappings, contextual recovery, Tier 3 selection/confirmation cancellation with no writes, and Login/confirmation/recovery source wiring. Existing Auth routing, registration, synchronization, Tier 2/Tier 3 upload, Admin review and private-preview regressions remain. Native rendering/gesture/keyboard/live acceptance is not implied.

Android JS/Hermes export passed to a temporary folder (bundling only, not an APK/runtime test). `npx expo install --check` reports existing installed `expo@57.0.30` versus expected `~57.0.31`, and `expo-location@57.0.21` versus expected `~57.0.22`; no dependencies were added/upgraded. Backend services, schema, RLS, RPCs, Storage operations, Auth synchronization and root `App.tsx` remain unchanged. Source review found no View-level backend access or new MVVM violation. Shared presentation primitives affect button wrapping/disabled feedback across their existing consumers; untested marketplace operations remain unchanged.

### Phase 2 corrections checkpoint (2026-10-22)

The dashboard now reads Admin Dashboard with neutral Admin overview heading. The redundant normal-state Refresh verifications button is removed. Retry verification queue appears only for load errors or reviewNeedsRefresh, including uncertain-review recovery; initial loading and authoritative post-review refresh are preserved. Existing shared role labels remain Tenant, Landlord and Admin. No queue service, private preview, review RPC or authorization behavior changed. Android layout/loading/error/review recovery remains RUNTIME-UNVERIFIED.

Baseline: `550275c` plus uncommitted corrections. Typecheck passed; full automated suite passed 213/213, zero failures/skips/cancellations. These checks do not establish Android runtime acceptance.

## Designer-led UX refinement (2026-10-22)

Status: IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Last Verified Commit baseline: `976d13d` plus uncommitted changes.

Verification Queue now uses native RefreshControl on its existing ScrollView. Initial loading remains automatic; pull-to-refresh calls the same authoritative ViewModel/controller refresh. Loading feedback is visible, with a pull-down hint and real empty/error presentation. The ViewModel excludes refresh while already loading or reviewBusy. Retry verification queue remains visible for actual errors or uncertain-review recovery; the permanent Refresh queue button is removed. Detail exposes Reload verification queue only when reviewNeedsRefresh, retaining navigation Back and existing post-review authoritative refresh. Refresh continues to clear stale selection/private preview and reject late results.

AdminScaffold reuses shared ScreenHeader with wrapping titles and 48dp controls; queue filters/body text are more readable. Reports/enforcement/audit fixtures remain unchanged previews. Private 90-second signing, no public URLs, preview cleanup/expiration, review confirmation/authorization, status transitions and PHT formatting are unchanged. No service/RPC/Storage/policy/dependency changes.

Typecheck passed; 223/223 tests passed, zero failures/skips/cancellations. New queue wiring checks complement preserved queue/review/private-document tests. Native pull feedback, offline retry and review recovery still need user Android acceptance. Agent saw the revised dashboard header on emulator, but did not complete authenticated queue or review validation; no review/submission writes occurred.

Manual acceptance: Admin entry -> queue loads automatically -> pull down -> real spinner/data -> filter -> detail -> private image/Close/Back. Test network failure -> visible retry -> recovery; perform Start review/Approve/Reject only on appropriate new test records and confirm authoritative refresh plus duplicate/navigation locks. Preserve previously approved records.
