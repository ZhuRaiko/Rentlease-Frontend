# Search & Discovery implementation history and roadmap

Continuous feature record. Current behavior: [Search & Discovery](../../features/SEARCH_DISCOVERY.md). Backend evidence: [ledger](../database/SEARCH_DISCOVERY_BACKEND_LEDGER.md).

## GPS proximity integration - 2026-10-29

Branch `feature/gps-proximity-integration`; baseline `9e4ba15`. Initial user work preserved: package.json/package-lock.json already referenced the prepared tarball under vendor/gps; the installed package and matching local source archive were present. No branch switch, packaging rebuild/copy, dependency install or unrelated source rewrite was performed.

### Implementation plan and boundary

1. Verify prepared package/imports/archive provenance; inspect current source and generated types. Use the detailed approved user specification as the integration design.
2. Inspect existing RPC read-only and generate types using available tooling; add only missing generator-produced GPS structural entry, preserving unrelated definitions.
3. Add failing focused tests for device/service/workflow contract, then implement existing foreground-device service adapter, safe typed RPC service and generation-guarded workflow.
4. Compose only current-location path into Discovery; keep explanation local until explicit Allow; dedicated RPC-only nearby model/cards/results with radii, pagination, retry/empty states and Back/account cleanup.
5. Execute real hook/presentation regressions, full suite/typecheck/Expo/whitespace/link checks. Update this continuous record, living feature doc and ledger. No backend mutation, unrelated integration or automatic Git/build operation.

### Source and test inventory

Added:

- `src/features/search-discovery/models/GpsProximity.ts`
- `src/features/search-discovery/services/gpsProximityService.ts`
- `src/features/search-discovery/services/gpsProximityDependencies.ts`
- `src/features/search-discovery/viewModels/gpsProximityWorkflow.ts`
- `src/features/search-discovery/components/NearbyListingCard.tsx`
- `src/features/search-discovery/views/NearbyListingsView.tsx`
- `src/shared/services/location/deviceLocationAdapter.ts`
- `tests/gpsProximity.test.ts`
- `tests/gpsDiscoveryIntegration.test.ts`

Modified: App.tsx account prop; SearchDiscovery model/DiscoveryControls; existing Discovery ViewModel/Flow/SearchLocationView; shared deviceLocation wrapper; generated database.types.ts (GPS entry only); marketplaceWiring test narrowly permits feature-local GPS dependency composition. Living feature/history/ledger and concise architecture/frontend/backend/index/routing pointers are updated. Existing prepared package files/tarball remain user-authored setup.

### Behavior, testing and provenance

Foreground explanation -> explicit native permission -> services check -> one High-accuracy position -> packaged RPC adapters -> existing PostGIS RPC. Radius 1/3/5, default 3; limit 20; raw page offsets and stable first-seen deduplication; no local simulation/sort/filter. Coordinates stay private in process memory; reset/dispose abort and invalidate work. Existing fake Imus location branch is removed; manual previews remain intact. No photos/detail fields/ratings/ML scores are fabricated for nearby results.

Tests run real services/workflow with injected native/Supabase ports and execute the actual Discovery hook with a controlled React scheduler. Initial tests failed for missing modules before implementation. A later settings-error-after-reset regression failed before the generation guard correction. Existing navigation boundary test was narrowed to permit only `gpsProximityDependencies` for this feature, while preserving the no-client-in-Views and cross-feature ViewModel restrictions. Device/permission tests do not exercise native dialogs. Live security is not inferred from mocks.

The Supabase CLI version/help commands failed in sandbox on writing the user telemetry file. Connector type generation succeeded. Only exact generated `search_nearby_listings` was adopted; full regeneration was not blindly substituted for unrelated existing contracts. The generator represents fields non-null; runtime adapter deliberately accepts documented nullable text/date/rent and validates required ID/public-coordinate/distance fields.

No permanent live backend mutation was performed in this phase. Backend catalog inspection and type generation only; no live search RPC invocation, fixture creation, grant, migration, schema/RLS/function/Storage change. Read-only evidence and SQL are in the ledger. No GPS source algorithm was rebuilt.

### Runtime and future scope

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Manual acceptance sequence and limitations are in the living feature document. Subsequent Search & Discovery backend conversion, OSM/recommendations/XGBoost/NLP/360 are deferred, not implied by GPS integration. No new native dependency or EAS build. No commit, push, merge or deployment.

### Final validation evidence

