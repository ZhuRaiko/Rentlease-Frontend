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
