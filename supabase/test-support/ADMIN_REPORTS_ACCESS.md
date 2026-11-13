# Admin access to the reports RPCs: test plan and apply checklist

Prepared 2026-11-12; **applied to the hosted project 2026-11-12/13** (see the HOSTED_MIGRATION entry in `docs/implementation-reports/database/REPORTING_MODERATION_BACKEND_LEDGER.md`). Files: `supabase/migrations/20261112155016_admin_reports_access.sql`, `supabase/test-support/admin_reports_access_rollback.sql`, `supabase/tests/run_admin_reports_access.py`.

## Why
`get_rental_report`, `get_rental_reports` and `moderate_rental_report` require `is_tier1_verified(caller)` for every caller. The only Admin account on the hosted project is not Tier 1 verified (read-only count on 2026-11-12), so Reports moderation answers `Access unavailable`. The migration adds `public.is_active_admin(uuid)` (admin role AND `profiles.account_status = 'active'`) and uses it only in the Admin branch of the three functions.

## Executable test plan (disposable, network-isolated container; synthetic fixtures)
Run: `python supabase/tests/run_admin_reports_access.py` (needs Docker). 41 checks pass as of 2026-11-12.

| Case | Expected |
| --- | --- |
| Before the migration, Admin without Tier 1 lists, reads, moderates | Denied (`Access unavailable`): reproduces the report |
| After, Admin without Tier 1 lists, reads, moderates | Allowed |
| After, non-admin without Tier 1; Admin acting as a reporter without Tier 1 | Still denied (non-admin branch keeps Tier 1) |
| After, reporter with Tier 1 lists and reads own report; loses access when Tier 1 is removed | Unchanged |
| Non-admin uses Admin mode or moderates | Denied |
| Suspended, restricted or deleted Admin | Denied for list, read and moderate; allowed again when reactivated |
| Conflicted Admin (listing owner, or tenancy participant) with or without Tier 1 | Denied; conflicted reports are excluded from the queue |
| Revision versioning, transition rules, exact-retry receipts, one event and receipt per operation | Unchanged |
| Reporter projection | Still excludes history, context and admin notes |
| `is_active_admin` called by authenticated or anon | Permission denied (no probing); true only for active Admins |
| Owner, ACL, security definer, `search_path`, volatility of the three RPCs | Identical before and after |
| Source drift (a function body differs from the reviewed one) | Migration aborts atomically; nothing left behind |
| Rollback | Exact pre-migration bodies (`md5(prosrc)` identical), helper dropped, data retained; a second rollback fails loudly; migration re-applies |

## Before applying to the hosted project (needs explicit authorization)
1. Take a fresh backup with `scripts/predeploy-backup/New-PredeployBackup.ps1` (see its README). Confirm the in-scope `md5(prosrc)` still match the migration pins: `get_rental_report` 76e7d8f0bbb47ab3684a478fa25b42db, `get_rental_reports` f79706e08df8c04ba17e0f78a35ce783, `moderate_rental_report` a23ae4fdb5b4b4b3fe9522864ff26bcd.
2. Apply only this file, one migration, no blanket `db push`. The migration is one transaction and aborts on drift.

## Read-only checks after applying
```sql
select p.oid::regprocedure::text, md5(p.prosrc), p.prosecdef, pg_get_userbyid(p.proowner), p.proacl::text[], p.proconfig
from pg_proc p where p.proname in ('get_rental_report','get_rental_reports','moderate_rental_report','is_active_admin') and p.pronamespace='public'::regnamespace;
```
Expect the three RPCs unchanged except body md5, ACL `postgres` + `authenticated` only; `is_active_admin` ACL `postgres` only. Then sign in as the Admin and open Reports; confirm a moderation decision saves once and the reporter view stays non-revealing.

## Rollback
`supabase/test-support/admin_reports_access_rollback.sql` (separately authorized). It restores the three bodies exactly and drops `is_active_admin` only if nothing else references it. The pre-migration `md5(prosrc)` values are in the predeploy backup catalog.
