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


## Milestone 2 media tests (local only)

No host port or live connection is needed. Create only this disposable container, copy fixture contents, and check each command's exit code before continuing:

```powershell
docker run --rm -d --name rentlease-media-test-local -e POSTGRES_PASSWORD=rentlease-local-test-only public.ecr.aws/supabase/postgres:17.6.1.141
docker exec rentlease-media-test-local pg_isready -U postgres
docker exec rentlease-media-test-local createdb -U postgres media_milestone2
docker cp supabase/test-support/. rentlease-media-test-local:/tmp/test-support
docker cp supabase/migrations/20261031072616_optimize_listing_completeness_refresh.sql rentlease-media-test-local:/tmp/completeness.sql
docker cp supabase/migrations/20261101180736_property_media_versioned_management.sql rentlease-media-test-local:/tmp/media.sql
docker exec rentlease-media-test-local psql -U postgres -d media_milestone2 -v ON_ERROR_STOP=1 -f /tmp/test-support/property_media_schema.sql
docker exec rentlease-media-test-local psql -U postgres -d media_milestone2 -v ON_ERROR_STOP=1 -f /tmp/completeness.sql
docker exec rentlease-media-test-local psql -U postgres -d media_milestone2 -v ON_ERROR_STOP=1 -f /tmp/media.sql
docker cp supabase/migrations/20261102021812_property_photo_order_cover_atomic.sql rentlease-media-test-local:/tmp/grid.sql
docker exec rentlease-media-test-local psql -U postgres -d media_milestone2 -v ON_ERROR_STOP=1 -f /tmp/grid.sql
python supabase/tests/run_property_media.py --container rentlease-media-test-local
docker stop rentlease-media-test-local
```

Current runner: 45 assertions, including a real two-connection conflict and the locally prepared atomic-cover follow-up. The fixture models Storage rows/policies, not HTTP uploads. Never run it against production. This adds no automatic deployment workflow.

## Milestone 3 routine-property tests (local only)

Reuse the media fixture and deployed migrations, then add the routine schema and new migration in a fresh disposable database. No live URLs or test-data writes are accepted by the runner.

```powershell
docker run --rm -d --name rentlease-routine-test-local -e POSTGRES_PASSWORD=rentlease-local-test-only public.ecr.aws/supabase/postgres:17.6.1.141
docker exec rentlease-routine-test-local pg_isready -U postgres
docker exec rentlease-routine-test-local createdb -U postgres routine_milestone3
docker cp supabase/test-support/. rentlease-routine-test-local:/tmp/support
docker cp supabase/migrations/20261031072616_optimize_listing_completeness_refresh.sql rentlease-routine-test-local:/tmp/completeness.sql
docker cp supabase/migrations/20261101180736_property_media_versioned_management.sql rentlease-routine-test-local:/tmp/media.sql
docker cp supabase/migrations/20261102021812_property_photo_order_cover_atomic.sql rentlease-routine-test-local:/tmp/grid.sql
docker cp supabase/migrations/20261102044416_property_routine_details_update_and_tenancy_guard.sql rentlease-routine-test-local:/tmp/routine.sql
docker exec rentlease-routine-test-local psql -U postgres -d routine_milestone3 -v ON_ERROR_STOP=1 -f /tmp/support/property_media_schema.sql
docker exec rentlease-routine-test-local psql -U postgres -d routine_milestone3 -v ON_ERROR_STOP=1 -f /tmp/completeness.sql
docker exec rentlease-routine-test-local psql -U postgres -d routine_milestone3 -v ON_ERROR_STOP=1 -f /tmp/media.sql
docker exec rentlease-routine-test-local psql -U postgres -d routine_milestone3 -v ON_ERROR_STOP=1 -f /tmp/grid.sql
docker exec rentlease-routine-test-local psql -U postgres -d routine_milestone3 -v ON_ERROR_STOP=1 -f /tmp/support/property_routine_schema.sql
docker exec rentlease-routine-test-local psql -U postgres -d routine_milestone3 -v ON_ERROR_STOP=1 -f /tmp/routine.sql
python supabase/tests/run_property_routine.py --container rentlease-routine-test-local
docker stop rentlease-routine-test-local
```

Check every exit code before continuing. Reinitialize the disposable database before repeating the runner. The fixture models routine/tenancy columns and authorization boundaries, not the complete production tenancy or Storage HTTP workflows. The routine migration is deployed as 20261102044416. The commands above are disposable local tests only; do not replay the migration against live. Separate [read-only post-deployment checks](../tests/verify_property_routine_deployment.sql) are supplied for the later approved deployment.

Milestone 3 runner: 57 local PostgreSQL checks, including two-session races and verification/identity/tenancy preservation. The existing media runner also passed its 45 checks with the routine migration installed. Neither suite establishes live deployment or Android acceptance.


## Milestone 4 identity correction tests (local only)

The self-initializing runner uses synthetic fixture identities and private proof metadata. It does not accept a connection URL or read production data. Create an unused, disposable, no-port, no-volume container; the runner checks those properties before initializing its dedicated database. Use a fresh container/database for each run.

```powershell
docker run --rm -d --name rentlease-identity-test-local -e POSTGRES_PASSWORD=local-fixture-only public.ecr.aws/supabase/postgres:17.6.1.141
docker exec rentlease-identity-test-local pg_isready -U postgres
python supabase/tests/run_property_identity.py --container rentlease-identity-test-local
# Only stop the disposable container created for this test.
docker stop rentlease-identity-test-local
```

The runner installs the existing media/completeness/routine fixture chain, PostGIS and the prepared identity migration, then exercises bootstrap exclusion, private revisions, controlled proof finalization, owner/Admin authorization, CAS/recovery, cancellation/rejection/resubmission, open-tenancy denial, actual two-connection races and property/listing/photo preservation. It includes the actual existing versioned routine/media contracts with identity triggers installed. Storage rows represent file metadata/RLS, not live Storage HTTP uploads or private-file contents. Existing Tier 2 behavior retains its original review implementation.

Migration [20261102081459_property_identity_revision_verification.sql](../migrations/20261102081459_property_identity_revision_verification.sql) is deployed as 20261102081459; the test commands remain disposable/local only. Its queue/publication definition checks deliberately abort on unexpected source drift. The separately authorized deployment passed fresh backup, live compatibility and coordinated Tier 3 client-cutover checks. Any future migration requires new review/authorization. Do not use `db push` or replay earlier migrations. [Read-only deployment verification](../tests/verify_property_identity_deployment.sql) was executed read-only after the authorized deployment; no live mutation test was performed.
