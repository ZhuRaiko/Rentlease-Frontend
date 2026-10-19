# RENTLEASE Frontend — Phase 1 Final Report

Report date: 2026-10-18.

Scope: Auth/Profile stabilization and shared verification-document foundation. No backend changes or Git commit were made. App/device/live Supabase flows remain RUNTIME-UNVERIFIED.

## A. FILES CREATED

```text
src/features/authentication/viewModels/accountSynchronization.ts
src/shared/models/SelectedDocument.ts
src/shared/services/documents/documentPickerService.ts
src/shared/services/supabase/storage/verificationDocumentPath.ts
src/shared/services/supabase/storage/verificationDocumentStorageService.ts
tests/accountSynchronization.test.ts
tests/verificationDocument.test.ts
scripts/run-tests.cjs
docs/features/AUTHENTICATION_PROFILES.md
docs/features/USER_VERIFICATION.md
docs/superpowers/plans/2026-10-18-phase-1-foundation.md
```

This final report was subsequently created at the user's request as `RENTLEASE_PHASE_1_FINAL_REPORT.md`.

## B. FILES MODIFIED

```text
App.tsx
package.json
package-lock.json
src/features/authentication/services/accountService.ts
src/features/authentication/viewModels/useAuthProfilesViewModel.ts
src/features/user-verification/models/Verification.ts
src/features/user-verification/viewModels/useUserVerificationViewModel.ts
src/features/user-verification/components/DocumentPreviewPicker.tsx
src/features/user-verification/views/TierTwoVerificationView.tsx
src/features/user-verification/views/TierThreeVerificationView.tsx
src/shared/services/supabase/database/README.md
docs/ARCHITECTURE.md
docs/BACKEND_CONTEXT.md
docs/FRONTEND_CONTEXT.md
docs/AUTH_SUPABASE_INTEGRATION.md
docs/FEATURES.md
docs/ROUTES.md
```

No additional application changes were made while preparing this final report.

## C. AUTH/PROFILE STABILIZATION

- Existing Auth/Profile flows and layouts were retained rather than rewritten.
- Added root account synchronization driven by Supabase Auth events.
- Successful sign-in, phone update/verification, manual Tier 1 refresh, role selection and profile save reload authoritative account data before applying route decisions.
- Profile save no longer blindly sets the screen to Profile. The refreshed account may instead require restricted, email-confirmation, phone/Tier 1, role-selection or Admin-capable routing.
- Same-account background refreshes preserve editor/OTP presentation when the routing destination remains unchanged. Unsaved profile editor fields are not overwritten in that case.
- Workspace entry is triggered by identity or permitted-workspace changes rather than every token refresh. The workspace Modal is keyed by account ID so feature-local state is remounted across identity changes.
- Existing routing precedence remains: non-active account first; active Admin bypass; ordinary email confirmation; ordinary Tier 1; missing ordinary roles; ordinary workspace.
- Safe direct profile writes remain limited to display_name and bio. No protected profile fields are written. Avatar upload/editing was not added.
- Generated update_my_profile and refresh_my_tier1_verification RPCs remain available but unused.
- The singleton remains SupabaseClient<Database>; generated types and backend configuration were not modified.

Status: IMPLEMENTED; RUNTIME-UNVERIFIED.

## D. AUTH STATE SYNCHRONIZATION

### Authoritative state owner

App mounts one useAuthProfilesViewModel. Its account snapshot owns the Auth user, profile, full recognized role collection, account status, tier timestamps and trust score. The request coordinator stores request-generation/timer information only, not a second account/session snapshot. Supabase continues to own persisted session/token handling.

### Subscription location and lifecycle

`accountService.subscribeToAccountAuthChanges()` subscribes through the singleton's `auth.onAuthStateChange`. The root ViewModel creates the subscription/coordinator on mount, then bootstraps the account. The callback forwards only the Auth event and user ID and performs no nested asynchronous Supabase call.

### Auth events handled

- INITIAL_SESSION: records event identity; existing bootstrap performs restoration rather than starting a duplicate event load.
- SIGNED_IN, USER_UPDATED, TOKEN_REFRESHED, MFA_CHALLENGE_VERIFIED: schedule relevant background account refresh.
- SIGNED_OUT: immediately clears account-specific state and invalidates older reads.

Handling an MFA event does not introduce an MFA onboarding UI. Password-recovery/OAuth workflows remain deferred.

### Deferred/coalesced refresh

Event loads run through a zero-delay timer after the synchronous Auth callback returns. Nearby notifications replace the queued timer so they share one pending refresh. Each successful load applies the backend account snapshot and derives routing through the existing model.

### Explicit-operation suppression

