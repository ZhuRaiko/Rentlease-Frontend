# RentLease complete context handoff - November 10, 2026

## Start here: instructions for the receiving assistant

This is a continuation snapshot for a new ChatGPT chat, not authorization to implement, deploy, commit, push, build, or access a device. The latest user requested ONLY this Markdown document because the previous conversation exhausted its context. Read this document, acknowledge the current state, and wait for the user's next scoped instruction. Do not resume an old deployment prompt automatically.

The most recent development task was the Tenant Search & Discovery audit. That audit is finished, its straightforward frontend fixes are UNCOMMITTED, and the user explicitly requires review before any commit or push. Preserve all unrelated local work. The current priority is core tenant functionality, not cosmetic redesign.

Standing restrictions: do not access the physical Android phone, run ADB, start Expo, install/build the app, or conduct native testing. The user will test manually. Do not deploy backend changes. Prior phone instructions and acceptance procedures in older documents are historical and do not override this rule.

Evidence labels matter: planned, locally implemented, committed/pushed, deployed, automated-tested, metadata-verified, user-reported, and physically observed are different. Never treat mocks, TypeScript, SQL catalogs, or successful owner inference as proof of hosted caller-JWT authorization or tenant acceptance.

## Project, architecture, and workflow

RentLease is an Android-first Philippine rental marketplace and Computer Science thesis project. The approved frontend stack is React Native, TypeScript, and Expo, with the existing MapLibre/MapTiler integration. Check package.json before relying on exact versions. This repository is frontend-focused; backend SQL and Edge sources retained here do not grant permission to modify production infrastructure.

Required architecture: View -> ViewModel/workflow -> service/data layer -> approved backend or external service. Views must not call Supabase, location, Overpass, or other external clients directly. Use .tsx for UI and .ts for ViewModels, models, hooks, services, and utilities. Reuse the existing root navigation, shared components, theme tokens, cancellation patterns, and account-scoped state. Do not introduce a new router, state library, UI redesign, or unrelated technology.

Before future implementation read AGENTS.md, docs/ARCHITECTURE.md, docs/FRONTEND_CONTEXT.md, docs/FIGMA_WORKFLOW.md, and relevant local skills. Relevant skills are rentlease-feature-implementation, rentlease-frontend-mvvm-guard, rentlease-ui-ux-design, rentlease-supabase-contract-guard, rentlease-security-review, rentlease-test-runtime-verification, rentlease-documentation-maintainer, rentlease-implementation-ledger, and rentlease-implementation-artifact-organizer. The artifact-organizer skill was read for this document-only task. The prior audit read the other listed project skills as recorded in its report.

Maintain one living feature document, one continuous implementation history, and one backend ledger per feature. Record live actions honestly; documentation requirements do not authorize backend writes. Use American English. Prefer rg for searches. Run only necessary focused tests and TypeScript once after future changes, with targeted rechecks only when failures or subsequent changes justify them. Do not repeat broad suites for reassurance. Never expose tokens, passwords, private names, sensitive rows, or exact property locations in reports.

## Repository checkpoint and local work

Repository: C:/dev/RentLease-Frontend
Branch: fix/gps-nearby-results
Origin: https://github.com/ZhuRaiko/Rentlease-Frontend.git
Current recorded HEAD: 5fb6676ab5b115d084b68f933f27f544b98d14c9
The latest six local commits were read again while preparing this handoff. No fresh remote fetch or live backend inspection was performed for this document.

| Commit | Completed work |
| --- | --- |
| 8db5adcf1c681ebe3ba840aa9775f49c09cade86 | Phase 2A optional property attributes and v2 owner contracts |
| 99884e761fc2adcf4a29dfcbbd224b16fba9b25c | Phase 2B inference mapping and disabled Phase 2C preparation |
| 05b04cf841b1bb9094d960cdc1f6347c617bcc62 | Deployed Phase 2A contract/type/filename reconciliation |
| 9b1ea36bcf9f5653374c9daf2702d0f1a90894e8 | Compact rental-price guidance and prior editing fixes |
| c675f1461c99e2e88f46ab65554667c008e42ed7 | Price guidance during FIRST listing creation |
| 5fb6676ab5b115d084b68f933f27f544b98d14c9 | Simplified landlord actions and PREPARED unfinished-post deletion |

These checkpoints were previously reported pushed. Do not reimplement them. The working tree is dirty, with no staged changes at handoff preparation. Remote source alone cannot represent the local audit fixes or existing documentation/reconciliation work.

