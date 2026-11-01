# Search & Discovery

Last verified date: 2026-10-30. Revision: baseline `7eb361b` plus uncommitted manual-search integration on `feature/search-discovery-backend-integration`; no Android runtime-verified commit is claimed.

## Purpose, scope and actors

Help ordinary marketplace members browse rentals. **GPS proximity and manual city/barangay search, filters, sorting, ordinary photos/amenities and real detail loading are IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Map results and saved-listing integration remain DEFERRED. Matching Preferences remain session-local; For You is reserved as the future RentLease community/feed surface, with an honest empty state. No recommendation backend, OSM, XGBoost, NLP or 360 integration is included.

The GPS backend requires an authenticated Tenant with Tier 1 verification. Manual browsing follows existing listing/property RLS, which permits Tier 1 active-listing reads and owner/Admin/tenancy access; the service still restricts all search results to eligible active records. Landlord-only members do not gain GPS eligibility from UI mode; nearby search communicates backend denials without assigning roles or bypassing authorization. Authentication remains the account/session owner.

## Architecture and source

View -> ViewModel/workflow -> service -> Expo foreground Location / typed Supabase singleton.

- `src/features/search-discovery/models/GpsProximity.ts`: dedicated nearby types based on `RpcNearbyListing`, safe error contracts; no invented ratings, bedrooms or match scores.
- `viewModels/gpsProximityWorkflow.ts` under that feature: ephemeral position, radius, request generation/abort, loading/error/results, pagination and cleanup.
- `viewModels/useSearchDiscoveryViewModel.ts`: composes GPS workflow with existing feature navigation; account-keyed lifecycle and Back/reset behavior.
- `services/gpsProximityService.ts`: identity checks, typed RPC transport, exact packaged parameter and complete-response adapters. `gpsProximityDependencies.ts` composes existing singleton/device services.
- `src/shared/services/location/deviceLocation.ts` and `deviceLocationAdapter.ts`: foreground permission, services-enabled check, one-shot High-accuracy position, bounded position acquisition and Android app settings. No watch/background permission/tracking.
- `views/SearchLocationView.tsx`, `views/NearbyListingsView.tsx`, `components/NearbyListingCard.tsx`: explanation, list/errors/radii and RPC-only summaries. Views contain no client/device calls.
- `App.tsx` supplies account identity to root feature composition; no navigation framework or global state store was added.

The prebuilt pure-JS `@rentlease/gps-local@0.1.0` tarball is an existing user-prepared dependency at `vendor/gps/rentlease-gps-local-0.1.0.tgz`. Source is Rentlease-Features, `feature/gps-proximity-local`, commit `47e400b704eceadc9e5e5ba341d9042df4ac8566`. Production imports root validation and `/rpc`, never simulation `/local`. No algorithms were rebuilt or vendored as source.

## Current GPS flow

Search Location -> Use my current location -> explanation -> explicit Use current location -> Android foreground permission -> one device position -> `search_nearby_listings` -> Nearby rentals.

No permission is requested on mount/startup or just opening the explanation. Not now returns to manual search without a write/request. Denied/blocked permission, disabled services, position failure/timeout, session/account change, Tenant/Tier 1 denial, network/invalid response and pagination errors have safe messages. Permanent denial offers Open app settings; returning requires an explicit retry. Manual city/barangay search remains independently available and now reads real backend data.

Nearby cards render only returned title, rent, property type, city/barangay, date and distance, with honest null fallbacks. Numeric decimal strings are preserved rather than coerced for calculations. Cards do not open fixture details or show fake photos/ratings/recommendations. The manual search path now has its own real listing-detail query/navigation; GPS cards remain the existing independent RPC summaries.

Radius is 1/3/5 km, default 3. Each radius change requests page zero from the server; no Haversine filtering or re-sorting is applied. Results remain nearest-first in server order with server distances. Load more uses limit 20 and offsets 20/40/etc., preserves earlier rows on page failure, retries that page explicitly and removes overlapping IDs while preserving first-seen order. Offset progression uses received page count, not deduplicated display count; offset 1000 is the final permitted request. Offset pagination may shift when live listings change; it is not a snapshot/history guarantee.

