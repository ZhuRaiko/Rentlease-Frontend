# RentLease frontend architecture

## Platform and toolchain

RentLease is an Android-first React Native and strict TypeScript application using Expo SDK 57 (React Native 0.86). Android 7/API 24 or newer is supported by this SDK. Expo Go is the iterative test path for Expo-Go-compatible features; EAS development builds are required for custom native modules such as `react-native-maplibre-gl`. EAS Build produces evaluation/production APKs and EAS Update provides OTA delivery.

The approved integration stack is Supabase (PostgreSQL/PostGIS, Auth/JWT/RLS, Storage, Realtime and Edge Functions), MapTiler/MapLibre, MapTiler Geocoding, `expo-location`, OpenStreetMap Overpass, Expo Notifications with Android delivery through FCM, and a Render-hosted FastAPI service that owns XGBoost inference. Figma remains the visual source of truth. No Figma tokens were present, so only neutral bootstrap styles exist.

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

## Integration boundaries

- Supabase: `getSupabaseClient()` is the sole client factory. Only public URL/anon-key environment variables are accepted; never use a `service_role` key. RLS is authoritative. Client checks only affect presentation/navigation. Auth, Storage, Realtime, and confirmed Edge Function entry points are separated. Subscription creation is service-owned and cleanup is ViewModel-owned.
- Database/PostGIS: no schema or SQL exists here. Generate database types from the canonical Supabase schema into `src/shared/services/supabase/database`. PostGIS calculations execute in PostgreSQL and are consumed through confirmed database functions/queries later.
- MapTiler/MapLibre: map URL configuration lives in the map service. Map rendering belongs in a View/shared component only after `react-native-maplibre-gl` is approved and installed. MapLibre requires an EAS development build rather than stock Expo Go.
- Geocoding: typed address searches call only MapTiler through the geocoding service; a future ViewModel must coordinate candidate selection and pin confirmation.
- Device location: `expo-location` permission and coordinate acquisition live in the location service. A discovery ViewModel owns workflow state.
- Amenities: the Overpass service is the only POI boundary and is limited to schools, hospitals, malls and transport terminals.
- ML: the generic price-estimation client calls the configured FastAPI host using `fetch`. Its endpoint and request/response types remain caller-supplied until the backend contract is confirmed. Python, XGBoost, training, scraping, Colab and Render deployment do not belong here.
- Notifications: the notification service requests permission and obtains an Expo token. A future confirmed backend service must register that token. FCM is only Expo's Android delivery relay.
- Navigation: no navigation library or prior routes existed. No unapproved router was added. When a library is approved, the boundary must support public/auth, tenant, landlord, admin and shared authenticated flows using backend-derived roles.

## Environment

Copy `.env.example` to an untracked `.env` and provide client-safe values. Expo inlines `EXPO_PUBLIC_*` variables in the application bundle; they must never contain private server secrets.
