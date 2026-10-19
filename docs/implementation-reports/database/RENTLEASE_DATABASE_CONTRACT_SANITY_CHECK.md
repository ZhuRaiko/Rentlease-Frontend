# RENTLEASE Frontend — Database Contract Sanity Check

Inspection date: 2026-10-18.

Canonical structural contract: `src/shared/services/supabase/database.types.ts`.

The generated types resolve the table, column, enum, relationship, and RPC-signature questions for this cohort. **Current Auth queries and `set_user_roles` arguments match the schema.** Verification preview models still need explicit mapping.

`npm.cmd run typecheck` passed during inspection. No source files changed and no backend requests were made.

`RENTLEASE_CONTEXT_RECONSTRUCTION.md` was missing from the checkout during inspection; comparison used the reconstruction report preserved in the conversation.

## 1. Exact table contracts

Notation: `?` means the Insert field may be omitted; `| null` means explicit null is allowed. Optionality does not establish permission to write a field or reveal its default value. `Enums` below refers to the generated helper exported by `database.types.ts`.

### profiles

Source: `database.types.ts:884`.

Required Insert:

```ts
id: string
```

Optional Insert:

```ts
account_status?: Enums<"account_status">
avatar_path?: string | null
bio?: string | null
created_at?: string
display_name?: string
suspended_until?: string | null
suspension_reason?: string | null
tier1_verified_at?: string | null
tier2_verified_at?: string | null
tier3_verified_at?: string | null
trust_score?: number | null
updated_at?: string
```

Row: All those fields exist without `?`. `account_status`, `display_name`, `id`, `created_at`, and `updated_at` are non-null; the other fields are nullable.

Relationships: Generated `Relationships: []`. This file does not establish the relationship between `profiles.id` and `auth.users.id`.

### user_roles

Source: `database.types.ts:1853`.

```ts
// Required Insert
role: Enums<"app_role">
user_id: string

// Optional Insert
created_at?: string
```

Row: `created_at: string`, `role: Enums<"app_role">`, `user_id: string`; all non-null.

Relationships:

- `user_roles_user_id_fkey`: `user_id → profiles.id`.
- Same generated relationship also references `public_profiles.id`.
- Both entries have `isOneToOne: false`.

### verification_submissions

Source: `database.types.ts:1924`.

```ts
// Required Insert
tier: Enums<"verification_tier">
user_id: string

// Optional Insert
id?: string
property_id?: string | null
rejection_reason?: string | null
review_note?: string | null
reviewed_at?: string | null
reviewed_by?: string | null
status?: Enums<"verification_status">
submitted_at?: string
submitted_note?: string | null
updated_at?: string
```

Row:

```ts
id: string
property_id: string | null
rejection_reason: string | null
review_note: string | null
reviewed_at: string | null
reviewed_by: string | null
status: Enums<"verification_status">
submitted_at: string
submitted_note: string | null
tier: Enums<"verification_tier">
updated_at: string
user_id: string
```

Relationships, all `isOneToOne: false`:

- `verification_property_fk`: `property_id → properties.id`.
- `verification_submissions_reviewed_by_fkey`: `reviewed_by → profiles.id`, also exposed against `public_profiles.id`.
- `verification_submissions_user_id_fkey`: `user_id → profiles.id`, also exposed against `public_profiles.id`.

`property_id` is structurally optional/nullable. Its conditional requirement for Tier 3 is a business rule.

### verification_documents

Source: `database.types.ts:1886`.

```ts
// Required Insert
document_type: Enums<"verification_document_type">
storage_path: string
submission_id: string

// Optional Insert
created_at?: string
file_name?: string | null
id?: string
mime_type?: string | null
```

Row: `created_at`, `document_type`, `id`, `storage_path`, and `submission_id` are non-null. `file_name` and `mime_type` are nullable strings.

Relationship:

- `verification_documents_submission_id_fkey`.
- `submission_id → verification_submissions.id`.
- `isOneToOne: false`.

There is no document `user_id`, bucket-name column, public URL column, or file-size column.

### properties

Source: `database.types.ts:932`.

```ts
// Required Insert
barangay: string
city: Enums<"cavite_city">
landlord_id: string
property_type: Enums<"property_type">
public_location: unknown

// Optional Insert
bathrooms?: number
bedrooms?: number
created_at?: string
floor_area_sqm?: number | null
floor_number?: number | null
furnishing_status?: Enums<"furnishing_status">
id?: string
is_active?: boolean
max_occupants?: number | null
safety_rating?: number | null
total_floors?: number | null
updated_at?: string
```

