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
