# Property & Listing backend interaction ledger

Recorded/backfilled: 2026-10-23. Feature: Property & Listing Management, Phases 1 and 2. Environment for all historical backend entries: **live RentLease Supabase**, project `cxfsbwbwmwmgtqfonqth`. This is durable audit evidence, linked from the [living feature document](../../features/PROPERTY_LISTING_MANAGEMENT.md) and [continuous implementation history/roadmap](../phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md).

This is the one continuously updated backend ledger for this feature. Future phases append dated action sections here; do not create per-phase ledger files. Every phase also updates the living feature document and `docs/implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md`. Historical action entries and attribution below are preserved.

## Evidence provenance and limits

Codex's earlier tool observations and the user's explicit governance-pass account are separate evidence sources. External entries below are **user-confirmed external actions**, not operations performed or independently repeated by Codex in this pass. Exact external execution timestamps, test SQL/argument transcripts and advisor receipts were not supplied. Their recording date is 2026-10-23; do not treat it as a proven external execution timestamp. Missing transcripts are evidence gaps, not permission to reconstruct an alleged executed statement.

No feature-specific backend migration/source file for create_property_setup, property-photo policies/trigger/RPC or the DELETE grant was found under `supabase/`; the existing Admin queue migration is unrelated. Generated `database.types.ts` is a structural frontend contract, not a source-controlled backend migration. No migration was created by this documentation pass.

## P1-01: Codex physical-property contract inspection

- **Date / feature / phase:** 2026-10-23, Property & Listing Phase 1; backfilled 2026-10-23.
- **Actor/tool:** Codex, Supabase connector read-only SQL inspection; local generated-type/source review.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** `READ_ONLY_INSPECTION`.
- **Targets/action:** inspected `public.create_property_setup`, `properties`, `property_private_locations`, `property_amenities`, relevant grants/RLS and Tier 1/Tier 3 requirements. Read function/catalog/privilege definitions; no RPC execution by Codex. Full original Phase 1 SELECT transcript is not retained in this repository.
- **Purpose:** confirm the creation contract before connecting the frontend.
- **Result:** existing RPC derives ownership from auth.uid(), requires an active authenticated Tier 1 Landlord, not Tier 3; creates property/private-location/amenity associations transactionally and returns `{property_id: UUID, status: 'created'}`. Direct authenticated table-level INSERT was unavailable for these three property tables. Generated types matched the RPC contract.
- **Durable effect:** none.
- **Rollback/cleanup:** not applicable, read-only.
- **Security/RLS:** definition/grant inspection only; no live denied-case execution by Codex. Client UX checks are not authorization.
- **Backend migration/source:** no matching feature-specific backend file found; generated types available.
- **Android/client runtime:** not performed; RUNTIME-UNVERIFIED. Actual app save remains location-blocked.

## P1-02: External live property-creation RPC test

- **Date / feature / phase:** external execution date not supplied; recorded 2026-10-23, Property & Listing Phase 1.
- **Actor/tool:** **external ChatGPT/Supabase integration, not Codex**, as confirmed by the user.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** `EXTERNAL_BACKEND_CHANGE` + `RPC_TEST` + `TEST_DATA_MUTATION`.
- **Target/action:** `public.create_property_setup(...)`, simulating an authenticated active Tier 1 Landlord without Tier 3. The exact submitted arguments and identity-simulation SQL were not supplied; no executable test transcript is fabricated here.
- **Purpose:** establish that physical-property creation does not require Tier 3.
- **Result:** successful creation returned property UUID **`1bfa99ee-1e3a-459e-bcf9-676ff97b3987`**; private location and amenity associations were inserted through the RPC.
- **Durable effect:** committed test property and associated RPC-created data. This was not a rollback-only test.
- **Rollback/cleanup:** deletion could not be completed through the available safe connector path; see P1-03. Do not assume associated records were removed.
- **Security/RLS:** positive Tier 1/non-Tier 3 case reported. This does not prove all denied cases or client-session behavior.
- **Backend migration/source:** existing live RPC; no matching source-controlled feature backend file/test transcript supplied.
- **Android/client runtime:** external backend integration test, not an Android app test; RUNTIME-UNVERIFIED.

