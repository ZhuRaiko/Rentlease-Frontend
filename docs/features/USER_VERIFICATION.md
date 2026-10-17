# User Verification

## Purpose and feature boundary

Own optional Tier 2 identity and Tier 3 property-document verification presentation and future workflows. Architecture follows [ARCHITECTURE.md](../ARCHITECTURE.md). Authentication onboarding owns active Tier 1; see [AUTHENTICATION_PROFILES.md](AUTHENTICATION_PROFILES.md).

This phase establishes shared local document selection and a reusable private upload primitive only. It does not implement submission creation, document metadata insertion, status queries, owned-property loading, or Admin review.

## Tier 1 boundary

Active Tier 1 remains Supabase email confirmation plus six-digit phone_change SMS OTP and backend-derived `tier1_verified_at`. Tier 1 does not use verification_submissions.

PREVIEW/LEGACY: `TierOneVerificationView.tsx` and the four-digit OTP flow remain disconnected from the application root. They must not be reconnected as real verification.

## Local selected-document foundation

IMPLEMENTED, RUNTIME-UNVERIFIED:

- One picker: `expo-document-picker ~57.0.3`, installed using Expo's SDK-compatible installer.
- `documentPickerService.selectLocalDocument()` invokes one-file selection with `copyToCacheDirectory: true` and `type: '*/*'`. It normalizes the picker result immediately.
- `SelectedDocument` contains `uri`, `fileName`, nullable `mimeType`, and nullable byte `size`. It is local frontend state, not a verification_documents Row.
- Cancellation returns null and retains any previous selection. Missing success assets/failures become safe AppError messages with the original cause retained internally.
- `useUserVerificationViewModel` owns Tier 2/3 local selections, prevents concurrent picker calls, and ignores picker results after unmount.
- Existing `DocumentPreviewPicker` button, filename area and preview container are reused. Image MIME types use the real local URI; non-image/failed-image previews use a file-selected fallback and metadata. No PDF viewer is implemented.
- Tier 2/3 review screens show the selected local file. Their submit buttons are disabled and labeled Submission not connected, so a real file cannot generate a fake submitted result through those buttons.
- Production Profile Verification still shows the existing limitation notice; this phase does not expose the preview flow through navigation.

Selected files are cached local resources, not durable submissions. The foundation does not delete the user's original file, persist selections across restarts, or implement cache retention cleanup.

## Picker/service boundary

View → Verification ViewModel → device document picker service → Expo picker.

The picker service imports no Supabase client. A separate Storage service reads/uploads bytes later. No View directly accesses Supabase. File selection invokes no upload, submission insert or metadata insert.

## Private Storage contract and primitive

Confirmed business contract supplied for Phase 1:

- Private bucket: `verification-documents`.
- Object path: `<USER_ID>/<SUBMISSION_ID>/<UNIQUE_FILENAME>`.
- `upsert: false`.
- No public verification-document URLs.

IMPLEMENTED, RUNTIME-UNVERIFIED: `uploadVerificationDocument({ userId, submissionId, selectedDocument })` in `verificationDocumentStorageService.ts`:

1. Requires UUID-shaped user/submission IDs; caller must already hold a real persisted submission ID.
2. Uses Expo Crypto randomUUID for a unique object basename. A safe extension may be retained; the original personal filename is not embedded in the path.
3. Reads the cached file as an ArrayBuffer using Expo FileSystem and uploads through the existing typed singleton Storage boundary.
4. Uses the confirmed private bucket and `upsert: false`; passes MIME metadata when available.
5. Returns storagePath, original fileName, nullable mimeType and actual uploaded byte size.
6. Preserves failure causes internally while exposing a safe error message.

UUID shape checks do not prove a submission exists or belongs to the caller. The future orchestration must supply that real ID; backend policy remains authoritative. No current UI or ViewModel calls this upload primitive.

The primitive creates no database rows, replaces/deletes no objects, and generates no public/signed URLs. It loads the whole selected file into memory; configured upload-size limits and native memory behavior need validation.

## Confirmed structural backend contract

Use `src/shared/services/supabase/database.types.ts` directly:

- verification_submissions: required Insert tier and user_id; optional/nullable property_id becomes required by the Tier 3 business rule.
- verification_documents: required Insert document_type, storage_path, submission_id; optional filename/MIME metadata.
- verification_tier: tier_2_identity and tier_3_property only.
- verification_status: pending, under_review, approved, rejected, cancelled, revoked.
- properties.landlord_id provides ownership association for a later minimal selector.
- review_verification_submission signature exists but is not invoked in this phase.

