# Isolated listing-completeness database tests

This support schema is **not a production migration or a full Supabase schema dump**. It models the inspected score/ownership/status surface, relevant FKs/indexes, SELECT-only listing client access and owner RLS. Auth, PostGIS, Storage, Tier 3, tenancy and all publication RPCs are not recreated. Existing live RPCs are not modified or called by these tests.

Use an unused disposable container name beginning `rentlease-completeness-test-` and a free loopback port. Docker must be running. The password below is a public throwaway local test value, not a project credential. Do not substitute a live URL or use --linked/db push/migration up: those could include the unrelated tenancy migration.

From the repository root in PowerShell:

```powershell
docker run --rm -d --name rentlease-completeness-test-local -e POSTGRES_PASSWORD=rentlease-local-test-only -p 127.0.0.1:55438:5432 public.ecr.aws/supabase/postgres:17.6.1.141
# Wait until accepting connections:
docker exec rentlease-completeness-test-local pg_isready -U postgres

docker cp supabase/test-support/listing_completeness_schema.sql rentlease-completeness-test-local:/tmp/completeness-schema.sql
docker cp supabase/migrations/20261031072616_optimize_listing_completeness_refresh.sql rentlease-completeness-test-local:/tmp/completeness-migration.sql
docker exec rentlease-completeness-test-local psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/completeness-schema.sql
docker exec rentlease-completeness-test-local psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/completeness-migration.sql

npx supabase test db supabase/tests/listing_completeness_refresh.sql --db-url 'postgresql://postgres:rentlease-local-test-only@127.0.0.1:55438/postgres?sslmode=disable'
python supabase/tests/run_completeness_concurrency.py --container rentlease-completeness-test-local
npx supabase db lint --db-url 'postgresql://postgres:rentlease-local-test-only@127.0.0.1:55438/postgres?sslmode=disable' --schema public,rentlease_completeness --fail-on error
npx supabase db advisors --db-url 'postgresql://postgres:rentlease-local-test-only@127.0.0.1:55438/postgres?sslmode=disable' --type all --level warn --fail-on error

# Remove only the test container YOU created; --rm discards its ephemeral database.
docker stop rentlease-completeness-test-local
```

CLI output may say "remote database" for --db-url; the address above is localhost only. There is no host data volume. Check each command exit status before continuing. Never execute the support-schema file against live.

The [pgTAP suite](../tests/listing_completeness_refresh.sql) uses one rolled-back transaction (74 assertions). The Python runner uses real parallel PostgreSQL connections plus separate temporary databases (4 integration checks), accepts a disposable container only, and cleans its committed fixtures. It also accepts --database for a fresh isolated database inside the same container. Minimal test-policy advisor warnings and the baseline set_updated_at search-path warning are reported in the implementation history; they do not establish production security acceptance.

The [migration](../migrations/20261031072616_optimize_listing_completeness_refresh.sql) must still be separately reviewed/authorized before live application. Its active-score preflight aborts the entire migration for any active listing calculated below 80%, including an already-current invalid score. Resolve such records through approved existing lifecycle actions before retrying. No auto-pause/archive is performed. Completeness-affecting related writes require the live default READ COMMITTED isolation; stale-snapshot REPEATABLE READ/SERIALIZABLE writes are rejected before mutation.
