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


## November 13, 2026 - Admin actions and audit log: live read-only inspection and prepared migration (NOT APPLIED)

| Field | Entry |
| --- | --- |
| Date | Executed 2026-11-13 (about 11:00-13:10 local); recorded 2026-11-13 |
| Feature/phase | Reporting & Moderation, Admin Actions and Audit tabs; entry ADMIN-ACTIONS-AUDIT-2026-11-13 |
| Actor/tool | Claude Code with the Supabase CLI 2.122.0 (`db query --linked`, SELECT only); local disposable Docker containers for tests |
| Environment/project | Live project `cxfsbwbwmwmgtqfonqth`, linked CLI session, no secrets recorded |
| Classification | READ_ONLY_INSPECTION (live); local disposable-container tests only |
| Target | Definitions, columns, constraints, indexes, enums, RLS, ACLs and triggers of `moderation_actions`, `admin_audit_logs`, `apply_moderation_action` (+ `trg_apply_moderation_action`), `profiles`, `listings`, `tenancies`, `reports`, `verification_submissions`, `rentlease_reporting.events/cases`, `rentlease_reviews.entries/events`; sources and md5(prosrc) of `is_admin`, `is_active_admin`, `rentlease_reporting.conflicted`, `moderate_rental_report`, `moderate_rental_review`, `validate_listing_owner`, `remember_publication`, `rotate_listing_edit_version`, `sync_listing_from_tenancy`; the `public_profiles` view definition; installed extensions; `rentlease_*` schema names |
| Action | SELECT-only catalog queries (`pg_get_functiondef`/`prosrc`, `pg_attribute`, `pg_constraint`, `pg_indexes`, `pg_policies`, `pg_trigger`, `pg_proc` ACL/owner/config, `has_table_privilege`) and aggregate counts. No row data of any table was read except counts |
| Purpose | Re-read the live definitions before preparing the migration, as required. Authorized by the task ("re-read the live definitions before patching") |
| Result | Facts confirmed: `authenticated`/`anon` hold no privileges on `moderation_actions` or `admin_audit_logs` (RLS on, admin-only policies exist but no grants); `apply_moderation_action` is security definer, owner postgres, `search_path=public`, md5(prosrc) `311afeb3c10eef8dd2b1b5a965377f21`, and writes the audit row in the same transaction (its source has CRLF line endings); `moderation_action_type` has 7 values; `admin_audit_logs` has 0 rows and `moderation_actions` has 0 rows; 8 profiles, 0 restricted or suspended; no `pg_cron`/`pg_net`; `is_active_admin` md5 `dde28ade2563cad5338b21555141a73b` (no client EXECUTE); `profiles.display_name` is the private name and the public name is `public_nickname` only when `public_nickname_confirmed_at` is set; listing triggers do not block Admin status changes; `rentlease_reviews.events` records moderation as `action` in (approved, rejected, hidden); reporting events carry `status` and a private `note` |
| Durable effect | None on the hosted project |
| Rollback/cleanup | Not applicable (nothing applied). All Docker containers were removed by the harness |
| Security/RLS | Prepared change adds three security-definer RPCs (EXECUTE for `authenticated` only, each requires `is_active_admin(auth.uid())`), a private receipts schema with no client access, three additive audit triggers, and one index. Client table privileges stay none; the migration asserts that before and after. Hosted behavior untested |
| Source-controlled backend file | `supabase/migrations/20261113180000_admin_actions_audit.sql`; rollback `supabase/test-support/admin_actions_audit_rollback.sql`; fixture `supabase/test-support/admin_actions_audit_baseline.sql`; harness `supabase/tests/run_admin_actions_audit.py`; notes `supabase/test-support/ADMIN_ACTIONS_AUDIT.md` |
| Android/client runtime | RUNTIME-UNVERIFIED against the hosted backend: the RPCs do not exist there yet, so the app shows "Backend update needed" on the new tabs. Agent-observed emulator screenshots of the populated screens used an in-memory sample service that was removed afterwards; see `docs/implementation-reports/ui/admin-actions-audit-skill-passes.md` |

Local evidence (not hosted): the harness applies the real reporting and admin-access migrations plus a byte-faithful `apply_moderation_action` (md5 pin asserted) in a no-network container and passed 117 checks, covering every validation, self and Admin targeting, idempotent retries (including concurrent and after-change retries), restore, open-tenancy removal, non-Admin and suspended-Admin denial, audit rows for each decision type, the strict-audit rollback behavior, grants, the rollback script (both the retained-receipts and empty-receipts paths) and re-application. Eight deliberate breakages of the migration were each caught by the harness. The migration's own drift guards were exercised (changed function source, missing helper, client privilege, pre-existing schema, disabled trigger).