Row: All fields above exist without `?`. Only `floor_area_sqm`, `floor_number`, `max_occupants`, `safety_rating`, and `total_floors` are explicitly nullable. `public_location` remains `unknown`.

Relationships:

- `properties_landlord_id_fkey`: `landlord_id → profiles.id`.
- Same relationship also exposed against `public_profiles.id`.
- `isOneToOne: false`.

Ownership uses **`landlord_id`**, not `owner_id` or `user_id`. This table has no `title` or generic `address` column.

### property_private_locations

Source: `database.types.ts:1122`.

```ts
// Required Insert
address_line_1: string
exact_location: unknown
property_id: string

// Optional Insert
access_instructions?: string | null
address_line_2?: string | null
postal_code?: string | null
updated_at?: string
```

Row: Same fields without `?`; optional nullable fields remain nullable. `updated_at` is non-null. `exact_location` is `unknown`.

Relationship:

- `property_private_locations_property_id_fkey`.
- `property_id → properties.id`.
- **`isOneToOne: true`**.

The repeated `profiles`/`public_profiles` relationship entries above expose relation targets for joins; they should not be interpreted as independent ownership requirements.

## 2. Exact RPC contracts

Source: `database.types.ts:2261` onward.

### set_user_roles

```ts
Args: {
  requested_roles: string[]
}

Returns: {
  role: string
}[]
```

The generated argument is **`string[]`**, not `app_role[]`. The current frontend's narrower Tenant/Landlord array is compatible and preserves the intended self-selection boundary.

### review_verification_submission

```ts
Args: {
  requested_rejection_reason?: string
  requested_review_note?: string
  requested_status: Enums<"verification_status">
  requested_submission_id: string
}

Returns: {
  id: string
  property_id: string | null
  rejection_reason: string | null
  review_note: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  status: Enums<"verification_status">
  submitted_at: string
  submitted_note: string | null
  tier: Enums<"verification_tier">
  updated_at: string
  user_id: string
}
```

Generated return metadata:

```ts
SetofOptions: {
  from: "*"
  to: "verification_submissions"
  isOneToOne: true
  isSetofReturn: false
}
```

It returns a **single submission object**, not an array. Optional reason/note arguments accept strings when supplied; explicit `null` is not in their generated types.

## 3. Exact enum values

| Enum | Generated values |
| --- | --- |
| account_status | active, restricted, suspended, deleted |
| app_role | tenant, landlord, admin |
| verification_tier | tier_2_identity, tier_3_property |
| verification_status | pending, under_review, approved, rejected, cancelled, revoked |
| verification_document_type | passport, drivers_license, umid, philsys_id, land_title, tax_declaration, hoa_document, authorization_to_lease, other |
| property_type | apartment, boarding_house, bedspace, room, studio, condominium, house, dormitory, other |
| listing_status | draft, active, paused, rented, archived, removed |
| tenancy_status | proposed, pending_confirmation, active, ended, cancelled |

Additional enums used by `properties`:

- `cavite_city`: `imus`, `dasmarinas`, `tagaytay`.
- `furnishing_status`: `unfurnished`, `semi_furnished`, `furnished`.

There is no Tier 1 value in `verification_tier`.

## 4. Frontend / generated-schema mismatches

| Area | Finding |
| --- | --- |
| Active Auth queries | Match: profiles, selected columns, user_roles.user_id, role, and requested_roles exist as used |
| Profile model | AccountProfile.display_name permits null; database Row requires string. account_status permits arbitrary string/null; database requires the non-null enum. These are weaker frontend contracts, not current query failures |
| Verification tiers | UI uses 1, 2, 3; submissions require tier_2_identity or tier_3_property. Explicit mapping required |
| Verification statuses | UI includes locked, notStarted, inProgress, which are presentation states only. It lacks under_review, cancelled, and revoked |
| Admin statuses | Awaiting review, Additional information requested, Approved, Rejected are not database enum literals. Additional information requested has no verification-status equivalent |
| Document types | UI labels require mapping. National ID → philsys_id; Driver's License → drivers_license; ownership labels need corresponding mappings. SSS ID and Student's ID have no dedicated enum values |
| Property selection | Preview id/title/address is not a properties Row. A display model can retain those fields, but must derive them from actual columns or confirmed related data |
| Listing status | Preview published and unavailable are not generated values. Do not automatically assign meaning to unavailable; active is the generated publication-related value requiring business confirmation |
| Property types | House for rent and Studio apartment need mapping. Resort for sublease has no direct enum counterpart |
| Required Insert fields | Documents require document_type, storage_path, submission_id; a filename alone is insufficient. Submissions require tier and user_id; Tier 3 additionally needs property_id under the supplied business rule |

