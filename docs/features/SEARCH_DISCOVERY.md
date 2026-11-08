# Search & Discovery

UC-08 detail correction (November4,2026): shared real details render a compact Listed by / neutral avatar / Property Owner row before description. No profile name/avatar is fetched or inferred from the current account. Contact Owner's raw JSX whitespace was removed; own-listing guard and existing gallery remain. Discover-to-inquiry reuse and Back were agent-observed on Android; manual/GPS use the same automated-tested detail component. See [messaging](MESSAGING_VIEWING.md) for persistence evidence and remaining two-account acceptance.

Last verified date: 2026-11-04 (Asia/Singapore). GPS radius migration deployed as 20261103164547; post-deployment Android acceptance remains pending.

## Purpose, scope and actors

Help ordinary marketplace members browse rentals. **Discover homepage, GPS proximity and manual city/barangay search, filters, sorting, ordinary photos/amenities and real detail loading are IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** GPS map results are implemented; manual-search map results and saved-listing integration remain DEFERRED. Discover defaults to the real recently published rental feed. Matching Preferences remain session-local; For You remains a distinct community surface with an honest empty state, not recommendations. OSM Nearby Places loads automatically in shared real listing details; content-based recommendations now run locally over existing authorized listing reads; no recommendation backend, NLP or 360 integration is added. XGBoost remains a separate estimator integration.

The deployed GPS backend requires an authenticated active Tier 1 account, regardless of normal Tenant/Landlord membership. Manual browsing follows existing listing/property RLS, which permits Tier 1 active-listing reads and owner/Admin/tenancy access; the service still restricts all search results to eligible active records. Nearby search communicates backend denials without assigning roles or bypassing authorization. Authentication remains the account/session owner.

## Architecture and source

View -> ViewModel/workflow -> service -> Expo foreground Location / typed Supabase singleton.

- `src/features/search-discovery/models/GpsProximity.ts`: dedicated nearby types based on `RpcNearbyListing`, safe error contracts; no invented ratings, bedrooms or match scores.
- `viewModels/gpsProximityWorkflow.ts` under that feature: ephemeral position, radius, request generation/abort, loading/error/results, pagination and cleanup.
- `viewModels/useSearchDiscoveryViewModel.ts`: composes GPS workflow with existing feature navigation; account-keyed lifecycle and Back/reset behavior.
- `services/gpsProximityService.ts`: identity checks, typed RPC transport, exact packaged parameter and complete-response adapters. `gpsProximityDependencies.ts` composes existing singleton/device services.
- `src/shared/services/location/deviceLocation.ts` and `deviceLocationAdapter.ts`: foreground permission, services-enabled check, one-shot High-accuracy position, bounded position acquisition and Android app settings. No watch/background permission/tracking.
- `views/SearchLocationView.tsx`, `views/NearbyListingsView.tsx`, `components/NearbyListingCard.tsx`: explanation, list/errors/radii and RPC-only summaries. Views contain no client/device calls.
- `App.tsx` supplies account identity to root feature composition; no navigation framework or global state store was added.

The pure-JS dependency is now `@rentlease/gps-local@0.1.1`, packed from the actual source at `C:/dev/RentLease-Features/gps` into `vendor/gps/rentlease-gps-local-0.1.1.tgz`. Source validation/types support integer radii 1-20. Production imports root validation and `/rpc`, never simulation `/local`. The previous tarball remains intact. Source and package changes are uncommitted.

## Current GPS flow

Search Location -> Use my current location -> explanation -> explicit Use current location -> Android foreground permission -> one device position -> `search_nearby_listings` -> Nearby rentals.

No permission is requested on mount/startup or just opening the explanation. Not now returns to manual search without a write/request. Denied/blocked permission, disabled services, position failure/timeout, session/account change, active Tier 1 denial, network/invalid response and pagination errors have safe messages. Permanent denial offers Open app settings; returning requires an explicit retry. Manual city/barangay search remains independently available and now reads real backend data.