Audit failure policy: audit writes are strict and share the decision's transaction, so an audit failure rolls the decision back (no effect, no action row, no receipt) and the same operation id can be retried. Chosen because an Admin decision that cannot be accounted for is worse than one that visibly fails and can be retried; the existing trigger already behaved this way. Cost: while `admin_audit_logs` is unwritable, these decisions fail.

Deployment prerequisites (not done): explicit approval; fresh predeploy backup (`scripts/predeploy-backup/New-PredeployBackup.ps1`); reconfirm `md5(prosrc)` of `apply_moderation_action` equals the pin; run only the migration file with `supabase.cmd db query --linked -f`, then `migration repair --status applied 20261113180000`; never `db push`. Known limits: an end date is informational (no scheduler restores accounts); pause_listing was removed from the RPC and the app because the live reactivate_listing lets the owner undo any paused listing (future work: a moderation-hold flag that reactivate_listing respects); suspend_account and remove_listing now REQUIRE a report (exists, not conflicted for the Admin, upheld, matching the target), restore_account may omit it; a removed listing cannot be undone by its owner through any existing RPC, but the owner can still create and publish a NEW listing for the same property (see the revision note below).

No permanent live backend mutation was performed in this phase.

### ADMIN-ACTIONS-AUDIT-2026-11-13, revision 2 (still NOT APPLIED)

Changes to the prepared migration before review: (1) `pause_listing` removed from `apply_admin_moderation_action`, the app and the tests; the migration header records why and the future work (moderation-hold flag). The audit-log display still labels historical `pause_listing` rows. (2) `p_report_id` is REQUIRED for `suspend_account` and `remove_listing` (message "A report is required for this action", raised with the other static input checks, before the receipt lookup); an existing report must exist, not be conflicted for the Admin, be upheld and match the target; `restore_account` may omit it. Local evidence: the container harness passes 117 checks; twelve deliberate breakages of the migration (the original eight plus: report not required, no conflict check, pause_listing allowed again, report required only for suspend) were each caught; the frontend drift-guard test fails when the SQL text is altered.

Live read-only inspection on 2026-11-13 (SELECT only via `supabase db query --linked`; classification READ_ONLY_INSPECTION; no row data of any table read, no backend change): functions that write `public.listings` and their sources (`archive_listing`, `pause_listing`, `publish_listing`, `reactivate_listing`, `save_listing_draft`, `update_listing_draft`, `update_published_listing_content`, `sync_listing_from_tenancy`, `apply_moderation_action`), `establish_tenancy`, `rentlease_tenancy_setup.context`, the `listings` triggers, policies and grants for `authenticated`. Findings: `authenticated` has only SELECT on `public.listings` (no table or column UPDATE, no INSERT or DELETE privilege), so the owner cannot change a removed row directly; `archive_listing` and `pause_listing` accept only active or paused (pause: active), `publish_listing` only draft, `reactivate_listing` only paused, `update_listing_draft` only draft, `update_published_listing_content` only active or paused, so none can change a removed listing; tenancy setup requires the original listing to be active, so `sync_listing_from_tenancy` cannot turn a removed listing into rented. Gap: `save_listing_draft` inserts a new draft for an owned active property and `publish_listing` blocks only when another listing on the property is active, paused or rented, so the owner can re-list a property whose listing was removed. This is evidence from reading sources, not an executed attempt. No permanent live backend mutation was performed.

## November 13, 2026 - Admin actions and audit log: HOSTED_MIGRATION 20261113180000 (applied)