Auth/account mutations run through the coordinator's mutate wrapper. Notifications emitted during those operations do not schedule an additional account reload; the existing workflow explicitly reloads account state afterward where appropriate. SIGNED_OUT is still processed immediately.

### Sign-out behavior

The existing service calls `auth.signOut({ scope: 'local' })`. Explicit sign-out and SIGNED_OUT clear the account, profile form, role selection, registration/password/phone drafts, cooldown, history and sign-out modal. Root workspace state is cleared through the existing sign-out version signal. Account switching can return to Sign in.

### Cleanup/unmount and stale requests

Cleanup unsubscribes the Auth listener, cancels queued timers, disposes the coordinator and invalidates pending results. Generation checks prevent an older account read from restoring data after sign-out, a newer refresh, an identity change or disposal. In-flight network requests are not physically aborted; their stale results are ignored.

### Duplicate/reload-loop prevention

- Bootstrap owns initial restoration.
- Explicit operations suppress their own notification-triggered duplicate loads.
- Queued events are coalesced.
- Token/sign-in notifications emitted by an active same-identity account read do not recursively reload that read.
- A different signed-in identity invalidates an older load.
- Background failures surface through existing safe Auth notices; no automatic retry loop is started.

Auth events do not provide immediate notification of every server-only profiles/user_roles change. No database Realtime account subscription or polling was introduced.

## E. DOCUMENT PICKER FOUNDATION

### Exact dependencies added

Installed with the official Expo-compatible method:

```text
npx.cmd expo install expo-document-picker expo-file-system expo-crypto --npm
```

| Dependency | Declared range | Installed version | Purpose |
| --- | --- | --- | --- |
| expo-document-picker | ~57.0.3 | 57.0.3 | Single real device picker |
| expo-file-system | ~57.0.7 | 57.0.7 | Binary local-file reads |
| expo-crypto | ~57.0.4 | 57.0.4 | Unique Storage object UUIDs |

Expo FileSystem was previously transitive; it is now a direct dependency for the upload primitive. No second picker library was installed.

### Selected-document model

```ts
interface SelectedDocument {
  uri: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
}
```

The model represents a cached local selection, not a public.verification_documents row. Missing MIME/size are preserved as null rather than invented.

### Device picker service

