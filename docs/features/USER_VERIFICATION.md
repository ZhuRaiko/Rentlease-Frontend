# User Verification

## Purpose and boundary

Admin work is documented in [Admin Verification](ADMIN_VERIFICATION.md). The user reports successful Tier 2 submission/private upload/metadata, Admin queue/detail/private image viewing and approval in the Android development build. This checkpoint does not verify rejection or all failure cases. Tier 3 landlord property verification and minimal Admin Tier 3 review compatibility are now IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Non-image Admin viewing remains deferred.

Optional Tier 2 identity verification has a normal-user backend-connected flow. Status: **IMPLEMENTED, AUTOMATED-TESTED; Passport submission/upload/metadata USER-REPORTED Android PASS** at the 2026-10-20 checkpoint. Broader mappings, negative cases and recovery still require validation. Follow [ARCHITECTURE.md](../ARCHITECTURE.md); Authentication owns Tier 1 in [AUTHENTICATION_PROFILES.md](AUTHENTICATION_PROFILES.md).

Neither Tier 2 nor Tier 3 replaces Tier 1 or assigns Tenant, Landlord or Admin. Tier 2 rejected correction and incomplete pending recovery are implemented as described below. Tier 3 resubmission, replacement of registered documents and additional-information workflows remain DEFERRED. Existing backend triggers update profile verification timestamps and database-derived trust. Submission integration changes no schema, RLS, function or infrastructure. The shared zoom viewer's native gesture dependency is described below.

## Entry, UI and ownership

### UI refinement Phase 1 (2026-10-22)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Verification levels now use vertically stacked, content-sized cards instead of a fixed-width horizontal carousel. Existing theme, scaffold, picker and fullscreen zoom viewer are reused; headings, touch targets, spacing and semantic error/status presentation are shared. Tier 2's decorative reference ID image is no longer displayed; no actual document preview was removed.

Tier 3 uses property selection -> document type -> local file -> confirmation. Owned-property rows have a clearly identified placeholder image area, existing property type/barangay/city and selection indication; UUIDs are not their main labels. No property name/address/photo column or image integration was invented. The four enum mappings remain unchanged. **Submit for review** opens the existing `review` screen, now explicitly a confirmation; only **Confirm and submit** calls the existing submission workflow. Cancel/Back retains property/type/file. Reselecting the same type preserves the file; changing type clears it. Returning to the same property preserves the draft while still checking its latest backend submission; changing property clears incompatible selections.

Normal Tier 2/Tier 3 overview/status screens no longer show redundant refresh buttons. Initial loading and feature reopening still refresh authoritative data. Contextual Check status remains for unloaded/error/uncertain-write recovery; closing and reopening Verification is the ordinary way to load later review outcomes. No polling was introduced. Backend statuses remain distinct, including Pending, Under Review, Verified (approved), Rejected, Cancelled and Revoked. That UI checkpoint added no resubmission path; the Stage 2 integration below now adds controlled Tier 2 correction/recovery.

Android acceptance: select an owned property/type/file; tap the image to zoom without submitting; open confirmation and cancel or press Back, checking all selections remain. Confirm once with rapid taps and check one real submission. Reopen to check its status. Test Tier 2 local selection/review, unsupported-file metadata fallback and fullscreen Back/Close. Trigger a load failure and confirm Check status restores backend loading. Existing Tier 3 workflow, broader negative cases and all revised layouts remain Android RUNTIME-UNVERIFIED.

Profile ? Verification opens the existing root workspace/Modal and verification overview. The Notifications verification action opens the same flow. Only existing permitted ordinary marketplace accounts can enter; active Admin routing and restricted/onboarding precedence are unchanged.

`useTierTwoVerificationViewModel` composes the feature's testable `tierTwoVerificationWorkflow`, authenticated data service, existing device picker and existing Storage primitive. The workflow owns loading, selected ID/document, submission, picker/submitting/error/refresh state. Views call ViewModel actions; they contain no backend clients.

The existing overview, Tier 2 Views, cards/scaffold and DocumentPreviewPicker are reused. Tier 1 remains a read-only indication of the root account timestamp. Tier 3's card opens a separate property workflow for Tier 1-verified landlords, including accounts with both Tenant and Landlord roles regardless of their current UI mode. Tier 2 is not a prerequisite. Root Auth supplies presentation eligibility; the Tier 3 service independently checks Auth, own active profile/Tier 1 and landlord role. No legacy Tier 1 OTP/completion or local approval/role-promotion path is connected.