| Field | Entry |
| --- | --- |
| Date | Executed 2026-11-13 (backup about 14:53 local, 06:54 UTC); recorded 2026-11-13 |
| Feature/phase | Reporting & Moderation, Admin Actions and Audit; entry ADMIN-ACTIONS-AUDIT-2026-11-13, revision 3 |
| Actor/tool | Claude Code with the Supabase CLI 2.122.0 (`db query --linked -f`, `migration repair`), after explicit user approval |
| Environment/project | Live project `cxfsbwbwmwmgtqfonqth`; no secrets recorded |
| Classification | HOSTED_MIGRATION (additive schema/function change) |
| Revision 3 change | `get_admin_audit_log` filters out rows of reports the calling Admin is conflicted on (`entity_type='report'` rows and rows whose `metadata.report_id` is a conflicted report), inside the CTE that feeds both `count` and the page. The removal confirmation text was reworded in the app |
| Pre-checks (all passed) | 41 history rows, latest `20261112164000`, `20261113180000` not recorded; `md5(prosrc)` of `apply_moderation_action` `311afeb3c10eef8dd2b1b5a965377f21`; none of the new RPCs, schema, triggers or index existed; backup folder re-hashed with 0 mismatches; migration file SHA-256 `59269489dd21c8efd5133058aa7cf2572654031b785a960dfec3bb136e916f51` (same as the copy in the backup) |
| Backup | `C:\RentLease-Backupsdmin-actions-audit-predeploy-20261113-065325` (outside the repo, never commit). Scope: schemas public, rentlease_reporting, rentlease_reviews (catalog, policies, triggers, ACLs, grants); functions `apply_moderation_action`, `is_admin`, `is_active_admin`, `moderate_rental_report`, `moderate_rental_review`, `get_rental_report`, `review_verification_submission`, `rentlease_reporting.conflicted`; 12 tables fingerprinted (counts and md5 only); reviewed forward and rollback SQL with SHA-256. Live DB unchanged during capture; 30 manifest entries re-read, 0 mismatches; ACLs verified (current user, SYSTEM, Administrators). Restore not tested |
| Applied | `supabase.cmd db query --linked -f supabase/migrations/20261113180000_admin_actions_audit.sql` (single transaction, exit 0), then `supabase.cmd migration repair --status applied 20261113180000 --linked` for that version only. No `db push` |
| Post-checks (read-only, no production fixtures) | History 42 rows, latest `20261113180000`. The three RPCs exist: security definer, owner postgres, `search_path=pg_catalog`, executable by `authenticated` only (grantees: owner and authenticated; anon and service_role no). `apply_moderation_action` md5 unchanged. Triggers enabled: `audit_verification_decision` (verification_submissions), `audit_report_decision` (rentlease_reporting.events), `audit_review_decision` (rentlease_reviews.events), `receipts_immutable`. `authenticated` and `anon` hold no privileges on `moderation_actions`, `admin_audit_logs` or the receipts table; `service_role` none on receipts; `authenticated` has no usage on the private schema; receipts RLS on, 0 rows; private trigger functions not executable by clients; index present. `pg_get_functiondef` of `get_admin_audit_log` contains both conflicted filters inside CTE f. Fingerprints (count and md5) of the 12 affected tables are identical to the backup's after-capture snapshot (listings 11, profiles 8, reports 2, tenancies 2, verification_submissions 15, cases 2, events 3, receipts 3, entries 3, review events 6, moderation_actions 0, admin_audit_logs 0) |
| Local evidence | Container harness 125 checks pass (new: conflicted-Admin visibility); 15 deliberate breakages each caught (three new: no report-event filter, no action-row filter, filter outside the counted set); drift-guard tests fail when either filter is removed from the SQL; typecheck clean; full `npm test` 1827 tests, 56 failures (known baseline) |
| Not exercised on the hosted project | Any Admin action, `get_admin_restrictions`, `get_admin_audit_log` call, audit trigger firing, or the app against the new RPCs. Hosted behavior is therefore RUNTIME-UNVERIFIED. The migration file's header still says "NOT APPLIED"; it was left unchanged so the file matches what was applied |
| Rollback | `supabase/test-support/admin_actions_audit_rollback.sql` (retains audit rows and non-empty receipts, never undoes applied actions). Not run |
| Known limits | An end date is informational (no scheduler); `pause_listing` not offered (future work: moderation-hold flag); a removed listing cannot be reopened by its owner through any RPC, but the owner can still create and publish a NEW listing for the same property (open gap, needs a guard in `save_listing_draft` or `publish_listing`) |

## November 14, 2026 - Reinstate listing and re-listing guard: live read-only inspection and prepared migration (NOT APPLIED)