- `npm run typecheck`: PASS, exit 0.
- `npm test`: PASS, exit 0; **684 total / 684 passed / 0 failed / 0 skipped / 0 cancelled**, 41 added cases over baseline 643. RPC/device/workflow/hook/presentation coverage includes permission/denial/blocked/services/timeout, exact payload/complete parsing, server order/distance preservation, safe eligibility/network errors, all radii, pagination/overlap/page retry, stale radius/account/Back/unmount/settings completion and manual-preview preservation.
- `npm ls @rentlease/gps-local`: 0.1.0 installed, exit 0. Node production `/rpc` import exposes all three required adapters. Archive inventory: 22 files. Frontend and local source tarballs match SHA256 `C80FDD1C016B856BA5553C191B819F711FF9CE2D7498B003D7BA29BD4158B639`; source branch/commit verified read-only with a command-scoped safe.directory override, not a global configuration change. The source package's 88/88 result is user-provided, not rerun here.
- Local `expo export --platform android`: PASS, Android Hermes bundle in OS temporary directory. Initial sandbox run failed on hermesc executable permissions; authorized retry passed. This was JS bundle validation, not an APK/EAS/native build or runtime test. No generated native directories or application file changes were needed.
- `npx expo install --check`: exit 1 for unchanged patch drift: expo 57.0.30 expects ~57.0.31; expo-location 57.0.21 expects ~57.0.22; expo-notifications 57.0.23 expects ~57.0.24. No automatic fixes/install performed.
- `git diff --check`: PASS. Documentation local links/anchors: **44 checked / 0 errors** across eight affected docs.
- Protected source review: no changes under Property/Listing, Verification, Authentication, Supabase backend files, shared Maps, app.json or eas.json. Package setup was already user-modified before implementation and remains preserved. Production source has no `/local` simulation, background location/watch, raw coordinate log or persistence import.
- MVVM/security: no View external clients, second Supabase client, fabricated discovery metrics or frontend authorization replacement. RPC is read-only; actual Tenant/Tier 1/RLS acceptance, native dialogs/settings/position behavior and eligible results remain Android RUNTIME-UNVERIFIED.

### Skills read

All eight `.codex/skills/rentlease-*/SKILL.md` files: feature-implementation, frontend-mvvm-guard, supabase-contract-guard, security-review, test-runtime-verification, documentation-maintainer, implementation-ledger and implementation-artifact-organizer. Also consulted installed brainstorming/TDD/writing-plans and impeccable/product guidance. Repository-specific continuous-record rules override extra standalone plans/reports; the user's explicit specification authorizes this focused integration without another approval loop.


## Manual backend search and real details - 2026-10-30

Baseline 7eb361b; started clean on feature/gps-proximity-integration and created the requested feature/search-discovery-backend-integration branch. Completed GPS source/package and all prior Property/Listing/Verification/MapTiler work were preserved. The repeated attachment was treated as continuation of the same scope, not a second branch or implementation.

Plan executed: inspect live SELECT/RLS/grants/schema/media contracts; add failing service/workflow tests; implement separate manual model/service/workflow and real Views; route normal manual results/details/filter/sort without fixture imports; backend-derived paged locations; preserve GPS and preference guard; test real hooks/presentation and lifecycle/race/empty/error boundaries; update the existing living doc/history/ledger. No new one-off report.

Added under src/features/search-discovery: models/ManualSearch.ts, services/manualSearchService.ts and manualSearchDependencies.ts, viewModels/manualSearchWorkflow.ts, components/SearchListingCard.tsx, views/LiveSearchViews.tsx. Added tests/manualSearch.test.ts. Modified existing useSearchDiscoveryViewModel, SearchDiscoveryFlowView, SearchLocationView, TenantDiscoveryView and only manual-search copy in NearbyListingsView. Extended actual-hook tests in gpsDiscoveryIntegration.test.ts; marketplaceWiring allowlist now permits exactly the feature-local manual dependency composition. Updated this record set and concise global architecture/backend/frontend/features/routes statements. No generated types, package files or native configuration changes were needed.

The service uses only SELECT on listings joined to properties, property_photos, property_amenities and amenities, with authenticated singleton and identity checks. Active/active/Philippine available-date predicates apply to results, location pages and detail. Filters/sort/range stay on the server. Amenities are real catalogue IDs with explicit any-selected semantics. Photos reuse existing public bucket/path validation and honest placeholders. Detail rechecks eligibility by listing UUID and never falls back to a fixture. No exact/private coordinates are selected.

Available Locations has explicit source pagination, small presentation deduplication and no invented counts/popularity. Manual query normalization supports backend city enum labels and case-insensitive barangay text, not landmarks/province/region. Results use 20-row offset pages with stable server sort/ID tie-break and explicit failed-page retry. Query/filter/sort, identity and workspace lifecycle invalidate old requests; detail and suggestion channels have independent generations. Filter/sort close removes its temporary history entry, avoiding duplicate Back screens. Home resets manual search.

