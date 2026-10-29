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