| Field | Entry |
| --- | --- |
| Date | Executed and recorded 2026-11-14 |
| Feature/phase | Reporting & Moderation, Admin Actions and Audit; entry ADMIN-REINSTATE-RELIST-GUARD-2026-11-14 |
| Actor/tool | Claude Code with the Supabase CLI (`db query --linked`, SELECT only); local disposable Docker containers for tests |
| Environment/project | Live project `cxfsbwbwmwmgtqfonqth`, linked CLI session, no secrets recorded |
| Classification | READ_ONLY_INSPECTION (live); local disposable-container tests only. No backup was run and nothing was written to the hosted project |
| Target | `pg_proc` (md5(prosrc), owner, ACL, config, volatility, source) of save_listing_draft, publish_listing, reactivate_listing, update_listing_draft, pause_listing, archive_listing, update_published_listing_content, sync_listing_from_tenancy, validate_listing_owner, rotate_listing_edit_version, rentlease_unfinished_posts.remember_publication, apply_admin_moderation_action, get_admin_audit_log, get_admin_restrictions, apply_moderation_action; columns, constraints, indexes, policies, triggers, RLS and client privileges of public.listings and public.admin_audit_logs; columns of verification_submissions and reports |
| Result | All pins matched the values supplied by the owner: save_listing_draft 260ffe2c338beb57840aa761072e2b82, publish_listing 11e9d42b4ff2cdec8bd2148557beb92a, reactivate_listing 8eb305fd08f1edfebd2b66b21aff22e9, apply_admin_moderation_action 7cb33c1bc86c374a0761049ecfcfc879, get_admin_audit_log 08481f61304cb7498c51ea359af2bbef, get_admin_restrictions 96da176a5c89402a1390c25ac4c816f5, apply_moderation_action 311afeb3c10eef8dd2b1b5a965377f21. Extra pins recorded: update_listing_draft 1cbc01da840fe61e6465e1c6c0f8f61b, validate_listing_owner 986f1672c657ac3f6d4bfc77620ba094, rotate_listing_edit_version 29523f51f58611aea3403a30f3310e8d, remember_publication 0a2eafe977a03f73ab65be10c445f2c8. Listing triggers (trg_validate_listing_owner, unfinished_post_publication, trg_listings_edit_version, trg_listings_updated_at), the CHECK constraints (value ranges only, none on status) and the policies do not block or corrupt removed to paused. authenticated has only SELECT on public.listings. No other RPC accepts a removed listing (pause and archive: active or paused; publish and update_listing_draft: draft; update_published_listing_content: active or paused; reactivate: paused). There is no unique index limiting live listings per property; the live-listing rule is enforced in publish_listing and reactivate_listing only |
| Durable effect | None on the hosted project |
| Rollback/cleanup | Not applicable (nothing applied). All Docker containers were removed by the harness |
| Security/RLS | Prepared change patches two owner RPCs (guard only), extends one Admin RPC, patches one Admin read RPC and adds one read-only Admin RPC (security definer, owner postgres, search_path=pg_catalog, EXECUTE for authenticated only, requires is_active_admin). Client table privileges stay unchanged (the migration asserts SELECT-only on listings and none on the moderation, audit and receipt tables) |
| Source-controlled backend file | `supabase/migrations/20261114120000_admin_reinstate_relist_guard.sql` (SHA-256 `df577c24d4a5dd2fa1ea172a935636f892dfe8810a1502704d45acb0a159f83f`); rollback `supabase/test-support/admin_reinstate_relist_guard_rollback.sql`; fixtures `admin_reinstate_relist_guard_baseline.json` and `admin_reinstate_relist_guard_effective.json`; harness `supabase/tests/run_admin_reinstate_relist_guard.py` and `run_admin_reinstate_relist_guard_mutations.py`; notes `supabase/test-support/ADMIN_REINSTATE_RELIST_GUARD.md` |
| Android/client runtime | Not applicable: the app does not call reinstate_listing or get_admin_removed_listings yet. database.types.ts has the one new RPC entry |

New md5 after the patch: save_listing_draft d237ba50f916e5bed50cd374b642dd5f, publish_listing 2f4cfbd538be5d760256995ec01ce7a7, apply_admin_moderation_action 13167370320a77a820ace658be778f04, get_admin_audit_log 43458893456015aa7738c5f2dbeec02b (save_listing_draft and publish_listing are unchanged from the first prepared version).

Local evidence (not hosted): 136 container checks and 35 deliberate mutations of the migration, each caught by a behavior check (a control mutant that only switches off the md5 pins passes all checks). An earlier mutation run was discarded because every mutant failed on the header-md5 comparison first; that comparison is now skipped for mutants.

Deployment prerequisites (not done): explicit approval; a fresh predeploy backup; reconfirm every pin above; run only the migration file with `supabase.cmd db query --linked -f`, then `migration repair --status applied 20261114120000`; never `db push`. Known limits and open points: (1) the Admin error mapper has no rule for 'Listing is not removed', 'This property already has a live listing', 'A report is not used for this action' and 'Property has a removed listing' (a drift test pins this); (2) revision 2 (2026-11-14, still not applied): the report-conflict rule is one rule for a report about the listing OR about its owner (reports.reported_listing_id = the listing, reports.reported_user_id = its landlord, judged by rentlease_reporting.conflicted): reinstate_listing refuses with 'Access unavailable' (42501), get_admin_removed_listings leaves the listing out of both count and rows (one CTE), and get_admin_audit_log hides its reinstate_listing row inside CTE f; reinstatable is false for an Admin-owned listing or a property with another active, paused or rented listing. A user report has no property, so the real conflict path for an owner report is being a party to the conversation (the harness models it with an Admin who reported the owner); a tenancy on the reported property conflicts only for listing reports; (3) update_listing_draft (not changed, as instructed) still lets the owner edit an existing draft on a property with a removed listing; publishing it is blocked; (4) the result id of a reinstatement is the operation id, not a moderation_actions id.
