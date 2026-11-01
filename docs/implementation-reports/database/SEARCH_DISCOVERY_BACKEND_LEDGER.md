# Search & Discovery backend interaction ledger

Current behavior: [living feature document](../../features/SEARCH_DISCOVERY.md). Evidence/roadmap: [continuous implementation history](../phases/SEARCH_DISCOVERY_IMPLEMENTATION.md). This ledger records backend actions, not authorization for mutations.

## GPS-01 - RPC structural and authorization inspection (2026-10-29)

- Date/phase: 2026-10-29, GPS proximity integration on feature/gps-proximity-integration; exact execution time not recorded.
- Actor/tool: Codex, Supabase connector execute_sql. Environment: live RentLease project cxfsbwbwmwmgtqfonqth.
- Classification: READ_ONLY_INSPECTION. Target: public.search_nearby_listings catalog definition/result/ACL.
- Purpose: verify the existing contract against the prepared GPS adapter before frontend integration. Authorized read-only inspection; no live caller simulation.
- Exact query:

```sql
select p.oid::regprocedure::text as signature,
       pg_get_function_result(p.oid) as result,
       pg_get_functiondef(p.oid) as definition,
       p.proacl::text as acl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='search_nearby_listings';
```

- Result: five parameters latitude/longitude double precision, radius/limit/offset integer (defaults 3/20/0). Returns listing_id/property_id UUID, nullable-capable SQL text/date/numeric summary plus public latitude/longitude/distance. Matches adapter names/shape. Function is STABLE SECURITY INVOKER, empty search_path; ACL postgres/authenticated EXECUTE, no PUBLIC/anon EXECUTE in observed ACL. Definition checks auth.uid(), Tenant and Tier 1, coordinates/radius/pagination. Reads active listings and properties, available_from <= Asia/Manila date or null, uses PostGIS ST_DWithin/ST_Distance on properties.public_location, nearest-first then listing ID, limit/offset. No private/exact property location read.
- Durable effect: none. Rollback/cleanup: not applicable; no rows/objects created or modified.
- Security/RLS: function/ACL inspection only; no authenticated positive/negative search was run. Underlying SELECT grants/RLS and runtime dependencies still require live client acceptance. No advisor/compliance claim.
- Source-controlled backend file: no GPS migration supplied/created; existing live function consumed unchanged.
- Android/client runtime: not performed; RUNTIME-UNVERIFIED.

## GPS-02 - Type generation (2026-10-29)

- Actor/tool/environment: Codex Supabase connector generate_typescript_types(project_id=cxfsbwbwmwmgtqfonqth), live structural read.
- Classification: READ_ONLY_INSPECTION. Target: generated TypeScript schema contract, missing search_nearby_listings entry.
- Purpose/result: CLI version/help attempts failed on user telemetry-file write permissions; connector generation succeeded. Generated GPS Args/Returns copied exactly into the existing canonical file. Unrelated function ordering/definitions were preserved rather than replacing the whole file. SQL nullability/business/RLS are not inferred from generated non-null return fields; packaged runtime parser remains authoritative validation of received rows.
- Durable backend effect: none; local TypeScript entry only. Rollback/cleanup: not applicable. Security/RLS: generation is not permission testing. Source-controlled backend file: none added. Android/client runtime: not performed.

## Earlier abandoned GPS inspection - backfill (2026-10-29)

Before the user stopped the prior GPS attempt and restored its local files to 9e4ba15, Codex had performed the same read-only catalog query and connector generation on this project. This is separate historical provenance, not a current mutation or a claim that its discarded local source remains implemented. Exact earlier times unavailable. Result matched GPS-01. Classification READ_ONLY_INSPECTION, no durable backend effect, no test data, rollback/cleanup not required, no new migration, no live search RPC/native runtime test. The subsequent local cleanup did not change backend state.

No permanent live backend mutation was performed in this phase. No search RPC test, SQL mutation, grant, schema/RLS/function/trigger/Storage change or test-data creation was performed. User-supplied zero active/draft/GPS-eligible listing counts were not re-queried in this pass; legitimate empty results are supported without production fixtures.


## MANUAL-01 - Search read-contract inspection (2026-10-30)

Feature/phase: manual Search & Discovery on feature/search-discovery-backend-integration, baseline 7eb361b. Actor: Codex / Supabase execute_sql connector. Environment: live RentLease cxfsbwbwmwmgtqfonqth. Classification: READ_ONLY_INSPECTION. Purpose: verify generated tables/relationships, read grants, RLS, visibility helper, media and geography/favorites boundaries before frontend queries.

