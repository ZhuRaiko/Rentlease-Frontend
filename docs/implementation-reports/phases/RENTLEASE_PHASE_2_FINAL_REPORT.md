# Phase 2 — Normal-user Tier 2 identity verification

Date: 2026-10-19. Branch: `feature/tier2-verification`. Baseline: `6578b6ebf7186df67e46c7bef6e20b3a1548648d` plus this uncommitted implementation.

Status: **IMPLEMENTED / AUTOMATED-TESTED / RUNTIME-UNVERIFIED**. No Android/live Supabase submission was performed; the user will test runtime afterward. No commit or push.

## 1. Files created

- `src/features/user-verification/models/TierTwoVerification.ts`
- `src/features/user-verification/services/tierTwoVerificationService.ts`
- `src/features/user-verification/viewModels/tierTwoVerificationWorkflow.ts`
- `src/features/user-verification/viewModels/useTierTwoVerificationViewModel.ts`
- `tests/tierTwoVerification.test.ts`
- `docs/implementation-reports/phases/2026-10-19-tier-2-implementation-plan.md`
- This report.

## 2. Files modified

- `App.tsx`
- `src/features/authentication/views/AuthProfilesFlowView.tsx`
- `src/features/authentication/views/ProfileView.tsx`
- `src/features/user-verification/components/VerificationTierCard.tsx`
- `src/features/user-verification/views/UserVerificationFlowView.tsx`
- `src/features/user-verification/views/TierTwoVerificationView.tsx`
- `src/features/user-verification/views/VerificationOverviewView.tsx`
- `src/features/user-verification/views/VerificationStatusView.tsx`
- `docs/features/USER_VERIFICATION.md`
- `docs/features/AUTHENTICATION_PROFILES.md` (Profile-entry integration note only)
- `docs/FEATURES.md`
- `docs/ROUTES.md`
- `docs/BACKEND_CONTEXT.md`
- `docs/AUTH_SUPABASE_INTEGRATION.md`

## 3. Existing implementation reused

Existing typed Supabase singleton, device document picker, SelectedDocument normalization, private verification uploader/path helper, AppError boundary within those primitives, AppButton/theme, root workspace/Modal, Profile action, verification overview/Tier 2/status/scaffold/cards and DocumentPreviewPicker. No new dependency or duplicate uploader.

The old `useUserVerificationViewModel` orchestrates fake Tier 1 and Tier 3 preview behavior. It remains disconnected; production now uses a focused Tier 2 ViewModel instead of exposing its fake completion, local Admin decisions or actor promotion. Legacy Tier 1/Tier 3 Views were not changed.

## 4. Exact database operations connected

- Resolve current identity via `auth.getUser()` and recheck before service reads/writes and before upload.
- Select latest own `verification_submissions` where `user_id = authenticated user` and `tier = tier_2_identity`, ordered `submitted_at DESC, id DESC`, `limit(1).maybeSingle()`. Select id/status/rejection_reason/review_note/submitted_at/reviewed_at plus related `verification_documents(id)` for attachment presence.
- Insert exactly `{ user_id, tier: 'tier_2_identity' }` and return the submission projection. No property_id/status/timestamps/review fields are sent.
- Insert `verification_documents` with submission_id, document_type, storage_path, file_name and mime_type. No file_size field.
- Re-query real status after metadata completion; no review RPC, role RPC or client approval mutation.

## 5. Exact Storage behavior connected

Reuse `uploadVerificationDocument({ userId, submissionId, selectedDocument })`. The identity comes from Auth and the submission ID from the actual insert. Private bucket `verification-documents`; path `<USER_ID>/<SUBMISSION_ID>/<UNIQUE_FILENAME>`; randomUUID basename, safe optional extension, original filename kept in metadata; `upsert: false`; Expo FileSystem ArrayBuffer upload. No public/signed URLs, delete or replacement. Return storagePath/fileName/mimeType/size; do not insert size into unsupported schema.

## 6. Document mappings

| UI label | Backend enum |
| --- | --- |
| Driver’s License | drivers_license |
| UMID | umid |
| Passport | passport |
| National ID / PhilSys ID | philsys_id |

SSS/Student IDs and property documents are absent from the production selector. No implicit `other` mapping.

## 7. Exact user flow

Profile → Verification → Tier 2 → choose supported ID → pick real document → review filename/image/fallback → Submit → authenticated preflight → create real submission → upload → insert metadata → refresh → actual status. Selection alone performs no writes. Notifications uses the same verification entry. Normal back navigation returns through the screens; overview Close/Back returns to Profile. Picker/submission actions guard visible and Android Modal Back controls.

## 8. Status behavior