Back follows the Tier 2 screen sequence; overview Back returns to Profile. Both visible controls and Android Modal Back are guarded during selection/submission. Unmount invalidates asynchronous results and prevents subsequent workflow steps, but cannot abort an operation already sent. Development effect cleanup/setup can reload without accepting an obsolete mount's result.

## Tier 3 landlord property verification

`useTierThreeVerificationViewModel` composes the testable `tierThreeVerificationWorkflow`, `tierThreeVerificationService`, existing picker and unchanged private uploader. The workflow owns intro/property/documentType/document/review/status state, selected property/type/file, real submission, loading/errors and double-submit prevention. The flow View owns only which tier is visible. Enabling Tier 3 loads current data; returning to overview clears its local selections and invalidates pending results while preserving mounted subscriptions. Disposal is reserved for unmount. Android Back follows the Tier 3 steps; intro Back returns to verification levels. Selection/submission blocks navigation; loading can be closed through the workspace Close action, invalidating results.

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

Tier 2 local ID selection and review, Tier 3 local property-proof selection and final review, and Admin signed-image viewing share `src/shared/components/FullscreenDocumentImage.tsx`. `DocumentPreviewPicker` opens it when the image itself is tapped, with a visible tap-to-inspect hint. Tier 3's Submit for review button navigates to submission confirmation; Confirm and submit performs the write. No submission/action button was repurposed for zoom.

Supported image MIME types are image/jpeg, image/jpg, image/png and image/webp, using a shared predicate in `src/shared/models/documentImagePreview.ts`. Unknown MIME, PDFs, GIF/SVG and failed inline images keep filename/metadata fallback; no image type is guessed from the filename. File selection/upload behavior is unchanged. Fullscreen decoding failure shows safe copy and supports Close/reopen.

The viewer uses Expo-SDK-selected `react-native-gesture-handler ~2.32.0` plus React Native Animated. A GestureHandlerRootView is contained inside its Modal for Android. Pinch zooms from fit (1x) to 8x around the moving focal point; one-finger drag pans enlarged content within fitted-image bounds; double-tap switches between 3x and fit. Reset zoom restores fit. The image remains contained without stretching and requests native scaling rather than thumbnail downsampling. Readability is still limited by source resolution and native memory/performance; these require Android checks. There is no Reanimated/worklets dependency, Babel plugin or navigation change. Gesture callbacks run on the JS thread.

Visible Close and the Modal's Android onRequestClose invoke only preview dismissal. The local reducer stores temporary presentation state; closing does not change the selected file, document type, property or verification step, nor call picker/upload/submission/metadata/status services. Busy selection/submission closes/disables local preview; changed/removed documents cannot display a stale source. Closing, source changes and fresh opens discard image/zoom/pan state; layout changes reset fit. Only numeric reset keys are used, and no URI/URL is logged, persisted, shared or saved to a gallery. Existing native image caching behavior is not a custom persistent cache policy.

`package.json`/`package-lock.json` add the one native gesture dependency. An installed development build from before this dependency must be rebuilt and reinstalled; Metro reload/OTA alone cannot add its native module. No native build or Android runtime test was performed in this pass. No Supabase calls, Storage permissions or document workflow logic changed.

Tests cover local reducer open/close/source changes and form preservation, fitting/zoom bounds/focal movement/edge drift/panning, callback wiring for Android Modal Back and Close, and Tier 2/Tier 3/Admin no-write regressions alongside existing Admin signed-URL lifecycle tests. These are Node model/orchestration and source-wiring checks, not native gesture execution.

Manual Android checks after rebuilding: on Tier 2 selection and review, tap a sharp ID image; pinch small text, pan, double-tap, Reset, Close and hardware Back. Confirm file/type/step are unchanged and no upload occurs. Repeat on Tier 3 selection and final review, retaining property/type/file and confirming Submit for review still opens confirmation separately. Select another image and reopen: expect fit with no previous offsets; rotate/resize and inspect portrait/landscape images. Test a PDF/unknown MIME fallback and image error. As Admin, open a real private image, zoom/pan, Back/Close/reopen for a fresh signed link, then confirm submission status and review fields are unchanged. Check offline/expired-link errors, late responses and account/navigation cleanup using existing safe error behavior. All new native interactions remain RUNTIME-UNVERIFIED.

## Database and Storage workflow