For You is honest unavailable UI; no fixture feed is reachable. Legacy prototype source/fixtures remain isolated for historical compatibility; normal Flow no longer imports prototype property detail/supplementary screens, and the ViewModel never imports fixture properties/location suggestions. GPS service/model/workflow/device adapter/package are unchanged. Its hook regression now expects backend manual search after GPS Back rather than fixture results.

Map results are deferred because a verified direct-query public geography-to-point representation is not connected. No fake pins or exact-location workaround. Saved listings are deferred: table/RLS exists but authenticated SELECT/INSERT/DELETE are false in observed privileges. No backend change is requested or attempted to remove these boundaries.

No permanent live backend mutation was performed in this phase. Live catalog/RLS/grant/helper/bucket reads only, recorded in the existing ledger. No live authenticated query acceptance or Android runtime test is claimed. No OSM/recommendations/ratings/XGBoost/NLP/360, commit/push/merge/deploy/EAS build. All eight repository RentLease SKILL.md files were actually read (feature implementation, MVVM, Supabase contract, security, test/runtime, documentation, ledger, artifact organizer); existing architecture/frontend/Figma instructions and feature records informed the implementation.


### Final manual-search validation evidence

- npm run typecheck: PASS, exit 0.
- npm test: PASS, exit 0; **718 total / 718 passed / 0 failed / 0 skipped / 0 cancelled**, 34 cases added over GPS baseline 684. Coverage includes backend query/payload semantics, city/barangay escaping, active/available predicates, all supported sorts/filters, real photo/amenity/detail mapping, legitimate empty responses, invalid rows/filters, safe errors, paging/duplicate/page retry, stale result/location/detail and account invalidation, actual hook filter/sort Back behavior and suggestion-city reset, presentation fixture isolation and retained GPS/native-boundary regressions.
- expo export --platform android: PASS, Android JavaScript/Hermes bundle exported into OS temp; no APK/native/EAS build. This does not prove live PostgREST/native runtime acceptance.
- npx expo install --check: exit 1 for unchanged existing patch drift: expo 57.0.30 expects ~57.0.31; expo-location 57.0.21 expects ~57.0.22; expo-notifications 57.0.23 expects ~57.0.24. No automatic fixes/dependency installation.
- git diff --check: PASS. Local Markdown links/anchors: **46 checked / 0 errors** across eight affected docs.
- Source leakage scan: previewDiscoveryProperties and Recommended/Best Match remain in isolated prototype model definitions; legacy empty-contract sort bookkeeping remains in the ViewModel but is never bound to live results. No old Imus GPS message or hardcoded match percentage enters the live routes. The real ViewModel does not import fixtures; live Views have no recommendation sorts, fake metrics or nearby-place data.
- Protected diffs: App/Auth/Verification/Property & Listing/Maps, generated schema types, package files, app.json/eas.json, backend files and GPS service/workflow/device code are unchanged. GPS Results has only its stale manual-preview footer copy corrected.
- MVVM/security review: no client calls in Views, no cross-feature ViewModel dependency, no second client, no private location projection, no raw SQL/error/coordinate logs or privileged keys. Pure property-photo helper reuse and authenticated read services preserve existing ownership/RLS boundaries.
- Android: RUNTIME-UNVERIFIED. Manual/live joins, any-amenity filter semantics, empty/nonempty eligible data, photos, permission denials and account-role negative cases require user acceptance. Manual sequence is maintained in the living doc.
- Final branch: feature/search-discovery-backend-integration. All changes remain uncommitted; no push/merge/deploy/EAS build.


## Focused runtime correction - GPS errors, locations and For You (2026-10-30)

Stayed on feature/search-discovery-backend-integration; HEAD remains 7eb361b. All pre-existing uncommitted manual-search/photo/detail/test/docs work was preserved. No new branch or separate report. Android user testing reported false eligibility, location-load failure and For You product-copy issues; successful runtime acceptance is not inferred.

Root investigation: GPS service mapped all 42501 to eligibility, confirmed by new regressions. Live RPC source intentionally raises exactly Tenant verification required / 42501, so classification now requires both fields. Other permission failures are generic backend_permission; identity guards and actual backend authorization remain unchanged. Added a feature-local safe diagnostic module, code/classification/stage only, dev-only, with tests for production silence and redaction. No frontend role authority or auth bootstrap changes.