## P1-03: External test-property deactivation after unsuccessful deletion

- **Date / feature / phase:** external execution date not supplied; recorded 2026-10-23, Property & Listing Phase 1 cleanup.
- **Actor/tool:** external ChatGPT/Supabase integration, not Codex; user-confirmed.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** `EXTERNAL_BACKEND_CHANGE` + `TEST_DATA_MUTATION`.
- **Target/action:** property `1bfa99ee-1e3a-459e-bcf9-676ff97b3987`; attempted safe deletion was unavailable, so `is_active = false` was set instead. Exact attempted DELETE and executed UPDATE statements were not supplied. This describes the confirmed field mutation, not a claimed exact SQL transcript.
- **Purpose:** deactivate the committed test fixture without an unsafe deletion path.
- **Result/durable effect:** **the inactive test row remains in the database unless separately cleaned up**. Deactivation is a permanent data update, not deletion or rollback.
- **Rollback/cleanup:** incomplete physical cleanup; private-location/amenity cleanup is not established. No cleanup was attempted in this pass.
- **Security/RLS:** safe-connector capability limitation reported; no claim that every authorized deletion path is impossible.
- **Backend migration/source:** none supplied for this data mutation; original SQL absent.
- **Android/client runtime:** not performed; RUNTIME-UNVERIFIED.

## P2-01: Codex ordinary-photo contract inspection

- **Date / feature / phase:** 2026-10-23, Property & Listing Phase 2; backfilled 2026-10-23.
- **Actor/tool:** Codex, Supabase `execute_sql` read-only calls; Supabase documentation search and local generated-type review.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** `READ_ONLY_INSPECTION`.
- **Targets/action:** selected bucket id/public/file_size_limit/allowed_mime_types from `storage.buckets` for `property-media`; read `pg_get_functiondef` for `set_property_cover_photo`, `can_manage_property` and the non-internal `property_photos` limit trigger; read photo constraints, relevant `pg_policies` definitions and up to three existing `storage_path` values. Generated `property_photos` Row/Insert/Update and cover-RPC signatures were inspected locally. No photo upload, cover RPC call or data write was performed by Codex.
- **Purpose:** verify storage/metadata/path/authorization contracts for ordinary photos.
- **Result:** public bucket; 10,485,760 bytes; JPEG/PNG/WebP. Observed metadata prefixes paths with `property-media/`, while Storage object keys omit it. Limit trigger uses per-property transaction advisory locking and raises `22023` at ten rows. Cover RPC takes `p_photo_id UUID`, returns void, checks management rights, clears the old cover and sets the selected one. Constraints include UUID PK, cascading property FK and nonnegative sort_order. RLS definitions use the helpers below.
- **Durable effect:** none.
- **Rollback/cleanup:** not applicable, read-only. No user/photo IDs are reproduced from sample rows because they are unnecessary for this contract record.
- **Security/RLS:** observed `property_photos_manage_owner_admin` through `can_manage_property(property_id)` and read through `can_view_property(property_id)`; Storage owner/property namespace policies. These definition reads are not live owner/non-owner client tests.
- **Backend migration/source:** no matching feature-specific backend source found; generated types inspected.
- **Android/client runtime:** not performed; RUNTIME-UNVERIFIED.

## P2-02: External schema/index/privilege inspection