Canonical structure: `src/shared/services/supabase/database.types.ts`. `createTierTwoVerificationService` uses the existing `SupabaseClient<Database>` singleton through injection. It resolves identity with `auth.getUser()` and rechecks it before queries/writes. No View supplies a trusted user ID.

1. Load the authenticated user's latest Tier 2 submission, ordered `submitted_at DESC, id DESC`, limited to one, including related document IDs. A separate owner-filtered, rejected-only query retrieves at most one previous rejection; this is not complete history.
2. Initial selection is available when no application exists. Rejected users explicitly choose **Submit Corrected Documents**; pending without metadata offers **Complete Document Upload**. These actions only enter local ID/file selection. Viewing the status page never starts a submission.
3. The existing review screen requires **Confirm and Submit**. A synchronous guard excludes picker/load/submit overlap and rapid confirmation; Auth identity and latest status are revalidated.
4. The service calls `supabase.rpc('begin_tier2_verification_resubmission')` without arguments for initial creation, rejected correction or incomplete pending recovery. There is no Tier 2 direct submission INSERT. Validate the returned own Tier 2 pending row; pending recovery must return the existing ID.
5. Recheck that returned application is pending without metadata, then upload with its ID. Recheck again before registering metadata; if another client registered a document or review changed status, do not insert this attempt's metadata or delete its uploaded object.
6. Insert exactly submission_id, document_type, storage_path, file_name and mime_type through the existing service. No file_size/status/review/profile field is supplied.
7. Reload the authoritative latest application and require the same ID and registered document before presenting confirmed backend status. Backend approval timestamps and trust remain backend-derived.

The reused uploader targets private bucket `verification-documents`, path `<USER_ID>/<SUBMISSION_ID>/<UNIQUE_FILENAME>`, with Expo Crypto randomUUID and a safe filename extension. It reads an ArrayBuffer through Expo FileSystem, uploads with `upsert: false`, passes known MIME metadata and returns storagePath/original fileName/nullable mimeType/actual size. It returns no public or signed URL. The whole file is read into memory; native memory behavior and actual configured upload limits require testing.

## Status and refresh behavior

| Backend status | Production behavior |
| --- | --- |
| No submission | Allow initial ID/document flow after successful load |
| pending | With metadata: read-only Pending. Without metadata: Incomplete Upload and explicit Complete Document Upload action |
| under_review | Under Review, retained as a distinct backend value; no duplicate |
| approved | Approved; no new submission or role mutation |
| rejected | Rejected with real reason and PHT dates; explicit Submit Corrected Documents action |
| cancelled | Cancelled; no invented restart behavior |
| revoked | Revoked; no invented restart behavior |

Review note and submission/review dates are shown when available. Status loads on feature mount/reopening, with contextual Check status on unloaded/error/uncertain presentation; no Realtime subscription, polling, review RPC or private document retrieval is added. Reopening loads backend state rather than persisting a local decision.

Submitted/reviewed dates in both Tier 2 and Tier 3 status Views now reuse src/shared/utils/formatVerificationDate.ts, also used by Admin queue/detail dates. It displays explicit Asia/Manila time with a 12-hour AM/PM clock, seconds and PHT label, independent of emulator/device timezone. UTC storage and workflow state are unchanged. The 2026-10-21 investigation confirmed the emulator was set to GMT and previous bare toLocaleString() calls followed that setting. The supplied 2026-10-21T11:41:27.883577+00:00 instant now formats as Oct 21, 2026, 7:41:27 PM PHT. Native rendering of the correction is RUNTIME-UNVERIFIED; compare submitted/reviewed dates on both GMT and Manila-configured devices, including next-day boundaries. Seven new tests and the full 166-test suite pass; see Admin Verification for timestamp coverage and evidence limits.

## Failure and partial-state behavior

The RPC ? Storage upload ? metadata insert ? authoritative reload sequence is **not atomic**. Auth, preflight, RPC, upload, metadata and final-refresh errors remain distinguishable. Uncertain results show **Status Unconfirmed** and contextual **Check Status**, never fabricated Pending or automatic write retry.

After reconciliation, a confirmed pending row without metadata can be resumed explicitly through the RPC using the same submission ID and a newly selected file. Missing metadata does not prove that no object exists. Upload may have succeeded before metadata registration or response delivery failed. No speculative deletion, rollback, replacement or automatic retry occurs; another attempt uses a unique object name and can leave an orphan private file. Existing registered documents remain read-only.

