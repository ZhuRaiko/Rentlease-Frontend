# RentLease Frontend — Backend Integration Context

## Purpose

This document records shared backend integration boundaries. Feature-specific current implementation and runtime gaps live in [Authentication & Profiles](features/AUTHENTICATION_PROFILES.md) and [User Verification](features/USER_VERIFICATION.md).

The repository is strictly an Android-first React Native frontend. It contains one explicitly requested and approved Admin verification queue RPC migration under supabase/migrations, applied to the live project with regenerated types. It does not contain a Node/Express backend, Python/ML implementation or seeded records. See [Admin Verification](features/ADMIN_VERIFICATION.md) for the narrow exception and its authorization boundary.

## Current frontend foundation

- Expo SDK 57 and React Native 0.86.3
- TypeScript with strict checking
- Android-only Expo configuration
- EAS development, preview APK, production APK, and OTA-update configuration
- Feature-oriented MVVM structure
- One centralized `SupabaseClient<Database>` using the generated structural contract
- Shared integration boundaries for Supabase, MapTiler, Overpass, device location, Expo notifications, and FastAPI
- Shared normalized error and asynchronous-state conventions
- Existing root workspace/Modal and feature-state routing; no navigation library
- Real Auth/Profile integration and root Auth-event synchronization; live flows RUNTIME-UNVERIFIED
- Tier 2 Passport submission/upload/metadata and Admin queue/detail/private image viewing are user-reported Android PASS. Tier 2 approval is user-reported Android development-build PASS. Tier 3 owned-property submission and Admin compatibility are implemented/automated-tested but Android RUNTIME-UNVERIFIED; broader negative cases remain required. See the feature docs. Other feature contents primarily remain previews

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

- `src/shared/services/supabase/client.ts` provides the only typed Supabase client factory.
- Feature-local `authentication/services/accountService.ts` owns active Auth/profile/role operations and the Auth subscription; shared `auth/authService.ts` retains older session/sign-out wrappers.
- `storage/storageService.ts` exposes the Storage client. Verification uses the private `verification-documents` bucket for normal-user upload and Admin short-lived image links. Admin Tier 2/3 review uses the existing `review_verification_submission` RPC; Tier 3 approval requires qualifying ownership/authorization metadata. Existing backend triggers/derived trust values are not manually updated by the Admin client.
- `realtime/realtimeService.ts` creates and removes feature-specific channels.
- `edgeFunctions/edgeFunctionService.ts` invokes only function names supplied by confirmed feature code.
- `database.types.ts` contains generated tables, relationships, enums and RPC signatures. The older `database/` directory is not the canonical type location.

### Backend information required

- Generated types now resolve structural tables, views, database functions, columns, relationships and enums; regenerate from the canonical schema when it changes
- RLS policies for tenant, landlord, admin, and shared records
- Runtime validation of own profile/role retrieval and permission behavior
- Other Storage bucket contracts; verification bucket is known but MIME/size limits and replacement/deletion lifecycle remain unresolved
- Confirmed Realtime publication and message subscription contract
- Confirmed Edge Function names and request/response contracts

The frontend will not infer tables or columns from prose. Generated schema types or executable migrations should be treated as authoritative.

## Authentication and authorization

The implemented frontend uses Supabase Auth with JWT-backed sessions and persisted-session bootstrap plus Auth-event account refresh. PostgreSQL Row-Level Security remains the authoritative security layer. These flows are RUNTIME-UNVERIFIED.

Auth signup/sign-in/sign-out, profile/role retrieval, account-status gating and Admin routing are implemented against the confirmed/generated contracts. Runtime validation is still needed for:

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

For the connected GPS-only Discovery path, the flow is:

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