Three read-only calls were made. The first call contained these catalog SELECTs; the connector returned its last SELECT result only (can_view_property definition), so policy/grant inspection was repeated as one JSON result in the next call.

```sql
select schemaname,tablename,policyname,roles,cmd,qual from pg_policies
where schemaname='public' and tablename in
('listings','properties','property_photos','property_amenities','amenities','saved_listings');
select table_name,privilege_type from information_schema.role_table_grants
where grantee='authenticated' and table_schema='public' and table_name in
('listings','properties','property_photos','property_amenities','amenities');
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('can_view_property','can_view_listing');
```

```sql
select jsonb_build_object(
 'policies',(select jsonb_agg(to_jsonb(p)) from
   (select tablename,policyname,roles,cmd,qual from pg_policies
    where schemaname='public' and tablename in
    ('listings','properties','property_photos','property_amenities','amenities','saved_listings')) p),
 'grants',(select jsonb_agg(to_jsonb(g)) from
   (select table_name,privilege_type from information_schema.role_table_grants
    where grantee='authenticated' and table_schema='public' and table_name in
    ('listings','properties','property_photos','property_amenities','amenities','saved_listings')) g)
) as contract;
```

```sql
select jsonb_build_object(
 'saved_select',has_table_privilege('authenticated','public.saved_listings','SELECT'),
 'saved_insert',has_table_privilege('authenticated','public.saved_listings','INSERT'),
 'saved_delete',has_table_privilege('authenticated','public.saved_listings','DELETE'),
 'property_media',(select jsonb_build_object('id',id,'public',public)
   from storage.buckets where id='property-media'),
 'geographic_columns',(select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type))
   from information_schema.columns where table_schema='public' and table_name='properties'
   and column_name in ('city','barangay','province','region','public_location'))
) as contract;
```

Observed results/security boundary:

- Authenticated SELECT is granted on listings/properties/property_photos/property_amenities/amenities. Existing photo INSERT/DELETE also appeared; neither is used by manual search. No privilege was changed.
- listings_read_allowed includes active + Tier 1 or owner/Admin/tenancy access. properties_read_allowed uses owner or can_view_property(id). can_view_property is existing SECURITY DEFINER with public search_path, permitting management, Tier 1 with active listing or tenancy relationship; inspected unchanged, not endorsed as a new function or security remediation.
- property_photos/property_amenities SELECT uses can_view_property(property_id); amenities SELECT uses active or Admin. Existing management policies remain unchanged.
- saved_listings owner/Admin RLS exists, but authenticated SELECT/INSERT/DELETE table privilege checks each returned false. Saving remains deferred; no grant/migration attempted.
- property-media exists and is public. Frontend reuses the existing namespace validator/public-URL builder, without touching Storage configuration or listing private documents.
- geographic columns found: city enum, barangay text, public_location PostGIS user-defined type. No province/region. Generated public_location remains unknown; manual map projection/parser not invented.

Result: confirmed read-only structural/security basis for server-side joined queries. Frontend additionally filters active listing, active property and current Philippine availability day, independent of broader owner/Admin read rights. No exact/private property location is queried.

Durable backend effect: none. Rollback/cleanup: not required, no rows or objects created/modified. Source-controlled backend migration/file: none added or executed. No SQL identity simulation, live authenticated client search/detail/filter query, security advisor run, RPC test or Android runtime verification was performed; those remain RUNTIME-UNVERIFIED. Date of execution 2026-10-30; exact times not recorded.

No permanent live backend mutation was performed in this phase. No schema, RLS, grant, RPC/function/trigger or Storage change; no synthetic production fixtures.


## RUNTIME-01 - Permission and zero-data investigation (2026-10-30)

Actor/tool: Codex / Supabase execute_sql connector. Environment: live RentLease cxfsbwbwmwmgtqfonqth; local feature/search-discovery-backend-integration. Classification: READ_ONLY_INSPECTION. Purpose: distinguish intentional GPS eligibility exceptions, possible query-permission dependencies and legitimate zero eligible listing data, without changing the backend. Exact execution times not recorded.

```sql
select jsonb_build_object(
 'tenancies_select',has_table_privilege('authenticated','public.tenancies','SELECT'),
 'listings_select',has_table_privilege('authenticated','public.listings','SELECT'),
 'properties_select',has_table_privilege('authenticated','public.properties','SELECT'),
 'active_listings',(select count(*) from public.listings where status='active'),
 'active_properties',(select count(*) from public.properties where is_active),
 'gps_execute',has_function_privilege('authenticated',
   'public.search_nearby_listings(double precision,double precision,integer,integer,integer)','EXECUTE'),
 'gps_definition',(select pg_get_functiondef(p.oid) from pg_proc p
   join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='search_nearby_listings')
) as contract;
```