Nearby cards render only returned title, rent, property type, city/barangay, date and distance, with honest null fallbacks. Numeric decimal strings are preserved rather than coerced for calculations. Cards do not open fixture details or show fake photos/ratings/recommendations. GPS cards now open that same real listing-detail query/navigation and display batched public property thumbnails.

The slider and deployed RPC both support integer radii 1-20 km, default 3 (migration 20261103164547). Committing a radius change requests page zero from the server; no Haversine filtering or re-sorting is applied. Results remain nearest-first in server order with server distances. Load more uses limit 20 and offsets 20/40/etc., preserves earlier rows on page failure, retries that page explicitly and removes overlapping IDs while preserving first-seen order. Offset progression uses received page count, not deduplicated display count; offset 1000 is the final permitted request. Offset pagination may shift when live listings change; it is not a snapshot/history guarantee.

Changing radius or refreshing location resets pagination. Repeated start/load-more actions are guarded synchronously. Replacement radius searches abort/invalidate older requests. Opening a real listing and returning with Back preserves nearby rows and radius. Leaving the nearby/detail flow, manual search, Home, account/workspace replacement and unmount reset GPS state; older device/RPC/settings responses cannot populate the next search/account. Native one-shot position APIs may finish after cancellation/timeout, but their late result is discarded.

## Backend, privacy and authorization

`public.search_nearby_listings(p_latitude, p_longitude, p_radius_km = 3, p_limit = 20, p_offset = 0)` remains the only GPS nearby data operation; manual search uses separate SELECT queries described below. The generated structural entry was copied exactly from live generator output; nullable values are additionally handled by the packaged runtime adapter, because SQL RETURNS TABLE does not establish non-null guarantees.

The inspected existing function is STABLE / SECURITY INVOKER, empty search_path, authenticated EXECUTE (no PUBLIC/anon EXECUTE in observed ACL). It checks authenticated identity, active Tier 1 and parameter ranges; it reads active listings/active properties, checks availability in Asia/Manila and uses PostGIS on `properties.public_location`. Existing table grants/RLS remain authoritative, including any underlying dependencies. No direct listing/private-location read, grant or policy change is added by GPS integration.

Exact device coordinates exist only in workflow/service request memory. The UI snapshot now exposes only the user origin rounded to three decimal places for the approximate map position/radius overlay; it is never persisted in AsyncStorage, account preferences, analytics or debug logs. They are sent only as RPC search parameters, not persisted by frontend writes. Raw backend error objects/coordinates are not displayed/logged. Returned property coordinates are generalized public points; no private/exact property coordinates are queried or exposed. Source inspection/mocked tests do not prove live caller/RLS acceptance or server logging configuration.

## Verification and limitations

Automated evidence, exact counts, package import/Metro validation and compatibility results are maintained in the [implementation history](../implementation-reports/phases/SEARCH_DISCOVERY_IMPLEMENTATION.md). Read-only backend inspection/generation is recorded in the [backend ledger](../implementation-reports/database/SEARCH_DISCOVERY_BACKEND_LEDGER.md). The November 2 read-only GPS evidence below supersedes earlier lack of live RPC validation. No live test data was created.

No native dependency was added. Existing `expo-location` supplies foreground Android permissions; no app config/native dependency change was needed. Existing clients lacking the already required native modules need a compatible build; no EAS build was run. Hermes/Metro bundle evidence is not device acceptance.

Android acceptance still needed: Tier 1 Tenant -> Discover/Search -> explanation -> Allow while using app -> nearby results/legitimate empty state; test 1/3/5 km and load more with real eligible data when available. Test Deny, cannot-ask-again/settings return, services disabled, timeout/network/page failure and retry; Back/Not now/manual city preview; radius races, account switch and workspace close; no coordinate display/logs; narrow screens and large font scaling. Test eligible Landlord-only and role-free success, plus signed-out/non-Tier-1 denial without changing backend permissions. Existing Property/Listing/Verification flows must remain unchanged.

## Deferred and integration boundaries

