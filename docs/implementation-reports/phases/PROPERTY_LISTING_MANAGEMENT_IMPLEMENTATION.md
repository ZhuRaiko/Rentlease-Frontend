# Property & Listing Management implementation history and roadmap

Date: 2026-10-23. Repository: ZhuRaiko/Rentlease-Frontend. Branch: `feature/property-listing-management`. This is the continuously updated feature implementation history/roadmap and phase evidence index, not authorization to begin Phase 3 or mutate the backend.

Authoritative current behavior: [PROPERTY_LISTING_MANAGEMENT.md](../../features/PROPERTY_LISTING_MANAGEMENT.md). Backend actions and external provenance: [backend ledger](../database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md). Read both before future work.

## Phase status

| Phase | Status | Blocker/boundary |
| --- | --- | --- |
| Phase 1 - Physical property creation | IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED | Teammate-owned location integration for actual app save |
| Phase 2 - Ordinary property photos | IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED | Actual saved property UUID is required for Android runtime upload |
| Phase 3 - Listing draft persistence | NOT STARTED | Requires a separate approved implementation task and contract inspection |
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
