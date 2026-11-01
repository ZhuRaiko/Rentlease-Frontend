# Local exact-target draft editing tests

DISPOSABLE LOCAL DATABASE ONLY. No remote URL is accepted by the Python runner. This fixture is not a production schema dump, migration or live RLS/security test. Existing tests use synthetic Auth eligibility helpers; the recorded create/publication RPCs and actual completeness/new draft-edit migrations run against real PostgreSQL locks/triggers.

Use an unused container/database/loopback port. The password below is a public throwaway fixture value, not a project secret. Run from the repository root in PowerShell:

```powershell
docker run --rm -d --name rentlease-draft-edit-test-local -e POSTGRES_PASSWORD=rentlease-local-test-only -p 127.0.0.1:55439:5432 public.ecr.aws/supabase/postgres:17.6.1.141
docker exec rentlease-draft-edit-test-local pg_isready -U postgres
# Use a NEW empty database: the image's default postgres database already has Auth objects.
docker exec rentlease-draft-edit-test-local createdb -U postgres draft_edit_tests
docker cp supabase/test-support/listing_completeness_schema.sql rentlease-draft-edit-test-local:/tmp/listing_completeness_schema.sql
docker cp supabase/test-support/draft_edit_schema.sql rentlease-draft-edit-test-local:/tmp/draft_edit_schema.sql
docker cp supabase/migrations/20261031072616_optimize_listing_completeness_refresh.sql rentlease-draft-edit-test-local:/tmp/completeness.sql
docker cp supabase/migrations/20261101130456_update_listing_draft_exact_version.sql rentlease-draft-edit-test-local:/tmp/draft_edit.sql
docker exec rentlease-draft-edit-test-local psql -U postgres -d draft_edit_tests -v ON_ERROR_STOP=1 -f /tmp/draft_edit_schema.sql -f /tmp/completeness.sql -f /tmp/draft_edit.sql
python supabase/tests/run_draft_edit_concurrency.py --container rentlease-draft-edit-test-local --database draft_edit_tests
# The runner creates committed fixture data in this disposable DB. Use a fresh DB on rerun.
# Stop ONLY the container you created; --rm discards its ephemeral databases.
docker stop rentlease-draft-edit-test-local
```

Expected runner result: 27 passed / 0 failed. It includes real parallel psql sessions synchronized by observing a server sleep while locks are held. No live save or publish is performed. A failed setup/test command is not a pass; inspect its exit status before the next step.

The existing [completeness pgTAP suite](../tests/listing_completeness_refresh.sql) can also run in a separate fresh fixture database with both migrations. Run via the established Supabase CLI test command or psql; if using psql, validate the TAP plan and every assertion (psql exit 0 alone does not detect `not ok`). Final Stage 1 run validated 74 assertions/zero failures. PostgreSQL plpgsql_check_function_tb additionally checked the exact update RPC with zero error rows.

Type provenance: Supabase CLI `gen types typescript --db-url` against this migrated local database. Merge only the proposed update RPC and version-column entries into the existing full canonical contract; do not replace it with the partial fixture schema. No project dependency changes. Docker's postgres-meta generator image is tooling, not an application/native dependency.

This guide executes disposable local tests only. [Stage 1](../migrations/20261101130456_update_listing_draft_exact_version.sql) and [Stage 2](../migrations/20261101145623_update_published_listing_content.sql) are already deployed under these matching history versions. Local fixture setup is not permission to reapply them remotely. Never run these fixtures against a live project, replay old migrations, or use unrestricted migration-up/db-push commands as a shortcut.


## Stage 2 published content (local only)

Use the same PostgreSQL17 image and task-scoped container prefix. The published fixture is published_edit_schema.sql, which includes draft_edit_schema.sql and aligns listing return columns/nullability to the inspected live contract. Copy both fixtures and listing_completeness_schema.sql to the same local container directory. In a NEW empty DB apply that fixture, completeness.sql (20261031072616), draft_edit.sql (local test use of 20261101130456 only), and published_edit.sql (20261101145623_update_published_listing_content.sql), with psql ON_ERROR_STOP=1. Do not use any remote/project URL.

Run: python supabase/tests/run_published_edit_concurrency.py --container rentlease-draft-edit-test-published --database published_edit_v3

Expected: 27 original draft checks plus 30 published checks. The wrapper runs the existing draft runner first, preserving its assertions and real two-session races, then adds active/paused/content/status/80%-rollback cases. It commits synthetic fixture rows; use a new DB on every rerun. Existing completeness pgTAP can run in its own fresh DB with all migrations; validate 74 ok, zero not ok and plan 1..74, not merely psql exit0. Static check: extensions.plpgsql_check_function_tb with the exact new signature and level=error.

Successful Stage 2 container used loopback 15439 because Windows rejected 55439. Local type generation used --db-url on that loopback port, published_edit_tests DB, schema public. Merge only the new function entry. Stop only your verified own --rm test container to discard synthetic data; never clean unrelated Docker resources. Both stages are already deployed: Stage 1 20261101130456 and Stage 2 20261101145623. Current local filenames match those versions. Never replay either migration against live Supabase; the commands above target fresh disposable databases only.


Documentation reconciliation (2026-11-02): SQL file contents and existing staged renames are unchanged. Historical preparation timestamps 20261101060000 (Stage 1) and 20261101141819 (Stage 2) are provenance only, not current migration versions.