Available Locations already returned [] successfully in service code. Therefore the reported load error is not proven to arise from zero listings. Added explicit request status so initial/loading/success-empty/error cannot be inferred from list length, duplicate-query suppression, explicit zero-row return and actual query-error diagnostics. Real errors are preserved. For You copy now describes the reserved community/feed surface and routes Discover rentals to search; no posts or recommendations are implemented or driven by GPS.

Focused source delta (on top of the preceding uncommitted phase): added services/searchDiagnostics.ts; updated models/GpsProximity.ts, services/gpsProximityService.ts, services/manualSearchService.ts, viewModels/manualSearchWorkflow.ts and Views SearchLocationView/TenantDiscoveryView/NearbyListingsView. GPS workflow/device/location acquisition code is unchanged; retry behavior was verified rather than rewritten. Added tests/searchRuntimeCorrections.test.ts; revised the old generic-42501 test expectation in gpsProximity.test.ts because its broad eligibility assumption was the defect. Other earlier tests remain intact. Living docs/history/ledger and concise For You context statements updated.

New regressions failed before correction for unrelated 42501 mapping, missing explicit location request states, duplicate retries and old For You copy. Tests also cover intentional eligibility, 28000, successful [], RPC retry with retained point, missing-point reacquisition, no duplicate in-flight retry, successful/error/nonempty location queries and actual CTA bindings without GPS/fixture data.

Read-only evidence confirmed 3 active Tier 1 Tenants, 0 active listings, 7 active properties; authenticated GPS EXECUTE and normal listing/property SELECT. Authenticated tenancies SELECT=false and the listing RLS directly references it. This dependency gap is a possible underlying runtime permission failure; actual Android error correlation remains pending safe diagnostics. No role mutation, grant, RLS/function/schema/Storage change or live authenticated search test was performed. Exact SQL is appended to the existing ledger. No permanent live backend mutation was performed in this phase.

No community-post/recommendation/OSM/saved-listing/rating/ML/NLP/360 implementation, dependency/configuration change, commit/push/merge/deploy/EAS build. Status after correction remains IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Relevant RentLease MVVM/contract/security/testing/documentation/ledger/artifact instructions and systematic-debugging guidance were applied.


### Runtime-correction validation

- npm run typecheck PASS, exit 0.
- npm test PASS, exit 0: **737 total / 737 passed / 0 failed / 0 skipped / 0 cancelled**, 19 additional cases over the preserved manual-search baseline 718.
- git diff --check PASS; local documentation links/anchors **46 checked / 0 errors**. Production stale-copy scan found neither the old recommendation-only For You sentence nor the old fake Imus GPS message.
- npx expo install --check exit 1 for the same existing patches: expo 57.0.30/~57.0.31, expo-location 57.0.21/~57.0.22, expo-notifications 57.0.23/~57.0.24. No fixes/install applied. No bundle/native/EAS build was run in this focused correction pass.
- Manual search/filter/sort/paging/detail/photo/amenity and GPS radius/order/account-lifecycle regressions remain passing. Tests explicitly preserve actual query failures rather than treating them as empty results; diagnostics are production-silent and contain only safe categorical metadata.
- Root Auth snapshot/account key and existing Supabase singleton were inspected; no actual displayed-user/auth-user mismatch was established, and before/after identity checks remain intact. No frontend eligibility gate was added.
- Living feature doc/history/ledger now describe the correction, community/feed ownership and remaining permission investigation. Generic For You copy in routing/frontend context was corrected; unrelated architecture/features/backend descriptions and prior phase evidence were preserved.
- Existing uncommitted manual integration remains uncommitted; no source/config/backend operation outside this correction scope, commit, push, merge, deploy or EAS build. Android remains RUNTIME-UNVERIFIED after correction, with pending categorical diagnostic correlation for any remaining permission failure.


## Android correction - For You empty-state alignment (2026-11-01)

The community empty state now fills the remaining flex space between the unchanged tabs and bottom navigation. Its ScrollView content grows to the viewport, centering the existing heading, description and Discover rentals action in both axes; overflowing large text remains scrollable. Existing theme padding/max width is retained, without fixed heights, offsets or absolute positioning. Root safe-area and bottom-navigation composition are unchanged. No community-post functionality, query or navigation behavior was added. Android short/tall screens, font scaling and safe-area acceptance remain RUNTIME-UNVERIFIED.

