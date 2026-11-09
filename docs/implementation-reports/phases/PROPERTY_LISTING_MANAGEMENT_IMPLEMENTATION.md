# Property & Listing Management implementation history and roadmap

## November 5, 2026 - stale location confirmation

Confirmed existing creation/identity address edits already clear all four coordinates and guard captured address revisions. Reproduced a separate shared-map defect: query/candidate/pin changes retained confirmedPoint and cancel restored exactConfirmed; owning drafts were never notified. Added explicit invalidation callback into creation and identity workflows, candidate identity binding, and safe hydration of already-confirmed owner-draft points when opening the tool. No suggestions become confirmed until the explicit action. Address no-ops preserve confirmation; reset/rejected-correction revisions and stale callback guards prevent reuse across drafts. Removed listener clearing from these three workflows because useSyncExternalStore owns unsubscription; lifecycle replay now preserves UI/address-sync observers.

Saved draft/published identity changes remain in manage_property_identity with existing expected-version, private proposal, Tier3/tenancy/repair and owner checks. Routine/listing edits remain separate and retain canonical location. Updated only confirmation-state copy and live-region announcements in the existing composer/setup layout. No UC-08/UC-09, service/schema/migration, live backend or deployment work.

248 focused tests passed across propertyCreation, propertyLocation, propertyLocationPrivacy, propertyIdentityWorkflow/Correction/Service, propertyRoutineEdit, listingDraftPersistence and publishedListingEditing; TypeScript and whitespace passed. Regression evidence covers address A/B, same-city/whitespace, candidate/pin/query invalidation, unchanged cancel, stale requests, verified/unverified corrections, rejected correction reload, failed save/retry, privacy and existing account-change guards. Prior cancel-after-moving test intentionally changed to require reconfirmation. Android creation/draft/published acceptance remains unverified. Applied previously read RentLease feature, MVVM, UI/UX, Supabase contract, security, test/runtime, documentation, ledger and artifact SKILL.md files; systematic debugging/TDD guided reproduction and fixes.

## Current editing migrations (reconciled 2026-11-02)

Both editing migrations are DEPLOYED / CATALOG-VERIFIED on RentLease `cxfsbwbwmwmgtqfonqth`. Current repository filenames now match the existing deployment-history versions:

| Stage | Current local migration filename | Deployed history version | Deployment (UTC+8) |
| --- | --- | --- | --- |
| Stage 1 - exact-target draft editing | `supabase/migrations/20261101130456_update_listing_draft_exact_version.sql` | `20261101130456_update_listing_draft_exact_version` | November 1, 2026, 9:04:56 PM |
| Stage 2 - published-content editing | `supabase/migrations/20261101145623_update_published_listing_content.sql` | `20261101145623_update_published_listing_content` | November 1, 2026, 10:56:23 PM |

Historical preparation filenames only: Stage 1 was originally prepared as `20261101060000_update_listing_draft_exact_version.sql`; Stage 2 as `20261101141819_update_published_listing_content.sql`. Those historical names are not current paths or additional migrations. The files were renamed without changing SQL; neither deployed migration may be replayed. Existing hashes and deployment receipts remain valid. Paths elsewhere in this document use current filenames; dated preparation/blocked-preflight entries describe historical observations, not current deployment status. Stage 1 Android acceptance is user-reported; Stage 2 Android acceptance remains unverified.

This reconciliation changes documentation only and preserves the existing staged renames. No application, SQL content, live schema or migration-history change was performed.

Date: 2026-10-23. Repository: ZhuRaiko/Rentlease-Frontend. Branch: `feature/property-listing-management`. This is the continuously updated feature implementation history/roadmap and phase evidence index, not authorization to begin Phase 3 or mutate the backend.

Authoritative current behavior: [PROPERTY_LISTING_MANAGEMENT.md](../../features/PROPERTY_LISTING_MANAGEMENT.md). Backend actions and external provenance: [backend ledger](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md). Read both before future work.

## Phase status

| Phase | Status | Blocker/boundary |
| --- | --- | --- |
| Phase 1 - Physical property creation | IMPLEMENTED / AUTOMATED-TESTED; blocked-location Android path RUNTIME-VERIFIED; successful save RUNTIME-UNVERIFIED | Approved exact/public handoff implemented; actual Android save acceptance pending |
| Phase 2 - Ordinary property photos | IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED | Actual saved property UUID is required for Android runtime upload |
| Phase 3 - Listing draft persistence | IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED | Saved property UUID and actual Android persistence acceptance required |
| Phase 4 - Publication workflow | IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED | Approved exact/public handoff exists; actual Android saved draft and property-specific publication acceptance pending |
| Phase 5 - Listing lifecycle | IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED | Approved exact/public handoff exists; actual Android saved-property/listing/lifecycle acceptance pending |
| External integration phase | DEFERRED | Separately owned features, explicit later integration scope |

## Phase 1 - Physical property creation evidence

Scope implemented: typed physical-property draft/model and exact enum/payload mapping, injected create_property_setup service, pure workflow, structured form/review, disabled save without four confirmed coordinates, real UUID validation/retention, account/request guards, durable uncertain-create receipt handling and preserved wizard navigation. No listing row is created. Tier 3 is not a prerequisite.

Source paths (under `src/features/property-listing/`):

- Added: `models/DraftProperty.ts`, `services/propertyCreationService.ts`, `services/propertyCreationDependencies.ts`, `viewModels/propertyCreationWorkflow.ts`, `views/PropertySetupView.tsx`.
- Modified: `models/PropertyListing.ts`, `models/listingNavigation.ts`, `viewModels/usePropertyListingViewModel.ts`, `views/CreateListingView.tsx`, `views/ListingPreviewView.tsx`, `views/PropertyDashboardView.tsx`, `views/PropertyListingFlowView.tsx`.
- Tests: added `tests/propertyCreation.test.ts`; updated `tests/marketplaceWiring.test.ts` to allow the feature's service composition while retaining View/backend isolation.
- Docs originally updated: BACKEND_CONTEXT.md, FRONTEND_CONTEXT.md, FEATURES.md and ROUTES.md. This governance pass establishes the dedicated living feature doc and ledger instead of generic-doc-only detail.

Backend used: `create_property_setup` and reads of profiles/user_roles/owned properties; the RPC creates properties/private locations/property amenities. All four coordinate inputs remain required, with no fabricated/manual coordinates or added Maps/GPS implementation. Normal final save stays blocked until the separate location workflow supplies confirmed exact and approved public values. The source contains a future location seam and UUID success handling, not a claim of live app persistence.

Prior automated evidence, recorded 2026-10-23: `npm run typecheck` PASS; `npm test` **310 passed / 0 failed / 0 skipped / 0 cancelled**; `git diff --check` PASS. Android/live app creation was not performed. The Android JavaScript/Hermes export passed with 940 modules before final removal of address-search integration; it is historical bundle evidence, not a final APK/runtime acceptance result. Final Phase 1 typecheck/tests were rerun after that removal. Online Expo dependency recheck was blocked by network EACCES; offline check warned its result was unreliable. Prior online checking reported patch drift documented below.

