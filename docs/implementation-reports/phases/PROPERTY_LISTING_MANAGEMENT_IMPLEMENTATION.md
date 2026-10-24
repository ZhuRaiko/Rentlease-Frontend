# Property & Listing Management implementation history and roadmap

Date: 2026-10-23. Repository: ZhuRaiko/Rentlease-Frontend. Branch: `feature/property-listing-management`. This is the continuously updated feature implementation history/roadmap and phase evidence index, not authorization to begin Phase 3 or mutate the backend.

Authoritative current behavior: [PROPERTY_LISTING_MANAGEMENT.md](../../features/PROPERTY_LISTING_MANAGEMENT.md). Backend actions and external provenance: [backend ledger](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md). Read both before future work.

## Phase status

| Phase | Status | Blocker/boundary |
| --- | --- | --- |
| Phase 1 - Physical property creation | IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED | Teammate-owned location integration for actual app save |
| Phase 2 - Ordinary property photos | IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED | Actual saved property UUID is required for Android runtime upload |
| Phase 3 - Listing draft persistence | IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED | Persisted property UUID/location prerequisite blocks new-property Android save |
| Phase 4 - Publication workflow | NOT STARTED | Requires exact publication/eligibility/backend enforcement contract |
| Phase 5 - Listing lifecycle | NOT STARTED | Requires exact lifecycle transitions and authorization contract |
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

[Ledger Phase 3](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#phase-3---listing-draft-persistence-recorded-2026-10-24) separates Codex's one read-only contract/grant/policy SELECT from external permanent function creation, rollback create/update reuse, foreign/inactive-property denials and advisor findings. External test listing a91d4de0-af56-4cbb-bfc9-a431591f605e did not persist after rollback; reported listings count was zero. Existing inactive Phase 1 fixture remains as previously recorded. No broad listings grants were added. Exact original external DDL/test payload transcripts were not supplied and are not invented. No source-controlled backend migration was created.

Codex performed no live save RPC, backend mutation or test-data creation in this phase. The external permanent FUNCTION_CHANGE is explicitly recorded; it would be inaccurate to describe the overall backend phase as having no permanent change. RLS and the RPC checks remain authoritative. The controlled authenticated SECURITY DEFINER advisory does not justify direct table writes.

### Validation and runtime boundary

npm run typecheck PASS. Full npm test: **373 total, 373 passed, 0 failed, 0 skipped, 0 cancelled**. Added 19 service/workflow/domain tests and three actual ViewModel integrations; pre-existing guard/photo/verification/navigation coverage remains passing. git diff --check PASS. No new dependency/native rebuild is required; existing Expo patch drift is unchanged.

MVVM review: Views contain no direct backend calls; models are pure; service owns typed data access; workflows/ViewModel own form coordination and async state. No duplicate client, cross-feature ViewModel import or new navigation/state framework was introduced.

Android listing persistence is **RUNTIME-UNVERIFIED - blocked by persisted-property prerequisite**. No MapTiler/GPS workaround was added. After the separately owned location feature supplies a saved property, test first save, repeated same-ID update, reload/restart, optional field clearing, invalid terms/dates, local-only incomplete progress, account/ownership changes and network interruption with explicit reconciliation. Confirm status stays draft and there are no publication/lifecycle calls. The recent exit-guard fix still requires user Android re-verification.

### Scope and preservation

All seven teammate-owned features remain untouched: XGBoost, GPS proximity, MapTiler/geocoding, OpenStreetMap nearby places, content-based recommendations, NLP word cloud and 360. No publication, property-specific Tier 3 publication enforcement, lifecycle transition, one-active-listing rule, moderation or publication completeness policy was implemented. The existing local publication preview remains labeled preview-only. No commit, push or merge occurred.

At Phase 3 start the working tree already contained the uncommitted exit-guard bugfix (creation/photo workflow discard helpers, live predicate/shared hook, ViewModel mounted checks, tests and the two feature docs). That work was preserved and extended rather than reset. Backend ledger is updated for actual read-only and user-reported external evidence; no separate Phase 3 report file was created.