```sql
select jsonb_build_object(
 'active_tier1_tenants',(select count(*) from public.profiles p
   where p.account_status='active' and public.is_tier1_verified(p.id)
   and exists(select 1 from public.user_roles r where r.user_id=p.id and r.role='tenant')),
 'listings_read_policy',(select qual from pg_policies
   where schemaname='public' and tablename='listings' and policyname='listings_read_allowed')
) as contract;
```

Observed result: active Tier 1 Tenant count 3; active listings 0; active properties 7; authenticated listing/property SELECT and GPS EXECUTE true; authenticated tenancies SELECT false. The current listing read policy directly references tenancies in an EXISTS branch. GPS source remains SECURITY INVOKER and retains intentional Tenant verification required / 42501, Authentication required / 28000, public-point PostGIS filtering and existing ordering. No source-controlled backend definition was added or replayed.

Security/RLS interpretation: a missing privilege on a policy dependency can produce a permission error independently of the intentional eligibility exception. This is a confirmed catalog dependency gap, not proof that a specific device error referenced that table; no authenticated caller/RLS simulation or live GPS/query execution was performed. New frontend development diagnostics expose only validated code, categorical classification and fixed stage, not raw errors/identities/coordinates. Actual Android correlation and backend-owner review remain pending. No suggested broad grant or policy bypass was executed.

Durable effect: none. Rollback/cleanup: not applicable; no rows/objects/privileges changed. Android/client runtime: user-reported failures before correction, revision/build unspecified; after correction RUNTIME-UNVERIFIED. No secret/user ID was recorded. No permanent live backend mutation was performed in this phase.


## LOC-INV-01 - Available Locations read-only investigation (2026-11-01)

Actor/tool: Codex Supabase query_logs and execute_sql. Environment/project: live RentLease cxfsbwbwmwmgtqfonqth. Classification: READ_ONLY_INSPECTION. Purpose: trace reported available_locations network/unknown event and verify target listing against the actual query filter. No RPC invoked, identity impersonation, mutation, new fixture or Storage action.

Log query window: 2026-11-01T04:30:00Z through 2026-11-01T05:30:00Z:
```sql
select timestamp,event_message from logs where source='edge_logs'
and event_message like '%/rest/v1/listings?select=id%2Cproperties%'
order by timestamp desc limit 20
```
Observed four exact locations-query GET 200 responses at 04:33:02.781, 04:36:03.481, 04:37:30.520 and 04:37:45.425 UTC. Server logs have no response body and cannot establish a historical client abort or non-arriving network failure.

SQL inspections (the first two SELECTs were submitted together; the connector returned only the final policy result, so the target SELECT was repeated separately):
```sql
select l.id,l.status,l.available_from,p.city,p.barangay,p.is_active,
(l.status='active' and p.is_active and
(l.available_from is null or l.available_from <= (current_timestamp at time zone 'Asia/Manila')::date))
as matches_discovery_base
from public.listings l join public.properties p on p.id=l.property_id
where l.id='69fe5035-51d7-4a06-b42d-4c97959d7b9d';
select tablename,policyname,roles,cmd,qual from pg_policies
where schemaname='public' and tablename in ('listings','properties') and cmd='SELECT';
```
Repeated target read used explicit date '2026-11-01' instead of the clock expression, matching the observed Android URL. Result: active, property active, available_from 2026-11-06, matches_discovery_base false. City/barangay returned for contract inspection but are unnecessary to reproduce the date exclusion and are not copied here.
```sql
select count(*) as matching_available_locations_rows
from public.listings l join public.properties p on p.id=l.property_id
where l.status='active' and p.is_active=true
and (l.available_from is null or l.available_from<=date '2026-11-01');
```
Result: zero. RLS can further restrict the result, not add this excluded record. listings_read_allowed permits active listings to Tier 1-verified authenticated readers plus owner/Admin/tenancy exceptions; properties_read_allowed uses owner or can_view_property(id). These privileged reads are not a live tenant-token test. No policies/grants/functions or filters were changed.

Permanent SQL/backend action: none. Durable effect: none. Rollback/cleanup: unnecessary. Source-controlled backend file: none added/modified. Android/client evidence: user reports successful-empty copy; post-fix cancellation/offline/tenant acceptance remains RUNTIME-UNVERIFIED. No permanent live backend mutation was performed in this phase. Prior uncommitted publication investigation and independent android/ and ninja-error.txt are preserved. No commit/push/merge/build/deployment.
