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