- **Date / feature / phase:** external execution date not supplied; recorded 2026-10-23, Property & Listing Phase 2.
- **Actor/tool:** external ChatGPT/Supabase integration, not Codex; user-confirmed inspection.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** `READ_ONLY_INSPECTION`.
- **Targets/action:** `property_photos` schema, constraints/indexes, photo-limit trigger, `set_property_cover_photo`, table/column privileges, photo RLS, Storage policies, `property-media` bucket and existing object-path conventions. Exact external SELECT statements not supplied. Post-change security advisor inspection is recorded separately in P2-07.
- **Purpose/result:** establish ordinary-photo CRUD/cover contract. Unique partial cover index allows only one cover per property; authenticated UPDATE is intentionally column-scoped to `alt_text`, `sort_order`, `is_cover`. **No broad table-level UPDATE grant was added.** Existing SELECT/INSERT and owner/Admin authorization remain the baseline. DELETE privilege was added separately in P2-03.
- **Durable effect:** none from inspection.
- **Rollback/cleanup:** not applicable, read-only.
- **Security/RLS:** inspected policy/privilege structure; runtime denied-case outcomes are recorded separately below.
- **Backend migration/source:** no corresponding feature backend source/test transcript supplied.
- **Android/client runtime:** not performed/reported; RUNTIME-UNVERIFIED.

## P2-03: External permanent DELETE privilege grant

- **Date / feature / phase:** external execution date not supplied; recorded 2026-10-23, Property & Listing Phase 2.
- **Actor/tool:** **external ChatGPT/Supabase integration, not Codex**, confirmed by the user.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** `EXTERNAL_BACKEND_CHANGE` + `PRIVILEGE_CHANGE`.
- **Target:** `public.property_photos`, role `authenticated`.
- **Exact executed SQL, supplied by the user:**

```sql
GRANT DELETE ON public.property_photos TO authenticated;
```

- **Purpose:** allow authenticated clients to issue photo-metadata DELETE while preserving row authorization through existing RLS.
- **Result/durable effect:** `authenticated` now has table-level DELETE privilege on `public.property_photos`. This is a permanent live privilege change; it was not undone by the rollback tests below.
- **Rollback/cleanup:** grant remains in effect; no revocation reported/requested. No new test-data effect from the grant itself.
- **Security/RLS:** existing `property_photos_manage_owner_admin` policy remains authoritative via `can_manage_property(property_id)`. Owner DELETE returned the target row; unrelated authenticated user DELETE affected zero rows, both rolled back (P2-05/P2-06). Existing column-scoped UPDATE remains limited to `alt_text`, `sort_order`, `is_cover`; no broad UPDATE grant was added. No RLS redesign was reported.
- **Backend migration/source:** no source-controlled migration for this external grant supplied/found. This ledger records the exact statement but is not a migration or replay authorization.
- **Android/client runtime:** backend tests only; no Android verification reported, RUNTIME-UNVERIFIED.

## P2-04: External cover-photo RPC rollback test

- **Date / feature / phase:** external execution date not supplied; recorded 2026-10-23, Property & Listing Phase 2.
- **Actor/tool:** external ChatGPT/Supabase integration, not Codex; user-confirmed.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** `ROLLBACK_TEST` + `RPC_TEST`.
- **Target/action:** `set_property_cover_photo(p_photo_id UUID)` in a transaction followed by rollback. Exact photo UUID, argument value, identity setup and SQL transaction transcript were not supplied.
- **Purpose/result:** validate cover switching through the existing atomic RPC; user reports rollback-based cover test performed. Detailed row-count/assertion output is not supplied.
- **Durable effect:** none from the test.
- **Rollback/cleanup:** transaction rolled back; no retained cover change reported.
- **Security/RLS:** positive authorized cover test; no additional denied-cover test is claimed.
- **Backend migration/source:** no source-controlled test/migration supplied; existing live RPC tested.
- **Android/client runtime:** not an Android/client test; RUNTIME-UNVERIFIED.

## P2-05: External owner metadata DELETE rollback test

