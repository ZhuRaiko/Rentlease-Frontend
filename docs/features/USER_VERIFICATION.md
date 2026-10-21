# User Verification

## Purpose and boundary

Admin work is documented in [Admin Verification](ADMIN_VERIFICATION.md). The user reports successful Tier 2 submission/private upload/metadata, Admin queue/detail/private image viewing and approval in the Android development build. This checkpoint does not verify rejection or all failure cases. Tier 3 landlord property verification and minimal Admin Tier 3 review compatibility are now IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Non-image Admin viewing remains deferred.

Optional Tier 2 identity verification has a normal-user backend-connected flow. Status: **IMPLEMENTED, AUTOMATED-TESTED; Passport submission/upload/metadata USER-REPORTED Android PASS** at the 2026-10-20 checkpoint. Broader mappings, negative cases and recovery still require validation. Follow [ARCHITECTURE.md](../ARCHITECTURE.md); Authentication owns Tier 1 in [AUTHENTICATION_PROFILES.md](AUTHENTICATION_PROFILES.md).

Neither Tier 2 nor Tier 3 replaces Tier 1 or assigns Tenant, Landlord or Admin. Document replacement, resubmission and additional-information workflows remain DEFERRED. Existing backend triggers update profile verification timestamps and database-derived trust. Submission integration changes no schema, RLS, function or infrastructure. The shared zoom viewer's native gesture dependency is described below.

## Entry, UI and ownership

Profile ? Verification opens the existing root workspace/Modal and verification overview. The Notifications verification action opens the same flow. Only existing permitted ordinary marketplace accounts can enter; active Admin routing and restricted/onboarding precedence are unchanged.

`useTierTwoVerificationViewModel` composes the feature's testable `tierTwoVerificationWorkflow`, authenticated data service, existing device picker and existing Storage primitive. The workflow owns loading, selected ID/document, submission, picker/submitting/error/refresh state. Views call ViewModel actions; they contain no backend clients.

The existing overview, Tier 2 Views, cards/scaffold and DocumentPreviewPicker are reused. Tier 1 remains a read-only indication of the root account timestamp. Tier 3's card opens a separate property workflow for Tier 1-verified landlords, including accounts with both Tenant and Landlord roles regardless of their current UI mode. Tier 2 is not a prerequisite. Root Auth supplies presentation eligibility; the Tier 3 service independently checks Auth, own active profile/Tier 1 and landlord role. No legacy Tier 1 OTP/completion or local approval/role-promotion path is connected.

Back follows the Tier 2 screen sequence; overview Back/Close returns to Profile. Both visible controls and Android Modal Back are guarded during selection/submission. Unmount invalidates asynchronous results and prevents subsequent workflow steps, but cannot abort an operation already sent. Development effect cleanup/setup can reload without accepting an obsolete mount's result.

## Tier 3 landlord property verification

`useTierThreeVerificationViewModel` composes the testable `tierThreeVerificationWorkflow`, `tierThreeVerificationService`, existing picker and unchanged private uploader. The workflow owns intro/property/document/review/status state, selected property/type/file, real submission, loading/errors and double-submit prevention. The flow View owns only which tier is visible. Enabling Tier 3 loads current data; returning to overview clears its local selections and invalidates pending results while preserving mounted subscriptions. Disposal is reserved for unmount. Android Back follows the Tier 3 steps; intro Back returns to verification levels. Selection/submission blocks navigation; loading can be closed through the workspace Close action, invalidating results.

The service retrieves properties with an explicit `landlord_id = authenticatedUserId` filter even though property RLS can allow public reads. It projects only id/landlord_id/property_type/barangay/city; there is no generated property title/address field, and no private-location query. The selector shows real type, barangay, city and ID. Only returned owned property IDs can be selected. Ownership and account eligibility are rechecked before submission; the backend remains authoritative. Empty results show that an existing owned property is required, without fake properties or a new property-creation integration.