`uq_tier2_single_open_or_approved_per_user` enforces one pending/under_review/approved Tier 2 application per user. The RPC serializes starts and preserves historical rejected rows. Local synchronous guards, fresh reads and generation/identity checks prevent ordinary duplicate writes and stale account responses; unique-index/backend errors require read reconciliation. Cross-client attachment registration still is not atomic or uniquely constrained: pre-upload/pre-metadata checks reduce but cannot eliminate that race. There is no upload-finalization/readiness RPC; Admin visibility of incomplete pending rows is unchanged. Tier 3 keeps its existing conservative behavior and separate concurrency limitations.

Closing/unmounting invalidates results and subsequent steps, but cannot undo an operation already sent. No private objects are deleted as compensation.

## Security and backend evidence

Temporary development diagnostics: the user reported that submission insertion succeeds but no Storage object/metadata appears. `[TIER2-DIAG]` now traces Auth, submission insert, file read, Storage upload, metadata insert and final workflow outcome, including sanitized raw errors before existing error conversion. The helper runs only under `__DEV__`; it omits full local URIs, contents, tokens, headers and arbitrary error objects. Filenames, submission IDs and Storage object paths are intentionally included for this temporary diagnostic. Production logging is silent. This instrumentation does not change the workflow or establish a root cause/fix; remove it after diagnosis. Four logger safety tests supplement the preserved 70 tests.

Subsequent user runtime evidence in **Expo Go** isolates failure before Storage: native `FileSystemFile.bytes` rejects with `ERR_INVALID_PERMISSION` / missing READ. Inspection confirms `copyToCacheDirectory: true`, single-file selection and exact `assets[0].uri` preservation; the uploader already uses `File.arrayBuffer()`. Installed expo-file-system 57.0.7 implements arrayBuffer by calling bytes internally, so that method name does not indicate a direct bytes call in RENTLEASE. No URI-loss bug was found. This historical failure was followed by the user-reported successful Android Passport submission/upload/metadata checkpoint on 2026-10-20. The original native cause was not established; an Expo Go scope defect remains a hypothesis. No broad Android permissions, base64 fallback or speculative URI rewriting was added. FILE_READ_SUCCESS now records the actual buffer constructor name. A regression check explicitly covers cached URI preservation. Inspection alone did not establish Android read/upload success; the later user checkpoint supplies that runtime evidence.

For the repeated failure investigation, SUBMIT_START and UPLOAD_ENTER now emit only uriScheme and isCacheUri. The latter checks for a `/cache/` path segment (ignoring query/fragment); it does not prove that Expo Go grants access to that cache location. No full or partially identifying URI prefix is logged. This remains diagnostic-only; reading/upload/status behavior is unchanged.

Normal-user payloads do not contain status, reviewed_by, approval/review fields, trust score or roles. No role RPC/review RPC is called. No private URLs, privileged keys, document/token logs or RLS bypass was introduced. Auth/identity checks are defense in depth, not authorization substitutes.

The repository now includes the Admin queue RPC migration. Read-only live inspection confirms the private bucket and owner-or-Admin Storage SELECT policy; an authenticated non-owner saw zero matching objects and an Admin saw one. See [Admin Verification](ADMIN_VERIFICATION.md) for scope. The user reports successful Android Passport submission/upload/metadata. These observations do not validate every write policy, negative case or native image-viewing flow. This is a development review, not formal MASVS/MASTG security validation.

## Deferred and unresolved

- DEFERRED: non-image Admin viewing, document replacement, Tier 3 resubmission and Tier 2 cancelled/revoked restart, additional-information requests and property-creation backend integration. Tier 3 submission and Admin compatibility are implemented but await Android testing. Tier 2 correction/recovery is implemented below and remains Android RUNTIME-UNVERIFIED.
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

Historical verification record (2026-10-21, Asia/Singapore). Commit baseline: `6578b6e` plus uncommitted changes; the baseline does not contain this implementation. Tier 2 submission/upload/metadata/Admin viewing/approval: USER-REPORTED Android development-build PASS. Tier 3: IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Broader failures/rejection/recovery and profile/account refresh timing still need runtime checks. No live writes or Android submissions were performed by the agent. Tier 3 baseline: npm.cmd run typecheck passed; npm.cmd test passed 148/148 (33 new tests plus one existing Admin Tier 3 expectation updated). Latest shared zoom pass: typecheck passed; full suite passed 159/159 with zero failures/skips/cancellations, including 11 new preview/gesture/model/wiring/no-write tests. Coverage includes eligibility, owner filters, empty properties, mappings, exact payloads, status/duplicate handling, partial failures, picker recovery, account changes, disposal, enable/reopen subscriptions and Admin compatibility. Expo install --check reports dependencies up to date after network access was available; the earlier network-restricted attempt failed and its offline fallback was explicitly less reliable. git diff --check and git diff --cached --check passed. The shared zoom pass also passed the online Expo dependency check and Android Metro/Hermes export to a temporary directory after the sandbox compiler restriction was resolved. This export is JavaScript/asset validation, not an APK build or native runtime acceptance. No report file was created.