Manual-search map results, saved-listing integration, NLP and 360 remain deferred/separately owned. Content-based recommendation ranking is now integrated locally; XGBoost estimation is separately owned. This integration consumes the finished GPS package and existing RPC without taking ownership of their algorithms or database definitions. Future phases update this document, its continuous history and ledger, not per-phase report files.


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

Manual map results are deferred and have no fake-pin route: generated public_location is PostGIS geography/unknown, and no manual map is connected. The detail-only safe public-point projection now decodes WGS84 EWKB/GeoJSON for Nearby Places. No private location is selected as a workaround. GPS continues consuming its separately confirmed public coordinate RPC fields.

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

## Earlier empty GPS investigation (November 2, 2026)

On fix/gps-nearby-results from pushed role checkpoint 1422681. Read-only live
checks found 4 listings: 3 active on active properties, available now, each with a
valid SRID-4326 public point; the archived fourth is correctly excluded. For all
three public anchors and all six eligible ordinary accounts (including legacy
Tenant, Landlord, dual memberships and a role-free account), GPS RPC counts were
1 at 1 km and 3 at 3/5 km, with the anchor at zero distance. A point 30 km north
returned zero at 5 km. The installed production mapper accepted all three live
RPC rows. Public-point data only; no private coordinates were queried.

The user subsequently confirmed the device was an emulator whose Google Maps location was in the USA, and reported GPS search working on Android. This explains the earlier coverage mismatch; no search-algorithm or authorization defect was established. New UX changes below still require their own Android acceptance.

Confirmed separate correction: current RPC Tier 1 denial is now classified as
eligibility (rather than a generic permission failure), and GPS copy no longer
requires Tenant membership. No search algorithm, radius limit, RLS, listing data
or migration changed. 69 focused GPS/runtime tests and typecheck passed.

## Nearby UX completion (November 2, 2026)

IMPLEMENTED / AUTOMATED-TESTED; new slider/photos/detail-return behavior RUNTIME-UNVERIFIED. A core React Native adjustable slider previews 1-20 km in integer steps, defaults to 3, and searches only on release or accessibility adjustment. Interrupted gestures cancel. Replacement requests retain generation/abort and account identity checks.

Nearby cards use real listing IDs and open the existing live detail/gallery/full-screen photo experience. Per page, one batched ownership lookup plus one batched photo lookup validates existing public photo namespaces; cover-first ordering and a first-photo fallback supply actual thumbnails. Missing/failed images remain neutral, and photo-load failures do not discard valid search results. Back from detail retains radius/results without another location request. Account replacement invalidates pending RPC/photo/detail requests.

Deployment prerequisite: `supabase/migrations/20261102144651_gps_nearby_radius_1_to_20.sql` is prepared and locally tested ONLY. Live RPC still allows 1/3/5 km until separately authorized deployment; other slider values cannot work live yet. Signature, Tier 1, invoker/RLS, public-only PostGIS geometry, availability and pagination remain unchanged. Do not release this frontend radius expansion before deploying that migration. No live writes, commit, push or app build occurred.

Validation: 90 focused frontend tests; GPS source package 90 focused tests and source typecheck; 34 isolated PostgreSQL radius/guard checks. Frontend typecheck and final whitespace results are recorded in the implementation history. Android: use an Imus emulator/device origin, compare 1/3/20 km after migration, drag/release and TalkBack, open actual thumbnails/gallery/full screen, Back, missing/unavailable listing, denied permission, offline retry, pagination and account switching.

## Nearby map and listing information (November 3, 2026)

IMPLEMENTED / AUTOMATED-TESTED; Android RUNTIME-UNVERIFIED. GPS opens Map by default, using existing MapLibre and service-owned MapTiler style configuration. Price markers use only RPC publicLocation points; selecting one reveals a real-thumbnail bottom preview with View Details. An approximate user dot and geodesic radius polygon describe the search area; neither changes server distance filtering. Native attribution and MapTiler/OpenStreetMap credits remain visible. Configuration/load/timeout failures offer a map retry or the independent List view.