GPS now consumes the existing search_nearby_listings RPC through the packaged adapters: radius 1/3/5 km, page limit 20, offsets up to 1000; returned distances are meters and server order is preserved. Tenant + Tier 1 and existing RLS remain authoritative. It reads public generalized property locations only. No backend mutation or live caller test was performed. Manual city/filter/map/recommendation backend work remains deferred. See [Search & Discovery](features/SEARCH_DISCOVERY.md) and its linked ledger for exact inspection provenance.

## Storage

The generic Storage boundary remains reusable. Verification has a private upload primitive for `verification-documents`, path `<USER_ID>/<SUBMISSION_ID>/<UNIQUE_FILENAME>`, with `upsert: false` and no public URLs. The production Tier 2/3 workflows create real submissions before upload; file selection alone does not upload. Admin image viewing uses on-demand 90-second signed links. See [User Verification](features/USER_VERIFICATION.md) and [Admin Verification](features/ADMIN_VERIFICATION.md).

Other bucket and RLS contracts remain necessary for expected uses such as:

- Profile avatars
- Other media uses; ordinary property images now have the confirmed contract linked below
- Verification documents
- Permitted message attachments

Verification MIME types, maximum size, private retrieval and replacement/deletion lifecycle remain unresolved. Do not infer them from generated types or picker acceptance. Other buckets additionally need ownership/path/access contracts.

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

MapTiler is the approved tile and geocoding provider. MapLibre 11.5.0 renders exact property-pin confirmation. MapLibre screens require an Expo development/EAS build because custom native modules are unavailable in stock Expo Go.

The geocoding service currently returns candidate identifiers, labels, longitude, and latitude. The dedicated property-location workflow coordinates candidate selection and exact-pin confirmation, and derives the approved deterministic 300m Web Mercator grid-center public point. The revision-checked handoff populates all four required coordinates; only explicit property saving invokes the unchanged create_property_setup contract. Exact points remain private; future ordinary GPS/discovery consumes public points.

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
| Authentication & Profiles | Structural contract present; live Auth/RLS/trigger validation required |
| User Verification | Structural submissions/status contract present; MIME/size, private access documented; Tier 2 correction/resume integrated, atomic finalization/replacement unresolved |
| Property & Listing Management | Property/photo/draft/publication/lifecycle RPC integration implemented; Android runtime unverified; tenancy/moderation status ownership preserved |
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

- Keep the existing generated Supabase TypeScript contract synchronized with the canonical schema.
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

### Phase 2 corrections checkpoint (2026-10-22)

Read-only inspection of RentLease on 2026-10-22 confirms properties_create_verified_landlord requires own landlord_id, Landlord membership and Tier 1, without Tier 3. Tier 3 submission validation requires an existing property owned by the submitting Landlord. listings_create_owner checks ownership/Tier 1/Landlord; listings_update_owner_admin allows owner/Admin. validate_listing_owner verifies property ownership and requires draft-first activation with completeness >= 0.80, but contains no property-specific Tier 3 approval check. The only other noninternal listing trigger updates updated_at. This conflicts with the agreed future publication requirement for qualifying approved Tier 3 on that particular property. This was the 2026-10-22 observation. As of 2026-10-25 the externally created publish_listing RPC enforces property-specific approved Tier 3 and duplicate-live checks, with trigger-owned 80% completeness; frontend publication is connected. Authorization is not substituted with an account timestamp or client-only gate. No policy/function/schema changes were made.

Baseline: `550275c` plus uncommitted corrections. Typecheck passed; full automated suite passed 213/213, zero failures/skips/cancellations. These checks do not establish Android runtime acceptance.

### Tier 2 Stage 1 contract and Stage 2 integration (2026-10-22)

Stage 1 was applied externally after frontend baseline `4680416`. Read-only inspection confirms `begin_tier2_verification_resubmission()` and valid/ready unique index `uq_tier2_single_open_or_approved_per_user`: unique user_id for tier_2_identity statuses pending, under_review and approved. Historical rejected/cancelled/revoked rows are excluded. Live type generation changed only this function definition: Args never, one verification_submissions row, isSetofReturn false.

