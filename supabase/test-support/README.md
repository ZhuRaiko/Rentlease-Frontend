# Isolated listing-completeness database tests

## Unified account authorization (disposable local tests)

Use a fresh disposable no-port/no-volume container named
`rentlease-identity-test-role-revamp` with the same PostgreSQL 17 image and throwaway
password shown below. Run `python supabase/tests/run_property_identity.py --container
rentlease-identity-test-role-revamp` first. Then run `python
supabase/tests/run_unified_account.py --container rentlease-identity-test-role-revamp
--baseline` to install the inspected contract fixture and confirm the original GPS
membership denial, followed by the same command without `--baseline` to apply and
test the prepared migration locally. Stop only the container you created afterward.

The suite tests profile/membership lookup, owner/participant RLS, private document
metadata, publication, existing safeguards, rollback and reapplication. The JSON
baseline contains contract definitions only. Storage HTTP and Android are untested.
`prepare_unified_account.py` deterministically renders the forward and inverse SQL;
it does not connect to any database. The inverse is a separately coordinated
rollback, **not** a migration to apply after the forward migration. It restores old
membership gates and retains preference data. Never execute these fixture commands
against live, or use `db push` to deploy the prepared change.

Migration deployed separately as `20261102102331_unified_account_authorization.sql`;
these commands remain local-only and must never replay it against production.
Final Task 1 result: 50 existing identity checks before cutover and 82 focused
authorization checks after cutover passed, including coordinated inverse/reapplication
and transactional abort on source drift. No live deployment or Android acceptance.

## Listing completeness

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

## UC-09A viewing scheduling (local only)

Use the existing UC-08 fixture runner with `--viewings`. Create a disposable `rentlease-messaging-test-*` PostgreSQL 17 container with no mounts or published ports; prefer `--network none`. Then run:

```powershell
python supabase/tests/run_messaging_contract.py --container rentlease-messaging-test-viewings --viewings
```

The runner verifies container isolation, initializes a synthetic messaging database, loads the inspected viewing trigger and prepared scheduling migration, then exercises persistence, relationship/state authorization, idempotency, CAS, real concurrent requests/approvals, history and feature-disable rollback. It never reads .env or connects to production. Stop only that disposable container after completion. The last run passed 104 checks. A minimal fixture is not equivalent to a full production restoration or Android acceptance.

`property_viewing_scheduling_rollback.sql` disables the three new scheduling RPCs and removes only their two restrictive policies. It deliberately keeps appointment records, revision/request notes, indexes and private event history for recovery. Existing grants/policies, messages and Realtime configuration remain unchanged. Do not replay the original migration to reenable it after rollback; use a separately reviewed recovery migration. Deployment requires separate authorization.

## UC-09B rental reservations (local only)

The reservation migration is independent of UC-09A. The same guarded disposable fixture runner supports `--reservations`; the combined regression command is:

```powershell
python supabase/tests/run_messaging_contract.py --container rentlease-messaging-test-reservations --viewings --reservations
```

Use a fresh no-volume/no-published-port Supabase PostgreSQL17 container; prefer `--network none`. The final run passed171 checks (67 reservation,55 viewing,49 messaging). It reuses the actual inspected tenancy property/identity guard sources with synthetic current-identity/property data and verifies concurrent approval/tenancy races. Stop only that disposable container afterward. This is not live RLS, a production restore, or Android acceptance evidence.

`property_rental_reservations_rollback.sql` is feature-disable recovery: remove only the three public reservation RPCs; retain private data/event history, indexes/helpers and the additive tenancy conflict guard so approved commitments remain honored. A separately authorized recovery migration is needed to reenable entry points or retire commitments. Never replay the creation file, drop protected reservation records, or remove the guard while approved commitments remain active. No deployment authorization is implied by these tests.

## Public identity local validation

Prepared only: `20261106133521_public_identity_nicknames_avatars.sql`; disable source: `public_identity_rollback.sql`. Run the existing disposable messaging runner with `--public-identity` (optionally `--viewings --reservations`). Fixtures simulate Storage metadata, bucket limits and RLS; they do not exercise the Storage HTTP server or native picker. Never run these synthetic fixture scripts against the hosted database. Rollback revokes consumer entry points and retains consent data and privacy protections.

The Display Name revision adds synthetic Auth/profile signup initialization tests. Revised SQL passed local PostgreSQL validation on November 7: 101 focused checks / 0 failures; 223 coordinated Public Identity/viewing/reservation checks / 0 failures. Both runs used a network-isolated disposable PostgreSQL 17.6 container, which was removed afterward. The migration remains undeployed and requires separate deployment authorization.
