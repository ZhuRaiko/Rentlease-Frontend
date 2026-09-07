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