| Tier 3 UI document | Generated enum |
| --- | --- |
| Land Title | land_title |
| Tax Declaration | tax_declaration |
| HOA Document | hoa_document |
| Authorization to Lease | authorization_to_lease |

Neither `other` nor identity documents qualify. These document categories are distinct from MIME types: the existing picker retains its file-selection behavior, including non-image files with metadata fallback. Admin PDF/non-image rendering remains unsupported.

For each selected property, read the current user's latest tier_3_property submission, ordered submitted_at/id descending and limited to one. Display its exact backend status, submitted/reviewed timestamps, review note and rejection reason. Any existing row blocks creation for that property, including pending/under_review/approved and incomplete requests. Rejected/cancelled/revoked rows are shown without a resubmission path. Another owned property can be selected independently.

Submit repeats identity/ownership/latest-submission checks, inserts exactly `{ user_id, tier: 'tier_3_property', property_id }`, then calls the existing private uploader with the created ID, inserts document metadata, and re-fetches/validates the created submission and attachment before finishing. No status/review/role/profile/trust/timestamp fields are written. The unchanged Storage contract is private verification-documents, `<USER_ID>/<SUBMISSION_ID>/<UNIQUE_FILENAME>`, `upsert: false`, ArrayBuffer upload and no public URL.

Failure handling is stage-specific. A created submission followed by upload failure is incomplete; metadata failure can leave an orphan object. Uncertain writes require refresh, not automatic retry, deletion or rollback. Local guards/preflight prevent ordinary duplicates but live indexes contain no uniqueness constraint for user/property/tier: simultaneous cross-device creation remains a backend-level unresolved risk. No backend redesign is included.

Read-only live inspection on 2026-10-21 confirms Tier 3 INSERT RLS requires self, Tier 1, landlord, non-null property and pending/default review fields. validate_verification_submission additionally checks the property belongs to that landlord. Properties SELECT is owner-or-publicly-viewable, so the explicit service owner filter matters. Document INSERT is owner-submission pending/under_review; the bucket remains private. The live review_verification_submission includes the user-supplied require_qualifying_tier3_document_on_approval rule: approval requires one of the four qualifying metadata types above. The existing timestamp trigger derives tier3_verified_at, and trust_score adds 0.20 for Tier 3; no client promotion or manual profile update occurs. Generated structures used by this flow match the inspected contract; older docs deferring Tier 3 and describing approval as any-document-only were stale. This is read-only structural/business-rule evidence, not runtime or denied-access test acceptance.

Admin queue/filter/property metadata and private-image viewing are reused. Its existing confirmation/rejection/controller path now accepts Tier 3, labels confirmation and success by actual tier, and calls the same review RPC. The backend, not a client type label, enforces qualifying proof. Tier 2 rejection/resubmission was not added or runtime-tested in this task. Existing verified Tier 2 approval records were not modified.

## Supported identity documents

| UI selection | Generated verification_document_type |
| --- | --- |
| Driver?s License | drivers_license |
| UMID | umid |
| Passport | passport |
| National ID / PhilSys ID | philsys_id |

SSS/Student IDs and property-document types are not in the production selector. No implicit `other` mapping exists.

## Real local document selection

The Phase 1 `selectLocalDocument()` service uses Expo DocumentPicker, one file, `copyToCacheDirectory: true`, `type: '*/*'`. No new picker was added. `SelectedDocument` is local state: URI, filename, nullable MIME and byte size. Cancellation is non-error and preserves the previous selection. Picker failures show safe copy. Supported JPEG/JPG/PNG/WebP MIME types render the local URI; unsupported/failed-image previews show filename/metadata fallback. There is no PDF viewer.

Selection/review performs no upload or database mutation. Cached selections are not persisted across restarts and are not a cache-retention policy. The user's original file is not deleted.

## Shared fullscreen zoom preview

Status: **IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**. Prior document upload/viewing acceptance does not validate the new gestures or nested fullscreen Modal.