Map/List, marker selection and camera state (center, zoom, bearing, pitch) share the existing account-scoped GPS workflow. Switching presentation makes no search/photo request. Opening the existing live details and Back restores mode, radius, results, selection and camera. Radius/new-origin changes reframe once; selection and pagination do not drive camera animation. Account reset/disposal clears all map context; stale radius camera callbacks are ignored. Both presentations retain pagination and request cancellation.

LivePropertyDetailView now presents large swipeable photos/fullscreen entry first, monthly price/title/approximate area, physical facts, description, amenities, availability/terms and supported house rules. Manual search uses the same screen and service. Missing images and missing data remain explicit; no inquiry, tenancy or booking action was fabricated. Reference images were not available in this turn, so implementation follows the written hierarchy and existing design tokens rather than claiming image fidelity.

Migration prerequisite unchanged: prepared `20261102144651_gps_nearby_radius_1_to_20.sql` is NOT deployed; production remains 1/3/5 km. The existing GPS 0.1.1 source/tarball validation supports 1-20 and is preserved. No backend/data change or new migration was made for the map. Validation: 97 focused tests passed; TypeScript passed. Test coverage includes public marker coordinate order, actual preview fields/action, camera restoration, Map/List no-requery, rounded origin/privacy, stale camera rejection, gallery, account disposal and existing GPS cancellation. Native render, layout and TalkBack require Android verification.


## Immersive nearby-map redesign (November 3, 2026)

Nearby Map now occupies the entire safe-area viewport, with the normal bottom navbar hidden only while nearbyResults is in map presentation. List, real details and other destinations restore ordinary navigation. The top floating surface contains Back, truthful loaded count, segmented Map/List and a radius disclosure; the existing release-only slider opens on demand. Update location and city search live in an options disclosure. The selected rental appears as one image-led floating bottom preview with its supported property type, location, actual rent/distance, dismiss and View Details. No fabricated bedroom/bathroom/rating data is added to the GPS summary.

Price labels are now React Native overlays projected from the server's approximate public points through the existing native map. A pure layout helper clips whole labels to the viewport and measured control/card insets and prioritizes the selected label when points overlap. Labels outside the safe map region are omitted, not moved to fake geographic positions; List retains every loaded result. Labels hide during camera movement and reproject after settling. Android uses the existing MapLibre TextureView option and clipped map/label containers to prevent native price views bleeding outside map bounds. Projection generations reject stale async work. Native projection is gated until style/map readiness to prevent the Android project() null-map crash on restored views.

Camera initialization is frozen per map mount and saved padding travels with center/zoom/bearing/pitch, preventing repeated overlay-layout changes or returning from details from applying a second framing offset. No new search occurs for presentation/selection/camera state. Existing account disposal and cancellation remain authoritative.

Validation: 100 targeted tests, TypeScript and whitespace checks pass. Android emulator inspection used real existing data and photos, no build or backend writes. User acceptance, narrow/large-font/TalkBack and broader device checks remain outstanding; these agent observations are not user runtime acceptance. Current prepared radius migration remains unchanged and undeployed.

Final agent emulator check confirmed real Map -> selected preview -> real details -> hardware Back with matching camera framing, selected rental, radius and 3 loaded results. No navbar on nearby Map; details restore navigation. This is agent-observed evidence, not user runtime acceptance.


## GPS map stabilization (November 3, 2026)

This supersedes the preceding projected-label implementation. Native MapLibre v11 GeoJSONSource + symbol layers now render stable listing-ID features directly at every RPC public point, with count clusters for genuine proximity/overlap and tap-to-expand. Price text/icons permit overlap rather than silently losing points to native symbol collision. Selected rentals are split into their own green source, so they remain visible independently of ordinary clusters. The user position is a native circle layer. Local tiny UI pill sprites preserve the previous appearance; property photographs still come solely from the existing photo service. No RN annotations, per-listing project() calls, viewport culling or gesture-time label clearing remain.

