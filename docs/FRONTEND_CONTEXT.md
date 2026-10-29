# RENTLEASE Frontend Context

## Application

RENTLEASE is an Android mobile rental marketplace for tenants and landlords in:

- Imus, Cavite
- Dasmariñas, Cavite
- Tagaytay, Cavite

Primary actors:

- Tenant
- Landlord
- Admin
- Platform/System

## Feature Cohorts

Current statuses are indexed in [FEATURES.md](FEATURES.md). Auth/account ownership, event synchronization and document foundation details live in [Authentication & Profiles](features/AUTHENTICATION_PROFILES.md) and [User Verification](features/USER_VERIFICATION.md). Generated `src/shared/services/supabase/database.types.ts` is the structural contract; the singleton remains typed with `Database`. Implemented frontend code is not evidence of successful live runtime flows.

1. Authentication & Profiles
2. User Verification
3. Property & Listing Management
4. Search & Discovery
5. Property Recommendations
6. Rental Price Estimation
7. Messaging & Viewing Schedules
8. Tenancy Management
9. Maintenance Requests
10. Ratings & Reports
11. Admin & Moderation
12. Notifications

## Confirmed Frontend Technology Stack

### Mobile

- React Native
- TypeScript
- Android API ≥ 24
- Expo
- Expo Go where compatible
- EAS Build
- EAS Update

### Backend consumed by frontend

- Supabase
- PostgreSQL
- PostGIS
- Supabase Auth
- JWT
- Row-Level Security
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions

### Maps/location

- MapTiler
- @maplibre/maplibre-react-native
- MapTiler Geocoding API
- expo-location
- OpenStreetMap Overpass API

### Notifications

- Expo Push Notifications
- Firebase Cloud Messaging as Android push-delivery infrastructure through Expo

### Rental-price estimation

- Existing FastAPI service
- Render hosting
- XGBoost model

## Outside This Frontend Repository

- Python 3.11
- XGBoost training
- scikit-learn
- pandas
- NumPy
- BeautifulSoup
- Google Colab
- FastAPI server implementation
- Render deployment
- Database schema implementation
- Supabase backend administration

## Technologies Not to Introduce Automatically

Do not add the following unless already established in the repository or explicitly requested:

- react-router-dom
- Next.js
- Vite web architecture
- Tailwind CSS web configuration
- Framer Motion
- Leaflet
- Google Maps
- Google Places
- Mapbox
- Firebase Authentication
- Firestore
- Redux
- Zustand
- MobX
- Axios
- GraphQL
- Apollo
- Socket.IO

### Property & Listing checkpoint (2026-10-23)

Physical-property creation, ordinary property photos, listing draft persistence, explicit RPC publication and landlord pause/reactivate/archive are IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. MapTiler/MapLibre render/pin/review is user-reported partially Android runtime-verified. The approved deterministic 300m Web Mercator cell-center public-point rule and complete exact/public handoff are implemented/automated-tested; property creation is no longer blocked by missing policy, but successful Android persistence remains unverified; photos require the returned real property UUID. Listing drafts use save_listing_draft after real property/title/description/rent prerequisites; publication uses publish_listing with backend-owned eligibility; lifecycle uses pause_listing/reactivate_listing/archive_listing with explicit confirmation and uncertain-outcome reconciliation. Rented/removed/archived have no landlord mutation controls; 360 remains deferred. See [Property & Listing Management](features/PROPERTY_LISTING_MANAGEMENT.md) for authoritative behavior, [phase plan](implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md) for evidence/roadmap and [backend ledger](implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md) for live/external actions. The explicitly authorized feature/maptiler-property-location pass adds property exact/public confirmation using the maintained MapLibre package, requiring a fresh native development build. GPS/discovery/OSM/ML/NLP/360 integrations remain untouched.


### Composer and persisted portfolio checkpoint (2026-10-29)

My Listings is now owner-backend-backed and property-centered, including property-only records and deterministic listing/Tier 3 status/history. Post starts clean creation with item journals preserved. Post opens Property with local media before UUID, then local-only Next opens Listing Details. Save there coordinates confirmed property, sequential photos and draft persistence; advanced media management remains secondary. Notices are workspace-scoped; fixtures do not drive normal My Listings. Existing drafts/publication/lifecycle mutation contracts are unchanged. IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED; the image-picker addition requires a development-client rebuild, not an automatically run build. See [Property & Listing Management](features/PROPERTY_LISTING_MANAGEMENT.md#streamlined-composer-and-real-landlord-portfolio-2026-10-29).