Tier 2 local ID selection and review, Tier 3 local property-proof selection and final review, and Admin signed-image viewing share `src/shared/components/FullscreenDocumentImage.tsx`. `DocumentPreviewPicker` opens it when the image itself is tapped, with a visible tap-to-inspect hint. Tier 3's Review document button still navigates to the submission confirmation step. No submission/action button was repurposed for zoom.

Supported image MIME types are image/jpeg, image/jpg, image/png and image/webp, using a shared predicate in `src/shared/models/documentImagePreview.ts`. Unknown MIME, PDFs, GIF/SVG and failed inline images keep filename/metadata fallback; no image type is guessed from the filename. File selection/upload behavior is unchanged. Fullscreen decoding failure shows safe copy and supports Close/reopen.

The viewer uses Expo-SDK-selected `react-native-gesture-handler ~2.32.0` plus React Native Animated. A GestureHandlerRootView is contained inside its Modal for Android. Pinch zooms from fit (1x) to 8x around the moving focal point; one-finger drag pans enlarged content within fitted-image bounds; double-tap switches between 3x and fit. Reset zoom restores fit. The image remains contained without stretching and requests native scaling rather than thumbnail downsampling. Readability is still limited by source resolution and native memory/performance; these require Android checks. There is no Reanimated/worklets dependency, Babel plugin or navigation change. Gesture callbacks run on the JS thread.

Visible Close and the Modal's Android onRequestClose invoke only preview dismissal. The local reducer stores temporary presentation state; closing does not change the selected file, document type, property or verification step, nor call picker/upload/submission/metadata/status services. Busy selection/submission closes/disables local preview; changed/removed documents cannot display a stale source. Closing, source changes and fresh opens discard image/zoom/pan state; layout changes reset fit. Only numeric reset keys are used, and no URI/URL is logged, persisted, shared or saved to a gallery. Existing native image caching behavior is not a custom persistent cache policy.

`package.json`/`package-lock.json` add the one native gesture dependency. An installed development build from before this dependency must be rebuilt and reinstalled; Metro reload/OTA alone cannot add its native module. No native build or Android runtime test was performed in this pass. No Supabase calls, Storage permissions or document workflow logic changed.

Tests cover local reducer open/close/source changes and form preservation, fitting/zoom bounds/focal movement/edge drift/panning, callback wiring for Android Modal Back and Close, and Tier 2/Tier 3/Admin no-write regressions alongside existing Admin signed-URL lifecycle tests. These are Node model/orchestration and source-wiring checks, not native gesture execution.

Manual Android checks after rebuilding: on Tier 2 selection and review, tap a sharp ID image; pinch small text, pan, double-tap, Reset, Close and hardware Back. Confirm file/type/step are unchanged and no upload occurs. Repeat on Tier 3 selection and final review, retaining property/type/file and confirming Review document still advances separately. Select another image and reopen: expect fit with no previous offsets; rotate/resize and inspect portrait/landscape images. Test a PDF/unknown MIME fallback and image error. As Admin, open a real private image, zoom/pan, Back/Close/reopen for a fresh signed link, then confirm submission status and review fields are unchanged. Check offline/expired-link errors, late responses and account/navigation cleanup using existing safe error behavior. All new native interactions remain RUNTIME-UNVERIFIED.

## Database and Storage workflow

Canonical structure: `src/shared/services/supabase/database.types.ts`. `createTierTwoVerificationService` uses the existing `SupabaseClient<Database>` singleton through injection. It resolves identity with `auth.getUser()` and rechecks it before queries/writes. No View supplies a trusted user ID.