Camera state is private account-scoped workflow persistence, separate from observable UI snapshots: settlement events store it without triggering subscribers, searches or photos. The map is memoized with stable native source inputs and callbacks. Radius changes no longer key/remount the native map: a deliberate camera ease updates the search frame once, while ordinary gestures are never recentered. Pending cluster expansion is invalidated by user movement, source changes, retry/failure and unmount. Existing Map/List/detail Back, account cancellation, fullscreen composition, preview and attribution remain.

Radius validation at the actual C:/dev/RentLease-Features/gps source and installed/bundled 0.1.1 package already accepts every integer 1-20 without coercion. The live RPC still accepts only 1/3/5 until separately authorized deployment of 20261102144651_gps_nearby_radius_1_to_20.sql. SQL 22023 now produces a parameter/contract error rather than a connection message; the old-radius response explicitly explains that server update is needed. No silent conversion to a supported legacy radius. Prepared reversible companion: supabase/test-support/gps_radius_1_to_20_rollback.sql, source-drift guarded, not an automatically applied migration.

Validation: 106 focused frontend tests and TypeScript pass; 90 actual-source GPS validation/RPC/proximity tests pass; 37 disposable PostgreSQL checks cover 1-20, invalid parameters, eligibility/public PostGIS/availability/pagination guards and exact rollback. Agent emulator observations: all three actual prices present after eight pan gestures, native selected styling, actual photo/detail and matching Back restoration. A committed live 2 km request showed the correct migration-needed message; radius restored to 3 afterward. These observations do not establish physical-device performance or user acceptance. Emulator gfxinfo after eight pans: 20 app UI frames, 16 reported janky, median17 ms/p95 32 ms; this excludes a reliable full GL FPS comparison. Physical-device performance and native cluster zoom acceptance remain to check.


## Authorized radius deployment (November 4, 2026)

DEPLOYED / LIVE SQL-VERIFIED: `supabase/migrations/20261103164547_gps_nearby_radius_1_to_20.sql` (prepared version 20261102144651, renamed byte-for-byte). SHA-256 `9dd16e11c053d80c4b1df074bab6899e3b6c16b9c423072feb1cf04d8506adef`. This supersedes all preparation-only/undeployed radius notes above; those dated sections describe the earlier state. The migration file's preparation comment is retained to preserve its reviewed bytes/checksum.

The live RPC now accepts every integer radius 1-20. Its body matches the exact two radius-condition/message substitutions (source MD5 d491c451f08bb49155a70e2b78ec59ce); signature, stable/security-invoker behavior, empty search_path, owner/ACL, public PostGIS distance/order, availability/activity and pagination guards are preserved. Public/Storage policies and row fingerprints for listings, properties, profiles, role records and verification submissions are unchanged.

Fresh schema/data/roles exports and manifest: `C:/RentLease-Backups/gps-radius-predeploy-20261104-004219`. Exports are not restore-tested, do not include Storage objects and use separate snapshots; circular foreign keys require restore care. No listing or account data was changed.

Executed `supabase/tests/verify_gps_radius_deployment.sql` read-only: six existing eligible actors, all 20 radii each (120 successful RPC calls), 15 rejected invalid radius/type/coordinate/pagination inputs and two identity/Tier 1 denials. Public anchor results were 1 match at 1/2 km and 3 at 3-20 km, monotonically increasing and within the correct radius. This is SQL contract evidence, not Android acceptance. Frontend code, package, role model and maps were unchanged during deployment; no commit/push/merge/build. Post-deployment Android slider checks remain pending.


### Nearby Places - November 4, 2026

IMPLEMENTED / AUTOMATED-TESTED; successful live POI retrieval and physical Android acceptance remain RUNTIME-UNVERIFIED. Shared LivePropertyDetailView covers manual search, GPS map and GPS list. Nearby Places appears automatically below property amenities and starts one nonblocking request after authorized detail loading, without Show/Hide. The gallery/detail page remains usable during inline loading; errors retain the section and small Retry action. Categories use the requested Schools and universities, Hospitals and clinics, Shopping malls and centers, Transport terminals and stations labels. Named records show category and approximate straight-line distance in nearest-first order; no walking/driving estimates.

