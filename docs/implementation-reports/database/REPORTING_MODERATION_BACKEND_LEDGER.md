# Reporting and moderation backend ledger

## November 11, 2026 - read-only compatibility inspection and local preparation

Project: cxfsbwbwmwmgtqfonqth. Authorized task: inspect reporting contracts and prepare local implementation; deployment not authorized.

Metadata-only SQL inspected public.reports columns/defaults/types, constraints/FKs, table grants, RLS policies, triggers/set_updated_at definition, existing report RPC inventory and is_admin signature/delegation; also listing/conversation column metadata and report reason/status enums. Aggregate report count was zero. No report contents, profile rows, message bodies, private coordinates or secrets were retrieved. Exact tool SQL transcript is not retained in this ledger; this entry records the inspected scope and results rather than inventing a replay transcript.

Observed: reports source targets profiles/listings/messages with at-least-one-target CHECK, existing reporter/Admin policies and only updated_at trigger. Table grants were postgres-only; no executable client report RPC was found. is_admin delegates to actual app-role membership. Prepared migration preserves source schema, adds private context/events/receipts and authenticated-only guarded RPCs, plus restrictive raw-table policy and immutable evidence guards. Generated types describe the prepared contract, not deployed availability.

Local network-isolated synthetic PostgreSQL checks previously passed 29 cases. Final updated runner includes a 30th check for retry after a later decision, but final execution is blocked because Docker Desktop Linux engine is stopped. No final container was created. Rollback guidance is data-retaining entry-point withdrawal only; no hosted rollback was executed.

No permanent live backend mutation was performed in this phase. No hosted report RPC or write-based smoke test was executed. No outstanding production cleanup. Fresh metadata/zero-legacy/grant checks and restricted recovery backup plus separate migration authorization are required before deployment. Actual end-user/Admin caller-JWT and Android acceptance remain unverified.

[Living feature](../../features/REPORTING_MODERATION.md) ? [Implementation](../phases/REPORTING_MODERATION_IMPLEMENTATION.md)


## November 11, 2026 - final validation and source checkpoint

Docker Desktop was running when checked with local engine access. Executed python supabase/tests/run_reporting_moderation.py in a disposable network-disabled PostgreSQL container with synthetic fixtures, no mounted production data or published ports. All 32 checks passed, including two independent Admins racing the same revision (exactly one succeeds, loser writes no receipt/event), exact retry after later resolution, confidentiality, privilege denial, source/history immutability and data-retaining RPC withdrawal. Container removal confirmed. This supersedes the earlier Docker availability blocker. No application or migration corrections were necessary in this pass; only concurrency coverage and evidence documentation were added. Reused prior 65 focused frontend and TypeScript results; no repeated frontend run. Hosted and native acceptance remain unverified. No permanent live backend mutation was performed in this phase.

## November 12, 2026 - Admin access to reports RPCs: live read-only inspection, prepared migration, predeploy backups