1. Load the current user's latest `verification_submissions` where `tier = tier_2_identity`, ordered by `submitted_at DESC, id DESC`, limited to one with `maybeSingle`. Historical rows do not cause a multiple-row error. Select only id/status/rejection_reason/review_note/submitted_at/reviewed_at and related document IDs to determine attachment presence.
2. When none exists, allow ID/document selection. Disable Submit unless selection is valid, initial loading succeeded, no refresh is required and no picker/load/submit action is active.
3. On Submit, synchronously exclude duplicate actions, resolve Auth identity and repeat the latest-submission check. Any existing row blocks new creation in this phase.
4. Insert exactly `{ user_id: authenticatedUserId, tier: 'tier_2_identity' }`; omit property_id, status, timestamps and all review fields, relying on backend defaults. Return the created ID/status projection.
5. Recheck identity and call the existing `uploadVerificationDocument` with authenticated user ID, created submission ID and real selected document.
6. Insert `verification_documents` with exactly submission_id, document_type, storage_path, file_name and mime_type. There is no file_size field.
7. Re-fetch the latest real submission and confirm an attachment before finishing without error. Display its backend status; never approve locally.

The reused uploader targets private bucket `verification-documents`, path `<USER_ID>/<SUBMISSION_ID>/<UNIQUE_FILENAME>`, with Expo Crypto randomUUID and a safe filename extension. It reads an ArrayBuffer through Expo FileSystem, uploads with `upsert: false`, passes known MIME metadata and returns storagePath/original fileName/nullable mimeType/actual size. It returns no public or signed URL. The whole file is read into memory; native memory behavior and actual configured upload limits require testing.

## Status and refresh behavior

| Backend status | Production behavior |
| --- | --- |
| No submission | Allow initial ID/document flow after successful load |
| pending | Pending; no duplicate creation |
| under_review | Under Review, retained as a distinct backend value; no duplicate |
| approved | Approved; no new submission or role mutation |
| rejected | Rejected with actual rejection_reason when present; no resubmission |
| cancelled | Cancelled; no invented restart behavior |
| revoked | Revoked; no invented restart behavior |

Review note and submission/review dates are shown when available. Status refresh is manual on overview/status/error presentation and runs on feature mount; no Realtime subscription, polling, review RPC or private document retrieval is added. Reopening loads backend state rather than persisting a local decision.

Submitted/reviewed dates in both Tier 2 and Tier 3 status Views now reuse src/shared/utils/formatVerificationDate.ts, also used by Admin queue/detail dates. It displays explicit Asia/Manila time with a 12-hour AM/PM clock, seconds and PHT label, independent of emulator/device timezone. UTC storage and workflow state are unchanged. The 2026-10-21 investigation confirmed the emulator was set to GMT and previous bare toLocaleString() calls followed that setting. The supplied 2026-10-21T11:41:27.883577+00:00 instant now formats as Oct 21, 2026, 7:41:27 PM PHT. Native rendering of the correction is RUNTIME-UNVERIFIED; compare submitted/reviewed dates on both GMT and Manila-configured devices, including next-day boundaries. Seven new tests and the full 166-test suite pass; see Admin Verification for timestamp coverage and evidence limits.

## Failure and partial-state behavior

The insert ? Storage upload ? metadata insert workflow is **not atomic**. Failed Auth/preflight/load, create, upload, metadata or final refresh shows a stage-specific error; required steps cannot fail and still produce a success outcome. Uncertain writes require a refresh before another attempt.

A known created submission blocks duplicate creation even when a later upload/metadata step fails. Existing submissions with no visible document metadata are flagged as potentially incomplete, including after reopen. This is an attachment-presence check under RLS, not proof of upload integrity or a backend readiness flag. A network response may be lost even when a write succeeded; error copy distinguishes an unconfirmed result. Final refresh failure preserves error presentation instead of claiming status confirmation.

No automatic object/row deletion, replacement, metadata retry or new submission is invented. Failures/termination after insert can leave a submission without an attachment; failures after upload can leave a private orphan object. These require a future supported backend recovery policy. Closing during an already-sent operation cannot cancel that remote write.

Local exclusion and fresh preflight reduce duplicates but do not provide cross-device transactional uniqueness. Read-only inspection found only the primary-key unique index plus nonunique status/queue indexes, not a user/property/tier uniqueness constraint. Backend enforcement remains authoritative; no new constraint or recovery policy was invented.

## Security and backend evidence

