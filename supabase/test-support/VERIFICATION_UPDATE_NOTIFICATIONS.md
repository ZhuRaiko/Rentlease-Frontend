# verification_update notifications (migration 20261114180000)

**Status: prepared locally, NOT applied.** Apply only after review, a fresh predeploy backup and live-source reconfirmation. Apply with `supabase db query --linked -f`, then `migration repair --status applied 20261114180000`. Never `db push`.

## What it does
- `rentlease_notifications.generate_verification()` (trigger function, security definer, `search_path=pg_catalog`, no client execute) writes one notification through the existing `rentlease_notifications.emit()` when a submission becomes `approved` or `rejected`.
  - Tier 3 (`tier_3_property`): kind `property_verification`, id = property id. Titles "Property verification approved" / "Property verification needs changes".
  - Tier 2 (`tier_2_identity`): kind `identity_verification`, id = submission id. Titles "Identity verification approved" / "Identity verification needs changes".
  - Other tiers: nothing. The recipient is the submission's owner, never the reviewer. `rejection_reason` and `review_note` are never read. The body is emit()'s generic "Open RentLease to review this update."
  - Event key `verification:<submission id>:<status>`, so a repeat can never add a second row.
- Trigger `inapp_verification`: `AFTER UPDATE OF status ... FOR EACH ROW WHEN (old.status IS DISTINCT FROM new.status AND new.status IN ('approved','rejected'))`.
- `public.get_in_app_notification_target(uuid)` is patched (one anchor, `reporter_id=a) then return`, exactly once) so the two new kinds open: the caller must own the property (`properties.landlord_id`) or the Tier 2 submission (`verification_submissions.user_id`, tier `tier_2_identity`). Anything else returns null, as an unknown kind does today.
- `generate()` and `emit()` are not changed.

## Pins (hosted, read-only, 2026-11-14)
| Function | md5(prosrc) |
|---|---|
| `get_in_app_notification_target(uuid)` before | `535a95ee46f7060e6adeaea28509ef8c` |
| `get_in_app_notification_target(uuid)` after | `bb9c3744ea4547026a49c027bc1e8525` |
| `rentlease_notifications.emit` (unchanged) | `81a5f1b377e0a5c57ccca6d23a0374bb` |
| `rentlease_notifications.generate` (unchanged) | `08b686c7868662747ec9bf3f119c6177` |

The three "before/unchanged" values were also recomputed from the repo migration `20261111035305_in_app_notifications.sql` and match, so the repo text is the hosted text.

## Rollback
`verification_update_notifications_rollback.sql`: drops the trigger and function, restores the original `get_in_app_notification_target` source (checked back to `535a95ee...`), idempotent. Notifications already written stay.

## Tests
`python supabase/tests/run_verification_update_notifications.py` (Docker; the container has no network, mounts or ports; the hosted project is never contacted). Add `--migration <copy>` / `--rollback <copy>` for mutation checks.

What it proves: the real emit/generate/caller/target function bodies (extracted byte-for-byte from the repo migration, md5-checked against the hosted pins) behave as described with the new trigger: pending to under_review writes nothing; approve and reject write exactly one row with the right type, title, kind, target and generic body; no reviewer text reaches the row; Tier 2 fires through a delegated review function; repeats add nothing; the reviewer never receives one; the trigger function is not executable by authenticated, anon or PUBLIC; the patched target function resolves the new kinds only for the owner and still resolves conversation, tenancy and report; the rollback restores the exact original md5 and ACL; every test body is rolled back and the notification count is unchanged.

What it does NOT prove: it does not run the hosted `review_verification_submission` or `review_property_identity_verification`. They are stand-ins that run the same `UPDATE ... SET status = ...` statement the hosted ones run (read from the repo migrations); the trigger is on the table, so any path that updates `status` fires it, but the hosted review functions' own preconditions are not exercised. The tables are minimal stand-ins (no hosted RLS beyond the notifications policy). The tier enum labels are those the hosted code compares against (`tier_2_identity`, `tier_3_property`).