Uncommitted work includes Search Discovery audit fixes; earlier Discover carousel/ViewModel/tests; recommendation privacy documentation; property deletion backup records; Public Identity and messaging deployment records; UC-09 migration filename reconciliation; .vscode; and deployment verification scripts. Some files contain changes from more than one task. Do not blanket stage, reset, normalize line endings, git clean, force push, or replace whole files from HEAD.

## Latest Tenant Search & Discovery audit

Authoritative detailed report: docs/implementation-reports/audits/TENANT_SEARCH_DISCOVERY_AUDIT_2026-11-10.md. Its November 10 findings supersede older index text that still calls maps or recommendations deferred. Some historical Markdown punctuation displays as question marks due to encoding; this does not change the documented contracts.

| Feature | Implemented and test-backed | Incomplete, missing, or blocked |
| --- | --- | --- |
| GPS Proximity Searching | Foreground permission explanation and one-shot location; integer radius 1-20 km; PostGIS nearest-first public-point distances; active/available listings; pagination, retry, cancellation/account guards; Map/List/detail return state | User-run native permissions/settings, pagination, Back and account-switch acceptance pending. Fresh RPC metadata found no backend contract blocker. Device permission/services/network remain dependencies. |
| MapTiler Maps | Native MapLibre GPS map, public-point markers/prices, clustering, selected preview, radius polygon, camera retention, bounded loading/error/retry and List fallback | Native performance/gestures/cluster expansion and provider/key configuration not exercised. Legacy standalone manual-result/location-map routes are unconnected; the actual GPS map is implemented. Valid public key, style/tiles/glyphs, quota, network, and approved development runtime required. No key values inspected. |
| OpenStreetMap Nearby Places | Automatic shared real-detail widget; four category groups; approximate public origin; bounded 2 km Overpass query; parser, deduplication/distances, attribution, cache/stale labels, timeout/cancellation, bounded fallback/cooldown and Retry | Successful live provider response not established. November 4 errors/timeouts are historical, not proof of a current outage. Public Overpass reliability/rate limits remain unresolved. No directions or POI map feature promised. A managed/shared-cache alternative needs separate scope and backend approval. |
| Content-Based Recommendations | Real authorized candidates, explicit session preferences, deterministic reasons/scoring, local Recommended/Best Match, actual cards/photos/details, availability/account guards | Capped at 100 recent filtered candidates; no global ranking or durable preference persistence. Optional owner Tier 2 signal unavailable because live RPC is absent and privacy review unresolved. Core content matching remains usable with neutral bonus. |
| Saved Listings | Table/model declarations and legacy placeholder actions only | No active Save/Unsave, persisted IDs, saved-results service/workflow, visible saved-results route, pagination or recovery. toggleSaved shows an unavailable notice and isSaved is false. Table has owner RLS and composite key, but authenticated SELECT/INSERT/DELETE and relevant column grants are absent; no saved/favorite/bookmark public RPC found. Needs approved backend access design first. |

Tenant city/barangay suggestions use available Supabase listings, not a missing MapTiler tenant geocoder. The landlord location/geocoding flow is separate. Do not substitute private property points or device GPS for an approved public POI origin.

### Audit fixes awaiting review

1. src/features/search-discovery/services/manualSearchService.ts: optional property_photos enrichment failure no longer rejects an otherwise successful authorized search. Real parsed rental rows remain with null thumbnails. Failed or partial photo URLs are discarded. Account changes, cancellation, and primary listing-query errors still reject safely. This benefits manual search, Discover and recommendation candidates through the existing service. Detail loading is unchanged; photos/amenities remain part of its required transaction.
2. src/features/search-discovery/components/SearchListingCard.tsx: neutral placeholder text is now Photo unavailable.
3. src/features/search-discovery/views/TenantDiscoveryView.tsx: legacy fallback truthfully says Saved rentals are unconnected and directs users to the existing Nearby rentals GPS map. Prior carousel/layout work was preserved.
4. tests/manualSearch.test.ts and tests/discoverHomepage.test.ts: regressions for photo-only failures preserving real rows, account/cancellation rejection, neutral placeholder, and truthful Saved/GPS copy. Existing unrelated tests preserved.

Updated audit records: docs/features/SEARCH_DISCOVERY.md and PROPERTY_RECOMMENDATIONS.md; matching continuous implementation histories and backend ledgers; the separate audit report. Some recommendation records already had unrelated privacy edits.