`selectLocalDocument()` in `src/shared/services/documents/documentPickerService.ts` calls getDocumentAsync with one-file selection, copyToCacheDirectory true and type */*. It immediately normalizes the result and contains no Supabase operation.

No arbitrary backend MIME or file-size limit was added. Selection does not certify backend acceptance.

### Existing UI reused

DocumentPreviewPicker retains the button, filename area and preview container. The existing Tier 2/3 Views and Verification ViewModel now hold real selected local documents. Review screens display the actual local selection. Submission buttons are disabled and labeled Submission not connected.

### Cancellation and errors

- Cancellation returns null and retains an existing selection; it is not a fatal error.
- Concurrent picker launches are guarded.
- Picker results are ignored after ViewModel unmount.
- Failures use the existing lightweight AppError shape with a safe message and retained internal cause.

### Images versus other files

Known image MIME types display the actual local URI. Non-image files, unknown MIME types and failed image previews display a file-selected fallback with available metadata. No PDF viewer was implemented. Cached selections are not persisted across app restarts, and no explicit cache-retention/deletion workflow was added.

Production Verification entry remains disconnected. Choosing/reviewing a file uploads nothing.

## F. STORAGE FOUNDATION

### Contract

- Bucket: `verification-documents` (private).
- Path: `<USER_ID>/<SUBMISSION_ID>/<UNIQUE_FILENAME>`.
- Filename: Expo Crypto randomUUID plus an optional safe lowercase extension. Personal filenames are not embedded in the object key.
- Upload option: `upsert: false`.
- UUID-shaped user/submission identifiers are required. This shape check does not prove a submission exists or belongs to the caller; future orchestration must supply a real existing submission ID, with backend policy authoritative.

### Service API

```ts
uploadVerificationDocument({
  userId,
  submissionId,
  selectedDocument,
})
```

Location: `src/shared/services/supabase/storage/verificationDocumentStorageService.ts`.

The primitive reads the cached file with `new File(uri).arrayBuffer()` from Expo FileSystem. It uploads that binary buffer through the singleton Storage boundary, passing contentType when the picker supplied MIME metadata.

Returned metadata:

```ts
interface UploadedVerificationDocument {
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  size: number;
}
```

Size reflects the uploaded buffer's byte length. Errors retain the internal cause behind a safe message. The whole file is read into memory; native behavior and configured size limits remain runtime-unverified.

### Intentionally not wired

- No UI/ViewModel caller invokes the upload primitive.
- Selection does not upload.
- No submission creation or metadata insertion.
- No status loading or approval simulation for a selected real file.
- No overwrite/replacement/deletion workflow.
- No public or signed document URL generation.
- No Admin document retrieval or review RPC.

## G. TEST RESULTS

Fresh validation was rerun for this final report:

| Command | Result |
| --- | --- |
| npm.cmd run typecheck | Passed; tsc --noEmit; exit 0 |
| npm.cmd test | Passed; node scripts/run-tests.cjs; exit 0 |
| git diff --check | Passed; no whitespace errors |

Total: **27 tests; 27 passed; 0 failed; 0 cancelled; 0 skipped**.

| Test area | Count |
| --- | --- |
| Existing account-routing tests, preserved | 10 |
| New Auth synchronization tests | 9 |
| New document normalization/cancellation/path tests | 8 |

New coverage includes deferred/coalesced callbacks, sign-out invalidation, explicit-operation event suppression, token-refresh loop prevention, queued/in-flight cleanup, newest-request precedence, identity-switch races, background errors, optional file metadata, cancellation, malformed picker success, safe namespaced paths and unique object keys.

The runner uses the existing TypeScript compiler and Node test API without emitting application files. These tests do not emulate a full Supabase integration and do not establish live/native runtime success. Static code review reported no substantive findings.

The package installer reported 23 dependency advisories during installation; no automatic audit fixes were applied.

## H. NEEDS RUNTIME TEST

All items below remain NEEDS RUNTIME TEST:

1. Cold-launch session restoration for Tenant, Landlord, dual-role and Admin accounts; profile/roles must load before destination selection.
2. Signup and backend profile creation without automatic role assignment; confirmation-link waiting/resend; manual return/sign-in.
3. Real Philippine SMS request, invalid/expired code, resend cooldown, six-digit verification, backend Tier 1 synchronization and pending-sync recovery.
4. Tenant, Landlord and both selections through set_user_roles; persistence after restart and presentation-mode switching.
5. Active Admin without ordinary Tier 1 enters Admin; restricted/suspended/deleted accounts, including Admin, remain blocked from workspaces.
6. Token refresh/repeated sign-in notifications while editing Profile or entering OTP do not reset current presentation or reopen the workspace unnecessarily.
7. Sign-out/session loss during account loading cannot restore the old account. Switching identities must not show another account's workspace or form data.
8. Display-name/bio updates persist, and post-save refreshed account status/roles/onboarding determine routing.
9. Network failures and reconnect/retry behavior during bootstrap, account refresh, role save and profile save.
10. In an isolated development harness for the disconnected verification View, select an image, PDF/other file, cancel, choose another local file and trigger picker failure. Confirm metadata, image fallback and no upload/database mutation on selection/review. Do not reconnect legacy Tier 1 or production Verification merely for this test.
11. Verify native modules in the selected Expo Go/development build; rebuild an older development client if required.
12. Once a real submission exists through an authorized later workflow, test private upload, binary integrity, unique namespaced objects, overwrite refusal, authorization failures and Storage errors. Upload success alone must not insert metadata or approve verification.

## I. DEFERRED TO PHASE 2+

- Tier 2 verification_submissions creation.
- verification_documents metadata insertion.
- Tier 2 backend status loading/rejection retrieval.
- Production Verification entry reconnection.
- Admin verification integration: real queue, private retrieval, Start Review and review_verification_submission.
- Tier 3 integration: owned-property loading, correct eligibility, submission and backend status workflow.
- Replacement/deletion, rejected resubmission and complete cancelled/revoked action workflows.

Legacy fake Tier 1 remains disconnected and must not be reused as real verification. Disconnected legacy Tier 2/3 decision functions, static properties and incorrect Tier 3 gating/promotion remain documented as legacy, not authoritative behavior.

## J. REMAINING CONTRACT QUESTIONS

- Exact configured MIME allowlist and maximum upload size.
- Pending document replacement/deletion and partial-workflow cleanup rules.
- Rejected-submission reopening/resubmission lifecycle.
- Authorized private document retrieval and supported non-image viewing behavior.
- Optional additional-information requests and full cancelled/revoked action workflows remain undefined/deferred; no transitions were invented.

The private verification-documents bucket, path convention and upsert false are confirmed. Generated structural table/enum/RPC signatures are available and are not blockers. App-side cache-retention policy is also unresolved, separately from backend authorization.

## K. DOCUMENTATION UPDATED

### Created

- `docs/features/AUTHENTICATION_PROFILES.md`: current account/session ownership, Auth subscription lifecycle, refresh/routing, roles, safe writes, known issues, runtime tests, source references and verification baseline.
- `docs/features/USER_VERIFICATION.md`: local model/picker boundary, private upload contract, selected-file behavior, legacy isolation, deferred integrations, unresolved contracts and runtime tests.
- `docs/superpowers/plans/2026-10-18-phase-1-foundation.md`: completed implementation checklist.

### Modified

- `docs/FEATURES.md`: reduced to a concise feature/status index linking to the living docs. Distinguishes Auth baseline, document foundation, incomplete Tier 2/3 and Admin preview content.
- `docs/ROUTES.md`: no new routes. Corrected stale ordinary Admin Preview access, registration destination, earned-landlord/Tier 3 descriptions; explicitly records disconnected legacy behavior and local selection with disabled submission.
- `docs/ARCHITECTURE.md`: typed singleton/generated type location, root account synchronization, current routing mechanism and service-based Expo document foundation.
- `docs/BACKEND_CONTEXT.md`: replaced affected empty-scaffold/missing-structural-contract claims; records known verification Storage contract and actual unresolved limits/lifecycle.
- `docs/FRONTEND_CONTEXT.md`: pointers to living feature docs and canonical generated contract.
- `docs/AUTH_SUPABASE_INTEGRATION.md`: current synchronization/profile-save behavior, exact local sign-out scope, authoritative refresh after phone request, generated contract availability, deferred verification boundary and runtime limitations.
- `src/shared/services/supabase/database/README.md`: points to ../database.types.ts instead of suggesting a duplicate future contract.

### Intentionally unchanged

- `docs/FIGMA_WORKFLOW.md`: existing visual workflow remains applicable; no redesign was performed.
- `RENTLEASE_DATABASE_CONTRACT_SANITY_CHECK.md` and `RENTLEASE_UI_COVERAGE_AUDIT.md`: historical inspection snapshots, preserved rather than rewritten as current feature state.
- Unaffected feature route tables and global backend/ML/security boundaries remain applicable and were retained.
- Generated database.types.ts and typed client implementation were retained unchanged.

**The living feature docs accurately describe the Phase 1 implementation.** They explicitly mark device/live behavior RUNTIME-UNVERIFIED and Tier 2/3/Admin workflows DEFERRED or PREVIEW/LEGACY. Last Verified date is 2026-10-18; commit baseline is 9849232220536e13da71e487f711a3b7993ad249 plus uncommitted Phase 1 changes. That commit hash does not include this phase.

## GIT STATUS SUMMARY

HEAD: `9849232220536e13da71e487f711a3b7993ad249`.

No commit was created. All Phase 1 changes remain unstaged/untracked. Git reported the following modified/untracked files immediately before this report was saved; this report is an additional untracked file.

```text
 M App.tsx
 M docs/ARCHITECTURE.md
 M docs/AUTH_SUPABASE_INTEGRATION.md
 M docs/BACKEND_CONTEXT.md
 M docs/FEATURES.md
 M docs/FRONTEND_CONTEXT.md
 M docs/ROUTES.md
 M package-lock.json
 M package.json
 M src/features/authentication/services/accountService.ts
 M src/features/authentication/viewModels/useAuthProfilesViewModel.ts
 M src/features/user-verification/components/DocumentPreviewPicker.tsx
 M src/features/user-verification/models/Verification.ts
 M src/features/user-verification/viewModels/useUserVerificationViewModel.ts
 M src/features/user-verification/views/TierThreeVerificationView.tsx
 M src/features/user-verification/views/TierTwoVerificationView.tsx
 M src/shared/services/supabase/database/README.md
?? RENTLEASE_DATABASE_CONTRACT_SANITY_CHECK.md
?? RENTLEASE_UI_COVERAGE_AUDIT.md
?? RENTLEASE_PHASE_1_FINAL_REPORT.md
?? docs/features/AUTHENTICATION_PROFILES.md
?? docs/features/USER_VERIFICATION.md
?? docs/superpowers/plans/2026-10-18-phase-1-foundation.md
?? scripts/run-tests.cjs
?? src/features/authentication/viewModels/accountSynchronization.ts
?? src/shared/models/SelectedDocument.ts
?? src/shared/services/documents/documentPickerService.ts
?? src/shared/services/supabase/storage/verificationDocumentPath.ts
?? src/shared/services/supabase/storage/verificationDocumentStorageService.ts
?? tests/accountSynchronization.test.ts
?? tests/verificationDocument.test.ts
```

The two audit reports predate Phase 1 implementation. They are listed because they remain untracked in the current workspace. Git inspection also emitted local ignore-file permission and LF/CRLF notices; status enumeration succeeded.