2026-11-01 validation: npm run typecheck PASS; npm test 874 total / 874 passed / 0 failed / 0 skipped / 0 cancelled. The new empty-state flex-layout regression failed before the fix and passes afterward. Whitespace PASS; documentation links 94 checked / 0 errors; protected files 314 checked / 0 changed, including publication/service/workflow/backend/package contracts. Changes: TenantDiscoveryView.tsx, tests/searchRuntimeCorrections.test.ts, Search & Discovery living/history documents, and Property & Listing living/history documents for the local publication investigation only. MVVM preserved; no backend access or navigation coordination added to the View. Applied the repository RentLease engineering suite and Impeccable guidance read in this continuing session. Android alignment RUNTIME-UNVERIFIED; publication remains unchanged pending a separate implementation step. No Supabase action, commit, push, merge, deployment or EAS build.


## Available Locations runtime investigation (2026-11-01)

Trace: SearchLocationView -> debounced useSearchDiscoveryViewModel effect (250 ms) -> manualSearchWorkflow.locations -> authenticated manualSearchService.locations -> PostgREST listings SELECT, not an RPC, MapTiler or GPS request. The query selects id,properties!inner(city,barangay,is_active), filters listings.status=active, properties.is_active=true, available_from null or <= today's Asia/Manila calendar date, optional geographic filter, deterministic ID ordering and 20-row pagination. Auth getUser checks bracket access. Supabase Auth/REST connectivity is required; MapTiler, GPS and photo loading are not involved in this locations call.

Live read-only evidence: four matching Android location GETs returned HTTP 200 in the inspected window. The published target listing has available_from 2026-11-06; on 2026-11-01 it fails the existing availability filter. A separate exact base-filter count returned zero before any tenant RLS restriction, so tenant requests cannot return this listing under that filter today. This is an expected empty result, not an authorization failure or proof of broken discovery. No anonymous/tenant credentials were acquired, and no live user impersonation or tenant RLS acceptance test was performed. Listings RLS still requires eligible authenticated readers, owner/Admin/party exceptions; none was weakened.

The user confirmed a visible successful-empty state, not an error/Retry state. Its old explanation implied publication alone made locations appear. The copy now says locations appear when active rentals are available now. Future availability dates and filters are unchanged; publication can succeed before a listing becomes discoverable through this query.

Verified diagnostic defects: unknown Available Locations errors defaulted to network, and intentional AbortSignal cancellation could be logged as network before the workflow ignored the superseded response. Regression tests reproduce both; the original historical one-line event does not retain enough detail to prove it was an abort. The locations service now ignores intentional cancellation for failure logging, normalizes genuine thrown request failures safely, and supports injectable categorical diagnostics. The classifier distinguishes unknown from known fetch/network messages and recognizes SQL query errors. No raw messages, request text, tokens, account IDs, addresses or coordinates enter diagnostics. Existing GPS unknown-error behavior is retained; diagnostic SQL classification is more accurate.

Available Locations is a suggestion path with separate state. A genuine locations failure offers Retry but does not disable manual search, its filters/pagination or independent GPS entry. Tests confirm manual search still runs after locations fail. No backend changes, fallback fixtures, silent permission swallowing, new clients/dependencies or publication changes. MVVM preserved: View copy only, service request/error normalization, workflow cancellation/generation and independent state unchanged.

Files: services/manualSearchService.ts, services/searchDiagnostics.ts, views/SearchLocationView.tsx under src/features/search-discovery; tests/searchRuntimeCorrections.test.ts; this living document, continuous implementation history and backend ledger. Android RUNTIME-UNVERIFIED after diagnostic/copy correction. Retest rapid typing and leaving Search (no canceled network warning), a successful-empty request, offline failure/Retry, manual search despite suggestion failure, filter/pagination preservation, and a genuinely currently available listing. The November 6 listing should remain excluded on November 1; do not edit it or remove filters simply to make it appear.

Final Available Locations verification (2026-11-01): npm run typecheck PASS; full npm test 884 total / 884 passed / 0 failed / 0 skipped / 0 cancelled (4 additional regressions over 880). New tests reproduced false cancellation/network logging and unknown misclassification before correction; cover safe thrown-fetch diagnostics and manual-search independence. Existing GPS, filters, availability-date, identity, pagination and publication tests remain passing. Whitespace/staged check PASS; 96 documentation links/anchors valid; 314 protected source/backend/configuration hashes unchanged. Prior Property & Listing investigation changes and android/ and ninja-error.txt preserved. Read/applied repository RentLease feature/MVVM/contract/security/test/documentation/ledger/artifact SKILL.md files, systematic-debugging and Supabase guidance in this continuing session. No live mutation, native build, dependency change, commit, push, merge or deployment. Post-correction Android RUNTIME-UNVERIFIED.
