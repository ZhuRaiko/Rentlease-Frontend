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


## Phase 3 - Listing draft persistence (recorded 2026-10-24)

The following entries extend this existing ledger. External actions were supplied by the user with the Phase 3 request; their exact execution timestamps and full test payloads were not supplied. The original DDL was unavailable at initial recording; the user supplied the exact external CREATE/REVOKE/GRANT SQL on 2026-10-25, now preserved in P3-02 below. Recording dates do not prove execution dates. Codex performed only P3-01's read-only inspection, not the external writes/tests. No live save RPC or test-data mutation was executed by Codex in this phase.

### P3-01: Codex live draft contract inspection

- **Date/feature/phase:** 2026-10-24, Property & Listing Phase 3.
- **Actor/tool:** Codex, Supabase connector execute_sql.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** READ_ONLY_INSPECTION.
- **Target/action:** function definition for public.save_listing_draft, authenticated/anon listings table grants, and listings policies. Exact executed SELECT:

```sql
select json_build_object('function',(select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_listing_draft'),'grants',(select json_agg(row_to_json(g)) from (select grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='listings' and grantee in ('authenticated','anon')) g),'policies',(select json_agg(row_to_json(q)) from (select policyname,cmd,qual,with_check from pg_policies where schemaname='public' and tablename='listings') q)) as draft_contract;
```

- **Purpose/result:** confirmed the supplied ten-argument/row-array contract; SECURITY DEFINER and pg_catalog search_path; auth.uid(), active Tier 1, Landlord and owned-active-property checks; nonblank title/description, positive rent, nonnegative deposit/advance and positive optional minimum stay. Per-property advisory transaction lock, latest own draft selection FOR UPDATE, insert-or-update, forced draft and server-derived owner/status/timestamps/completeness. No Tier 3 prerequisite. Authenticated listings table grants returned SELECT only; RLS owner read remains present. Old INSERT/UPDATE/DELETE policy definitions do not confer table privileges.
- **Durable effect:** none.
- **Rollback/cleanup:** not applicable, read-only.
- **Security/RLS:** inspected function/policy/grant definitions, not live denied-client cases. EXECUTE ACL outcomes/advisor tests below are user-confirmed external evidence, not part of this SELECT.
- **Source-controlled backend file:** no Phase 3 backend migration/source supplied; only the missing generated frontend function entry was added from the user-supplied generated contract. No backend migration was created.
- **Android/client runtime:** not performed; RUNTIME-UNVERIFIED, blocked by persisted-property/location prerequisite.

### P3-02: External permanent draft RPC creation

- **Date/feature/phase:** exact external execution date unavailable; recorded 2026-10-24, Property & Listing Phase 3.
- **Actor/tool:** external ChatGPT/Supabase integration, not Codex; user-confirmed.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** EXTERNAL_BACKEND_CHANGE + FUNCTION_CHANGE.
- **Target/action:** permanent creation of public.save_listing_draft with the contract below. Correction recorded 2026-10-25: the user has supplied the exact original CREATE OR REPLACE FUNCTION/REVOKE/GRANT SQL, preserved below as historical evidence of external ChatGPT/Supabase execution, not SQL executed by Codex. P3-01 remains the prior read-only inspection; the supplied SQL is not replayed.

```text
save_listing_draft(
  p_property_id uuid, p_title text, p_description text,
  p_asking_rent_monthly numeric, p_house_rules text DEFAULT NULL,
  p_rental_term rental_term_type DEFAULT long_term,
  p_security_deposit_months numeric DEFAULT 1,
  p_advance_rent_months numeric DEFAULT 1,
  p_minimum_stay_months smallint DEFAULT NULL,
  p_available_from date DEFAULT NULL
)
RETURNS TABLE(listing_id uuid, listing_status listing_status,
  completeness_score numeric, created_at timestamptz, updated_at timestamptz)
SECURITY DEFINER; search_path = pg_catalog
EXECUTE: authenticated yes; anon no; PUBLIC no
```

- **Purpose/result:** provide narrow authenticated create-or-update draft persistence, without broad listings writes/publication. Derives identity from auth.uid(); caller cannot supply landlord, status, timestamps or completeness. Saves are serialized for the same property and reuse an existing own draft.
- **Durable effect:** the live function and controlled EXECUTE permissions remain. **No direct INSERT/UPDATE/DELETE grant was added to listings.** SELECT remains available subject to RLS.
- **Rollback/cleanup:** function creation was permanent, not undone by test rollback. No function removal requested/performed.
- **Security/RLS:** explicit authenticated active Tier 1 Landlord, owned active property, fixed search_path, no Tier 3 requirement; user reports denied anon/PUBLIC execution. No authorization rule was moved to the frontend.
- **Source-controlled backend file:** none supplied/found for this external function creation. The exact original DDL is now retained in this ledger as user-supplied external evidence. No migration was added; generated types/this ledger are not migrations or authorization to replay SQL.
- **Android/client runtime:** no Android save reported; RUNTIME-UNVERIFIED.

#### Exact external SQL supplied 2026-10-25

The following is the user's exact historical external ChatGPT/Supabase SQL. Codex recorded it only; it was not executed again and no migration was created. Original execution timestamp remains unavailable. The user additionally reports a subsequent contract recheck: SECURITY DEFINER; search_path=pg_catalog; authenticated EXECUTE=yes; anon/PUBLIC EXECUTE=no. Listings authenticated SELECT remains yes, INSERT/UPDATE/DELETE no. These are user-confirmed historical/current-contract assertions, not a new live inspection by Codex.

```sql
create or replace function public.save_listing_draft(
  p_property_id uuid,
  p_title text,
  p_description text,
  p_asking_rent_monthly numeric,
  p_house_rules text default null,
  p_rental_term public.rental_term_type default 'long_term',
  p_security_deposit_months numeric default 1,
  p_advance_rent_months numeric default 1,
  p_minimum_stay_months smallint default null,
  p_available_from date default null
)
returns table (
  listing_id uuid,
  listing_status public.listing_status,
  completeness_score numeric,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_listing public.listings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_tier1_verified(v_user_id) then
    raise exception 'Tier 1 verified active account required' using errcode = '42501';
  end if;

  if not public.has_app_role('landlord'::public.app_role, v_user_id) then
    raise exception 'Landlord role required' using errcode = '42501';
  end if;

  if p_property_id is null then
    raise exception 'Property is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.properties p
    where p.id = p_property_id
      and p.landlord_id = v_user_id
      and p.is_active = true
  ) then
    raise exception 'Owned active property required' using errcode = '42501';
  end if;

  if nullif(pg_catalog.btrim(p_title), '') is null then
    raise exception 'Listing title is required' using errcode = '22023';
  end if;

  if nullif(pg_catalog.btrim(p_description), '') is null then
    raise exception 'Listing description is required' using errcode = '22023';
  end if;

  if p_asking_rent_monthly is null or p_asking_rent_monthly <= 0 then
    raise exception 'Monthly asking rent must be greater than zero' using errcode = '22023';
  end if;

  if p_security_deposit_months is null or p_security_deposit_months < 0 then
    raise exception 'Security deposit months must be zero or greater' using errcode = '22023';
  end if;

  if p_advance_rent_months is null or p_advance_rent_months < 0 then
    raise exception 'Advance rent months must be zero or greater' using errcode = '22023';
  end if;

  if p_minimum_stay_months is not null and p_minimum_stay_months <= 0 then
    raise exception 'Minimum stay months must be greater than zero when provided' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_property_id::text, 0)
  );

  select l.*
  into v_listing
  from public.listings l
  where l.property_id = p_property_id
    and l.landlord_id = v_user_id
    and l.status = 'draft'::public.listing_status
  order by l.created_at desc
  limit 1
  for update;

  if v_listing.id is null then
    insert into public.listings (
      property_id,
      landlord_id,
      title,
      description,
      house_rules,
      rental_term,
      asking_rent_monthly,
      security_deposit_months,
      advance_rent_months,
      minimum_stay_months,
      available_from,
      status
    )
    values (
      p_property_id,
      v_user_id,
      pg_catalog.btrim(p_title),
      pg_catalog.btrim(p_description),
      nullif(pg_catalog.btrim(p_house_rules), ''),
      p_rental_term,
      p_asking_rent_monthly,
      p_security_deposit_months,
      p_advance_rent_months,
      p_minimum_stay_months,
      p_available_from,
      'draft'::public.listing_status
    )
    returning * into v_listing;
  else
    update public.listings l
    set title = pg_catalog.btrim(p_title),
        description = pg_catalog.btrim(p_description),
        house_rules = nullif(pg_catalog.btrim(p_house_rules), ''),
        rental_term = p_rental_term,
        asking_rent_monthly = p_asking_rent_monthly,
        security_deposit_months = p_security_deposit_months,
        advance_rent_months = p_advance_rent_months,
        minimum_stay_months = p_minimum_stay_months,
        available_from = p_available_from
    where l.id = v_listing.id
      and l.status = 'draft'::public.listing_status
    returning l.* into v_listing;
  end if;

  return query
  select
    v_listing.id,
    v_listing.status,
    v_listing.completeness_score,
    v_listing.created_at,
    v_listing.updated_at;
end;
$function$;

revoke all on function public.save_listing_draft(
  uuid,text,text,numeric,text,public.rental_term_type,numeric,numeric,smallint,date
) from public;

revoke all on function public.save_listing_draft(
  uuid,text,text,numeric,text,public.rental_term_type,numeric,numeric,smallint,date
) from anon;

grant execute on function public.save_listing_draft(
  uuid,text,text,numeric,text,public.rental_term_type,numeric,numeric,smallint,date
) to authenticated;
```

### P3-03: External authenticated create/update rollback test

- **Date/feature/phase:** external execution date not supplied; recorded 2026-10-24, Phase 3.
- **Actor/tool:** external ChatGPT/Supabase integration, not Codex; user-confirmed.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** RPC_TEST + ROLLBACK_TEST.
- **Target/action:** save_listing_draft against active owned property `c0e382d1-6693-493e-8ee6-f591bd8905bc`, without approved property-specific Tier 3. First save created a draft; second save updated it. Exact title/description/payment payloads, identity simulation SQL and transaction transcript not supplied.
- **Purpose/result:** returned listing ID `a91d4de0-af56-4cbb-bfc9-a431591f605e` on repeated save; reused_same_draft=true, status=draft. Confirms no Tier 3 requirement for this tested draft path.
- **Durable effect:** none from test data; the listing row does not persist.
- **Rollback/cleanup:** transaction rolled back; post-test listings count reported as 0. The permanent RPC in P3-02 remains.
- **Security/RLS:** positive active-owner/Tier 1 case externally tested; not proof of all role/account restrictions or client behavior.
- **Source-controlled backend file:** no test script/receipt supplied.
- **Android/client runtime:** backend integration test only, not Android acceptance.

### P3-04: External foreign-property denial test

- **Date/feature/phase:** external execution date not supplied; recorded 2026-10-24, Phase 3.
- **Actor/tool:** external ChatGPT/Supabase integration, not Codex; user-confirmed.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** RPC_TEST.
- **Target/action:** unrelated authenticated Landlord called save_listing_draft against `c0e382d1-6693-493e-8ee6-f591bd8905bc`. Exact remaining arguments/identity setup/transaction transcript not supplied.
- **Purpose/result/security:** foreign-property denial PASS, SQLSTATE 42501, `Owned active property required`.
- **Durable effect:** no listing mutation reported; call rejected.
- **Rollback/cleanup:** no row cleanup required for denied call; a specific transaction wrapper was not supplied.
- **Source-controlled backend file:** no test script supplied.
- **Android/client runtime:** not performed; RUNTIME-UNVERIFIED.

### P3-05: External inactive-own-property denial test

- **Date/feature/phase:** external execution date not supplied; recorded 2026-10-24, Phase 3.
- **Actor/tool:** external ChatGPT/Supabase integration, not Codex; user-confirmed.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** RPC_TEST.
- **Target/action:** owner called save_listing_draft for inactive test property `1bfa99ee-1e3a-459e-bcf9-676ff97b3987`. Exact remaining arguments/identity setup/transaction transcript not supplied.
- **Purpose/result/security:** inactive-own-property denial PASS, SQLSTATE 42501, `Owned active property required`.
- **Durable effect:** none from denied call; previously inactive property remains as recorded in P1-03.
- **Rollback/cleanup:** no new listing cleanup needed; a specific transaction wrapper was not supplied. Post-test listings count reported as 0.
- **Source-controlled backend file:** no test script supplied.
- **Android/client runtime:** not performed; RUNTIME-UNVERIFIED.

### P3-06: External post-change advisor inspection

- **Date/feature/phase:** external execution date not supplied; recorded 2026-10-24, Phase 3.
- **Actor/tool:** external ChatGPT/Supabase integration, security advisor; not Codex, user-confirmed.
- **Environment/project:** live RentLease, `cxfsbwbwmwmgtqfonqth`.
- **Classification:** READ_ONLY_INSPECTION.
- **Target/action:** post-function-change security-advisor run; original invocation/raw receipt not supplied.
- **Purpose/result/security:** existing broader warnings remain; the new function appears under `authenticated_security_definer_function_executable`. Authenticated invocation is intentional and restricted by the explicit ownership/account/role/input checks, denied anon/PUBLIC EXECUTE and fixed search_path. Do not resolve the finding by exposing direct table writes. Unlike the old warnings, this function-specific advisory reflects the new intentionally executable RPC; no blanket clean security result is claimed.
- **Durable effect:** none from advisor run.
- **Rollback/cleanup:** not applicable, read-only; unrelated warnings outside scope.
- **Source-controlled backend file:** no advisor report/remediation file supplied.
- **Android/client runtime:** not performed; RUNTIME-UNVERIFIED.