Backend evidence: Codex read-only inspection is [P1-01](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#p1-01-codex-physical-property-contract-inspection). External live RPC creation and permanent test-property deactivation are [P1-02/P1-03](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#p1-02-external-live-property-creation-rpc-test). The inactive test fixture remains unless separately cleaned up. Codex performed no live create or permanent backend mutation in its Phase 1 implementation pass; external test data must not be omitted from the phase's overall backend history.

## Phase 2 - Ordinary property photos evidence

Scope implemented: real-property-only photo selection, upload/metadata/read, max-ten display/enforcement, first-photo cover RPC attempt, explicit cover changes, persisted ordering, alt text, deletion confirmation and non-atomic failure reconciliation. Both existing photo states reuse PropertyPhotosView. Integrated counts/thumbnails are real persisted records; fixture-selection behavior is removed. No listing persistence/publication, 360 or location feature is implemented.

Source paths (under `src/features/property-listing/`):

- Added: `models/PropertyPhoto.ts`, `services/propertyPhotoService.ts`, `services/propertyPhotoDependencies.ts`, `viewModels/propertyPhotoWorkflow.ts`, `views/PropertyPhotosView.tsx`.
- Modified: `viewModels/usePropertyListingViewModel.ts`, `views/CreateListingView.tsx`, `views/ListingManagementView.tsx`, `views/ListingPreviewView.tsx`, `views/PropertySetupView.tsx`.
- Tests: added `tests/propertyPhotos.test.ts` (30 tests); updated `tests/marketplaceWiring.test.ts` for the feature-local photo composition boundary.
- Docs originally updated: BACKEND_CONTEXT.md, FRONTEND_CONTEXT.md, FEATURES.md and ROUTES.md; current detail now lives in PROPERTY_LISTING_MANAGEMENT.md.

Backend used: public `property-media`, `property_photos`, owned-property/Auth reads and `set_property_cover_photo(p_photo_id UUID)`. Exact path, grants/RLS, non-atomic upload/delete recovery and atomic-cover/sequential-order distinction are in the living feature doc and ledger. No new dependencies/native rebuild were introduced.

Prior automated evidence, recorded 2026-10-23: `npm run typecheck` PASS; `npm test` **340 passed / 0 failed / 0 skipped / 0 cancelled**, including 30 new photo tests; `git diff --check` PASS. These are implementation-run results, not rerun during this documentation-only pass. Phase 2 baseline `a827827` plus uncommitted changes is not a Phase 2 verified commit. The Phase 2 working tree was clean before those edits, and this governance pass preserves them.

`npx expo install --check` exited 1 for existing patch drift: expo 57.0.30 expects ~57.0.31, expo-location 57.0.21 expects ~57.0.22, expo-notifications 57.0.23 expects ~57.0.24. No suggested dependency fixes were applied. Android/client photo upload and live owner/non-owner Storage behavior remain RUNTIME-UNVERIFIED, gated on an actual saved property UUID.

Backend evidence: Codex read-only observations are [P2-01](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#p2-01-codex-ordinary-photo-contract-inspection). User-confirmed external inspection, permanent privilege grant, rollback tests and advisor results are P2-02 through P2-07. The exact permanent grant recorded is:

```sql
GRANT DELETE ON public.property_photos TO authenticated;
```

This grant was performed by external ChatGPT/Supabase integration, not Codex; it remains in effect, with existing RLS authoritative and UPDATE still column-scoped. Rollback tests left no durable photo-row changes. Original external test SQL/argument/advisor transcripts are unavailable, explicitly marked in the ledger. No source-controlled backend migration for this external grant was supplied/found; this plan/ledger is not a migration or execution authorization. Codex made no permanent backend mutation during its Phase 2 implementation pass.

## Future phase boundaries

Phase 3 is listing **draft persistence**, not publication. Reinspect the generated/live contract and current source before defining writes, field mappings, parent property UUID handling, validation, owner access and uncertain-outcome recovery. Do not implement it during this governance task.

Phase 4 is publication workflow. The existing recorded contract review found missing backend enforcement of the agreed property-specific qualifying Tier 3 rule; an account timestamp/client-only gate is insufficient. Confirm exact current backend requirements with the responsible operator before integration, without independently changing backend functions/RLS in this frontend repository.

Phase 5 is listing lifecycle: only confirmed backend transitions/ownership/authorization may be connected in its later task. Preview published/paused/unavailable/archived labels are not proof of persisted backend statuses.

## Explicit teammate-owned exclusions

1. XGBoost Rental Price Estimation.
2. GPS-Based Property Proximity Searching.
3. MapTiler Maps and Geocoding.
4. OpenStreetMap Nearby Places Searching.
5. Content-Based Property Recommendation System.
6. NLP Review Word Cloud Summarizer.
7. 360 feature.

Expose clean integration seams where necessary; do not duplicate, redesign or take ownership of these features. Any later integration requires explicit scope. Ordinary photos do not establish 360 support.

## Mandatory checklist for every future phase

- [ ] Read AGENTS.md
- [ ] Read required SKILL.md files
- [ ] Inspect working tree
- [ ] Inspect current feature living doc
- [ ] Inspect current backend ledger
- [ ] Confirm live backend contract if applicable
- [ ] Record every live backend mutation/test
- [ ] Implement one coherent phase
- [ ] Add/update focused tests
- [ ] Run typecheck
- [ ] Run test suite
- [ ] Run git diff --check
- [ ] Update PROPERTY_LISTING_MANAGEMENT.md
- [ ] Update backend ledger if Supabase was touched
- [ ] Add/update this phase section in PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md; do not create a separate phase report
- [ ] Record Android runtime status truthfully
- [ ] Confirm all seven teammate-owned features remain untouched unless the task is an explicit integration pass

Read actual skill files, not just names. Read-only live inspection also requires a ledger entry. Missing mutation authorization stops that mutation while independent frontend work may continue. A backend-integrated phase with a stale ledger/living feature doc is incomplete.

## Implementation PDF Traceability

These Markdown documents are the source material for later thesis implementation PDFs. No PDF is generated in this task. For each phase, maintain:

| Evidence | Required record |
| --- | --- |
| Frontend files | Exact added/modified source/test paths and revision or uncommitted status |
| Backend dependencies | Tables, RPCs, Storage buckets/path conventions and actual operations |
| Permanent backend changes | Exact SQL/actions, actor, environment, durable effect and ledger entry; if none, explicitly state `No permanent live backend mutation was performed in this phase.` |
| Tests | Commands, dates, exact pass/fail/skipped/cancelled counts and whether mocked/live/rollback |
| Runtime | Android/client status and actual environment/revision, with no inference from unit tests |
| Dependencies/deferrals | External owner, unresolved contract and blocked behavior |
| Security/RLS | Observed versus user-reported evidence, positive/negative cases and remaining warnings |
| Evidence locations | Phase section in this continuous implementation history plus links to living doc and backend ledger; separate artifact links only for explicitly required audits/investigations |

Maintain exactly one current feature document, one continuously updated implementation history/roadmap (this file), and one continuously updated backend ledger. New phases become dated sections within these files. Do not create Phase 3/4/5 implementation reports or per-phase backend ledgers. Separate reports are appropriate only for genuinely separate audits/investigations explicitly requiring their own artifact. Preserve older historical reports and all existing phase evidence; do not invent missing transcripts for PDF completeness.

All future Property & Listing phases must update:

- `docs/features/PROPERTY_LISTING_MANAGEMENT.md`
- `docs/implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md`
- `docs/implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md`


## This governance pass

Documentation and instruction changes only. No Phase 3 implementation, app behavior change, live Supabase call or backend mutation occurred. No permanent live backend mutation was performed in this phase. Earlier external permanent effects remain honestly recorded in the ledger. Phase 2 source/tests/configuration are preserved, not rewritten to satisfy documentation. No commit, push, merge or PDF generation is part of this pass.


## Runtime bugfix - unsaved workspace exit (2026-10-24)

Scope: existing Phase 1/2 navigation only; Phase 3 remains NOT STARTED. Initial Android blocked-save flow was user-reported PASS. Dirty Property Setup unsaved-exit confirmation was user-reported FAIL. This pass corrects reproducible code-level guard/discard/lifecycle defects; corrected Android behavior is **RUNTIME-UNVERIFIED AFTER FIX** pending user retest, not a claimed native-dialog PASS.

Root cause and path audit: the navigation hook captured a render-time boolean, so workflow edits made before a React commit could still take its clean/immediate-action branch. Footer Discover/Chat/Tenancy and explicit Close already used requestNavigation. Listings-root/root-Back exits used the shared request directly; they now pass through the feature wrapper so confirmed local discard and lifecycle checks are consistent. Internal review/address/details Back is preserved. Details -> posting type retains the physical draft; only a real editor/workspace exit requests confirmation. Confirmed Listings navigation previously retained that dirty draft and could prompt again on a subsequent exit. An old retained callback could also navigate after unmount. All three defects were reproduced by automated tests before correction.

Changes:

- `src/shared/viewModels/useNavigationConfirmation.ts`: accepts a live dirty predicate as well as the existing boolean API; evaluates it at the exit request.
- `src/features/property-listing/viewModels/usePropertyListingViewModel.ts`: uses live property/photo dirty reads, funnels actual exits through mounted/busy checks, and discards local edits only after accepted navigation. First pending intent remains authoritative.
- `src/features/property-listing/viewModels/propertyCreationWorkflow.ts`: local discard preserves durable pending/confirmed receipts and retains a known property UUID; no service writes.
- `src/features/property-listing/viewModels/propertyPhotoWorkflow.ts`: local discard resets selection/alt-text/removal presentation only; persisted records and durable journals remain unchanged.
- `tests/propertyExitGuard.test.ts`: eleven new integration-style tests execute the actual hook/FlowView/workflows/shared guard with a controlled React hook scheduler and mocked native/backend composition. Actual footer/Close/registered Android callbacks are exercised, not just source regexes. The harness does not render native Android Modals.
- `tests/bottomNavigationBack.test.ts`: source assertions now recognize the feature request wrapper; existing routing assertions and regression coverage remain.
- `docs/features/PROPERTY_LISTING_MANAGEMENT.md` and this implementation history: record runtime evidence, correction and remaining re-verification.

Validation: `npm run typecheck` PASS; full `npm test` **351 tests, 351 passed, 0 failed, 0 skipped, 0 cancelled**; `git diff --check` PASS. The new tests initially exposed the stale clean snapshot, retained dirty draft after Listings Leave and unmounted stale callback. After correction, internal Back, dirty guard state, Stay-preserved values, single-execution Leave, bottom exits, clean exits and invalidation tests pass. Existing Tier 2/Tier 3/Admin/photo/navigation tests remain passing. No dependency changes.

Manual Android retest: edit a physical property, move review -> address -> details without prompts, then details -> posting type retaining inputs. Hardware Back from posting type must open NavigationConfirmation. Repeat Discover/Listings/Chat/Tenancy and explicit Close; Stay and dialog Android Back must preserve values with no destination change. Leave must execute the original destination once with no create/upload and no immediate re-prompt at Listings root. Repeat rapid taps and account/workspace replacement while a confirmation is pending. Clean setup should exit without a prompt. Full backend persistence remains blocked on the separately owned location workflow.

Working tree was clean at the start of this bugfix; Phase 2 implementation was already present and preserved. No Supabase service/contract, schema, RLS, RPC, Storage, Auth or teammate-owned feature was changed. No backend action occurred, so the backend ledger is deliberately unchanged. No permanent live backend mutation was performed in this phase. No new report file, commit, push or merge was created.


## Phase 3 - Listing draft persistence implementation (2026-10-24)

Current status: **IMPLEMENTED / AUTOMATED-TESTED / RUNTIME-UNVERIFIED - blocked by persisted-property prerequisite**. This extends the existing feature history; earlier NOT STARTED statements describe prior governance/bugfix scope. Phase 4 publication and Phase 5 lifecycle remain NOT STARTED.

### Frontend files and architecture

Added under src/features/property-listing:

- models/PersistedListingDraft.ts: supported listing fields, minimum boundary, numeric/date validation, rental-term labels and explicit RPC/load mappings.
- services/listingDraftService.ts: typed save_listing_draft calls, own-active-property/identity checks, narrowly scoped reads, response validation, durable pending marker and reconciliation.
- services/listingDraftDependencies.ts: existing typed client plus AsyncStorage composition.
- viewModels/listingDraftWorkflow.ts: listingId, loaded/busy/error/uncertain, last confirmed row, stale-generation/account checks and explicit load/save/reconcile coordination.

Modified under the same feature:

- models/PropertyListing.ts: separate supported numeric month/rental-term/house-rule fields; preview-only physical/lifecycle fields remain local.
- viewModels/usePropertyListingViewModel.ts: consumes propertyState.propertyId, loads current draft, maps only listing fields, chooses local progress versus backend save, retains listing UUID and includes persistence in busy/navigation protection. The previously uncommitted unsaved-exit fix is preserved.
- views/CreateListingView.tsx: explicit title, rental term, deposit/advance/minimum months, house-rule text and ISO availability date; dynamic save label. Static suggested-rent controls removed from this step, with no estimator implementation.
- views/ListingPreviewView.tsx: dynamic local/account save controls, explicitly preview-only publication label; Figma sample loading disabled for a real property to avoid persisting sample content accidentally.
- views/PropertyListingFlowView.tsx: loading/error and contextual reconciliation/retry controls bound only to the ViewModel.
- views/PropertyDashboardView.tsx: current-property account-draft ID/edit action beside existing preview dashboard.
- views/PropertySetupView.tsx and views/PropertyPhotosView.tsx: continuation wording now says listing draft and explains explicit persistence.

Other files: src/shared/services/supabase/database.types.ts adds ONLY the missing exact save_listing_draft function entry from the user-supplied generated definition, cross-checked against live read-only inspection. No full type regeneration or unrelated structural edit is claimed. Tests/listingDraftPersistence.test.ts is new; tests/propertyExitGuard.test.ts adds three actual ViewModel persistence integrations and stubs only new native dependency composition; tests/marketplaceWiring.test.ts permits the feature's own composition import while preserving View/service boundaries.

### Persisted-versus-local boundary and backend calls

Before real property UUID + nonblank title + nonblank description + positive asking rent, Keep local progress stays session-local and explicitly does not claim account persistence. No placeholder title/description/rent/ID is sent. Once the minimum exists, Save listing draft to account validates optional fields and calls save_listing_draft; success follows a validated one-row-array response and authoritative reload. No direct table writes. The server owns landlord/status/completeness/timestamps and always saves draft. Repeated saves reuse the existing own property draft; listingId is retained separately from propertyId.

Mappings: title/description trim; askingRent parses a valid numeric/currency-grouped string; houseRules is optional text; rentalTerm is short_term/long_term/either; securityDepositMonths and advanceRentMonths are separate nonnegative numbers; minimumStayMonths is optional positive smallint; availableDate is optional valid YYYY-MM-DD. Unsupported legacy payment text and property fields are never silently coerced. Loading filters property_id, authenticated landlord_id and status=draft, orders created_at/id DESC, limit one; listing fields populate without overwriting physical property details.

A durable account/property pending marker precedes RPC issuance. Concurrent taps are excluded; unknown RPC or reload outcomes block saves across reopen. Reconciliation reads the current draft, does not resend automatically and does not claim the timed-out payload was applied. Continued absence remains uncertain. Known rejection permits explicit correction; stale account/property/disposed responses cannot populate another workflow. Existing active saves block exit paths and the unsaved-exit guard continues to pass.

### Backend interaction and external changes

[Ledger Phase 3](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#phase-3---listing-draft-persistence-recorded-2026-10-24) separates Codex's one read-only contract/grant/policy SELECT from external permanent function creation, rollback create/update reuse, foreign/inactive-property denials and advisor findings. External test listing a91d4de0-af56-4cbb-bfc9-a431591f605e did not persist after rollback; reported listings count was zero. Existing inactive Phase 1 fixture remains as previously recorded. No broad listings grants were added. The exact original external DDL was initially unavailable and was supplied on 2026-10-25; it is now preserved in ledger P3-02. Original test payload transcripts remain unavailable and are not invented. No source-controlled backend migration was created.

Codex performed no live save RPC, backend mutation or test-data creation in this phase. The external permanent FUNCTION_CHANGE is explicitly recorded; it would be inaccurate to describe the overall backend phase as having no permanent change. RLS and the RPC checks remain authoritative. The controlled authenticated SECURITY DEFINER advisory does not justify direct table writes.

### Validation and runtime boundary

npm run typecheck PASS. Full npm test: **373 total, 373 passed, 0 failed, 0 skipped, 0 cancelled**. Added 19 service/workflow/domain tests and three actual ViewModel integrations; pre-existing guard/photo/verification/navigation coverage remains passing. git diff --check PASS. No new dependency/native rebuild is required; existing Expo patch drift is unchanged.

MVVM review: Views contain no direct backend calls; models are pure; service owns typed data access; workflows/ViewModel own form coordination and async state. No duplicate client, cross-feature ViewModel import or new navigation/state framework was introduced.

Android listing persistence is **RUNTIME-UNVERIFIED - blocked by persisted-property prerequisite**. No MapTiler/GPS workaround was added. After the separately owned location feature supplies a saved property, test first save, repeated same-ID update, reload/restart, optional field clearing, invalid terms/dates, local-only incomplete progress, account/ownership changes and network interruption with explicit reconciliation. Confirm status stays draft and there are no publication/lifecycle calls. The recent exit-guard fix still requires user Android re-verification.

### Scope and preservation

All seven teammate-owned features remain untouched: XGBoost, GPS proximity, MapTiler/geocoding, OpenStreetMap nearby places, content-based recommendations, NLP word cloud and 360. No publication, property-specific Tier 3 publication enforcement, lifecycle transition, one-active-listing rule, moderation or publication completeness policy was implemented. The existing local publication preview remains labeled preview-only. No commit, push or merge occurred.

At Phase 3 start the working tree already contained the uncommitted exit-guard bugfix (creation/photo workflow discard helpers, live predicate/shared hook, ViewModel mounted checks, tests and the two feature docs). That work was preserved and extended rather than reset. Backend ledger is updated for actual read-only and user-reported external evidence; no separate Phase 3 report file was created.


## Phase 3 correction - local progress, modal copy and provenance (2026-10-25)

Scope: small Phase 3 correction only. No Phase 4/publication/lifecycle backend work or teammate-owned integration. No live Supabase action or mutation occurred; no SQL was replayed and no migration was added.

Files modified: src/features/property-listing/viewModels/usePropertyListingViewModel.ts; src/shared/components/NavigationConfirmation.tsx; src/features/property-listing/views/PropertyListingFlowView.tsx; tests/propertyExitGuard.test.ts; docs/features/PROPERTY_LISTING_MANAGEMENT.md; this implementation history; and docs/implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md. No other application/service/backend behavior was changed.

Root cause: local save assigned savedDraft.current=draft even though progress was not persisted, and listing dirty state was gated by isListingEditor(screen), hiding differences on the dashboard. The local outcome no longer changes the confirmed baseline, and the navigation predicate includes draft-versus-baseline differences regardless of screen. Existing onConfirmed(row) continues to establish a clean authoritative baseline. No second draft store or incomplete automatic save was introduced.

Behavior: valid local listing fields without a saved property -> Keep local progress -> dashboard retains fields -> external exit prompts. Stay preserves fields/workspace with no destination action; Leave restores the last confirmed baseline and executes the original destination once. Internal transitions preserve state. The existing synchronous property dirty and Android Back regressions remain intact.

NavigationConfirmation now accepts optional title/body with unchanged defaults for other consumers. P&LM supplies its contextual Property & Listing Management title and unsaved property/photo/listing explanation. The existing buttons and onRequestClose-as-cancel are preserved; Search & Discovery was not modified.

Three new actual ViewModel/Flow/component-copy regression tests failed before the fix and pass afterward. They cover local-only dashboard exit/Stay/Leave/baseline restoration, authoritative backend-confirmed cleanliness followed by an edited draft, and contextual/default copy with Android cancellation. Validation: npm run typecheck PASS; npm test **376 total, 376 passed, 0 failed, 0 skipped, 0 cancelled**; git diff --check PASS; existing local Markdown-link/anchor validation PASS. No new dependency.

Ledger correction: user supplied the exact historical external save_listing_draft CREATE OR REPLACE FUNCTION, PUBLIC/anon REVOKE and authenticated EXECUTE GRANT SQL. It is preserved in P3-02 as external ChatGPT/Supabase evidence, with a dated correction rather than pretending Codex ran it. The user reports a subsequent contract recheck: SECURITY DEFINER, pg_catalog search_path, authenticated EXECUTE only; listings authenticated SELECT only. Codex performed no live recheck or permission change. Original external execution timestamps/test payloads still remain unavailable where not supplied.

Runtime status is deliberately split:

- Phase 1 blocked-location Android path: **RUNTIME-VERIFIED**, user-reported form/review reachability, exact/public points awaiting confirmation and disabled Confirm and save property.
- Phase 1 successful physical-property persistence: **RUNTIME-UNVERIFIED**, pending separately owned MapTiler/location integration.
- Phase 2 successful ordinary-photo workflow: **RUNTIME-UNVERIFIED**, requires a real persisted property UUID; upload/cover/order/delete are not claimed tested on Android.
- Phase 3 successful listing draft persistence: **RUNTIME-UNVERIFIED**, requires a real persisted property UUID; no Android save_listing_draft persistence acceptance is claimed.
- This corrected local-only exit behavior: **RUNTIME-UNVERIFIED AFTER FIX** until the user retests.

Manual retest: keep incomplete/local-only listing fields, return to dashboard, then attempt Discover/Chat/Tenancy/Close or root Back. Stay and Android Back on the confirmation must preserve inputs; Leave must execute only the first destination and discard local changes. After a real backend confirmation (when the property prerequisite is supplied), an unchanged draft should exit without a prompt, while subsequent edits must prompt. No successful property/photo/listing persistence is inferred from this local-only test.

No permanent live backend mutation was performed in this correction pass. Phase 4 remains NOT STARTED; none of the seven teammate-owned features was implemented. No report file, commit, push or merge was created.


### Final Phase 3 correction patch (2026-10-25)

Applied the user's phase3_final_correction.patch to usePropertyListingViewModel.ts and propertyExitGuard.test.ts: removed savedDraft.current=draft from confirmPublish and finishEdit. These local preview actions no longer hide unsaved listing edits from the workspace-exit guard. The two supplied regressions failed before the fix; afterward Stay preserves edits, Leave restores the last backend-confirmed values and the originally requested destination executes once, with no extra backend save.

Updated this existing history and PROPERTY_LISTING_MANAGEMENT.md; no new report was created. npm run typecheck PASS; npm test **378 total, 378 passed, 0 failed, 0 skipped, 0 cancelled**; git diff --check and local documentation-link validation PASS. Existing tests and Phase 1/2/3 behavior remain preserved. Android exit behavior is RUNTIME-UNVERIFIED AFTER FIX; property/photo/listing persistence runtime dependencies remain unchanged. No live Supabase action, backend mutation, Phase 4/lifecycle implementation or teammate-owned feature was performed. Backend ledger deliberately unchanged. No commit, push or merge occurred.


## Phase 4 - Listing publication (2026-10-25)

Baseline fbb0878; working tree was clean at phase start. No earlier uncommitted work was discarded. Scope is saved-draft publication only, not lifecycle or separately owned integrations.

Added ListingPublication model, listingPublicationService/dependencies, listingPublicationWorkflow, PublishedListingStatusView and listingPublication tests. Modified the composed ViewModel, draft workflow, confirmation/flow/dashboard Views, generated database types and actual hook/wiring tests. Updated the living feature document, this history, existing backend ledger and concise generic context/index/routing statements. Exact paths are available in the final Git diff; no phase-specific report was created.

The single generated-type addition is publish_listing(p_listing_id: string), returning an array of completeness_score:number, listing_id:string, listing_status:listing_status, published_at:string and updated_at:string. The typed service sends only p_listing_id. No direct listing INSERT/UPDATE or lifecycle RPC was added.

Real publication requires a confirmed unchanged backend draft and explicit confirmation; legacy preview requirements do not gate it. Backend property-specific Tier 3, weighted 80% completeness and duplicate-live-listing rules remain authoritative. Validated receipt plus scoped reload establishes active -> Published. Durable pre-call pending markers and account/property/listing pointers support explicit reconciliation; no blind retries, fake success or replacement drafts after active. Generational/identity checks prevent stale results. Sample publication stays local. See the living feature document for current behavior and the ledger for exact backend evidence/provenance.

Validation: npm run typecheck PASS; npm test **408 total / 408 passed / 0 failed / 0 skipped / 0 cancelled** (30 additional test cases over 378). Focused tests cover receipt validation, payload/enum boundaries, safe backend errors, concurrency, stale results, unknown outcomes, durable reopen/reconciliation, active draft protection and actual ViewModel confirmation/dirty/sample behavior. git diff --check PASS; local documentation-link validation PASS (49 links/anchors checked, zero errors). MVVM review found no View backend access, duplicate client, cross-feature ViewModel dependency or navigation/state framework change.

Android successful publication is **RUNTIME-UNVERIFIED**. MapTiler/location remains separately owned; no fake property/listing identifiers or coordinates were introduced. Retest real publication and backend denials, unsaved edits, rapid taps, uncertain network/restart/reconciliation, account switching and prior exit/photo/draft behavior after the prerequisite is available. Phase 5 and all seven teammate-owned features remain unimplemented.

No permanent live backend mutation was performed in this phase by Codex. One read-only contract/ACL inspection was performed and recorded in the existing ledger. The externally created publish_listing RPC and external rolled-back positive/negative tests are attributed separately. No backend migration was fabricated or replayed. No commit, push or merge was performed.


## Phase 5 - Listing lifecycle (2026-10-26)

Implementation plan, baseline 7ae983f (clean working tree): preserve Phases 1-4; add the exact three lifecycle structural signatures, a pure transition/error/receipt model, owner-scoped lifecycle service and generation-guarded confirmation workflow. Extend restoration/adoption for existing non-draft statuses before draft loading. Compose operation guards in the existing ViewModel, reuse the real status screen and existing confirmation dialog, keep sample actions local, and prohibit real post-publication content editing. Test transition/payload/receipt, pending-journal recovery, concurrency, stale identity/workspace, restoration and real ViewModel behavior. Update this history, living feature document and backend ledger, run typecheck/full tests/whitespace/link checks, and report Android as RUNTIME-UNVERIFIED. No database mutation, teammate feature or automatic commit is authorized.


### Implementation and evidence

Added src/features/property-listing/models/ListingLifecycle.ts, services/listingLifecycleService.ts, services/listingLifecycleDependencies.ts, viewModels/listingLifecycleWorkflow.ts and tests/listingLifecycle.test.ts. Modified existing publication service/workflow, draft workflow, composed ViewModel, real status/dashboard/flow Views, generated database.types.ts and listingPublication/propertyExitGuard/marketplaceWiring tests. Updated the existing living feature document, this continuous history, continuous backend ledger and concise generic status/routing pointers. No separate phase report was created.

Implemented explicit active -> paused, paused -> active and active/paused -> archived confirmations using pause_listing/reactivate_listing/archive_listing, p_listing_id only. Strict receipt plus same-ID owner-scoped reload validates success. Durable operation-scoped pending markers, service/workflow exclusion, cross-workflow guards, stale identity/generation rejection and explicit reconciliation avoid blind retries. Restoration/adoption handles supported non-draft lifecycle statuses without replacement drafts. Real rented/removed/archived records have no landlord mutation actions; editing and Mark unavailable stay sample-only. Archive retains records/property/photos.

Backend dependencies: listings SELECT; the three externally created controlled RPCs; backend tenancy/verification/completeness logic. Supplied exact permanent external CREATE/REVOKE/GRANT SQL is preserved in the ledger, not replayed. One Codex read-only catalog/ACL inspection confirmed definitions, Tier 3/tenancy/duplicate boundaries and SELECT-only listing privileges. External rollback/denial evidence is separately attributed. Active-tenancy denial was not independently executed; contract inspection only. Security advisor warnings are external reports, not a Codex advisor run or security compliance claim.

Validation: npm run typecheck PASS; npm test **480 total / 480 passed / 0 failed / 0 skipped / 0 cancelled**, 72 additional cases over 408. Four restore regressions failed before the implementation and pass afterward. Earlier Phase 4 unexpected-state coverage was intentionally revised because paused is now a supported authoritative lifecycle state; existing publication/draft/sample/exit regressions are retained. MVVM/security review found no View client access, second Supabase client, direct listing write or frontend authorization replacement.

Android lifecycle is RUNTIME-UNVERIFIED; normal app creation/reopen still depends on the external location/persisted-property boundary. Use the living feature doc manual test sequence; external SQL rollback tests and automated mocks are not Android acceptance. No new dependency or native rebuild was introduced. All seven teammate-owned features remain untouched. No permanent live backend mutation was performed in this phase by Codex. No commit, push or merge was performed. git diff --check PASS; documentation-link validation PASS: 51 links/anchors checked, zero errors.


Skills actually read for Phase 5: .codex/skills/rentlease-feature-implementation/SKILL.md; rentlease-frontend-mvvm-guard/SKILL.md; rentlease-supabase-contract-guard/SKILL.md; rentlease-security-review/SKILL.md; rentlease-test-runtime-verification/SKILL.md; rentlease-documentation-maintainer/SKILL.md; rentlease-implementation-ledger/SKILL.md; rentlease-implementation-artifact-organizer/SKILL.md (all sibling paths under .codex/skills). Also consulted installed brainstorming, writing-plans, test-driven-development, verification-before-completion and Supabase instructions. The supplied detailed scope was used as the approved design; the plan stayed in this existing history, with no extra report or automatic commit.

Documentation matches Phase 5 source and retains dated earlier evidence. FEATURES/FRONTEND_CONTEXT/BACKEND_CONTEXT/ROUTES now point to connected lifecycle behavior; architecture, Auth, verification, package files, shared maps/geocoding and unrelated feature documents remain unchanged because their contracts did not change. Working tree was clean at phase start; all Phase 1-4 committed work was preserved.


## MapTiler property-location integration (2026-10-26)

Approved scope: exact-only MapTiler search/MapLibre pin confirmation on feature/maptiler-property-location; preserve Phases 1-5, no Supabase change or GPS. Plan: install the requested pinned native package/plugin; validate the current v11 types; harden the existing shared geocoder; add a pure point/query contract and dedicated service/workflow; connect only physical-property setup with immediate address-revision/workspace invalidation; retain exact points locally and leave complete-location/save validation unchanged pending public privacy policy; add focused regression tests and update living docs. A fresh native development build will be required, but no build/deploy/commit is authorized.


### Implementation evidence

Branch feature/maptiler-property-location, baseline 4fa955b, clean working tree before this pass. Added models/PropertyLocationConfirmation.ts, services/propertyLocationService.ts, services/propertyLocationDependencies.ts, viewModels/propertyLocationWorkflow.ts and views/PropertyLocationMapView.tsx under src/features/property-listing/, plus tests/propertyLocation.test.ts. Modified only Phase 1 composition/presentation in usePropertyListingViewModel.ts and PropertySetupView.tsx, the existing shared geocoder, package/lockfile/app config, focused tests and affected living docs. Photo/draft/publication/lifecycle models/services/workflows, generated Supabase types and RPC contracts remain unchanged.

Installed @maplibre/maplibre-react-native 11.5.0 through the requested Expo command, including the real lockfile and plugin. Initial sandbox registry access failed; the authorized escalated install succeeded. Existing owner/EAS project ID preserved. Expo config --type introspect passed and generated neither android/ nor ios/. No EAS build or native rendering was performed. Missing local EXPO_PUBLIC_MAPTILER_API_KEY (a differently named EXPO_PUBLIC_MAPTILER_KEY was exported) remains a runtime configuration requirement; no private env values changed or appeared in output.

Implemented safe Philippine geocoding through the existing provider, explicit candidate selection, v11 Map/Camera/ViewAnnotation, tap/drag exact-pin updates and confirmation. Exact points stay ephemeral in the dedicated workflow for the matching address revision. Synchronous creation-state subscriptions plus abort/generation/native callback tokens reject stale results; root account/workspace disposal clears state. Complete location provisioning and save checks are unchanged: no public privacy rule was invented, no provideConfirmedLocation call was added and normal property save remains disabled. Legacy sample confirmPin remains separate. No GPS, OSM nearby, ML/recommendation/NLP/360 or Supabase work was implemented.

Validation: npm run typecheck PASS; npm test **536 total / 536 passed / 0 failed / 0 skipped / 0 cancelled** (56 additional cases over 480). The blank-query regression failed before hardening. Tests cover parsing/ranges/IDs/labels/HTTP/JSON/errors/cancellation/limits, longitude-first conversion, explicit candidate/map readiness, pin updates, revision/setup/generation cancellation, renderer tap/drag wiring, actual hook synchronous invalidation/disposal, preserved form state and exact-only blocked persistence. The historical test forbidding all map ownership in the composed ViewModel was intentionally narrowed to keep API calls out of persistence/Views while permitting this dedicated approved service/workflow. Phase 1-5 regressions remain passing.

npx expo install --check executed online, exit 1 due only to previously documented patch drift: expo 57.0.30 vs ~57.0.31, expo-location 57.0.21 vs ~57.0.22, expo-notifications 57.0.23 vs ~57.0.24. No automatic fixes applied. Package install also reported 10 audit findings (3 moderate, 6 high, 1 critical); no audit remediation or attribution to the new package is claimed. Typecheck/mocks/config resolution do not verify native map rendering or live MapTiler success.

Current status: geocoding, MapLibre property map and exact confirmation IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Public privacy point DEFERRED - POLICY DECISION REQUIRED; successful normal property save BLOCKED. Fresh native development build required; stock Expo Go insufficient. Manual acceptance must cover search/candidate/native map/pan/zoom/tap/drag/attribution, exact/public status labels and disabled save, address edits, cancellation/error/Back/Stay/Leave, rapid searches, account/workspace change and accessible narrow-screen layout. No development/EAS build was run.

MVVM/privacy review: models pure; Views contain no HTTP, Supabase, Auth or GPS calls; service reuses existing MapTiler config/geocoder; workflow owns async/state/cleanup. No logging or public-coordinate copying added. No new navigation/state system. No permanent live backend mutation was performed in this phase. No Supabase interaction, commit, push, merge, deployment or EAS build occurred. Documentation matches the resulting implementation; older phase evidence remains historical. This feature already has a dedicated living doc, so no separate MapTiler feature/phase report was created.

API references: [MapLibre Map](https://maplibre.org/maplibre-react-native/docs/components/map/), [Camera](https://maplibre.org/maplibre-react-native/docs/components/camera/), [ViewAnnotation](https://maplibre.org/maplibre-react-native/docs/components/annotations/view-annotation/), [MapTiler geocoding](https://docs.maptiler.com/cloud/api/geocoding/). Installed 11.5.0 source/types were also inspected. Read repository skill files: feature-implementation, frontend-mvvm-guard, security-review, test-runtime-verification, documentation-maintainer, implementation-artifact-organizer, implementation-ledger and supabase-contract-guard under .codex/skills/rentlease-*/SKILL.md; AGENTS/architecture/frontend/Figma and existing feature docs were reviewed before edits.

Final checks: git diff --check PASS; documentation-link validation PASS (53 local links/anchors, zero errors). Expo config/plugin introspection PASS with owner/EAS ID intact and no native directories. Backend/generated types and Phase 2-5 service/workflow diffs were explicitly checked and remain empty. Local map points remain ephemeral; native package permission declarations do not add any feature-level GPS permission request or location read.


## Public-location privacy and complete Phase 1 handoff (2026-10-28)

Approved implementation plan: add a pure deterministic 300m Web Mercator grid-center model (radius 6378137, latitude clamp 85.05112878); derive public points at explicit exact confirmation; hand all four validated coordinates through the unchanged revision-checked provideConfirmedLocation boundary; base UI readiness on accepted complete location; preserve services/RPC/generated types, map behavior and Phases 2-5. Extend model/workflow/actual ViewModel/payload tests, correct living docs and record no backend action. No new dependency, GPS integration, build or commit is authorized. Baseline 6199094; working tree initially clean. Existing map render/style/pin/review is user-reported partially runtime-verified; complete save remains runtime-unverified until tested on Android.


### Implementation, privacy limits and validation evidence

Added src/features/property-listing/models/PropertyLocationPrivacy.ts and tests/propertyLocationPrivacy.test.ts. Modified propertyLocationWorkflow.ts, usePropertyListingViewModel.ts and PropertySetupView.tsx in that feature; extended propertyCreation/propertyLocation/propertyExitGuard tests. Updated existing feature docs/history/ledger plus affected ARCHITECTURE/FRONTEND_CONTEXT/BACKEND_CONTEXT/FEATURES/ROUTES statements. No new report, dependency, map-renderer/config/geocoder, property persistence service/workflow, generated contract or Phase 2-5 behavior was introduced.

Policy: validate the exact geographic point, clamp latitude only for projection to +/-85.05112878, project to spherical Web Mercator with radius 6378137, floor each projected axis into a fixed 300m grid and inverse-project its center. asinh(tan(latitude)) is the standard Mercator forward expression in an equivalent zero-stable form. Same cell -> same public point; frozen exact inputs are preserved. Negative coordinates use floor. Grid size is projected meters, with maximum within-cell projected offset about 212m, not an exactly 300m displacement. Ground scale varies with latitude. Numeric equality at a cell center is permitted; direct exact-to-public assignment is not. No randomness, differential-privacy/anonymization or identity-protection guarantee is claimed.

Explicit map confirmation now derives/validates a public point, then calls the composed ViewModel callback with all four coordinates and the captured revision. The callback rejects stale/unmounted/busy/uncertain/persisted setup, invokes unchanged provideConfirmedLocation and checks all four accepted values. Generation/reentrant-context checks protect the final workflow state. Address changes clear both points; cancellation/failures do not hand off new coordinates. Setup/Review labels follow accepted complete location; unchanged location/form validation now permits explicit property save. Existing create_property_setup payload still maps exact/private and derived/public fields without coordinate reversal. No View calls a backend or computes privacy policy.

Typecheck PASS; full npm test **575 total / 575 passed / 0 failed / 0 skipped / 0 cancelled**, 39 additional cases over 536. The updated actual-hook readiness regression was observed failing (false vs true) before production edits and passes after the handoff. Tests cover projection benchmarks/roundtrips/clamps/bounds/grid centers/negative cells/same-cell behavior/nonmutation, invalid derivation, stale/reentrant callbacks, actual hook address clearing/reconfirmation, UI readiness/no raw points and normal property UUID/payload persistence through mocked Supabase. Existing standalone workflow/no-hidden-write coverage remains; former assertions forbidding the now-approved handoff were intentionally revised, not deleted.

Host note: the configured D: Node executable could not run or be copied; Windows reported an unavailable device and Node exit -1073741818. A temporary official Node 24.22.1 Windows x64 archive from nodejs.org was SHA256-verified against official SHASUMS256.txt before execution. npm run typecheck, npm test and npx expo install --check ran with that temporary runtime prepended only to the command's PATH. No system runtime installation or project dependency/lockfile changed. No prior silent command was counted as a pass.

Expo install --check ran online, exit 1 for unchanged pre-existing patch drift: expo 57.0.30 -> ~57.0.31, expo-location 57.0.21 -> ~57.0.22, expo-notifications 57.0.23 -> ~57.0.24. No automatic fixes applied. No new native build is required by this JS-only change; use the existing compatible MapLibre development build. No build was run.

Runtime evidence supplied by user on 2026-10-28: map/style load, confirmation map opens, pin displays/reaches review and old exact-confirmed/public-pending copy. Record this as PARTIALLY RUNTIME-VERIFIED only. New public derivation/handoff and successful Android property creation remain RUNTIME-UNVERIFIED. Manual acceptance: complete physical/address fields -> search -> select -> adjust pin -> confirm -> exact-confirmed/public-ready on address/review -> eligible Save -> explicit one save -> real owned UUID/created screen. Test each address edit resetting both points/readiness, reconfirmation, cancel/failure form preservation, uncertainty/reconciliation, account/workspace switch and exit guards. Do not infer a live save from mocked RPC tests.

No Supabase interaction or permanent live backend mutation was performed in this phase. Existing create_property_setup is reused; public derivation is frontend domain logic. Exact coordinates remain private; ordinary future GPS/PostGIS proximity must consume public property points. No GPS/discovery/OSM/ML/recommendation/NLP/360 or Phase 2-5 feature change, commit/push/merge/deployment/EAS build occurred. Skills read: all eight repository-local RentLease SKILL.md files (feature implementation, MVVM, Supabase contract, security, testing/runtime, documentation, ledger, artifact organizer); AGENTS and relevant architecture/frontend/Figma/feature documentation were reviewed. Current source and living docs agree on the resolved policy and unverified runtime acceptance.

Final review: git diff --check PASS; documentation-link validation PASS (54 local links/anchors, zero errors). No MVVM violations found in changed source: pure model calculation, workflow confirmation, composed ViewModel handoff, presentation-only UI. Persistence service/workflow, DraftProperty validation, generated database types, package files and Phases 2-5 service/workflow diffs remain empty. No runtime save acceptance is claimed.


## Streamlined composer and real portfolio (2026-10-29)

Status: IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Baseline ab15285 on feature/maptiler-property-location. Work began with a clean tree for the composer request; when the follow-up portfolio request arrived, all in-progress composer/gallery/queue changes were retained. An independently edited eas.json development-simulator profile appeared during work and was preserved byte-for-byte by this pass. No branch switch occurred.

### Implementation scope and plan

1. Preserve Phases 1-5 mutation services/contracts and the location/privacy workflow. Add a media-first one-screen composer after confirmed property creation; retain exceptional creation recovery and secondary photo management.
2. Install expo-image-picker with Expo-compatible tooling; validate a multi-image adapter and sequential workflow queue around existing propertyPhotoService.upload. Stop on unknown outcome, isolate the attempted item, preserve unattempted local selections and require reconciliation plus explicit continuation.
3. Add a read-only property-centered owner portfolio using existing authorized properties/listings/Tier 3/cover reads, pagination, safe URL validation and deterministic history/status mappings.
4. Separate workspace property/listing/mode from physical creation receipts. Open existing owned records without Phase 1 recreation, and detach into clean Post without deleting item journals. Scope dirty/operation handling and invalidate stale responses.
5. Replace fixture dashboard cards/search/statistics; move draft/publication/lifecycle feedback into matching owner surfaces. Validate meaningful model/service/workflow/actual-hook/presentation regressions; update this continuous record set, not one-off reports.

### Resulting workflow and boundaries

Post creates a new physical property, then automatically opens ListingComposerView after a confirmed UUID. Media is a horizontal saved/local/uploading/uncertain strip with cover and confirmed removal. One gallery action can select remaining capacity; JPEG/PNG/WebP and 10 MiB validation are unchanged, and each existing upload operation is sequentially awaited and refreshed. Advanced manager retains alt text, explicit order and recovery. 360 remains visibly unavailable with no implementation. All supported listing terms/content fields and save_listing_draft validation/payload/journal/baseline remain. Real preview renders saved photos in order and labels local selections; sample/Figma rendering is separate. No automatic publication occurs.

My Listings now reads owned properties, owned listing histories, own property-specific Tier 3 and owner-confirmed cover photos. Service revalidates identity before/after reads, paginates 200 rows and chunks cover reads by 100 IDs. No private coordinates/locations, obligations/tenancy/rating or new RPC are queried. Missing covers use placeholders; property-only records remain visible. Main listing priority is live > draft > archived/removed, then updated/created/ID ordering. Latest Tier 3 uses submitted_at, updated_at and ID, scoped per property. Normal dashboard contains no fixture unit codes, view/inquiry counts, rating, overdue or tenancy summary. Search/statistics derive from loaded records.

The ViewModel owns explicit workspacePropertyId/workspaceListingId/mode and selected safe property data. Creation results are handed into that workspace, never overwritten to fake existing-property selection. Exact selected-listing restoration was added to existing read paths; RPC mutation arguments/contracts remain unchanged. Non-draft status opens the existing real lifecycle view; rented/archived/removed remain read-only. Selected draft disappearance is an error, not permission to create a replacement. Post clears only transient selection/forms and invalidates old workflow generations; persisted per-item pending markers remain recoverable. Physical creation's existing unresolved account-level marker remains a separate limitation and is not silently deleted.

Global listing banners were removed. Matching draft feedback lives in composer/preview, publication feedback appears on its matching reconciliation/publication surface, lifecycle feedback only in real management. Property setup/map and the portfolio do not display unrelated item errors. Same-item busy and Stay/Leave guards remain; Post can detach an unrelated busy item without letting its late response navigate or populate the new workspace. Portfolio cache invalidation follows confirmed record adoption and entry always reloads it.

### Files and preserved local work

Added files:

- `src/features/property-listing/components/ListingWorkspaceFeedback.tsx`
- `src/features/property-listing/models/LandlordPortfolio.ts`
- `src/features/property-listing/models/PropertyPhotoSelection.ts`
- `src/features/property-listing/services/landlordPortfolioDependencies.ts`
- `src/features/property-listing/services/landlordPortfolioService.ts`
- `src/features/property-listing/viewModels/landlordPortfolioWorkflow.ts`
- `src/features/property-listing/views/ListingComposerView.tsx`
- `tests/landlordPortfolio.test.ts`
- `tests/propertyPhotoQueue.test.ts`
- `tests/propertyWorkspacePresentation.test.ts`

Modified files:

- `app.json`
- `docs/ARCHITECTURE.md`
- `docs/BACKEND_CONTEXT.md`
- `docs/FEATURES.md`
- `docs/FRONTEND_CONTEXT.md`
- `docs/ROUTES.md`
- `docs/features/PROPERTY_LISTING_MANAGEMENT.md`
- `docs/implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md`
- `docs/implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md`
- `package-lock.json`
- `package.json`
- `src/features/property-listing/models/PropertyListing.ts`
- `src/features/property-listing/models/listingNavigation.ts`
- `src/features/property-listing/services/listingDraftService.ts`
- `src/features/property-listing/services/listingPublicationService.ts`
- `src/features/property-listing/services/propertyPhotoDependencies.ts`
- `src/features/property-listing/viewModels/listingDraftWorkflow.ts`
- `src/features/property-listing/viewModels/listingPublicationWorkflow.ts`
- `src/features/property-listing/viewModels/propertyCreationWorkflow.ts`
- `src/features/property-listing/viewModels/propertyPhotoWorkflow.ts`
- `src/features/property-listing/viewModels/usePropertyListingViewModel.ts`
- `src/features/property-listing/views/CreateListingView.tsx`
- `src/features/property-listing/views/ListingManagementView.tsx`
- `src/features/property-listing/views/ListingPreviewView.tsx`
- `src/features/property-listing/views/PropertyDashboardView.tsx`
- `src/features/property-listing/views/PropertyListingFlowView.tsx`
- `src/features/property-listing/views/PropertyPhotosView.tsx`
- `src/features/property-listing/views/PublishedListingStatusView.tsx`
- `tests/marketplaceWiring.test.ts`
- `tests/propertyExitGuard.test.ts`

Preserved independent local change: `eas.json` (development-simulator profile, not authored or modified by Codex).

### Skills actually read

All eight repository-local SKILL.md files: rentlease-feature-implementation, rentlease-frontend-mvvm-guard, rentlease-supabase-contract-guard, rentlease-security-review, rentlease-test-runtime-verification, rentlease-documentation-maintainer, rentlease-implementation-ledger and rentlease-implementation-artifact-organizer. Additional installed guidance read: brainstorming (the detailed user specification already authorizes this coherent refactor), impeccable plus its product reference/context loader, and test-driven-development. Existing product/design/theme context was reused. No speculative redesign, separate design artifact or automatic commit was introduced.

### Test and runtime evidence

Queue regressions were first observed failing because the batch API was absent, then passed after implementation. Added propertyPhotoQueue.test.ts, landlordPortfolio.test.ts and propertyWorkspacePresentation.test.ts; extended actual-hook/Flow tests in propertyExitGuard.test.ts and the feature-local service import allowlist in marketplaceWiring.test.ts. Test harness scheduling was updated to settle the new explicit workspace handoff; existing assertions/verification/location/publication/lifecycle coverage were retained.

Coverage includes multi-selection normalization/cancellation/invalid types and sizes/capacity, immediate local queue state, sequential deterministic writes, stop/reconciliation/explicit resume, account/property/disposal invalidation, owner-scoped paginated reads/cover namespace validation, missing related records, listing histories/priorities, latest Tier 3/search/stats, actual property-success vs uncertain transitions, selected drafts/statuses, clean Post with pending/rejected Tier 3 or uncertain publication, in-flight lifecycle detachment, dirty exits and cross-property/listing notice suppression. These are mocked local automated tests, not live security or Android acceptance.

Dependency: expo-image-picker ~57.0.20 installed using npx expo install expo-image-picker; expo-image-loader is transitive. Verification DocumentPicker remains. Gallery-only plugin disables camera/microphone contributions; no GPS permission/read was added. A development client predating the native picker must be rebuilt. No EAS build/deployment was run. The local unavailable D: Node issue was avoided by using the previously verified temporary official Node 24.22.1 runtime for validation; no system runtime or unrelated dependency upgrade occurred.

npx expo install --check ran online, exit 1 for unchanged patch drift: expo 57.0.30 expects ~57.0.31, expo-location 57.0.21 expects ~57.0.22, expo-notifications 57.0.23 expects ~57.0.24. The new picker matches SDK 57; no automatic fixes were installed.

Backend/security: no live Supabase action, new RPC, generated-type/schema/RLS/grant/Storage change, SQL, remote test fixture or mutation was performed. No permanent live backend mutation was performed in this phase. User-supplied external read-audit provenance is in the existing backend ledger. RLS remains authoritative; no authorization was moved into Views. No MVVM violations found: Views bind presentation/actions, workflows own coordination/generations, services own authenticated reads/device/Storage operations, models remain pure.

Android acceptance still required: real portfolio property/photos/status/Tier 3; Post blank state with no prior banners; create second property -> composer; batch gallery/native cached-file reads; save/preview; both properties visible; reopen each draft/status without cross-item content; pending/rejected verification and publication uncertainty while starting another Post; marker recovery; network interruption mid-batch and explicit continuation; account switch; inactive/denied access; Stay/Leave, nested Back and large text/narrow screens. No native/live runtime success is claimed.

MapTiler/public-coordinate behavior and Phase 4/5 RPC mutation logic are unchanged. No GPS/OSM/ML/recommendation/NLP/360 work, commit, push, merge or deployment occurred. No PDF or separate phase report was generated. Living feature, history and ledger remain the continuous authoritative record set.


### Final validation evidence (2026-10-29)

- npm run typecheck: PASS, exit 0.
- npm test: PASS, exit 0; **621 total / 621 passed / 0 failed / 0 skipped / 0 cancelled** (46 additional cases over baseline 575).
- git diff --check: PASS; Git's LF/CRLF conversion advisories are not whitespace errors.
- Documentation local-link/anchor validation: PASS, **56 checked / 0 errors** across the eight affected documents.
- Expo compatibility: exit 1 for the three existing patch mismatches listed above; no automatic fixes. The installed image-picker is SDK-compatible.
- Protected-diff review: generated database types, Supabase backend files, environment values, shared maps/geocoder, exact-pin/privacy implementation, atomic per-photo service and lifecycle service/workflow have no changes. Publication/draft service edits are limited to exact selected-listing reads; mutation contracts remain unchanged.
- MVVM/security review: no View backend/external-client calls, new client, private-location portfolio read, raw URI/coordinate logs, permissive policy or item journal deletion added. Runtime/live RLS remains unverified.
- Current local scope: 10 added files, 30 modified files authored in the combined composer/portfolio work, plus the preserved independent eas.json change. No commit/push/merge/deploy/build occurred.


## Unified default Post composer (2026-10-29)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Continuation on feature/maptiler-property-location, baseline ab15285 plus the entire preserved uncommitted composer/portfolio work above. This corrects the earlier same-day UX boundary: the composer is now the default before property persistence, not merely its next screen. No branch switch, reset, commit, push, merge, deploy or build occurred; the independent eas.json edit remains untouched.

### Plan and implementation

Use the supplied complete single-scroll specification as the approved scope. Preserve the current portfolio, media queue, mutation services, journals and privacy/revision logic. Move physical/address controls into a reusable presentation section; resolve the root Post input directly to listingComposer; permit local image selection before UUID with explicit queue-preserving null-to-created binding; coordinate explicit Save in the ViewModel (property, photos, draft), with confirmed partial-success boundaries and stale/duplicate/action guards. Reuse the map as a temporary modal over the mounted composer. Keep legacy/sample/recovery paths and real management views; test actual orchestration and preserve existing regressions.

Post renders ListingComposerView immediately, including initial root postingType entry (internally normalized before render) and bottom Post. The nonfunctional community choice is not a prerequisite. The retained physical-property choice also opens the unified composer. New creation holds the existing DraftProperty, location workflow, local photo queue and listing draft at the same time. Media is the first major section, followed by physical/address fields, listing fields, explicitly local-only amenity choices, terms, rules and date. No supported field/backend mapping was removed. Existing persisted properties use safe read-only summaries; new persisted physical fields stay mounted read-only rather than inventing property UPDATE support.

The queue can select before property UUID with no context/read/upload call; cached local selections survive only an explicit new-property binding. Ordinary account/property switching and disposal still invalidate them. Save is synchronously excluded against repeat presses and competing picker changes. The ViewModel uses existing physical validation, confirmed four-coordinate handoff and create_property_setup service; accepts a real UUID; binds photo/draft/publication state; loads authorized state; uploads queued images sequentially through unchanged propertyPhotoService.upload; and invokes existing save_listing_draft only if listing minimum fields exist. Listing fields entered before UUID are preserved. Saving physical data with incomplete listing fields is allowed but explicitly reports those listing details as local. Save stays on the composer; there is no normal Property confirmed/Manage photos/Continue transition.

Property failure or uncertainty keeps the same composer/local inputs/media and uses existing recent-owned recovery without blind creation. A photo unknown outcome keeps the confirmed property and saved photos, stops processing and blocks draft save until reconciliation. Draft uncertainty keeps property/photos, disables repeated Save and exposes existing scoped reconciliation. No transaction or rollback spanning these services is claimed; no automatic publication or speculative cleanup occurs. Same-item save guards remain scoped; the portfolio and other item journals are preserved. Default forms now initialize empty, with fixtures loaded only through explicit sample actions.

The original map presentation was extracted into PropertyLocationToolView and reused by legacy setup and the composer Modal. Search/result/native pin confirmation is temporary; the composer ScrollView stays mounted, intended to retain offset. Confirm/cancel/native Back return to that same form and do not request external Leave. Address edits retain synchronous revision/generation invalidation. No provider, native renderer, geocoder, coordinate/privacy algorithm or location service changed. Real local preview shows pending images marked not saved, without Figma crops/ratings or fake publication. It returns to the composer to save. My Listings remains backend-backed; property/draft items reuse the composer, non-draft items retain real lifecycle/status.

### Files for this continuation

Added:

- src/features/property-listing/components/ComposerPropertyFields.tsx
- src/features/property-listing/views/PropertyLocationToolView.tsx

Updated application code:

- src/features/property-listing/components/ListingControls.tsx (optional editable/disabled presentation props).
- src/features/property-listing/viewModels/propertyCreationWorkflow.ts (reuse validated submit from composer, preserving legacy review path).
- src/features/property-listing/viewModels/propertyPhotoWorkflow.ts (local queue before UUID and narrow queue-preserving binding).
- src/features/property-listing/viewModels/usePropertyListingViewModel.ts (immediate Post, Save orchestration, guards, draft preservation, scoped recovery/preview).
- src/features/property-listing/views/ListingComposerView.tsx (one-screen complete form, local media and map modal).
- src/features/property-listing/views/PropertySetupView.tsx (reuse extracted tool; retained legacy/recovery path).
- src/features/property-listing/views/ListingPreviewView.tsx (local real-composer preview, no fake publication).
- src/features/property-listing/views/PropertyListingFlowView.tsx (render composer without UUID).

Tests: propertyExitGuard.test.ts, propertyPhotoQueue.test.ts, propertyWorkspacePresentation.test.ts, propertyLocationPrivacy.test.ts. Legacy hook tests now enter legacy screens explicitly rather than treating the changed normal Post entry as a wizard; mocks preserve all authoritative returned listing fields. Earlier regression cases remain, and expectations that Post returns postingType/no-UUID composer is absent were revised for this explicit requirement. Documentation: current living feature doc, ARCHITECTURE, FRONTEND_CONTEXT, FEATURES, ROUTES, this history and the continuous backend ledger. No package, permission/configuration, generated type or backend file change was introduced by this continuation.

### Validation and evidence

- npm run typecheck: PASS, exit 0.
- npm test: **632 total / 632 passed / 0 failed / 0 skipped / 0 cancelled**, exit 0. Eleven additional cases over 621.
- The pre-UUID selection regression was observed failing (zero queued files instead of four) before adding local selection/binding. Passing coverage includes default immediate Post/Flow view, full physical/address/listing/media-first presentation, map modal and actual state round-trip/revision clearing, property -> sequential photos -> draft ordering, pre-UUID listing retention, repeat Save/competing picker exclusion, physical known/unknown failure, photo uncertainty, draft uncertainty/no blind resave, incomplete listing wording, local preview and late picker disposal. Existing portfolio/verification/privacy/publication/lifecycle tests remain.
- npx expo install --check: exit 1 for unchanged pre-existing expo/location/notifications patch drift documented above. No fixes or additional dependencies were installed.
- git diff --check and documentation-link validation: recorded below after final documentation edits.
- No Android/client runtime test occurred. No EAS build was run. This JavaScript/presentation refactor adds no native rebuild requirement; clients that still lack the earlier expo-image-picker/MapLibre dependencies must use an appropriately rebuilt development client.

MVVM/security review: Views only render/bind controls and native presentation. Pure mapping/validation models and existing services are reused; the composed ViewModel owns cross-stage async orchestration, identity/generation checks, loading, notices and partial success. No direct View Supabase call, duplicate client or frontend authorization replacement was introduced. Existing RPCs/RLS remain authoritative. No live Supabase action or permanent live backend mutation was performed in this phase. The ledger records this as local-only contract reuse, not a live RPC test. No GPS/OSM/ML/NLP/recommendation/360 implementation occurred. Amenities remain local-only; existing physical property editing is not invented.

Android acceptance: tap Post -> immediate Photos/Property/Location/Listing form; select several photos before UUID; fill property/address; open search/map, adjust/confirm, verify same composer values/scroll; edit address and reconfirm; fill listing and Save once, expect property -> ordered photos -> draft while staying on composer. Verify no created/manager/Continue screens, one UUID after retries, truthful incomplete listing, each partial failure/reconciliation boundary, native Back, Stay/Leave, account/workspace switch, pending Tier 3/other item uncertainty and real portfolio reopen. Native scroll offset/keyboard behavior, gallery/native file access, live RLS and actual persistence remain RUNTIME-UNVERIFIED.


Final continuation checks: git diff --check PASS; documentation-link/anchor validation **58 checked / 0 errors**. Protected diff review confirms unchanged creation/photo/lifecycle mutation services, lifecycle workflow, generated database types, shared geocoder, exact-map renderer, public privacy model/location workflow, environment and Supabase backend files. Source review found no MVVM violations. All current uncommitted work remains; independent eas.json content was not edited. No commit/push/merge/deploy/build occurred.

Skills used/read in this continuous implementation pass: .codex/skills/rentlease-feature-implementation/SKILL.md; rentlease-frontend-mvvm-guard/SKILL.md; rentlease-supabase-contract-guard/SKILL.md; rentlease-security-review/SKILL.md; rentlease-test-runtime-verification/SKILL.md; rentlease-documentation-maintainer/SKILL.md; rentlease-implementation-ledger/SKILL.md; rentlease-implementation-artifact-organizer/SKILL.md (all sibling paths under .codex/skills). Installed brainstorming, impeccable/product context and test-driven-development guidance were also read earlier in this same continuous pass. No new per-phase report was created.


## Two-page Post refinement (2026-10-29)

Status: IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. This supersedes the same-day single-page Post checkpoint without discarding its implementation/evidence. Existing uncommitted composer, portfolio, location and independent eas.json work were preserved.

Default Post is Property (`listingComposer`) -> Listing Details (`listingDetails`) -> Preview. Property has Media first, physical fields, local-only amenities and location. Next only navigates. Listing Details has a compact property summary/Edit property and offering fields, Save draft and Preview. Existing draft opens Listing Details, property-only opens Property and non-draft keeps real status/lifecycle. Back/Edit preserve both-page state; map modal returns to Property. Existing ordered Save remains property -> real UUID -> sequential photos -> listing draft. Tier 3 is unchanged.

Added presentation/model files: components/ComposerRecoveryFeedback.tsx, PropertyMediaSection.tsx, PropertyMediaViewer.tsx; models/PropertyMedia.ts; views/ListingDetailsView.tsx (under src/features/property-listing). Updated ListingComposerView, ComposerPropertyFields, PropertyListingFlowView, usePropertyListingViewModel, propertyPhotoWorkflow, PropertyListing/listingNavigation models, safe portfolio physical-field projection/model and associated tests. Shared FullscreenDocumentImage/documentImagePreview gained optional bounded gallery navigation/swipe support; existing verification defaults and Admin URL lifecycle remain unchanged. This builds on the earlier uncommitted files listed above, not a new clean-tree baseline.

Media has a 4:3 active preview, thumbnails, shared fullscreen pinch/pan/double-tap, fitted-image swipe and previous/next controls. Active selection never changes backend cover/order. Add 360° interior is a disabled control inside Media, not 360 support. Local files remain local before UUID. Gallery close/hardware Back preserves state; different images reset zoom. No URI is used as a debug key or logged. No new dependency/native rebuild is introduced by this refinement; the dev client must already contain earlier native dependencies. No build was run.

Validation: npm run typecheck PASS (exit 0); npm test **643 total / 643 passed / 0 failed / 0 skipped / 0 cancelled** (11 more than 632). Tests cover local-only Next and shared dirty scope, existing draft entry/Edit, large preview and thumbnail wiring, gallery close/Android Back, bounded selection/reset, separate cover action, swipe eligibility and descriptor privacy. Existing ordered-save, failures/reconciliation, portfolio, verification and location regressions pass. D: Node is now available (v25.8.2), and D:/npm.cmd ran these checks; the removed temporary runtime was not counted as a validation pass.

No live Supabase action or permanent backend mutation occurred. Safe owner portfolio SELECT adds existing floor_number/total_floors/max_occupants only; mutation contracts, generated types, Maps/privacy implementation and backend policies remain unchanged. No MVVM violation found: presentation binds ViewModel state; workflow owns media state/coordination; service owns authorized reads. No GPS/OSM/ML/NLP/recommendation/360 implementation, commit/push/merge/deploy/EAS build occurred.

Manual Android acceptance: Post/media-first layout, large text/narrow width, local selection, fullscreen pinch/pan/swipe/Close/hardware Back, independent cover control; map confirm/cancel returns to Property; Next has no writes, Edit/Back/Preview preserve fields and dirty state; explicit Save retains UUID/ordered uploads/draft recovery; reopen property-only/draft/non-draft items; account switching and Stay/Leave. New native interactions and actual persistence remain RUNTIME-UNVERIFIED.

Final compatibility check: npx expo install --check ran online, exit 1 only for unchanged expo 57.0.30/~57.0.31, expo-location 57.0.21/~57.0.22 and expo-notifications 57.0.23/~57.0.24 patch drift. No automatic fixes applied.

Final whitespace/link checks: git diff --check PASS; local documentation links/anchors **60 checked / 0 errors**. Existing uncommitted work including independent eas.json is preserved.


## Root Post product/navigation chooser (2026-10-30)

Branch feature/search-discovery-backend-integration, baseline 7eb361b, with all prior uncommitted manual-search/runtime corrections preserved. Scope: root posting boundary only. Existing postingType was bypassed by initial-state normalization and the property toolbar's direct startCreate callback. Reused that screen rather than adding another chooser.

Changed source: src/features/property-listing/viewModels/usePropertyListingViewModel.ts (honor postingType initial state, guarded root openPostingType action, chooser-to-composer navigation retaining local state); views/PropertyListingFlowView.tsx (toolbar Post binding); views/CreateListingView.tsx (shared Create header, simple Property Listing choice, disabled Community Post/Coming soon). Direct dashboard property-start actions preserve their old composer route. No property/media/location/draft/publication/lifecycle service/workflow/model, Auth/role gate, backend contract, dependency or toolbar design changes.

Tests: propertyExitGuard.test.ts adds actual-hook root chooser, Property Listing continuation, clean root Back, dirty chooser resume/Stay and direct-dashboard regression cases; existing composer harness now explicitly chooses Property Listing before its unchanged media/map/ordered-save assertions. Existing Post-detachment tests invoke the real toolbar callback and expect the chooser; their durable journal/stale-operation checks remain. propertyWorkspacePresentation.test.ts adds actual chooser rendering/action/disabled Community option/Close and existing role-policy tests. New root/toolbar tests failed before implementation; no previous save/photo/map/verification/GPS regression was removed.

Documentation: this record, PROPERTY_LISTING_MANAGEMENT.md, the same backend ledger and concise ROUTES/FRONTEND_CONTEXT/ARCHITECTURE pointers updated. Older dated composer checkpoints remain historical; current root Post descriptions were corrected in place. Community Posts are an unavailable future destination, not a fake form or a newly defined authorization policy.

No Supabase interaction or permanent backend mutation occurred in this navigation-only pass. No permanent live backend mutation was performed in this phase. No Community Post backend, recommendation/OSM/saved/rating/ML/NLP/360 work, branch creation, commit/push/merge/deploy/EAS build. Relevant repository feature/MVVM/security/contract/testing/documentation/ledger/artifact skills remain applied; no new standalone report. Status IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.

Validation: npm run typecheck PASS (exit 0); full npm test **743 total / 743 passed / 0 failed / 0 skipped / 0 cancelled**, six additional tests over the preserved 737 baseline. Expo install --check exits 1 for the same existing expo 57.0.30/~57.0.31, expo-location 57.0.21/~57.0.22 and expo-notifications 57.0.23/~57.0.24 patch drift; no fixes/install applied. Manual Android chooser, Back/Close/Stay/Leave, role and existing composer acceptance remain required.

Final chooser checks: git diff --check PASS; combined affected Property/Search/global Markdown links and anchors **73 checked / 0 errors**. Protected diff review confirms property/media/location/draft/publication/lifecycle services/workflows, generated types, package/native config and backend files unchanged. MVVM review found only presentation/state routing changes; no View data access or new authorization authority. Prior Search/GPS uncommitted work remains intact.

## Publication runtime correction and native availability (2026-10-30)

Branch feature/search-discovery-backend-integration, baseline 7eb361b plus existing uncommitted Search/GPS corrections and Post chooser work, all preserved. Status IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. No unrelated feature implementation, commit, push, merge, deploy or EAS build.

Confirmed source defect: listingPublicationService.read previously threw uncertain for ordinary failed listing reads, including the pre-RPC read. Live read-only inspection also confirmed authenticated lacks tenancy SELECT while enabled tenancy RLS limits reads to parties/Admin. These are confirmed facts; the exact failing Android request stage and whether its RPC was sent remain unconfirmed until the next diagnostic run. No live publication test was performed.

Changed publication model/service and added services/publicationDiagnostics.ts: distinguish read errors from true mutation uncertainty; preserve actionable known RPC rejection, durable marker, exclusion and account/generation guards. Safe dev diagnostics contain only stage/code/classification/rpcSent. Read-only reconciliation retains unresolved markers on read failure and adopts successfully confirmed draft/active/other supported lifecycle states without republishing. Workflow/lifecycle mutation behavior remains unchanged. Existing publication tests were extended; preflight/read-only failure regressions failed against the old source before correction. The generic unknown 42501 test expectation now reflects access rather than incorrectly asserting an eligibility cause.

Added models/AvailabilityDate.ts, components/AvailabilityDateField.tsx and tests/availabilityDate.test.ts. ListingDetailsView and the retained CreateListingView availability step share the native date interaction. Local calendar components generate ISO YYYY-MM-DD; selected date displays human-readable text, changes and clear are optional. Existing past-date acceptance, payload mapping/default null and manual-string validation remain. No new date business constraint or raw localized persistence. PropertyWorkspacePresentation tests stub only the native presentation boundary; focused tests exercise actual picker callbacks and pure date helpers, including UTC/Manila/Honolulu and leap dates.

Expo installed @react-native-community/datetimepicker 9.1.0 using npx expo install; package.json, package-lock.json and app.json plugin updated. Dependency resolution confirms 9.1.0. Rebuild the native development client if it lacks this module. No build was performed.

Prepared supabase/migrations/20261030042030_authenticated_tenancies_select.sql with the exact narrow GRANT SELECT ON TABLE public.tenancies TO authenticated; it is NOT APPLIED. Existing RLS is unchanged and authoritative; no anon/write/service-role grant or bypass. Read-only inspection and exact provenance/security reasoning are in the existing backend ledger. No permanent live backend mutation was performed in this phase.

Validation: npm run typecheck PASS; npm test 756 total / 756 passed / 0 failed / 0 skipped / 0 cancelled (13 added over the preserved 743-test baseline). Expo install --check exit 1 only for existing patch drift: expo 57.0.30 -> ~57.0.31, expo-location 57.0.21 -> ~57.0.22, expo-notifications 57.0.23 -> ~57.0.24. No automatic upgrades. Final whitespace/local-link results are recorded below. Tests are mocked/local, not Android or live RLS acceptance.

Manual Android: native calendar opens only on tap, cancellation preserves date; select/change/save/reload/clear maintains the same date or unset. Publication preflight denial must show access error without uncertain state; known rejection actionable; successful publish confirmed; lost post-send response retains marker; Check publication status reads only. Actual Android failure stage remains to be identified using PUBLICATION-DIAG. Existing composer, portfolio, photos, Search and Post chooser work is preserved; no Community Posts/recommendations/OSM/saved listings/360 implemented.

Skills actually read: repository-local rentlease-feature-implementation, rentlease-frontend-mvvm-guard, rentlease-supabase-contract-guard, rentlease-security-review, rentlease-test-runtime-verification, rentlease-documentation-maintainer, rentlease-implementation-ledger and rentlease-implementation-artifact-organizer SKILL.md files; systematic-debugging, test-driven-development, writing-plans, impeccable and Supabase guidance were also consulted. Views contain no direct backend access; models remain pure, existing workflows/ViewModel own state/coordination and service owns RPC/read/journal operations. No MVVM violation found.

Final validation for this correction: typecheck exit 0; full suite 756/756 passed, 0 failed/skipped/cancelled; git diff --check PASS; local documentation links/anchors 75 checked, 0 errors across the 11 affected living/global/evidence documents. Dependency resolution confirms datetimepicker 9.1.0. Existing generated Supabase types, listing draft service, lifecycle service and publication workflow have no changes in this pass. No Android/native build acceptance or live mutation was performed. Existing Search/Post uncommitted work remains present.


## Required fields, amenities, completeness and property diagnostics (2026-10-31)

Goal/design: apply the supplied focused runtime/product correction on feature/search-discovery-backend-integration in C:/dev/RentLease-Frontend, baseline 7eb361b plus preserved uncommitted Search/GPS, Post chooser, publication/date-picker, Property/Listing and docs work. The prior Desktop path is no longer the Git working tree. No new branch, dependency, commit or native build is part of this pass. Existing untracked android/ and ninja-error.txt were observed before edits and preserved.

Plan executed as one coherent sub-flow:

- Inspect the current uncommitted property/composer/save/photo/draft/publication/location code and generated contracts; inspect the real RPC, catalogue grants/policies and completeness trigger read-only.
- Reproduce generic-error/unsupported amenity failures with focused tests; preserve durable creation uncertainty while adding pure safe error mapping and dev-only staged diagnostics.
- Bind active catalogue through feature service/workflow to DraftProperty numeric IDs, with owner reads, lifecycle cleanup and no direct writes or fabricated IDs.
- Add reusable required labels/inline first-issue feedback and compact exact-weight completeness in Property, Listing Details and Preview; prefer matching server listing score after save/reload.
- Move the shared MapTiler default to streets-v4 without changing URL/key handling, attribution or private/public handoff. Inspect sources safely, without pretending the native warning is resolved.
- Run typecheck, full tests, Android Hermes export, Expo/diff/link checks; update this existing record set.

### Files created

Under src/features/property-listing/:

- components/FieldLabel.tsx, components/ListingCompletenessSummary.tsx, components/PropertyAmenitiesFields.tsx
- models/ListingCompleteness.ts, models/PropertyAmenity.ts, models/PropertyCreationError.ts
- services/propertyAmenityService.ts, services/propertyAmenityDependencies.ts, services/propertyCreationDiagnostics.ts
- viewModels/propertyAmenityWorkflow.ts

New tests: tests/listingCompleteness.test.ts, tests/propertyAmenities.test.ts, tests/propertyMapStyle.test.ts.

### Existing files modified in this pass

Under src/features/property-listing/:

- components/ComposerPropertyFields.tsx, components/ListingControls.tsx
- models/DraftProperty.ts, models/PersistedListingDraft.ts
- services/propertyCreationService.ts
- viewModels/propertyCreationWorkflow.ts, viewModels/usePropertyListingViewModel.ts
- views/ListingComposerView.tsx, views/ListingDetailsView.tsx, views/ListingPreviewView.tsx, views/PropertySetupView.tsx, views/CreateListingView.tsx

Also: src/shared/services/maps/mapTiler/mapTilerConfig.ts; tests/propertyCreation.test.ts, tests/propertyExitGuard.test.ts, tests/propertyLocationPrivacy.test.ts, tests/propertyWorkspacePresentation.test.ts, tests/marketplaceWiring.test.ts; docs/ARCHITECTURE.md, docs/FEATURES.md, docs/features/PROPERTY_LISTING_MANAGEMENT.md, this history and the existing backend ledger. The existing generated database types, publication/lifecycle/draft service contracts, photo/upload services, dependencies/package files and native files were not changed by this pass. Earlier uncommitted edits to other files remain preserved.

### Results and boundaries

Confirmed code cause of misleading UX: propertyCreationWorkflow replaced known safe service errors with a generic fallback; propertyCreationService also collapsed known RPC rejections. PropertyCreationError now maps exact inspected backend messages and the workflow preserves those safe messages. Safe PROPERTY-CREATE-DIAG stages distinguish eligibility/validation/journal/RPC/receipt failures, code/category and whether a request may have crossed the mutation boundary. No raw backend detail, IDs, address, coordinates or credentials are logged. The original device failure itself was not reproduced; its precise stage/code still requires Android diagnostics. It is not assumed to be a missing text field or map warning.

The creation journal, exclusion Set, identity/generation guards, UUID receipt validation and explicit recent-property reconciliation remain. Known preflight failure sends no RPC; known SQL rejection is not uncertain; unknown transport/receipt/post-send result stays uncertain and blocks blind retries. Payload selection changed only p_amenity_ids from forced [] to validated selected real IDs (empty remains []). Catalogue loading/error/retry and selected state are ViewModel/workflow-owned. Existing saved amenities are read-only; no post-creation association mutation path is invented. Owner-scoped private-location existence read returns property_id only, never private content.

Exact completeness weights: title 10, trimmed >=30-character description 15, positive rent 10, availability 5, floor area 10, occupants 5, private location existence 15, photos 20, persisted amenities 10. Integer local estimate before persistence; matching server completeness_score always wins after save/reload. Multiple photos/amenities contribute once. The 80% threshold and all other server publication checks remain unchanged. Nonblank short descriptions still save drafts. No ranking boost/recommendation algorithm or safety_rating field was invented; trustworthy safety_rating provenance remains a future recommendation integration decision.

Required asterisks identify type/city/barangay/address/location and listing title/description/rent. Defaults and optional fields remain optional. Pure first-issue mappings locate feedback without View backend logic. The retained sample amenity flow is explicitly labeled sample-local and no longer uses a misleading 100% label.

MapTiler default streets-v2 -> streets-v4 is confirmed by official guidance. Safe actual style inspection found maptiler_planet_v4 with TileJSON URL and maptiler_attribution without URL/tiles. The latter is a plausible warning source; no native correlation or disappearance is claimed. Attribution is retained, no provider source is rewritten, and no warning is suppressed. Existing exact/public location/privacy tests remain passing. Map rendering and property RPC failure remain separate concerns.

### Evidence

The added known-error/amenity tests failed against the prior source; the completeness test initially failed because the helper did not exist. Catalogue, first-issue/required labels, safe diagnostic fields, server override and actual ViewModel ID selection tests were added. Existing location privacy presentation harness gained a FieldLabel stub after its one new-import failure; privacy/readiness assertions were preserved, not removed.

Validation: npm run typecheck PASS. Full npm test 793 total / 793 passed / 0 failed / 0 skipped / 0 cancelled (37 additional over 756). Android/Hermes export PASS: 1107 modules, .hbc artifact in temporary output; no EAS or native device test. Expo install --check exit 1 only for unchanged patch drift: expo 57.0.30 vs ~57.0.31; expo-location 57.0.21 vs ~57.0.22; expo-notifications 57.0.23 vs ~57.0.24. No automatic upgrades/new package/native rebuild required by this pass. Final diff/link evidence follows below.

Skills actually consulted: using-superpowers, systematic-debugging, brainstorming, writing-plans, test-driven-development, impeccable (context loader and product reference), Supabase, verification-before-completion; existing documentation-maintainer file was consulted for the continuous evidence format. The detailed user specification supplied the approved implementation scope; no extra report/design file or automatic commit was introduced.

MVVM/security review: pure models own mappings/score/validation; Views bind existing ViewModel state and own presentation only; workflows coordinate async/loading/disposal; services own authenticated reads/RPC/journal. No direct View backend call, second client, authorization bypass, secret logging, schema/policy/function/grant/Storage change or score write. Read-only backend evidence is in [the existing ledger](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#property-creation-and-completeness-contract-inspection-2026-10-31).

Android acceptance remains RUNTIME-UNVERIFIED: required stars/blank barangay feedback, catalogue load/retry/select/create, confirmed private/public handoff and safe save error diagnostics; true uncertainty/restart/rapid taps/account changes; local progress increments then server score after Save/reload; normal existing publication; map render/pin/attribution and ParseStyle warning. No Recommendation/XGBoost/OSM/Community/NLP/360/safety-rating implementation, live mutation, commit/push/merge/deploy/EAS build occurred. No permanent live backend mutation was performed in this phase.


Final verification (2026-10-31): final source typecheck exit 0; full suite 793/793 passed, 0 failed/skipped/cancelled. Final Android Hermes export exit 0, 1107 modules and .hbc output in temporary directory. git diff --check PASS. Local documentation-link/anchor validation across 11 affected documents: 78 checked, 0 errors. No extra dependency or native build; Expo compatibility remains the three documented existing patch mismatches. Final branch unchanged, all earlier uncommitted work and native build files retained. No live mutation, commit, push, merge, deploy or EAS build.


## Backend completeness freshness local-tested migration (2026-10-31)

Branch feature/search-discovery-backend-integration; existing uncommitted frontend work, android/ and ninja-error.txt preserved. Scope is backend completeness correctness only. The user explicitly authorized preparing/testing a migration but prohibited live mutation. Plan executed: inspect live trigger/function/index/ACL metadata read-only; centralize the exact formula; prepare narrow cross-table triggers and transaction guards; test against a disposable local Supabase Postgres 17 image through Supabase CLI/pgTAP; review concurrency/security; update this continuous record set. No branch switch or frontend redesign.

### Files added/modified

Added:

- supabase/migrations/20261031072616_optimize_listing_completeness_refresh.sql (CLI migration new generated filename)
- supabase/tests/listing_completeness_refresh.sql (74 rolled-back pgTAP assertions)
- supabase/tests/run_completeness_concurrency.py (4 local integration checks, no remote URL accepted)
- supabase/test-support/listing_completeness_schema.sql (minimal isolated schema, never a production migration)
- supabase/test-support/README.md (exact reproduction and cleanup commands)

Modified only the three existing Property & Listing records: docs/features/PROPERTY_LISTING_MANAGEMENT.md, this history and docs/implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md. No application/generated-type/package/native file changed in this pass. Existing prepared 20261030042030_authenticated_tenancies_select.sql was untouched/unapplied; SHA256 remained 57872902bc34791fc586a0aa9850ccfaad70faf5548cc7cf7fe8bbe4ad59a622.

### Design and correctness

One invoker-only internal calculator owns weights 10/15/10/5/10/5/15/20/10. validate_listing_owner delegates without weakening owner/draft-first/active >=80%/published_at behavior. An internal definer refresh helper is necessary because related writers have SELECT-only listings privileges; it is not client-executable and no new refresh RPC is exposed. The dedicated schema is outside exposed public API schemas, EXECUTE/USAGE is revoked from clients and function search_path is pg_catalog.

AFTER triggers cover photos/amenities/private-row existence INSERT/DELETE and actual property_id reassignment, plus changed floor_area_sqm/max_occupants. BEFORE triggers serialize relevant mutations in the existing property advisory namespace. New/old property IDs and listing locks are ordered. No-op score comparisons avoid listing writes/timestamp churn. Metadata-only photo/private edits and unrelated property updates do not refresh. Historical listing states refresh current-property score without lifecycle mutation. Parent CASCADE semantics are preserved. No new index or table grant/RLS policy is introduced.

An active completeness violation aborts the whole related transaction. A race test verifies two individually-safe removals from different related tables cannot commit an invalid combined active score. Unsupported old-snapshot isolation is rejected before related writes; live default READ COMMITTED is confirmed. There is no refresh recursion: listing validation only reads the calculator, which writes nothing.

Backfill handles existing stale rows. Independent review identified that changed-score-only updates would skip an already-current invalid active score; a separate calculated-score deployment preflight now closes that gap. Both stored 0.0000 and stored 0.2000 active/calculated 0.2000 fixtures abort and roll back the entire migration, not just data changes. Reviewer confirmed no outstanding findings after the correction. Operators must resolve invalid active records through existing authorized lifecycle actions, not automatic pausing in this migration.

### Validation and limitations

Applied ONLY to disposable container rentlease-completeness-test-20261031 using cached public.ecr.aws/supabase/postgres:17.6.1.141; no host data volume and localhost port 55438. Final fresh test database rentlease_completeness_final used the final minimal fixture. This is not a full production schema recreation: Auth, PostGIS, Storage, tenancy and publication RPC integrations are not modeled. Production privileges/policies/functions were inspected but not executed or altered.

- Supabase CLI pgTAP: 74 passed / 0 failed, one rolled-back transaction. Includes exact contributions, no-op ctid checks, reassignments, all historical states, active critical losses, published_at, ownership, RLS, non-executable helpers and parent cascades.
- Python real PostgreSQL checks: 4 passed / 0 failed (two-session cross-table race, stale invalid active backfill rollback, current invalid active backfill rollback, unsupported isolation rejection). Committed test fixtures/temporary databases cleaned.
- npm run typecheck: PASS; npm test: 793 total / 793 passed / 0 failed / 0 skipped / 0 cancelled. No new frontend test count is claimed.
- supabase db lint on public,rentlease_completeness: PASS, no schema errors. Initial public pgTAP lint noise was resolved by installing test extensions outside public; fixture default broad grants and pgTAP schema usage were corrected to model intended access. These were test-fixture fixes, not live privilege changes.
- Local security/performance advisors: no ERRORs; six WARNs (five test-policy auth_rls_initplan notices, one baseline set_updated_at mutable search_path). No completeness helper warning. Existing live advisor warnings (mutable set_updated_at, callable definer functions, disabled leaked-password protection) were recorded without unrelated changes.
- EXPLAIN: small fixtures can legitimately choose sequential scans; private-location PK used normally. Transaction-local disable-seqscan eligibility check used existing photo/order index, amenity PK and listings property index. No server planner setting persisted or redundant index added.

Frontend unchanged: authoritative score wins after the existing read/reopen; no realtime/polling/write workaround is added. Android/live migration acceptance is UNVERIFIED. The live project still uses listing-write-only freshness until separately authorized deployment. Formula/80% threshold, Recommendation/XGBoost/OSM/NLP/360/Community/safety scoring and tenancy permissions are unchanged.

Skills consulted: Supabase, Supabase Postgres best practices (including locking guidance), systematic debugging, test-driven development, verification-before-completion and requesting-code-review. A read-only reviewer inspected the new SQL/test files; the one deployment edge case was corrected and re-reviewed. Existing continuous documentation/ledger format is retained; no standalone phase report.

No permanent live backend mutation was performed in this phase. No commit, push, merge, deployment or EAS build. Final whitespace/link/cleanup evidence follows below.


Final evidence (2026-10-31): 74/74 pgTAP and 4/4 extra backend checks passed; frontend typecheck PASS and 793/793 tests passed (0 failed/skipped/cancelled); SQL lint no schema errors; git diff --check PASS; documentation links/anchors 84 checked, 0 errors. The exact disposable test container ID was verified before stopping; --rm removed it and docker ps confirmed no matching container remains. Local test schemas/data are discarded. Tenancy migration SHA256 remains unchanged. Final branch feature/search-discovery-backend-integration; live deployment NOT performed. No commit/push/merge/deploy/EAS build.


## Contextual completeness guidance (2026-10-31)

Scope/plan: preserve the existing uncommitted branch and backend integrations; inspect the current completeness array/form/UI; expose keyed contribution metadata without changing calculation; remove the summary checklist; reuse one understated hint next to the action; test missing/completed/read-only/server states and existing regressions; update this continuous record set. No new branch, design-system artifact or standalone report.

Added: src/features/property-listing/components/CompletenessHint.tsx.

Modified under src/features/property-listing/: models/ListingCompleteness.ts; components/ListingCompletenessSummary.tsx, ListingControls.tsx, ComposerPropertyFields.tsx, PropertyMediaSection.tsx, PropertyAmenitiesFields.tsx; views/ListingDetailsView.tsx. Tests modified: tests/listingCompleteness.test.ts and tests/propertyWorkspacePresentation.test.ts. Documentation modified: docs/features/PROPERTY_LISTING_MANAGEMENT.md, this history and the existing backend ledger. All other pre-existing work was preserved.

Design: existing Roboto/supporting text, neutral ink, spacing and required labels. No hint cards, extra icons/status colors, new fonts or libraries. The summary keeps percentage/bar/status but no detached task list. Hints sit at photos +20, location +15, floor area +10, occupants +5, amenities +10, title +10, rent +10, description +15 and availability +5. Satisfied hints hide; saved physical/amenity fields suppress tasks that cannot be performed there. Description uses the existing threshold; address typing does not satisfy map confirmation. Optional fields remain optional.

Architecture: the original contribution array gains stable keys and is returned as metadata. The estimator still reduces the same weights/booleans; server authority/raw 0.80 threshold are unchanged. CompletenessHint looks up model metadata and renders text/null; no new JSX score calculation or View backend access. ListingField accepts ReactNode helper content and retains string helper behavior. Services, ViewModel/workflows, journals and navigation have no edits.

Tests: seven added regression cases cover preserved percentage/no checklist, location placement/completion, description placement/29-to-30 transition, photo placement/selection, other weights/read-only suppression, stable metadata and server score independence. The previous static-description-helper assertion now checks the contextual helper; validation and all existing regression assertions remain. Tests failed before implementation. An intermediate regression caught Windows default text-decoding corruption in existing labels; original UTF-8 labels were restored before final validation. No such incidental label change remains.

Evidence: npm run typecheck PASS; npm test 800 total / 800 passed / 0 failed / 0 skipped / 0 cancelled (7 added over 793). Protected hashes verify 64 backend/service/workflow/ViewModel/shared-service files unchanged, including every existing migration. No dependency/native-build change or EAS build. Final whitespace/link evidence follows below. Android visual/runtime behavior is RUNTIME-UNVERIFIED; use the living feature's short checklist.

Read instructions: AGENTS.md, architecture/frontend/Figma guidance, current feature/history/ledger and relevant source/tests. SKILL.md files read under .codex/skills/: rentlease-feature-implementation, rentlease-frontend-mvvm-guard, rentlease-supabase-contract-guard, rentlease-security-review, rentlease-test-runtime-verification, rentlease-documentation-maintainer, rentlease-implementation-ledger, rentlease-implementation-artifact-organizer. Requested global design SKILL.md files read: hallmark, design-taste-frontend, frontend-design, impeccable and ui-ux-pro-max. Existing product/design context and app-screen/product guidance were consulted. The optional ui-ux-pro-max search script was absent at its documented installed path; existing guidance/tokens were applied without generating or replacing the design system.

Backend provenance correction: the user reports the existing completeness migration is now deployed live. Current living status is corrected to USER-REPORTED DEPLOYED; prior local-only evidence remains historical. Codex made no live inspection or mutation in this pass, and no exact external execution transcript/tool/date was supplied. No Supabase/migration/RPC/RLS/trigger/publication/recommendation change was made. No permanent live backend mutation was performed by Codex in this phase. No commit, push, merge, deployment or EAS build.


Final contextual-guidance validation: typecheck exit 0; npm test 800 total, 800 passed, 0 failed/skipped/cancelled; git diff --check PASS; local Markdown links/anchors 86 checked, 0 errors. Protected-file audit: 64 pre-existing backend/service/workflow/ViewModel/shared-service files unchanged. Android guidance UI remains RUNTIME-UNVERIFIED. No Supabase access/mutation, dependency change, commit/push/merge/deploy/EAS build.


## Property save rejection diagnosis (2026-10-31)

Preserved all existing uncommitted Search/Discovery, Post, property/media, package, native and documentation work. User log establishes a sent `create_property_setup` RPC rejected with PostgreSQL `23514` (CHECK violation). Exact constraint was absent from the old log; no speculative persistence workaround was applied. The 100% local estimate is separate from database acceptance. Current live RPC signature, constraints, triggers, PostGIS function schemas and EXECUTE/RLS settings were inspected read-only. No production create/test mutation was executed.

Changed only `services/propertyCreationDiagnostics.ts` under property-listing, `tests/propertyCreation.test.ts`, and the existing living feature/history/backend ledger during this investigation. Diagnostics add operation, outcome, SQLSTATE message category, redacted-details marker and explicitly allowlisted constraint identity; no raw SQL/backend objects/private rows are emitted. Two regressions were observed failing before implementation, then passed: CHECK rejection identifies a safe constraint and clears only the confirmed-failure journal; unknown transport retains its marker and blocks a second create. Existing private-data suppression expectations were updated for the new structured fields.

Validation: `npm run typecheck` PASS; full `npm test` 802 total / 802 passed / 0 failed / 0 skipped / 0 cancelled. The initial ad-hoc tsx invocation was unsupported (tsx is not installed); validation used the established `scripts/run-tests.cjs` harness instead. Android RUNTIME-UNVERIFIED for new diagnostics. Capture the new constraint field after JS reload before choosing a field/backend correction. Existing source also lacks a cross-field floor_number <= total_floors preflight check, matching a live database CHECK, but there is no evidence yet that this was the user's failing constraint; no assumption was made.

Skills read during this continuing work: repository-local feature-implementation, frontend-mvvm-guard, supabase-contract-guard, security-review, test-runtime-verification, documentation-maintainer, implementation-ledger and implementation-artifact-organizer SKILL.md files; systematic-debugging, test-driven-development, verification-before-completion and Supabase guidance were applied. No permanent live backend mutation was performed in this phase. No migrations, dependency changes, completeness UI/formula changes, commit, push, merge, deployment or EAS build were performed. Exact field correction remains pending runtime constraint evidence.


## Saved-property workflow repair (2026-10-31)

Branch feature/search-discovery-backend-integration; baseline for this pass was 802 passing tests plus all pre-existing uncommitted Search/Discovery, Post chooser, property/media, diagnostics, package/config, native and documentation changes. Those changes were preserved. User now reports Android physical-property creation succeeds with a real UUID; downstream photo access and listing continuity failed. Creation is user-reported RUNTIME-VERIFIED, repairs remain Android RUNTIME-UNVERIFIED.

Audit covered PropertySetup/Composer/ListingDetails/Preview/Photos/Flow/Portfolio, creation/photo/draft/publication/lifecycle workflows/services, models/generated contracts, account-keyed root composition and actual hook tests. Confirmed three code defects through failing regression tests before correction: render-only property adoption could be skipped by immediate photo navigation; photo identity-read exceptions reset propertyId, leaving Check Status unable to load; initial hydration overwrote local rental fields. Physical read-only fields and blank fields when no listing was ever persisted are intentional boundaries, now explained. The same publication-completeness formula powers both pages; 40% can be physical contributions only, not evidence of a second formula. Exact earlier Android form inputs are unavailable.

Implemented synchronous confirmed-receipt adoption at navigation, existing portfolio hydration for receipt-only summaries, source-aware draft load/save/adopt callbacks with a separate confirmed baseline, and recoverable photo binding with remembered-owner/generation checks. No new persistence store, navigation layer, Supabase client, duplicate property creation or service mutation behavior. Successful photo recovery now displays its notice. Removed redundant confirmation detours in favor of one continuation, replaced disabled saved physical forms with a readable summary, named the saved return action Property and photos, and made rental read-only conditions explicit. Availability picker accepts a presentation-disabled prop to match the existing ViewModel guard. Contextual completeness hints are retained.

Files changed in this pass (src/features/property-listing/ prefix): viewModels/usePropertyListingViewModel.ts, viewModels/propertyPhotoWorkflow.ts, viewModels/listingDraftWorkflow.ts, components/ComposerPropertyFields.tsx, components/PropertyMediaSection.tsx, components/AvailabilityDateField.tsx, views/PropertySetupView.tsx, views/PropertyPhotosView.tsx, views/ListingComposerView.tsx, views/ListingDetailsView.tsx. Tests: propertyExitGuard.test.ts, propertyPhotos.test.ts, propertyWorkspacePresentation.test.ts. Documentation: existing living feature/history/ledger and concise affected FRONTEND_CONTEXT/FEATURES/ROUTES/BACKEND_CONTEXT statements. No new report file.

Validation: npm run typecheck PASS; npm test **812 / 812 passed / 0 failed / 0 skipped / 0 cancelled** (10 added over 802). One old source assertion was updated for the intentionally conditional Edit property / Property and photos label; equivalent behavior is now covered in presentation tests. No previous regression was removed. Protected-file hashes and documentation-link validation are recorded below after final checks. Manual Android checklist lives in the feature document. No new dependency or rebuild required.

Live backend interaction was one READ_ONLY_INSPECTION of ownership helpers, photo policies and property SELECT/UPDATE privileges. The owner/Admin management predicate has no Tier 3 dependency. No pending-verification edit lock was found in this inspected contract. RLS/RPCs/Storage, generated types, coordinate/privacy workflow, completeness formula/80% threshold, publication and lifecycle mutation logic remain unchanged. No permanent live backend mutation was performed in this phase. No commit, push, merge, deployment or EAS build occurred.

Skills actually read: all eight repository-local .codex/skills/rentlease-*/SKILL.md files (feature implementation, MVVM, Supabase contract, security review, test/runtime verification, documentation maintainer, implementation ledger, artifact organizer), plus installed brainstorming, systematic-debugging, test-driven-development, verification-before-completion, Impeccable with product register/context loader, and Supabase guidance. The user's detailed repair scope supplied the design direction; no extra design/report artifact or automatic commit was introduced.

Final workflow-repair verification: protected-file SHA256 comparison PASS, 107 files checked / 0 changed (backend sources, services, generated types, coordinate/privacy, package/config and root composition). Documentation local links/anchors PASS, 78 checked / 0 errors. git diff --check PASS. An additional React-development updater-replay regression failed before the final pure-updater correction and passes afterward; the final suite is 812 passed, zero failed/skipped/cancelled. No MVVM violations found in changed source.


## Floor validation and save reliability (2026-10-31)

Baseline: 812 tests passing with all prior uncommitted frontend, native, package/config, Search/Discovery/Post and documentation work preserved. User-supplied Android diagnostic conclusively identifies create_property_setup SQLSTATE 23514 / properties_floor_numbers, confirmed_failed. Root cause: DraftProperty validated independent numeric values but omitted their cross-field ordering rule. Collection/state/payload mapping were correct, no stale/swapped value defect found; empty floor defaults were already blank.

Added components/PropertyFloorFields.tsx under src/features/property-listing, reused by ComposerPropertyFields and PropertySetup details/Review. Updated models/DraftProperty.ts, models/PropertyCreationError.ts, viewModels/propertyCreationWorkflow.ts, viewModels/usePropertyListingViewModel.ts and views/ListingComposerView.tsx. The pure relationship helper supplies immediate inline errors on both fields, Next/Review/Save guards and service payload validation. Labels and example distinguish unit floor from building height and address unit number. Whitespace-only optional numeric inputs now omit their RPC arguments, preserving NULL defaults; explicit zero floor stays zero.

Read-only catalog inspection also identified numeric storage-range/round-to-zero gaps. Existing numeric(4,1) bathrooms and numeric(10,2) floor area boundaries are checked before sending, without changing accepted payload mappings or introducing a new backend rule. Known backend floor CHECK errors map to safe actionable text. The existing service, authenticated RPC, pending/confirmed journals and duplicate guards are unchanged.

Tests: propertyCreation.test.ts covers less/equal/greater, ground zero, either/both omitted, whitespace omission, immediate independent errors, pre-RPC blocking/no journal, retained values and corrected concurrent retry creating once, exact payload mapping, numeric storage boundaries and safe backend CHECK mapping. propertyWorkspacePresentation.test.ts exercises shared floor labels/errors/callbacks/placeholders. Its prior source assertion now delegates floor-label coverage to the shared component; no coverage was deleted. propertyLocationPrivacy.test.ts only registers the new presentation component in its existing native mock, retaining map/readiness assertions. Regression failures were observed before the fix; subsequent fixture/tuple typing issues were corrected through normal validation.

All changes retain strict MVVM: model owns rules, workflows/ViewModel own guards/state, service consumes the same validated payload, Views bind fields. No new persistence state, dependency, backend change or unrelated workflow change. Android acceptance remains required. See living feature document for manual sequence. All eight repository-local RentLease SKILL.md files previously read in this continuing session remain applied, with systematic debugging/TDD and Impeccable product guidance. No permanent live backend mutation was performed in this phase. No commit, push, merge, deployment or EAS build occurred.

Floor-fix final validation: npm run typecheck PASS; npm test 827 total / 827 passed / 0 failed / 0 skipped / 0 cancelled (15 added over 812). git diff --check PASS; documentation links/anchors 80 checked / 0 errors; protected backend/service/generated/maps/package/root file hashes 107 checked / 0 changed. New floor component and validation remain Android RUNTIME-UNVERIFIED.


## Property-type-aware floors and validation navigation (2026-10-31)

Branch feature/search-discovery-backend-integration, baseline 827 tests plus all previous uncommitted work preserved. Applied the eight repository-local RentLease SKILL.md files read in this continuing session (feature implementation, MVVM, Supabase contract, security, test/runtime, documentation, ledger and artifact organizer), systematic debugging/TDD and Impeccable product/context guidance. The detailed user specification supplies the scoped design direction; no standalone report/design artifact or automatic commit.

House maps only optional total_floors as Number of stories; a remembered floor_number remains local/inactive and is restored on switching back. Apartment/condo use unit wording; room/bedspace/studio use space-specific labels; boarding house/dormitory/other use optional neutral rental wording with an explicit applicability explanation. Enum/property/RPC names stay unchanged. Unit identifiers remain address data. The model's current relationship and numeric storage checks remain authoritative for frontend preflight, and the database remains authoritative for actual acceptance.

Refactored existing property validation into one all-issues metadata source with section and required/invalid kind. Existing single-error APIs and service payload validation delegate to it. Shared summary groups real invalid sections; floor fields show one deduplicated accessible error and invalid input borders. Invalid Save is actionable rather than silently disabled: ViewModel correction intent returns to Property or the appropriate legacy step, with no journal/RPC and no draft clearing. The presentation hook measures/scrolls and focuses an existing input when safe, otherwise announces; delayed callbacks are invalidated. Editing or detaching clears the request. Completeness copy no longer promises validity/saving/publication based on percentage; its formula/server precedence/80% rule are unchanged.

Files created: src/features/property-listing/components/PropertyValidationSummary.tsx; components/usePropertyFormFocus.ts (same feature prefix).

Files modified: AGENTS.md; models/DraftProperty.ts; viewModels/propertyCreationWorkflow.ts; viewModels/usePropertyListingViewModel.ts; components/PropertyFloorFields.tsx; components/ListingControls.tsx; components/ListingWizardScaffold.tsx; components/ComposerPropertyFields.tsx; components/ListingCompletenessSummary.tsx; views/ListingComposerView.tsx; views/ListingDetailsView.tsx; views/PropertySetupView.tsx (feature prefix applies). Tests modified: propertyCreation.test.ts, propertyWorkspacePresentation.test.ts, propertyExitGuard.test.ts, propertyLocationPrivacy.test.ts. Existing feature living doc/history/ledger updated, plus the concise routing pointer. No service, schema, package, map/privacy, photo, publication or lifecycle mutation code changed.

American English is recorded as a future default in AGENTS.md. New/modified labels, examples, errors, accessibility text, tests and this section use stories/story, catalog, behavior and other American terminology. No technical identifier or historical report was renamed, and no unrelated application-wide spelling sweep was performed.

Initial new mapping/metadata regressions failed before implementation. Existing duplicate-error and permanently-disabled Review assertions were intentionally updated to test one section message and a safe clickable correction action, while underlying no-RPC/mandatory-location tests remain. Additional tests execute real ViewModel correction from Composer Save and legacy Review, preserve drafts on type switching and reject stale native measurement callbacks. Native rendering/keyboard/TalkBack is Android RUNTIME-UNVERIFIED; local mocks do not establish it. No new dependency/rebuild required.

No live Supabase interaction or permanent live backend mutation was performed in this phase. No commit, push, merge, deployment or EAS build occurred. Services, RLS and all backend verification/publication/lifecycle rules remain unchanged. No MVVM violations found: model rules, ViewModel intent and UI-only native focus have distinct ownership.

Contextual-floor final verification: npm run typecheck PASS; npm test 845 total / 845 passed / 0 failed / 0 skipped / 0 cancelled (18 added over 827). git diff --check PASS; documentation links/anchors 83 checked / 0 errors; protected file hashes 107 checked / 0 changed. ComposerRecoveryFeedback.tsx also suppresses duplicate current section-validation notices while preserving actual backend errors. Android native scrolling, input focus and accessibility remain RUNTIME-UNVERIFIED.


## Stage 1 - Simplified Property validation and Next readiness (2026-10-31)

Branch feature/search-discovery-backend-integration; baseline 845 tests with all previous uncommitted work preserved. Applied the eight repository RentLease SKILL.md files read in this continuing session and Impeccable product/context guidance, with model-first regression tests and MVVM review. This is Stage 1 validation presentation only, not the later persistent completeness/footer or asynchronous draft-saving stages.

Audit found Next was actually inside the scrolling Property form, despite the request referring to an existing persistent footer. Added a minimal optional action footer to the existing scaffold rather than a new screen/navigation layer. The action still only navigates; the subsequent explicit coordinated Save remains responsible for real property creation/UUID adoption. No premature saved claim or automatic write was introduced.

The large checklist was removed from active Property/Listing Details/legacy Setup/Review presentation. The existing component/history/tests were retained, not deleted. Workflow-owned touchedFields/validationAttempted flags control visible metadata, independent of the complete metadata used for model/service readiness. Required empty fields stay neutral until interaction or explicit review/progression, then clear automatically on correction. Shared floor errors remain single; required choice/address/location areas use restrained borders and plain messages. Next uses zero property validation issues plus loaded/busy/uncertain guards, never completeness. Existing saved workspace UUIDs bypass a new empty creation form while keeping current operation/access safeguards. Footer status provides an accessible Review field action when Next is disabled. No popup/checklist/decorative badge was added.

Files added: src/features/property-listing/components/PropertyProgressFooter.tsx.
Files modified under src/features/property-listing: viewModels/propertyCreationWorkflow.ts; viewModels/usePropertyListingViewModel.ts; components/ListingWizardScaffold.tsx; components/ListingButton.tsx; components/ListingControls.tsx; components/ComposerPropertyFields.tsx; views/ListingComposerView.tsx; views/ListingDetailsView.tsx; views/PropertySetupView.tsx. Tests: propertyExitGuard.test.ts, propertyWorkspacePresentation.test.ts, propertyLocationPrivacy.test.ts (native presentation dependency registration only). Existing living feature/history/ledger and routing pointer updated. No other source changes authored in this stage.

New readiness regressions initially failed before implementation. Native test mocks were extended for the footer, and the prior source assertion about an in-scroll Next label now verifies the footer binding and its actual label. No regression was deleted. Tests cover untouched/touched/corrected states, invalid optional floors, mandatory map confirmation, low-completeness valid continuation, retained fields, disabled/enabled control state, no writes, footer outside the scroll surface and accessible review messaging. Existing identity/stale response/exit/photo/publication/lifecycle tests remain passing.

No Supabase call or live backend mutation occurred. No model validation rule, enum/RPC mapping, service/journal, completeness weight/80% threshold, photo/map/Tier 3 workflow, listing draft persistence or lifecycle mutation was changed. American English remains in effect. No dependency/rebuild, commit/push/merge/deployment/EAS build. Android keyboard positioning, scrolling, disabled semantics, TalkBack and large-text layout remain RUNTIME-UNVERIFIED. See the living feature manual sequence.

No permanent live backend mutation was performed in this phase.

Stage 1 final verification, 2026-11-01 (Asia/Singapore): npm run typecheck PASS; npm test 855 total / 855 passed / 0 failed / 0 skipped / 0 cancelled, 10 added over 845. git diff --check PASS; documentation links/anchors 86 checked / 0 errors; protected file hashes 107 checked / 0 changed. tests/propertyCreation.test.ts also updates its old unused-import assertion to check metadata-driven location feedback; existing required-location/no-RPC tests remain. No new dependency or native build. Android keyboard, scrolling, TalkBack and large-text acceptance remain RUNTIME-UNVERIFIED. Stage 2 completeness-footer redesign and Stage 3 asynchronous saving remain deferred.


## Stage 2 - Persistent completeness footer (2026-11-01)

Branch feature/search-discovery-backend-integration; baseline 855 passing tests, existing uncommitted work preserved. Applied repository-local RentLease implementation/MVVM/contract/security/test/documentation/ledger/artifact skills read in this continuing session plus Impeccable product guidance. Scope is two production presentation files only, with American English copy and no new dependency or native build.

Files changed: src/features/property-listing/components/PropertyProgressFooter.tsx, src/features/property-listing/views/ListingComposerView.tsx, tests/propertyWorkspacePresentation.test.ts, and the existing living feature/history/backend ledger. No source files created. Property's large inline completeness summary and duplicate explanatory paragraph were removed; field hints remain. Footer now has the unchanged percent/source, a thin progress indicator, a dependency-free information glyph/control, optional upward-expanding explanation, blocked-state Stage 1 guidance and the existing validated Next action. Listing Details/Preview and their Save/publication actions remain unchanged.

The information panel uses local React UI state, not another ViewModel/global store. It remains inline in the existing footer, bounded to min(180dp,25% window height) with a scrollable text region. Opening/closing emits an accessible state announcement and never calls a workflow/persistence function. Existing scaffold placement, keyboard/form input refs, root Modal, Back/Stay/Leave and safe-area/bottom navigation were not modified. The primary action stays outside the information scroll area. Native keyboard resizing and TalkBack traversal remain unverified.

New regressions were observed failing before implementation. The existing presentation harness gained isolated state/viewport/announcement mocks so tests can execute both toggle states. Initial copy assertions were narrowed from serialized ViewModel props to the actual panel content; model contribution labels in props are not rendered checklists. Earlier Stage 1 footer fixtures now provide their required completeness data; validation assertions remain intact.

Validation: npm run typecheck PASS; full npm test **862 total / 862 passed / 0 failed / 0 skipped / 0 cancelled**, 7 additional meaningful cases over 855. Coverage includes exact percentage/source, toggling/announcements, frozen form snapshots and zero persistence callbacks, backend-confirmed versus estimate copy, high completeness not enabling invalid Next, hidden readiness text when not needed, missing inline Property summary/retained field hints, small-window panel cap and keyboard/primary-action placement properties. Existing save/publication/lifecycle/navigation tests remain passing. Protected-file and documentation-link results are recorded below after final checks.

No production .ts model/service/ViewModel/workflow changed. No completeness algorithm, threshold, validation, property type/floor data, location/UUID/photo/hydration, Tier 3 or backend contract changed. No live Supabase interaction or permanent live backend mutation was performed in this phase. No commit, push, merge, deployment, dependency install or EAS build. Android RUNTIME-UNVERIFIED; Stage 3 asynchronous draft saving remains DEFERRED. The living feature document contains the manual sequence and limits.

Stage 2 final checks (2026-11-01): typecheck PASS; npm test 862 passed / 0 failed / 0 skipped / 0 cancelled. git diff --check PASS; documentation links/anchors 88 checked / 0 errors. Stage-2-specific SHA256 snapshot: 101 model/service/workflow/backend/map/package/root/scaffold/hint/Listing Details/Preview files checked / 0 changed. The earlier broader protection snapshot also passes 107 checked / 0 changed. All previous uncommitted work remains. No automatic Git publication or native build.

Repository skill files read/applied in this continuing session: .codex/skills/rentlease-feature-implementation/SKILL.md; .codex/skills/rentlease-frontend-mvvm-guard/SKILL.md; .codex/skills/rentlease-supabase-contract-guard/SKILL.md; .codex/skills/rentlease-security-review/SKILL.md; .codex/skills/rentlease-test-runtime-verification/SKILL.md; .codex/skills/rentlease-documentation-maintainer/SKILL.md; .codex/skills/rentlease-implementation-ledger/SKILL.md; .codex/skills/rentlease-implementation-artifact-organizer/SKILL.md. Installed Impeccable SKILL.md and product register/context guidance were also read and applied.


## Stage 3 - Responsive listing draft saving (2026-11-01)

Scope: confirmed draft-save presentation and guarded navigation only. Preserve all pre-existing Search & Discovery, Post chooser, property, media, package/native/configuration and documentation work. No background jobs or additional dependency.

Added `src/features/property-listing/views/ListingDraftSavedView.tsx` and `services/listingDraftDiagnostics.ts`. Modified `models/PropertyListing.ts` (screen), `models/PersistedListingDraft.ts` (optional private Error cause), `services/listingDraftService.ts` (safe diagnostics/error provenance), `viewModels/listingDraftWorkflow.ts` (error source), `viewModels/usePropertyListingViewModel.ts` (snapshot, confirmation and generation guards), `components/ListingWorkspaceFeedback.tsx` (retry/reconcile), `views/ListingDetailsView.tsx` (near-action accessible feedback), `views/PropertyListingFlowView.tsx` (destination). Tests updated: `tests/propertyExitGuard.test.ts`, `tests/listingDraftPersistence.test.ts`, `tests/propertyWorkspacePresentation.test.ts`. Updated the existing living feature document, this history and backend ledger; no separate report.

TDD: new confirmation/navigation tests failed before production changes because successful saves remained in Listing Details. The earlier successful-save dashboard assertion was intentionally updated to the new confirmation destination; local-only dashboard behavior remains unchanged. Delayed-save tests use actual ViewModel/workflow coordination with mocked services. Added checks for duplicate exclusion, frozen fields, Back/exit blocking, disposal, known failure retry, uncertainty read-only reconciliation, confirmation actions and safe diagnostics. Existing account-switch, owner-portfolio reopen, journal, completeness, publication/lifecycle and unsaved-exit coverage is retained.

Views bind ViewModel actions; services own RPC/read/journal access and diagnostics; models remain pure. No View backend access, new client, navigation framework or cross-feature ViewModel import. Original backend errors are private causes; logs use only safe categorical metadata. No live Supabase interaction or permanent live backend mutation occurred. Android RUNTIME-UNVERIFIED; manual sequence is maintained in the living document.

Skills read in this continuing implementation: all eight repository-local RentLease SKILL.md files (feature implementation, frontend MVVM guard, Supabase contract guard, security review, test/runtime verification, documentation maintainer, implementation ledger, artifact organizer), plus applicable Impeccable, systematic-debugging, test-driven-development and verification guidance. No commit, push, merge, deployment or EAS build.

Stage 3 final validation (2026-11-01): npm run typecheck PASS (exit 0); npm test 871 total / 871 passed / 0 failed / 0 skipped / 0 cancelled (9 additional tests over Stage 2 baseline 862); git diff --check and staged whitespace check PASS; documentation links/anchors 90 checked / 0 errors; protected-file comparison 106 checked / 0 changed, excluding explicitly authorized draft-save files. No package/configuration changes in this stage; no dependency/native rebuild required. Existing working tree remains intentionally uncommitted, including unrelated prior work. Android RUNTIME-UNVERIFIED.


## Stage 2 follow-up - Shared Listing Details footer (2026-11-01)

Listing Details now uses the existing PropertyProgressFooter in ListingWizardScaffold's persistent footer slot. The component accepts an optional action and contextual guidance; Property Creation retains its existing Next: Listing behavior unchanged. One implementation owns percentage/progress semantics, accessible information control, local/server explanation and the bounded upward-expanding panel. No second completeness calculation or independently maintained footer was introduced.

The large inline completeness summary is removed from Listing Details. Field-specific hints remain alongside title, rent, description and availability. Save Draft, saving feedback, contextual guidance and existing retry/read-only reconciliation are in the persistent footer; Preview remains in the scrollable form. The scaffold allocates the footer below its flexing ScrollView, rather than overlaying inputs or bottom navigation. Existing keyboard tap behavior and root safe-area/keyboard handling are reused. Expanded information remains capped to a quarter of viewport height or 180 points and scrolls independently for large text.

Action readiness comes from composerSaveDisabled, not completeness or Tier 3. Stage 3's snapshot, synchronous duplicate guard, confirmed-save destination, preserved failure fields, account/workspace guards and uncertainty journal remain unchanged. Expansion is presentation-only state and performs no workflow writes. No model, ViewModel, service, backend, dependency or navigation architecture change.

Android RUNTIME-UNVERIFIED. Check Property -> Listing Details state preservation; footer visibility at both scroll ends; information open/close without field changes; keyboard with the final inputs, bottom tabs, narrow screens, large fonts and TalkBack. Repeat Save Draft -> immediate feedback -> backend-confirmed Listing Draft Saved!, known failure/retry and uncertain Check draft save status. Saving remains distinct from publication.

Shared-footer follow-up validation: typecheck PASS; npm test 873 total / 873 passed / 0 failed / 0 skipped / 0 cancelled (2 new regressions over 871). New tests failed before implementation; two existing presentation fixtures were updated to include the real draft-state contract, without changing their field/hint assertions. git diff --check and staged check PASS; documentation links 90 checked / 0 errors; protected hashes 315 checked / 0 changed (all source except the two authorized UI files, backend files and package/configuration). Files changed this pass: components/PropertyProgressFooter.tsx, views/ListingDetailsView.tsx, tests/propertyWorkspacePresentation.test.ts and the three continuous Property & Listing documents. MVVM review: presentation-only props/local expansion state; no View service calls or workflow changes. Skills applied/read in this continuing session: RentLease feature implementation, MVVM guard, Supabase contract guard, security review, test/runtime verification, documentation maintainer, implementation ledger, artifact organizer, and Impeccable. No dependency/rebuild, live backend action, commit, push, merge, deployment or EAS build. Android RUNTIME-UNVERIFIED.


## Publication discoverability inspection (2026-11-01)

Read-only local source inspection, no live backend access or publication behavior change. A saved draft remains draft after Tier 3 approval by design. Current reachable route is My Listings -> Continue draft -> Listing Details -> Preview listing -> Review publication -> Publish listing confirmation. PropertyDashboardView exposes Continue draft, ListingDetailsView exposes Preview listing, and ListingPreviewView exposes Review publication and the explicit final Publish listing action. The composed ViewModel coordinates requestPublish/confirmPublish, and the existing service calls publish_listing with p_listing_id only.

Verified UI cause: publication is indirect and has no explicitly labeled entry action on the portfolio or Listing Details. This establishes a discoverability defect, not proof of the particular Android record failing backend eligibility. The publicationEligibility model checks saved property/draft identity, unresolved saves and unchanged persisted fields; it does not gate publication on the portfolio's Tier 3 label. The label is based on the selected portfolio item and may be stale until a portfolio reload, but that label alone does not block the RPC. Actual account/property-specific approval, completeness, access or other server denial cannot be determined without the attempt/result. No claim of live eligibility is made.

Proposed minimal solution for a subsequent authorized change: expose Review publication on Listing Details for a saved draft, using the existing requestPublish and confirmation path; explain unchanged-save prerequisites contextually. Preserve explicit landlord confirmation and authoritative backend 80%, property-specific Tier 3, ownership and other checks. No automatic publication. Proposal only; no publication code changed. Existing pull-to-refresh My Listings can refresh the displayed verification status.


## Direct publication review from Listing Details (2026-11-01)

This implements the preceding discoverability proposal. Existing saved drafts now show **Review Publication** directly in Listing Details, alongside Preview, above the unchanged persistent Save Draft footer. The action delegates to requestPublish and the existing publishConfirmation destination; no new screen or RPC is introduced. It is absent before a real draft exists and for non-draft records.

Unsaved listing edits produce the existing save-first error, preserving fields and preventing publication of the older saved payload. Save Draft retains its Stage 3 confirmation/recovery flow; return through the saved preview or My Listings and review again. No automatic save, discard or publication is performed.

A compact derived presentation distinguishes Draft, Ready for publication review and Active. Ready for publication review is explicitly not proof of publication eligibility and is never persisted as a database status. It uses unchanged saved fields and backend-confirmed completeness, not local estimates or account-level Tier 3 labels. A below-80% saved score receives concise add-details/save guidance; every review still warns that property-specific Tier 3 approval and all other checks are verified when publishing. Review remains reachable for incomplete drafts so authoritative rejection can be explained; saving does not acquire new requirements. Existing backend errors for property-specific Tier 3, access, duplicate live listings and other requirements remain actionable. The completeness rejection now explicitly says 80% and directs users to add details and save.

Publication errors are visible on Listing Details through the existing item-scoped feedback component, rather than hidden until Preview. Existing read-only status reconciliation is retained, with no blind retry. A successful publish still requires validated receipt plus owner-scoped authoritative reload; adoption invalidates the portfolio, which refreshes on return to My Listings. Existing active/lifecycle restoration prevents reopening a published row as a replacement draft.

Changed source: models/ListingPublication.ts (pure presentation summary and safe error wording), viewModels/usePropertyListingViewModel.ts (summary/action busy binding), components/ListingWorkspaceFeedback.tsx (visible publication errors), views/ListingDetailsView.tsx (direct action and concise guidance). Tests: listingPublication.test.ts, propertyWorkspacePresentation.test.ts, propertyExitGuard.test.ts. The publication service/workflow, backend contracts and thresholds remain unchanged. Strict MVVM retained: Views bind actions; pure model maps presentation; existing ViewModel/workflow/service own coordination and access. No dependency/native rebuild.

Android RUNTIME-UNVERIFIED. Reopen saved draft -> Review Publication -> explicit confirmation. Test unsaved edits (preserved/save-first), incomplete saved score, missing property-specific Tier 3, approved property with other unmet requirements, valid Publish -> authoritative published status -> My Listings refresh -> reopen Active listing. Repeat rapid confirmation taps, network interruption/status reconciliation, account switching, persistent footer and large-text/narrow-screen layout. No live publish or RLS validation was performed by Codex.

Final publication discoverability validation (2026-11-01): npm run typecheck PASS; npm test 879 total / 879 passed / 0 failed / 0 skipped / 0 cancelled, 5 added over 874. New direct-entry/readiness tests failed before implementation. The actual ViewModel regression covers unsaved edit retention, explicit save, review confirmation without an RPC, resolved blocker cleanup and confirmed Active adoption. Existing rejection/Tier 3/completeness/eligible/uncertain/duplicate/stale/reopen tests remain passing. Whitespace and staged check PASS; documentation links 90 checked / 0 errors; protected source/backend/package hashes 313 checked / 0 changed. Publication service/workflow, persistence, completeness formula, MapTiler, photos and Tier 3 contracts are unchanged. No live backend test or Android acceptance is claimed. Applied all eight RentLease SKILL.md files read in this continuing session (feature implementation, MVVM guard, Supabase contract guard, security review, test/runtime verification, documentation maintainer, implementation ledger, artifact organizer) and Impeccable guidance. No dependency or build, commit, push, merge, deployment or EAS build.


## Publication runtime investigation - existing 100% draft (2026-11-01)

Read-only investigation of listing 69fe5035-51d7-4a06-b42d-4c97959d7b9d (identifier retained to correlate the authorized report). Live row is active with completeness 1.0000, active property, property-specific Tier 3 approval and published_at/updated_at 2026-11-01 04:35:56.636907+00 (12:35:56 PM Philippine time). Codex did not publish it. Edge logs contain POST publish_listing -> HTTP 200 at 04:35:56.609 UTC, owner/property/listing-scoped GET -> 200 before and after it, and owner portfolio reads -> 200 afterward. No response bodies or Android state traces are exposed by those logs; they do not prove the exact native render.

Complete source trace: saved portfolio selection carries the selected listing UUID -> Listing Details Review Publication -> requestPublish validates unchanged confirmed draft and guards -> existing confirmation -> confirmPublish -> generation/identity-guarded workflow -> service.context -> preflight owner/property/ID-scoped read -> pending journal -> publish_listing({p_listing_id:context.listingId}) -> exact one-row receipt validation -> post-RPC read -> isPublishedListing -> workflow adoption -> Published destination and portfolio invalidation -> My Listings reload; existing Active restoration never creates a replacement draft. Generated return contract matches the live TABLE signature. The post-RPC listing read in the log follows receipt validation in source, giving evidence that this request passed receipt parsing. Backend active is intentionally displayed as Published.

Verified conclusion: publication did succeed; no reproducible publication failure/root-cause defect remains established for this attempt. The user subsequently reported that it appears properly published. No speculative fix, parser relaxation, new retry, eligibility bypass, database update or additional diagnostic logging was added. Existing PUBLICATION-DIAG logs failures only; silence after success is expected. The separately supplied SEARCH-DIAG available_locations/network/unknown event is not a publication error and is not diagnosed or changed here.

Added regression in tests/listingPublication.test.ts: 100% persisted score, ISO timestamp with microseconds, correct UUID-scoped authoritative read, Active adoption/Published label and reopen without another RPC. Test harness permits a supplied published score; application source remains byte-for-byte unchanged. Full Android regression acceptance remains scoped separately; live persistence/HTTP evidence is confirmed, while the user's visible-success report is tentative. See the existing backend ledger for exact read scopes and provenance. No permanent live backend mutation was performed in this phase.

Investigation validation: typecheck PASS; full npm test 880 total / 880 passed / 0 failed / 0 skipped / 0 cancelled. One additional 100%-score publication/restore regression. git diff --check PASS; 90 documentation links/anchors valid; all 317 protected application/backend/configuration files unchanged. Only tests/listingPublication.test.ts and the three continuous Property & Listing documents changed. Existing untracked android/ and ninja-error.txt were preserved. Skills read/applied in this continuing investigation: eight repository-local RentLease engineering skills, systematic-debugging, testing/verification guidance and Supabase skill; no UI redesign. No publication or live mutation performed by Codex.


## Tier 3 property-selection and Admin queue investigation (2026-11-01)

Read-only inspection confirms the two draft-linked properties have zero tier_3_property submissions; the published property's latest submission is approved. The landlord picker is not a listing picker: fetchOwnedProperties selects physical properties by authenticated landlord_id and does not join listings, require an active listing or filter on existing verification. All five owned physical properties may appear, even though only three have listing rows. Labels are property type, barangay and city, not listing title.

User-reported missing draft mappings: Black room for students saving -> physical property f8190762-ac43-4dcb-82d4-0774ea697f51; awdawdawdawd -> c1dd3981-23ff-4659-9ff1-c41e38b2b646. These are distinct from listing UUIDs. The first labels as House - Bayan Luma I, Imus; the second as House - awdawdaw, Imus. IDs/labels are recorded only to disambiguate this authorized investigation; no private exact location was queried. Both properties are active and owned by the same eligible Tier 1-verified active Landlord. No source-side filter excluding them was found.

Selection uses property.id; fetchLatest scopes user_id + property_id + tier_3_property. With no submission it opens document type selection. Creating a draft/listing, opening verification, selecting a property or choosing a document does not write a submission. Only explicit Confirm and submit revalidates identity, ownership and existing submission, creates verification_submissions with property_id, uploads the private document, registers metadata and reloads confirmed status. Existing generation/busy/account guards remain.

Admin is intentionally submission-centered: get_admin_verification_queue() requires auth.uid and is_admin, reads verification_submissions joined to profiles and latest document, and returns pending/under_review only. Zero submissions therefore means no Admin queue row; an approved record is historical, not an active review item. Optional Tier 2/Tier 3 frontend filtering does not create or omit nonexistent submissions. Admin ViewModel refreshes on entry/explicit refresh. Landlord Tier 3 reloads owned properties when its workspace is enabled and through its existing refresh/recovery action; a snapshot can become stale while left open, but no stale Android response is established by this evidence.

Verified root cause for Admin absence: no explicit Tier 3 submission exists for either draft's property. Landlord picker absence is not reproduced; the properties should be selectable under physical labels. Minimal current correction is workflow guidance: reopen Verification -> Tier 3 -> Choose property, select the physical property -> document type -> document -> review -> Confirm and submit. Do not auto-create submissions for listing drafts. If the exact physical rows are absent after a fresh entry, obtain runtime picker state/errors before changing filters or authorization. A later scoped UI clarification could explain physical property labels; no behavior/UI fix is made in this investigation.

Application source is unchanged; focused tests cover multiple owned properties without submissions, physical-ID selection versus a listing ID, zero writes on selection, and owner-filtered property queries independent of listings/submissions. All security checks, private Storage, Tier 1, ownership, existing status and Admin review contracts remain. Android picker refresh/selection -> explicit submission -> Admin pending queue acceptance is RUNTIME-UNVERIFIED here; no live submission, upload or review was performed. Evidence is in the existing Property & Listing backend ledger.

Tier 3 investigation verification (2026-11-01): typecheck PASS; npm test 886 total / 886 passed / 0 failed / 0 skipped / 0 cancelled (2 new focused regressions over 884). Existing Admin/Tier 2/Tier 3/private-preview/identity tests remain passing. Whitespace/staged check PASS; 101 documentation links/anchors valid; 317 protected source/backend/package files unchanged. Changed this pass: tests/tierThreeVerification.test.ts, tests/tierThreeVerificationService.test.ts, docs/features/USER_VERIFICATION.md, docs/features/ADMIN_VERIFICATION.md and existing Property & Listing implementation history/backend ledger. All prior unrelated uncommitted work preserved. Read/applied continuing-session RentLease feature implementation, MVVM, Supabase contract, security, test/runtime, documentation, implementation-ledger and artifact-organizer SKILL.md guidance, plus systematic-debugging and Supabase guidance. No application behavior or backend mutation, automatic submission, commit, push, merge, deployment or build.


## Contextual Tier 3 verification from Listing Details (2026-11-01)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Listing Details and the existing publication confirmation now include a compact property-specific verification action. The read-only propertyVerificationEntryWorkflow uses the existing Tier 3 service to revalidate authenticated active Tier 1 Landlord eligibility, physical ownership and latest submission for the exact workspace property UUID. It does not infer approval from account badges or a cached portfolio label. Fresh status is loaded on relevant screen entry, checked again before opening, and refreshed on return.

No submission -> Verify This Property. Pending/under_review -> View Verification Status. Rejected -> View Verification Feedback, opening the existing rejection reason/status UI with its current restrictions. This does not implement Tier 3 resubmission: existing submissions remain protected and no new request is offered automatically. Cancelled/revoked use existing status behavior. Approved -> a small ownership-verified message and no redundant verification button. Draft saving remains independent of Tier 3; Review Publication still uses explicit confirmation and all existing backend requirements.

App.tsx remains the root feature-composition boundary. It supplies a renderer for the existing UserVerificationFlowView to PropertyListingFlowView; the latter uses a contextual native Modal while retaining its original mounted editor, draft, listing/property UUIDs, screen and history. No feature imports another feature's View/ViewModel. The property feature reuses the existing verification service through its own dependency composition; no duplicate backend client, query contract or verification form is introduced. UI binds read-only workflow state and actions. Opening verification is not a workspace exit and does not discard local changes or prompt to abandon the listing. Underlying mutation/navigation callbacks are guarded while the contextual modal is open.

The existing Tier 3 hook/workflow accepts optional initialPropertyId. It loads owned physical properties, validates membership, then delegates to existing selectProperty and its fresh ownership/submission checks. A valid property with no request opens document selection; an existing request opens status. Unowned, missing, listing-ID or failed validation falls back safely to the owned-property picker with an explanation; failed reads require refresh. Neither preselection nor opening creates a submission or uploads a document. Ordinary Profile-origin verification still starts with its normal overview/picker.

Android Back is delegated to the mounted verification flow, preserving its nested steps, preview handlers and submission guards. Close returns to the retained listing context and refreshes only its property verification state. Account/role changes unmount the account-scoped parent workspace; generation and identity guards reject stale reads. Workspace selection synchronously invalidates old entry state. Closing after approval never publishes automatically; server completeness, 80% threshold, ownership and property-specific Tier 3 remain authoritative at publish time.

Android acceptance: open a saved draft with unsaved rental edits -> Verify This Property -> correct physical property preselected -> Close/Back -> same edits/UUID/screen retained. Repeat from Review Publication; choose another owned property only through the existing picker. Test pending/under-review status, rejected feedback, approved label, foreign/deleted property fallback, offline/read Retry, rapid taps, account/role changes and private preview Back. Submit a document only with explicit confirmation; Admin approval followed by return/reentry should refresh the original property's label. Save Draft must remain possible without Tier 3, and publication must still require an explicit Review/Publish action. Native modal nesting, keyboard, safe areas, large text and TalkBack are RUNTIME-UNVERIFIED. No new dependency or native rebuild.


### Contextual Tier 3 implementation files and final evidence

Added:
- src/features/property-listing/components/PropertyVerificationAction.tsx
- src/features/property-listing/services/propertyVerificationDependencies.ts
- src/features/property-listing/viewModels/propertyVerificationEntryWorkflow.ts
- tests/propertyVerificationEntry.test.ts

Modified application files:
- App.tsx
- src/features/property-listing/viewModels/usePropertyListingViewModel.ts
- src/features/property-listing/views/PropertyListingFlowView.tsx
- src/features/property-listing/views/ListingDetailsView.tsx
- src/features/property-listing/views/ListingPreviewView.tsx
- src/features/user-verification/viewModels/tierThreeVerificationWorkflow.ts
- src/features/user-verification/viewModels/useTierThreeVerificationViewModel.ts
- src/features/user-verification/views/UserVerificationFlowView.tsx

Modified tests: tests/tierThreeVerification.test.ts, tests/propertyExitGuard.test.ts, tests/propertyWorkspacePresentation.test.ts, tests/marketplaceWiring.test.ts. The composition allowlist adds only the new feature-local dependency, retaining View/backend and cross-feature ViewModel isolation. Presentation mocks include the new component; existing assertions are preserved. Additional files modified this pass: docs/features/PROPERTY_LISTING_MANAGEMENT.md, docs/features/USER_VERIFICATION.md, docs/ROUTES.md, this continuous implementation history and the continuous backend ledger. Prior Admin/Search/Property investigation and independent native/ninja files remain preserved.

TDD evidence: contextual tests initially failed because the entry workflow and optional preselection did not exist. Final npm run typecheck PASS; npm test **908 total / 908 passed / 0 failed / 0 skipped / 0 cancelled**, 22 added over baseline 886. Coverage includes all requested status actions, physical UUID validation/fallback and failed lookup, no automatic writes, fresh return status, stale property/disposal/account responses, mismatched backend property response, actual ViewModel draft/UUID preservation, nested Modal physical-ID handoff and Android Back delegation. Existing Save Draft without Tier 3, success/recovery, explicit publication, account/role/navigation, private preview and Admin regressions remain passing.

Whitespace/staged checks PASS; documentation links/anchors **102 checked / 0 errors**; **309 protected source/backend/configuration files unchanged** (the eight explicitly modified existing application files are excluded from this snapshot; new files reviewed separately). MVVM/security review: no feature View/ViewModel cross-import, no View backend access, no new client/global manager/navigation framework or frontend authorization bypass. Fresh service ownership checks remain authoritative alongside backend RLS. No new dependency, native rebuild, live backend query/submission/upload/review, migration, grant, Storage change, commit, push, merge, deployment or EAS build. Android RUNTIME-UNVERIFIED.

Skills read/applied in this continuing implementation: all eight repository-local RentLease SKILL.md files (feature implementation, frontend MVVM guard, Supabase contract guard, security review, test/runtime verification, documentation maintainer, implementation ledger, artifact organizer), plus applicable brainstorming/design context, Impeccable/product reference and TDD/verification guidance. The user supplied the detailed approved scope; no separate speculative design/report or automatic commit was created.


## My Listings - Direct Tier 3 access (2026-11-01)

This extends the contextual integration in the same implementation. Every property-centered card reuses its existing batched property-specific tier3 state: no submission -> Verify This Property; pending/under_review -> View Verification Status; rejected -> View Verification Feedback with existing restrictions; approved -> Property Verified. The shared pure PropertyVerificationPresentation model supplies labels to both card and existing contextual workflow, avoiding another status implementation. No Tier 3 resubmission policy is added; cancelled/revoked continue to existing status.

The ordinary Continue draft/Create listing/Manage listing/View status action remains. A second restrained outlined action opens the existing verification Modal directly over My Listings, passing the physical property UUID without selecting a listing workspace or entering the editor. The same service-based identity/ownership/latest-submission validation and Tier 3 preselection are reused. The portfolio query already batches verification_submissions for the owner; rendering cards adds no per-property request. Only the clicked property is revalidated. Return refreshes that status and performs one existing portfolio batch reload, preserving search/filter state and card lifecycle controls. If fresh validation discovers approval behind a stale Verify card, the batch refreshes without showing a redundant verification Modal or publishing anything.

Approved active-property drafts with saved completeness >=80% also show Review Publication. This is review-entry guidance only, not proof of backend eligibility. Selecting it uses the existing guarded item switch (including unsaved Stay/Leave when applicable), loads the exact selected draft under owner/property/listing scope, then invokes existing requestPublish/confirmation. No RPC runs from the card tap. A changed non-draft backend row opens its real lifecycle status rather than becoming a replacement draft. Backend publication still independently checks all requirements; no automatic save, verification submission or publication is introduced.

Changes: added src/features/property-listing/models/PropertyVerificationPresentation.ts; modified views/PropertyDashboardView.tsx, viewModels/propertyVerificationEntryWorkflow.ts and viewModels/usePropertyListingViewModel.ts. Tests extended: tests/propertyVerificationEntry.test.ts, tests/propertyWorkspacePresentation.test.ts, tests/propertyExitGuard.test.ts. Root composition, Tier 3 screens/services/workflow, private Storage, Save Draft/footer, search, creation/photos, publication service/workflow and lifecycle contracts remain unchanged. No new dependency or native rebuild. Views bind pure presentation and ViewModel actions; services retain all backend access.

Android RUNTIME-UNVERIFIED. My Listings -> Verify This Property -> correct physical property preselected -> Back/Close returns to dashboard with refreshed status and retained query. Repeat pending/review/rejection/approval, stale card approval, denied ownership, account switch and rapid taps. An approved eligible draft -> Review Publication must load its exact saved content -> explicit Publish listing; no card action publishes automatically. Continue draft and active/paused lifecycle controls must remain available, with expected Stay/Leave for unsaved item switches. Check large text and narrow-card button layouts.


### My Listings contextual verification final evidence

2026-11-01: npm run typecheck PASS; npm test **918 total / 918 passed / 0 failed / 0 skipped / 0 cancelled**, 10 additional tests over 908. New card-state/entry tests failed before implementation. Dashboard integration tests explicitly use the real dashboard entry (the reused navigation harness otherwise enters the posting chooser); this fixture correction preserves existing assertions. Coverage includes five card states, physical UUID handoff without editor navigation, refreshed batch data and preserved query on return, freshly approved stale-card handling, server-score review hints, exact draft hydration before confirmation, and no automatic save/publication. Existing continuation/lifecycle, unsaved navigation, Tier 3 preselection/ownership, status/rejection and account/stale tests remain passing.

Files added: src/features/property-listing/models/PropertyVerificationPresentation.ts. Source modified: src/features/property-listing/views/PropertyDashboardView.tsx; src/features/property-listing/viewModels/propertyVerificationEntryWorkflow.ts; src/features/property-listing/viewModels/usePropertyListingViewModel.ts. Tests modified: tests/propertyVerificationEntry.test.ts; tests/propertyWorkspacePresentation.test.ts; tests/propertyExitGuard.test.ts. Documentation: PROPERTY_LISTING_MANAGEMENT.md, USER_VERIFICATION.md, ROUTES.md, this history and existing backend ledger.

Whitespace/staged check PASS; **102 documentation links/anchors valid**; **317 protected source/backend/configuration files unchanged**, excluding the three scoped existing application files; new model reviewed as pure presentation with no hooks/backend calls. Root App, Tier 3 service/screens/submission workflow, batched portfolio service, property creation/photos, publication/lifecycle mutations, package files and backend policies remain unchanged. No per-card network request added. Existing uncommitted work, android/ and ninja-error.txt are preserved. Applied the same repository-local RentLease feature/MVVM/contract/security/testing/documentation/ledger/artifact skills and Impeccable guidance read in this continuing implementation. Android RUNTIME-UNVERIFIED. No native rebuild/dependency, live backend action, commit, push, merge, deployment or EAS build.


## Listing and property editing capability audit (2026-11-01)

**AUDITED - recommendations only; no editing implementation or backend change.** Current branch feature/search-discovery-backend-integration; all pre-existing uncommitted work preserved. Evidence is the current frontend and live read-only catalog/grants/policies/functions, recorded in the continuous backend ledger. Live denied/allowed mutation tests were not performed.

### Field-by-field current editability

D = current saved draft UI + persisted save_listing_draft update. R = read-only/not connected after physical property creation. P = existing photo persistence contract, with published-route limitation below. Account/profile fields are not listing content.

| Field | Actual data owner | Saved draft today | Published listing today | Persistence boundary |
| --- | --- | --- | --- | --- |
| Title | listings.title | D | Read-only | Draft RPC; no active-content update RPC |
| Description | listings.description | D | Read-only | Same; 30 characters is weighted completeness, independent of nonblank save validation |
| Monthly asking rent | listings.asking_rent_monthly | D | Read-only | Positive numeric draft RPC field |
| Available from | listings.available_from | D; select/change/clear | Read-only | Date-only ISO or null; future dates permitted |
| House rules | listings.house_rules | D | Read-only | Optional text, not an invented enum array backend field |
| Rental term | listings.rental_term | D | Read-only | short_term/long_term/either |
| Security deposit months | listings.security_deposit_months | D | Read-only | Nonnegative numeric |
| Advance rent months | listings.advance_rent_months | D | Read-only | Nonnegative numeric |
| Minimum stay months | listings.minimum_stay_months | D | Read-only | Optional positive smallint |
| Property type | properties.property_type | R | R | Existing create_property_setup only; enum/display mappings separate |
| City | properties.city | R | R | Existing creation only |
| Barangay | properties.barangay | R | R | Existing creation only |
| Bedrooms | properties.bedrooms | R | R | Existing creation only; not a listing draft field |
| Bathrooms | properties.bathrooms | R | R | Existing creation only |
| Floor area | properties.floor_area_sqm | R | R | Existing creation only; contributes 10% to all related listing scores |
| Unit floor | properties.floor_number | R | R | Creation uses type-aware null/optional semantics |
| Building stories/floors | properties.total_floors | R | R | If both floor values exist, floor_number <= total_floors |
| Furnishing | properties.furnishing_status | R | R | Existing creation only |
| Maximum occupants | properties.max_occupants | R | R | Property field, not listing field; contributes 5% |
| Address line 1 | property_private_locations.address_line_1 | R | R | Owner-private editor hydration/update path absent |
| Address line 2 / unit identifier | property_private_locations.address_line_2 | R | R | No new unit-number column; changing unit may change property identity |
| Postal code | property_private_locations.postal_code | R | R | No update contract |
| Access instructions | property_private_locations.access_instructions | R | R | No update contract; must stay private |
| Exact location | property_private_locations.exact_location | R | R | No update contract; retain approved confirmation/privacy separation |
| Public location | properties.public_location | R | R | No update contract; never substitute the exact location |
| Controlled amenities | property_amenities associations | R; selected IDs loaded | R | Catalogue/associations SELECT only; creation accepts actual IDs |
| Ordinary photos add/remove | property_photos + property-media | P through photo/composer manager | No reachable normal published-photo manager | Backend owner/Admin photo operations exist independent of listing status |
| Cover photo | property_photos.is_cover | P via set_property_cover_photo | Same route gap | Atomic existing cover RPC; retain it |
| Photo order | property_photos.sort_order | P | Same route gap | Existing sequential column-scoped UPDATE; reconcile partial results |
| Photo alt text | property_photos.alt_text | P | Same route gap | Existing column-scoped UPDATE |
| Photo object/path identity | property_photos.storage_path / Storage object | No arbitrary mutation | No arbitrary mutation | Replace through existing remove/add process, not path UPDATE |
| 360 media | Separate deferred feature | Not implemented | Not implemented | Outside this edit capability scope |
| Property/listing UUID, owner, relationships | Backend-owned IDs/landlord_id/property_id | Not editable | Not editable | Never use create_property_setup as an edit fallback |
| Status/completeness/publication/lifecycle timestamps | Backend-owned listing state | Not ordinary editable fields | Only existing lifecycle RPCs | No frontend simulated status/completeness changes |
| Safety rating and verification approvals | Trusted domain/backend state | Not exposed as landlord edit fields | Not landlord-editable | Not included in creation/draft payload contracts |

### What the existing draft RPC really does

save_listing_draft receives p_property_id plus nine supported listing fields. It does NOT receive p_listing_id or an expected version. It checks auth, active Tier 1, Landlord role and owned active property; takes a property advisory transaction lock; selects the newest owned draft by created_at DESC FOR UPDATE; if found, updates WHERE id=v_listing.id AND status=draft; otherwise inserts a draft. Therefore it is neither create-only nor an arbitrary UUID update API. Normal repeated saves reuse the same existing draft, and the frontend retains the returned UUID.

Frontend reads can target the exact selected listing ID; saves cannot bind that selected ID in the current RPC signature. The local journal, synchronous operation guards, identity generations and authoritative reload prevent accidental repeated local writes and fake success. They do not supply server-side optimistic concurrency. There is no live unique draft-per-property index: only the primary key and ordinary search/owner/property indexes were found. Function-level locking serializes cooperating calls, but old/multiple drafts or a publish-versus-save race can select a different/new draft. Specifically, a publish that wins the same property lock can make a queued save see no draft and enter INSERT. This is a contract limitation, not a claim that duplicate records were observed in this audit. Do not advertise unconditional no-duplicate/exact-target guarantees without hardening the contract.

Current hydration/navigation: My Listings Continue draft selects an exact property/listing pair, restores lifecycle/publication state, loads that owned draft, applies supported fields without overwriting physical data, and permits Listing Details edits only when authoritative status remains draft and access/recovery guards pass. Save success requires a valid receipt and owner-scoped reload, then Stage 3 confirmation. Media/property UUIDs remain separate. finishEdit/local management labels are preview-only, not backend edit capability.

### Published and physical backend limitations

Effective authenticated grants for listings, properties, property_private_locations and property_amenities are SELECT-only: INSERT/UPDATE/DELETE and any-column UPDATE are false. Existing owner/Admin UPDATE/ALL RLS policies do not override these table privileges. No ordinary listing-content/property/amenity update RPC was found in the live public function inventory. create_property_setup creates a new physical UUID; publish_listing changes status only; pause_listing/reactivate_listing/archive_listing change lifecycle only. None is a content update substitute. Generated Update types do not imply permission.

The ViewModel intentionally allows listing writes only for confirmed drafts and exposes non-draft content as read-only. PublishedListingStatusView offers status/lifecycle actions, not a content editor or ordinary photo manager. Thus published availability/rent/description cannot be fixed by merely enabling a field; they require a controlled backend contract first. Pausing does not turn a listing into a draft or make save_listing_draft update it.

Photos already have authorized SELECT/INSERT/DELETE metadata operations, UPDATE only on alt_text/sort_order/is_cover, namespace-controlled Storage and set_property_cover_photo. They are property-scoped and shared by related listings. A reachable published-photo route can reuse these operations, subject to existing active-completeness enforcement. Photo deletion confirms metadata removal before Storage cleanup; an active-completeness rejection leaves the metadata/object intact, whereas later Storage failures retain reconciliation state. No speculative orphan deletion or photo-path mutation should be added.

### Completeness, Tier 3 and physical identity

validate_listing_owner recomputes completeness and rejects active rows below 80%, preserving existing published_at via coalesce. Related-property triggers lock parent IDs and recompute all related listings when floor area, max occupants, photos, amenities or private-location existence changes. An invalid active score aborts the entire database mutation rather than silently pausing or erasing a listing. Ordinary edits must keep nonblank required content/numerical checks as well as the weighted threshold; weighted score alone is not field validation.

Tier 3 currently binds approval to property_id, not a property revision. No property-edit re-verification mechanism/trigger was found. It is unsafe to enable unrestricted property/address/type/coordinate changes while retaining approval as proof of the same physical property. Policy must distinguish ordinary maintenance from changes to identity before implementation. Access instructions/furnishing/amenity changes are candidates for ordinary updates, but this audit does not authorize such a policy. Property type, precise location, address/unit identity, ownership and material layout changes need an explicit backend-owned decision about re-verification. Preserve historical submissions; do not auto-reject/delete/approve them or turn account-level Tier 3 into property approval. Property edits can affect multiple listings, not only the card being edited.

### Availability dates: verified finding

No date comparison in save_listing_draft, publish_listing, the listing CHECK constraints or validate_listing_owner prohibits a future available_from. The completeness function gives 5% for any non-null valid date, without comparing it with today. The native picker has no minimumDate/maximumDate and constructs local year-month-day ISO values; the model validates a real calendar date, not today/future policy. Therefore future availability is allowed for draft save and publication.

Live corroboration: listing 69fe5035-51d7-4a06-b42d-4c97959d7b9d is active with available_from=2026-11-06 and published_at=2026-11-01 04:35:56.636907+00. Publication date and move-in date are distinct.

Manual search, Available Locations and detail lookup share available_from IS NULL OR <= today's Asia/Manila date; live search_nearby_listings has the same predicate. This hides a published future-availability rental until its availability date. It is a discovery visibility policy, not a publication rejection. If the product should advertise future rentals, explicitly approve a separate policy pass covering all four query surfaces, filters and pagination. Do not remove only one predicate or change the availability value to make a record appear. No such change is made in this audit.

### Recommended staged implementation path (all stages proposed, not authorized migrations)

1. **Existing draft editing acceptance and contract hardening.** Preserve the working Continue draft -> Listing Details -> Save Draft -> same-ID reopen route; retest title/rent/description/date/terms clearing and photo preservation before visual changes. For strict exact-target/no-replacement/conflict guarantees, approve an update-only draft RPC with listing UUID and expected updated_at/version, separate from intentional draft creation. Backend should revalidate owner/property/status under the same advisory/row locks and reject a raced publication/deleted draft rather than insert another. An appropriate uniqueness backstop requires backend review/legacy data audit; do not add one blindly. Proposed RPC names are illustrative, not existing contracts: update_listing_draft(p_listing_id,p_expected_updated_at,...). Files: PersistedListingDraft.ts, listingDraftService.ts, listingDraftWorkflow.ts, usePropertyListingViewModel.ts, ListingDetailsView.tsx, selected-listing hydration. Tests: listingDraftPersistence.test.ts and propertyExitGuard.test.ts for exact ID, no insert after publish race, optimistic conflicts, stale account, uncertain reconciliation, clearing/reopen and no auto publication. Approved backend integration tests must cover actual locking/uniqueness; mocks alone are insufficient.

2. **Published listing content updates.** Obtain a narrow owner-authorized update RPC (illustrative update_listing_content) taking listing ID/version and an allowlist of the nine listing fields, never owner/property/status/completeness/timestamps from the client. Lock/revalidate auth, active Tier 1/Landlord/owned active property and property-specific Tier 3; check expected version, permitted listing/tenancy state and all field constraints; compute final completeness with existing logic. Preserve active and published_at on success, rollback invalid updates, return/reload authoritative row; no automatic pause or status reset. Explicitly decide paused/rented/removed edit policy instead of reusing the draft RPC. Files: new ListingContentUpdate model/service/dependencies/workflow (proposed), existing ListingDetailsView or a parameterized editor, PublishedListingStatusView, PropertyDashboardView and composed VM; generated database types only via established regeneration after approved backend change. Tests: new content-update tests plus listingPublication/listingLifecycle/propertyExitGuard, with active preservation, required fields, 80%, Tier 3 denial, tenancy restrictions, version conflict, double-tap, stale identity and uncertain outcomes. New backend contract is a prerequisite, not permission to add direct UPDATE grants.

3. **Reachable published ordinary-media management.** Reuse propertyPhotoService/propertyPhotoWorkflow and PropertyPhotosView; expose a scoped action from real published management without unlocking unsupported property/listing fields. Preserve max ten, MIME/size, cover RPC, order/alt/deletion journals and owner namespace. Files: PublishedListingStatusView, usePropertyListingViewModel, property photo presentation/workflow only if needed. Tests: propertyPhotos.test.ts, propertyPhotoQueue.test.ts, propertyExitGuard.test.ts, listingCompleteness.test.ts plus approved live tests that deleting the last completeness-required photo rolls back safely. No new media RPC is currently required for these ordinary operations; 360 remains excluded.

4. **Persisted physical-property ordinary updates.** First agree an allowlist and verification-impact policy. Then approve transactional property-update RPC(s) with property ID/version, private owner-only hydration, controlled actual amenity IDs, related-listing completeness checks and clear patch/null semantics. Ordinary candidates include furnishing, amenities and access instructions; bedrooms/bathrooms/floors/floor area/max occupants need explicit classification rather than assuming they cannot change identity. Keep private location out of public portfolio/discovery results. Files: DraftProperty domain validation reuse, proposed PropertyUpdate model/service/workflow, propertyCreationWorkflow only for shared validation (not another create), ComposerPropertyFields/PropertyAmenitiesFields, owned detail hydration. Tests: creation/floor regressions, amenity catalogue IDs, private data boundaries, multi-listing rollback, stale version/account and safe retry. Backend contract/authorization approval is required; no direct-table write bypass.

5. **Identity-sensitive property corrections and re-verification.** Separately design backend property revision/approval binding or another approved re-verification mechanism, including effects on already-active listings, account authorization, history and changed ownership/address/unit/type/exact/public location. No automatic destructive status changes or policy invented in frontend. Reuse the approved MapTiler confirmation/public-location privacy rule, not new coordinate derivation. Files: property update contract, existing location workflow/models, contextual verification presentation and user-verification service/workflow only as approved; database types regenerated after contract approval. Tests: old approval cannot authorize a repurposed property, correct physical UUID/revision, private/public separation, explicit re-verification and no auto publish, history retention, account/stale/Back behavior. This is blocked on policy/backend design, not a frontend-only toggle.

Optional separate visibility policy: decide whether future rentals should be searchable. If approved, update manualSearchService base filter and corresponding live search_nearby_listings contract consistently; test manual/location/detail/GPS parity, explicit desired move-in filters, date boundaries, RLS and pagination. This does not require changing publication dates or treating future dates as invalid.

### Audit boundaries and evidence

No application/test code, migration, authorization, verified publication, completeness formula or live data was modified. No live save/update/publish/Storage operation was run. Existing automated tests establish current supported behavior, not future update capability. Android acceptance and future backend race/authorization tests remain required. No permanent live backend mutation was performed in this phase. No commit/push/merge/deploy/build.

Editing audit validation (2026-11-01): npm run typecheck PASS; npm test 918 total / 918 passed / 0 failed / 0 skipped / 0 cancelled. Existing baseline rerun, no new tests/behavior added for recommendations. git diff --check and staged check PASS; 93 local documentation links/anchors valid across checked documents; 370 source/test/backend/configuration hashes unchanged. Only the existing Property & Listing living doc, implementation history and backend ledger were modified in this audit. Applied the continuing-session RentLease feature/MVVM/contract/security/test/documentation/ledger/artifact SKILL.md guidance and Supabase/systematic-debugging verification guidance. All prior uncommitted work preserved; no migration, authorization change, live mutation, commit, push, merge, deployment or build.


## Stage 1 - Exact-target saved draft editing (2026-11-01)

**IMPLEMENTED / AUTOMATED-TESTED locally / Android RUNTIME-UNVERIFIED. Migration DEPLOYED / CATALOG-VERIFIED under history 20261101130456.** This implements only saved-draft editing from the earlier audit. Published-content editing, physical-property editing, Tier 3, search, completeness weights and lifecycle behavior remain unchanged. Do not Android-test this frontend against the old live schema as though deployment has occurred.

### Deployed backend contract

Current migration: supabase/migrations/20261101130456_update_listing_draft_exact_version.sql. Adds listings.edit_version UUID with a random default and a server-controlled rotation trigger. Live set_updated_at uses now(), which is transaction-scoped; local tests demonstrate two successful writes can have the same updated_at while edit_version changes. No client timestamp conversion, monotonic number/BigInt or clock assumption is used.

Token rotation is scoped to listing content, relationship/owner, status and explicit token writes. Pure derived completeness refreshes do not rotate it, so the editor's own photo uploads do not cause a false content conflict. Content/status writes rotate even when the same values are explicitly written. Publication/status changes therefore invalidate a draft editor's old token. Existing active rows receive a token on schema addition without changing their status or publication timestamps.

update_listing_draft(p_listing_id UUID, p_expected_edit_version UUID, p_title TEXT, p_description TEXT, p_asking_rent_monthly NUMERIC, optional p_house_rules, p_rental_term, p_security_deposit_months, p_advance_rent_months, p_minimum_stay_months, p_available_from) returns the same draft receipt fields plus edit_version. It accepts no client owner, property ID, status, completeness or lifecycle fields. No INSERT branch exists.

The controlled SECURITY DEFINER RPC follows existing trusted-backend practice, with restricted pg_catalog search path, PUBLIC/anon EXECUTE revoked and authenticated EXECUTE only. It explicitly checks auth, active Tier 1 and Landlord role, exact owned listing, owned active physical property, then takes the same property advisory key used by creation/publication/completeness. Authorization is rechecked after lock wait. Property/share and listing/row locks plus a final WHERE id/owner/property/status/version compare protect the update. Missing/non-owned targets deny; a stale token or changed draft status rejects with SQLSTATE 40001. Version checks run under READ COMMITTED, with unsupported isolation rejected. Field validation and existing completeness triggers remain authoritative. No direct table write privilege or RLS policy changes are introduced.

The existing save_listing_draft definition is NOT replaced. It remains the first-draft creation/upsert contract. New frontend existing-draft writes never use it, including after conflict, publication, missing target or missing update RPC. Exact-target no-insert/CAS guarantees apply to the new update operation; this stage does not claim that legacy clients invoking the unversioned old upsert cannot overwrite content or create a later draft. Retiring that legacy update behavior would require a separately approved compatibility decision.

### Frontend integration and recovery

Listing Details stays the same editor/footer and Stage 3 confirmation destination. Saved rows hydrate the backend token; an existing confirmed draft supplies exact listing ID + loaded token to update_listing_draft. A first draft with no confirmed row still uses save_listing_draft. Supporting copy distinguishes existing-draft updates from first save. Owner/property-scoped post-save reads now target the receipt listing ID exactly; an update receipt must match target ID and valid token, and reload must match the receipt's version. A concurrent change between receipt and reload remains unresolved rather than being presented as this payload's success.

Known version conflicts keep entered fields, clear the proven-failed attempt marker, disable further saves and expose Load latest saved version. This is an explicit authoritative read, not another mutation. The existing ViewModel merge preserves locally edited fields while loading fresh unedited fields and the new baseline/token. A later explicit Save may update that version. If the target is now active, its authoritative status is adopted and draft saving stays blocked; local fields remain retained rather than being silently erased. Publication review is blocked until the saved-draft conflict is reconciled.

Unknown RPC/result/reload outcomes retain the durable per-account/property journal, now including the exact target listing ID and update/create kind (no body, credentials or private data). Reconciliation reads the exact target, including a changed lifecycle status, and never replays either RPC. A marker for another selected draft cannot hydrate or replace the current listing. Legacy pending markers remain readable conservatively. Generation/identity/duplicate guards remain. No reliable process-termination payload saving is promised.

Missing token/contract or PGRST202 is a safe deployment failure for editing, never fallback to creation. Draft-editor version-column reads use the deployed migration; read-only portfolio loading remains independent of that edit-only column (see the compatibility correction below). Preserve journals across deployment; do not clear pending markers to bypass recovery. A schema-cache refresh may be needed through the approved deployment workflow if the new RPC is not yet exposed.

### Types, local tests and deployment boundary

Supabase CLI types were generated from the migrated disposable PostgreSQL database using --db-url on loopback port 55439, schema public. Only the exact generated update_listing_draft function and edit_version Row/Insert/Update additions were merged into canonical database.types.ts; unrelated live contracts were preserved. This is a locally generated proposed contract, not a claim that live type regeneration sees an applied RPC. Existing typed listing fixtures were updated for the new row field; no existing assertions were removed. A fixture-edit mistake adding edit_version to a lifecycle query-filter expectation was corrected to retain the original owner/property/ID assertion; lifecycle source remains unchanged.

Local tests use supabase/test-support/draft_edit_schema.sql plus the existing completeness fixture/migration, then the new migration. The local schema includes recorded baseline create/publication RPC definitions and synthetic Auth/Tier 1/role helpers; it is NOT a full production dump or proof of live RLS acceptance. No service-role token or remote DB URL is used. See supabase/test-support/DRAFT_EDIT_TESTING.md for reproduction.

Final evidence: npm run typecheck PASS; npm test **928 total / 928 passed / 0 failed / 0 skipped / 0 cancelled**, 10 new frontend regressions over 918. Real PostgreSQL runner **27 passed / 0 failed**, including same-transaction timestamp/token behavior, exact older target with multiple drafts, stale/missing/nonowner/Tier 1/role/inactive denials, no direct UPDATE/anon execute, field validation, future/cleared availability, no Tier 3 prerequisite, repeated save, simultaneous editors, both save-versus-publish lock orders, one retained listing and unchanged property/photos. Existing completeness pgTAP **74 assertions passed / 0 failed** with this migration present, using psql/TAP output validation because pg_prove was absent. plpgsql_check_function_tb reported zero error rows for the new RPC. Earlier fixture/database attempts and partial test runs are not counted as passes.

Historical pre-deployment prerequisite (subsequently completed): obtain explicit user approval for ONLY the new migration and apply through the approved Supabase workflow before Android acceptance; never replay old migrations or use an unrestricted db push. No live application/approval action occurred in this task. Existing published records must keep statuses/timestamps. After approval, regenerate/recheck live types and test exact-ID updates, stale edits from a second session, publication races, offline uncertainty/restart reconciliation, optional clearing, My Listings reopen, photo preservation and account/Back/Stay/Leave behavior. No new dependency or native rebuild is required by this stage.


Final Stage 1 validation and cleanup (2026-11-01): typecheck PASS; full frontend suite 928 passed / 0 failed / 0 skipped / 0 cancelled. The post-RPC unreadable-reload test explicitly waits for RPC issuance before injecting the read failure; preflight remains successful. Local backend 27/27 and completeness pgTAP 74/74 remain passing. Verified task-owned container rentlease-draft-edit-test-20261101 (ID prefix 7b874a5fab51, expected PostgreSQL image, AutoRemove enabled) stopped successfully; its ephemeral local databases were discarded. No live database mutation or deployment occurred.


## My Listings schema dependency regression correction (2026-11-01)

Source trace: My Listings dashboard/empty effect -> portfolio.load -> authenticated owner snapshot -> landlordPortfolioService.load -> parallel paginated properties/listings/verification_submissions SELECTs -> owner validation -> chunked cover reads -> assemblePortfolio -> workflow hydration. New explicit listings.edit_version selection failed against the undeployed schema; the update RPC is not called during this path. Compared HEAD's last working projection to the uncommitted Stage 1 diff: edit_version was its sole new selected column. User confirms live records remain two active listings and one draft; no independent live data inspection or mutation was performed in this correction.

Minimal compatibility fix restores the existing narrow portfolio projection, types PortfolioListing as a projection omitting the edit-only token, and lets read snapshots model absent edit_version without changing generated types. The draft workflow explicitly rejects missing tokens before service.save, preserving exact-target/version/journal guards and no create fallback. Existing editor's version read stays deployment-gated. No migration, mutation service, RPC contract, dependency, Auth/bootstrap, Tier 3, search, photo or publication/lifecycle rule change.

Changed files in this correction: src/features/property-listing/models/LandlordPortfolio.ts; models/PersistedListingDraft.ts; services/landlordPortfolioService.ts; new services/portfolioDiagnostics.ts; viewModels/landlordPortfolioWorkflow.ts; viewModels/listingDraftWorkflow.ts; tests/landlordPortfolio.test.ts; tests/listingDraftPersistence.test.ts (non-null fixture token type only); the living feature document; this history; existing backend ledger. No other uncommitted application work was replaced.

Safe diagnostics cover auth, properties, listings, batched verification, covers and identity/hydration validation; known safe failure categories propagate to the workflow instead of all becoming network errors. No failed read becomes an empty success. Five new tests cover pre-deployment mixed active/draft records with no RPC client, schema details sanitization, authorization/network classification with prior records retained, cover failures and identity/unknown categories. The primary regression failed before production changes and passes after. npm run typecheck PASS; npm test 933 total / 933 passed / 0 failed / 0 skipped / 0 cancelled. Android acceptance remains RUNTIME-UNVERIFIED. No permanent live backend mutation was performed in this phase. No commit/push/merge/deploy/build.


## Exact-target draft editing deployment (2026-11-01)

The reviewed source migration 20261101130456_update_listing_draft_exact_version.sql is now DEPLOYED / CATALOG-VERIFIED on RentLease cxfsbwbwmwmgtqfonqth following explicit user approval and confirmed user-created schema/data/roles exports (not restore-tested; limitations acknowledged). This supersedes the historical PREPARED/NOT APPLIED entries above. Supabase assigned deployed history version 20261101130456_update_listing_draft_exact_version. The current local filename is now aligned with that deployed version; the original preparation timestamp is historical only. Do not reapply this deployed migration or rewrite its history.

All three existing listings received distinct non-null edit_version UUIDs; enabled rotation trigger, RPC signature, restricted search path and authenticated-only client EXECUTE were verified. All original listing fields, publication timestamps and verification-record fingerprints matched before/after; statuses remain two active and one draft. No live edit/publish/delete test or application deployment occurred. Exact SQL/checksum, backup limitations, actor/tool and pre/post evidence are recorded in the existing backend ledger under DRAFT-EDIT-DEPLOY-01. No source migration or existing applied migration was rewritten.

Android RUNTIME-UNVERIFIED: reload the app and reopen the saved draft to obtain a fresh token; test an explicitly authorized edit/save/reopen retaining its UUID, conflict recovery and unchanged photo/property associations. No automatic publication. Live schema deployment no longer blocks that acceptance; no native rebuild is required by this SQL-only deployment. Earlier 933/933 frontend tests and local backend concurrency evidence were not rerun during deployment. No commit/push/merge/build.


## Saved-draft hydration and navigation correction (2026-11-01)

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED after this correction. User-reported Android acceptance before this correction: portfolio shows existing published/draft records; saved draft is editable; exact-target save retains the listing UUID; prior published listings unchanged. Availability/unsaved-change retesting remains pending. Live exact-target contract is already deployed as 20261101130456_update_listing_draft_exact_version; the original local migration must not be replayed.

Verified source causes: opening a portfolio draft immediately displayed Listing Details with empty local listing fields while independent photo/amenity reads and publication restoration ran. Publication restoration already fetched/validated the exact listing, then draft workflow load fetched it again with repeated Auth/property checks. Photos and amenities also reloaded on Details -> Preview -> Details. Completeness uses the unchanged listingCompleteness local inputs until persisted fields/photos/amenities arrive; a roughly 40% intermediate snapshot was not proof of the saved listing's actual persisted score. Another race reset workflows on same-property/same-listing reopen without changing their effect dependency keys, leaving them reset but unstarted. Read-only busy flags also blocked Back rather than cancelling initial hydration.

Correction: explicit idle/loading/ready/error initial saved-draft state combines matching workspace property/listing IDs, settled listing initialization, publication recovery, photos and amenities. Listing Details hides form/completeness/actions until ready; loading copy is accessible, Back/Close remain available, failure offers Retry/Back and a 30-second initial-load deadline prevents an endless blank editor. The completeness formula, persistent ready-state footer, contextual hints and authoritative score remain unchanged. No placeholder percent or editable blank fallback is shown. Version and date fields are part of the confirmed listing snapshot.

Each entry/retry has a new workspace generation even for the same UUID. Initial Back/Close invalidates/reset read workflows before leaving. Late generations cannot adopt fields, completeness, token or request completion into a new entry. Failed initial reads do not enable Save/Preview. Once ready, existing unsaved guards and baseline-aware reconciliation preserve local edits; publication review waits for the hydration barrier. Snapshot reuse accepts only the fresh authorized publication-restoration read, checks context identity/property and the durable draft journal, and never reuses portfolio data as a write token. Unknown save/publication/photo markers remain subject to their existing recovery flows. No mutation is retried automatically.

Optimizations: reuse the fresh listing read instead of fetching the same draft a second time; remove only the repeated pre-read property check immediately following validated restoration context (post-read access revalidation remains); parallelize active amenity catalogue, selected associations and owner-private-location existence reads after ownership validation. Load photos/amenities once per workspace, reloading on a new entry or explicit recovery rather than every Preview transition. Portfolio physical summary is reused for display, with fresh service ownership/active checks; no persistent authorization cache is introduced.

Safe development [DRAFT-HYDRATION-DIAG] logs stage, durationMs, per-entry request number where available, result and allowlisted code. Stages cover property/listing queries, publication lookup, amenities, photos, verification and total ready/error/cancel. Logs include no listing content, address, precise coordinates, credentials or personal data. Controlled tests show the redundant listing fetch goes from 1 to 0 beyond the single restoration read (two listing fetches -> one), and a Details/Preview/Details cycle goes from three photo/amenity loads each to one each. No comparable before/after physical Android milliseconds were collected; no real-device speedup is claimed. Capture those diagnostic timings during Android acceptance. Verification status remains independent and freshly validated through its existing workflow.

Changed source paths under src/features/property-listing/: new services/draftHydrationDiagnostics.ts; services/listingDraftService.ts, services/listingPublicationService.ts, services/propertyAmenityService.ts; viewModels/listingDraftWorkflow.ts, viewModels/usePropertyListingViewModel.ts; views/ListingDetailsView.tsx. Tests: new tests/draftHydrationDiagnostics.test.ts; modified tests/propertyExitGuard.test.ts, tests/propertyWorkspacePresentation.test.ts, tests/listingDraftPersistence.test.ts and tests/marketplaceWiring.test.ts. The architecture test permits only the feature-local diagnostics helper import; View/backend isolation assertions remain. Presentation fixtures now explicitly supply the hydration contract. Existing publication review fixture supplies successful photo reads because readiness now genuinely requires them.

Validation: npm run typecheck PASS; full npm test 943 total / 943 passed / 0 failed / 0 skipped / 0 cancelled (10 new cases over 933). Initial delayed/handoff and repeated-fetch regressions failed before the fix. Coverage includes pending/ready/error UI, slow reads, safe initial Back/reopen, different listing UUIDs, stale title/date/version rejection, failure/Retry with no writes, preserved unsaved edits, snapshot reuse/no duplicate read, Preview return without extra media/amenity fetches, exact-target date change/clear/reopen, safe timing and parallel-read failure diagnostics. Existing same-ID saves, publication/lifecycle/Tier 3/portfolio/account guards remain passing. Unit mocks are not Android runtime or live security validation.

Android retest: open the existing draft under a slow connection -> only Loading saved details, no percentage/form or Save/Preview interaction -> complete correct title/terms/photos/date/token-backed context and persisted score. Repeat hardware Back/Close before loading completes, immediate same/different draft reopen, failed load/Retry, and Preview/Back with unsaved changes. Confirm date change -> save -> close/reopen, date clear -> save -> reopen, exact same listing UUID, Stay/Leave preservation, account changes and unchanged published listings. Capture [DRAFT-HYDRATION-DIAG] per-stage and total timings; do not infer network latency from Node test durations.

No Supabase interaction or permanent live backend mutation was performed in this correction. No RPC/migration/RLS/Storage/completeness/Tier 3 rule/Discovery filter/dependency change. Existing uncommitted work preserved. No commit, push, merge, deploy, EAS build or native build. Skills read/applied: the eight local RentLease SKILL.md instructions already reviewed for this feature (feature implementation, MVVM, Supabase contract, security, test/runtime, documentation, ledger, artifact organizer), systematic debugging/TDD/verification guidance, and Impeccable with product/design context and product register.


## Stage 2 - Published-content editing implementation (2026-11-01)

Scope: existing active/paused listing content only. Baseline contains the prior uncommitted Stage 1, hydration, Tier 3, Search/Discovery and portfolio work, all preserved. User reports Stage 1 Android hydration/edit/same-UUID persistence acceptance passed. Stage 2 is IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED; the migration was initially prepared without live application and subsequently deployed under 20261101145623 (see deployment evidence below).

Plan/result: inspect deployed version/publication/lifecycle/completeness contracts read-only; prepare one update-only RPC; generate only its local types; reuse the saved-content workflow with an explicit draft-versus-published policy; compose a separate published journal/workflow into the same editor and hydration barrier; add Edit Listing to existing My Listings cards; show Save Changes and current Published/Paused status; hide property/media/publication actions; return to existing status view only after validated receipt plus scoped reload. Stage 1's default policy remains unchanged. Known failures retain fields, conflicts use explicit baseline-aware reload, and unknown outcomes keep exact-target markers with read-only reconciliation.

New source files under src/features/property-listing/: services/publishedListingService.ts, services/publishedListingDependencies.ts, viewModels/publishedListingWorkflow.ts. Modified: components/ListingWorkspaceFeedback.tsx; viewModels/listingDraftWorkflow.ts (reusable explicit policy), viewModels/usePropertyListingViewModel.ts; views/ListingDetailsView.tsx, views/PropertyDashboardView.tsx, views/PublishedListingStatusView.tsx. src/shared/services/supabase/database.types.ts adds only the locally generated update_published_listing_content entry (SETOF listings) in this pass; no existing generated entries replaced.

New backend/test artifacts: supabase/migrations/20261101145623_update_published_listing_content.sql (Supabase CLI migration new scaffold); supabase/test-support/published_edit_schema.sql (LOCAL ONLY full listing shape over prior fixture); supabase/tests/run_published_edit_concurrency.py; tests/publishedListingEditing.test.ts. Modified tests/propertyExitGuard.test.ts, tests/propertyWorkspacePresentation.test.ts and tests/marketplaceWiring.test.ts. The native test-composition allowlist adds only the feature's own published dependency; existing MVVM assertions remain. New actual-hook active/paused tests cover hydrated editor/UUID/date/rent/save/navigation/unchanged state; service tests cover exact payload, statuses, failures/conflicts/missing RPC, uncertainty, duplicates, reopen and stale account/disposal responses. Confirmed completion after disposal may safely clear its journal while UI stays invalidated; account-invalidated unknown outcomes keep it.

Backend contract: update_published_listing_content(p_listing_id uuid,p_expected_edit_version uuid,p_title text,p_description text,p_asking_rent_monthly numeric,p_house_rules text default null,p_rental_term rental_term_type default long_term,p_security_deposit_months numeric default 1,p_advance_rent_months numeric default 1,p_minimum_stay_months smallint default null,p_available_from date default null) RETURNS SETOF public.listings. Restricted pg_catalog search_path, controlled SECURITY DEFINER, authenticated EXECUTE only; explicit active Tier 1/Landlord/owner-active-property authorization; property advisory + listing lock; stale/status conflicts 40001; all content validation + existing completeness trigger preserved. No listing INSERT, status/relationship/private-coordinate/verification mutation or table privilege broadening. Published timestamp invariant prevents an existing malformed active-null-publication-time row from being silently assigned a new publication time.

Validation: npm run typecheck PASS; npm test 961 total / 961 passed / 0 failed / 0 skipped / 0 cancelled (18 new tests over 943). Real PostgreSQL 17 runner final published_edit_v3: original Stage 1 27 passed plus Stage 2 30 passed. Stage 2 covers active/paused fields/time/status, future/cleared date, finite-value guards, owner/Tier 1/role denials, 80% atomic rollback, two independent writers and row-locked lifecycle races, no replacement row and unchanged photos. The first SQL test call required explicit smallint casts; corrected only test arguments and reran on fresh DB. Existing completeness pgTAP: 74 ok / zero not ok / plan 1..74 / rollback, run via psql not pg_prove. extensions.plpgsql_check_function_tb returned zero error rows for the final new RPC. Earlier partial runs are not counted as final passes.

Type provenance: Supabase CLI gen types typescript from loopback disposable published_edit_tests, schema public. The local fixture was explicitly aligned to inspected live listing fields/nullability before generation; no full fixture type replacement or live type regeneration. Windows rejected reserved port 55439, so the successful isolated container used loopback 15439. No project packages/native config changed. Reproduction notes were added to existing DRAFT_EDIT_TESTING.md. Full live RLS/tenant runtime behavior is not established by the synthetic fixture; production search query source is unchanged and existing tests remain passing.

No permanent live backend mutation was performed in this phase. One live read-only catalog/grant SELECT is recorded in the existing ledger; no live update/publish/test records or migration application. The new migration must be separately approved/deployed; never replay Stage 1. Existing application work and old migration files are preserved. No commit/push/merge/deploy/build. Skills actually read/applied: all eight repository RentLease SKILL.md files (feature implementation, MVVM, Supabase contract, security, testing/runtime, documentation, ledger, artifact organizer), prior Impeccable product/design/register guidance and TDD/verification guidance.


Final Stage 2 checks (2026-11-01): typecheck PASS; frontend 961/961, zero failed/skipped/cancelled; final local PostgreSQL published_edit_v3 27 Stage 1 + 30 Stage 2 checks passed; completeness pgTAP 74 ok/zero not ok/plan 1..74; static RPC error rows zero. Documentation 53 links/anchors checked, zero errors; git diff --check and staged whitespace checks PASS; protected audit 361 files with zero unexpected changes. Removing only the generated new RPC block restores database.types.ts to its pre-stage checksum. Prepared migration SHA256: 29451d996037bb67726fa94ebb9289db9185e5d08dcbefe4ed52383da98fcd75. Verified own disposable container ID prefix b8daf93e619c/image/AutoRemove and stopped it successfully; its local databases were discarded. No live migration or user-data mutation occurred.


## Stage 2 controlled deployment (2026-11-01)

Stage 2 is now DEPLOYED / CATALOG-VERIFIED on RentLease cxfsbwbwmwmgtqfonqth. This supersedes historical PREPARED/NOT APPLIED entries above. Reviewed local source 20261101145623_update_published_listing_content.sql (SHA256 29451d996037bb67726fa94ebb9289db9185e5d08dcbefe4ed52383da98fcd75) was applied unchanged after explicit approval and inspection of refreshed stage2-predeploy-20261101-225203 manual exports. Those exports were not restore-tested and are not a full managed backup guarantee.

Supabase assigned history 20261101145623_update_published_listing_content (2026-11-01 22:56:23 UTC+8). Stage 1 history 20261101130456 remains unchanged. Both current local filenames now match deployed history; preserve the historical preparation mapping for provenance and do not reapply either migration. New RPC signature/body, postgres ownership/SECURITY DEFINER, pg_catalog search_path and authenticated-only client EXECUTE verified. Existing version trigger remains enabled and existing function definitions unchanged. Full listing and verification fingerprints match pre/post, with three listings (two active/one draft), no changed content/status/timestamps/UUIDs, and no duplicate records. All verification was non-destructive SELECT; no actual content update/publication/status action occurred.

Detailed backup/actor/SQL/checksum/ACL/fingerprint evidence is in the existing backend ledger PUBLISHED-EDIT-DEPLOY-01. Android remains RUNTIME-UNVERIFIED for Stage 2: reopen an active listing via Edit Listing, change supported content/date, save and reopen, verify same UUID/property/active state/first published timestamp; repeat paused when available, conflict/reload, uncertain-network reconciliation and Back/Stay/Leave. No new native dependency/rebuild required. No commit/push/merge/application deployment/EAS build.


## Milestone 1 - Shared property editing and Tier 3 re-verification architecture (2026-11-02)

**DESIGN COMPLETE FOR REVIEW / NOT IMPLEMENTED.** This integrates editing Stages 3-5, distinct from the older five-phase creation roadmap. Milestone 2 has NOT STARTED. No SQL/migration/application changes are part of this milestone. Branch feature/search-discovery-backend-integration was clean at inspection. Preserve deployed Stage 1 20261101130456 and Stage 2 20261101145623; never replay them.

### Verified baseline and chosen approach

Read-only catalog inspection of RentLease cxfsbwbwmwmgtqfonqth and current source confirms:

- properties has no edit/media version or identity revision. Clients have SELECT only on properties, private locations and amenities despite broader RLS text. New controlled writes are needed.
- Tier 3 submissions bind property_id only. Publish/reactivate accepts an approved submission for that UUID, without immutable identity binding. The account badge is not property-specific authorization.
- Tier 3 fetchLatest selects the newest submission, and its workflow blocks a new attempt whenever ANY submission exists, including rejection. There is no Tier 3 recovery-start RPC or single-open index. It cannot support renewal unchanged.
- Verification INSERT rights are COLUMN-SCOPED: user_id/tier/property_id/submitted_note and permitted document fields. Absence of table-wide INSERT is not a missing initial-submission privilege.
- Admin review requires pending -> under_review -> approved/rejected, with land_title/tax_declaration/hoa_document/authorization_to_lease. Preserve this evidence requirement. Queue/review currently have no revision context.
- Public property-media permits JPEG/PNG/WebP, 10485760 bytes, max ten ordinary metadata photos. Verification documents are PRIVATE. Known public photo URLs/caches are not private even when a listing pauses.
- Photo deletion already commits metadata before Storage; journals preserve unknown outcomes. Cover is transactional, ordering sequential/partial. Independent Storage DELETE/UPDATE can bypass UI ordering; metadata completeness alone does not prove bytes remain present.
- Completeness uses the property advisory gate and locks all related listings in stable order. Any active listing below 80% rolls back the related mutation; no auto-pause. Listing edit_version intentionally excludes completeness-only refreshes.
- Tenancies have their own agreed_monthly_rent/dates/confirmations and RESTRICT property/listing FKs. Active -> listing rented; ending active -> archived. Current clients have tenancy SELECT only; no creation/activation RPC was found. Active tenants can read current private location under the existing helper.
- No dedicated unit-number column, identity snapshots or ordinary-panorama table exists. Unit identifiers currently live in address text. 360 remains deferred/preview.

Recommendation: immutable same-property identity revisions, staged privately until a new bound Admin approval atomically promotes them. Rejected alternatives: immediate canonical mutation/invalidation would expose unverified changes or silently alter visibility; always creating a new UUID for a spelling correction would fragment history. A NEW UUID is nevertheless required for a different asset, relocation, unit split/merge or ownership-transfer workflow. This is a proposed policy, not delivered revision support.

### Field-level editing and re-verification policy

A = routine/non-identifying, no renewal. B = material details with additional validation, no renewal only for the SAME rental footprint. C = identity-sensitive: renewed Tier 3 before canonical change, or new property when the asset differs. None of these permissions amend a tenancy agreement.

| Field / action | Class | Proposed handling | Verification / tenancy effect |
| --- | --- | --- | --- |
| Listing title/description/rent/date/rules/term/deposit/advance/minimum stay | Listing content | Existing Stage 1/2 only | No renewal; never edit tenancy agreed rent/dates; existing active/paused rules |
| Photo add/remove/cover/order/alt_text | A | Versioned ordinary-photo commands; existing bucket/table/uploader | No renewal; every affected active listing must remain >=80%; photos are not Tier 3 proof |
| Photo UUID/property_id/storage_path | Protected | Immutable registered identity; replacement uses a fresh reserved key | Never reparent/relabel another property's photo or reuse consumed UUIDs |
| furnishing_status | A | Controlled routine RPC, backend enum | No renewal; offering description does not amend tenant obligations |
| amenity_ids | A | Atomic full-set diff of real active catalogue IDs | No renewal; completeness rollback; no guessed IDs |
| property_amenities.details | A, deferred UI | Excluded from first routine RPC | Non-identifying only; no address/identity replacement |
| access_instructions | A, private | Explicit private-field allowlist + property CAS | No renewal; existing owner/Admin/active-tenant access only; never public/logged; not official address |
| bedrooms | B | Nonnegative smallint; same footprint | No renewal for recount/correction; frozen during open tenancy |
| bathrooms | B | Finite nonnegative numeric, including supported fractions | No invented integer-only rule; frozen during open tenancy |
| floor_area_sqm | B | Optional finite positive numeric; clear only if allowed/completeness valid | Same footprint only; frozen during open tenancy; split/merge/another unit requires new UUID |
| max_occupants | B | Optional positive smallint | Frozen during open tenancy; no resident-count inference from tenancy rows |
| total_floors / house number of stories | B | Optional positive smallint; existing floor_number <= total_floors | No renewal for building-description correction, including with tenancy if rental unit/footprint unchanged |
| floor_number / unit-room-space floor | C | Evidence-backed same-unit correction proposal | Floor identifies a unit. A different unit/floor is a new asset; house floor remains inapplicable/null |
| property_type | C | Admin-reviewed same-asset classification correction | Renewal for a real enum change; subdivision into separate rentals needs separate UUIDs |
| city | C | Proposed identity, existing cavite_city enum | Renewal; no direct canonical update |
| barangay | C | Proposed identity | Renewal, including real spelling corrections |
| address_line_1 | C, private | Proposed street/building identity | Renewal |
| address_line_2 / embedded unit identifier | C, private | Proposed identity | Renewal; retain address-field representation, no new unit-number column |
| postal_code | C, private | Proposed identity | Renewal for actual value change; do not assume address edits are cosmetic |
| exact_location | C, private | Explicit address-revision/pin confirmation -> private candidate | Renewal even for a small pin change/same public grid cell; no invented safe-distance threshold |
| public_location | C-derived | Derived/validated from candidate exact point using approved 300m policy | No independent landlord coordinate entry; publish only with approved identity |
| landlord_id / property UUID | Protected | No edit allowlist | Never transfer approval/tenants; ownership transfer outside scope |
| safety_rating | Protected | Existing authorized system/Admin responsibility | Never landlord self-assignment |
| is_active | Protected | Separate explicit lifecycle/Admin contract | No implicit deactivate/visibility change |
| timestamps/versions/identity and approval pointers | Server-owned | Controlled server defaults/triggers/RPCs | Client cannot assign |

Open tenancy means ANY proposed, pending_confirmation or active row across ALL listings for the property. Freeze bedrooms/bathrooms/floor_area_sqm/max_occupants while one exists; require the separate tenancy/consent process or wait until none is open. Never end/cancel one automatically. total_floors is deliberately different: a building description can change without moving its rental unit. A same-unit floor/address/type typo still follows C. Only server-confirmed identical normalized values (outer whitespace/numeric representation) are no-ops. No fuzzy address equivalence, arbitrary percent-area or pin-distance exemption.

A/B never permits repurposing an approved UUID for a new house/unit/parcel or rental boundary. Reject that route and require New Property; do not auto-copy/reparent listings, photos, approvals or tenancies. Human review must establish same physical asset; coordinate proximity alone cannot prove it. A future system-only public-projection policy change with unchanged exact identity is separately reviewed infrastructure, not landlord editing or automatic renewal.

### Revision model and invariants

Proposed additions, NOT current schema:

1. properties.edit_version UUID for physical/private-access/amenity changes and canonical promotion; properties.media_version separately for media metadata. Opaque server tokens rotate on relevant writes, not reads/updated_at alone. Listing edit_version stays listing-content/status scoped.
2. Non-exposed rentlease_property_identity schema with immutable property_identity_revisions: property/owner-at-capture, parent, type/city/barangay/unit floor, private address tuple/exact point, derived public point, projection-policy version, capture provenance/time. No direct client grants. The candidate public point is still private until approval.
3. property_identity_change_requests: workflow envelope linking base/candidate revisions, property, actor/operation ID, request version and draft/submitted/applied/rejected/withdrawn outcome. One open draft/submitted request per property. Submitted candidate payload is immutable; corrected rejected attempts get new history.
4. properties.current_identity_revision_id denotes canonical identity; property_verification_bindings links property + current revision + exact approved submission. Composite constraints enforce same property/owner/revision. A new canonical baseline is UNVERIFIED, not an implicit approval.
5. verification_submissions.identity_revision_id, optional identity_change_request_id and ready_for_review_at bind evidence and upload readiness. Tier 2 remains null/unchanged. Preserve existing verification_status and historical approvals/rejections; never overwrite/repoint old approval to a new identity.
6. Tenancy identity snapshot reference and property-version-at-confirmation preserve what was presented. Future legacy backfill is observed-at-migration, not fabricated original agreement evidence.

Current verification requires matching canonical revision, binding and approved submission for the property/owner. Latest submission sorting and profiles.tier3_verified_at are not that predicate. Return CURRENT APPROVAL and PENDING CORRECTION separately, so pending/rejected renewal does not hide the valid current identity.

Bootstrap is a release gate: snapshot current data with observation provenance, inventory legacy approved/pending duplicates and missing private rows, and adjudicate exceptions rather than deleting them. Existing approval may bind ONLY its unchanged observed baseline with explicit legacy provenance; do not claim the snapshot existed at the old review date or that manual/Admin historical edits were impossible. Audit anomalies before enabling C. New property creation remains Tier 1-only, creating an unverified baseline after private location save; never require Tier 3 to create a property.

Flow: explicit proposal -> private immutable candidate -> explicit document/submission confirmation -> start/resume exact pending submission -> private upload/metadata/finalization -> pending Admin queue -> start review -> approve/reject. Merely opening screens writes nothing. Upload and metadata are non-atomic/journaled; missing metadata does not prove upload failed. No blind retry or speculative deletion. Only finalized submissions enter review. Freeze candidate and document attachments at readiness/under_review.

Admin compares CURRENT/PROPOSED identity and bound evidence, attests same asset, and supplies expected request/property versions. Approval atomically commits canonical property/private location, current revision, binding, submission/request outcome and backend summary; preserve current A/B values and revalidate floor constraints against latest total_floors. Reject stale base revision/owner/access/version or invalid completeness as an ENTIRE transaction. There can be no approved submission without its committed binding/promotion. Approval never publishes/reactivates automatically.

Rejection/withdrawal changes only request/submission outcome; current identity/approval/listings/agreements stay unchanged. Resubmission creates new evidence history. Initial Tier 3 and renewal share the binding protocol. Revision-bound submissions must not use the old generic review path without token checks; Tier 2 is unchanged. Guard canonical property/private identity consistency at commit, without trusting a spoofable session-setting bypass.
### Active/paused listings and tenancy protection

| Situation | Proposed behavior |
| --- | --- |
| Active listing; routine edit/media change | Explicit authorized update; remain active only if all existing active completeness constraints pass. Otherwise reject the entire update with actionable feedback; never silently pause. |
| Paused listing | Preserve paused and original publication timestamp. Approval or editing does not reactivate. |
| Identity proposal pending/rejected/withdrawn | Existing verified identity and current approval remain canonical. Current listing remains unchanged; proposed private information never leaks into discovery or tenant reads. |
| Approved same-asset identity correction | Atomic promotion, preserving property/listing UUIDs and active/paused state subject to existing constraints. Existing tenants retain agreements and access under existing rules. |
| Different asset, relocation, unit split/merge | New property UUID and independent verification; never reparent listings, tenants, or old approval. |
| Existing approval actually revoked for fraud/security | Separate explicit Admin incident/visibility policy, outside this implementation. Do not equate rejected correction with revocation. New publication/reactivation/promotion must fail closed if current binding is invalid. |

Freeze bedrooms, bathrooms, floor area, and maximum occupants while ANY proposed, pending_confirmation, or active tenancy exists across ALL listings for the property. There is no resident roster/count supporting a weaker occupancy check. Descriptive building-floor corrections may proceed only when the unit/footprint remains unchanged and the floor relationship remains valid. Routine furnishing/amenity edits must not rewrite contractual promises: preserve agreed rent, dates, confirmations, tenancy status, and historical evidence; the future UI must warn that agreements remain binding.

Tenancy writes must participate in the same property advisory gate and verify the identity/property version accepted at confirmation. This is a backend release dependency, not new tenancy UI. Acquire the property gate before fresh eligibility reads; property-edit transactions must NOT acquire tenancy row locks, avoiding a cycle with tenancy BEFORE UPDATE triggers that already hold their row lock. If tenancy commits first, the geometry edit is blocked; if property editing commits first, stale tenancy confirmation must reject and require explicit reconfirmation. No automatic cancellation or tenant migration. Add accepted-identity evidence for new confirmations; mark legacy evidence unknown rather than inventing historical snapshots. Current private-location access remains owner/Admin/authorized active tenant only; pending proposals grant no additional access.

### Shared concurrency, media, and security contracts

Use the existing property advisory key and stable listing-row ordering; expected UUID tokens are compare-and-swap guards, not client timestamps. Add independent property edit and media version tokens so unrelated photo changes do not falsely overwrite physical data. Rotate each token for its protected writes, including authorized alternate paths. All commands recheck authenticated active Tier 1 landlord, current ownership, exact target, expected token, and permitted fields under the gate. Admin review has separate explicit Admin authorization. No broad direct property UPDATE grants, service-role client, or frontend authorization replacement.

Retain existing property-media JPEG/PNG/WebP, 10 MiB, maximum ten photos, immutable owner/property/photo UUID paths, and upsert:false. Introduce server-authorized upload intents and operation receipts keyed by actor/request ID plus input hash. Register only the authorized immutable path; metadata changes, cover repair, ordering, token rotation and completeness refresh are transactional. Reordering supplies the exact complete current photo-ID set. Removing metadata must succeed before deleting known Storage bytes; rejected active-completeness updates leave both intact. Unknown outcomes retain journals and require authoritative reconciliation, never speculative cleanup or automatic replay.

Current Storage UPDATE/DELETE can independently overwrite/delete bytes despite metadata protections. Milestone 2 therefore requires narrow Storage policy hardening: deny immutable-key overwrites; allow deletion only for an owner-authorized cleanup intent/tombstone after metadata is absent. Registration and cleanup authorization serialize on the same property gate with fresh reads. Delete through Storage API, never direct SQL on storage.objects. Narrow legacy direct photo metadata writes only after every supported photo path uses the controlled commands; coordinate rollout so old clients cannot bypass invariants. Existing public bucket URLs/caches remain public and are not a privacy-revocation mechanism.

### Proposed database/API contracts (design only)

These are proposed signatures/allowlists, NOT deployed functions. Final SQL signatures require implementation review against the then-current schema.

| Contract | Exact responsibility |
| --- | --- |
| get_owned_property_edit_context(property_id); batched get_owned_property_edit_states(property_ids) | Owner-scoped canonical physical data, versions, current verification binding, pending-request summary, and edit blockers. Private fields only in authorized detail reads. |
| begin_property_photo_upload(property_id, expected_media_version, request_id, mime) | Reserve immutable photo UUID/path and capacity; return upload intent. |
| register_property_photo(property_id, upload_intent_id, expected_media_version, request_id, alt_text) | Validate uploaded-object contract; atomically register/refresh/rotate; existing first-cover semantics. |
| remove_property_photo(property_id, photo_id, expected_media_version, request_id) | Transactional metadata/cover/completeness operation; receipt permits known-object cleanup only. |
| set_property_cover_photo_versioned; reorder_property_photos; update_property_photo_metadata | Exact property/photo IDs, expected media version and request ID; full ordering set or typed alt-text allowlist. Reuse existing cover semantics behind versioned boundary. |
| update_property_details(property_id, expected_edit_version, request_id, typed A/B fields) | Routine allowed fields only; cross-field and open-tenancy checks; no identity/protected fields, no listing insertion/status change. |
| propose_property_identity_revision(property_id, expected_edit_version, base_revision_id, request_id, typed C tuple) | Validated complete candidate, exact/public location pairing and derivation-policy provenance; no canonical update. |
| begin_tier3_property_verification(property_id, target_revision_id, expected_versions, request_id) | Exact owned revision; one open attempt; explicit initial/renewal/resubmission start. |
| register_tier3_revision_document; finalize_tier3_property_verification | Bind exact submission/revision and controlled metadata; finalize readiness only after required evidence. Preserve private document Storage authorization. |
| get_property_identity_revision(revision_id) | Owner/Admin detail comparison; no tenant/public candidate access. |
| review_property_identity_revision(submission_id, revision_id, expected_request_version, expected_property_version, decision, feedback) | Admin-only review and atomic same-asset promotion/binding; existing evidence types/rejection rules retained. |
| withdraw_property_identity_revision(request_id, expected_version, operation_id) | Authorized pre-approval withdrawal; no canonical identity change or evidence-history erasure. |
| internal has_current_property_verification(property_id, owner_id) | Exact current approved revision binding, replacing historical any-approved checks in publication/reactivation. |

Use typed allowlists rather than unrestricted JSON assignment. SECURITY DEFINER commands require explicit identity/role/ownership checks, restricted pg_catalog search_path with fully qualified objects, authenticated-only EXECUTE (Admin role enforced inside review), and private-schema objects inaccessible to direct client mutation. Validate bounded numbers, enums, nullable fields, address semantics, complete location, amenity catalogue IDs, and existing floor relationship. CAS conflict is a known conflict, not unknown mutation; transport ambiguity retains request receipts/journals. Ordinary reconciliation reads never replay a mutation.
### Migration dependency groups and implementation sequence

No migration files are created in Milestone 1. Names below are logical groups; assign new timestamps only when authorized implementation begins. Never replay the deployed Stage 1/2 migrations.

1. **Milestone 2 / Stage 3: property_edit_versions_and_media_commands.** Introduce shared edit/media tokens, upload intents/receipts, narrow versioned media commands, completeness-safe cover/removal/order, Storage cleanup/overwrite guards and coordinated legacy-path restrictions. Integrate existing photo manager on active/paused surfaces; test concurrency and interrupted cleanup. Identity editing remains locked.
2. **Milestone 3 / Stage 4: property_routine_details_update_and_tenancy_guard.** Add allowlisted routine-details command and owner context reads; align every authorized tenancy confirmation/write path with the property gate/version checks before enabling material edits. Integrate routine editor and token-aware conflict/reconciliation. Identity fields remain read-only.
3. **Milestone 4a / Stage 5 foundation: property_identity_revision_binding.** Private revisions/change requests, current pointer/bindings, submission revision fields, accepted-identity tenancy evidence, audited bootstrap and creation-baseline hook. Inventory legacy inconsistencies before activation; no inferred historical proof or mass unpublishing.
4. **Milestone 4b / Stage 5 completion: property_identity_verification_and_promotion.** Initial/renewal/resubmission start and finalization, immutable evidence guards, token-aware Admin detail/review, atomic promotion, current-binding publication/reactivation checks, alternate-write protection and queue compatibility. Deploy as a coordinated release with 4a; do not expose editable identity until the complete protocol is available.

Each group requires reviewed SQL, rollback/recovery plan, tests, backup confirmation and separate explicit live-deployment approval. Existing Stage 1 exact-draft and Stage 2 published-content editing remain independent and unchanged. If revision work cannot safely ship, retain read-only identity and new-property guidance rather than direct identity updates.

### Frontend integration and concise UX

Reuse existing feature services/workflows, shared pure policy contracts and root navigation composition. No cross-feature ViewModel imports or second verification form. Property & Listing passes property UUID and optional revision/request UUID to existing Tier 3 flow; the verification service validates ownership. Return restores the same editor/context, refreshes batched verification state and invalidates stale account/property/request generations. A general account badge is never proof of current property approval.

My Listings keeps its primary existing action and a compact contextual menu: Manage photos, Edit property details, Request identity correction, verification/status, and Review Publication as appropriate. Existing listing-content editing remains separate. Show one short pending-correction line; current identity remains the visible live identity. Admin detail shows current/proposed comparison and version-bound evidence. No candidate coordinates in public cards. No automatic submission, publication, or reactivation. No new dependencies or navigation framework planned.

### Required future verification and acceptance gates

- Field-policy tests: every allowed/protected/identity field; house null unit floor; floor constraint; optional/null/enum/numeric cases; no-op normalization; preservation of untouched values.
- Media tests: active/paused/draft, 10-photo/10 MiB/MIME/path rules, cover/order, active completeness rollback, raw Storage bypass denial, immutable paths, concurrent registration/deletion, partial failures and recovery.
- Routine edits: exact property/token ownership, stale/concurrent edits, property-wide open-tenancy freeze, both tenancy/edit transaction orderings, no agreement mutation, unchanged listing/photo associations and completeness formula.
- Revision tests: initial vs renewal, concurrent proposals, legacy provenance exceptions, private read denial, duplicate submissions, frozen evidence, rejected/withdrawn attempts, stale review, atomic promotion rollback, same-asset restrictions, current-binding publication/reactivation, creation baseline, old review/write bypass denial, unchanged Tier 2 behavior.
- MVVM/UI tests: state-specific actions, correct property/revision UUID, preserved unsaved draft, stale account/navigation results, conflict/reconciliation, no false saved/published success; Android Back/large-text/keyboard/accessibility and real owner/Admin/tenant acceptance.
- Run applicable local SQL/pgTAP tests, typecheck/full frontend tests, whitespace/link checks, protected-file audit, then separately approved staging/live deployment verification. Mock tests are not RLS or Android acceptance.

### Milestone 1 evidence and decision boundary

Architecture/documentation only. Five SELECT-only live catalog inspections established the existing schemas, grants including column-scoped INSERT, policies, routines, triggers, indexes and dependencies; see the [backend ledger](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#milestone-1---shared-property-editing-architecture-2026-11-02). No listing content, tenancy content, private addresses, coordinates, documents or credentials were retrieved. No live write, RPC mutation test, migration file, application change or Android runtime test occurred. Existing 961 frontend / 57 backend / 74 pgTAP counts are historical evidence, not rerun results for this milestone.

Milestone 1 delivers a proposed policy and integrated release design for review. Milestone 2 is NOT STARTED. No permanent live backend mutation was performed in this phase. No commit, push, merge, deployment or build occurred.


## Milestone 2 - Published media implementation (2026-11-02)

Scope: first implementation after approved Milestone 1. Preserve the five already-uncommitted architecture documents. No Milestone 3/4 backend migration is introduced before this milestone's manual deployment confirmation.

Plan executed: reuse photo workflow/manager; implement property-scoped CAS media commands, immutable upload reservations and durable receipts; narrow legacy metadata/Storage mutation paths; expose active/paused photo management; run local PostgreSQL and frontend regressions; provide one complete tracked migration plus separate read-only verification query. No live SQL action occurred.

Source changed: services/propertyPhotoService.ts, viewModels/usePropertyListingViewModel.ts, views/ListingDetailsView.tsx, views/PropertyPhotosView.tsx, views/PublishedListingStatusView.tsx under src/features/property-listing; src/shared/services/supabase/database.types.ts. Tests changed: tests/propertyPhotos.test.ts and tests/propertyExitGuard.test.ts. New backend artifacts: supabase/migrations/20261101180736_property_media_versioned_management.sql; supabase/test-support/property_media_schema.sql; supabase/tests/run_property_media.py; supabase/tests/verify_property_media_deployment.sql. Existing test-support README and the three continuous feature/history/ledger documents are updated. Prior USER_VERIFICATION.md and ADMIN_VERIFICATION.md architecture edits remain preserved.

The exact RPC is manage_property_media(p_property_id UUID,p_expected_version UUID,p_request_id UUID,p_action TEXT,p_args JSONB); supported actions reserve/register/cancel/remove/cover/alt/reorder, strict per-action allowlists, actor/input-bound receipt, current ownership/Tier 1/role, shared property advisory gate and UUID CAS. Read APIs get_property_media_state and get_property_media_operation expose only authorized version/operation results. No mutation retries on uncertainty. SQL Editor migration is transactional, imports safe existing namespaces without changing photo/listing content, and fails on unsafe paths or unexpected bucket configuration. Legacy direct metadata/cover writes are intentionally restricted at coordinated cutover; existing read-only hydration handles an absent new contract without an empty fallback. Public bucket semantics remain unchanged.

Regression evidence: new tests first failed for absent media_version/commands, then passed after implementation. Actual active/paused hook tests exposed an early status-refresh/Back busy race; refresh now starts after accepted navigation. Existing service tests were adapted from direct writes/separate first-cover calls/sequential order to atomic RPC receipts, preserving account/duplicate/journal/partial-Storage assertions. No safety journal is cleared to make an unknown outcome pass.

Validation: npm run typecheck PASS; npm test 971 total / 971 passed / 0 failed / 0 skipped / 0 cancelled (10 above prior 961). Local PostgreSQL 17 integration 38 passed / 0 failed, including real two-session CAS serialization, active completeness rollback, ownership/Tier 1/role denial, MIME/size/capacity, receipt reuse, exact ordering, cover repair, legacy-write denial and immutable Storage lifecycle RLS on a fixture. SQL verification query runs read-only on the local fixture; five non-trigger routines have zero plpgsql_check errors. Storage rows in the fixture are not actual object HTTP transport. No new package/native dependency; Expo compatibility recheck is not required by this change.

Manual handoff: execute complete [migration](../../../supabase/migrations/20261101180736_property_media_versioned_management.sql) once, then [verification query](../../../supabase/tests/verify_property_media_deployment.sql), then mark only version 20261101172252 applied via approved history repair. SHA-256: adafc6e33bac11448d94738fbb0f6c4f2bb4cd749fa737ced421802459a10b72. Stage 1/2 deployed SQL is untouched. Await user execution confirmation; BACKEND NOT DEPLOYED / Android RUNTIME-UNVERIFIED. Milestones 3/4 remain NOT STARTED. See living document for Android sequence and rollout/legacy-journal limitations.

Skills actually read: repository-local rentlease-feature-implementation, rentlease-frontend-mvvm-guard, rentlease-supabase-contract-guard, rentlease-security-review, rentlease-test-runtime-verification, rentlease-documentation-maintainer, rentlease-implementation-ledger, rentlease-implementation-artifact-organizer SKILL.md; installed using-superpowers, writing-plans, test-driven-development, impeccable (product reference), supabase, verification-before-completion. User authorization covers local SQL design/implementation despite the default frontend-only boundary; no live deployment is authorized or performed. Existing approved design was reused without repeating architecture.

No permanent live backend mutation was performed in this phase. No commit, push, merge, deployment, EAS build or unrelated feature implementation occurred.

Final Milestone 2 checks: whitespace (working/staged) PASS; 9 new-section Markdown links/anchors PASS; protected tracked-file hashes confirm unchanged packages/config, deployed SQL, verification, publication/lifecycle, tenancy and maps. No staged changes. A final regression reproduced and fixed cleanup-journal loss on a known cancellation CAS conflict; final frontend total is 971. The disposable --rm PostgreSQL container was stopped after validation, discarding only local test fixtures.


### Milestone 2 controlled deployment preflight (2026-11-02)

User superseded the manual SQL Editor workflow with conditional Codex-managed deployment authorization for the single reviewed media migration. Preflight confirmed target/checksum, absent migration/RPC/schema, matching bucket/path/policy prerequisites and deployed Stage 1/2 history. Deployment STOPPED before any write: installed client cutover cannot be confirmed (HEAD remains legacy; compatible media service is uncommitted), and newest available local exports predate Stage 2 and lack its function. A current recovery point has not been established. See the [ledger preflight](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#milestone-2-deployment-preflight---stopped-2026-11-02). No actual deployment version or post-deployment verification is claimed. No permanent live backend mutation was performed in this phase. No code/SQL change, commit/push/merge/build occurred. Prior 971 frontend/38 PostgreSQL results are unchanged historical implementation evidence, not rerun for this read-only preflight.


### Milestone 2 recovery resolved; operational cutover pending (2026-11-02)

Created and checked fresh schema/data/roles exports in C:/RentLease-Backups/milestone2-predeploy-20261102-015817. Both deployed editing contracts are in the schema. See the [backup/client ledger](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#milestone-2-fresh-backup-and-client-cutover-preparation-2026-11-02) for timestamps/sizes/hashes and restore/Storage limitations. No migration was applied.

One emulator is attached to Metro. The current served Android bundle contains the versioned media service and photo entry points, but inspector runtime verification was unavailable. No forced reload disrupted unsaved work. No evidence establishes other testers/older APKs are paused. Current EAS config distinguishes development clients from bundled preview/production APKs; an installed APK does not automatically acquire current uncommitted JavaScript.

Maintenance cutover procedure:

1. Coordinate every tester; finish or reconcile pending photo operations, then leave photo management. Pause all photo mutations, including old APKs/dev clients.
2. With local edits safe, reload the Metro development client from this working tree. Verify Manage property photos is visible on an active/paused listing without issuing photo mutations. Older bundled clients stay closed until replaced with a compatible client; no automatic build/update is part of this task.
3. After explicit coordination/compatible-client confirmation, recheck target/checksum/history and capture aggregate content fingerprints. Apply ONLY the reviewed migration through connected tools; no earlier migration replay.
4. Verify RPC/trigger/policy/grant/history state and unchanged listing/photo/owner/Tier 3 fingerprints without real photo changes. Record actual remote version and safely align local migration filename if tools assign a new version.
5. Resume photo mutations only on confirmed compatible clients. Run Android acceptance: active/paused upload, cover, order, alt text, removal/replacement cover; active-completeness rejection; network interruption/Check saved photos; Back/Stay/Leave/account switching; reopen and unchanged listing/Tier 3 status.

Conditional deployment authorization remains valid, but no elapsed time or unanswered coordination request is treated as confirmation. No schema/app changes, commit/push/merge/deploy/build were performed in this preparation pass.


### Milestone 2 deployed through connected tools (2026-11-02)

DEPLOYED / CATALOG-VERIFIED / Android RUNTIME-UNVERIFIED for new photo-management behavior. User confirmed only their Metro development client is active and paused photo changes. Revalidated fresh backup hashes, current compatible served bundle, migration checksum and live prerequisites; applied ONLY property_media_versioned_management. Actual remote version 20261101180736; local migration is now supabase/migrations/20261101180736_property_media_versioned_management.sql with unchanged SHA-256 adafc6e33bac11448d94738fbb0f6c4f2bb4cd749fa737ced421802459a10b72. Original 20261101172252 was preparation only; do not mark it applied or replay SQL. Supabase already recorded the actual version, so no manual history work is required.

Read-only postchecks confirm all four function ACLs/signatures/search paths, three restrictive policies, metadata rotation trigger, populated UUID versions and all existing photo bindings. Full aggregate fingerprints for listings/photos/verification/ownership match before/after exactly; 11 photos and 2 active/1 archived listings preserved. No live photo mutation or Tier 3/publication change was used for verification. See [deployment ledger](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#milestone-2-deployment-completed-2026-11-02).

Previous NOT DEPLOYED/manual-history instructions describe earlier preparation/preflight only and are superseded here. Existing tests remain 971 frontend/38 local PostgreSQL; not rerun for filename/docs-only alignment. Current verification query/README/path references use actual remote filename. No application code or approved SQL bytes changed. No commit/push/merge/build occurred. Milestone 3 was not started in this deployment pass.

Android acceptance after reloading Metro: active and paused listing -> Manage property photos -> upload JPEG/PNG/WebP, set cover, reorder, edit description, remove/confirm replacement cover; reopen and verify retained state/status. Test active completeness-breaking removal is rejected before file deletion, interrupted upload/delete with Check saved photos and no duplicates, stale competing operation, Back/Stay/Leave and account change. Verify listing/property UUIDs, original publication time and property-specific Tier 3 remain unchanged. Restore-test/Storage-file-backup limitations remain as documented.


## Photo management grid refinement (2026-11-02)

Scope: focused replacement of repeated full-width photo/button stacks. Prior Milestone 2 uncommitted source/test/docs and deployed 20261101180736 were preserved. New component PropertyPhotoGrid.tsx owns presentation geometry/gesture/scroll/animation only; pure PropertyPhotoGrid.ts owns drop/move calculations. PropertyPhotosView.tsx owns grid/detail composition. Existing propertyPhotoWorkflow owns selected detail, dirty description preservation, serialized drop-save and recovery; service uses one exact-target reorder_cover RPC. No View backend calls, new client, dependency or navigation framework.

Files added: src/features/property-listing/components/PropertyPhotoGrid.tsx; src/features/property-listing/models/PropertyPhotoGrid.ts; tests/propertyPhotoGrid.test.ts; supabase/migrations/20261102021812_property_photo_order_cover_atomic.sql; supabase/tests/verify_property_photo_grid.sql. Files modified: services/propertyPhotoService.ts, viewModels/propertyPhotoWorkflow.ts, viewModels/usePropertyListingViewModel.ts and views/PropertyPhotosView.tsx under the feature; tests/propertyPhotos.test.ts; tests/propertyWorkspacePresentation.test.ts; supabase/tests/run_property_media.py; supabase/test-support/README.md; the existing feature/history/ledger documents.

User explicitly approved preparing/testing the narrow follow-up after inspection proved existing reorder does not update cover. No deployment approval for it was given, and none occurred. New migration replaces ONLY the versioned media command plus transactional cover normalization/unchanged restricted EXECUTE. Existing direct-write revocations, ownership, immutable Storage lifecycle, property gate, CAS, receipts and completeness remain. New action fails safely on old server; no reorder-then-cover workaround. All legacy managed mutation paths preserve first-cover after the follow-up, including explicit cover compatibility. Existing SQL files were not modified.

Test evidence: missing grid model/API regressions exposed absent functionality; metadata request-count test failed 15 vs 7 before optimization. Added focused geometry/drop/no-op/duplicate/stale/detail/description/removal/Back tests, presentation bindings, exact atomic service payload and old-server safe rejection. Unsaved description loss during reorder and hidden stale detail after removal reconciliation were reproduced before correction. Backend tests failed against old action handling, then 45 pass after local follow-up, including real two-session CAS and legacy normalization preserving all non-cover photo fields and listing content/status/publication time.

Final frontend: npm run typecheck PASS; npm test 990 total / 990 passed / 0 failed / 0 skipped / 0 cancelled. Local PostgreSQL 17 media tests: 45 passed / 0 failed; plpgsql_check reports no errors for the changed command. These are local fixture tests, not live mutation acceptance. No new packages; no native build required by this JS-only UI change.

Performance evidence: metadata-list network chain 15 -> 7 requests in executable service harness; measured fresh emulator metadata 1017 ms with 7 requests. Warm images 0-27 ms. No before/after Android latency comparison or claim of lower network bytes. Lazy images/native downsampling reduce unnecessary rendering/decoding; Free plan cannot provide the Pro image-transform endpoint, so original network image delivery remains an explicit limitation. Safe [PHOTO-PERF] records only stage/duration/result/request count, no URLs/IDs/addresses/credentials.

Read-only emulator inspection found an unsupported grip glyph, replaced with six native dots. An initial detail tap used a stale Fast Refresh workflow; no speculative business workaround was added. After user confirmed no unsaved app work, an authorized app restart/reopen of the Metro dev link loaded fresh methods; detail and Back worked. Earlier ambiguous emulator taps were rejected by automatic approval review before execution; explicit safe-reload authorization resolved that check. No app data was cleared or real photo mutation performed.

Follow-up remains PREPARED / LOCAL-TESTED / NOT DEPLOYED. Historical Milestone 2 remains deployed. Current cover flags may be non-first until the new migration is separately authorized and applied. See the living feature document for Android acceptance. No permanent live backend mutation was performed in this phase. No commit, push, merge, deploy, build or unrelated feature work occurred.

Skills applied/read in this conversation: all eight repository RentLease engineering SKILL.md files; Impeccable with PRODUCT/DESIGN context and product reference; test-driven-development; systematic-debugging; verification-before-completion. Existing approved implementation architecture was reused without a new architecture phase.

Final grid checks: working/staged git diff --check PASS; new-file whitespace PASS; 3 new-section local links PASS; deployed SQL checksum and protected configuration/verification/maps/deployed editing SQL unchanged. Only the disposable --rm rentlease-media-test-grid container was stopped after validation; local fixtures discarded, no live cleanup. Existing uncommitted work remains.

## Atomic photo-order deployment attempt (2026-11-02)

Conditional authorization checked against exact reviewed SQL SHA-256 ffdbc31f63b37d0213ba99e198292f021fb2377ed0ad86375686eac56b0da99d. Prior migration deployed/new migration absent; fresh live counts 10 photos, 2 active/1 archived listings. Read-only ownership/CAS/receipt/ACL/trigger inspection completed. Fresh recovery export failed before producing any file because Docker Desktop Linux engine was unavailable. Deployment STOPPED; no apply_migration, SQL modification, migration rename/history change, live photo operation or post-deployment success claim. See [complete preflight evidence](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#atomic-photo-order-deployment-preflight---blocked-2026-11-02). Existing approved migration and application code unchanged. No permanent live backend mutation was performed in this phase.

Documentation-only validation: working/staged git diff --check PASS before this entry; rerun after documentation updates. No frontend/PostgreSQL tests rerun because no application or SQL changed. Skills read: all eight .codex/skills/rentlease-*/SKILL.md files (feature-implementation, frontend-mvvm-guard, supabase-contract-guard, security-review, test-runtime-verification, documentation-maintainer, implementation-ledger, implementation-artifact-organizer), plus installed supabase/SKILL.md. No commit/push/merge/build. Remaining client/runtime and recovery prerequisites must be rechecked on resume.

## Atomic photo-order deployment completed (2026-11-02)

Previous blocked attempt is historical. Current recovery exports were successfully created and SQL-structure verified at C:/RentLease-Backups/photo-grid-predeploy-20261102-101513; no restore test or Storage-file backup. Connected Supabase apply_migration succeeded against cxfsbwbwmwmgtqfonqth using only the reviewed complete SQL. Actual history: 20261102021812_property_photo_order_cover_atomic. Local file renamed from preparation version 20261101183628 to supabase/migrations/20261102021812_property_photo_order_cover_atomic.sql; bytes unchanged, SHA-256 ffdbc31f63b37d0213ba99e198292f021fb2377ed0ad86375686eac56b0da99d. The SQL header records historical preparation status and was deliberately preserved. No earlier migration replay/history repair.

Read-only postchecks passed: new action, exact signature, authenticated EXECUTE only, restricted search path, ownership/CAS/receipt branches, existing version trigger and completeness routines. Zero first-cover/count violations; 10 photos / 2 active / 1 archived listings. Before/after fingerprints match for photo rows excluding intended cover flags, complete listings, verification submissions, property identity and Storage metadata. No actual photo action was invoked. New client and existing versioned actions remain compatible; stale tokens must reload normally. Prior 990 frontend/45 PostgreSQL passes are implementation evidence, not rerun in this deployment-only pass.

Changed only migration filename, three continuous records, test-support/test-runner migration paths and read-only verification comment. Existing uncommitted application work preserved. See the corresponding backend ledger for exact source action, hashes and backup details. Android: reload Metro; reopen photo manager; drag first/middle/last, reopen and confirm order/cover; test accessible moves, description, add/remove, version conflict, interruption/recovery and completeness rejection. Check listing status/Tier 3 unchanged. No live mutations were used for verification, no commit/push/merge/build.

Skills read: all eight repository .codex/skills/rentlease-*/SKILL.md files (feature-implementation, frontend-mvvm-guard, supabase-contract-guard, security-review, test-runtime-verification, documentation-maintainer, implementation-ledger, implementation-artifact-organizer), installed Supabase, using-superpowers and verification-before-completion.
Deployment final checks: working/staged whitespace PASS; 77 local documentation file links checked / 0 errors; repository search found no old migration-path references; PostgreSQL runner syntax/path PASS. Existing application tests were not rerun because this pass changes no application logic or SQL bytes. Remote history entry reconfirmed once; no history repair required.

## Milestone 3 routine-property editing plan (2026-11-02)

Reuse approved Milestone 1 allowlist and existing property edit_version. Implement typed owner-context/update/receipt RPCs, private operation receipts, token rotation for property/private-access/amenity writes, and a tenancy property-gate trigger with accepted property-version evidence for new/reconfirmed open tenancies. No identity revision or tenancy UI. Preserve identity, approvals and listing statuses; check all active/paused listing completeness at transaction end. Reuse creation validation and ListingField/ChoiceChip/scaffold controls in a dedicated saved-property mode, with generation guards, durable uncertain markers, explicit reconciliation/conflict reload and existing navigation confirmation. Tests first for validation/workflow plus isolated PostgreSQL authorization, tenancy races, rollback and preservation. Migration prepared only, no live mutation or deployment. Existing uncommitted media work preserved.

## Milestone 3 routine-property editing implementation (2026-11-02)

Scope: approved Milestone 1 routine policy only. New local migration 20261102044416_property_routine_details_update_and_tenancy_guard.sql is NOT DEPLOYED. SHA-256 3a20922b145350a22550eea58924fc764bbc743e7ffa94c7f709b91b0e564453. Existing uncommitted architecture/media/grid work was preserved, including deployed media/atomic-cover SQL and independent earlier changes. No Stage 4 identity editing, listing reactivation, 360 or role-system changes.

Added source: models/PropertyRoutineEdit.ts, services/propertyRoutineService.ts, services/propertyRoutineDependencies.ts, viewModels/propertyRoutineWorkflow.ts, views/PropertyRoutineEditView.tsx under src/features/property-listing. Modified models/PropertyListing.ts and listingNavigation.ts, the composed ViewModel, existing composer/details/status/flow Views and ComposerPropertyFields summary copy. Existing shared controls, creation validation and field-focus/navigation-confirmation logic are reused. database.types.ts adds only the prepared RPC structures and nullable tenancy accepted-version column, preserving earlier changes. Before migration deployment the new editor fails closed with an explicit awaiting-migration message; portfolio and existing listing/media paths do not depend on these new RPCs.

Backend: typed routine allowlist, owner/Tier 1/role checks through existing private lock_owner, property UUID compare-and-swap, private input-bound receipts and explicit read-only reconciliation. Property/private/amenity changes rotate edit_version; media_version remains independent. Amenity additions precede removals and physical changes to avoid transient loss of completeness during a valid full-set replacement; retained details are not erased. All active/paused completeness checks use existing backend formula and transaction rollback, never status changes. No official identity fields are accepted.

Tenancy release dependency resolved locally: live inspection found no tenancy RPC and no property gate in existing validation/synchronization triggers. New BEFORE trigger serializes all tenancy writes with property edits, requires accepted_property_edit_version for new/reconfirmed open tenancies and rejects property/listing reparenting. Open states are proposed/pending_confirmation/active; ended/cancelled allow material corrections. Existing acceptance evidence is left null rather than backfilled as historical consent. Existing validate_tenancy and sync_listing_from_tenancy are preserved; local fixture models their relevant columns, not the whole tenancy application. Future trusted tenancy writers must provide accepted version evidence. User-requested active/paused completeness protection is enforced even though the historical shared trigger only rejects active scores below 80%.

Tests: new tests/propertyRoutineEdit.test.ts; actual ViewModel/navigation regressions in propertyExitGuard.test.ts; presentation tests in propertyWorkspacePresentation.test.ts; feature-local composition allowlist addition in marketplaceWiring.test.ts. The initial missing routine implementation failed before code was added. Local SQL compilation exposed a RAISE percent escape, and regression execution exposed an ambiguous nested amenity alias; both were corrected locally before final validation. No live workaround was attempted.

Added backend test assets: supabase/test-support/property_routine_schema.sql; supabase/tests/run_property_routine.py; supabase/tests/verify_property_routine_deployment.sql; updated existing test-support README with reproducible disposable commands. Local fixtures only, no real properties, coordinates, documents or actual Storage files. Two-session tests cover edit-first/stale-tenancy, tenancy-first/material-edit denial and same-version competing edits. Tests also verify owner/account/Tier 1 authorization, numeric/floor rules, idempotency, active/paused rollback, agreement/identity/listing/photo/Tier 3 preservation and media/property token separation.

No permanent live backend mutation was performed in this phase. Only SELECT-only contract inspection occurred against RentLease; the ledger records it. Migration remains for review/approval/deployment; do not replay any deployed migration. No commit, push, merge, deployment or build. Android acceptance is pending this new backend deployment; preceding photo-grid Android success was user-reported and preserved.

Skills actually read/applied: all eight repository RentLease SKILL.md files (feature implementation, MVVM, Supabase contract, security, testing/runtime, documentation, ledger, artifact organizer); installed Supabase, brainstorming, writing-plans, test-driven-development, Impeccable with PRODUCT/DESIGN context and product reference, verification-before-completion. The already approved architecture/request served as the design; the plan stayed in this continuous history, with no new standalone report or commit.

### Milestone 3 final local evidence

- npm run typecheck: PASS, exit 0.
- npm test: 1014 total / 1014 passed / 0 failed / 0 skipped / 0 cancelled, exit 0 (24 additions over 990).
- Local PostgreSQL routine suite: 57 passed / 0 failed, including owner-context/private allowlist, actual two-session races and zero plpgsql_check findings for the update RPC.
- Existing media suite with routine triggers installed: 45 passed / 0 failed. These use fixture rows, not actual Storage HTTP or live data.
- Documentation: 82 local links/anchors checked / 0 errors. Protected deployed media/atomic SQL hashes unchanged; package/config/creation/verification/maps and deployed listing-edit migrations untouched. No dependencies/native rebuild.
- Working/staged whitespace checks passed; rerun after final documentation update. Prepared migration SHA-256 remains 3a20922b145350a22550eea58924fc764bbc743e7ffa94c7f709b91b0e564453.
- Cross-workflow exclusion uses live routine workflow state, not a captured screen value. Confirmed exits clear the private editor snapshot; explicit conflict reload captures its exact property ID before that cleanup. Saving blocks ordinary Back/Close; detached/unmounted results cannot populate another workspace and pending journals survive uncertain outcomes.
- The one ephemeral no-volume PostgreSQL container created for this task is stopped after checks. No live fixtures or property mutations to clean up. Local implementation and essential automated behavior verified; deployment and physical Android acceptance remain pending. No live database mutation, commit, push, merge, deployment or build.

## Milestone 3 deployment completed (2026-11-02)

Authorized controlled deployment to cxfsbwbwmwmgtqfonqth. New actual remote history version 20261102044416_property_routine_details_update_and_tenancy_guard; original preparation timestamp 20261102040726 is historical only. Local migration renamed to actual version; SHA-256 3a20922b145350a22550eea58924fc764bbc743e7ffa94c7f709b91b0e564453 unchanged, and remote history statement exactly equals reviewed SQL. Existing deployed migrations were not replayed; all 17 prior versions/names and statement content match local history modulo whitespace/statement terminators. No history repair needed.

Preflight inspected frontend sources, database routines/triggers/grants/policies, no cron table, and both deployed Edge Function sources. No existing tenancy writer needing cutover found; current table has zero rows. authenticated/anon lack tenancy mutation grants; existing validation/listing synchronization triggers remain in place. Future privileged writers must supply accepted_property_edit_version for new/reconfirmed open tenancies. No assumption that arbitrary out-of-repository privileged jobs have been exhaustively inventoried.

Fresh verified CLI exports outside the repository: C:/RentLease-Backups/milestone3-predeploy-20261102-124106. Schema/data/roles commands exit 0, manifest hashes recorded, deployed Stage 1/2/media/atomic contracts present. Recovery limitations remain: restore not tested, Storage files separate, CLI managed-schema exclusions/separate snapshots and existing circular messages FK restore warning.

Connected apply_migration returned success:true. Three new public jsonb RPCs have the reviewed signatures, SECURITY DEFINER, pg_catalog search_path and authenticated-only EXECUTE. Private detail_receipts has RLS and no client access. Four new triggers enabled, property versions populated, nullable tenancy accepted-version column has no fabricated default/backfill. Owner helper and all completeness routine hashes unchanged. Full before/after data fingerprints match, preserving property/listing IDs, private data, amenity/photo associations, listing content/status/publication timestamps and Tier 3 records. No real mutation RPC or tenancy/property test data used. New receipt table remains empty. Detailed hashes/action provenance are in the continuous backend ledger.

Fresh validation: npm run typecheck PASS; npm test 1014 total / 1014 passed / 0 failed / 0 skipped / 0 cancelled; local PostgreSQL routine regression suite 57 passed / 0 failed. Live checks are read-only catalog/data comparisons; owner rejection, stale-version, tenancy race and completeness denial behavior was exercised locally, not by mutating actual records. Earlier media 45-test pass remains prior implementation evidence, not rerun in this deployment pass. No application logic changed; only local migration naming/current documentation references reconciled. Android acceptance remains pending.

Security advisor comparison: existing anon-definer (25), mutable-search-path (1) and leaked-password-protection (1) warnings unchanged. Authenticated-definer findings increase 42 -> 45 for the three intentionally authenticated-only controlled APIs; private RLS-without-policy info 2 -> 3 for default-deny detail_receipts. Catalog confirmed auth-only public function execution and postgres-only private table/helper access; no permissions were relaxed to silence advisories. No unrelated remediation, role-system change, identity correction, listing reactivation, commit, push, merge or build.

Skills read/applied in this conversation: all eight repository RentLease SKILL.md files (feature implementation, MVVM, Supabase contract, security, runtime testing, documentation, implementation ledger, artifact organizer), installed Supabase and verification-before-completion. Existing implementation/design evidence was reused; no new architecture phase.

Deployment final checks: working/staged git diff --check PASS; 85 local documentation links/anchors checked / 0 errors; no stale preparation-filename references. Current migration hash matches reviewed SQL and remote stored statement exactly. Existing uncommitted application work preserved; only migration filename and current documentation references/status changed in this deployment pass. Disposable local regression container stopped; no live data cleanup or rollback performed. Android acceptance remains pending.

## Listing management and meaningful-save cleanup (2026-11-02)

Scope: frontend UX only, existing branch/uncommitted work preserved. User-reported normal Milestone 3 Android editing PASS predates this cleanup. New cleanup acceptance remains Android RUNTIME-UNVERIFIED. No Supabase interaction, SQL, migration, authorization, completeness formula or role-system change.

Root causes: Published/Manage mixed physical editing with listing lifecycle; routine dirty used raw JSON and Save did not test dirty state; existing listing Save similarly lacked meaningful-change gating. Added payload-aligned content comparisons (numeric representations, optional blanks/nulls, trimmed text, sorted copies of amenity IDs). No deduplication/invalid-value coercion, arbitrary rounding or loss of intentional edits. Zero remains distinct from null. Routine workflow excludes no-op writes at the action boundary; existing saved listing VM does likewise, keeping first-draft creation/pending-photo recovery behavior intact. Confirmed saves reset the authoritative baseline, not merely a local success flag. Conflicts/uncertainty still block writes until their existing explicit recovery paths complete.

Manage Listing exposes Edit Listing alongside existing status/publication/lifecycle actions. Edit Listing groups Property Details and Property Photos, opening the established editor/grid. History records management as the return destination; initial loading Back is generation-invalidated and returns there. Internal property Back/reload uses the same confirmation mechanism scoped to property edits, retaining unsaved listing fields. Actual external exits still guard/discard the workspace. Independent property editing remains on property-only/non-editable-listing My Listings cards and existing composer entry points.

Files modified under src/features/property-listing:
- models/PropertyRoutineEdit.ts, models/PersistedListingDraft.ts, models/ListingPublication.ts.
- viewModels/propertyRoutineWorkflow.ts, viewModels/usePropertyListingViewModel.ts.
- views/PublishedListingStatusView.tsx, views/ListingDetailsView.tsx, views/PropertyRoutineEditView.tsx, views/PropertyListingFlowView.tsx, views/PropertyDashboardView.tsx.
Tests updated: tests/propertyRoutineEdit.test.ts, tests/propertyExitGuard.test.ts, tests/propertyWorkspacePresentation.test.ts and tests/propertyPhotos.test.ts. The old direct-management photo source assertion intentionally now verifies the route through Edit Listing to the same manager. No prior security/recovery test was removed. Documentation: existing living feature/history/ledger only; no new report.

Tests first reproduced raw-number dirty=true, missing canSave gating, and missing management-editor path. Final npm run typecheck PASS; npm test 1027 total / 1027 passed / 0 failed / 0 skipped / 0 cancelled (13 additional cases over 1014). Coverage includes active/paused Manage->Edit->tools->Back, Back during hydration, preserved listing edits across property discard/reload, unchanged/reverted/invalid draft saves, post-confirmed published-save cleanliness, amenity ordering, numeric/null/text normalization, lifecycle button routing and independent property-only access. These are controlled frontend regressions, not new Android runtime acceptance or live RLS tests.

Protected review: deployed routine migration SHA-256 3a20922b145350a22550eea58924fc764bbc743e7ffa94c7f709b91b0e564453 and atomic photo SQL ffdbc31f63b37d0213ba99e198292f021fb2377ed0ad86375686eac56b0da99d unchanged. No service/RPC/persistence-contract, dependency/config, deployed SQL, verification, maps, lifecycle implementation or generated-type edits in this cleanup; earlier uncommitted generated-type/media changes remain preserved. No backend test rerun needed because backend SQL is unchanged. No permanent live backend mutation was performed in this phase. No commit, push, merge, deploy or build.

Skills read/applied: repository rentlease-feature-implementation, rentlease-frontend-mvvm-guard, rentlease-test-runtime-verification, rentlease-documentation-maintainer, rentlease-implementation-artifact-organizer, rentlease-security-review, rentlease-supabase-contract-guard and rentlease-implementation-ledger SKILL.md instructions from this conversation; installed brainstorming, test-driven-development, Impeccable/product context and verification-before-completion. Existing approved design/request guided this focused cleanup without new infrastructure.

Cleanup final checks: working/staged git diff --check PASS; documentation local-link/anchor validation 86 checked / 0 errors. Existing deployed SQL hashes retained. Full final frontend snapshot remains typecheck PASS and 1027/1027 tests passing. No native/runtime acceptance was performed for this cleanup and no live backend interaction occurred.


## Milestone 4 identity-correction foundation and legacy exception (2026-11-02)

Status: IN PROGRESS, NOT DEPLOYED; not a Milestone 4 completion or Android acceptance claim. Preserve preceding uncommitted Milestone 2/3, listing-management and meaningful-save changes. Reuse the approved integrated architecture; no new architecture approval cycle or separate report.

User explicitly chose to quarantine the legacy approved test property's missing private identity rather than fabricate a bootstrap binding. Property `52897654-d4f8-405e-b11e-44e57b4b4007` retains its Tier 3/history and requires identity-data repair. The same data-quality rule covers incomplete unverified records. No live data was repaired, approval changed, submission created or property operation invoked. No permanent live backend mutation was performed in this phase.

Local added foundation: `src/features/property-listing/models/PropertyIdentityCorrection.ts` and `tests/propertyIdentityCorrection.test.ts`. Candidate validation reuses creation rules, keeps routine total floors for floor consistency, requires same-asset attestation, rejects relocation/split/merge/different-unit requests, requires renewed location confirmation for address/location changes, and maps only identity fields. Data repair detection is pure and grants no ownership or verification authority. These helpers are not yet wired to a screen/service, and do not claim deployed enforcement.

Remaining implementation sequence: private immutable revisions and explicit repair classification; eligible baseline observations and current revision binding; owner versioned candidate/cancel/read-only recovery; frozen revision-bound proof submission/finalization; Admin comparison and token-aware atomic promotion; current-binding publication safeguards; shared owner map/Tier 3 integration; PostgreSQL authorization, tenancy, concurrency, completeness and preservation tests. Keep approved canonical identity unchanged while corrections are pending. Future deployment remains separately authorized, never automatic.

Live inspection provenance is in the existing backend ledger. No real mutation tests were performed. No new dependency, native build, commit, push, merge or deployment. The zero-byte migration placeholder generated during inspection is not a reviewed migration and is removed rather than presented as deployable SQL. Full Milestone 4 backend/frontend behavior and Android acceptance remain outstanding.


Foundation validation: npm run typecheck PASS (exit 0); npm test 1037 total / 1037 passed / 0 failed / 0 skipped / 0 cancelled (exit 0). These include 10 identity-domain tests; the missing implementation first failed before local helpers were introduced. Working/staged git diff --check PASS; 85 local Markdown references/anchors checked / 0 errors. No Milestone 4 PostgreSQL contract exists yet, so no backend-test/deployment claim. Skills read in this conversation: all eight repository RentLease SKILL.md files (feature implementation, MVVM, Supabase contract, security review, test/runtime verification, documentation maintainer, implementation ledger, artifact organizer), plus brainstorming, writing-plans, TDD, verification-before-completion, Supabase and Impeccable. Existing source/verification/maps/deployed SQL are preserved. Remaining full-protocol implementation is not blocked by the resolved legacy-policy decision.


## Milestone 4 identity correction implementation (2026-11-02)

Actual local implementation, superseding the earlier foundation-only stopping point. Existing branch and all preceding uncommitted work preserved. Migration `supabase/migrations/20261102081459_property_identity_revision_verification.sql` remains LOCAL / NOT DEPLOYED. SHA-256 `42211a15485329b0783e128bb81d01373e9d749568d76085b3e0f097088e834c`. No permanent live backend mutation was performed in this phase.

Backend implemented: private immutable revision/current-binding/repair/correction/receipt storage; safe observation bootstrap and explicit legacy exclusion; automatic unverified creation snapshot; versioned owner proposal/cancel/read-only recovery; exact-revision Tier 3 start/resume and uploaded-proof finalization; frozen proof and readiness-gated existing Admin queue; Admin current/proposed comparison, CAS and atomic approval/rejection; canonical consistency guard; current-binding publication predicates; accepted identity revision evidence for future tenancy confirmations. No new listing status, lifecycle transition, owner transfer or invented property identity field. Existing `total_floors` remains routine. Open tenancy states reuse proposed/pending_confirmation/active and the existing advisory property gate.

Frontend added: `services/propertyIdentityService.ts`, `services/propertyIdentityDependencies.ts`, `viewModels/propertyIdentityWorkflow.ts`, `views/PropertyIdentityEditView.tsx` under `src/features/property-listing`; shared pure `src/shared/models/PropertyIdentity.ts`. Extended the existing identity model/domain tests. Modified the composed property VM, screen/navigation model, existing PropertyRoutineEditView/FlowView and shared-in-feature PropertyLocationToolView wrapper; reused actual map/geocoder workflow, not another map algorithm. No routine form duplication. Property summary refresh uses authoritative routine context after returning. Save/retry/cancel carry exact property/request versions and retain account-scoped unresolved markers without storing private form content.

Existing Tier 3 model/service/workflow/ViewModel/View now use controlled start/finalize, revision-aware target reads and explicit incomplete/terminal recovery. Existing Admin model/service/queue/ViewModel/View now carry comparison context, expected versions and same-property evidence confirmation. Tier 2 uses the unchanged original review implementation behind its compatible wrapper. Generated database structural types add prepared RPC signatures and new public metadata/accepted-revision columns only; no live regeneration claim. New migration is required before new correction/proof mutation calls can work.

Tests added: `tests/propertyIdentityService.test.ts`, `tests/propertyIdentityWorkflow.test.ts`; extended `tests/propertyIdentityCorrection.test.ts`, actual composed-hook navigation in `propertyExitGuard.test.ts`, `adminReview.test.ts`, Tier 3 service/workflow tests, and service-composition allowlist in `marketplaceWiring.test.ts`. Old Tier 3 direct-insert expectations were replaced with precise controlled RPC assertions while preserving ownership, safe errors and no-unrelated-write assertions. Native presentation stubs include the new screen; real hook/workflow logic remains exercised. No regression was removed to hide a production failure.

Database evidence: `supabase/test-support/property_identity_schema.sql` contains synthetic data contracts, PostGIS and extracted existing verification/publication function definitions, never production data or dumps. `supabase/tests/run_property_identity.py` self-initializes a no-volume/no-port disposable database and asserts 50 protocol cases, including actual two-session correction contention and promotion-versus-tenancy consent, coordinates/address atomic promotion, cancellation/rejection/resubmission, object freeze, owner/Admin denials, legacy exclusion, CAS, canonical bypass denial, routine/media compatibility, listing/history/photo preservation, and zero plpgsql_check findings for both mutation APIs. Existing verification validation, timestamp and profile-refresh triggers are installed in the fixture. `verify_property_identity_deployment.sql` is read-only future verification, not an applied action. Existing media 45-check and routine 57-check suites also pass independently. An initial regression-container initialization restart interrupted setup; the run was not counted as a pass, and stable initialization was awaited before successful rerun. No application workaround was introduced.

Deployment compatibility: separately review/authorize only this migration after fresh backup and live preflight, including actual proof objects and exact existing queue/publication definitions. Coordinate client cutover because legacy Tier 3 direct writes become unavailable; current RPC-driven client must be loaded. Future privileged tenancy writers require accepted property and identity revisions. Bootstrap backfill can refresh verification/profile updated_at through existing triggers but preserves original review/submission dates and decisions. Prior Stage 1/2/media/atomic/routine migration hashes remain exactly unchanged. No automatic deployment/history entry or timestamp reconciliation occurred.

Skill files read in this conversation: `.codex/skills/rentlease-feature-implementation/SKILL.md`, `.codex/skills/rentlease-frontend-mvvm-guard/SKILL.md`, `.codex/skills/rentlease-supabase-contract-guard/SKILL.md`, `.codex/skills/rentlease-security-review/SKILL.md`, `.codex/skills/rentlease-test-runtime-verification/SKILL.md`, `.codex/skills/rentlease-documentation-maintainer/SKILL.md`, `.codex/skills/rentlease-implementation-ledger/SKILL.md`, `.codex/skills/rentlease-implementation-artifact-organizer/SKILL.md`; installed brainstorming/writing-plans/TDD/verification-before-completion/Supabase/Impeccable with existing product/design context. Approved integrated architecture was reused. No separate report/architecture approval cycle, dependency, role revamp, listing reactivation implementation, commit, push, merge, deployment or build. Milestone 4 is not complete until approved deployment and physical Android acceptance pass.


### Final local validation and read-model checks

- npm run typecheck PASS, exit 0; npm test **1060 total / 1060 passed / 0 failed / 0 skipped / 0 cancelled**, exit 0. No native/live runtime success inferred.
- Existing PostgreSQL suites: media **45 passed / 0 failed**; routine **57 passed / 0 failed**. Final identity suite outcome is recorded below after the final SQL run.
- My Listings now batches current-binding/repair status via `get_owned_property_identity_statuses`; absent RPC preserves actual portfolio rows and shows binding-check-pending history rather than claiming verification. Non-schema read errors remain visible. Repair cases lose verification/publication actions. Pending corrections do not erase current canonical approval. Current-only verification reads are separate from proposed proof targeting, with an explicit correction entry into the existing Tier 3 Modal.
- Additional files for this distinction: LandlordPortfolio model/service, PropertyVerificationPresentation, PropertyDashboardView, propertyVerificationDependencies/entry workflow and landlordPortfolio tests. No per-listing status queries or private-location portfolio reads were added.
- Final deployment/client behavior is still unverified. No new dependency/native build; no live Supabase action, deployment, commit, push, merge or build.


Final prepared migration validation: **50 PostgreSQL identity checks passed / 0 failed**, exit 0; full frontend **1060 passed / 0 failed / 0 skipped / 0 cancelled**, typecheck exit 0. Documentation validation: **123 local references/anchors checked / 0 errors**. Working/staged whitespace and untracked text-file whitespace checks pass. Five historical deployed migration SHA-256 hashes match their reviewed values; package/lockfile/app/EAS/environment/shared maps/privacy/completeness formula protected diffs are empty. The only bytecode file generated by this task was removed; prior uncommitted files were preserved. The task's disposable no-volume/no-port identity container is stopped after validation, with no live cleanup. SQL is prepared only, no remote history/version entry. Physical Android owner/Admin and Storage HTTP acceptance remains pending after an authorized coordinated deployment.


## Milestone 4 deployment completed (2026-11-02)

Conditional user authorization satisfied; connected apply_migration succeeded on RentLease cxfsbwbwmwmgtqfonqth. Actual remote version 20261102081459_property_identity_revision_verification; original preparation timestamp 20261102060000 is historical. Current migration supabase/migrations/20261102081459_property_identity_revision_verification.sql, SHA-256 42211a15485329b0783e128bb81d01373e9d749568d76085b3e0f097088e834c. Filename and current references reconciled with no reviewed SQL-byte changes, no historical replay or migration-history repair. Stored remote statement exactly matches the reviewed source.

Fresh verified schema/data/roles exports at C:/RentLease-Backups/milestone4-predeploy-20261102-160524; all commands exit 0, nonempty expected PostgreSQL content/deployed contracts checked. Restore/Storage-file backup and CLI managed-schema exclusions remain explicit limitations. All 18 prior migrations align after formatting normalization; affected function bodies match the tested baseline. User confirmed the latest Metro client only and paused relevant mutations; Metro availability observed, no older active client reported. No incompatible tenancy writer found; future writers need both accepted version tokens.

Read-only postchecks: 10 current-observation identities, 5 approval bindings, 2 repairs; zero current mismatches, unbound active listings, corrections or receipts. Legacy approved property has no inferred snapshot/binding, remains unverified for binding-dependent operations, and retains its full original approval fields. Full data hashes preserve properties/private locations/listings/status/publication timestamps/photos/amenities/Storage metadata/evidence and original verification decisions/submitted/reviewed dates. Expected bootstrap verification/profile updated_at refresh is excluded only from those metadata comparisons. All 11 public APIs/wrapper have auth-only EXECUTE/pg_catalog paths, five private tables default deny, six enabled triggers/eight restrictive policies/version and unique-index guards. Original Tier 2 review body unchanged. Live evidence is catalog/SELECT only; behavioral mutation/security tests remained local.

Fresh validation: typecheck PASS; frontend 1060 passed / 0 failed / 0 skipped / 0 cancelled; local identity PostgreSQL 50 passed / 0 failed, media 45 passed / 0 failed, routine 57 passed / 0 failed. Source application behavior was not edited in this deployment pass; existing uncommitted implementation preserved. Only filename/current references and deployment records changed. Post-advisor existing anonymous/mutable-path/password warnings remain; ten intended authenticated APIs and five private RLS tables add corresponding documented findings without weakened authorization.

Skills actually read: all eight .codex/skills/rentlease-*/SKILL.md files: feature-implementation, frontend-mvvm-guard, supabase-contract-guard, security-review, test-runtime-verification, documentation-maintainer, implementation-ledger, implementation-artifact-organizer; installed Supabase and verification-before-completion guidance. No new design/implementation stage, dependency, commit, push, merge, EAS build or role-system work. No real property correction, Admin decision, proof mutation or lifecycle call was performed for verification. Milestone 4 backend is DEPLOYED; physical Android owner/Admin/recovery/legacy and existing-feature acceptance remains RUNTIME-UNVERIFIED. Full milestone completion is not claimed.

Deployment final checks: typecheck PASS; 1060 frontend tests and 50 identity/45 media/57 routine PostgreSQL checks passed with zero failures; 125 documentation references/anchors checked with zero errors. Working/staged whitespace checks pass after correcting the deployment entry EOF. The tracked SELECT-only verification script executed successfully against the authorized live project and reconfirmed history 20261102081459. Task-owned disposable test containers were stopped; no live cleanup occurred. Existing uncommitted app work remains preserved, and no commit/push/merge/build was performed. Android runtime acceptance remains pending.


## November 7, 2026 - Owner request entry

My Listings property cards now expose compact real UC-09 counts and Manage Requests via root composition. Historical listing IDs keep viewing requests with their physical property; reservations use property_id. Existing listing creation/edit/publication/verification actions remain. Account-scoped bounded participant reads never report truncated totals; unavailable counts show a neutral management entry. Existing viewing/reservation workflows perform all writes; close refreshes summaries. 338 focused tests, TypeScript and whitespace pass; Android acceptance pending. No backend change or deployment. Full contracts/evidence are maintained in MESSAGING_VIEWING.md and its UC-09 implementation history/ledger.

## Local creation-input fidelity - November 8, 2026

Related rental-estimation handoff pass changes only new draft count defaults to blank, explicit missing-count guidance and shared nonblocking measurement warnings. Existing saved-property hydration preserves numeric 0; no backfill. Floor area remains optional to save; publication/completeness and identity/tenancy protections unchanged. Valid test fixtures now explicitly supply counts rather than relying on silent defaults; new guard test proves missing counts do not reach RPC and explicit zeros do. All 66 creation tests pass; related 526-test regression run passes and TypeScript passes. Four unchanged presentation tests reproduce against HEAD and remain outside scope. See RENTAL_ESTIMATION_IMPLEMENTATION.md and the handoff audit for non-additive counts, native packaging and schema-only proposal. No permanent live backend mutation was performed in this phase. No commit/push/deployment/build.

## Phase 2A model-compatible property attributes - November 9, 2026

IMPLEMENTED / LOCAL-TESTED / NOT DEPLOYED. Adds optional subtype, lot area and parking entry to property creation and routine editing, with shared strict validation and no fabricated defaults. Marketplace property_type is unchanged. House subtypes and canonical apartment_condominium subtype combinations were verified from pinned Rentlease-Features dee06f16fe182361b1d9d7e6ecf35f41703bf1a6 adapter/metadata. No standalone category is reclassified. Blank means null; explicit 0 remains meaningful. Incompatible draft subtypes can be explicitly cleared. Existing saved fields and profiles require no backfill.

Prepared official-CLI migration 20261109115021_property_model_attributes_v2.sql adds three nullable columns/checks and authenticated-only create_property_setup_v2, update_property_details_v2 and get_owned_property_edit_context_v2. Existing RPC signatures and source/config/owners/grants remain unchanged. V2 editing includes new values in the original lock/version/receipt transaction and freezes them for open tenancies. Canonical identity snapshots/gates, verification evidence, RLS, completeness and asking rent remain unchanged. Column writes are not granted to clients. Old clients preserve new values through legacy RPCs. New clients detect the v2 context; missing v2 cannot silently discard entered attributes. Prepared database.types.ts additions match reviewed SQL, not an already deployed schema.

Validation: 68 PostgreSQL checks passed / 0 failed in a synthetic PostgreSQL 17.6 disposable container (desktop-linux, network none, no mounts/host ports). Tests include source/collision refusal, all group combinations, unknown/zero, owner/Tier1/anonymous/inactive denial, catalog/grant preservation, exact retry/conflict, three tenancy states, a two-session concurrency race, actual canonical identity gate and unchanged verification records, legacy calls and data-retaining rollback. 642 focused frontend/regression checks passed / 0 failed, including 10 new Phase 2A tests; TypeScript, whitespace, Python AST syntax and scoped credential scan pass. Initial frontend failures were harnesses not modeling v2-unavailable reads and pre-existing TSX presentation imports; the fallback/mocks were updated without removing assertions or changing application behavior to pass tests. Temporary validation logs removed; disposable container stopped and --rm removal confirmed. No full-repository test-suite claim or Android acceptance.

Current inference deliberately remains Phase 1: broad subtype fallback; lot_area_sqm, parking_spaces and coordinates null. No RentalPrediction/Edge/Render/trained-artifact changes in this phase, no inferred asking rent updates. Backend-first rollout, schema/type/client compatibility, scoped rollback limitations and Phase 2B/2C are detailed in RENTAL_ESTIMATION_HANDOFF_RECONCILIATION_2026-11-08.md. Android form/save/reopen, keyboard, old/v2 backend behavior, tenancy restrictions and account switching remain pending. No production writes, deployment, secret retrieval, commit, push, merge or build. No permanent live backend mutation was performed in this phase.

Migration LF SHA-256: 66fab33086d02c780ca8cda36ab18a48813751cfffae27d90baad4849235aeca. Rollback LF SHA-256: 9027beb8eb47d73595b4bf7f0e2d033f9d468237de65a5c7e26da662f1fac2dd. Future deployment must verify actual source/payload bytes and baseline again. Read/reused skills: rentlease-feature-implementation, frontend-mvvm-guard, supabase-contract-guard, security-review, ui-ux-design, test-runtime-verification, documentation-maintainer, implementation-ledger, implementation-artifact-organizer and Supabase plugin. The detailed authorized phase scope supplies the implementation sequence; no publishing permission is inferred.

## Phase 2A postdeployment frontend reconciliation - November 9, 2026

Phase 2A schema/RPC deployment independently confirmed as 20261109131034 (28 history rows); migration renamed without SQL changes. Live-generated relevant columns/RPC signatures match prepared types; explicit SQL-nullable Args retained. Existing creation/edit services already bind v2 correctly with legacy compatibility and account/version/receipt protections. Focused frontend tests and TypeScript pass; production caller-JWT write/Android acceptance remain pending. Phase 2B named Edge deployment still requires separate authorization; no deployment/build in this reconciliation. Details: reconciliation audit postdeployment section.

## Phase 2 physical Android acceptance and focused fixes - November 10, 2026

Agent-observed owner create/reopen (user-created draft), studio/35 sqm/unknown lot/parking zero, authorized lot/parking save/reopen, real inline estimate/range/asking-rent separation, legacy unknown-field prediction and unsupported Boarding house gating passed. Two frontend fixes: first hydrated render exposes owner property editing; saved model fields/edit_version now invalidate old estimates. 169 focused regressions, TypeScript and whitespace pass. Final designated test-property attributes: lot 50 / parking 2; asking rent 5,000 unchanged. Different-account tenant inference/denial remains unverified. No deployment/build/commit/push; details and reproduction steps in reconciliation audit.


## Rental price guidance and scoped Phase 2 completion - November 10, 2026

Compact real XGBoost guidance now follows Monthly asking rent. Saved property IDs only; unsaved property shows save-first guidance without creating/publishing anything. Explicit Use estimate fills the local price through the ViewModel, never autosaves or overwrites a price automatically; manual override remains valid. Existing inline details, null/zero, eligibility, safe errors, cancellation and the two physical-test fixes are preserved. Physical owner guidance/adoption/manual override/save/reopen passed; test price restored5000. 545 focused workspace tests, TypeScript and whitespace pass. Cross-account tenant acceptance remains BLOCKED; automated authorization passes. No schema/service/model change or build; final evidence/scope in reconciliation audit.
