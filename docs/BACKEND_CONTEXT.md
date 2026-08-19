# RentLease Frontend — Backend Integration Context

## Purpose

This document summarizes the frontend architectural scaffold and identifies the backend contracts required for future feature implementation.

The repository is strictly an Android-first React Native frontend. It does not contain database migrations, backend services, Python/ML code, seeded records, or authoritative authorization logic.

## Current frontend foundation

- Expo SDK 57 and React Native 0.86.2
- TypeScript with strict checking
- Android-only Expo configuration
- EAS development, preview APK, production APK, and OTA-update configuration
- Feature-oriented MVVM structure
- One centralized Supabase client
- Shared integration boundaries for Supabase, MapTiler, Overpass, device location, Expo notifications, and FastAPI
- Shared normalized error and asynchronous-state conventions
- No navigation library or feature routes yet
- No production feature screens yet; only the minimal application root exists

## Architecture boundary

```text
React Native View
        ↓
Feature ViewModel
        ↓
Service / Data Access
        ↓
Supabase / MapTiler / Overpass / FastAPI / Expo device service
```

Views never access Supabase or other external services directly. ViewModels coordinate feature workflows, validation, loading state, error state, and subscription lifecycle. Services own external communication. Models provide typed, framework-independent contracts.

## Environment variables

The frontend expects the following public Expo variables:

| Variable | Purpose | Backend responsibility |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | Provide the correct project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Client-safe Supabase key | Provide only the public/anonymous key |
| `EXPO_PUBLIC_MAPTILER_API_KEY` | Map tiles and geocoding | Provide a client-safe restricted key |
| `EXPO_PUBLIC_FASTAPI_BASE_URL` | Rental price-estimation service | Provide the deployed HTTPS base URL |

The Supabase `service_role` key and all other server secrets must never be supplied to the frontend. Expo public environment variables are embedded in the application bundle.

## Supabase integration

### Implemented frontend boundary

- `src/shared/services/supabase/client.ts` provides the only Supabase client factory.
- `auth/authService.ts` currently exposes session retrieval and sign-out.
- `storage/storageService.ts` exposes the configured Supabase Storage client without assuming bucket names.
- `realtime/realtimeService.ts` creates and removes feature-specific channels.
- `edgeFunctions/edgeFunctionService.ts` invokes only function names supplied by confirmed feature code.
- `database/README.md` reserves the location for generated database types.

### Backend information required

- Generated TypeScript database types from the canonical Supabase schema
- Confirmed tables, views, database functions, columns, relationships, and enums
- RLS policies for tenant, landlord, admin, and shared records
- Profile/role retrieval contract after authentication
- Confirmed Storage bucket names and permitted file types/sizes
- Confirmed Realtime publication and message subscription contract
- Confirmed Edge Function names and request/response contracts

The frontend will not infer tables or columns from prose. Generated schema types or executable migrations should be treated as authoritative.

## Authentication and authorization

The planned authentication system is Supabase Auth with JWT-backed sessions. PostgreSQL Row-Level Security remains the authoritative security layer.

The frontend eventually needs backend-supported contracts for:

- Registration and login
- Session restoration
- Current profile retrieval
- Tenant/landlord role retrieval
- Admin authorization
- Verification tier/status
- Suspension or moderation status

Roles, trust scores, verification states, and admin status must be assigned and validated by trusted backend logic. Frontend checks will only hide actions or control navigation; they are not security enforcement.

## Database and PostGIS

No SQL or PostGIS calculations were added to the frontend.

For discovery features, the expected flow is:

```text
Device coordinates
        ↓
Search ViewModel
        ↓
Confirmed Supabase query or RPC
        ↓
PostgreSQL/PostGIS
        ↓
Typed nearby-listing result
```

The backend must define the authoritative coordinate representation, distance units, supported filters, pagination rules, and PostGIS query/RPC contract.

## Storage

The frontend has a generic Storage boundary but assumes no bucket names. The backend must confirm buckets and RLS policies for expected uses such as:

- Profile avatars
- Property images
- Verification documents
- Permitted message attachments

Required contract details include allowed MIME types, maximum file sizes, ownership rules, path conventions, signed/public URL behavior, and deletion permissions.

## Realtime messaging

The frontend supports creating and cleaning up feature-specific Supabase Realtime channels. It does not globally subscribe to the database.

Before messaging implementation, the backend must confirm:

- Conversation and message schema
- Membership/participant authorization rules
- Realtime publication configuration
- Insert/read/update permissions
- Message ordering and pagination fields
- Attachment relationship, if supported
- Read/delivery-state contract, if supported

ViewModels will start subscriptions when their screen/feature becomes active and remove them during lifecycle cleanup.

## Maps, geocoding, and amenities

MapTiler is the approved tile and geocoding provider. MapLibre is the planned native renderer. MapLibre screens will require an Expo development/EAS build because custom native modules are unavailable in stock Expo Go.

The geocoding service currently returns candidate identifiers, labels, longitude, and latitude. A future listing ViewModel will coordinate candidate selection and map-pin confirmation before submitting validated coordinates.

Nearby amenity lookup uses OpenStreetMap Overpass for schools, hospitals, malls, and transport terminals. These third-party results are not authoritative backend records unless the backend later defines a persistence/cache contract.

## Rental price estimation

The frontend contains a generic native-`fetch` client for the configured FastAPI service. No endpoint, request payload, response payload, or prediction result was invented.

The ML/backend team must provide:

- HTTPS endpoint path
- Versioned request schema
- Versioned response schema
- Units and currency
- Required and optional property attributes
- Validation constraints
- Error response format
- Timeout/retry expectations
- Model/version metadata intended for users
- Authentication or rate-limit requirements

XGBoost inference, preprocessing, feature engineering, training assets, and scraping remain outside this repository.

## Push notifications

The Expo notification service can request permission and obtain an Expo push token. Device-token registration is intentionally not implemented because no backend endpoint is confirmed.

The backend must define:

- Token registration/upsert endpoint or Supabase contract
- Association between tokens, authenticated users, and devices
- Token revocation and logout behavior
- Notification preference model
- Supported notification event types
- Payload/deep-link contract
- Server-side Expo Push API integration

Firebase Cloud Messaging is used only as Expo's Android delivery relay; Firebase Auth and Firestore are not part of the architecture.

## Feature cohorts awaiting contracts

| Feature | Primary backend contract needed |
|---|---|
| Authentication & Profiles | Auth flow, profiles, roles, session behavior |
| User Verification | Verification submissions, statuses, protected documents |
| Property & Listing Management | Listing schema, media storage, publishing lifecycle |
| Search & Discovery | Filters, pagination, PostGIS proximity query |
| Property Recommendations | Preference and recommendation result contracts |
| Rental Price Estimation | FastAPI request/response contract |
| Messaging & Viewing Schedules | Conversations, messages, Realtime, schedules |
| Tenancy Management | Tenancy lifecycle and rental obligations |
| Maintenance Requests | Request lifecycle, assignments, attachments |
| Ratings & Reports | Eligibility, moderation, rating/report contracts |
| Admin & Moderation | Admin authorization and moderation actions |
| Notifications | In-app records, push events, device-token registration |

## Backend handoff checklist

- Export generated Supabase TypeScript types from the canonical schema.
- Document RLS behavior for each user role and feature.
- Provide confirmed RPC, Edge Function, and API contracts.
- Provide Storage bucket and upload-policy details.
- Provide Realtime publication and subscription details.
- Provide FastAPI endpoint and typed payload examples.
- Provide push-token registration and notification payload contracts.
- Provide stable error codes/messages suitable for frontend normalization.
- Avoid sending private keys or server secrets to the frontend repository.

## Related frontend documents

- `docs/ARCHITECTURE.md` — MVVM rules and integration boundaries
- `docs/FEATURES.md` — feature cohort status
- `docs/ROUTES.md` — screens/routes that currently exist
