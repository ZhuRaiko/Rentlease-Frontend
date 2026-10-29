# RentLease frontend architecture

## Platform and toolchain

RentLease is an Android-first React Native and strict TypeScript application using Expo SDK 57 (React Native 0.86). Android 7/API 24 or newer is supported by this SDK. Expo Go is the iterative test path for Expo-Go-compatible features; EAS development builds are required for custom native modules such as `@maplibre/maplibre-react-native`. EAS Build produces evaluation/production APKs and EAS Update provides OTA delivery.

The approved integration stack is Supabase (PostgreSQL/PostGIS, Auth/JWT/RLS, Storage, Realtime and Edge Functions), MapTiler/MapLibre, MapTiler Geocoding, `expo-location`, OpenStreetMap Overpass, Expo Notifications with Android delivery through FCM, and a Render-hosted FastAPI service that owns XGBoost inference. Figma remains the visual source of truth; reuse the existing shared theme, assets and feature UI. The document foundation uses Expo DocumentPicker, FileSystem and Crypto behind services, without another state manager. Ordinary property photos additionally use the explicitly requested expo-image-picker gallery adapter; verification keeps DocumentPicker.

Verification image inspection shares one fullscreen component using Expo-compatible react-native-gesture-handler ~2.32.0 and core Animated. Gestures are presentation-only; private signed-URL ownership remains in the Admin ViewModel/service. The Modal contains its own GestureHandlerRootView; no navigation framework or Reanimated plugin is added. Development builds predating this native dependency need rebuilding. Gesture runtime acceptance remains documented under the verification feature docs.

## MVVM dependency direction

```text
VIEW
  ↓
VIEWMODEL
  ↓
SERVICE / DATA ACCESS
  ↓
SUPABASE / MAPTILER / OVERPASS / FASTAPI / EXPO DEVICE SERVICE

MODEL TYPES ↑ are typed contracts used by the appropriate layers.
```

Views render React Native UI, bind ViewModel state/actions, and own UI-only state. Views never access backend or external-service clients directly.

ViewModels own feature state, validation orchestration, loading/error/success state, derived presentation state, workflows, and subscription lifecycle. They call services and contain no TSX.

Models are framework-independent TypeScript contracts, constants and domain values. They contain no hooks, UI, navigation or data access.

Services under `src/shared/services` own approved integrations. They contain no UI or feature ViewModel imports. A feature-specific service stays with its feature until at least two features genuinely share it.

## Feature isolation and shared code

Each cohort has a directory under `src/features`. When implemented, it owns `models/`, `viewModels/`, and `views/`. A feature may use its own modules and shared modules, but must not import another feature's ViewModel or View. Shared code is reserved for behavior used by multiple features.

The common async convention is `idle | loading | success | error`; ViewModels normalize errors to `AppError` before exposing them to Views. There is no global feature-state store. React Context is reserved for genuine cross-cutting state such as an authenticated session.

The root Authentication ViewModel owns one authoritative account snapshot. Its service-owned Auth subscription forwards synchronous notifications; the ViewModel defers/coalesces refreshes, invalidates stale results and unsubscribes on cleanup. Background refresh does not reset same-destination presentation state. The Auth ViewModel also owns bounded onboarding foreground and one delayed pending-state check through that coordinator; lifecycle cleanup and explicit-operation guards stay in the ViewModel. Shared ScreenHeader owns only compact visual navigation. See [Authentication & Profiles](features/AUTHENTICATION_PROFILES.md) for event and routing details. Auth currently retains its existing friendly string error mapper; document services use the lightweight shared AppError shape with safe messages and internal causes.

## Integration boundaries