Changing radius or refreshing location resets pagination. Repeated start/load-more actions are guarded synchronously. Replacement radius searches abort/invalidate older requests. Back, manual search, Home, account/workspace replacement and unmount reset GPS state; older device/RPC/settings responses cannot populate the next search/account. Native one-shot position APIs may finish after cancellation/timeout, but their late result is discarded.

## Backend, privacy and authorization

`public.search_nearby_listings(p_latitude, p_longitude, p_radius_km = 3, p_limit = 20, p_offset = 0)` remains the only GPS nearby data operation; manual search uses separate SELECT queries described below. The generated structural entry was copied exactly from live generator output; nullable values are additionally handled by the packaged runtime adapter, because SQL RETURNS TABLE does not establish non-null guarantees.

The inspected existing function is STABLE / SECURITY INVOKER, empty search_path, authenticated EXECUTE (no PUBLIC/anon EXECUTE in observed ACL). It checks authenticated identity, Tenant role, Tier 1 and parameter ranges; it reads active listings/active properties, checks availability in Asia/Manila and uses PostGIS on `properties.public_location`. Existing table grants/RLS remain authoritative, including any underlying dependencies. No direct listing/private-location read, grant or policy change is added by GPS integration.

Tenant coordinates exist only in workflow/service request memory, never in UI snapshots, AsyncStorage, account preferences, analytics or debug logs. They are sent only as RPC search parameters, not persisted by frontend writes. Raw backend error objects/coordinates are not displayed/logged. Returned property coordinates are generalized public points; no private/exact property coordinates are queried or exposed. Source inspection/mocked tests do not prove live caller/RLS acceptance or server logging configuration.

## Verification and limitations

Automated evidence, exact counts, package import/Metro validation and compatibility results are maintained in the [implementation history](../implementation-reports/phases/SEARCH_DISCOVERY_IMPLEMENTATION.md). Read-only backend inspection/generation is recorded in the [backend ledger](../implementation-reports/database/SEARCH_DISCOVERY_BACKEND_LEDGER.md). No live search RPC or test data creation was performed. User-reported zero eligible listings is a legitimate empty-state possibility, not independently verified live data in this pass.

No native dependency was added. Existing `expo-location` supplies foreground Android permissions; no app config/native dependency change was needed. Existing clients lacking the already required native modules need a compatible build; no EAS build was run. Hermes/Metro bundle evidence is not device acceptance.

Android acceptance still needed: Tier 1 Tenant -> Discover/Search -> explanation -> Allow while using app -> nearby results/legitimate empty state; test 1/3/5 km and load more with real eligible data when available. Test Deny, cannot-ask-again/settings return, services disabled, timeout/network/page failure and retry; Back/Not now/manual city preview; radius races, account switch and workspace close; no coordinate display/logs; narrow screens and large font scaling. Test Landlord-only, signed-out and non-Tier-1 denials without changing backend permissions. Existing Property/Listing/Verification flows must remain unchanged.

## Deferred and integration boundaries

Map results, saved-listing integration, recommendation ranking, OSM nearby places, XGBoost, NLP and 360 remain deferred/separately owned. This integration consumes the finished GPS package and existing RPC without taking ownership of their algorithms or database definitions. Future phases update this document, its continuous history and ledger, not per-phase report files.


## Manual search and real listing details (2026-10-30)

Manual location query -> feature ViewModel/workflow -> authenticated Supabase SELECT -> active/available listings joined to active properties -> server filters/sort/range -> real result cards/detail. This does not request GPS or call the nearby RPC. GPS keeps its existing PostGIS nearest-first/radius/ephemeral-position behavior.

### Sources and ownership

- `models/ManualSearch.ts`: real listing/detail/photo/location/filter contracts and complete core-row mapping, with no fixture metric fields.
- `services/manualSearchService.ts`: existing typed singleton, identity revalidation, listing/property joins, property-photo metadata/public URL validation, controlled amenities, eligibility/filter/sort/range queries and safe errors. The existing pure PropertyPhoto path helper is reused; no cross-feature ViewModel import.
- `services/manualSearchDependencies.ts`: composition only.
- `viewModels/manualSearchWorkflow.ts`: independent result/location/detail generations and AbortControllers, page state, contextual retry, stale account/workspace protection and cleanup.
- `components/SearchListingCard.tsx` and `views/LiveSearchViews.tsx`: real card/results/filter/detail rendering, neutral missing/failed-image state and shared fullscreen image viewing. `SearchDiscoveryFlowView` routes real results/details/filters to these Views, not prototype property screens.
- `SearchLocationView` binds backend Available Locations; `TenantDiscoveryView` preserves the home header and replaces fake For You cards with unavailable copy and a real search entry. Matching Preferences retain their existing session-local editor and draft guard.