Validation: 224 focused cases executed across manualSearch, gpsProximity, gpsDiscoveryIntegration, nearbyMap, nearbyPlaces, nearbyRadiusSlider, contentRecommendations, discoverHomepage and searchRuntimeCorrections. 223 initially passed; the sole outdated no-photo copy assertion was corrected and its targeted recheck passed. Do not describe this as a fresh single 224/224 full rerun. TypeScript and whitespace passed. No current GPS, external POI query, MapTiler key value, real account RPC, phone, Expo, build, staging, commit, push or backend mutation. Metadata checks are not hosted RLS acceptance.

### Tenant priorities after user review

1. Agree on an authenticated, caller-scoped Saved Listings read/save/remove contract, active-account rules and inaccessible-listing behavior. Backend change needs separate authorization; then implement real frontend controls/results with duplicate, cancellation, account-change and recovery handling.
2. Establish a successful allowed Nearby Places provider response. If public Overpass remains unreliable, separately approve a provider/cache solution. Keep genuine errors, attribution, generalized coordinates and bounded retries; never fabricate POIs.
3. User manually tests core GPS/map/manual filters/details/Back/permission/account flows. Independent partial-detail retry is a separate resilience task, not already fixed by thumbnail fallback.
4. Resolve Tier 2 recommendation privacy/notice approval before endpoint rollout. Persistent preferences/global ranking are optional product decisions, not prerequisites for existing core ranking. Standalone non-GPS map routes are outside the current core flow.

## XGBoost estimation: current truth

Phase 2A property attributes: implemented and deployed. Phase 2B secure model integration: implemented and deployed. Phase 2C coordinates: preparation only, transmission DISABLED. Recommendations are separate content ranking, not XGBoost.

Pinned model authority is Rentlease-Features commit dee06f16fe182361b1d9d7e6ecf35f41703bf1a6, model_metadata.json, fitted adapter/preprocessing, MODEL_INTEGRATION.md and unchanged reference_predictions.json. November 6 fit train_20261106_140356_301784 uses clean_20261103_145130_022013. The handout cites a different November 3 training run. Its 74.15% within 30%, PHP 13,583.73 MAE and 998 holdout rows must not be attributed to the November 6 artifacts without matched evaluation evidence.

Two fitted groups: house and apartment_condominium; eight numeric inputs, four categorical inputs, 68 amenity labels. Server owns fitted imputation/indicators/encoder and reverses log1p with expm1 once. Explicit combined-group subtype uses canonical apartment_condominium; null subtype preserves legacy broad-parent fallback. House subtypes: house/townhouse/beach_house/villa. Combined: apartment/room/condominium/studio/loft/penthouse/condotel. Standalone room/studio marketplace types are not silently assigned a parent. API allowlists do not prove subtype training coverage.

Optional property_subtype, lot_area_sqm, parking_spaces are nullable with no fabricated zero/backfill. Actual zero persists; invalid/nonfinite/negative data rejects, parking is integral. Optional columns use narrowly constrained missing-column fallback only. Asking rent is never a model input or overwritten automatically. Exact amenity mapping only; Parking does not establish garage/count. Coordinates remain null at runtime and type level. Phase 2C helper always returns transmissionAllowed=false and is not wired to inference.

Live last recorded integration: rental-price-estimate v4 ACTIVE with verify_jwt=true; legacy estimate-rental-price v8 untouched. Caller JWT, Tier 1, RLS, owner draft/public listing, availability, cancellation and duplicate guards remain. No secret/model/Render changes authorized.

Compact RentalPriceGuidance reuses InlineRentalEstimate, its workflow and protected ID-only client. It shows real estimate, validated illustrative +/-30% range (NOT a confidence interval), and optional Use estimate. No automatic call on opening, no automatic asking-rent write. Explicit adoption changes only the guarded editable local field and does not save.

FIRST creation was already fixed in c675f14: Next: Listing validates/saves the physical property through existing recovery-safe creation, adopts its confirmed ID and enters the initial rent composer. No leaving/reopening/publishing or duplicate property is required. Saved creation snapshot supplies eligibility, not draft/private coordinates. Back/Next reuses the existing ID. Existing listing/photo save remains authoritative.