- Supabase: `getSupabaseClient()` is the sole client factory. Only public URL/anon-key environment variables are accepted; never use a `service_role` key. RLS is authoritative. Client checks only affect presentation/navigation. Auth, Storage, Realtime, and confirmed Edge Function entry points are separated. Subscription creation is service-owned and cleanup is ViewModel-owned.
- Database/PostGIS: generated `src/shared/services/supabase/database.types.ts` is the canonical structural contract. The singleton is `SupabaseClient<Database>`. The explicit Admin queue exception is supabase/migrations/20261020134152_get_admin_verification_queue.sql, a narrow Admin-gated read-only summary approved by the user; other backend schema/infrastructure work remains outside this frontend repository. Generated types do not describe RLS, triggers, permitted transitions or business rules. PostGIS calculations execute in PostgreSQL and are consumed through confirmed database functions/queries later.
- MapTiler/MapLibre: map URL configuration lives in the map service. Physical-property exact-pin rendering uses @maplibre/maplibre-react-native 11.5.0 in an isolated View with the Expo config plugin. MapLibre requires an EAS development build rather than stock Expo Go.
- Geocoding: typed address searches call only MapTiler through the geocoding service; propertyLocationWorkflow coordinates explicit candidate selection, address-revision invalidation and exact-pin confirmation. A pure property-location privacy model derives the deterministic 300m Web Mercator cell-center public point. The composed ViewModel passes exact/public coordinates through the existing revision-checked creation boundary; save remains subject to unchanged complete-form validation. Future ordinary GPS/discovery must consume the public point.
- Device location: `expo-location` permission and coordinate acquisition live in the location service. A discovery ViewModel owns workflow state.
- Amenities: the Overpass service is the only POI boundary and is limited to schools, hospitals, malls and transport terminals.
- ML: the generic price-estimation client calls the configured FastAPI host using `fetch`. Its endpoint and request/response types remain caller-supplied until the backend contract is confirmed. Python, XGBoost, training, scraping, Colab and Render deployment do not belong here.
- Notifications: the notification service requests permission and obtains an Expo token. A future confirmed backend service must register that token. FCM is only Expo's Android delivery relay.
- Navigation: no navigation library is installed. Existing routing uses root-owned workspace state/Modal and feature screen state. Preserve that approach and backend-derived role gates; do not add a router merely for integration. Root Profile return uses one in-memory owner-scoped top-level predecessor validated by shared/models/profileReturn.ts, with an authorized landing fallback. Dismissed tools never become Profile history. Visible and hardware Back share this policy; identity/eligibility changes invalidate stale workspaces/targets. Each root Modal feature registers its ViewModel Back action with cleanup, scoped to the current workspace/account. Bottom-tab root hardware Back has a separate callback from explicit Profile/Close entry: Discovery requests Android exit confirmation; other bottom roots return to Discovery after feature guards. Shared exit coordination lives in a ViewModel with an Android device service for Alert/exitApp; delayed confirmations are account/workspace scoped. This is not persistent nested-screen restoration.

## Environment

Copy `.env.example` to an untracked `.env` and provide client-safe values. Expo inlines `EXPO_PUBLIC_*` variables in the application bundle; they must never contain private server secrets.

### Phase 2 corrections checkpoint (2026-10-22)

Auth onboarding continuity now uses an existing AsyncStorage-backed service for account-scoped pending/done Matching Preferences introduction markers. The Auth ViewModel coordinates reads/completion and the root retains workspace composition. This stores no credentials, snapshots or preference contents; matching preference values remain process-local. No new state library, navigation framework, client or account owner was introduced.

Baseline: `550275c` plus uncommitted corrections. Typecheck passed; full automated suite passed 213/213, zero failures/skips/cancellations. These checks do not establish Android runtime acceptance.


### Property workspace ownership (2026-10-29)

Property & Listing composition now separates a Phase 1 creation receipt from active workspace property/listing IDs and create/compose/manage mode. A read-only paginated portfolio service loads owner properties/listings/property-specific Tier 3 and validated cover URLs. My Listings owns persisted selection; Post detaches item workflows without erasing recovery journals. Service/workflow mutation primitives remain separate. The composed ViewModel coordinates explicit Save across property -> media -> draft; Property and Listing Details share ViewModel state before/after UUID persistence; Next only navigates. Media reuses the shared fullscreen zoom viewer with optional gallery controls. The map is a temporary modal over the mounted composer. Listing notices render inside matching item surfaces, never globally over property setup or maps. See [current feature detail](features/PROPERTY_LISTING_MANAGEMENT.md#streamlined-composer-and-real-landlord-portfolio-2026-10-29).