### Geographic semantics and Available Locations

Properties expose city (imus/dasmarinas/tagaytay enum) and barangay text; no province/region column or landmark-search contract was found. UI says Enter a city or barangay. Known city names are normalized case/accent-insensitively to backend enum values; other text uses escaped, case-insensitive barangay ilike. A selected barangay suggestion also scopes its city, without silently retaining that implicit constraint on a later typed search. Explicit filter-city selections persist normally. No MapTiler geocoding was added to manual search.

Available Locations is derived from a separate eligible listing/property SELECT, 20 source records per page, with explicit More available locations. Names are deduplicated for presentation, without claiming popularity, complete catalogue coverage or fabricated counts. Offset advances by raw source records; no entire property table is downloaded. Query changes debounce suggestions, abort/invalidate older location reads and restart the page. Empty/error/retry states are real. No GPS input is used for suggestions.

### Eligibility, filters, sorting and paging

Search/detail/location queries always require listing.status=active, properties.is_active=true, and available_from null or <= the current Philippine calendar date. Existing RLS remains authoritative, including Tier 1 and owner/Admin/tenancy rules. Query predicates also prevent an owner/Admin from seeing inactive drafts as tenant search results. No schema/RLS/grant/function changes were made.

Supported server filters: city, any selected backend property types, minimum/maximum monthly rent, minimum bedrooms/bathrooms, minimum floor_area_sqm and furnishing status. Land area/lot area is not inferred from floor area; those filters are unavailable. Amenity filters use actual active catalogue IDs and an inner property_amenities join with **any selected amenity** semantics, explicitly labeled in the UI. Property amenities are separate from nearby places.

Sort options: Recently Listed (published_at descending, nulls last), Price: Low to High, Price: High to Low; ID is the deterministic secondary key. No Recommended/Best Match/percentage ordering enters real results. Server pages contain 20 records. New query/filter/sort starts page zero; explicit load more preserves earlier rows on failure, retries the failed offset and deduplicates overlap without sorting client-side. Offset pagination is not a stable database snapshot while listings change.

### Cards, details, photos and deferred surfaces

Cards use listing title/rent, property type, actual city/barangay, bedrooms/bathrooms/floor area and validated ordinary photo URLs. No invented ratings/reviews/match scores/nearby places. Missing or failed thumbnails show a neutral image state. Public URLs derive only from authorized property_photos metadata, the property-media bucket and its existing owner/property/photo namespace helper; arbitrary stored URLs are rejected. Photo reads are bounded to the current result page (at most 20 properties / 200 ordinary photos).

Opening a real listing loads the same eligible listing/property by ID, actual description/rental terms/availability/house rules, registered photos and property_amenities -> amenities names. A missing/inactive/denied record shows an unavailable/error state, never the first fixture. Visible and hardware Back preserve result query/filter/page state. The shared fullscreen photo Modal handles its own Android Back/close.

Manual map results are deferred and have no fake-pin route: generated public_location is PostGIS geography/unknown, and no verified manual-query latitude/longitude projection/parser is connected. No private location is selected as a workaround. GPS continues consuming its separately confirmed public coordinate RPC fields.

Saved-listings schema/RLS exists, but authenticated SELECT/INSERT/DELETE privileges were observed false. No save/heart persistence is exposed or invented. For You is a future community/feed surface; recommendations remain deferred as a possible content section, not the page definition. Legacy fixture arrays/cards/detail/supplementary/sort components remain source-only prototypes; the normal Flow and ViewModel no longer import or select fixture records. Prototype Recommended/Best Match strings and preference-ranking defaults do not order live searches.

### Verification boundary

See the continuous history for exact automated/export/link results and the backend ledger for read-only catalog/grant/bucket inspection. Android/live authenticated PostgREST joins, photos/amenities and negative cases remain RUNTIME-UNVERIFIED. No fixture insertion or production data mutation was performed. Existing GPS tests remain retained; only their manual-search expectation and dependency injection changed to use real-search behavior.