Prior fixes include first-ready continued-draft Edit Property visibility and invalidating inline estimates when saved subtype/lot/parking/edit_version changes. Unsaved attributes do not become model input. Guidance checkpoint had 545 focused tests; initial-creation checkpoint had 305 cases including one corrected targeted assertion; TypeScript passed. These are historical evidence, not fresh execution here.

Historical owner-only HONOR acceptance verified null versus zero, edits, legacy inference, unsupported category and explicit rent adoption/manual override. Designated user-created Building house reservoir final state: Condominium/studio, floor 35 sqm, lot 50 sqm, parking 2, asking rent PHP 5,000. Different predictions demonstrated behavior, not accuracy. Different-account published-listing success and unauthorized-property denial remain physically/hosted unverified. Do not access the phone to close that gap.

Detailed record: docs/implementation-reports/audits/RENTAL_ESTIMATION_HANDOFF_RECONCILIATION_2026-11-08.md and living RENTAL_PRICE_ESTIMATION/PROPERTY_LISTING_MANAGEMENT documents.

## Unfinished property deletion: prepared, NOT deployed

Commit 5fb6676 contains simplified landlord actions and local deletion implementation. Wording includes My Rentals, Post a Rental, Continue Posting, Edit Property and Edit Listing. Continuation uses saved IDs. Prepared migration: supabase/migrations/20261109171826_unfinished_property_deletion.sql. LF SHA-256: b31236727438a189e807bf6d76f832fee5840aa534a5061a89781f38047cad71.

Prepared new Edge: supabase/functions/delete-unfinished-post/{index.ts,handler.ts,README.md}; verify_jwt=true. Models/services/workflow include UnfinishedPostDeletion.ts, unfinishedPostService.ts and unfinishedPostWorkflow.ts; UI includes UnfinishedPostDeletionAction.tsx. Contracts are not executable production features yet.

Deletion is restricted to active verified Tier 1 owners and never-published properties/listings. Any tenancy, reservation, viewing, conversation, report, verification/correction/repair, security audit, relevant notification or unknown direct FK reference blocks eligibility. Reserved/untracked/shared/invalid media paths block deletion. Existing property advisory and row locks, READ COMMITTED checks and monotonic publication history prevent status changes from bypassing guards. No direct client DELETE grants or weakened RLS.

Permanent private registry rentlease_unfinished_posts.records retains tombstones. Four immutable identity/edit evidence FKs are redirected to the registry with live-parent insertion guards; original immutability remains. Do not blindly reverse these FKs after deletion.

Atomic database operation removes eligible property/disposable rows and captures exact owned media in a cleanup queue. State is completed only when no media remains; otherwise cleanup_pending. Edge validates caller identity, invokes caller-JWT RPC and removes only server-queued Storage paths in bounded batches. No caller-controlled owner/bucket/path, no Storage SQL DELETE. Partial or uncertain cleanup never reports full success. Stable property ID and persisted pending cleanup allow retry without deleting another workspace or creating duplicate properties.

Prepared public RPCs: get_unfinished_post_deletion(uuid), list_unfinished_post_cleanup(), delete_unfinished_post(uuid). Service-only worker RPCs: get_unfinished_post_cleanup(uuid,uuid), finish_unfinished_post_cleanup(uuid,uuid).

Evidence: 476 distinct focused frontend cases, 51 isolated PostgreSQL checks, TypeScript/whitespace/credential/syntax checks passed. Real hosted Storage/PostgREST/RLS and native acceptance are NOT established. Rollback cannot recover removed rows/bytes; preserve registry/evidence and reconcile pending cleanup before withdrawing entry points.

Future deployment needs separate explicit approval, fresh baseline/freeze and verified backup, one isolated migration, security/FK/immutability checks, named new Edge deployment, frontend release and authorized acceptance. Do not deploy Tier 2, UC-09, estimation or unrelated SQL as part of it.

## Fresh restricted deletion backup already prepared

Local path: C:/RentLease-Backups/unfinished-property-predeploy-20261109-175419
Timestamp is UTC (Singapore November 10). This backup was prepared for commit 5fb6676, not created again by this handoff task.

Recorded verification: 40 nonempty manifested artifacts; SHA-256 manifest reread verified; restricted ACLs across 53 files/directories including manifest, inheritance disabled, access limited to current Windows user, SYSTEM and Administrators.