Documentation corrections now warranted:

- Previous generated-types-unavailable statements are stale.
- Previous blockers for exact table fields, enum values, ownership column, and review RPC arguments are resolved.
- `AUTH_SUPABASE_INTEGRATION.md` assumptions about column names, active status, and role RPC arguments are structurally confirmed.
- `BACKEND_CONTEXT.md` still describes an older scaffold and missing schema contracts.
- `ROUTES.md` retains contradictory Tier 3 seeking-Landlord and ordinary Admin Preview descriptions.
- `FEATURES.md` still overstates missing Admin authorization relative to current role-gated navigation.

Two additional generated RPCs now exist:

```ts
// refresh_my_tier1_verification
Args: never
Returns: boolean

// update_my_profile
Args: {
  new_avatar_path?: string
  new_bio?: string
  new_display_name: string
}
```

Current frontend code does not use them. Their existence does not prove direct profile updates are forbidden or that Tier 1 refresh must invoke the RPC.

## 5. Backend rules not established by generated types

These remain documentation/backend-behavior facts:

- Signup creates a matching profile through a trigger and assigns no automatic role.
- `profiles.id` corresponds to the authenticated user ID.
- Ordinary onboarding requires confirmed email plus confirmed phone.
- Tier 1 synchronization and trust score 0.40.
- Admin bypasses ordinary onboarding; review authorization uses `is_admin()`.
- Only Tenant/Landlord roles are self-selectable.
- Protected profile fields cannot be edited by ordinary users.
- Tier 3 requires an existing landlord role and caller-owned property.
- Tier 3 approval does not grant landlord.
- Approval updates verification timestamps and trust scores to 0.80/1.00.
- Permitted transitions and rejection/document requirements.
- Verification documents are private, with authenticated owner/Admin access.
- Storage path convention `<USER_ID>/<SUBMISSION_ID>/<UNIQUE_FILENAME>`.

Generated Insert/Update shapes do not express RLS, grants, triggers, checks, transition restrictions, or allowed writes. Optional status does not reveal its default. An enum-typed RPC argument does not prove every enum transition is permitted.

## 6. True blockers

BACKEND CONTRACT REQUIRED for:

1. Storage configuration: exact bucket name, MIME/size limits, access mechanism, and deletion/cleanup rules.
2. Unresolved lifecycle operations: pending-document replacement, rejected resubmission, additional-information requests, and complete cancelled/revoked behavior.
3. Location encoding, if needed: public_location and exact_location are unknown; generated table types do not specify their wire representation. This does not block a Tier 3 selector using IDs, property type, city, and barangay.
4. Write-path policy where undocumented: whether profile changes must use update_my_profile, and intended use of refresh_my_tier1_verification.

No missing structural contract remains for the two requested RPCs or six requested tables.

## 7. Implementation readiness

Safe to implement from generated types:

- Schema-derived models and explicit enum mappings.
- Typed existing Auth/profile/role queries.
- Caller-owned property lookup using properties.landlord_id.
- Verification submission/document metadata queries and payload construction.
- Admin queue/detail reads and correctly shaped review RPC calls, applying documented authorization/lifecycle rules.
- Database-status rendering, including tolerant cancelled/revoked display.

Still needs runtime verification:

- RLS visibility and write permissions.
- Signup/profile triggers, OTP, and Tier 1 synchronization.
- Role selection and Admin/ordinary routing.
- Review transitions, required reasons/documents, and trust-score side effects.
- Private Storage access and failure recovery.

Still needs exact backend confirmation: the limited Storage, unresolved lifecycle, location-encoding, and write-policy items above. The generated schema has substantially reduced the earlier contract blockers.

This report records inspection results only. Saving it does not modify application code or authorize implementation/backend changes.