| Field | Entry |
| --- | --- |
| Date | Executed 2026-11-12 (UTC 15:49-16:02); recorded 2026-11-12 |
| Feature/phase | Reporting & Moderation, Admin Phase 0 item B; entry ADMIN-ACCESS-2026-11-12 |
| Actor/tool | Claude Code with the Supabase CLI 2.122.0 (`db query --linked`, `db dump --linked`, `migration list --linked`) |
| Environment/project | Live project `cxfsbwbwmwmgtqfonqth`, linked CLI session, no secrets recorded |
| Classification | READ_ONLY_INSPECTION (live); local disposable-container tests; backups are reads |
| Target | public.get_rental_report/get_rental_reports/moderate_rental_report, is_admin, has_app_role, is_tier1_verified, rentlease_reporting.conflicted, profiles.account_status, user_roles, counts of reports and Admin accounts, migration history; for the second backup also manage_property_identity, begin_property_identity_verification, get_admin_property_identity_review, establish_tenancy, rentlease_property_identity.promote and schemas rentlease_property_identity, rentlease_tenancy_setup |
| Action | SELECT-only catalog and count queries; schema-only and roles-only dumps; no data dump. Live bodies of the three RPCs were byte-identical to `20261110171913_reporting_moderation.sql` (md5(prosrc) 76e7d8f0..., f79706e0..., a23ae4fd...). Observed: exactly one Admin account and it is not Tier 1 verified; `is_active_admin` did not exist; 2 reports; 39 history rows, latest 20261111133612 |
| Purpose | User-authorized preparation of one migration (not applied) and the two predeployment backups |
| Result | Migration `20261112155016_admin_reports_access.sql` and rollback prepared; 41 SQL checks passed in a disposable container. Backups: `C:\RentLease-Backupsdmin-access-predeploy-20261112-155907` (catalog and records unchanged during capture) and `C:\RentLease-Backups\identity-gating-predeploy-20261112-160030` (catalog unchanged; rows in listings, tenancies and rentlease_tenancy_setup bindings/receipts changed during capture from live app activity, not from the backup). Both: 30 manifest entries re-hashed with no mismatch, ACLs limited to the current user, SYSTEM and Administrators |
| Durable effect | None on the hosted project |
| Rollback/cleanup | Not applicable to the hosted project. Disposable containers removed. A hosted restore was not tested |
| Security/RLS | Prepared change touches only the Admin-branch caller check; non-admin Tier 1 requirement, conflict guard, versioning and receipts retained; `is_active_admin` not client-executable. Hosted behavior unverified |
| Source-controlled backend file | `supabase/migrations/20261112155016_admin_reports_access.sql`, `supabase/test-support/admin_reports_access_rollback.sql`, `supabase/tests/run_admin_reports_access.py`, `supabase/test-support/ADMIN_REPORTS_ACCESS.md`; reusable `scripts/predeploy-backup/` |
| Android/client runtime | RUNTIME-UNVERIFIED |

No identity-gating migration exists in the repository (the functions in that backup scope are defined by already-applied migrations), so no forward or rollback SQL was recorded for it. No permanent live backend mutation was performed in this phase.


## November 13, 2026 - HOSTED_MIGRATION 20261112155016_admin_reports_access applied

Supersedes the "prepared, not applied" state in the November 12 entry above. Authorized by the user ("go with option 1"): apply ONLY this file, directly, then repair ONLY this version.