Contents: current schema and 105 function definitions; full 28-row migration history; roles plus nonsecret managed-role flags/memberships, permissions/policies/catalog; 15 relevant application tables plus migration history in 16 COPY sections; reviewed source/config blobs and receipts; 18 property-media files totaling 17,675,076 bytes, checked against all remote MD5/sizes and reread local SHA-256.

Application recovery scope covers properties, listings, property photos/amenities/nearby/private-location/price-estimate rows, property-edit media/detail intents/receipts, and identity revisions/current identity/corrections/repairs/receipts. Keep this sensitive backup OUTSIDE Git. Do not print its data or move it into the repository.

Schema/roles/data dump commands exited 0. Installed CLI Storage download was unsupported; read-only HTTPS from an independently verified public bucket downloaded media without credentials. No upload/delete occurred. Before/after metadata, history, selected row fingerprints and media metadata matched. No proposed deletion RPC/schema collision was found.

This is scoped recovery into an existing project retaining Auth/profiles/shared dependencies, NOT a full database/Auth/password/session/PITR backup. Restore of these exact hosted artifacts is untested. Readiness is point-in-time; a fresh immediate baseline and coordinated freeze are still needed before separately authorized deployment. Earlier schema-only ML backup at C:/RentLease-Backups/property-model-attributes-predeploy-20261109-125839 does not replace this deletion recovery set.

## Live Supabase and migration hazards

Project reference: cxfsbwbwmwmgtqfonqth. Last verified history has 28 rows, latest 20261109131034_property_model_attributes_v2. Phase 2A deployed payload matched reviewed source after newline normalization. No deletion migration/Edge deployment occurred. Recommendation get_recommendation_owner_verification RPC is absent.

NEVER use blanket db push, migration repair, manual history edits or replay ADD COLUMN migrations. Unrelated 20261108041628_recommendation_owner_tier2_status.sql remains privacy-blocked. UC-09 is already live as 20261106125046 and 20261106130211; local old filenames appear deleted and reconciled filenames untracked. Preserve this separate reconciliation rather than replaying or relabeling backend history.

Public Identity is already deployed; the old November 7 example's instruction to finish its initial deployment is STALE. The public_profiles security_invoker mitigation was deployed November 8 as 20261108071009, with 89 hosted read-only role-simulation checks passing. Reviewed LF and submitted CRLF SQL differed in raw hash but matched after newline normalization; exact discrepancy remains recorded for review. Do not replay or erase receipts. Consent-based Display Name/avatar and protected identity RPCs must not expose legal/private profile names.

## Wider product state and limits

| Area | Current recorded state and caution |
| --- | --- |
| Authentication/profiles | Real baseline integration, Auth synchronization, consented public identity. Exact revision native/account/avatar lifecycle acceptance remains incomplete. Unified accounts; do not invent separate landlord/tenant account types. |
| Verification/Admin | Tier 2 submission and Admin approval previously user-reported working; correction/recovery, Tier 3 and fullscreen zoom implemented/tested with revision-specific native gaps. Maintain exact-property Tier 3 and private evidence controls. Other moderation areas may remain preview. |
| Property/listing | Real two-stage creation, existing property reuse, photos/drafts/editing/portfolio and protected save/recovery. Publication thresholds, verification, tenancy freezes and immutable evidence remain authoritative. Optional ML fields do not change completeness or force publication. |
| Messaging | UC-08 persistent RPC/Realtime integration deployed. Real Chat avatar/text/property-cover context and full-screen photo/listing preview integrated/tested. Preserve mounted conversation, composer/scroll and nested Back; physical two-account Realtime/keyboard/image acceptance pending. Historical threads must survive unavailable listings with safe context fallbacks. |
| Viewing/reservations | UC-09A/B deployed and metadata/source verified; actual participant-gated workflows, concurrency/receipts and expiry. Viewing is inspection; reservation is a separate commitment. Approval is NOT payment, publication, or automatic tenancy creation. Native positive workflows remain pending. |
| Tenancy | Real read-only upcoming reservations, active tenancies and ended history recorded in living docs. Do not label approved reservations as active tenancies or implement automatic conversion. |
| Ratings/reviews/reports/NLP | Preview/deferred beyond audited integrations. Real eligibility, persistence, moderation/privacy and actual reviews must precede claimed ratings or word clouds. No invented stars, reviews or frequencies. |
| Notifications/maintenance | Preview UI is not proof of persistence, FCM/background delivery, uploads or tenancy-linked workflows. Separate implementation scope required. |
| 360 panorama | Deferred prototype, not reliable accepted real-room capture. Do not let stitching experiments block core rentals or require panorama for publication. |
| Staging/thesis release | Separate complete staging/recovery and broad respondent acceptance are not established by these checks. Protect respondent data, use authorized test scope and distinguish demo features from real workflows. |