Manual Android acceptance: Tier 1 login -> Discover -> Search Location -> real Available Locations/legitimate empty list -> city and barangay search -> filter/price sorts -> load more -> actual listing/detail/photos/amenities -> Back. Repeat empty/inactive/future listing cases, missing photos, permission/network failures/retry, fast query changes, account switching and large text/narrow screens. Repeat the independent GPS Allow/deny/1-3-5 km path. No new native dependency or native rebuild requirement was introduced, and no EAS build occurred.


## Focused Android runtime corrections (2026-10-30)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED after correction.** The user observed false GPS eligibility messaging, an Available Locations load error and recommendation-only For You copy during Android testing. These are failed observations, not runtime acceptance; the exact tested revision/device build was not supplied. Existing uncommitted manual-search integration remains preserved.

### GPS classification, identity and retry

Previously every SQLSTATE 42501 became the Tenant/Tier 1 message. Only 42501 **and** the intentional RPC message `Tenant verification required` (trimmed exact match, confirmed in the live function source) now produce eligibility. Other 42501 errors become safe generic backend_permission errors. 28000/PGRST301 remain identity/session failures. No raw SQL, backend message or request payload reaches the user.

`services/searchDiagnostics.ts` centralizes development-only diagnostics: code-owned stage, validated code and fixed classification only. `[SEARCH-DIAG] request failed` logs no raw message/details/hint, GPS coordinates, identity/contact fields, tokens or URLs. Production logging is disabled by __DEV__. GPS RPC and Available Locations query errors use this boundary.

Auth remains the existing authoritative account owner; root feature identity keys and before/after auth.getUser checks remain intact. No stale UI role snapshot rejects users before the RPC, and no second role/security store was added. No actual displayed-account/auth-user mismatch was established.

Existing GPS retry coordination was retained and regression-tested: RPC failure with a valid in-memory point reissues the RPC without another position acquisition; missing/cleared point reacquires permission/location; synchronous loading guards prevent duplicate retries. Successful [] remains successful and shows No nearby rentals found within the selected radius. Position state remains ephemeral and radius/order behavior is unchanged.

### Available Locations request states

The service already accepted successful [] before this correction; no source evidence showed [] being converted to an error. A genuine query failure can occur even when the database has zero listings. The correction makes idle/loading/success/error explicit, shows the empty state only after successful completion, and adds diagnostics rather than disguising real errors as empty success. Null/non-array success envelopes remain malformed-response errors.

Successful zero rows show No available rental locations yet / Locations will appear here when rentals are published, with no Retry locations or fallback names. Actual failures retain a safe retry error. Retry performs another request, loading feedback is visible, and duplicate same-query/page requests are suppressed while in flight. Different query generations still replace older requests. Backend-derived nonempty pages and manual filters/sort/details remain intact.

### For You ownership

For You is the future community/feed destination, separate from Discover/Search. Current copy is No community posts yet / Posts from landlords and the RentLease community will appear here, with Discover rentals routing to Search Location. Community creation/media/likes/comments/follows/ranking/persistence remain unimplemented. Recommendations may later be one content source; no recommendation cards/engine/percentages are connected. For You renders without requesting permission, reading coordinates or depending on GPS results; GPS stays scoped to nearby rentals.

### Read-only evidence and remaining runtime boundary

Current catalog/count inspection confirmed 3 active Tier 1 Tenants, 0 active listings, 7 active properties, authenticated GPS EXECUTE and listing/property SELECT. It also found authenticated tenancies SELECT=false while listings_read_allowed directly references tenancies. This is a confirmed dependency privilege gap and a possible cause of the reported permission/query failures, **not** a confirmed match to the Android error without the new diagnostic. Backend review may still be needed; no grant/RLS/function change or workaround was performed. Zero listings does not imply a failed query should be hidden. See the existing backend ledger for exact reads and attribution.

Next Android retest: Tier 1 Tenant -> explicit current-location action -> RPC success/empty state or safe generic error with categorical SEARCH-DIAG output; retry an induced failure and observe loading/request; test zero-listing Available Locations vs actual network error/retry; verify For You community copy/CTA without GPS prompt. If errors persist, capture only stage/code/classification. Do not share tokens, coordinates or raw account/error payloads. Automated results are in the continuous implementation history; no live authenticated/device success is claimed.


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
