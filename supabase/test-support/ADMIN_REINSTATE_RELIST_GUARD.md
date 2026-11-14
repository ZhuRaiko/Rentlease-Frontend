# Reinstate listing and re-listing guard: local tests for 20261114120000_admin_reinstate_relist_guard.sql

Local, disposable and network-isolated only. **The migration is prepared, not applied.** Never run any of this against the hosted project, and never deploy with `db push`.

```
python supabase/tests/run_admin_reinstate_relist_guard.py
python supabase/tests/run_admin_reinstate_relist_guard.py --migration <modified copy>      # one mutant
python supabase/tests/run_admin_reinstate_relist_guard_mutations.py [--jobs 4]             # all mutants, reports caught / NOT CAUGHT
python supabase/tests/run_admin_reinstate_relist_guard.py --discover                       # prints md5 pins and rewrites the effective-source snapshot
```

Requires Docker. Each run starts one no-network, no-mount, no-port container from `public.ecr.aws/supabase/postgres:17.6.1.155` and removes it at the end.

## What the migration does

- **Part A.** `save_listing_draft` and `publish_listing` raise `Property has a removed listing` (22023) when any listing on the property is removed. The check runs after the per-property advisory lock both functions already take, which is the lock the Admin removal takes, so the two are serialized. `reactivate_listing` and `update_listing_draft` are not touched.
- **Part B.** `apply_admin_moderation_action` accepts `reinstate_listing` (removed to paused; `paused_at` set; `removed_at` and `removal_reason` cleared; one audit row; the usual receipt and idempotency). No enum value is added, no `moderation_actions` row is written and `apply_moderation_action()` is not touched. New read-only `get_admin_removed_listings()`.
- **Part C.** `get_admin_audit_log` adds `actorId`, names the subject of verification and report rows (confirmed public nickname or short id; listing title), and lists `reinstate_listing` under Actions.
- Each existing function is patched, not retyped: a pinned `md5(prosrc)`, each anchor exactly once in `pg_get_functiondef`, an exactly reversible edit, the patched md5 recorded in the migration header, and identical owner, ACL, security definer, search_path and volatility afterward.

## Fixture

- The REAL reporting (`20261110171913`), admin-access (`20261112155016`) and admin-actions-audit (`20261113180000`) migrations are applied, so `moderate_rental_report`, `conflicted`, `is_active_admin`, `apply_admin_moderation_action`, `get_admin_restrictions` and `get_admin_audit_log` are the real ones.
- `admin_actions_audit_baseline.sql` supplies the moderation tables and `apply_moderation_action()` with its trigger (CRLF body, md5 pin asserted).
- `admin_reinstate_relist_guard_baseline.json` holds byte-faithful copies of the hosted `save_listing_draft`, `publish_listing`, `reactivate_listing`, `update_listing_draft`, `validate_listing_owner`, `rotate_listing_edit_version` and `rentlease_unfinished_posts.remember_publication` (read-only capture of 2026-11-14; JSON keeps CR and LF exactly) and the harness asserts every md5. `public.listings` has the hosted columns, defaults, CHECK constraints, foreign keys and indexes, the four hosted triggers, and the hosted client privilege (authenticated: SELECT only).
- `admin_reinstate_relist_guard_effective.json` is the patched source of the four functions as the harness produced it. Every run asserts it equals the real patched functions, and the frontend drift test (`tests/adminActionsErrorDrift.test.ts`) reads it. Regenerate with `--discover` after any change to the migration.
- Stand-ins (minimal): `profiles`, `properties` (plus a `verified` flag behind a stand-in `rentlease_property_identity.verified`), `rentlease_completeness.calculate_listing_completeness` (returns 0.9), `rentlease_unfinished_posts.records`, `conversations`, `tenancies`, `verification_submissions`, `rentlease_reviews`.

## What it covers

Fixture fidelity and every md5 pin; drift guards (each of the eleven pinned functions changed, a client write privilege on `public.listings`, a client privilege on `admin_audit_logs`, a disabled listing trigger, a pre-existing `get_admin_removed_listings`) each abort the migration atomically; the four new md5 values match the header; the seven untouched functions are byte-identical; owner, ACL and configuration are unchanged; grants (authenticated only, anon denied); non-admin, suspended-Admin and unauthenticated denial; Part A (new draft, existing draft, publish, other property unaffected, owner cannot reactivate, edit, publish or directly update a removed listing, the removal-vs-save and removal-vs-publish ordering under the property lock, and five real remove-vs-save races judged by transaction id); every reinstate validation, the effect, audit row and receipt, idempotent and conflicting retries, retry after the listing changed, concurrent double reinstatement and concurrent identical retries, strict-audit rollback; owner reactivation and the existing re-listing rules afterwards; the audit-log names and `actorId`, the conflicted-Admin filters (including a conflict through a report about the listing and one about its owner only, for the removed list, the reinstate RPC and the reinstate audit row); `get_admin_removed_listings` fields, ordering, the 100-row cap and `reinstatable`; the rollback (exact pre-migration md5 pins, retained audit rows, receipts and reinstated listings, second rollback refused) and re-apply.

## What this does not prove

Hosted behavior, PostgREST exposure, the hosted completeness and property-identity functions (stand-ins here), load, and any Android runtime. The frontend does not call `reinstate_listing` or `get_admin_removed_listings` yet, and the Admin error mapper has no rule for the four new messages (see the ledger).