### UI Phase 1 validation record

Last Verified Date: 2026-10-22. Last Verified Commit baseline: `c2a1b9f` plus uncommitted UI refinements; these changes are not in that commit. Verification Status: **IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**. `npm run typecheck` passed; `npm test` passed **188/188**, zero failures/skips/cancellations. Eight additional tests cover status/role/applicability mappings, contextual recovery, Tier 3 selection/confirmation cancellation with no writes, and Login/confirmation/recovery source wiring. Existing Auth routing, registration, synchronization, Tier 2/Tier 3 upload, Admin review and private-preview regressions remain. Native rendering/gesture/keyboard/live acceptance is not implied.

Android JS/Hermes export passed to a temporary folder (bundling only, not an APK/runtime test). `npx expo install --check` reports existing installed `expo@57.0.30` versus expected `~57.0.31`, and `expo-location@57.0.21` versus expected `~57.0.22`; no dependencies were added/upgraded. Backend services, schema, RLS, RPCs, Storage operations, Auth synchronization and root `App.tsx` remain unchanged. Source review found no View-level backend access or new MVVM violation. Shared presentation primitives affect button wrapping/disabled feedback across their existing consumers; untested marketplace operations remain unchanged.

### Phase 2 corrections checkpoint (2026-10-22)

Tier 1 Landlords can enter the local draft preview without Tier 3. It creates no backend property ID; real Tier 3 still requires an existing owned property. Future publication must check qualifying approved Tier 3 for the particular property, rather than account tier3_verified_at or trust. Read-only backend inspection on 2026-10-22 found no such check in the current listing policies/validation trigger: ownership, draft-first activation and completeness are enforced. Real publication and closing this backend gap remain DEFERRED; no submission, Storage, review or backend behavior changed in this correction.

Baseline: `550275c` plus uncommitted corrections. Typecheck passed; full automated suite passed 213/213, zero failures/skips/cancellations. These checks do not establish Android runtime acceptance.

## Designer-led UX refinement (2026-10-22)

Status: IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Last Verified Commit baseline: `976d13d` plus uncommitted changes.

At the earlier designer-led checkpoint, Verification overview separated Account Verification (Tier 1 read-only summary), Identity Verification (optional Tier 2 with the actual loaded submission status), and Property Verification (optional eligible Landlords, status checked per property). That checkpoint used neutral bordered surfaces instead of saturated status-colored blocks; the expressive credential presentation below supersedes that styling while preserving semantic status separation. Tier identity uses restrained green Account, blue Identity and warm gold Property labels plus tier numbers/text; actual status remains a separate semantic badge, never inferred from tier color. Locked/read-only/busy actions appear as explanatory text instead of giant disabled buttons; actionable Tier 2/3 entries use existing secondary buttons. Loading/unavailable status is not labelled verified. Tier 3 does not infer each property's approval from the account timestamp or trust score.

The shared ScreenHeader provides a compact Back chevron with a 48dp target and consistent Close. Overview has one Back control; deeper screens preserve distinct Back/Close actions and existing workflow guards. Document picker, uploads, confirmation, selected state, statuses, PHT dates, fullscreen zoom/pan/reset/Back and service contracts are unchanged. No new dependency/rebuild is required for this pass.

Typecheck passed; full suite 223/223, zero failures/skips/cancellations. Existing Tier 2/Tier 3/private-preview tests remain; new tests cover status presentation and header wiring, not native rendering. Test Android narrow/large-font overview, Tier 2 Back and image preview, Tier 3 property selection/review/Back, pending/rejected/approved status and error recovery using suitable separate records. Submission and native gestures were not exercised by the agent in this pass.

## Stage 2 Tier 2 correction and recovery (2026-10-22)

Status: **IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**. Last Verified Date: 2026-10-22. Last Verified Commit: baseline `4680416` plus uncommitted Stage 2 changes; that commit does not contain this implementation.