### Phase 3 frontend-pass boundary

Codex performed the single read-only P3-01 SQL inspection and local/mocked tests; no live draft save, backend mutation, grant, function change or test-data creation was performed by Codex. The external permanent function in P3-02 is explicitly recorded, so this is not a claim that the overall Phase 3 backend contract was unchanged. The exact external DDL gap was resolved by the user-supplied SQL recorded 2026-10-25 in P3-02. Original test payloads/execution timestamps remain evidence gaps; do not invent them for PDF traceability. No source-controlled backend file was added.


### Phase 3 correction-pass provenance (2026-10-25)

Documentation provenance update only: the exact external function/privilege SQL is now included above. No live Supabase inspection, RPC, mutation, permission change or advisor action was performed in this correction pass. No new migration was created. The historical external permanent function change remains attributed to ChatGPT/Supabase; existing grants and RLS were not altered. No permanent live backend mutation was performed in this correction pass.


## Phase 4 - Publication contract and external evidence (2026-10-25)

### P4-01: External permanent publication API

- Date/phase: external execution timestamp unavailable; recorded 2026-10-25, Property & Listing Phase 4.
- Actor/tool: external ChatGPT/Supabase integration, as reported by the user; NOT Codex.
- Environment: live RentLease, project cxfsbwbwmwmgtqfonqth.
- Classification: EXTERNAL_BACKEND_CHANGE / FUNCTION_CHANGE.
- Target/action: public.publish_listing(p_listing_id uuid), SECURITY DEFINER with restricted pg_catalog search_path; controlled authenticated EXECUTE, no PUBLIC/anon EXECUTE. No direct authenticated listing mutation privileges.
- Purpose/result: explicit owned-draft publication with property-specific approved Tier 3, serialized property access, no other active/paused/rented listing and trigger-owned weighted completeness >= 0.80. Returns authoritative publication receipt.
- Durable effect: external function/controlled API remains live. Exact original CREATE/REVOKE/GRANT execution transcript was not supplied. The canonical exported definition below records current SQL, not a claim that Codex executed it. No original grant SQL is invented.
- Cleanup: no rollback of permanent external API requested/performed.
- Security: backend owns eligibility; no frontend authorization substitution.
- Migration/source: no Phase 4 backend migration created in this frontend repository; exported function below is documentation evidence.
- Android/client runtime: not performed; RUNTIME-UNVERIFIED.

Canonical live definition obtained by the read-only P4-03 inspection (not executed):

```sql
CREATE OR REPLACE FUNCTION public.publish_listing(p_listing_id uuid)
 RETURNS TABLE(listing_id uuid, listing_status listing_status, completeness_score numeric, published_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_probe public.listings%rowtype;
  v_listing public.listings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_tier1_verified(v_user_id) then
    raise exception 'Tier 1 verified active account required' using errcode = '42501';
  end if;

  if not public.has_app_role('landlord'::public.app_role, v_user_id) then
    raise exception 'Landlord role required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'Listing is required' using errcode = '22023';
  end if;

  select l.*
  into v_probe
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id;

  if v_probe.id is null then
    raise exception 'Owned listing required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_probe.property_id::text, 0)
  );

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id
  for update;

  if v_listing.id is null then
    raise exception 'Owned listing required' using errcode = '42501';
  end if;

  if v_listing.status <> 'draft'::public.listing_status then
    raise exception 'Only a draft listing can be published' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.properties p
    where p.id = v_listing.property_id
      and p.landlord_id = v_user_id
      and p.is_active = true
  ) then
    raise exception 'Owned active property required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.verification_submissions vs
    where vs.user_id = v_user_id
      and vs.property_id = v_listing.property_id
      and vs.tier = 'tier_3_property'::public.verification_tier
      and vs.status = 'approved'::public.verification_status
  ) then
    raise exception 'Approved Tier 3 verification for this property is required before publishing'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.listings other
    where other.property_id = v_listing.property_id
      and other.id <> v_listing.id
      and other.status in (
        'active'::public.listing_status,
        'paused'::public.listing_status,
        'rented'::public.listing_status
      )
  ) then
    raise exception 'This property already has a live listing'
      using errcode = '23505';
  end if;

  update public.listings l
  set status = 'active'::public.listing_status
  where l.id = v_listing.id
    and l.landlord_id = v_user_id
    and l.status = 'draft'::public.listing_status
  returning l.* into v_listing;

  if v_listing.id is null then
    raise exception 'Listing changed before publication could complete'
      using errcode = '40001';
  end if;

  return query
  select
    v_listing.id,
    v_listing.status,
    v_listing.completeness_score,
    v_listing.published_at,
    v_listing.updated_at;
end;
$function$

```

### P4-02: User-reported external rollback and denied-case tests

- Date/phase: original external execution times unavailable; recorded 2026-10-25, Phase 4.
- Actor/tool/environment: external ChatGPT/Supabase integration, live RentLease cxfsbwbwmwmgtqfonqth; NOT Codex and NOT Android.
- Classification: RPC_TEST / ROLLBACK_TEST / TEST_DATA_MUTATION (rolled back).
- Exact action contract: publish_listing(p_listing_id uuid); original full test SQL/argument transcripts unavailable. UUIDs below retained only as supplied evidence identifiers; they are not client fixtures or debug bypasses.
- Purpose/results:
  1. Positive rollback: property 79f7b794-aa40-4996-8eb9-5d4e988e1734; listing 0127669f-d8d2-4a32-8c05-95637720cfa6 returned active, completeness .8000 and published_at. Rolled back; no listing retained.
  2. Pending Tier 3 property c0e382d1-6693-493e-8ee6-f591bd8905bc denied with 42501: Approved Tier 3 verification for this property is required before publishing. Temporary draft rolled back.
  3. Approved Tier 3 but low completeness property 52897654-d4f8-405e-b11e-44e57b4b4007 denied with P0001 and 80% completeness requirement. Rolled back.
  4. Unrelated landlord denied with 42501 / Owned listing required. Rolled back.
  5. Duplicate live listing: first publication succeeded; second same-property draft publication denied with 23505 / This property already has a live listing. Entire test rolled back.
- Durable test-data effect/cleanup: none reported; post-test listings count was zero. Existing property/verification records unchanged according to external test report.
- Security/RLS: these are external backend test results, not independently repeated live tests by Codex. No direct table write grant was added.
- Advisor: external post-change report identified authenticated_security_definer_function_executable for the new RPC. It is an intentionally exposed controlled authenticated API. Other pre-existing warnings remain out of scope; no advisor fix attempted.
- Migration/source: none supplied/created; current function definition and privilege inspection retained above/below.
- Android/client runtime: not performed.

### P4-03: Codex read-only publication inspection

- Date/phase: 2026-10-25, Property & Listing Phase 4.
- Actor/tool: Codex / Supabase execute_sql connector.
- Environment: live RentLease cxfsbwbwmwmgtqfonqth.
- Classification: READ_ONLY_INSPECTION.
- Targets: publish_listing, validate_listing_owner, function EXECUTE ACL, authenticated listings table privileges.
- Exact inspection SQL:

```sql
select json_build_object('publication',(select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='publish_listing'),'trigger',(select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='validate_listing_owner'),'execute',(select json_build_object('authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'public_execute',exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='publish_listing'),'table_access',json_build_object('select',has_table_privilege('authenticated','public.listings','SELECT'),'insert',has_table_privilege('authenticated','public.listings','INSERT'),'update',has_table_privilege('authenticated','public.listings','UPDATE'),'delete',has_table_privilege('authenticated','public.listings','DELETE'))) as contract;
```

- Purpose/result: confirm current function and trigger contracts without invoking publication. SECURITY DEFINER restricted search_path, owner/property-specific Tier 3 and duplicate-live gate confirmed. Trigger recomputes score and published_at. Function EXECUTE: authenticated true, anon false, PUBLIC false. Authenticated listings SELECT true; INSERT/UPDATE/DELETE false.
- Durable effect: none. Cleanup/rollback: not applicable, read-only.
- Security/RLS result: definition/ACL inspection only; no denied-case or publication RPC executed by Codex.
- Migration/source: no backend file changed. Frontend generated structural contract was amended only for the user-approved exact publication signature; no full schema regeneration claimed.
- Android/client runtime: not performed. Successful property/listing/publication app persistence awaits external location integration.
- **No permanent live backend mutation was performed in this phase by Codex.** No live RPC test, schema/RLS/Storage change, test-data mutation or backend grant was executed by Codex.


## Phase 5 - Listing lifecycle (2026-10-26)

### P5-01: External permanent lifecycle RPC creation

- Date/feature/phase: executed externally 2026-10-25, recorded 2026-10-26; Property & Listing Phase 5.
- Actor/tool: user, Supabase SQL Editor; NOT Codex.
- Environment/project: live RentLease cxfsbwbwmwmgtqfonqth.
- Classification: EXTERNAL_BACKEND_CHANGE / FUNCTION_CHANGE / PRIVILEGE_CHANGE.
- Targets: public.pause_listing(uuid), public.reactivate_listing(uuid), public.archive_listing(uuid), their EXECUTE permissions.
- Action: supplied exact CREATE OR REPLACE / REVOKE / GRANT script follows. Copied from the user-provided rentlease_phase5_lifecycle_rpcs.sql; documented, not executed by Codex.
- Purpose/result: controlled owner/active Tier 1 Landlord lifecycle API, no direct listing table mutation privilege. Permitted transitions active -> paused, paused -> active, active/paused -> archived. All reject active tenancy; reactivation also requires active owned property, exact-property approved Tier 3, no competing live listing and trigger-owned completeness >= .80.
- Durable effect: the three functions and controlled authenticated EXECUTE grants remain live. PUBLIC and anon EXECUTE revoked; authenticated listings SELECT yes, INSERT/UPDATE/DELETE no.
- Cleanup/rollback: permanent external API not rolled back; test data covered separately below.
- Security/RLS: backend authentication/role/owner/transition checks remain authoritative. SECURITY DEFINER, search_path=pg_catalog. No direct UPDATE workaround.
- Backend migration/source: user-supplied SQL retained below as audit evidence; no new migration/source-controlled backend implementation file created in this frontend pass.
- Android/client runtime: not performed; RUNTIME-UNVERIFIED.