Temporary development diagnostics: the user reported that submission insertion succeeds but no Storage object/metadata appears. `[TIER2-DIAG]` now traces Auth, submission insert, file read, Storage upload, metadata insert and final workflow outcome, including sanitized raw errors before existing error conversion. The helper runs only under `__DEV__`; it omits full local URIs, contents, tokens, headers and arbitrary error objects. Filenames, submission IDs and Storage object paths are intentionally included for this temporary diagnostic. Production logging is silent. This instrumentation does not change the workflow or establish a root cause/fix; remove it after diagnosis. Four logger safety tests supplement the preserved 70 tests.

Subsequent user runtime evidence in **Expo Go** isolates failure before Storage: native `FileSystemFile.bytes` rejects with `ERR_INVALID_PERMISSION` / missing READ. Inspection confirms `copyToCacheDirectory: true`, single-file selection and exact `assets[0].uri` preservation; the uploader already uses `File.arrayBuffer()`. Installed expo-file-system 57.0.7 implements arrayBuffer by calling bytes internally, so that method name does not indicate a direct bytes call in RENTLEASE. No URI-loss bug was found. This historical failure was followed by the user-reported successful Android Passport submission/upload/metadata checkpoint on 2026-10-20. The original native cause was not established; an Expo Go scope defect remains a hypothesis. No broad Android permissions, base64 fallback or speculative URI rewriting was added. FILE_READ_SUCCESS now records the actual buffer constructor name. A regression check explicitly covers cached URI preservation. Inspection alone did not establish Android read/upload success; the later user checkpoint supplies that runtime evidence.

For the repeated failure investigation, SUBMIT_START and UPLOAD_ENTER now emit only uriScheme and isCacheUri. The latter checks for a `/cache/` path segment (ignoring query/fragment); it does not prove that Expo Go grants access to that cache location. No full or partially identifying URI prefix is logged. This remains diagnostic-only; reading/upload/status behavior is unchanged.

Normal-user payloads do not contain status, reviewed_by, approval/review fields, trust score or roles. No role RPC/review RPC is called. No private URLs, privileged keys, document/token logs or RLS bypass was introduced. Auth/identity checks are defense in depth, not authorization substitutes.

The repository now includes the Admin queue RPC migration. Read-only live inspection confirms the private bucket and owner-or-Admin Storage SELECT policy; an authenticated non-owner saw zero matching objects and an Admin saw one. See [Admin Verification](ADMIN_VERIFICATION.md) for scope. The user reports successful Android Passport submission/upload/metadata. These observations do not validate every write policy, negative case or native image-viewing flow. This is a development review, not formal MASVS/MASTG security validation.

## Deferred and unresolved

- DEFERRED: non-image Admin viewing, document replacement, rejected/cancelled/revoked resubmission, additional-information requests and property-creation backend integration. Tier 3 submission and Admin compatibility are implemented but await Android testing. Tier 2 rejection is outside this task.
- UNRESOLVED: project-wide upload limits, deletion/replacement/partial-state recovery policy and cache-retention lifecycle. Read-only bucket inspection shows allowed_mime_types and file_size_limit are null (no per-bucket values); it does not establish project-wide limits or native memory capacity. No arbitrary client limits were invented.
- PREVIEW/LEGACY: `useUserVerificationViewModel`, `Verification.ts` and TierOneVerificationView retain disconnected prototype logic. TierThreeVerificationView has been repurposed for the real property workflow and imports no preview properties. Do not reconnect fake Tier 1, Tier 2 decision simulation or Tier 3 actor promotion.
- Existing Tier 3 business boundary remains an authenticated Tier 1-verified landlord with an owned property; Tier 2 is not required and Tier 3 grants no role.

## Android/live runtime tests still needed

