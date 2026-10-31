# Property & Listing Management implementation history and roadmap

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