Older example handoff includes thesis/ethics and broad roadmap material that is historical, not a fresh audit. Consult current feature records before making promises about unaudited areas. Core current ranking and real XGBoost are implemented; do not revert to the old claim they are preview-only.

## File map for the next chat

- Project: AGENTS.md; docs/ARCHITECTURE.md; FRONTEND_CONTEXT.md; BACKEND_CONTEXT.md; FIGMA_WORKFLOW.md; FEATURES.md; ROUTES.md; package.json; App.tsx; src/shared/models/marketplaceNavigation.ts.
- Living docs: docs/features/SEARCH_DISCOVERY.md, PROPERTY_RECOMMENDATIONS.md, RENTAL_PRICE_ESTIMATION.md, PROPERTY_LISTING_MANAGEMENT.md, MESSAGING_VIEWING.md, TENANCY.md, AUTHENTICATION_PROFILES.md, USER_VERIFICATION.md, ADMIN_VERIFICATION.md.
- Continuous records: docs/implementation-reports/phases/<FEATURE>_IMPLEMENTATION.md and database/<FEATURE>_BACKEND_LEDGER.md. Prefer latest dated evidence over historical opening statements.
- Search source: src/features/search-discovery/{models,services,viewModels,views,components}; manualSearchService.ts; manualSearchWorkflow.ts; gpsProximityService.ts; gpsProximityWorkflow.ts; recommendationWorkflow.ts; useSearchDiscoveryViewModel.ts; NearbyPropertyMap.tsx; NearbyMapResultsView.tsx; LiveSearchViews.tsx.
- Recommendations: src/features/property-recommendations/models/ContentRecommendation.ts and services/recommendationService.ts; docs/implementation-reports/audits/PROPERTY_RECOMMENDATIONS_TIER2_PRIVACY_REVIEW_2026-11-08.md and PROPERTY_RECOMMENDATIONS_TIER2_CONTRACT_AUDIT_2026-11-08.md.
- Shared maps/location: src/shared/services/maps/overpass/overpassService.ts; maps/mapTiler/mapTilerConfig.ts; maps/geocoding/geocodingService.ts; location/deviceLocationAdapter.ts.
- Supabase generated contracts: src/shared/services/supabase/database.types.ts. Types alone do not prove deployment or grants.
- Latest audits: TENANT_SEARCH_DISCOVERY_AUDIT_2026-11-10.md and RENTAL_ESTIMATION_HANDOFF_RECONCILIATION_2026-11-08.md under docs/implementation-reports/audits/.
- Deletion tests: tests/unfinishedPostDeletion.test.ts and supabase/tests/run_unfinished_posts.py; migration/Edge paths above. Do not execute production writes as smoke tests.

## Preservation checklist for the next assistant

The currently dirty tree includes docs/FEATURES.md, docs/ROUTES.md; living Search/Recommendations/Property/Messaging docs; their histories/ledgers; Public Identity history/ledger; SearchListingCard.tsx, manualSearchService.ts, useSearchDiscoveryViewModel.ts, TenantDiscoveryView.tsx; tests/discoverHomepage.test.ts and manualSearch.test.ts; rental-price-estimate/README.md; supabase/test-support/README.md; old UC-09 filename deletions, replacement filenames and verify_viewing_deployment.sql/verify_reservation_deployment.sql; .vscode; the new tenant audit and this handoff. This list is an orientation, not permission to stage or discard any item. Re-read git status/diff before any future edit.

No tests, backend calls, device actions, staging, commit or push were performed for this handoff. Only this Markdown artifact was created. The state above combines current local Git/doc reads with specifically identified earlier verification evidence; it is not a fresh live production health certificate.

## Suggested first message in the new ChatGPT chat

Read this November 10 RentLease handoff. Do not implement or deploy yet. The Tenant Search & Discovery audit is finished, fixes are uncommitted awaiting my review, and the deletion backup is prepared but deletion backend is undeployed. Preserve local work. Do not access my phone, run ADB/Expo/builds, deploy, commit or push. First summarize the current status and the next decision I need to make, distinguishing live verified contracts, local changes and remaining acceptance. Wait for my scoped instruction before continuing.