```sql
-- RentLease Phase 5 — Listing Lifecycle RPCs
-- Intended live project: cxfsbwbwmwmgtqfonqth
-- Apply through Supabase SQL Editor or an approved migration workflow.
-- Do not expose direct UPDATE on public.listings to authenticated users.

create or replace function public.pause_listing(p_listing_id uuid)
returns table (
  listing_id uuid,
  listing_status public.listing_status,
  completeness_score numeric,
  published_at timestamptz,
  paused_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_listing public.listings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_tier1_verified(v_user_id) then
    raise exception 'Tier 1 verified active account required' using errcode = '42501';
  end if;

  if not public.has_app_role('landlord'::public.app_role, v_user_id) then
    raise exception 'Landlord role required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'Listing is required' using errcode = '22023';
  end if;

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id
  for update;

  if v_listing.id is null then
    raise exception 'Owned listing required' using errcode = '42501';
  end if;

  if v_listing.status <> 'active'::public.listing_status then
    raise exception 'Only an active listing can be paused' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.tenancies t
    where t.listing_id = v_listing.id
      and t.status = 'active'::public.tenancy_status
  ) then
    raise exception 'Listing status is controlled by an active tenancy' using errcode = '22023';
  end if;

  update public.listings l
  set status = 'paused'::public.listing_status,
      paused_at = pg_catalog.now()
  where l.id = v_listing.id
    and l.landlord_id = v_user_id
    and l.status = 'active'::public.listing_status
  returning l.* into v_listing;

  if v_listing.id is null then
    raise exception 'Listing changed before pause could complete' using errcode = '40001';
  end if;

  return query
  select
    v_listing.id,
    v_listing.status,
    v_listing.completeness_score,
    v_listing.published_at,
    v_listing.paused_at,
    v_listing.archived_at,
    v_listing.updated_at;
end;
$function$;

create or replace function public.reactivate_listing(p_listing_id uuid)
returns table (
  listing_id uuid,
  listing_status public.listing_status,
  completeness_score numeric,
  published_at timestamptz,
  paused_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_probe public.listings%rowtype;
  v_listing public.listings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_tier1_verified(v_user_id) then
    raise exception 'Tier 1 verified active account required' using errcode = '42501';
  end if;

  if not public.has_app_role('landlord'::public.app_role, v_user_id) then
    raise exception 'Landlord role required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'Listing is required' using errcode = '22023';
  end if;

  select l.*
  into v_probe
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id;

  if v_probe.id is null then
    raise exception 'Owned listing required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_probe.property_id::text, 0)
  );

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id
  for update;

  if v_listing.id is null then
    raise exception 'Owned listing required' using errcode = '42501';
  end if;

  if v_listing.status <> 'paused'::public.listing_status then
    raise exception 'Only a paused listing can be reactivated' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.properties p
    where p.id = v_listing.property_id
      and p.landlord_id = v_user_id
      and p.is_active = true
  ) then
    raise exception 'Owned active property required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.verification_submissions vs
    where vs.user_id = v_user_id
      and vs.property_id = v_listing.property_id
      and vs.tier = 'tier_3_property'::public.verification_tier
      and vs.status = 'approved'::public.verification_status
  ) then
    raise exception 'Approved Tier 3 verification for this property is required before reactivating'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.tenancies t
    where t.listing_id = v_listing.id
      and t.status = 'active'::public.tenancy_status
  ) then
    raise exception 'Listing status is controlled by an active tenancy' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.listings other
    where other.property_id = v_listing.property_id
      and other.id <> v_listing.id
      and other.status in (
        'active'::public.listing_status,
        'paused'::public.listing_status,
        'rented'::public.listing_status
      )
  ) then
    raise exception 'This property already has a live listing' using errcode = '23505';
  end if;

  update public.listings l
  set status = 'active'::public.listing_status,
      paused_at = null
  where l.id = v_listing.id
    and l.landlord_id = v_user_id
    and l.status = 'paused'::public.listing_status
  returning l.* into v_listing;

  if v_listing.id is null then
    raise exception 'Listing changed before reactivation could complete' using errcode = '40001';
  end if;

  return query
  select
    v_listing.id,
    v_listing.status,
    v_listing.completeness_score,
    v_listing.published_at,
    v_listing.paused_at,
    v_listing.archived_at,
    v_listing.updated_at;
end;
$function$;

create or replace function public.archive_listing(p_listing_id uuid)
returns table (
  listing_id uuid,
  listing_status public.listing_status,
  completeness_score numeric,
  published_at timestamptz,
  paused_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_listing public.listings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_tier1_verified(v_user_id) then
    raise exception 'Tier 1 verified active account required' using errcode = '42501';
  end if;

  if not public.has_app_role('landlord'::public.app_role, v_user_id) then
    raise exception 'Landlord role required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'Listing is required' using errcode = '22023';
  end if;

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.landlord_id = v_user_id
  for update;

  if v_listing.id is null then
    raise exception 'Owned listing required' using errcode = '42501';
  end if;

  if v_listing.status not in (
    'active'::public.listing_status,
    'paused'::public.listing_status
  ) then
    raise exception 'Only an active or paused listing can be archived' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.tenancies t
    where t.listing_id = v_listing.id
      and t.status = 'active'::public.tenancy_status
  ) then
    raise exception 'Listing status is controlled by an active tenancy' using errcode = '22023';
  end if;

  update public.listings l
  set status = 'archived'::public.listing_status,
      archived_at = pg_catalog.now()
  where l.id = v_listing.id
    and l.landlord_id = v_user_id
    and l.status in (
      'active'::public.listing_status,
      'paused'::public.listing_status
    )
  returning l.* into v_listing;

  if v_listing.id is null then
    raise exception 'Listing changed before archive could complete' using errcode = '40001';
  end if;

  return query
  select
    v_listing.id,
    v_listing.status,
    v_listing.completeness_score,
    v_listing.published_at,
    v_listing.paused_at,
    v_listing.archived_at,
    v_listing.updated_at;
end;
$function$;

revoke all on function public.pause_listing(uuid) from public;
revoke all on function public.pause_listing(uuid) from anon;
grant execute on function public.pause_listing(uuid) to authenticated;

revoke all on function public.reactivate_listing(uuid) from public;
revoke all on function public.reactivate_listing(uuid) from anon;
grant execute on function public.reactivate_listing(uuid) to authenticated;

revoke all on function public.archive_listing(uuid) from public;
revoke all on function public.archive_listing(uuid) from anon;
grant execute on function public.archive_listing(uuid) to authenticated;

```

### P5-02: External rollback lifecycle test

- Date/feature/phase: externally performed after function creation; exact execution time unavailable, recorded 2026-10-26, Phase 5.
- Actor/tool/environment: external Supabase integration, user-reported; live RentLease cxfsbwbwmwmgtqfonqth. NOT Codex, NOT Android.
- Classification: RPC_TEST / TEST_DATA_MUTATION / ROLLBACK_TEST.
- Targets/action: temporary draft -> publish_listing -> pause_listing -> reactivate_listing -> archive_listing. Each lifecycle RPC takes p_listing_id only. Original full transaction SQL and fixture listing UUID were not supplied; do not reconstruct an alleged executed transcript.
- Purpose/result: publish active with completeness .8000, paused_at/archived_at null; pause paused with populated paused_at and score .8000; reactivate active with paused_at null and score .8000; archive archived with populated archived_at and score .8000.
- Durable effect/cleanup: transaction rolled back; post-test public.listings count reported as zero. No test listing persisted.
- Security/RLS: owner-positive lifecycle execution reported; no broad listing write grant.
- Backend migration/source: no test SQL source supplied/created.
- Android/client runtime: not performed; RUNTIME-UNVERIFIED.

### P5-03: External denied-case and tenancy boundary evidence

- Date/feature/phase: external exact execution time unavailable; recorded 2026-10-26, Phase 5.
- Actor/tool/environment: external Supabase integration, user-reported; live RentLease cxfsbwbwmwmgtqfonqth, NOT Codex.
- Classification: RPC_TEST / ROLLBACK_TEST for reported denied cases; READ_ONLY_INSPECTION for tenancy boundary.
- Targets/action/results: draft -> pause_listing denied 22023 / Only an active listing can be paused. Unrelated authenticated Landlord -> pause_listing denied 42501 / Owned listing required. Exact fixture IDs, argument transcript and transaction SQL were not supplied.
- Tenancy boundary: definitions of all three lifecycle functions reject Listing status is controlled by an active tenancy. Existing sync_listing_from_tenancy sets listing rented for tenancy active; an active tenancy ended/cancelled sets listing archived.
- Evidence limit: active-tenancy denial fixture was NOT independently executed. **CONTRACT-VERIFIED / NOT INDEPENDENTLY ROLLBACK-TESTED**. Do not describe it as an executed denial test.
- Durable effect/cleanup: no durable test listing reported; external lifecycle tests rolled back, listings count zero.
- Security/RLS: reported owner/wrong-transition denials; active-tenancy boundary definition only.
- Backend migration/source: full original test transcripts unavailable; no new backend file.
- Android/client runtime: not performed.

### P5-04: External security advisor result

- Date/feature/phase: external post-change run 2026-10-25 (time unavailable), recorded 2026-10-26, Phase 5.
- Actor/tool/environment: external Supabase integration/advisor report supplied by user; live RentLease cxfsbwbwmwmgtqfonqth.
- Classification: READ_ONLY_INSPECTION / EXTERNAL_BACKEND_CHANGE evidence context.
- Targets/action/result: external advisor reports pause_listing, reactivate_listing, archive_listing under authenticated_security_definer_function_executable. Intentional controlled authenticated RPC surface; not resolved by direct table UPDATE.
- Durable effect/cleanup: none from advisor; no fixes performed. Pre-existing unrelated findings remain outside Phase 5.
- Security/RLS: expected exposure still requires backend checks; this is not formal production security verification. Codex did not rerun the advisor.
- Backend migration/source: none.
- Android/client runtime: not performed.

### P5-05: Codex read-only live contract and privilege inspection

- Date/feature/phase: 2026-10-26, Property & Listing Phase 5.
- Actor/tool: Codex / Supabase execute_sql connector.
- Environment/project: live RentLease cxfsbwbwmwmgtqfonqth.
- Classification: READ_ONLY_INSPECTION.
- Targets: three lifecycle function definitions and EXECUTE ACLs, sync_listing_from_tenancy, validate_listing_owner and authenticated listings table privileges.
- Exact inspection SQL:

```sql
select p.proname, pg_get_functiondef(p.oid) as definition, p.prosecdef, p.proconfig, has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute, has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute, exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute, json_build_object('select',has_table_privilege('authenticated','public.listings','SELECT'),'insert',has_table_privilege('authenticated','public.listings','INSERT'),'update',has_table_privilege('authenticated','public.listings','UPDATE'),'delete',has_table_privilege('authenticated','public.listings','DELETE')) as listings_privileges from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('pause_listing','reactivate_listing','archive_listing','sync_listing_from_tenancy','validate_listing_owner') order by p.proname;
```

- Purpose/result: independently confirm available live definitions/ACLs without executing any lifecycle/publication RPC. All three lifecycle functions observed SECURITY DEFINER, search_path=pg_catalog, authenticated EXECUTE true, anon false, PUBLIC false. listings authenticated SELECT true; INSERT/UPDATE/DELETE false. Source-status/owner/role/Tier 1/tenancy checks confirmed; reactivation includes property-specific Tier 3, active property, duplicate-live gate and existing trigger recalculation. Tenancy trigger definition confirms rented/archive transitions. No test fixture, RPC or denied-case run by Codex.
- Durable effect/cleanup: none, read-only; rollback not applicable.
- Security/RLS: definition and privilege evidence only. Existing trigger-function broader EXECUTE/search_path settings were observed, not changed or claimed as newly introduced by these three RPCs.
- Backend migration/source: none created; exact structural signatures only were added to frontend database.types.ts, no full regeneration claimed.
- Android/client runtime: not performed; normal app persistence still location-gated and RUNTIME-UNVERIFIED.
- **No permanent live backend mutation was performed in this phase by Codex.** No schema/RLS/Storage/function/grant or live test-data mutation was executed by Codex.


## MapTiler exact-location integration boundary (2026-10-26)

Local frontend pass on feature/maptiler-property-location, baseline 4fa955b. No live Supabase inspection, SQL, RPC/Storage test, schema/RLS/function/grant/configuration or data action was performed. There is no backend mutation to backfill for this pass. No migration/source-controlled backend file was created/modified; generated types and create_property_setup remain unchanged.

Actor/tool: Codex/local source, mocked tests, Expo package install/compatibility/config introspection. Environment: local frontend; no live database targeted. Purpose/result: implement MapTiler search and native exact-pin presentation without crossing the complete-location privacy boundary. Existing service still requires exactLatitude/exactLongitude/publicLatitude/publicLongitude; no policy for the public point was invented. The dedicated workflow does not call provideConfirmedLocation or persist exact coordinates. Property saving remains blocked; no public/private coordinate equality workaround or fake UUID was added.

Durable backend effect: none. Rollback/cleanup: not applicable, no remote test data created. Security/RLS: existing rules untouched and not independently retested in this pass. Android/client runtime: RUNTIME-UNVERIFIED; fresh development build/key configuration and public privacy policy remain separate prerequisites. No permanent live backend mutation was performed in this phase.


## Public-location privacy handoff (2026-10-28)

No new backend mutation or live Supabase interaction. Existing create_property_setup contract reused unchanged; no migration/schema/RLS/RPC/generated-type change. Public coordinate derivation is frontend domain logic (deterministic 300m Web Mercator grid centers). Codex performed local implementation and mocked automated tests only; successful Android property persistence is still runtime-unverified. No remote data cleanup/rollback was needed.


## Portfolio read contract and local UX integration (2026-10-29)

- Recording date/feature: 2026-10-29, Property & Listing composer and persisted landlord portfolio.
- Actor/tool/environment: external read-only live Supabase audit reported by the user; exact audit execution date/tool/transcript unavailable. Existing live RentLease project. Codex did not rerun the audit or call live Supabase in this pass.
- Classification: READ_ONLY_INSPECTION (externally reported evidence). This entry records contract dependence, not a newly executed inspection or backend change.
- Targets/action: properties/listings/property_photos/verification_submissions table privileges and owner RLS policies. Exact executed SQL was not supplied; none is invented here.
- Reported result: authenticated SELECT on properties/listings/verification_submissions; property_photos SELECT/INSERT/DELETE plus existing column-scoped UPDATE remain. Owner reads use landlord_id=auth.uid() for properties/listings; verification uses user_id=auth.uid(); property-photo owner access uses can_manage_property(property_id)/can_view_property(property_id). Portfolio needs no new RPC or privileges.
- Purpose: justify frontend read-only owner portfolio integration without broadening backend access. It does not replace runtime RLS acceptance testing.
- Durable effect: none from the audit or local implementation. No live schema, RLS, grants, functions, Storage policy/config, generated types or data changed. No permanent live backend mutation was performed in this phase.
- Rollback/cleanup: not applicable; no live tests/fixtures created or replayed.
- Security/RLS: supplied external audit only. Local service uses narrow owner filters, confirms owned IDs before cover queries, rechecks Auth identity and validates existing property-photo namespaces. It never reads private locations/coordinates/access instructions and performs no mutation. Denied/non-owner client runtime still needs testing.
- Source-controlled backend file: none created/modified; existing create_property_setup, propertyPhotoService, save_listing_draft, publish_listing and lifecycle RPC mutation paths reused. Selected-item reads accept an optional exact listing ID; no RPC argument/contract change.
- Android/client runtime: RUNTIME-UNVERIFIED. Local tests use mocks, not live RPC/Storage operations. Multi-photo gallery adds expo-image-picker in the local frontend; no native build performed. All previously recorded fixtures/warnings/cleanup remain historical and untouched.


## Unified composer local orchestration (2026-10-29)

Actor/tool/environment: Codex, local frontend source inspection and mocked automated tests on feature/maptiler-property-location. No live Supabase environment was contacted in this continuation. Purpose: reuse existing property/photo/draft contracts under one explicit composer Save without changing their order or authorization.

Actions/targets: no SQL, live RPC/Storage test, privilege/schema/RLS/function/trigger/configuration/generated-type change or remote test-data operation performed. Existing create_property_setup, propertyPhotoService.upload/set_property_cover_photo and save_listing_draft paths are consumed unchanged; publication/lifecycle remain their dedicated existing RPC workflows. Local image picking before UUID performs no backend call. The four-coordinate service contract/privacy rule remains unchanged.

