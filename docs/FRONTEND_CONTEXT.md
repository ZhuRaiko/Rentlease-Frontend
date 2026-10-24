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

### Property & Listing checkpoint (2026-10-23)

Physical-property creation, ordinary property photos and listing draft persistence are IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Saving remains blocked until the separately owned location integration supplies confirmed exact/public coordinates; photos require the returned real property UUID. Listing drafts use save_listing_draft after real property/title/description/rent prerequisites; publication/lifecycle and 360 remain deferred. See [Property & Listing Management](features/PROPERTY_LISTING_MANAGEMENT.md) for authoritative behavior, [phase plan](implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md) for evidence/roadmap and [backend ledger](implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md) for live/external actions. This branch adds no Maps/GPS/geocoding implementation or new stack.
