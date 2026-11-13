# Predeployment backup (scoped, read-only)

`New-PredeployBackup.ps1` takes a protected, verified recovery backup for **one** migration, immediately before it is applied. It never migrates, deploys, restores or writes to the hosted project. Dumps and receipts are written outside the repo (default `C:\RentLease-Backups\<feature>-predeploy-<UTC yyyyMMdd-HHmmss>\`) and must never be committed.

This is a **scoped recovery backup, not full disaster recovery.** A hosted restore has not been tested. Do not replay `roles.sql` wholesale.

## Before you run

- Docker Desktop is running (the Supabase CLI runs `pg_dump` in a container).
- The Supabase CLI is logged in and the repo is linked (`supabase/.temp/project-ref`). The script uses that session. It accepts and stores **no** passwords, tokens or keys.
- You know the exact scope and have the reviewed forward and rollback SQL files.
- Take the backup right before applying, so the catalog matches what you are about to change. Re-run it if time passes or anything else is deployed.

## Run

```powershell
.\scripts\predeploy-backup\New-PredeployBackup.ps1 `
  -Feature admin-access `
  -ExpectedProjectRef cxfsbwbwmwmgtqfonqth `
  -Schemas public,rentlease_reporting `
  -Functions public.get_rental_report,public.get_rental_reports,public.moderate_rental_report,public.is_admin,public.has_app_role,public.is_tier1_verified `
  -Tables public.reports,rentlease_reporting.cases,rentlease_reporting.events,rentlease_reporting.receipts `
  -ForwardSql supabase\migrations\20261112155016_admin_reports_access.sql `
  -RollbackSql supabase\test-support\admin_reports_access_rollback.sql
```

| Parameter | Meaning |
| --- | --- |
| `-Feature` | Lowercase name used in the folder name |
| `-ExpectedProjectRef` | Must equal the linked project or the script refuses to run |
| `-Schemas` | Schemas dumped and cataloged (include `public` when public functions are in scope) |
| `-Functions` | `schema.name`; every overload is captured with `md5(prosrc)`, owner, ACL, security-definer flag and config. All must exist |
| `-Tables` | `schema.table`; only a row count and an md5 fingerprint are stored, never row data |
| `-ForwardSql`, `-RollbackSql` | Reviewed files copied to `reviewed-source/` with SHA-256. Optional: if omitted the receipt says `NOT SUPPLIED`, nothing is invented |
| `-OutputRoot` | Default `C:\RentLease-Backups` |

All identifiers are validated against a strict pattern before they enter any SQL.

## What it does, in order

1. Preflight: linked project equals expected, CLI and Docker versions, `db dump --help` checked.
2. Creates the folder and restricts it with `icacls` (inheritance disabled; current user, SYSTEM, Administrators only) before any file is written.
3. Catalog before, then row-count fingerprints before, function inventory, migration history, `migration list`.
4. `db dump --linked` schema-only for the scope, and `--role-only`. Every exit code and non-empty output is checked.
5. Catalog and fingerprints after; compares per-section `md5` and row counts to prove the live database did not change.
6. Scope file, secret-pattern scan (fails on JWTs, secret keys, connection-string passwords, role passwords), receipt.
7. SHA-256 manifest (excluding itself), then re-reads every file and recomputes hashes; re-checks ACL principals by SID.

## Output files

`RECEIPT.md`, `backup-scope.json`, `schema.sql`, `roles.sql`, `catalog-before.json` / `catalog-after.json` (history, tables, RLS flags, functions with definitions, owners, ACLs, `md5_prosrc`, triggers, policies, columns, constraints, indexes, grants, roles), `data-fingerprints-*.json`, `scope-functions.json`, `migration-history.json`, `migration-list-local-vs-remote.json`, `before-after-comparison.json`, `reviewed-source/`, `reviewed-source-hashes.json`, `sha256-manifest.json`, `final-verification.json` (written after the manifest, so not listed in it), plus `*.sql` query texts and `*.log` CLI logs.

## Deliberately omitted

Auth users, passwords and sessions; Storage object bytes; row data of any table; unrelated schemas; Edge Function source and secrets; point-in-time recovery.

## Restore

Recovery is selective and manual, using `schema.sql` and the catalog definitions for the scoped objects against the same project. It preserves existing Auth and Storage dependencies. Prefer the migration's own rollback script (kept in `reviewed-source/`) for undoing a migration; use the backup when the rollback itself cannot run.