Result/durable effect: local UI/ViewModel/workflow refactor only, no durable backend effect. No permanent live backend mutation was performed in this phase. Rollback/cleanup: not applicable, no remote fixtures created. Security/RLS: existing backend rules reused, not independently revalidated against live Supabase here. Source-controlled backend file: none created/modified. Android/client runtime: RUNTIME-UNVERIFIED; 632 passing mocked automated tests do not establish native/live persistence or security acceptance.


## Two-page Post local presentation (2026-10-29)

Actor: Codex, local frontend workspace only. Environment: feature/maptiler-property-location, no live project access. No live Supabase inspection, SQL, RPC/Storage test or data mutation occurred in this refinement. No permanent live backend mutation was performed in this phase. Existing backend contracts/security and earlier external provenance remain unchanged.

Property -> Listing Details navigation and media gallery reuse existing services. The local owner portfolio SELECT projection includes existing floor_number, total_floors and max_occupants; no private coordinates or new mutation path was added. Automated mocked tests are not live RLS validation. No migration/backend file, rollback or cleanup was required. Android/client runtime remains unverified. See the continuous implementation history's two-page Post refinement section for exact test evidence.


## Root Post chooser - local navigation only (2026-10-30)

Actor: Codex, local frontend workspace feature/search-discovery-backend-integration, baseline 7eb361b plus preserved uncommitted work. No live Supabase call, SQL/RPC/Storage test, privilege/policy/configuration change or data mutation occurred in this pass. Existing role gates and property mutation contracts remain unchanged; disabled Community Post has no service/backend path. No migration, rollback or cleanup required. Android runtime is unverified. No permanent live backend mutation was performed in this phase. Source/tests/evidence are in the root Post chooser section of the continuous implementation history.

## Publication access inspection and prepared SELECT grant (2026-10-30)

- Date/feature: 2026-10-30, Property & Listing publication runtime correction.
- Actor/tool: Codex via connected Supabase read-only execute_sql; local Supabase CLI migration new and editor for preparation only.
- Environment: live RentLease project cxfsbwbwmwmgtqfonqth; local feature/search-discovery-backend-integration baseline 7eb361b plus preserved uncommitted work.
- Classification: READ_ONLY_INSPECTION. Targets: tenancy grants/RLS/policies and publish_listing(uuid) definition; no live RPC invocation or data mutation.
- Purpose: distinguish access failures from publication mutation uncertainty and verify the user-reported grant gap.
- Exact catalog inspection:

```sql
select jsonb_build_object(
 'select_grant',has_table_privilege('authenticated','public.tenancies','SELECT'),
 'rls',(select relrowsecurity from pg_class where oid='public.tenancies'::regclass),
 'policies',(select jsonb_agg(jsonb_build_object('name',policyname,'command',cmd,'roles',roles,'qual',qual)) from pg_policies where schemaname='public' and tablename='tenancies'),
 'publish_definition',(select pg_get_functiondef(oid) from pg_proc where oid='public.publish_listing(uuid)'::regprocedure)
) as contract;
```

Result: authenticated SELECT false; tenancy RLS true. tenancies_read_parties_admin SELECT authenticated uses auth.uid() = tenant_id OR auth.uid() = landlord_id OR is_admin(); tenancies_admin_manage remains Admin-only. Existing listings_read_allowed references tenancies (also established in the current Search backend inspection/user evidence). publish_listing remains SECURITY DEFINER with pg_catalog search_path and authenticated/active Tier 1/Landlord/owned draft/owned active property/property-specific Tier 3/live-listing checks. No backend implementation changed.

Durable effect: none from inspection. Rollback/cleanup: not required for catalog SELECT. Security result: contract inspected, not an authenticated positive/negative tenancy data test. Android/client runtime: not tested; actual failing device stage/RPC transmission remains unconfirmed. No service-role workaround or RLS bypass introduced.

### Prepared change, NOT executed

Local CLI generated supabase/migrations/20261030042030_authenticated_tenancies_select.sql. Proposed SQL:

```sql
GRANT SELECT ON TABLE public.tenancies TO authenticated;
```

This is a prepared PRIVILEGE_CHANGE, not a performed live grant. It permits table-level SELECT needed by policy evaluation; enabled party/Admin RLS still limits rows. No anon, INSERT/UPDATE/DELETE, policy, function or schema change. File exists locally and is uncommitted; no migration push/apply was run. Repository frontend-only rules require explicit live-mutation authorization, which this task did not supply. Responsible operator approval/application and runtime validation remain outstanding. No rollback or test-data cleanup required because nothing was applied. No permanent live backend mutation was performed in this phase.


## Property creation and completeness contract inspection (2026-10-31)

Date/feature: 2026-10-31, focused Property & Listing runtime correction. Actor: Codex, Supabase execute_sql read-only connector; local frontend workspace C:/dev/RentLease-Frontend, branch feature/search-discovery-backend-integration. Environment/project: RentLease cxfsbwbwmwmgtqfonqth. Classification: READ_ONLY_INSPECTION. Targets: create_property_setup definition, listing validation/completeness trigger/functions, amenities schema/grants/policies and property_amenities grants/policies. Purpose: map actual safe errors and weights, confirm catalogue consumption requires no backend change.

Exact inspection calls (SELECT only; function definitions containing INSERT/UPDATE text were read, not executed):

```sql
-- Call 1; connector returned the final policies result, so definitions/grants were re-read in Call 2.
select p.proname, pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname='create_property_setup' or p.proname ilike '%completeness%');
select column_name,data_type from information_schema.columns where table_schema='public' and table_name='amenities';
select has_table_privilege('authenticated','public.amenities','SELECT') as catalog_select,has_table_privilege('authenticated','public.property_amenities','SELECT') as associations_select;
select policyname,qual from pg_policies where schemaname='public' and tablename in ('amenities','property_amenities');

-- Call 2
select jsonb_build_object('functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname='create_property_setup' or p.proname ilike '%completeness%')),'columns',(select jsonb_agg(jsonb_build_object('column',column_name,'type',data_type)) from information_schema.columns where table_schema='public' and table_name='amenities'),'grants',jsonb_build_object('amenities_select',has_table_privilege('authenticated','public.amenities','SELECT'),'associations_select',has_table_privilege('authenticated','public.property_amenities','SELECT'))) as contract;

-- Call 3: identify trigger/calculator definitions; existing draft/publication/lifecycle definitions were also returned, not invoked.
select jsonb_build_object('calculators',(select jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and (p.prosrc ilike '%completeness_score%' or p.prosrc ilike '%v_score%')),'triggers',(select jsonb_agg(pg_get_triggerdef(oid)) from pg_trigger where tgrelid='public.listings'::regclass and not tgisinternal)) as contract;

-- Call 4: exact weighted calculator
select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prosrc ilike '%0.15%' and p.prosrc ilike '%completeness%';
```

Results: create_property_setup retains its confirmed JSONB property UUID receipt, SECURITY DEFINER/pg_catalog and authenticated/active/Landlord/Tier 1 checks; no Tier 3 creation prerequisite. Exact known messages include Authentication required, Active account required, Landlord role required, Tier 1 verification required, Barangay is required, Address line 1 is required, Property coordinates are required, Invalid latitude, Invalid longitude, One or more amenities are invalid or inactive. Valid active IDs create property_amenities transactionally; duplicates are deduplicated in the RPC. No create RPC was called by Codex.

Amenities columns: id bigint, code/name text, nullable category text, is_active boolean, created_at timestamp. Authenticated SELECT on amenities and property_amenities is present. Inspected policies: amenities_read_authenticated uses is_active OR is_admin(); amenities_admin_manage is_admin(); property_amenities_read_allowed can_view_property(property_id); management can_manage_property(property_id). These were catalogue/policy observations, not authenticated owner/non-owner runtime tests. No new grants or RLS bypass was necessary/performed. Existing RPC/RLS remain authoritative.

validate_listing_owner awards title 0.10, trimmed description >=30 characters 0.15, positive rent 0.10, availability present 0.05, non-null floor area 0.10, non-null max occupants 0.05, private-location row exists 0.15, any property photo 0.20, any property amenity 0.10; capped at 1.00. Active publication checks recomputed score >=0.80. No weights, trigger, column or publication function changed. Frontend uses a display estimate only before a matching saved row; server score wins afterward.

Durable effect: none. No SQL mutation, live RPC test, Storage action, test data, role simulation or rollback test. Rollback/cleanup: not required. Migration/source-controlled backend file: none created/changed by this pass; earlier prepared tenancy SELECT migration remains untouched/unapplied by Codex. Android/client runtime verification: none; original creation failure stage/code still unconfirmed until PROPERTY-CREATE-DIAG is captured. No permanent live backend mutation was performed in this phase.

Separate external provider read: Codex fetched the configured streets-v4 style through MapTiler and emitted only version/source names/type/URL-or-tiles presence, never key or full URL. Main source maptiler_planet_v4 has TileJSON URL; maptiler_attribution vector source has neither URL nor tiles. Plausible native warning source only, without Android correlation. No attribution deletion, style rewrite or warning suppression. No Supabase effect. See the continuous implementation history for tests, source paths and runtime checklist.


## Completeness freshness migration local-test only (2026-10-31)

Feature/phase: listing completeness freshness correctness. Actor/tool: Codex via Supabase read-only execute_sql/get_advisors, Supabase CLI migration new/test db/db lint/db advisors and local Docker/psql/Python. Environments: live RentLease cxfsbwbwmwmgtqfonqth (READ ONLY); disposable localhost Supabase Postgres17 container rentlease-completeness-test-20261031, port 127.0.0.1:55438, final test database rentlease_completeness_final. No live RPC/test data mutation.

### Live READ_ONLY_INSPECTION

Inspected pg_trigger/pg_get_triggerdef for listings/properties/photos/private locations/amenities; pg_get_functiondef/owner/ACL for validate_listing_owner, set_updated_at, enforce_property_photo_limit; pg_indexes and pg_constraint for related tables; current server version 17.6. Confirmed the only completeness calculation is in the listing trigger, with no related refresh triggers. Existing advisory-lock namespace is property UUID hashed with seed0 in the photo limit and existing mutation paths.

Observed unchanged formula: title .10, trimmed description >=30 .15, positive rent .10, available date .05, floor area non-null .10, max occupants non-null .05, private row existence .15, any photo .20, any amenity .10, cap1; active threshold .80. Existing relevant indexes and ON DELETE CASCADE parent relationships were confirmed; no unique-one-listing assumption is made.

Additional exact deployment-context SELECT:

```sql
select jsonb_build_object('target_schema_exists',exists(select 1 from pg_namespace where nspname='rentlease_completeness'),'default_isolation',current_setting('default_transaction_isolation'),'listings_authenticated_update',has_table_privilege('authenticated','public.listings','UPDATE'),'listings_authenticated_select',has_table_privilege('authenticated','public.listings','SELECT')) as deployment_context;
```

Result: target schema absent; default isolation read committed; authenticated listings SELECT true, UPDATE false. No grants were changed. Live security advisor baseline reported mutable set_updated_at search_path, callable SECURITY DEFINER functions (anon/authenticated) and disabled leaked-password protection. These are pre-existing observations, not findings introduced/fixed by this unapplied migration. Relevant remediation references: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable ; https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable ; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No cleanup/rollback required for read-only inspection.

### LOCAL SCHEMA_CHANGE / FUNCTION_CHANGE / ROLLBACK_TEST / TEST_DATA_MUTATION

Exact proposed DDL/source: supabase/migrations/20261031072616_optimize_listing_completeness_refresh.sql, generated by npx supabase migration new optimize_listing_completeness_refresh and then populated. This source is the authoritative complete SQL; it was not replayed to live. It creates an internal schema/calculator/refresh and trigger functions, refactors the existing listing validator, installs 14 narrowly scoped lock/refresh triggers and performs a guarded no-op-avoiding backfill. Client schema/function access is revoked; no table grant, RLS/index/Storage/tenancy changes. SECURITY DEFINER is limited to trusted triggers/refresh where callers lack listing UPDATE; calculator is invoker-only, paths qualified. Active violations abort transactionally, no auto lifecycle change. Old-snapshot related writes are explicitly rejected; READ COMMITTED is supported/tested.

The exact DDL was applied by local docker exec psql -v ON_ERROR_STOP=1 -f /tmp/completeness-migration.sql ONLY after loading supabase/test-support/listing_completeness_schema.sql into the disposable database. Final DDL was re-applied locally after review corrections, with final tests passing. This is an isolated contract fixture, not full live schema or live RLS acceptance. Initial fixture ACL defaults/extension placement/schema usage issues were corrected in test support only.

Exact test entry points:

- npx supabase test db supabase/tests/listing_completeness_refresh.sql --db-url postgresql://postgres:rentlease-local-test-only@127.0.0.1:55438/rentlease_completeness_final?sslmode=disable
- python supabase/tests/run_completeness_concurrency.py --container rentlease-completeness-test-20261031 --database rentlease_completeness_final
- npx supabase db lint --db-url (same localhost test URL) --schema public,rentlease_completeness --fail-on error
- npx supabase db advisors --db-url (same localhost test URL) --type all --level warn --fail-on error

The connection password is a public throwaway localhost fixture value, not a live secret. The CLI's generic "remote database" label refers to the supplied loopback URL, not the linked live project. No --linked/db push/migration up command was used. The tenancy migration was untouched/unapplied.