The earlier [backend review](../implementation-reports/database/2026-10-22-tier-2-rejection-recovery-review.md) remains historical evidence. Stage 1 and subsequent privilege hardening were applied externally. Read-only inspection confirms the no-argument RPC, SECURITY DEFINER, empty restricted search_path, explicit auth/Tier 1 checks, authenticated execution and denied anonymous execution. The earlier SECURITY INVOKER privilege blocker is resolved. Live generated types gained only this RPC definition. The user reports successful backend rejection/resume/denial/uniqueness/history tests; the agent did not invoke write tests or alter backend records.

Rejected status preserves the actual reason, submitted/reviewed PHT timestamps and existing status styling. Local selection and optional zoom preview precede explicit confirmation. Pending without metadata offers controlled completion; pending with metadata, under_review, approved, cancelled and revoked cannot restart. Previous Rejection shows only the most recent rejected record with reason/date where available, not a full history; history-load errors do not hide current status.

State, confirmation, navigation, async coordination, identity/generation guards and recovery live in `tierTwoVerificationWorkflow.ts` and `useTierTwoVerificationViewModel.ts`. Pure eligibility/presentation mappings live in `TierTwoVerification.ts`; RPC/owner-filtered reads/metadata writes live in `tierTwoVerificationService.ts`. Existing Tier 2 Views bind these actions. The private uploader, picker, fullscreen preview, Admin review and Tier 3 services/workflows are unchanged. Welcome, Discovery, Profile Back and root navigation are preserved. No new dependency, native rebuild requirement or Supabase change was introduced by Stage 2.

Automated checks cover explicit confirmation/no writes on opening, eligible/blocked statuses, returned-ID reuse, rapid taps, unique-index errors, uncertain RPC reconciliation, upload/metadata/final-read failures, concurrent attachments, bounded history and stale account/disposal responses. Existing Admin, Tier 3 and preview/Android Back wiring regressions remain. These are automated model/service/orchestration/source-wiring checks, not native Android or live RLS acceptance.

### Stage 2 Android acceptance still required

- Use a separate authorized rejected Tier 2 test account. Open status: reason/PHT dates appear with no writes. Choose corrected documents; cancel picker, inspect zoom/Back, and cancel confirmation without writes. Confirm once/rapidly: expect one new pending application using the returned ID, one registered document and unchanged rejected history.
- On a separate incomplete pending application, Check Status then Complete Document Upload, select/review/confirm. Expect reuse of the same ID. Test controlled RPC response loss, upload failure, metadata failure and final reload failure: no fake success, blind retry or private-object deletion. Check Status reconciles before another explicit attempt.
- Verify pending-with-document, under_review, approved, cancelled and revoked remain read-only. Test offline/expired identity, account switch, closing/reopening during an uncertain request and late responses.
- As Admin, verify a corrected pending application appears normally, old rejected history stays out of the active queue, private 90-second preview/Start review/Approve/Reject remain intact. Use new records; preserve existing approved/rejected fixtures. After approval, refresh the user profile to inspect backend timestamp/trust. Regression-test Tier 3 selection/review/submission and fullscreen Back.

Upload limits, orphan cleanup, cache retention and cross-client attachment finalization remain unresolved backend/product contracts; they do not prevent this approved explicit recovery flow.

### Stage 2 validation evidence

`npm run typecheck`: PASS. `npm test`: 248 passed, 0 failed/skipped/cancelled. `git diff --check`: PASS. `npx expo install --check`: FAIL due to existing dependency patch drift (expo 57.0.30 versus expected ~57.0.31; expo-location 57.0.21 versus expected ~57.0.22). No dependency files were changed. Automated tests do not establish Android rendering, live RLS or end-to-end Storage success.

## Tier 2 and Tier 3 review document summaries (2026-10-22)

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Baseline `be6bd19` plus uncommitted presentation changes. The Review and Submit screen groups a prominent wrapping filename, labeled MIME type/byte size and ID type in one left-aligned document summary using existing theme tokens. Byte counts use locale digit grouping. Text keeps default accessibility scaling with no fixed summary height, line limit or shrink-to-fit font behavior. The existing preview, fullscreen gestures, confirmation and all workflow/service contracts are unchanged.