| Field | Entry |
| --- | --- |
| Date | Executed 2026-11-12 between about 16:02 UTC (after the predeploy backups) and 16:30 UTC (exact second not recorded); recorded 2026-11-12 UTC / 2026-11-13 local (UTC+8) |
| Feature/phase | Reporting & Moderation, Admin Phase 0 item B; entry HOSTED-ADMIN-ACCESS-2026-11-12 |
| Actor/tool | Claude Code, Supabase CLI 2.122.0, on explicit user authorization |
| Environment/project | Live project `cxfsbwbwmwmgtqfonqth`, linked CLI session, no secrets recorded |
| Classification | HOSTED_MIGRATION, FUNCTION_CHANGE, PRIVILEGE_CHANGE (new helper, client execute revoked) |
| Target | New `public.is_active_admin(uuid)`; Admin-branch caller checks in `public.get_rental_report`, `public.get_rental_reports`, `public.moderate_rental_report`; one history row |
| Action | `supabase.cmd db query --linked -f supabase/migrations/20261112155016_admin_reports_access.sql` (one `begin`/`commit` transaction with drift guards: pinned md5(prosrc), expected text exactly once, reversible edit, owner/ACL/security/config unchanged; exit 0, no error). Then `supabase.cmd migration repair --status applied 20261112155016 --linked` (`repairAll: false`, only that version). `db push` was NOT run. No `--status reverted` anywhere. |
| Purpose | Let the Admin account, which is not Tier 1 verified, list, read and moderate reports. The non-admin branch still requires Tier 1 |
| File identity | LF-normalized SHA-256 `1954c4729512e5da8648048f60baf8c77a107eaec44ef07d658027bb3e621d1b`, identical to the reviewed copy in backup `admin-access-predeploy-20261112-155907`. The header comment "LOCAL ONLY. NOT APPLIED." in the file is now historical; the applied file is not edited |
| Versions | Before: 39 history rows, latest `20261111133612`. After: 40 rows, latest `20261112155016` named `admin_reports_access`; the local filename and hosted version match |
| md5(prosrc) before to after | get_rental_report `76e7d8f0bbb47ab3684a478fa25b42db` to `eb2918ef71f1eff1387e9fba0449961d`; get_rental_reports `f79706e08df8c04ba17e0f78a35ce783` to `ea9d1f9011723db929bb159bbfd0feca`; moderate_rental_report `a23ae4fdb5b4b4b3fe9522864ff26bcd` to `8b2c978bdbe108082151d7aab0941880` |
| Posture | Owner, ACL (`postgres`, `authenticated`), security definer, `search_path=pg_catalog` and volatility of the three functions identical to both a fresh pre-apply snapshot and the backup catalog; only md5(prosrc) changed. `is_active_admin`: owner postgres, security definer, `search_path=pg_catalog`, ACL `postgres` only; anon, authenticated and service_role cannot execute |
| Row counts | reports 2, cases 2, events 2, receipts 2, verification_submissions 13, tenancies 2, listings 10: counts and md5 fingerprints identical before and after apply and after the smoke test |
| Smoke test (read-only, one block that always raised to roll back; counts and verdicts only, no report contents or user IDs) | Real Admin, Tier 1 unset, `is_active_admin` true: `get_rental_reports(true,'all','all',0)` returned count 2, openCount 2, 2 rows, no error. Same Admin calling the reporter branch (`p_admin=false`) without Tier 1: denied. Tier 1 non-admin calling the admin branch: denied (`Access unavailable`, SQLSTATE 42501); that user's own reporter call still worked (own count 0). Nothing persisted |
| Durable effect | New function, three replaced function bodies, one history row. No data change |
| Rollback/cleanup | Not executed. Rollback script `supabase/test-support/admin_reports_access_rollback.sql` is available and tested in a disposable container; the pre-migration bodies are in the backup catalog |
| Security/RLS | Admin access no longer depends on Tier 1; active account status is required; conflict guard, versioning, receipts and non-admin Tier 1 requirement retained. Verified by the smoke test above and 41 synthetic SQL checks; a real moderation decision was not exercised on the hosted project |
| Source-controlled backend file | `supabase/migrations/20261112155016_admin_reports_access.sql`; rollback and tests under `supabase/test-support/` and `supabase/tests/run_admin_reports_access.py` |
| Android/client runtime | RUNTIME-UNVERIFIED (Reports and Review moderation screens, and the new plain-language errors, not yet opened against the hosted change) |

### Known migration-history drift (not fixed)

Eleven migrations were applied earlier and their hosted versions carry the deploy timestamp, while the local files keep their authored timestamp. They are the same migrations (names match). `supabase migration list --linked` therefore shows 11 local-only plus 11 remote-only rows, and `supabase db push --dry-run` fails with `DbPushMissingLocalError`. The CLI's suggested `migration repair --status reverted` would mark applied migrations as reverted and must NOT be run.

| Local file version | Hosted version | Name |
| --- | --- | --- |
| 20261109171826 | 20261109181552 | unfinished_property_deletion |
| 20261110100000 | 20261110053904 | rental_location_approval |
| 20261108041628 | 20261110053950 | recommendation_owner_tier2_status |
| 20261110055859 | 20261110062844 | tenancy_establishment |
| 20261110072014 | 20261110090536 | tenancy_rent_maintenance |
| 20261110091413 | 20261110093114 | tenancy_completion_termination |
| 20261110125450 | 20261110140910 | tenancy_ratings_reviews |
| 20261110154025 | 20261110171001 | saved_listings_contract |
| 20261110171913 | 20261111031731 | reporting_moderation |
| 20261111035305 | 20261111043505 | in_app_notifications |
| 20261111100000 | 20261111133612 | nearby_places_cache |

Procedure for the next migration (the same direct way): predeploy backup with `scripts/predeploy-backup/New-PredeployBackup.ps1`; confirm the live md5(prosrc) of the objects it patches; run only that file with `supabase.cmd db query --linked -f <file>`; then `supabase.cmd migration repair --status applied <that single version>`; verify read-only. Never `db push`.

No other hosted action was taken. This entry records one permanent live backend mutation: the migration and the single history row above.