Results: 74/74 pgTAP rollback assertions; 4/4 real integration checks (concurrent critical removals, stale-invalid and already-current-invalid active deployment rollback, stale-snapshot isolation rejection); local lint clean. Reviewer found the unchanged-invalid-active deployment gap; an independent preflight and regression closed it, verified by rollback of the entire schema/migration and no status changes. Local advisor final six WARNs concern five minimal test policies and copied baseline set_updated_at; no new-helper errors/warnings. Initial test-extension warnings were fixture-only. EXPLAIN and transaction-local planner eligibility checks confirmed existing property lookup indexes; tiny fixture sequential scans were not treated as evidence for new indexes. No fake large-scale benchmark.

Durable effects: local schema existed only in disposable container databases; pgTAP data rolled back, Python fixtures and temporary invalid-test databases cleaned. Container removal status is recorded in final history evidence. Live durable effects: NONE. No permanent live backend mutation was performed in this phase. Migration status: PREPARED / LOCAL-TESTED / NOT APPLIED LIVE. Android/client/runtime status: UNVERIFIED, unchanged frontend source. No RPC, RLS, schema, grant, Storage or data mutation occurred on the live project. No commit/push/merge/deploy/EAS build. Reproduction and cleanup: supabase/test-support/README.md.


Final evidence (2026-10-31): 74/74 pgTAP and 4/4 extra backend checks passed; frontend typecheck PASS and 793/793 tests passed (0 failed/skipped/cancelled); SQL lint no schema errors; git diff --check PASS; documentation links/anchors 84 checked, 0 errors. The exact disposable test container ID was verified before stopping; --rm removed it and docker ps confirmed no matching container remains. Local test schemas/data are discarded. Tenancy migration SHA256 remains unchanged. Final branch feature/search-discovery-backend-integration; live deployment NOT performed. No commit/push/merge/deploy/EAS build.


## External completeness deployment report and presentation-only pass (2026-10-31)

Classification: EXTERNAL_BACKEND_CHANGE (reported prior deployment), plus local presentation-only maintenance. Recording date 2026-10-31; exact external execution time, actor/tool and applied-DDL transcript were not supplied. Source: user's attached contextual-guidance request, which states the live completeness migration is already deployed. Environment/project: RentLease live backend, as reported; no connection made by Codex in this pass. Target: migration 20261031072616_optimize_listing_completeness_refresh.sql and its internal calculation/refresh contract.

Purpose/result: carry forward user-supplied deployment context while moving existing frontend hint presentation. User-reported durable effect: automatic server completeness refresh is deployed. The repository migration file exists, but exact externally applied bytes/receipt were not independently verified. Do not attribute deployment to Codex or silently substitute prior local tests for live evidence. No SQL was replayed and no new migration was created/modified. Rollback/cleanup and live security/RLS test status: external details unavailable; no new runtime acceptance claimed. Earlier preparation/local validation entries remain historical.

Local source review used the existing migration and generated types read-only. All 64 protected backend/service/workflow/ViewModel/shared-service hashes stayed unchanged. No Supabase query, SQL, RPC, Storage action, test-data mutation or backend advisor call occurred in this pass. Only shared metadata keys and presentation are changed; persisted completeness remains server-authoritative. No permanent live backend mutation was performed by Codex in this phase. No commit/push/merge/deploy/EAS build. Android contextual-guidance UI is RUNTIME-UNVERIFIED; automated frontend evidence is in the existing implementation history.


## Property save failure inspection (2026-10-31)

- Feature/phase / entry: Property & Listing Management, SAVE-DIAG-20261031.
- Actor/tool: Codex via connected Supabase execute_sql, authorized read-only investigation; Android log supplied externally by user.
- Environment/project: live RentLease / cxfsbwbwmwmgtqfonqth.
- Classification: READ_ONLY_INSPECTION. No live RPC test or data mutation.
- Targets/action: catalog SELECTs using pg_get_functiondef/identity arguments/result for public.create_property_setup; pg_constraint for properties/property_private_locations/property_amenities; pg_trigger definitions; rentlease_completeness.lock_related_property/refresh_related_property; PostGIS st_makepoint/st_setsrid namespace lookup; has_function_privilege(authenticated, create_property_setup, EXECUTE), pg_class relrowsecurity; aggregate count/max(created_at) on properties. An initial combined multi-statement read exposed only its last result, so relevant catalogs were queried separately. No private address/coordinate/account rows were selected.
- Purpose/result: confirm Save contract and distinguish known rejection from uncertain mutation. Live create RPC has 19 parameters and JSONB created/property_id result matching frontend mapping, SECURITY DEFINER with pg_catalog search_path and authenticated EXECUTE. It checks Auth, active profile, Landlord and Tier 1, not Tier 3. Property and private-location RLS remain enabled. Coordinate PostGIS functions exist in extensions. Live physical-property CHECKs include nonnegative bedrooms/bathrooms, positive floor area/max occupants and floor_number <= total_floors. Related completeness triggers exist. These inspections do not prove which CHECK failed.
- Runtime evidence: user Android log `stage=rpc`, `rpcSent=true`, `code=23514`, `classification=rejected`. This confirms a database CHECK rejection and rollback of that request; exact constraint/error message was not retained by old diagnostics. No evidence supports blaming completeness, Auth, RLS or the trigger migration specifically. Updated diagnostics await Android retest.
- Persistence evidence: 9 properties; newest created_at 2026-10-30 04:09:14.818225+00. No October 31 row observed at inspection. No account-specific request correlation; older successful requests cannot be ruled out by aggregate evidence. Preserve reconciliation for unknown network outcomes.
- Durable effect: none. Rollback/cleanup: not applicable, SELECT only. Security/RLS: structural inspection only, no impersonation or owner/non-owner runtime test. No grants or policies changed.
- Source-controlled backend files: existing create-property and 20261031072616 completeness migration sources inspected, neither edited nor replayed. No migration created. User reports both 20261030042030 and 20261031072616 already deployed externally; deployment actor/tool/time/exact applied bytes not independently established by this pass.
- Android/client verification: existing rejection user-reported; revised diagnostic RUNTIME-UNVERIFIED. No permanent live backend mutation was performed in this phase.


## Saved-property workflow policy inspection (2026-10-31)

- Entry/phase: WORKFLOW-REPAIR-20261031, Property & Listing continuity.
- Actor/tool: Codex, Supabase execute_sql, live RentLease project cxfsbwbwmwmgtqfonqth.
- Classification: READ_ONLY_INSPECTION. Purpose: determine whether pending Tier 3 legitimately gates photo management or physical editing.
- Action/targets: one SELECT returning pg_get_functiondef for public.can_manage_property/public.can_view_property, pg_policies command/qual/with_check for public.property_photos, and has_table_privilege(authenticated, public.properties, SELECT/UPDATE). No user rows, private coordinates, addresses or media were queried.
- Result: can_manage_property permits Admin or matching property landlord, with no Tier 3 predicate. can_view_property permits management, Tier 1 with active listing, or tenancy parties. property_photos_manage_owner_admin ALL uses/checks can_manage_property(property_id); property_photos_read_allowed SELECT uses can_view_property(property_id). Authenticated properties SELECT=true, UPDATE=false. No evidence in these inspected objects of a pending-verification editing lock. Listing draft service inspection likewise has no frontend Tier 3 gate; publication requirements unchanged. This is structural read-only evidence, not a live owner/non-owner upload test or a complete security audit.
- Durable effect: none. Rollback/cleanup: not applicable, SELECT only. Migration/source-controlled change: none created, applied or edited. Existing policy/helper search paths were not modified in this frontend task.
- External runtime evidence: user confirmed successful physical property save and real UUID on Android, then photo-binding/continuity problems. No production test data was created by Codex. The previous exact CHECK constraint remains unknown; successful later save is not proof of its cause. Repaired photo/draft workflow remains Android RUNTIME-UNVERIFIED.
- Security: owner identity is revalidated on recovery, prior media is cleared on unverified access, different-owner context invalidates the binding, and in-flight generations/journals remain enforced. Automated mocks do not establish live RLS/Storage acceptance.
- No permanent live backend mutation was performed in this phase. No SQL/RPC/Storage mutation test or deployment occurred.


## Floor validation contract inspection (2026-10-31)

- Entry/phase: FLOOR-VALIDATION-20261031, Property & Listing save reliability.
- Actor/tool/environment: Codex via Supabase execute_sql, live RentLease cxfsbwbwmwmgtqfonqth. Classification: READ_ONLY_INSPECTION.
- Action/targets: one catalog SELECT joining no user data: pg_attribute/format_type/attnotnull for bedrooms, bathrooms, floor_area_sqm, floor_number, total_floors, max_occupants on public.properties; pg_constraint/pg_get_constraintdef for its CHECKs. Purpose: compare frontend numeric validation with actual creation storage rules.
- Result: floors/bedrooms/occupants smallint; bathrooms numeric(4,1) NOT NULL; floor_area_sqm numeric(10,2) nullable. CHECKs confirm nonnegative bedrooms/bathrooms, positive optional area/occupants, floor_number <= total_floors unless either NULL, server-owned safety_rating 0..5. Existing positive building-floor UI convention and ground floor 0 behavior were preserved, not invented from the pair CHECK.
- External evidence: user supplied Android properties_floor_numbers 23514 diagnostic with stage rpc, rpcSent=true, operation create_property_setup, outcome confirmed_failed. Exact attempted floor values/execution time were not supplied. PostgreSQL rejected/rolled back that attempt; no new live create or mutation test was executed by Codex.
- Durable effect: none. Rollback/cleanup: not applicable, SELECT only. Backend/source migration: none created, edited or applied. Existing generated RPC contract unchanged.
- Security/RLS: no changes or new access test; existing authenticated backend checks and RLS remain authoritative. No private address/coordinate/account/document data queried or logged.
- Android/client runtime: original failure user-reported, corrected client validation RUNTIME-UNVERIFIED. No permanent live backend mutation was performed in this phase.


## Contextual floor frontend boundary (2026-10-31)

Feature: Property & Listing contextual floors / validation navigation. Actor: Codex frontend implementation only. No live Supabase call, SQL execution, RPC/Storage test or database mutation occurred in this pass. No action classification requiring a live-action entry applies; this is an explicit no-interaction boundary record.

Contract consumed: generated property_type values and create_property_setup optional p_floor_number/p_total_floors, with the previously inspected NULL defaults and properties_floor_numbers CHECK. User-authorized whole-house semantics omit the inapplicable p_floor_number while retaining its draft entry locally; no backend behavior or object changed. Existing field-to-parameter names are preserved. Native/UI tests and mocked payload tests are not live runtime/security acceptance.

Environment: local frontend, existing branch and uncommitted work preserved; prior live RentLease evidence remains above, not reverified. Durable backend effect: none. Rollback/cleanup/migration: not applicable, none created/applied. Security/RLS/Storage unchanged, no new authorization claim. Android contextual fields, navigation/focus and accessibility remain RUNTIME-UNVERIFIED. No permanent live backend mutation was performed in this phase.


## Stage 1 validation presentation-only boundary (2026-10-31)

Local frontend Stage 1, actor Codex. No live Supabase inspection, SQL, RPC test, Storage call, test-data mutation or backend change occurred. Existing generated/confirmed creation contracts are consumed unchanged. No live action classification is applicable to this no-interaction boundary record.

Next readiness reuses the existing property validation model; touched/attempted flags affect presentation only. Disabled or programmatic invalid progression cannot send create_property_setup. Valid Next remains navigation only; the existing explicit Save and durable journals remain authoritative for persistence. RLS/backend constraints, profile eligibility, Tier 3, Storage and RPCs remain unchanged.

Durable backend effect: none. Migration/rollback/cleanup: not applicable. No schema/permissions or service changes. Prior live evidence above was not reverified. Android end-to-end acceptance for the new footer/interaction presentation remains RUNTIME-UNVERIFIED. No permanent live backend mutation was performed in this phase.


## Stage 2 completeness-footer presentation boundary (2026-11-01)

Actor: Codex, local frontend Stage 2. No live Supabase read, SQL execution, RPC/Storage test, test-data mutation or backend modification occurred. No live-action classification is applicable to this explicit no-interaction boundary record.

The footer consumes the existing ViewModel completeness percent/source and Stage 1 readiness. Backend-confirmed display remains authoritative; UI expansion/collapse neither reads nor writes the backend and is independent of form/persistence state. Existing RPCs, schemas, constraints, RLS/grants, Storage, validation, score weights/80% threshold, property-specific Tier 3 and journals are unchanged.

Durable backend effect: none. Migration/rollback/cleanup: not applicable. Historical live contract evidence is not reverified by this UI pass. Tests use mocked native presentation and existing business regression suites; native Android/keyboard/TalkBack acceptance remains RUNTIME-UNVERIFIED. No permanent live backend mutation was performed in this phase.


## Stage 3 draft-save presentation and diagnostics (2026-11-01)

Actor: Codex frontend implementation. Environment: local authoritative frontend repository on feature/search-discovery-backend-integration. No live backend action/classification applies: existing `save_listing_draft`, owner-scoped listing reads and local pending journal are reused without a backend contract change. Automated tests use mocks, not live RPC calls or data. Added safe development-only diagnostic metadata and private error causes; no secrets, addresses, coordinates or draft content are logged/documented.