`DocumentPreviewPicker` accepts an optional presentation-only documentInformation slot; its existing default metadata remains unchanged for document-selection screens. Tier 2 and Tier 3 review now share the presentation-only `DocumentReviewSummary.tsx`: filename, file type, locale-grouped byte size and selected type form one aligned summary. Tier 2 uses ID type; Tier 3 uses Document type with the existing ownership/authorization label. Tier 3 retains the selected-property reference above the preview; its separate review document-type heading was folded into the summary. No workflow, eligibility, ownership, navigation, Storage or Admin behavior changed.

Validation: typecheck PASS; full suite 248/248 PASS, zero failures/skips/cancellations. These tests retain verification/preview/workflow regressions; they do not establish native layout acceptance. On Android, inspect short and long filenames, narrow width and increased system font size, confirm every detail wraps/readably remains visible on both tiers, then test preview Close/Back, retained Tier 3 property/document type and unchanged confirmation/Cancel behavior. No new dependency or rebuild is required for this layout change. Architecture, routing, feature integration status and Admin documentation remain accurate and unchanged.

## Parent navigation correction (2026-10-22)

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED, baseline `9d9e9c9` plus uncommitted changes. Existing nested Tier 2/Tier 3 Back, busy guards and preview Modal Back are unchanged. Leaving Verification for Profile no longer records the dismissed Verification workspace as a Profile Back target. Profile returns to its authorized top-level predecessor or landing. Typecheck/267 tests pass. Manually check both tiers' nested Back, root overview ? Profile ? Back, active upload/picker guards and zoom Back. Submission/RPC/Storage/status behavior is unchanged.

## Refined Verification presentation (2026-10-22)

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Last Verified Date: 2026-10-22. Last Verified Commit: baseline `01c1a5b` plus uncommitted UI refinements, not contained in that commit. The earlier full tinted credential panels and medal treatment are superseded by divided tier sections inspired by the accepted Profile's calmer hierarchy.

VerificationTierCard keeps its existing API/guards but now renders a small colored tier mark and a single domain heading grouped with requirement/optional metadata and the shared light status indicator, followed by concise instructions and the existing action, separated by subtle rules rather than nested colored panels. Account remains ordinary-user onboarding; Identity/Property remain optional. Landlord eligibility and selected-property-only approval copy remain. Tier accents use shared identity tokens; labels/status never depend on tier color.

VerificationScaffold uses a calmer 22px/600 title and existing scrolling/spacing. Tier 2 status is left aligned with a smaller decorative image; actual reasons, history, review notes, PHT dates, incomplete/uncertain explanations and correction/resume controls remain. Tier 3 status also uses the shared VerificationStatusIndicator. Both tiers' selection/review/picker/zoom/property-selection behavior and submission logic remain unchanged. Profile retains its approved compact ledger and exact values, now using the same indicator component. Admin's existing badges/workflow are untouched.

VerificationStatusIndicator displays the supplied status label alongside a small outlined check/pending/error/unavailable/unverified indicator, using shared verificationIndicatorKind purely for presentation. Pending, Under Review, Verified, Rejected, Cancelled, Revoked, Incomplete Upload and Status Unconfirmed remain distinct labels. Profile still receives account timestamp/applicability summaries, not submission-status loading. No backend state is changed by the visual component.

Typecheck PASS; full suite 286/286 PASS, zero failed/skipped/cancelled; whitespace PASS. Tests cover circular avatar geometry and optional photo cover/clipping, shared indicator/status mappings, all role/applicability summaries, tier contrast, wrapping constraints, preserved requirement/action wiring and review details. Existing Tier 2/Tier 3/Admin/navigation/preview regressions remain. Source inspection found no MVVM violations or View-level data access; no dependencies/backend/contracts/navigation changes.

Android acceptance still required: inspect full Verification at narrow widths and larger fonts; compare its typography/dividers/status alignment with accepted Profile without expecting identical layouts. Test Tenant-only, Landlord-only, dual-role, all actual statuses, long rejection/history reasons and Tier 3 property-selection content. Check onboarding/email/mobile information, optional/locked states, current details and all existing correction/upload/review/zoom/Back actions. Preserve test fixtures and use appropriate separate records. No native screenshots or runtime acceptance were performed in this pass.

Profile-only follow-up validation (2026-10-22): typecheck PASS, 281/281 tests PASS, whitespace PASS. Presentation tests replace obsolete exact-layout assertions while preserving actions/status/Back coverage. The new folio/ledger layout remains Android RUNTIME-UNVERIFIED; see Authentication & Profiles for screenshot and role/font/width acceptance cases. No verification workflow, service or navigation change was made.