1. Regression: use an ordinary account and open Profile -> Verification -> Tier 2; confirm the existing four ID options and read-only Tier 1. Tier 3 is locked for Tenant-only accounts, available to Tier 1-verified landlords, and does not require Tier 2.
2. Select/cancel an image and PDF; check filename, real image/fallback, retained selection on cancel, no DB/object writes until Submit, and Back/reopen behavior.
3. Submit a valid selection and tap Submit rapidly. Expect one created submission, private user/submission object with a unique key, one correct metadata row, then actual Pending/other returned status. Check no property_id/review/role/trust fields were written by the client. Test Android Back during submission.
4. Reopen and manually refresh existing pending, under_review and approved records. Using authorized backend/Admin preparation separately, also inspect rejected with reason, cancelled and revoked records. No state should offer automatic resubmission or preview approval.
5. Test offline initial load and preflight, reconnect/Refresh, unauthenticated/expired identity, denied RLS and authorized controlled upload/metadata failures. Expect error and truthful incomplete state; never automatic cleanup/recreation. Avoid real sensitive IDs during tests.
6. Test separate accounts: no other user's submissions/documents, no private public URL, account switch clears UI; restricted/Admin entry behavior is unchanged. Confirm actual private policies separately; unit tests cannot establish RLS.
7. Tier 3: use an active Tier 1 landlord with an existing backend property; confirm only owned properties, select one, pick one supported ownership/authorization type and real file, cancel/reselect, review and Submit once/rapidly. Expect one property-linked submission, private object, qualifying metadata and refreshed Pending. Close/reopen -> same property -> existing status, without a duplicate.
8. Exercise no-property, offline/denied/expired identity, account switch and partial upload/metadata failures. No invented success, automatic retry/deletion or property creation. Reopen Tier 3 from overview repeatedly and verify loading/selection/status still update.
9. Admin -> Tier 3 -> property detail/private image -> Start review -> confirm -> Approve -> confirm, on a new Tier 3 test record only. Expect real queue removal, derived tier3_verified_at/trust and landlord status after refresh; inspect rejected/reason only with a separate record. Do not change the existing approved Tier 2 record. Approval of identity/other-only proof must fail at the backend. Native image/error, denied-access and side-effect timing still need live testing.

## Relevant sources and verification record

Production: `App.tsx`, Authentication Profile/Flow callback, TierTwoVerification and TierThreeVerification models/services/workflows/hooks, UserVerificationFlowView/VerificationOverviewView/TierThreeVerificationView and existing Tier 2 Views/components, shared SelectedDocument/picker/Storage primitive and generated database.types.ts. Admin compatibility changes are confined to its existing queue controller and verification detail View.

Tests: preserved Tier 2/account/routing/diagnostic/document/path/Admin tests plus tierThreeVerification.test.ts and tierThreeVerificationService.test.ts. Contracts cover properties, profiles, user_roles, verification_submissions, verification_documents and their generated enums; normal-user services do not call the review RPC.

Last Verified Date: 2026-10-21 (Asia/Singapore). Last Verified Commit baseline: `6578b6e` plus uncommitted changes; the baseline does not contain this implementation. Tier 2 submission/upload/metadata/Admin viewing/approval: USER-REPORTED Android development-build PASS. Tier 3: IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Broader failures/rejection/recovery and profile/account refresh timing still need runtime checks. No live writes or Android submissions were performed by the agent. Tier 3 baseline: npm.cmd run typecheck passed; npm.cmd test passed 148/148 (33 new tests plus one existing Admin Tier 3 expectation updated). Latest shared zoom pass: typecheck passed; full suite passed 159/159 with zero failures/skips/cancellations, including 11 new preview/gesture/model/wiring/no-write tests. Coverage includes eligibility, owner filters, empty properties, mappings, exact payloads, status/duplicate handling, partial failures, picker recovery, account changes, disposal, enable/reopen subscriptions and Admin compatibility. Expo install --check reports dependencies up to date after network access was available; the earlier network-restricted attempt failed and its offline fallback was explicitly less reliable. git diff --check and git diff --cached --check passed. The shared zoom pass also passed the online Expo dependency check and Android Metro/Hermes export to a temporary directory after the sandbox compiler restriction was resolved. This export is JavaScript/asset validation, not an APK build or native runtime acceptance. No report file was created.