Future workflow remains: create submission → upload private object → insert metadata → load backend status. Structural types do not establish RLS, allowed transitions, trigger side effects or MIME/size configuration.

## Current integration status

| Area | Status |
| --- | --- |
| Local device document model/picker/UI adapter | IMPLEMENTED; RUNTIME-UNVERIFIED |
| Shared private upload primitive | IMPLEMENTED; no production caller; RUNTIME-UNVERIFIED |
| Tier 2 submission creation | DEFERRED; NOT INTEGRATED |
| verification_documents metadata insertion | DEFERRED; NOT INTEGRATED |
| Tier 2 status loading/rejection retrieval | DEFERRED; NOT INTEGRATED |
| Production Verification entry reconnection | DEFERRED |
| Tier 3 owned properties/submissions | DEFERRED; NOT INTEGRATED |
| Admin queue/private retrieval/review RPC/Start review | DEFERRED; NOT INTEGRATED |

## Known legacy issues

PREVIEW/LEGACY: the disconnected verification flow still contains fake Tier 1 completion, local decision/status functions, static properties, display-label document types, Tier 2-before-Tier 3 gating, and onLandlordVerified/local actor promotion. These must not be reused as authoritative behavior. The new document foundation does not validate those legacy rules.

Actual Tier 3 prerequisites are an authenticated Tier 1-verified existing landlord with an owned property; Tier 2 is not required, and Tier 3 grants no role. Admin review UI remains static with local mutations and unsupported Additional information requested behavior. No backend integration was added to it.

## Unresolved decisions

- Exact bucket MIME allowlist and maximum upload size: UNRESOLVED. Picker acceptance is not backend validation.
- Document replacement/deletion and cache-retention lifecycle: UNRESOLVED; no upsert-based replacement invented.
- Rejected-submission resubmission, additional-information requests, and cancelled/revoked action workflows: UNRESOLVED/DEFERRED.
- Private document retrieval/viewing mechanism and accepted non-image formats need confirmation before Admin viewing integration.

The bucket and object path are confirmed, not unresolved.

## Runtime tests still needed

1. In an isolated development harness for the existing disconnected View, select an Android image, PDF/other file, cancel, replace a local selection, and trigger picker failure. Do not reconnect legacy Tier 1 or the production entry merely to test selection.
2. Confirm actual filename/MIME/size, image fallback, local-only behavior and no upload/network mutation on choosing/reviewing a file.
3. Verify new native modules in the chosen Expo Go/development build; rebuild a development client if its native module set is older.
4. Once a real submission exists through an authorized future workflow, verify authenticated private upload, safe user/submission path, unique keys, overwrite refusal, binary integrity and RLS failures.
5. Confirm that upload success alone does not mark verification submitted/approved or insert metadata.

## Relevant files

- `src/shared/models/SelectedDocument.ts`
- `src/shared/services/documents/documentPickerService.ts`
- `src/shared/services/supabase/storage/verificationDocumentPath.ts`
- `src/shared/services/supabase/storage/verificationDocumentStorageService.ts`
- `src/shared/services/supabase/storage/storageService.ts`
- `src/features/user-verification/models/Verification.ts`
- `src/features/user-verification/viewModels/useUserVerificationViewModel.ts`
- `src/features/user-verification/components/DocumentPreviewPicker.tsx`
- `src/features/user-verification/views/TierTwoVerificationView.tsx`, `TierThreeVerificationView.tsx`
- `tests/verificationDocument.test.ts`

## Relevant Git history

`05c70bd` introduced verification/Admin preview UI. `af9778f` disconnected the unsafe verification entry while integrating Auth. `9849232` added generated types. Phase 1 foundation changes are uncommitted.

## Last Verified

Date: 2026-10-18.

Commit baseline: `9849232220536e13da71e487f711a3b7993ad249` plus uncommitted Phase 1 changes; the baseline hash does not include this phase.

Verification status: TypeScript check passed; `npm.cmd test` passed 27 tests, including local document normalization/cancellation and safe object-key tests. No device picker, native file read, Storage upload or live verification workflow was tested. All remain RUNTIME-UNVERIFIED / NEEDS RUNTIME TEST.