The earlier SECURITY INVOKER privilege blocker was resolved externally. Current inspection confirms SECURITY DEFINER, empty restricted search_path, qualified identifiers, explicit auth.uid()/Tier 1 checks, authenticated EXECUTE and denied anonymous execution. A per-user transaction advisory lock and latest-row FOR UPDATE serialize starts. No row or latest rejected permits a new pending row; pending without metadata returns the same row. Pending with metadata, under_review, approved, cancelled and revoked are blocked. Older active/approved records also prevent insertion; rejected history is never overwritten.

The user reports passed backend tests for rejected/resume, repeated calls, approved/unauthenticated denial, uniqueness and unchanged history. The agent performed read-only inspection, not these live write tests, and made no database changes.

Stage 2 now uses this RPC instead of direct Tier 2 creation, after explicit local review confirmation and fresh identity/status checks. Reconciliation precedes another explicit attempt after uncertain outcomes. See [User Verification](features/USER_VERIFICATION.md#stage-2-tier-2-correction-and-recovery-2026-10-22).

Storage upload and metadata registration remain non-atomic. Metadata INSERT permits owned pending/under_review parents; Storage ownership uses the user path segment. No attachment uniqueness, atomic finalization, orphan cleanup or readiness contract was added. The frontend rechecks before upload/metadata but cannot guarantee cross-client attachment serialization. Tier 3 behavior is unchanged. The earlier [backend recommendation](implementation-reports/database/2026-10-22-tier-2-rejection-recovery-review.md) remains historical, not the current full schema.

### Property & Listing backend boundary (2026-10-23)

Physical-property creation uses existing create_property_setup, deriving ownership and requiring active authenticated Tier 1 Landlord membership without Tier 3. Direct property-table INSERT is not the frontend path. Ordinary photos use public property-media, property_photos and set_property_cover_photo. The property/photo foundations, Phase 3 save_listing_draft and Phase 4 publish_listing integrations are implemented/automated-tested but Android RUNTIME-UNVERIFIED; the public-location rule/complete handoff now remove the intentional policy blocker. Successful Android creation remains unverified; map confirmation itself does not invoke Supabase.

Current behavior/contracts and owner/RLS boundaries live in [Property & Listing Management](features/PROPERTY_LISTING_MANAGEMENT.md#current-backend-authorization). Live action provenance, external RPC test/inactive fixture, exact external DELETE grant, column-scoped UPDATE permissions, rollback tests and pre-existing advisor warnings are recorded in the [backend ledger](implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md). Codex's earlier implementation inspections were read-only; external changes must not be described as Codex-performed or omitted as though no backend changes existed. No live action or backend mutation was performed in the documentation-governance pass. Authenticated listings writes remain RPC-only (direct SELECT only); Phase 3 external function/test provenance is recorded in the ledger. Publication uses the controlled authenticated RPC only, with receipt validation and explicit uncertain-outcome reconciliation. Lifecycle uses pause_listing/reactivate_listing/archive_listing only; rented is tenancy-controlled and removed is Admin-controlled. Direct listing mutation privileges remain unavailable. Teammate-owned integrations remain deferred; see the [phase plan](implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md).


### Read-only landlord portfolio consumption (2026-10-29)

The frontend portfolio uses existing owner-scoped SELECT on properties, listings, own tier_3_property verification_submissions and cover property_photos after confirming owned IDs. Photo URL namespace validation is reused; private locations/coordinates are not queried. The externally supplied audit reports existing grants/RLS sufficient; Codex did not independently rerun it or execute any live action in this pass. No new RPC, generated type, grant, RLS/schema/Storage or backend mutation is required. Creation/photo/draft/publication/lifecycle writes remain in their dedicated existing services. Audit provenance is in the [backend ledger](implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#portfolio-read-contract-and-local-ux-integration-2026-10-29); frontend behavior is in the living feature document.
