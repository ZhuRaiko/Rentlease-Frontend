# Admin actions and audit log: local tests for 20261113180000_admin_actions_audit.sql

Local, disposable and network-isolated only. Never run any of this against the hosted project, and never deploy with `db push`.

```
python supabase/tests/run_admin_actions_audit.py
python supabase/tests/run_admin_actions_audit.py --migration <modified copy>   # mutation check
```

Requires Docker. The harness starts one no-network, no-mount, no-port container from `public.ecr.aws/supabase/postgres:17.6.1.155` and removes it at the end.

## Fixture

- The real reporting migration (`20261110171913`) and admin-access migration (`20261112155016`) are applied, so `moderate_rental_report`, `rentlease_reporting.conflicted` and `is_active_admin` are the real ones.
- `admin_actions_audit_baseline.sql` reproduces the hosted moderation objects read on 2026-11-13: `moderation_actions`, `admin_audit_logs`, `apply_moderation_action()` and its trigger, with no client privileges. The function body is rebuilt with CRLF line endings and the harness asserts `md5(prosrc)` equals the hosted pin `311afeb3c10eef8dd2b1b5a965377f21`.
- Synthetic stand-ins (minimal columns the code reads): `profiles`, `properties`, `listings`, `tenancies`, `conversations`, `messages`, `verification_submissions`, `rentlease_reviews.entries/events`. The hosted review and verification RPCs (`moderate_rental_review`, `review_verification_submission`, `review_property_identity_verification`) are NOT in the container: the audit triggers are tested by performing the same status update or event insert those RPCs perform, with an Admin identity.

## What the 117 checks cover

Fixture fidelity and the md5 pin; migration drift guards (changed `apply_moderation_action`, missing `is_active_admin`, a client privilege on either table, a pre-existing private schema, a disabled apply trigger) each abort atomically; grants (RPCs executable by `authenticated` only, trigger functions and tables not reachable by clients, anonymous denied); non-Admin, suspended-Admin and unauthenticated callers denied; the full validation matrix (action, reason bounds after trimming, target shape, end date rules, self and Admin targets, deleted or unknown targets, account and listing state rules, open tenancy by status and by property); happy paths with the existing trigger's effect and audit row; idempotency (replay, changed input refused, per-actor receipts, retry after the target changed, retry after the end date passed, time-zone-equivalent end dates); concurrency (two Admins on one user, two identical retries, remove waiting on the per-property lock while a tenancy is proposed); report linkage through the real reporting functions (not upheld, unknown, mismatch, conflicted Admin, listing and user reports); `get_admin_restrictions` (contents, public name only, ended flag, restorable flag, exact field set); audit triggers for verification, report and review decisions (who is audited, which statuses, exact metadata keys, no PII or document names); `get_admin_audit_log` (filters, ordering, paging, invalid input, public labels only, no raw metadata); strict audit (an audit failure rolls back the RPC, a listing removal, a report decision, a verification decision and a review decision; the same operation ids succeed after recovery); defense in depth (apply trigger disabled or replaced by one that does not audit); the rollback script (retained and empty receipts paths, second rollback refused, re-application).

## Mutation checks run

Twelve copies of the migration, each deliberately broken, were run with `--migration` and all failed at the intended check: no open-tenancy check, an audit trigger that swallows errors, `is_admin` instead of `is_active_admin`, the private name in the restrictions list, no self-target check, no Admin-target check, the end-date rule before the receipt lookup, an `anon` grant, no report requirement, no conflicted-report check, `pause_listing` allowed again, and the report required only for suspend.

## What this does not prove

Hosted behavior, the hosted review and verification RPCs, PostgREST exposure, Realtime, Android runtime, load, and any behavior of Admin accounts other than those modeled. The frontend drift-guard test (`tests/adminActionsErrorDrift.test.ts`) keeps this SQL and the app's messages, parameter names, bounds and filters in step.