Exact permanent SQL/Storage action: none. Durable backend effect: none. Rollback/cleanup: not needed. Schema/RLS/grants/functions/Storage remain unchanged; RLS remains authoritative. No migration was created/applied. Android/client runtime verification: not performed; RUNTIME-UNVERIFIED. No permanent live backend mutation was performed in this phase.


## Stage 2 shared-footer follow-up (2026-11-01)

Local presentation-only pass by Codex. No live Supabase action, SQL, RPC test, test data or Storage action occurred. Existing draft-save contract and RLS remain unchanged. No migration or cleanup is needed. No permanent live backend mutation was performed in this phase. Android/client acceptance remains RUNTIME-UNVERIFIED.


## Publication discoverability frontend pass (2026-11-01)

Actor: Codex local frontend implementation; no live Supabase inspection/RPC/test/mutation or Storage action. User-reported external observation: three live listings, all draft, zero active; not independently queried in this pass. This observation is context, not evidence that any particular listing meets publication eligibility. Existing publish_listing(p_listing_id), owner reads, journal and RLS remain authoritative and unchanged. Exact permanent SQL/backend action: none. No migration/source-controlled backend file added or modified. Durable effect: none; rollback/cleanup unnecessary. No permanent live backend mutation was performed in this phase. Android/client publication remains RUNTIME-UNVERIFIED for this entry-point change.


## PUBLISH-INV-01 - Read-only existing-listing investigation (2026-11-01)

- Feature/phase: Property & Listing publication runtime investigation.
- Actor/tool: Codex via Supabase execute_sql (two SELECTs) and query_logs (two read-only queries).
- Environment/project: live RentLease cxfsbwbwmwmgtqfonqth.
- Classification: READ_ONLY_INSPECTION. No RPC invoked by Codex.
- Target: one user-specified listing, related property/approved Tier 3 existence; publish_listing(uuid) definition; bounded edge logs.
- Purpose: distinguish no-RPC/rejection/response parsing/status refresh without publishing on the user's behalf.
- SQL read 1:
```sql
select l.id, l.property_id, l.status, l.completeness_score,
 l.published_at, l.updated_at, p.is_active as property_active,
 exists (select 1 from public.verification_submissions v
   where v.property_id=l.property_id and v.user_id=l.landlord_id
   and v.tier='tier_3_property' and v.status='approved') as property_tier3_approved
from public.listings l join public.properties p on p.id=l.property_id
where l.id='69fe5035-51d7-4a06-b42d-4c97959d7b9d';
```
- SQL read 2:
```sql
select pg_get_function_result('public.publish_listing(uuid)'::regprocedure) as return_contract,
 pg_get_functiondef('public.publish_listing(uuid)'::regprocedure) as definition;
```
- Log query 1 window: 2026-11-01T04:20:00Z through 2026-11-01T04:50:00Z:
```sql
select timestamp, event_message from logs
where source = 'edge_logs' and event_message like '%/rpc/publish_listing%'
order by timestamp desc limit 10
```
- Log query 2 window: 2026-11-01T04:35:50Z through 2026-11-01T04:37:00Z:
```sql
select timestamp, event_message from logs
where source = 'edge_logs' and event_message like '%/rest/v1/listings%'
order by timestamp asc limit 20
```
- Result: target active, score 1.0000, property active, approved property-specific Tier 3; published_at/updated_at 04:35:56.636907 UTC. POST publish_listing returned 200 at 04:35:56.609 UTC. Exact target owner/property-scoped GETs returned 200 at 04:35:55.875 (preflight), 04:35:57.064 (post-RPC), 04:35:58.165 and subsequent reads. Owner portfolio SELECT returned 200 at 04:36:08.942 and later. The RPC log does not expose its request body; target correlation uses timestamp, subsequent exact-ID reads and the persisted row. Live function TABLE return signature matches generated types/receipt parser.
- Security/RLS: definition retains authenticated/Tier 1/Landlord/owned draft/active property/property-specific Tier 3/duplicate-live checks with restricted search path. Inspection was privileged read-only, not a new client RLS/security test. Existing threshold/trigger behavior was not modified or bypassed. Raw log URLs containing owner identity are intentionally not copied here.
- Durable effect: none. Permanent SQL/Storage action: none. Rollback/cleanup: unnecessary. No test data created.
- Source-controlled backend file: none created or modified; existing external function history remains above.
- Android/client runtime: user subsequently said it appears properly published; no new agent-triggered Android request. Logs establish server success, not full native acceptance. PUBLICATION-DIAG absence is expected for success; unrelated available_locations SEARCH-DIAG is outside this investigation.
- No permanent live backend mutation was performed in this phase. No commit/push/merge/deploy/build.


## TIER3-INV-01 - Physical-property selection and Admin queue (2026-11-01)

Actor/tool: Codex via Supabase execute_sql, read-only SELECT/catalog inspection. Environment/project: live RentLease cxfsbwbwmwmgtqfonqth. Classification: READ_ONLY_INSPECTION. Purpose: correlate three reported listings to physical properties, eligibility and actual Tier 3 records without creating submissions or invoking privileged queue/review RPCs.

Query 1:
```sql
select l.id as listing_id,l.title,l.status as listing_status,p.id as property_id,
 p.is_active,p.landlord_id=l.landlord_id as owner_matches,
 (select count(*) from public.verification_submissions v where v.property_id=p.id
  and v.user_id=l.landlord_id and v.tier='tier_3_property') as tier3_submission_count,
 (select v.status from public.verification_submissions v where v.property_id=p.id
  and v.user_id=l.landlord_id and v.tier='tier_3_property'
  order by v.submitted_at desc,v.id desc limit 1) as latest_tier3_status
from public.listings l join public.properties p on p.id=l.property_id
where l.title in ('Black room for students saving','awdawdawdawd','1 floor for students');
```
Result: first draft property f8190762-ac43-4dcb-82d4-0774ea697f51 -> zero submissions; second draft property c1dd3981-23ff-4659-9ff1-c41e38b2b646 -> zero; active listing 69fe5035-51d7-4a06-b42d-4c97959d7b9d -> property 050092c9-7c94-41d5-8e21-42f8c28cfc43 -> one approved submission. All property/listing owner matches and property active flags true. No identity UUIDs were needed in documentation.

Query 2 attempted an assumed overloaded catalog signature:
```sql
select pg_get_functiondef('public.get_admin_verification_queue(integer,integer)'::regprocedure) as definition;
```
Result: 42883, function does not exist; no RPC was executed. Corrected read-only catalog inspection:
```sql
select pg_get_functiondef(p.oid) as definition from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='get_admin_verification_queue';
```
Result: actual no-argument function, authentication/Admin checks, pending/under_review verification_submissions joined to profiles and latest document; approved/absent submissions not returned. Source-controlled service invokes the correct no-argument RPC. This diagnostic typo was confined to catalog inspection and is not an application contract defect.

Eligibility/label read:
```sql
select l.title,p.id as property_id,p.property_type,p.city,p.barangay,
 (select count(*) from public.properties owned where owned.landlord_id=p.landlord_id) as owned_property_count,
 exists(select 1 from public.profiles pr where pr.id=p.landlord_id
  and pr.account_status='active' and pr.tier1_verified_at is not null) as tier1_active,
 exists(select 1 from public.user_roles ur where ur.user_id=p.landlord_id and ur.role='landlord') as landlord_role
from public.properties p join public.listings l on l.property_id=p.id
where l.title in ('Black room for students saving','awdawdawdawd','1 floor for students');
```
Result: five owned physical properties, active Tier 1 and Landlord role true; the draft properties label as House - Bayan Luma I, Imus and House - awdawdaw, Imus. Landlord picker source includes these physical IDs with no listing/status/submission filter. Native picker visibility or stale snapshot not independently reproduced.

Durable effect: none. Exact mutation/RPC/Storage action: none. Rollback/cleanup: unnecessary. Security/RLS: existing user/Tier 1/role/owner/Admin enforcement untouched; privileged reads do not establish a new live tenant/owner/Admin RLS test. No migration or backend source file created/changed. Android/client runtime: no submission/upload/review test, RUNTIME-UNVERIFIED. No permanent live backend mutation was performed in this phase. Existing work preserved; no commit/push/merge/deploy/build.


## Contextual Tier 3 entry integration (2026-11-01)

Codex frontend implementation only; no live Supabase query, RPC, upload, submission, review, SQL or backend mutation performed in this task. Runtime reads reuse getEligibleUserId/fetchOwnedProperties/fetchLatest from the existing Tier 3 service, preserving active Tier 1 Landlord/physical ownership checks and RLS. Future explicit submission continues through the existing service/private Storage flow; contextual opening performs no writes. No new schema/RPC/policy/grant/Storage contract or backend source file. Durable live effect: none; cleanup/rollback unnecessary. No permanent live backend mutation was performed in this phase. Mocked automated tests do not establish live RLS/Android acceptance. Android contextual entry/return remains RUNTIME-UNVERIFIED. Previous investigation evidence and unrelated local work are preserved.


## My Listings contextual Tier 3 follow-up (2026-11-01)

Frontend-only Codex pass. Existing owner-portfolio batch verification read and the same clicked-property Tier 3 ownership/status service are reused; no additional per-card request. No live Supabase query, RPC, submission, document upload, SQL or Storage action was performed in this task. No schema/RLS/grant/function/generated-type/backend source change. Durable effect: none; rollback/cleanup unnecessary. No permanent live backend mutation was performed in this phase. Tests are mocked local regressions; Android/client RUNTIME-UNVERIFIED. No commit/push/merge/deploy/build.


## EDIT-AUDIT-01 - Editing capability contract inspection (2026-11-01)

- Feature/phase: Property & Listing editing capability audit; recommendations only.
- Actor/tool: Codex via Supabase execute_sql; 14 read-only tool calls containing 15 SELECT statements. No data mutations/RPC tests/auth impersonation.
- Environment/project: live RentLease cxfsbwbwmwmgtqfonqth.
- Classification: READ_ONLY_INSPECTION.
- Purpose/authorization: user-requested audit of draft/active/physical update paths, authorization, concurrency, completeness and future availability. No backend change authorization inferred.

Read scopes and reproducible queries:

1. Public definitions/signatures for save_listing_draft, publish_listing, create_property_setup, validate_listing_owner and candidate public completeness functions:
```sql
select p.proname,pg_get_function_identity_arguments(p.oid) as args,
 pg_get_function_result(p.oid) as result,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
('save_listing_draft','publish_listing','create_property_setup','validate_listing_owner',
 'calculate_listing_completeness','refresh_listing_completeness') order by p.proname;
```
2. Public listing/property/photo/amenity function inventory and effective authenticated EXECUTE:
```sql
select p.proname,pg_get_function_identity_arguments(p.oid) as args,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and (p.proname ilike '%listing%' or p.proname ilike '%property%'
 or p.proname ilike '%photo%' or p.proname ilike '%amenit%') order by p.proname;
```
3-4. information_schema.role_table_grants (table_name/privilege_type) and role_column_grants (table_name/column_name/privilege_type, UPDATE only) for grantee authenticated, public schema and listings/properties/property_private_locations/property_amenities/property_photos. No broad UPDATE privileges were found; only photo alt_text/is_cover/sort_order column grants.
5. pg_policies SELECT of tablename, policyname, cmd, qual, with_check for the same five public tables, ordered by table/policy. Owner/Admin RLS exists but grants still gate ordinary writes.
6. Actual private-schema completeness definitions:
```sql
select n.nspname,p.proname,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='rentlease_completeness' order by p.proname;
```
7. Trigger catalog read and pg_indexes read were submitted together; connector output retained only the index SELECT. Index read:
```sql
select tablename,indexname,indexdef from pg_indexes
where schemaname='public' and tablename='listings';
```
Result: primary key plus ordinary active-search/landlord-status/property indexes; no unique draft-per-property index observed. This is not an assertion that duplicate drafts currently exist.
8. Trigger inspection repeated separately (including verification_submissions):
```sql
select c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
and c.relname in ('listings','properties','property_private_locations',
 'property_amenities','property_photos','verification_submissions')
and not t.tgisinternal order by c.relname,t.tgname;
```
9. pg_constraint CHECK definitions for public listings/properties (joined pg_class/pg_namespace), ordered by table/constraint. Positive rent/minimum stay and nonnegative deposit/advance checks; no available_from date restriction. Existing property floor relationship unchanged.
10. Read only the public dates/status of the user-specified listing:
```sql
select id,status,available_from,published_at from public.listings
where id='69fe5035-51d7-4a06-b42d-4c97959d7b9d';
```
Result: active, available_from 2026-11-06, published_at 2026-11-01 04:35:56.636907+00. No account identity, exact/private location or credentials queried.
11. Effective privileges, including inherited/column grants rather than assuming the information_schema inventory is sufficient:
```sql
select name,has_table_privilege('authenticated','public.'||name,'SELECT') as can_select,
 has_table_privilege('authenticated','public.'||name,'INSERT') as can_insert,
 has_table_privilege('authenticated','public.'||name,'UPDATE') as can_update_table,
 has_any_column_privilege('authenticated','public.'||name,'UPDATE') as can_update_any_column,
 has_table_privilege('authenticated','public.'||name,'DELETE') as can_delete
from unnest(array['listings','properties','property_private_locations','property_amenities','property_photos']) as t(name);
```
Result: first four SELECT only, all writes/any-column UPDATE false; photos SELECT/INSERT/DELETE true, broad UPDATE false, any-column UPDATE true (three columns above).
12-14. Three read-only pg_proc/pg_namespace definition excerpts of search_nearby_listings. First substring around initial available_from hit returned the TABLE return field, so a regexp_split_to_table line filter for available_from/current_date/status then a targeted substring after OR l.available_from <= established the actual predicate:
```sql
select substring(pg_get_functiondef(p.oid)
 from strpos(pg_get_functiondef(p.oid),'OR l.available_from <=') for 240) as availability_predicate
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='search_nearby_listings';
```
Result: OR l.available_from <= (now() AT TIME ZONE 'Asia/Manila')::date, followed by public-location distance filtering. Matches manual/location/detail available-now semantics, not publication eligibility.