The existing detail-only properties.public_location projection/strict WGS84 Point EWKB/GeoJSON decoder remains unchanged. No private coordinates, Supabase mutation, migration or new detail/map flow. manualSearchWorkflow owns automatic lifecycle, account/listing generation guards, cancellation and stale-cache presentation. overpassService generalizes public origins to three decimals, defaults to 2,000 m (bounds 100-3,000 m), requests all categories together, limits output to 501 (more than 500 rejected), response size to 2 MB, server runtime to 8 s and the entire HTTP operation to 12 s. A five-minute/20-location memory cache shares concurrent requests; successful cache up to 30 minutes old can remain visible during/after a failed refresh, clearly labeled as previously loaded. No fake data/empty-on-error fallback.

The single POST uses form-url-encoded data, one merged amenity selector plus healthcare/shop/public_transport/railway selectors (five clauses total). Every clause includes a conservative bounding box before the exact around-radius filter, preserving nodes/ways/relations needed for campuses and mapped facilities. Output is center/qt limited to 501; no recursive member/geometry expansion or category-specific HTTP requests. No measured speed improvement is claimed without a successful live response.

Requests identify RentLease using a meaningful User-Agent with the project repository URL and Accept application/json. Primary https://overpass-api.de/api/interpreter; at most one sequential fallback to https://overpass.private.coffee/api/interpreter only after a fast (under 3 s) HTTP 406/502/503/504 failure, within the same 12 s total deadline. No fallback after timeout/network error, 403/429, invalid 400 query, malformed response or cancellation. No repeated retry loop. Retry-After seconds/HTTP dates are honored across locations after 429 (60 s default); a bounded 20-key failure cache blocks same-query reattempts for at least 15 s. Successful cache still takes precedence. Sanitized development diagnostics include only fixed endpoint, HTTP status, failure classification and elapsed time (no coordinates, query body, listing ID or credentials).