Calmer Profile follow-up (2026-10-22): Profile-only identity/typography/indicator refinement preserves all verification data and workflows. Typecheck and full 283/283 automated tests PASS, whitespace PASS; Android RUNTIME-UNVERIFIED. Existing Verification overview/status badges remain unchanged; Profile uses lighter indicators plus exact status text. See Authentication & Profiles for current composition and runtime checks.

### Task-oriented copy and hierarchy polish (2026-10-22)

The current overview retains the divided sections, small 01/02/03 marks and full-width outlined buttons. Repeated Tier/domain eyebrow text is removed; the heading supplies the full tier/title through its accessibility label. Status and required/optional metadata now belong to that heading group. Existing Account success no longer repeats a Tier 1 verified footer or generic foundation tagline; email/Philippine mobile setup guidance remains. The intro asks users to check status or submit documents. Existing Tier 2 applications use View submission rather than repeating their status in the button; incomplete uploads retain their specific action. Landlord access, property-only approval, missing-attachment uncertainty and all action guards remain unchanged. Headings use existing dark brand ink; no new surfaces, gradients, shadows or cards were introduced.

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Last Verified Date: 2026-10-22, baseline `01c1a5b` plus preserved uncommitted changes. Typecheck PASS; 288/288 tests PASS, zero failed/skipped/cancelled; whitespace PASS. Tests retain all status/role/recovery/preview/navigation regressions and add hierarchy/copy/icon source checks. No workflow, ViewModel, service, backend, navigation or dependency change. Android screenshot acceptance still requires all statuses (including incomplete/unconfirmed), long feedback, narrow widths, large fonts, tenant/landlord/dual-role layouts and working detail/property actions. Existing 48dp action targets and text scaling remain; actual native layout acceptance is not established by Node tests.

### Brand and neutral hierarchy refinement (2026-10-22)

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. This supersedes earlier pastel tier styling: Profile and Verification share neutral numbered 01/02/03 markers with established `primaryAction` green numbers. Tier markers identify levels, never approval. Verification section titles use stronger neutral type; instructions use normal body text and supporting metadata uses secondary gray. Informational/unverified status indicators use secondary gray; success, warning and error retain their existing semantic colors and exact labels. Existing concise overview copy, outlined actions, separated sections and selected-property-only approval guidance remain.

Filled green/outlined buttons, document selection/review/preview, Tier 1 requirements, Tier 2/3 eligibility, submission/recovery/Admin logic, timestamps, trust and navigation are unchanged. No backend calls or dependencies changed. Validation: typecheck PASS; npm test 288/288 PASS, zero failures/skips/cancellations; git diff --check PASS. No screenshots were supplied or Android runtime performed. Compare Profile/overview/upload on narrow Android screens and increased font scaling; inspect actual approved/pending/rejected/incomplete/unconfirmed states and property eligibility, then exercise outlined actions, document preview/Back and existing submission confirmation using separate authorized fixtures.

### Restrained neo-brutalist Verification presentation (2026-10-23)

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. This supersedes the earlier hairline-only tier sections. Overview tiers retain their content/order, requirement metadata, exact status labels and guarded outlined actions inside separated white panels with a dark green outline, firm bottom edge and shared 4dp corners. White outlined 01/02/03 markers use green ink independently of approval. Titles use 18dp/800 hierarchy and existing normal body copy; the shared VerificationScaffold applies a bold 22dp heading and green baseline across overview and deeper flow screens. Existing filled/outlined AppButton styling remains unchanged.

Tier 1 requirements, optional Tier 2/3, landlord eligibility, property-specific approval wording, actual statuses/reasons/history/PHT dates, document selection/upload/review/preview/zoom, recovery, Admin decisions, trust and all navigation semantics are unchanged. No ViewModel/service/backend/dependency changes were made. `PRODUCT.md` and `DESIGN.md` record the scoped design direction.

Validation: npm run typecheck PASS; npm test 288/288 PASS, zero failures/skips/cancellations; git diff --check PASS. One old source assertion requiring a 1dp tier divider was updated to the new 3dp panel edge; guarded-action, status, role and workflow assertions remain. Native rendering was not exercised. On Android, inspect 320/375/414dp widths and enlarged fonts, long statuses/rejection text, tenant/landlord/dual-role cases, and appropriate pending/approved/rejected/incomplete/unconfirmed records; confirm task controls, selection/review/preview/Back and submission confirmation behave as before.