Verified conclusions: save_listing_draft updates a found owned draft by its internal row UUID but takes a property UUID, selects newest draft or creates one, and has no expected-version parameter. Active-content/property/amenity update RPC absent from the inventory. Related completeness changes below active 80% roll back without auto unpublish. Approved Tier 3 currently refers to physical property_id, not a changed-property revision. Future dates are accepted for publish; discovery filters them until available. See continuous implementation history for the field matrix, concurrency gaps and proposed contracts.

Permanent SQL/RPC/Storage action: none. Durable live effect: none. Rollback/cleanup: unnecessary. Security/RLS: effective privilege/catalog inspection only, no live owner/non-owner mutation test or formal security claim. No source-controlled backend file/migration created or changed. Existing external backend provenance above remains intact. Android/client runtime: none newly performed; prior user publication evidence is historical. No permanent live backend mutation was performed in this phase. No commit/push/merge/deploy/build.


## DRAFT-EDIT-01 - Stage 1 exact-target draft editing (2026-11-01)

### Live read-only timestamp inspection

Actor/tool: Codex Supabase execute_sql. Environment/project: live RentLease cxfsbwbwmwmgtqfonqth. Classification READ_ONLY_INSPECTION. Target public.set_updated_at(). Exact query:
```sql
select pg_get_functiondef('public.set_updated_at()'::regprocedure) as timestamp_trigger;
```
Purpose: verify whether updated_at alone can serve as a strict concurrency token. Result: trigger assigns new.updated_at=now(); PostgreSQL now() is transaction-scoped. A later local real-database test verified two updates in one transaction have the same timestamp but distinct UUID edit tokens. Durable live effect none; no live RPC/mutation/fixture/Storage action; no cleanup needed. This is metadata inspection, not live owner/RLS acceptance.

### Prepared source-controlled backend change - NOT APPLIED LIVE

File supabase/migrations/20261101060000_update_listing_draft_exact_version.sql contains the exact proposed ALTER TABLE, token-trigger CREATE/REVOKE and update_listing_draft CREATE/REVOKE/GRANT statements. It is wrapped in one transaction. Proposed targets: listings.edit_version UUID default random; rotate_listing_edit_version trigger helper; scoped BEFORE UPDATE trigger; update-only controlled RPC with exact listing UUID/version. No old migration or existing create/publication/lifecycle function is replaced. RLS untouched; no direct listing UPDATE or anonymous execute grant. Version rotation is for content/identity/status writes, excluding derived completeness-only updates to preserve photo-save behavior. The existing legacy upsert remains for first creation and is not a version-checked API; no guarantee is made for arbitrary old clients continuing its unversioned edits.

Classification of intended mutation if approved later: SCHEMA_CHANGE + FUNCTION_CHANGE + PRIVILEGE_CHANGE. Current live durable effect NONE: explicit user approval to apply live has not been given. This file is a reviewable proposal and local-tested contract, not evidence of deployment.

### Disposable local backend implementation/tests

Actor/tool: Codex exec_command, Docker, psql, Python runner, Supabase CLI local type generator. Environment: locally created --rm container rentlease-draft-edit-test-20261101, image public.ecr.aws/supabase/postgres:17.6.1.141, loopback port 55439 only; no host data mount and no remote DB URL. Docker Desktop was initially stopped; started hidden for requested backend tests. Local fixture uses a public throwaway password, never a live credential.

Classifications: local SCHEMA_CHANGE/FUNCTION_CHANGE/PRIVILEGE_CHANGE (fixture/migration), RPC_TEST + TEST_DATA_MUTATION (controlled synthetic fixture create/update/publish tests), ROLLBACK_TEST (existing completeness pgTAP transaction). Targets include only local fixture Auth helpers, synthetic owner/role data, listings/properties/photo/location/amenity rows and recorded baseline RPC definitions. These tests are not live account impersonation, production Auth integration or formal RLS/security acceptance.

Exact SQL sources are durable: supabase/test-support/draft_edit_schema.sql includes the existing minimal completeness schema and the recorded baseline save/publication definitions, plus required fixture columns/enums/synthetic Auth helpers. Apply the existing 20261031072616_optimize_listing_completeness_refresh.sql and ONLY the new 20261101060000_update_listing_draft_exact_version.sql to a fresh fixture DB. The precise test RPC arguments, setup writes, two-session SQL, temporary second-draft insertion/deletion and assertions are in supabase/tests/run_draft_edit_concurrency.py; it refuses a remote URL and requires the disposable container prefix/image. No application test calls a live mutation.

Setup initially used the image's default postgres database, which already contained auth schema; setup failed after partial LOCAL fixture creation. Switched to fresh databases draft_edit_v1/v2/v3/v4/draft_edit_final and draft_edit_tap in the same disposable container. Intermediate schema/token tests were refined; only final complete suites count as final evidence. All these DBs are ephemeral and removed when this exact --rm container stops.

Final backend runner:
```powershell
python supabase/tests/run_draft_edit_concurrency.py --container rentlease-draft-edit-test-20261101 --database draft_edit_final
```
Result: 27 passed / 0 failed. Confirms same-transaction timestamp/token behavior; update-only exact old target even with another newer draft; stale/missing/foreign/unauthenticated/inactive/Tier 1/role rejection; column/execute privilege boundaries; no Tier 3 prerequisite; valid/cleared future availability; unchanged completeness/associations; repeated saves; simultaneous writers with one admitted version; both publication-versus-edit lock orders; no replacement inserts. Fixture publication uses the recorded real RPC definition and synthetic approved verification, not a client shortcut. Root direct status resets are clearly confined to disposable test fixture setup.

Static check in the local migrated DB used extensions.plpgsql_check_function_tb with the exact new RPC signature; zero error rows. Existing listing_completeness_refresh.sql executed via psql in fresh draft_edit_tap with both migrations, validated TAP plan 74 and 74 ok/zero not ok; psql exit 0. pg_prove executable was absent, so no pg_prove success is claimed. No dependency installation was needed to execute assertions.

Types generated with Supabase CLI gen types typescript against postgresql://...@127.0.0.1:55439/draft_edit_v1 (local throwaway fixture), schema public. CLI pulled postgres-meta:v0.96.6 tooling image. Only the generated new function and three Row/Insert/Update version-field entries were merged into canonical database.types.ts; full local fixture types did not replace live contracts. This does not claim live type regeneration or RPC availability. No project package/lockfile/native config change.

Security/RLS: controlled RPC explicitly validates caller, Tier 1/active/Landlord and owner/property/version/status under locks; existing policies remain authoritative for reads and grants are not broadened. SECURITY DEFINER is the trusted server write boundary, not a frontend/service-role bypass. Local fixtures cannot prove all production authorization behavior; post-approval Android/owner/non-owner runtime acceptance remains required. Version values are not credentials; no tokens/private form data are journaled or logged.

Durable LIVE effect: none. No permanent live backend mutation was performed in this phase. Cleanup: stop only the verified test container created here; its --rm ephemeral DBs are discarded. No SQL/migration applied remotely. Source-controlled backend files exist as above. Android/client runtime: RUNTIME-UNVERIFIED; live migration approval/deployment required before acceptance. No commit/push/merge/deploy/EAS build.


Final Stage 1 validation and cleanup (2026-11-01): typecheck PASS; full frontend suite 928 passed / 0 failed / 0 skipped / 0 cancelled. The post-RPC unreadable-reload test explicitly waits for RPC issuance before injecting the read failure; preflight remains successful. Local backend 27/27 and completeness pgTAP 74/74 remain passing. Verified task-owned container rentlease-draft-edit-test-20261101 (ID prefix 7b874a5fab51, expected PostgreSQL image, AutoRemove enabled) stopped successfully; its ephemeral local databases were discarded. No live database mutation or deployment occurred.


## PORTFOLIO-COMPAT-01 - Undeployed edit contract dependency correction (2026-11-01)

Feature: Property & Listing / My Listings compatibility. Actor: Codex local source/diff/test inspection only. Environment: local frontend C:\dev\RentLease-Frontend; no live Supabase tool/query/RPC/SQL action. Backend target: existing owner listings SELECT projection; prepared listings.edit_version/update_listing_draft remains undeployed. Classification: local application correction, NOT a live backend inspection or mutation.

Evidence: user reports live two active listings and one draft still exist and migration 20261101060000_update_listing_draft_exact_version.sql is NOT deployed. Local diff shows edit_version was added to portfolio listings SELECT; controlled pre-migration mock returns 42703 for that projection and reproduces the exact visible connection error before correction. Restoring deployed read fields loads all three records with no update RPC. Actual Android SQLSTATE is not independently captured here; diagnostics now distinguish it safely if any failure remains.

Action/result: remove edit-only column from read-only portfolio projection; no database change. Version/token requirements remain enforced for existing-draft writes, and missing contract never falls back to creation. RLS/owner filters/Tier 3 batching/photo namespace remain unchanged. Local frontend mocks do not establish live RLS enforcement. Exact permanent SQL: none. Durable backend effect: none. Rollback/cleanup: none needed. Source-controlled prepared migration remains unchanged and unapplied. Android RUNTIME-UNVERIFIED; no live records modified. No permanent live backend mutation was performed in this phase.


## DRAFT-EDIT-DEPLOY-PREFLIGHT - Blocked on recovery prerequisite (2026-11-01)

Actor/tool: Codex, Supabase get_project and list_migrations (read only), local SHA256/source inspection. Classification: READ_ONLY_INSPECTION. Environment/project: live RentLease cxfsbwbwmwmgtqfonqth, ACTIVE_HEALTHY. Purpose: user's conditional approval to deploy only 20261101060000_update_listing_draft_exact_version.sql after confirming backup/recovery.

Target/actions: project identity and current migration history; no SQL/RPC/Storage mutation. History ends at 20261031072616_optimize_listing_completeness_refresh; target migration absent. Local migration SHA256 131de44b385ad282efe3285ef809b2ff1612dd34083471473994becb76423b11 matches the preserved pre-review file hash and reviewed content. Source file exists at supabase/migrations/20261101060000_update_listing_draft_exact_version.sql.

Result: DEPLOYMENT NOT ATTEMPTED. Available connected tools provide no backup/PITR inspection capability; project response contains no restorable-backup/recovery-point evidence. Suitable backup/recovery prerequisite could not be confirmed, so the user's stop condition applies. Need dated successful backup or recoverable PITR-window confirmation for this exact project before deployment. No assumption that project health implies backups.

Durable backend effect: none. No permanent live backend mutation was performed in this phase. Rollback/cleanup: none needed. No application files, listing content/status, verification records or grants changed. Post-deployment checks not run because deployment did not occur. Security/RLS: unchanged, not retested. Android/client runtime: not performed. No commit/push/merge/build/deploy.


## DRAFT-EDIT-DEPLOY-01 - Authorized exact-target migration deployment (2026-11-01)

Actor/tool: Codex / Supabase get_project, list_migrations, execute_sql (SELECT only pre/post), apply_migration (single approved DDL). Environment: live RentLease cxfsbwbwmwmgtqfonqth, ACTIVE_HEALTHY, PostgreSQL 17.6.1.155. Authorization: explicit user approval for only the reviewed migration, with user-created dump exports and acknowledged absence of test restore/recovery limitations. Classifications: READ_ONLY_INSPECTION / SCHEMA_CHANGE / FUNCTION_CHANGE / PRIVILEGE_CHANGE.

Recovery prerequisite: user-created C:\RentLease-Backups\schema.sql (167531 bytes), data.sql (80902 bytes), roles.sql (358 bytes) independently confirmed present/nonempty. User states PostgreSQL dump contents and acknowledges no test restore and export recovery limitations. No PITR or tested restore guarantee is claimed. Backup contents/secrets were not logged.

Source: supabase/migrations/20261101060000_update_listing_draft_exact_version.sql. Exact byte SHA256: 131de44b385ad282efe3285ef809b2ff1612dd34083471473994becb76423b11. Rechecked file checksum and unchanged reviewed contents immediately before deployment. Exact SQL sent was the UTF-8 decoded complete source file, including BEGIN/COMMIT; no extra migration or application deployment. apply_migration project_id=cxfsbwbwmwmgtqfonqth, name=update_listing_draft_exact_version returned success:true. Source remains the authoritative exact SQL artifact; it was not rewritten.

Preflight: migration absent, no edit_version column, no function/trigger name collisions; three listings (two active, one draft); UUID generator present and READ COMMITTED default. Project identity/history rechecked. No unexpected schema discrepancy found. Existing schema compatibility was confirmed in the preceding read-only review.