- **Date / feature / phase:** external execution date not supplied; recorded 2026-10-23, Property & Listing Phase 2.
- **Actor/tool:** external ChatGPT/Supabase integration, not Codex; user-confirmed.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** `ROLLBACK_TEST` + `TEST_DATA_MUTATION`.
- **Target/action:** Owner Test User issued DELETE on the target owned `public.property_photos` row with returned-row verification, inside a rolled-back transaction. Exact DELETE predicate/SQL, test photo ID and identity simulation were not supplied; no invented executable statement is presented.
- **Purpose/result:** verify effective DELETE privilege plus owner RLS; DELETE returned the target photo row.
- **Durable effect:** none from test data. P2-03's permanent grant remains separate.
- **Rollback/cleanup:** rolled back; existing photo rows remained intact. No Storage object deletion is reported by this metadata-only test.
- **Security/RLS:** positive owner case passed as externally reported.
- **Backend migration/source:** no test transcript/source file supplied.
- **Android/client runtime:** not performed; RUNTIME-UNVERIFIED.

## P2-06: External unrelated-user DELETE rollback test

- **Date / feature / phase:** external execution date not supplied; recorded 2026-10-23, Property & Listing Phase 2.
- **Actor/tool:** external ChatGPT/Supabase integration, not Codex; user-confirmed.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** `ROLLBACK_TEST`.
- **Target/action:** Unrelated Test User attempted DELETE against another owner's `public.property_photos` row inside a rolled-back transaction. Exact DELETE predicate/SQL, IDs and identity setup not supplied.
- **Purpose/result:** validate the negative RLS case after DELETE privilege was granted; affected zero rows.
- **Durable effect:** none.
- **Rollback/cleanup:** transaction rolled back; existing photo rows remained intact; no Storage operation reported.
- **Security/RLS:** denied unrelated-user case passed as externally reported. Granting DELETE did not grant unrestricted row access in this test.
- **Backend migration/source:** no test transcript/source file supplied.
- **Android/client runtime:** not performed; RUNTIME-UNVERIFIED.

## P2-07: External post-grant security-advisor inspection

- **Date / feature / phase:** external execution date not supplied; recorded 2026-10-23, Property & Listing Phase 2.
- **Actor/tool:** external ChatGPT/Supabase integration, Supabase security advisor; not Codex, user-confirmed.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** `READ_ONLY_INSPECTION`.
- **Target/action:** post-change Supabase security-advisor run; exact tool invocation/raw report not supplied.
- **Purpose/result:** check security findings after the grant. Previously existing broader warnings remained, including exposed SECURITY DEFINER functions and mutable `set_updated_at` search path. **The user confirms these warnings were pre-existing and were not introduced by the Phase 2 DELETE grant.** This is external attribution, not a fresh advisor finding in this pass.
- **Durable effect:** none; no security fixes performed.
- **Rollback/cleanup:** not applicable, read-only. Warnings remain outside this documentation pass.
- **Security/RLS:** does not establish blanket production security or formal compliance; preserve warnings for authorized backend follow-up.
- **Backend migration/source:** no advisor receipt or remediation file supplied.
- **Android/client runtime:** not performed; RUNTIME-UNVERIFIED.

## Documentation-governance pass boundary (2026-10-23)

This backfill was assembled from prior Codex observations, local repository sources and the user's external-action account. **No live Supabase action was performed in this documentation pass.** No mutation, RPC execution, SQL execution against the project, advisor rerun or cleanup was performed.

No permanent live backend mutation was performed in this phase.

This statement applies only to the current documentation-governance phase. Historical external persistent effects remain: the inactive Phase 1 test property and the Phase 2 DELETE grant. No new migration, source-controlled backend implementation or Android acceptance is implied by documenting them.

## Outstanding evidence/cleanup

- Inactive property `1bfa99ee-1e3a-459e-bcf9-676ff97b3987` and associated-data cleanup require a separately authorized operator if removal is desired; do not delete it automatically.
- Original external RPC payload, deactivation SQL, rollback-test SQL/arguments, execution dates and advisor output are unavailable. Attach authorized original receipts if later supplied; do not reconstruct them as historical facts.
- No source-controlled backend file for the external DELETE grant was supplied. Recording its SQL does not apply or migrate it elsewhere.
- Android creation/photo operations, live client Storage cleanup and broader negative authorization cases remain unverified. The external backend tests do not resolve the teammate-owned location dependency.
