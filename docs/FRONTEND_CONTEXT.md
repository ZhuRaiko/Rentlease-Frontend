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
- react-native-maplibre-gl
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

### Physical property setup checkpoint (2026-10-23)

Property & Listing now has a typed create_property_setup service, testable creation workflow, structured physical-property form behind MVVM. Four required coordinate service inputs remain distinct; saving is blocked with a non-error notice until the separately owned MapTiler/location workflow supplies confirmed exact and approved generalized public coordinates. This branch adds no Maps/GPS/geocoding or manual coordinate-entry UX. Listings/media/publication remain previews/deferred. No new stack or navigation library is added. See [Phase 1 property boundary](ROUTES.md#phase-1-physical-property-creation-2026-10-23) for authoritative current behavior, validation and runtime limitations.