OSM selectors: amenity school/college/university; amenity or healthcare hospital/clinic; shop mall; amenity bus_station/ferry_terminal, public_transport station, railway station/halt. Generic retail zones/ordinary bus stops are excluded. Sources: [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL), [provider endpoint/usage terms](https://overpass.private.coffee/), [Supabase geography encoding](https://supabase.com/docs/guides/database/extensions/postgis). The provider requests meaningful User-Agent identification, fair bounded use and OSM attribution; the existing contributor/copyright text remains visible.

Live diagnostics at a known generalized public Imus center found the old unidentified POST returned HTTP 406 at the primary and HTTP 429 with an explicit User-Agent requirement at the alternative. With identification headers, both complete-query POSTs timed out at 22 s; reduced school-only POST (30 s) and GET (15 s) also timed out. Query syntax/parser changes alone cannot establish endpoint availability. Connected emulator reports validated internet, but no native Nearby Places request acceptance was observed. No successful real OSM retrieval is claimed. Physical Android checks: automatic section from all three entry points, real category rows or genuine empty results, safe Retry, rapid listing/account changes, Back retaining GPS state, and diagnostics on service/network failure. No POI map/directions were added.


Latest live diagnostic correction: at the same known generalized public Imus center, the minimal node-school-only 500 m / out20 request timed out without HTTP headers in 10.012 s at de and 10.021 s at private.coffee. Controlled sequential optimized de queries: school 1 km timeout12.008 s; school 2 km HTTP502 in0.666 s (non-JSON); all four categories 2 km timeout12.004 s. There was no HTTP200 or valid JSON, so element/category counts are unavailable, not zero. This reproduces outside Android and cannot be attributed solely to UI, large query size or client cancellation. User-reported native evidence: primary HTTP502 in846 ms, alternative timeout around20 s; subsequent native timeouts. Exact upstream gateway/network cause remains unobservable without provider telemetry. A managed Overpass provider behind a shared cache in the existing approved backend is the practical production option if public endpoints remain unreliable; credentials must stay server-side and backend work needs separate authorization. [OSM public-server guidance](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances).


### Discover marketplace homepage - November 4, 2026

IMPLEMENTED / AUTOMATED-TESTED; physical Android acceptance pending. TenantDiscoveryView now defaults to Discover and renders the existing real SearchListingCard with public ordinary cover photos, title/monthly rent, property type, city/barangay and bedroom/bathroom/floor area details. For You stays an independent community-post empty state. Search Location is available through the search bar; Nearby rentals retains the existing explicit GPS explanation/permission flow. Root Discover/Post/Listings/Tenancy/Chat navigation and verification/account gates are unchanged.

useSearchDiscoveryViewModel composes an independent account-keyed instance of existing manualSearchWorkflow for the homepage. ensureLoaded starts one unfiltered request only when entering home/Discover in idle state; manual filters/GPS resets cannot overwrite feed pages. Existing manualSearchService.search consumes an optional publishedOnly input adding published_at IS NOT NULL alongside active listing, active property, current Asia/Manila availability and existing RLS filters. Default sort remains published_at descending, then listing ID. No location, recommendation signal, additional permission or backend migration is needed. Existing per-page batched namespaced photos are reused.

FlatList supports guarded next-page loading plus accessible Load more, pull-to-refresh, initial inline loading, genuine empty results and error/Retry. Refresh retains cards until success and restarts at offset zero; a failed refresh retries page zero rather than appending an old page. Details use the existing manual detail workflow and gallery; Back restores the already-loaded independent feed. Scroll-offset persistence is not claimed. Account replacement disposes both workflows, cancels old requests and clears old rows. OSM starts only inside details and remains independent/nonblocking; this task does not retry or diagnose its external provider.

Validation: 86 focused tests across discoverHomepage/manualSearch/searchRuntimeCorrections/nearbyMap/marketplaceWiring, TypeScript and whitespace checks. Scoped independent review found no important issue. No live Supabase write, migration, commit/push/merge/deployment/build. Physical-device checks: fresh Discover real cards/photos, Search Location, explicit GPS entry, each card to details/Back, For You separation, pull refresh and multiple pages/error retry, and account switch without stale rows. Successful external Nearby Places retrieval remains a separate known limitation.


Agent emulator observation for this change: existing signed-in app showed Discover/Recently published, one visible real listing card and property photo, no retry/loading state. Card opened the shared Rental Details; after loading, About this rental and property photo were present with no Retry details or loading state. Android Back restored the populated homepage. This is agent-observed emulator evidence, not physical-device/user acceptance; pagination/refresh/account-switch have automated coverage and still need device acceptance.


UC-08 integration (November 4, 2026): shared real listing details now offers server-confirmed Contact Owner, except for the current owner's own listing. App keeps Discovery mounted underneath inquiry Chat so Back returns to the originating detail/GPS/feed state. Bottom Discover explicitly returns home. Inbox/history/send use the prepared messaging RPCs; production messaging remains blocked until separately authorized migration deployment. Nearby Places remains independent. See [Messaging & Inquiries](MESSAGING_VIEWING.md).


## November 8 - Real content recommendations

Discover now includes Recommended for You using explicitly saved account-scoped session preferences, existing live listing cards/details/photos and a bounded recent filtered pool. Recommended blends 80% preference relevance, 10% authorized active Tier 2 status when available, 10% stored 0-1 completeness; Best Match uses relevance alone. Current public contracts do not expose reliable Tier 2 status, so that bonus is neutral. No private identity/document reads, fake percentages or ML dependency. Ranking covers at most 100 recent filtered results and discloses truncation; it is not a global server sort. Existing recent/price pagination, GPS/maps/radius, For You community, Post, matching-preference storage and ML proxy remain unchanged. See [Property Recommendations](PROPERTY_RECOMMENDATIONS.md) for exact factors/weights, tests and limitations. 161 focused tests, TypeScript and whitespace pass; Android pending.
