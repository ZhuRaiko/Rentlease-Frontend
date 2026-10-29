# Search & Discovery

Last verified date: 2026-10-29. Revision: baseline `9e4ba15` plus uncommitted work on `feature/gps-proximity-integration`; this is not a runtime-verified commit.

## Purpose, scope and actors

Help ordinary marketplace members browse rentals. **GPS current-location proximity is IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Manual city search, fixture details, filters, maps, saved items and session-local Matching Preferences retain their existing PREVIEW behavior. No recommendation backend, OSM, XGBoost, NLP or 360 integration is included.

The GPS backend requires an authenticated Tenant with Tier 1 verification. Landlord-only members can still use the existing sample browsing; nearby search communicates backend denials without assigning roles or bypassing authorization. Authentication remains the account/session owner.

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

No permission is requested on mount/startup or just opening the explanation. Not now returns to manual search without a write/request. Denied/blocked permission, disabled services, position failure/timeout, session/account change, Tenant/Tier 1 denial, network/invalid response and pagination errors have safe messages. Permanent denial offers Open app settings; returning requires an explicit retry. Manual search is always available and remains clearly labeled a sample preview on the nearby page.

Nearby cards render only returned title, rent, property type, city/barangay, date and distance, with honest null fallbacks. Numeric decimal strings are preserved rather than coerced for calculations. Cards do not open fixture details or show fake photos/ratings/recommendations. A real full listing-detail query/navigation is outside this RPC-only pass.

Radius is 1/3/5 km, default 3. Each radius change requests page zero from the server; no Haversine filtering or re-sorting is applied. Results remain nearest-first in server order with server distances. Load more uses limit 20 and offsets 20/40/etc., preserves earlier rows on page failure, retries that page explicitly and removes overlapping IDs while preserving first-seen order. Offset progression uses received page count, not deduplicated display count; offset 1000 is the final permitted request. Offset pagination may shift when live listings change; it is not a snapshot/history guarantee.

Changing radius or refreshing location resets pagination. Repeated start/load-more actions are guarded synchronously. Replacement radius searches abort/invalidate older requests. Back, manual search, Home, account/workspace replacement and unmount reset GPS state; older device/RPC/settings responses cannot populate the next search/account. Native one-shot position APIs may finish after cancellation/timeout, but their late result is discarded.

## Backend, privacy and authorization

`public.search_nearby_listings(p_latitude, p_longitude, p_radius_km = 3, p_limit = 20, p_offset = 0)` is the only nearby data operation. The generated structural entry was copied exactly from live generator output; nullable values are additionally handled by the packaged runtime adapter, because SQL RETURNS TABLE does not establish non-null guarantees.

The inspected existing function is STABLE / SECURITY INVOKER, empty search_path, authenticated EXECUTE (no PUBLIC/anon EXECUTE in observed ACL). It checks authenticated identity, Tenant role, Tier 1 and parameter ranges; it reads active listings/active properties, checks availability in Asia/Manila and uses PostGIS on `properties.public_location`. Existing table grants/RLS remain authoritative, including any underlying dependencies. No direct listing/private-location read, grant or policy change is added by GPS integration.

Tenant coordinates exist only in workflow/service request memory, never in UI snapshots, AsyncStorage, account preferences, analytics or debug logs. They are sent only as RPC search parameters, not persisted by frontend writes. Raw backend error objects/coordinates are not displayed/logged. Returned property coordinates are generalized public points; no private/exact property coordinates are queried or exposed. Source inspection/mocked tests do not prove live caller/RLS acceptance or server logging configuration.

## Verification and limitations

Automated evidence, exact counts, package import/Metro validation and compatibility results are maintained in the [implementation history](../implementation-reports/phases/SEARCH_DISCOVERY_IMPLEMENTATION.md). Read-only backend inspection/generation is recorded in the [backend ledger](../implementation-reports/database/SEARCH_DISCOVERY_BACKEND_LEDGER.md). No live search RPC or test data creation was performed. User-reported zero eligible listings is a legitimate empty-state possibility, not independently verified live data in this pass.

No native dependency was added. Existing `expo-location` supplies foreground Android permissions; no app config/native dependency change was needed. Existing clients lacking the already required native modules need a compatible build; no EAS build was run. Hermes/Metro bundle evidence is not device acceptance.

Android acceptance still needed: Tier 1 Tenant -> Discover/Search -> explanation -> Allow while using app -> nearby results/legitimate empty state; test 1/3/5 km and load more with real eligible data when available. Test Deny, cannot-ask-again/settings return, services disabled, timeout/network/page failure and retry; Back/Not now/manual city preview; radius races, account switch and workspace close; no coordinate display/logs; narrow screens and large font scaling. Test Landlord-only, signed-out and non-Tier-1 denials without changing backend permissions. Existing Property/Listing/Verification flows must remain unchanged.

## Deferred and integration boundaries

Broader city/filter/maps/detail/saved-listing backend conversion, recommendation ranking, OSM nearby places, XGBoost, NLP and 360 remain deferred/separately owned. This integration consumes the finished GPS package and existing RPC without taking ownership of their algorithms or database definitions. Future phases update this document, its continuous history and ledger, not per-phase report files.