No row allows initial submission. Existing pending, under_review, approved, rejected, cancelled and revoked rows all block creation. Each exact backend status has its own label. Rejection reason/review note/dates are displayed when present. Rejected/cancelled/revoked have no resubmission or replacement action. Refresh is manual/on-mount, not Realtime. Tier 1 is read-only from the account; Tier 3 is disabled. Tier 2 changes no roles.

## 9. Errors and partial state

Auth, load/preflight, create, missing ID, upload, metadata and final-refresh failures show safe stage-specific errors. Double-submit/overlapping actions are synchronously excluded. Uncertain results require refresh; known existing rows block recreation.

Insert/upload/metadata are not atomic. Submission-only rows and private orphan objects can remain after failures, lost responses or termination. Missing visible metadata is flagged as potentially incomplete on reopen. There is no invented automatic delete/retry/resubmission. Attachment presence under RLS is not proof of object integrity. Final refresh failure does not claim confirmed submission success. Lifecycle disposal prevents later steps/state writes, but cannot abort an already-sent operation.

## 10. Security checks performed

Static/automated review checked identity source/rechecks, exact permitted payloads, no review/status/trust/role writes, no private URLs/secrets/logging or RLS bypass, and disconnected legacy promotion. Hardware Back bypass found during review was corrected. No formal MASVS/MASTG or live policy validation is claimed.

Only local `supabase/config.toml` exists; authoritative live policies/functions/migrations were not available. Generated types and supplied workflow contracts support implementation, but actual own-row/metadata/Storage access and defaults still need live testing. Client preflight is not cross-device transactional uniqueness.

## 11. Tests added

34 new focused tests cover supported/unsupported mappings, minimal Tier 2 insert, deterministic latest query, authenticated metadata/namespace, identity failure/change, query failures, ordered workflow/created ID reuse, all six existing statuses including preflight races, double-submit exclusion, picker cancellation/error, each submit failure stage, missing ID, initial-load recovery, incomplete-record reopen, unmount and development effect replay/stale-result suppression. Existing 36 regressions are preserved.

## 12. Total test result

`npm.cmd test`: exit 0, **70 total, 70 passed, 0 failed, 0 skipped, 0 cancelled**.

## 13. Typecheck result

`npm.cmd run typecheck`: exit 0, PASS.

## 14. Expo dependency check

`npx.cmd --no-install expo install --check`: exit 0, **Dependencies are up to date**. The first sandboxed attempt was blocked by network EACCES; the authorized retry succeeded. No installation/version change occurred.

## 15. Git diff check

`git diff --check`: PASS. New-file whitespace was checked separately. No schema, package/lock, Auth startup coordinator/ViewModel or legacy Tier 1/Tier 3 View diff exists.

## 16. Git status

The 14 files in section 2 are modified; the seven files in section 1 are untracked. Nothing is staged, committed or pushed by this pass. Report/plan files are inside implementation-reports rather than repository root.

## 17. Deferred / unresolved

DEFERRED: Admin review, Tier 3, replacement, rejected/cancelled/revoked resubmission, additional-information requests and private document retrieval. UNRESOLVED: configured MIME/size limits, deletion/recovery policy and cache lifecycle. Partial writes and cross-device duplicate races require existing/future backend enforcement; no schema workaround was invented. Android picker/file reads, upload integrity and live RLS/defaults are RUNTIME-UNVERIFIED.

Living feature/index/routes docs now describe this implementation; stale global disconnected-Tier-2 statements were corrected without rewriting unrelated architecture/context.

## 18. Exact Android runtime sequence

1. Sign in as a Tier 1-verified ordinary user with no Tier 2 row. Open Profile → Verification. Confirm Tier 1 is read-only, Tier 3 unavailable, and Tier 2 permits only the four mapped IDs.
2. Select an image, cancel a subsequent picker and confirm retained selection. Choose PDF/non-image and confirm filename/fallback. Before Submit, confirm no DB/Storage mutation; test Back and reopen.
3. Submit and rapidly tap again. Expect a single new Tier 2 row, private object under the authenticated user/created submission, matching metadata and actual status. Check omitted property/review/role fields and Android Back exclusion during submission.
4. Reopen/Refresh pending, under_review and approved states. Using authorized existing backend/Admin preparation outside this frontend task, also inspect rejected with reason, cancelled and revoked. Confirm no duplicate/resubmission or local approval control.
5. Test offline initial load/preflight, reconnect/Refresh and expired identity. Under authorized controlled conditions test denied upload/metadata writes: expect error and incomplete-record indication; no automatic recreation/cleanup. Test final-refresh failure and reopen.
6. With a second account, confirm isolation; check private object policies and no public URL exposure. Confirm restricted-account routing and Admin entry remain unchanged. Use non-sensitive test files. Report actual device/build/account-state outcomes; this report does not claim runtime success.