Durable effect: listings.edit_version UUID NOT NULL DEFAULT gen_random_uuid(), populated on all three existing listings; enabled trg_listings_edit_version; rotate_listing_edit_version trigger helper; exact update_listing_draft signature and expected UUID version checks. New RPC authenticated EXECUTE only (plus owner postgres); anon/PUBLIC false. Trigger helper anon/authenticated/PUBLIC EXECUTE false. SECURITY DEFINER RPC owner postgres, search_path=pg_catalog; helper invoker, same restricted search path. No direct table grant/RLS/publication/Tier 3 change. Full function body and trigger definition read back and matched intended contract. No live mutation RPC test was run.

History: Supabase tool generated version 20261101130456, name update_listing_draft_exact_version (2026-11-01 21:04:56 UTC+8). This is the deployed mapping of local source version 20261101060000, not an additional migration. History contains exactly one new entry; prior entries unchanged. DO NOT replay the local timestamp as an unapplied migration. Any future CLI migration-history reconciliation must account for this recorded mapping and be separately scoped; no history rewrite or file rename performed here.

Non-destructive SELECT verification: 3/3 non-null UUID tokens and three distinct tokens; listing count and statuses unchanged (active=2,draft=1). Before/after all-existing-listing-fields fingerprint excluding new token: 1e2552a3645baa8e55347bbfb0498519. Publication id/status/published_at/updated_at fingerprint: 5f475ee6b55b433308b3c134d8343496. Verification-record fingerprint: 39ae9fbe445a03c7f889f9b4460e94a1. All three fingerprints identical before/after, demonstrating no changes to existing listing contents, relationships, timestamps or verification rows during this deployment. No real listing edited/published/deleted and no verification mutation.

Result: DEPLOYED / CATALOG-VERIFIED; Android editing RUNTIME-UNVERIFIED. Rollback/cleanup: committed successfully; none performed/needed. Backup files retained. No application change, unrelated migration, commit/push/merge/build. Runtime mutation/concurrency tests remain the previously recorded disposable-local evidence, not tests against actual user records.


## DRAFT-HYDRATION-01 - Frontend read orchestration correction (2026-11-01)

Actor: Codex local source/diff and controlled frontend tests only. Environment: local frontend branch feature/search-discovery-backend-integration. Classification: frontend correction; no new live backend action. Existing dependencies: deployed update_listing_draft (history 20261101130456), owner properties/listings reads, property_photos, amenities/property_amenities, private-location existence and property-specific verification. No live SQL/RPC/Storage action in this pass. Purpose/result: coherent saved-draft loading, generation-safe Back/reopen and removal of duplicate reads; see current living feature/history hydration section. Fresh authorized listing restoration is reused without a second listing fetch; authorization is checked before/after reads and before mutations, with existing journals retained. No change to server ownership/security rules.

External evidence supplied by user: Android My Listings/draft editing/same-UUID update now pass; previously published listings unchanged. This is user-reported runtime evidence for the pre-correction revision, not fresh live database inspection by Codex. Exact mutation SQL: none. Durable backend effect: none. Rollback/cleanup: none. Source-controlled migration 20261101060000 remains untouched and must not be replayed; deployed history mapping unchanged. No permanent live backend mutation was performed in this phase. Automated frontend 943/943 passing; corrected Android hydration RUNTIME-UNVERIFIED. No commit/push/merge/deploy/build.


## PUBLISHED-EDIT-01 - Stage 2 contract inspection and local preparation (2026-11-01)

Actor/tool: Codex / Supabase execute_sql SELECT only. Environment: live RentLease cxfsbwbwmwmgtqfonqth. Classification READ_ONLY_INSPECTION. Target/action: one catalog aggregation of pg_proc definitions for update_listing_draft, rotate_listing_edit_version, publish_listing, pause_listing, reactivate_listing, archive_listing, validate_listing_owner; listings trigger definitions; existence check for update_published_listing_content; authenticated table grants. Purpose: verify Stage 1 token mechanism, lock compatibility, completeness/status enforcement and absence of an existing authorized published-content contract.

Result: existing version trigger present; content/status changes rotate UUID; existing active validation recomputes score and requires >=0.80; publish/reactivate enforce property-specific Tier 3; publish/reactivate use property advisory key, pause/archive use exact listing row locks; authenticated listings privilege SELECT only. New RPC absent. No live listing content or private-data read/test occurred. Existing function definitions/grants/policies were not changed. Security/RLS: inspected trusted function checks/SELECT-only grants, not live negative runtime mutation cases. Durable effect none; cleanup none. Android Stage 1 acceptance is user-reported; Stage 2 RUNTIME-UNVERIFIED.

## PUBLISHED-EDIT-02 - Prepared migration and disposable PostgreSQL tests (2026-11-01)

Actor/tool: Codex local Supabase CLI, Docker PostgreSQL17/psql, Python runner, Node tests/typecheck. Environment: disposable rentlease-draft-edit-test-published container, loopback 15439; LOCAL ONLY. Classification local SCHEMA_CHANGE / FUNCTION_CHANGE / PRIVILEGE_CHANGE / TEST_DATA_MUTATION / ROLLBACK_TEST; no corresponding live mutation. Source exact SQL: supabase/migrations/20261101141819_update_published_listing_content.sql, created with CLI migration new. Adds only prerequisite check plus new update_published_listing_content and REVOKE PUBLIC/anon + GRANT authenticated EXECUTE. Never applies original Stage 1 timestamp to live; its local SQL is fixture setup only. Migration remains PREPARED / NOT APPLIED LIVE.

Durable LIVE effect none. Local fixture mutations are committed synthetic records except pgTAP rollback. Final local integration: 27 Stage 1 + 30 Stage 2 passed, 74 existing completeness assertions passed, zero static RPC error rows. Exact reproducible commands/tests are in supabase/test-support/DRAFT_EDIT_TESTING.md and run_published_edit_concurrency.py; no production connection URL is used. Synthetic auth/Tier 1 role helpers and owner RLS are not a full production security dump. Types generated only from the locally migrated aligned fixture; new RPC entry merged into canonical generated types, unrelated entries preserved. No project dependency change.

Local cleanup: stop only the verified task-owned --rm container after final validation; all its disposable databases removed. No actual listings edited/published/deleted and no verification records changed remotely. No permanent live backend mutation was performed in this phase. Separate readiness/backup review and explicit approval required before live deployment. No commit/push/merge/deploy/build.


Final Stage 2 checks (2026-11-01): typecheck PASS; frontend 961/961, zero failed/skipped/cancelled; final local PostgreSQL published_edit_v3 27 Stage 1 + 30 Stage 2 checks passed; completeness pgTAP 74 ok/zero not ok/plan 1..74; static RPC error rows zero. Documentation 53 links/anchors checked, zero errors; git diff --check and staged whitespace checks PASS; protected audit 361 files with zero unexpected changes. Removing only the generated new RPC block restores database.types.ts to its pre-stage checksum. Prepared migration SHA256: 29451d996037bb67726fa94ebb9289db9185e5d08dcbefe4ed52383da98fcd75. Verified own disposable container ID prefix b8daf93e619c/image/AutoRemove and stopped it successfully; its local databases were discarded. No live migration or user-data mutation occurred.


## PUBLISHED-EDIT-DEPLOY-PREFLIGHT - Fresh backup prerequisite blocked (2026-11-01)

Actor/tool: Codex / local file metadata and checksum; Supabase get_project, list_migrations, execute_sql SELECT-only catalog inspection. Classification READ_ONLY_INSPECTION. Target: live RentLease cxfsbwbwmwmgtqfonqth and prepared 20261101141819_update_published_listing_content.sql. Purpose: user's conditional Stage 2 deployment authorization.

Project ACTIVE_HEALTHY and exact ID confirmed. Local SHA256 29451d996037bb67726fa94ebb9289db9185e5d08dcbefe4ed52383da98fcd75 matches expected. History includes Stage 1 20261101130456_update_listing_draft_exact_version; Stage 2 absent. Catalog confirms UUID NOT NULL edit_version, enabled expected rotation trigger and helper definition, existing exact-target draft RPC, no published-content RPC. No observed discrepancy in these prerequisite objects. No bulk migration command or apply_migration invoked.

STOPPED before deployment: only known manual exports at C:\RentLease-Backups\schema.sql, data.sql, roles.sql remain unchanged (167531 / 80902 / 358 bytes), last modified 2026-11-01 12:58:04 / 12:58:54 / 12:59:01 UTC (20:58:04 / 20:58:54 / 20:59:01 UTC+8). They predate Stage 1 deployment 13:04:56 UTC, so a fresh current-schema/data backup cannot be confirmed. No new backup path or newer recovery evidence supplied/found. Backup content was not logged. Need refreshed current-project exports or confirmed fresh backup/recovery evidence before applying Stage 2.

Durable backend effect none. No permanent live backend mutation was performed in this phase. Rollback/cleanup none. No listings/verification records edited, no RPC executed for mutation/testing, no deployment-history timestamp created. Postdeployment ACL/signature/data-preservation checks not performed because deployment did not occur. Android Stage 2 acceptance remains blocked on deployment. Source migration unchanged; no commit/push/merge/build.


## PUBLISHED-EDIT-DEPLOY-01 - Authorized controlled Stage 2 deployment (2026-11-01)

Actor/tool: Codex / local metadata and content-marker/checksum inspection; Supabase get_project, list_migrations, execute_sql SELECT-only pre/post; apply_migration for exactly the authorized file. Environment: live RentLease cxfsbwbwmwmgtqfonqth, ACTIVE_HEALTHY. Classifications: READ_ONLY_INSPECTION / FUNCTION_CHANGE / PRIVILEGE_CHANGE. Authorization: user explicitly resumed deployment after refreshed manual backups, acknowledging no restore test and limits versus managed recovery.

Backup preflight: used ONLY C:\RentLease-Backups\stage2-predeploy-20261101-225203. schema.sql 174459 bytes, modified 2026-11-01 14:53:28 UTC (22:53:28 UTC+8); data.sql 81457 bytes, 14:54:04 UTC (22:54:04 UTC+8); roles.sql 358 bytes, 14:54:20 UTC (22:54:20 UTC+8). Data dump contains PostgreSQL dump header/completion and COPY/INSERT statements. Schema contains PostgreSQL SET configuration, 127 schema CREATE statements, quoted listings definition, edit_version UUID, Stage 1 update_listing_draft and rotation trigger; lack of conventional header comments alone is not treated as invalid schema SQL. Roles contains SET and CREATE/ALTER ROLE statements. No dump data, secrets or personal values were printed. Content inspection confirms expected export structure, not a successful restore or full managed backup equivalence.

Source exact SQL: supabase/migrations/20261101141819_update_published_listing_content.sql. SHA256 rechecked immediately before apply: 29451d996037bb67726fa94ebb9289db9185e5d08dcbefe4ed52383da98fcd75. Sent the complete unchanged UTF-8-decoded source, including transaction/prerequisite check, through apply_migration(project_id=cxfsbwbwmwmgtqfonqth,name=update_published_listing_content). No bulk migration command or unrelated SQL/DDL. Result success:true.

Preflight: exact project confirmed; Stage 1 history 20261101130456 present and untouched; UUID NOT NULL column, enabled expected trigger and helper definition match; Stage 2 function/history absent; existing listing/function fingerprints captured. No prerequisite schema discrepancy found.

Actual history: 20261101145623_update_published_listing_content, 2026-11-01 14:56:23 UTC / 22:56:23 UTC+8. Supabase assigned deployment-time version, mapping to local 20261101141819 source. Do not replay either original local Stage 1 or Stage 2 timestamp through a bulk migration command. No file rename or migration-history rewrite performed. All prior history entries preserved; exactly one new entry.

Durable effect: new public.update_published_listing_content(p_listing_id uuid,p_expected_edit_version uuid,p_title text,p_description text,p_asking_rent_monthly numeric,p_house_rules text default null,p_rental_term public.rental_term_type default long_term,p_security_deposit_months numeric default 1,p_advance_rent_months numeric default 1,p_minimum_stay_months smallint default null,p_available_from date default null) RETURNS SETOF public.listings. Owner postgres, SECURITY DEFINER, search_path=pg_catalog. authenticated EXECUTE true; anon and PUBLIC false. listings authenticated table privilege remains SELECT only. Full function body read back: authenticated active Tier 1/Landlord checks, owned active property/listing, property advisory/row locks, expected version and active/paused restriction, allowed-content-only update, and status/publication-time invariant are present. No actual content RPC invoked for verification; authorization evidence here is definition/ACL inspection, not a new live denial/write test.

Post-deployment non-destructive SELECT evidence: listing count remains three, active=2/draft=1; all three version tokens remain non-null. Full existing listing-row fingerprint (including UUIDs, all content, status, publication/updated timestamps and version): a7e76a664dc7883122bfe860c3d0aaff identical pre/post. Verification rows fingerprint: 39ae9fbe445a03c7f889f9b4460e94a1 identical. Existing Stage 1/publication/lifecycle/validation function definitions fingerprint: 91032e252440cd5d1ce65f3bf5f78fcf identical. Rotation trigger enabled with unchanged column list/helper. No listing edited/published/paused/archived/deleted, no duplicate inserted and no verification records changed. Trigger configuration verified; no actual-row mutation test was performed to exercise rotation.

Result: DEPLOYED / CATALOG-VERIFIED. Rollback/cleanup: committed successfully; none needed/performed. Refreshed manual exports retained; restore-test limitation remains acknowledged. Android Stage 2 edit/save/date/conflict/network/Back/reopen acceptance remains RUNTIME-UNVERIFIED. No application changes, commit/push/merge/EAS build. Earlier local test evidence remains 961 frontend / 57 backend / 74 completeness passes; not rerun during this deployment-only pass.
